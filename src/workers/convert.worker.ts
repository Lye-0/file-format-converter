/// <reference lib="webworker" />

import * as Comlink from "comlink";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { PDFDocument } from "pdf-lib";
import { pngToIco } from "@/lib/ico";
import { decodeBmp, encodeBmp } from "@/lib/bmp";

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

      return await Vips({
        locateFile: (file: string) => `/vips/${file}`,
      });
    })();
  }

  return vipsPromise;
}

let libheifPromise: Promise<any> | null = null;

async function getLibheif() {
  if (!libheifPromise) {
    libheifPromise = import("libheif-js/wasm-bundle").then(
      (mod) => mod.default ?? mod,
    );
  }

  return libheifPromise;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;

  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }

  try {
    const text = String(err);
    return text && text !== "[object Object]" ? text : "不明なエラー";
  } catch {
    return "不明なエラー";
  }
}

async function decodeHeif(buffer: ArrayBuffer) {
  const libheif = await getLibheif();
  const decoder = new libheif.HeifDecoder();
  const images = decoder.decode(new Uint8Array(buffer));

  if (!images?.length) {
    throw new Error("HEIC / HEIF画像をデコードできませんでした。");
  }

  const image = images[0];
  const width = image.get_width();
  const height = image.get_height();
  const data = new Uint8ClampedArray(width * height * 4);

  try {
    await new Promise<void>((resolve, reject) => {
      image.display({ data, width, height }, (displayData: unknown) => {
        if (!displayData) {
          reject(new Error("HEIC / HEIF画像の画素展開に失敗しました。"));
        } else {
          resolve();
        }
      });
    });

    return {
      data: new Uint8Array(data.buffer),
      width,
      height,
    };
  } finally {
    if (typeof image.free === "function") image.free();
  }
}

async function loadImage(buffer: ArrayBuffer, sourceExt: string, vips: any) {
  const ext = sourceExt.toLowerCase();

  if (ext === "heic" || ext === "heif") {
    const decoded = await decodeHeif(buffer);
    return vips.Image.newFromMemory(
      decoded.data,
      decoded.width,
      decoded.height,
      4,
      "uchar",
    );
  }

  if (ext === "bmp") {
    const decoded = decodeBmp(buffer);
    return vips.Image.newFromMemory(
      decoded.data,
      decoded.width,
      decoded.height,
      4,
      "uchar",
    );
  }

  return vips.Image.newFromBuffer(new Uint8Array(buffer));
}

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

  if (opts.flipX) out = out.flip(vips.Direction.horizontal);
  if (opts.flipY) out = out.flip(vips.Direction.vertical);

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

function imageToBmp(img: any): Uint8Array {
  let normalized = img;
  let temporary: any = null;

  try {
    if (normalized.interpretation !== "srgb") {
      temporary = normalized.colourspace("srgb");
      normalized = temporary;
    }

    if (normalized.format !== "uchar") {
      const casted = normalized.cast("uchar");
      if (temporary) temporary.delete();
      temporary = casted;
      normalized = casted;
    }

    let channels: 3 | 4 = normalized.hasAlpha() ? 4 : 3;
    let packed = normalized;
    let packedTemporary: any = null;

    if (normalized.bands > channels) {
      packedTemporary = normalized.extractBand(0, { n: channels });
      packed = packedTemporary;
    } else if (normalized.bands < 3) {
      packedTemporary = normalized.colourspace("srgb");
      packed = packedTemporary;
      channels = packed.hasAlpha() ? 4 : 3;
    }

    const pixels = packed.writeToMemory() as Uint8Array;
    const bmp = encodeBmp(pixels, packed.width, packed.height, channels);

    if (packedTemporary) packedTemporary.delete();

    return bmp;
  } finally {
    if (temporary) temporary.delete();
  }
}

const api = {
  async convertImage(
    buffer: ArrayBuffer,
    sourceExt: string,
    target: string,
    opts: ImageOpts = {},
  ) {
    let img: any = null;

    try {
      const vips = await getVips();

      img = await loadImage(buffer, sourceExt, vips);
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

      if (target === "bmp") {
        const bmp = imageToBmp(img);

        img.delete();
        img = null;

        const ab = bmp.slice().buffer;
        return Comlink.transfer(ab, [ab]);
      }

      if (target === "heic" || target === "heif") {
        throw new Error("HEIC / HEIFへの出力には現在対応していません。");
      }

      const ext = target === "jpeg" ? "jpg" : target;
      const options: Record<string, unknown> = {};

      if (["jpg", "webp", "avif"].includes(ext)) {
        options.Q = opts.quality ?? 82;
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

      throw new Error(`画像処理に失敗しました: ${errorMessage(err)}`);
    }
  },

  async imageToPdf(
    buffer: ArrayBuffer,
    sourceExt: string,
    opts: ImageOpts = {},
  ) {
    const vips = await getVips();
    let img: any = null;

    try {
      img = await loadImage(buffer, sourceExt, vips);
      img = applyImageTransforms(img, vips, opts);

      const png: Uint8Array = img.writeToBuffer(".png");
      const w = img.width;
      const h = img.height;

      img.delete();
      img = null;

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
    } catch (err) {
      if (img) {
        try {
          img.delete();
        } catch {
          // ignore cleanup error
        }
      }

      throw new Error(`PDF生成に失敗しました: ${errorMessage(err)}`);
    }
  },

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
