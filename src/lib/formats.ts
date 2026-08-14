export type Category = "image" | "audio" | "pdf" | "unsupported";

// 入力として受け付ける画像拡張子
const IMAGE_INPUT = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "avif",
  "gif",
  "bmp",
  "tiff",
  "tif",
  "heic",
  "heif",
  "svg",
];

// 画像の出力形式
// 画像サイズ変更・回転だけの用途にも使えるように、
// 入力と同じ拡張子も選択肢に含める。
const IMAGE_OUTPUT = [
  "png",
  "jpg",
  "webp",
  "avif",
  "gif",
  "bmp",
  "tiff",
  "heic",
  "heif",
];

// 音声
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

// 入力拡張子 → 選択できる出力形式
export function getTargets(ext: string): string[] {
  const normalized = normalizeExt(ext);
  const cat = getCategory(ext);

  if (cat === "image") {
    /**
     * 重要:
     * 以前は IMAGE_OUTPUT.filter((f) => f !== normalized) としていたが、
     * 画像サイズ変更・回転のみでも使えるように、同じ形式も残す。
     *
     * 例:
     * jpg → jpg
     * png → png
     * webp → webp
     */
    const outputs = [...IMAGE_OUTPUT];

    // SVGはベクター形式なので「SVGのまま画像サイズ変更」は基本的に意味が違う。
    // そのため SVG入力時は SVG出力を出さず、PNG/JPG/WebP等への変換にする。
    // 必要になれば後で resvg-wasm などでSVG処理を強化する。
    if (normalized === "svg") {
      return ["png", "jpg", "webp", "avif", "pdf"];
    }

    // よく使う特殊出力
    outputs.push("ico", "pdf");

    // 入力形式を先頭に出すと「画像サイズだけ変更」が分かりやすい
    const unique = Array.from(new Set(outputs));

    if (unique.includes(normalized)) {
      return [
        normalized,
        ...unique.filter((f) => f !== normalized),
      ];
    }

    return unique;
  }

  if (cat === "audio") {
    // 音声は「同形式を選んで再エンコード」用途もあり得るため、
    // こちらも同じ形式を残す。
    const unique = Array.from(new Set(AUDIO));

    if (unique.includes(normalized)) {
      return [
        normalized,
        ...unique.filter((f) => f !== normalized),
      ];
    }

    return unique;
  }

  if (cat === "pdf") {
    return ["png", "jpg"];
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
  tif: "image/tiff",
  heic: "image/heic",
  heif: "image/heif",
  ico: "image/x-icon",
  pdf: "application/pdf",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
  ogg: "audio/ogg",
  aac: "audio/aac",
  m4a: "audio/mp4",
};