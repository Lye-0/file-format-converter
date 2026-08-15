export type Category = "image" | "audio" | "pdf" | "unsupported";

const IMAGE_INPUT = [
  "png", "jpg", "jpeg", "webp", "avif", "gif", "bmp",
  "tiff", "tif", "heic", "heif", "svg",
];

// HEIC / HEIF は入力のみ対応。現在のブラウザ内構成ではHEVCエンコードを行わない。
const IMAGE_OUTPUT = ["png", "jpg", "webp", "avif", "gif", "bmp", "tiff"];
const AUDIO = ["mp3", "wav", "flac", "ogg", "aac", "m4a"];

export function getExt(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

export function normalizeExt(ext: string): string {
  if (ext === "jpeg") return "jpg";
  if (ext === "tif") return "tiff";
  return ext;
}

export function getCategory(ext: string): Category {
  const normalized = normalizeExt(ext);
  if (normalized === "pdf") return "pdf";
  if (AUDIO.includes(normalized)) return "audio";
  if (IMAGE_INPUT.includes(ext) || IMAGE_INPUT.includes(normalized)) return "image";
  return "unsupported";
}

export function getTargets(ext: string): string[] {
  const normalized = normalizeExt(ext);
  const cat = getCategory(ext);

  if (cat === "image") {
    if (normalized === "heic" || normalized === "heif") {
      return ["png", "jpg", "webp", "avif"];
    }
    if (normalized === "svg") {
      return ["png", "jpg", "webp", "avif", "pdf"];
    }

    const unique = Array.from(new Set([...IMAGE_OUTPUT, "ico", "pdf"]));
    if (unique.includes(normalized)) {
      return [normalized, ...unique.filter((f) => f !== normalized)];
    }
    return unique;
  }

  if (cat === "audio") {
    const unique = Array.from(new Set(AUDIO));
    if (unique.includes(normalized)) {
      return [normalized, ...unique.filter((f) => f !== normalized)];
    }
    return unique;
  }

  if (cat === "pdf") return ["png", "jpg"];
  return [];
}

export const MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  webp: "image/webp", avif: "image/avif", gif: "image/gif",
  bmp: "image/bmp", tiff: "image/tiff", tif: "image/tiff",
  heic: "image/heic", heif: "image/heif", ico: "image/x-icon",
  pdf: "application/pdf", mp3: "audio/mpeg", wav: "audio/wav",
  flac: "audio/flac", ogg: "audio/ogg", aac: "audio/aac", m4a: "audio/mp4",
};
