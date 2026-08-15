export type DecodedBmp = {
  data: Uint8Array;
  width: number;
  height: number;
};

export function decodeBmp(buffer: ArrayBuffer): DecodedBmp {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  if (bytes.length < 54 || bytes[0] !== 0x42 || bytes[1] !== 0x4d) {
    throw new Error("BMPファイルとして認識できません。");
  }

  const pixelOffset = view.getUint32(10, true);
  const dibSize = view.getUint32(14, true);
  if (dibSize < 40 || bytes.length < 14 + dibSize) {
    throw new Error("このBMPヘッダー形式には対応していません。");
  }

  const width = view.getInt32(18, true);
  const signedHeight = view.getInt32(22, true);
  const planes = view.getUint16(26, true);
  const bitsPerPixel = view.getUint16(28, true);
  const compression = view.getUint32(30, true);

  if (width <= 0 || signedHeight === 0 || planes !== 1) {
    throw new Error("BMPの画像サイズまたはヘッダーが不正です。");
  }
  if (bitsPerPixel !== 24 && bitsPerPixel !== 32) {
    throw new Error("BMP入力は24bit / 32bit形式に対応しています。");
  }
  if (compression !== 0 && !(compression === 3 && bitsPerPixel === 32)) {
    throw new Error("圧縮BMPには対応していません。");
  }

  const height = Math.abs(signedHeight);
  const topDown = signedHeight < 0;
  const srcBytesPerPixel = bitsPerPixel / 8;
  const rowStride = (width * srcBytesPerPixel + 3) & ~3;
  const required = pixelOffset + rowStride * height;
  if (required > bytes.length) {
    throw new Error("BMPの画素データが不足しています。");
  }

  const rgba = new Uint8Array(width * height * 4);
  let hasNonZeroAlpha = false;

  for (let y = 0; y < height; y += 1) {
    const srcY = topDown ? y : height - 1 - y;
    const srcRow = pixelOffset + srcY * rowStride;
    const dstRow = y * width * 4;

    for (let x = 0; x < width; x += 1) {
      const src = srcRow + x * srcBytesPerPixel;
      const dst = dstRow + x * 4;
      rgba[dst] = bytes[src + 2];
      rgba[dst + 1] = bytes[src + 1];
      rgba[dst + 2] = bytes[src];
      const alpha = bitsPerPixel === 32 ? bytes[src + 3] : 255;
      rgba[dst + 3] = alpha;
      if (bitsPerPixel === 32 && alpha !== 0) hasNonZeroAlpha = true;
    }
  }

  if (bitsPerPixel === 32 && compression === 0 && !hasNonZeroAlpha) {
    for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
  }

  return { data: rgba, width, height };
}

export function encodeBmp(
  pixels: Uint8Array,
  width: number,
  height: number,
  channels: 3 | 4,
): Uint8Array {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error("BMPの画像サイズが不正です。");
  }

  const expectedLength = width * height * channels;
  if (pixels.length < expectedLength) {
    throw new Error("BMP変換に必要な画素データが不足しています。");
  }

  const hasAlpha = channels === 4;
  const bytesPerPixel = hasAlpha ? 4 : 3;
  const rowStride = hasAlpha ? width * 4 : (width * 3 + 3) & ~3;
  const dibSize = hasAlpha ? 108 : 40;
  const pixelOffset = 14 + dibSize;
  const imageSize = rowStride * height;
  const fileSize = pixelOffset + imageSize;

  const out = new Uint8Array(fileSize);
  const view = new DataView(out.buffer);

  out[0] = 0x42;
  out[1] = 0x4d;
  view.setUint32(2, fileSize, true);
  view.setUint32(10, pixelOffset, true);

  view.setUint32(14, dibSize, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, hasAlpha ? 32 : 24, true);
  view.setUint32(30, hasAlpha ? 3 : 0, true);
  view.setUint32(34, imageSize, true);
  view.setInt32(38, 2835, true);
  view.setInt32(42, 2835, true);

  if (hasAlpha) {
    view.setUint32(54, 0x00ff0000, true);
    view.setUint32(58, 0x0000ff00, true);
    view.setUint32(62, 0x000000ff, true);
    view.setUint32(66, 0xff000000, true);
    view.setUint32(70, 0x73524742, true);
  }

  for (let y = 0; y < height; y += 1) {
    const srcRow = (height - 1 - y) * width * channels;
    const dstRow = pixelOffset + y * rowStride;

    for (let x = 0; x < width; x += 1) {
      const src = srcRow + x * channels;
      const dst = dstRow + x * bytesPerPixel;
      out[dst] = pixels[src + 2];
      out[dst + 1] = pixels[src + 1];
      out[dst + 2] = pixels[src];
      if (hasAlpha) out[dst + 3] = pixels[src + 3];
    }
  }

  return out;
}
