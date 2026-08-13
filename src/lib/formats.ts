export type Category = "image" | "audio" | "pdf" | "unsupported";

// 入力として受け付ける画像拡張子
const IMAGE_INPUT = [
  "png", "jpg", "jpeg", "webp", "avif", "gif",
  "bmp", "tiff", "tif", "heic", "heif", "svg",
];
// 画像の出力形式（ラスター）
const IMAGE_OUTPUT = ["png", "jpg", "webp", "avif", "gif", "bmp", "tiff"];
// 音声
const AUDIO = ["mp3", "wav", "flac", "ogg", "aac", "m4a"];

export function getExt(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

export function getCategory(ext: string): Category {
  if (ext === "pdf") return "pdf";
  if (AUDIO.includes(ext)) return "audio";
  if (IMAGE_INPUT.includes(ext)) return "image";
  return "unsupported";
}

// 入力拡張子 → 選択できる出力形式
export function getTargets(ext: string): string[] {
  const cat = getCategory(ext);
  const self = ext === "jpeg" ? "jpg" : ext === "tif" ? "tiff" : ext;
  if (cat === "audio") return AUDIO.filter((f) => f !== ext);
  if (cat === "pdf") return ["png", "jpg"]; // PDF → 画像（1ページ目）
  if (cat === "image") {
    const outs = IMAGE_OUTPUT.filter((f) => f !== self);
    return [...outs, "ico", "pdf"];
  }
  return [];
}

export const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  bmp: "image/bmp",
  tiff: "image/tiff",
  ico: "image/x-icon",
  pdf: "application/pdf",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
  ogg: "audio/ogg",
  aac: "audio/aac",
  m4a: "audio/mp4",
};
