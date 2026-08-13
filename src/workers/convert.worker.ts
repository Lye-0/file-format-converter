/// <reference lib="webworker" />
import * as Comlink from "comlink";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { PDFDocument } from "pdf-lib";
import { pngToIco } from "@/lib/ico";

export type ImageOpts = { scalePct?: number; rotate?: number; quality?: number };

/* ---------- wasm-vips (画像) ---------- */
let vipsPromise: Promise<any> | null = null;
async function getVips() {
  if (!vipsPromise) {
    const mod: any = await import("wasm-vips");
    const Vips = mod.default;
    // public/vips/ に置いた .wasm などを読み込む
    vipsPromise = Vips({ locateFile: (f: string) => `/vips/${f}` });
  }
  return vipsPromise;
}

/* ---------- ffmpeg.wasm (音声) ---------- */
let ffmpeg: FFmpeg | null = null;
async function getFFmpeg() {
  if (!ffmpeg) {
    ffmpeg = new FFmpeg();
    // public/ffmpeg/ に置いた core を読み込む（シングルスレッド版）
    await ffmpeg.load({
      coreURL: "/ffmpeg/ffmpeg-core.js",
      wasmURL: "/ffmpeg/ffmpeg-core.wasm",
    });
  }
  return ffmpeg;
}

const api = {
  /* 画像 → 画像 / ICO */
  async convertImage(buffer: ArrayBuffer, target: string, opts: ImageOpts = {}) {
    const vips = await getVips();
    let img = vips.Image.newFromBuffer(new Uint8Array(buffer));
    try { img = img.autorot(); } catch { /* EXIF なし */ }

    if (opts.rotate === 90) img = img.rot(vips.Angle.d90);
    else if (opts.rotate === 180) img = img.rot(vips.Angle.d180);
    else if (opts.rotate === 270) img = img.rot(vips.Angle.d270);

    if (opts.scalePct && opts.scalePct !== 100) {
      img = img.resize(opts.scalePct / 100);
    }

    // ---- ICO ----
    if (target === "ico") {
      const maxDim = Math.max(img.width, img.height);
      if (maxDim > 256) img = img.resize(256 / maxDim);
      const png: Uint8Array = img.writeToBuffer(".png");
      const ico = pngToIco(png, img.width, img.height);
      img.delete();
      const ab = ico.slice().buffer;
      return Comlink.transfer(ab, [ab]);
    }

    // ---- 通常のラスター形式 ----
    const q = opts.quality ?? 80;
    const ext = target === "jpeg" ? "jpg" : target;
    const options: Record<string, unknown> = {};
    if (["jpg", "webp", "avif", "heic", "heif"].includes(ext)) options.Q = q;

    const out: Uint8Array = img.writeToBuffer("." + ext, options);
    img.delete();
    const ab = out.slice().buffer;
    return Comlink.transfer(ab, [ab]);
  },

  /* 画像 → PDF */
  async imageToPdf(buffer: ArrayBuffer, opts: ImageOpts = {}) {
    const vips = await getVips();
    let img = vips.Image.newFromBuffer(new Uint8Array(buffer));
    try { img = img.autorot(); } catch { /* noop */ }
    if (opts.rotate === 90) img = img.rot(vips.Angle.d90);
    else if (opts.rotate === 180) img = img.rot(vips.Angle.d180);
    else if (opts.rotate === 270) img = img.rot(vips.Angle.d270);
    if (opts.scalePct && opts.scalePct !== 100) img = img.resize(opts.scalePct / 100);

    const png: Uint8Array = img.writeToBuffer(".png");
    const w = img.width;
    const h = img.height;
    img.delete();

    const pdf = await PDFDocument.create();
    const embedded = await pdf.embedPng(png);
    const page = pdf.addPage([w, h]);
    page.drawImage(embedded, { x: 0, y: 0, width: w, height: h });
    const bytes = await pdf.save();
    const ab = bytes.slice().buffer;
    return Comlink.transfer(ab, [ab]);
  },

  /* 音声 → 音声 */
  async convertAudio(
    buffer: ArrayBuffer,
    inputName: string,
    target: string,
    onProgress?: (p: number) => void,
  ) {
    const ff = await getFFmpeg();
    const handler = ({ progress }: { progress: number }) =>
      onProgress?.(Math.min(0.99, progress));
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
