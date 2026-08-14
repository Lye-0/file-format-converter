/// <reference lib="webworker" />

import * as Comlink from "comlink";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { PDFDocument } from "pdf-lib";
import { pngToIco } from "@/lib/ico";

export type ImageOpts = {
  scalePct?: number;
  width?: number;
  height?: number;
  keepAspect?: boolean;
  rotate?: number;
  flipX?: boolean;
  flipY?: boolean;
  quality?: number;
};

/* ---------- wasm-vips（画像） ---------- */

type VipsModule = {
  default?: (options?: Record<string, unknown>) => Promise<any>;
};

let vipsPromise: Promise<any> | null = null;

async function getVips() {
  if (!vipsPromise) {
    vipsPromise = (async () => {
      const dynamicImport = new Function(
        "path",
        "return import(path)",
      ) as (path: string) => Promise<VipsModule>;

      const mod = await dynamicImport("/vips/vips-es6.js");
      const Vips = mod.default ?? (mod as any);

      const vips = await Vips({
        locateFile: (file: string) => `/vips/${file}`,
      });
      return vips;
    })();
  }

  return vipsPromise;
}

/* ---------- ffmpeg.wasm（音声） ---------- */

let ffmpeg: FFmpeg | null = null;

async function getFFmpeg() {
  if (!ffmpeg) {
    ffmpeg = new FFmpeg();

    await ffmpeg.load({
      coreURL: "/ffmpeg/ffmpeg-core.js",
      wasmURL: "/ffmpeg/ffmpeg-core.wasm",
    });
  }

  return ffmpeg;
}

/* ---------- 画像編集共通処理 ---------- */

function applyImageTransforms(img: any, vips: any, opts: ImageOpts = {}) {
  let out = img;

  try {
    out = out.autorot();
  } catch {
    // EXIFがない画像では何もしない
  }

  if (opts.rotate === 90) {
    out = out.rot(vips.Angle.d90);
  } else if (opts.rotate === 180) {
    out = out.rot(vips.Angle.d180);
  } else if (opts.rotate === 270) {
    out = out.rot(vips.Angle.d270);
  }

  // --- 左右反転 ---
  if (opts.flipX) {
    let flipped = false;

    console.log("[vips] flipX requested. img size:", out.width, "x", out.height);
    console.log("[vips] typeof flipHoriz:", typeof out.flipHoriz);
    console.log("[vips] typeof flipVert:", typeof out.flipVert);
    console.log("[vips] typeof flip:", typeof out.flip);
    console.log("[vips] Direction:", JSON.stringify(vips.Direction));

    // 方法1: flipHoriz()
    try {
      if (typeof out.flipHoriz === "function") {
        const result = out.flipHoriz();
        console.log("[vips] flipHoriz() returned:", !!result, "size:", result?.width, "x", result?.height);
        if (result) {
          out = result;
          flipped = true;
        }
      }
    } catch (e) {
      console.log("[vips] flipHoriz() threw:", e);
    }

    // 方法2: flip(0) — libvips の VIPS_DIRECTION_HORIZONTAL = 0
    if (!flipped) {
      try {
        const result = out.flip(0);
        console.log("[vips] flip(0) returned:", !!result);
        if (result) {
          out = result;
          flipped = true;
        }
      } catch (e) {
        console.log("[vips] flip(0) threw:", e);
      }
    }

    // 方法3: rot(180) + flipVert() の組み合わせ = 左右反転と等価
    if (!flipped) {
      try {
        const rotated = out.rot(vips.Angle.d180);
        const result = rotated.flipVert();
        console.log("[vips] rot180+flipVert returned:", !!result);
        if (result) {
          out = result;
          flipped = true;
        }
      } catch (e) {
        console.log("[vips] rot180+flipVert threw:", e);
      }
    }

    console.log("[vips] flipX final flipped:", flipped, "size:", out.width, "x", out.height);
  }

  // --- 上下反転 ---
  if (opts.flipY) {
    let flipped = false;

    // 方法1: flipVert()
    try {
      if (typeof out.flipVert === "function") {
        const result = out.flipVert();
        console.log("[vips] flipVert() returned:", !!result);
        if (result) {
          out = result;
          flipped = true;
        }
      }
    } catch (e) {
      console.log("[vips] flipVert() threw:", e);
    }

    // 方法2: flip(1) — libvips の VIPS_DIRECTION_VERTICAL = 1
    if (!flipped) {
      try {
        const result = out.flip(1);
        console.log("[vips] flip(1) returned:", !!result);
        if (result) {
          out = result;
          flipped = true;
        }
      } catch (e) {
        console.log("[vips] flip(1) threw:", e);
      }
    }

    // 方法3: rot(180) + flipHoriz() の組み合わせ = 上下反転と等価
    if (!flipped) {
      try {
        const rotated = out.rot(vips.Angle.d180);
        const result = rotated.flipHoriz();
        console.log("[vips] rot180+flipHoriz returned:", !!result);
        if (result) {
          out = result;
          flipped = true;
        }
      } catch (e) {
        console.log("[vips] rot180+flipHoriz threw:", e);
      }
    }

    console.log("[vips] flipY final flipped:", flipped, "size:", out.width, "x", out.height);
  }

  const requestedWidth =
    typeof opts.width === "number" && opts.width > 0 ? opts.width : undefined;

  const requestedHeight =
    typeof opts.height === "number" && opts.height > 0 ? opts.height : undefined;

  if (requestedWidth || requestedHeight) {
    const xScale = requestedWidth ? requestedWidth / out.width : undefined;
    const yScale = requestedHeight ? requestedHeight / out.height : undefined;

    if (opts.keepAspect !== false) {
      const scale =
        xScale && yScale ? Math.min(xScale, yScale) : xScale ?? yScale ?? 1;

      out = out.resize(scale);
    } else {
      const xs = xScale ?? 1;
      const ys = yScale ?? 1;

      try {
        out = out.resize(xs, { vscale: ys });
      } catch {
        out = out.resize(xs);
      }
    }
  } else if (opts.scalePct && opts.scalePct !== 100) {
    out = out.resize(opts.scalePct / 100);
  }

  return out;
}

/* ---------- Worker API ---------- */

const api = {
  /**
   * 画像 → 画像 / ICO
   */
  async convertImage(buffer: ArrayBuffer, target: string, opts: ImageOpts = {}) {
    let img: any = null;

    try {
      const vips = await getVips();

      img = vips.Image.newFromBuffer(new Uint8Array(buffer));
      img = applyImageTransforms(img, vips, opts);

      if (target === "ico") {
        const maxDim = Math.max(img.width, img.height);

        if (maxDim > 256) {
          img = img.resize(256 / maxDim);
        }

        const png: Uint8Array = img.writeToBuffer(".png");
        const ico = pngToIco(png, img.width, img.height);

        img.delete();
        img = null;

        const ab = ico.slice().buffer;
        return Comlink.transfer(ab, [ab]);
      }

      const ext = target === "jpeg" ? "jpg" : target;
      const q = opts.quality ?? 82;
      const options: Record<string, unknown> = {};

      if (["jpg", "webp", "avif", "heic", "heif"].includes(ext)) {
        options.Q = q;
      }

      const out: Uint8Array = img.writeToBuffer("." + ext, options);

      img.delete();
      img = null;

      if (out.length === 0) {
        throw new Error(`出力形式 ${target} への変換結果が空です。`);
      }

      const ab = out.slice().buffer;
      return Comlink.transfer(ab, [ab]);
    } catch (err) {
      if (img) {
        try {
          img.delete();
        } catch {
          // ignore cleanup error
        }
      }
      throw new Error(
        `画像処理に失敗しました: ${err instanceof Error ? err.message : "不明なエラー"}`,
      );
    }
  },

  /**
   * 画像 → PDF
   */
  async imageToPdf(buffer: ArrayBuffer, opts: ImageOpts = {}) {
    const vips = await getVips();

    let img = vips.Image.newFromBuffer(new Uint8Array(buffer));
    img = applyImageTransforms(img, vips, opts);

    const png: Uint8Array = img.writeToBuffer(".png");
    const w = img.width;
    const h = img.height;

    img.delete();

    const pdf = await PDFDocument.create();
    const embedded = await pdf.embedPng(png);
    const page = pdf.addPage([w, h]);

    page.drawImage(embedded, {
      x: 0,
      y: 0,
      width: w,
      height: h,
    });

    const bytes = await pdf.save();
    const ab = bytes.slice().buffer;

    return Comlink.transfer(ab, [ab]);
  },

  /**
   * 音声 → 音声
   */
  async convertAudio(
    buffer: ArrayBuffer,
    inputName: string,
    target: string,
    onProgress?: (p: number) => void,
  ) {
    const ff = await getFFmpeg();

    const handler = ({ progress }: { progress: number }) => {
      onProgress?.(Math.min(0.99, progress));
    };

    ff.on("progress", handler);

    const outName = "output." + target;

    await ff.writeFile(inputName, new Uint8Array(buffer));
    await ff.exec(["-i", inputName, outName]);

    const data = (await ff.readFile(outName)) as Uint8Array;

    await ff.deleteFile(inputName).catch(() => {});
    await ff.deleteFile(outName).catch(() => {});

    ff.off("progress", handler);

    const ab = data.slice().buffer;
    return Comlink.transfer(ab, [ab]);
  },
};

export type WorkerApi = typeof api;

Comlink.expose(api);