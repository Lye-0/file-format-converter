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

  let applied = false;

  try {
    if (opts.flipX) {
      out = out.flipHoriz();
      applied = true;
    }
  } catch {
    // noop
  }

  if (!applied) {
    try {
      if (opts.flipX) {
        out = out.flip(vips.Direction.HORIZONTAL);
      }
    } catch {
      // noop
    }
  }

  applied = false;

  try {
    if (opts.flipY) {
      out = out.flipVert();
      applied = true;
    }
  } catch {
    // noop
  }

  if (!applied) {
    try {
      if (opts.flipY) {
        out = out.flip(vips.Direction.VERTICAL);
      }
    } catch {
      // noop
    }
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