/// <reference lib="webworker" />
import * as Comlink from "comlink";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { PDFDocument } from "pdf-lib";
import { pngToIco } from "@/lib/ico";

export type ImageOpts = {
  scalePct?: number;
  rotate?: number;
  quality?: number;
};

/* ---------- wasm-vips（画像） ---------- */

type VipsModule = {
  default?: (options?: Record<string, unknown>) => Promise<any>;
};

let vipsPromise: Promise<any> | null = null;

/**
 * 重要:
 * Next.js 16 / Turbopack では import("wasm-vips") すると、
 * node_modules/wasm-vips/lib/vips-es6.js がバンドル解析されて
 * CommonJS / ESM 判定の不整合で落ちることがある。
 *
 * そのため npm package として import せず、
 * public/vips/vips-es6.js をブラウザ実行時に直接読み込む。
 *
 * new Function 経由にしているのは、Turbopack にこの import を
 * 静的解析させないため。
 */
async function getVips() {
  if (!vipsPromise) {
    vipsPromise = (async () => {
      const dynamicImport = new Function(
        "path",
        "return import(path)",
      ) as (path: string) => Promise<VipsModule>;

      const mod = await dynamicImport("/vips/vips-es6.js");
      const Vips = mod.default ?? (mod as any);

      return await Vips({
        locateFile: (file: string) => `/vips/${file}`,
      });
    })();
  }

  return vipsPromise;
}

/* ---------- ffmpeg.wasm（音声） ---------- */

let ffmpeg: FFmpeg | null = null;

async function getFFmpeg() {
  if (!ffmpeg) {
    ffmpeg = new FFmpeg();

    // public/ffmpeg/ に置いた core を読み込む
    await ffmpeg.load({
      coreURL: "/ffmpeg/ffmpeg-core.js",
      wasmURL: "/ffmpeg/ffmpeg-core.wasm",
    });
  }

  return ffmpeg;
}

/* ---------- Worker API ---------- */

const api = {
  /**
   * 画像 → 画像 / ICO
   */
  async convertImage(buffer: ArrayBuffer, target: string, opts: ImageOpts = {}) {
    const vips = await getVips();

    let img = vips.Image.newFromBuffer(new Uint8Array(buffer));

    try {
      img = img.autorot();
    } catch {
      // EXIFがない画像では何もしない
    }

    if (opts.rotate === 90) {
      img = img.rot(vips.Angle.d90);
    } else if (opts.rotate === 180) {
      img = img.rot(vips.Angle.d180);
    } else if (opts.rotate === 270) {
      img = img.rot(vips.Angle.d270);
    }

    if (opts.scalePct && opts.scalePct !== 100) {
      img = img.resize(opts.scalePct / 100);
    }

    // ICO
    if (target === "ico") {
      const maxDim = Math.max(img.width, img.height);

      if (maxDim > 256) {
        img = img.resize(256 / maxDim);
      }

      const png: Uint8Array = img.writeToBuffer(".png");
      const ico = pngToIco(png, img.width, img.height);

      img.delete();

      const ab = ico.slice().buffer;
      return Comlink.transfer(ab, [ab]);
    }

    // 通常の画像形式
    const ext = target === "jpeg" ? "jpg" : target;
    const q = opts.quality ?? 80;
    const options: Record<string, unknown> = {};

    if (["jpg", "webp", "avif", "heic", "heif"].includes(ext)) {
      options.Q = q;
    }

    const out: Uint8Array = img.writeToBuffer("." + ext, options);

    img.delete();

    const ab = out.slice().buffer;
    return Comlink.transfer(ab, [ab]);
  },

  /**
   * 画像 → PDF
   */
  async imageToPdf(buffer: ArrayBuffer, opts: ImageOpts = {}) {
    const vips = await getVips();

    let img = vips.Image.newFromBuffer(new Uint8Array(buffer));

    try {
      img = img.autorot();
    } catch {
      // noop
    }

    if (opts.rotate === 90) {
      img = img.rot(vips.Angle.d90);
    } else if (opts.rotate === 180) {
      img = img.rot(vips.Angle.d180);
    } else if (opts.rotate === 270) {
      img = img.rot(vips.Angle.d270);
    }

    if (opts.scalePct && opts.scalePct !== 100) {
      img = img.resize(opts.scalePct / 100);
    }

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