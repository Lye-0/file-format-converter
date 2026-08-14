"use client";

export async function flipImage(
  buffer: ArrayBuffer,
  flipX: boolean,
  flipY: boolean,
): Promise<ArrayBuffer> {
  if (!flipX && !flipY) return buffer;

  const blob = new Blob([buffer]);
  const img = new Image();
  const url = URL.createObjectURL(blob);

  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas の初期化に失敗しました。");

    ctx.save();
    ctx.translate(flipX ? img.width : 0, flipY ? img.height : 0);
    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    ctx.drawImage(img, 0, 0);
    ctx.restore();

    const outBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Canvas の出力に失敗しました。"))),
        "image/png",
      );
    });

    const result = await outBlob.arrayBuffer();
    console.log("[flipImage] flipped", { flipX, flipY, size: result.byteLength });
    return result;
  } catch (err) {
    console.error("[flipImage] failed:", err);
    throw err;
  } finally {
    URL.revokeObjectURL(url);
  }
}
