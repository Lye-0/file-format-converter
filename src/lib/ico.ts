// PNG バイト列を ICO コンテナで包む（Vista 以降の ICO は PNG 埋め込みが可能）。
// 外部ライブラリ不要。256px 以下推奨。
export function pngToIco(png: Uint8Array, width: number, height: number): Uint8Array {
  const w = width >= 256 ? 0 : width; // ICO は 256 を 0 で表す
  const h = height >= 256 ? 0 : height;
  const HEADER = 6;
  const DIR_ENTRY = 16;
  const offset = HEADER + DIR_ENTRY;
  const total = offset + png.length;

  const buf = new ArrayBuffer(total);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  // ICONDIR
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type: 1 = icon
  view.setUint16(4, 1, true); // image count

  // ICONDIRENTRY
  view.setUint8(6, w);
  view.setUint8(7, h);
  view.setUint8(8, 0); // color palette
  view.setUint8(9, 0); // reserved
  view.setUint16(10, 1, true); // color planes
  view.setUint16(12, 32, true); // bits per pixel
  view.setUint32(14, png.length, true); // size of image data
  view.setUint32(18, offset, true); // offset of image data

  bytes.set(png, offset);
  return bytes;
}
