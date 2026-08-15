/**
 * Web Share API のファイル共有ユーティリティ
 */

/**
 * 指定したBlobをファイルとして共有できるか確認する
 */
export function canShareFile(blob: Blob, filename: string): boolean {
  if (typeof navigator === "undefined") return false;
  if (!navigator.share || !navigator.canShare) return false;

  try {
    const file = new File([blob], filename, { type: blob.type });
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/**
 * BlobをFileに変換してOS標準共有シートを開く
 * @returns ok: 共有成功 or キャンセル, cancelled: ユーザーがキャンセルした場合
 */
export async function shareFile(
  blob: Blob,
  filename: string,
): Promise<{ ok: boolean; cancelled: boolean }> {
  const file = new File([blob], filename, { type: blob.type });

  try {
    await navigator.share({ files: [file] });
    return { ok: true, cancelled: false };
  } catch (err: any) {
    // ユーザーキャンセルは正常的な操作
    if (err?.name === "AbortError") {
      return { ok: false, cancelled: true };
    }
    console.error("Share failed:", err);
    return { ok: false, cancelled: false };
  }
}
