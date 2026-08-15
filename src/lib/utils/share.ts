/**
 * Web Share API のファイル共有ユーティリティ
 */

/**
 * このブラウザが Web Share API のファイル共有機能を持っているか確認する。
 * Blob がまだ生成されていない段階でも共有ボタンの表示判定に使える。
 */
export function isFileShareSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  return typeof navigator.share === "function" && typeof navigator.canShare === "function";
}

/**
 * 指定したBlobをファイルとして共有できるか確認する
 */
export function canShareFile(blob: Blob, filename: string): boolean {
  if (!isFileShareSupported()) return false;

  try {
    const file = new File([blob], filename, { type: blob.type });
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/**
 * BlobをFileに変換してOS標準共有シートを開く
 * @returns ok: 共有成功, cancelled: ユーザーがキャンセルした場合
 */
export async function shareFile(
  blob: Blob,
  filename: string,
): Promise<{ ok: boolean; cancelled: boolean }> {
  if (!canShareFile(blob, filename)) {
    return { ok: false, cancelled: false };
  }

  const file = new File([blob], filename, { type: blob.type });

  try {
    await navigator.share({ files: [file] });
    return { ok: true, cancelled: false };
  } catch (err: any) {
    // ユーザーキャンセルは正常な操作
    if (err?.name === "AbortError") {
      return { ok: false, cancelled: true };
    }
    console.error("Share failed:", err);
    return { ok: false, cancelled: false };
  }
}
