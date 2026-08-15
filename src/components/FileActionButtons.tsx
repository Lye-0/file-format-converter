"use client";

import { useEffect, useState } from "react";
import {
  isFileShareSupported,
  shareFile,
} from "@/lib/utils/share";

type FileActionButtonsProps = {
  /** ダウンロード時のコールバック */
  onDownload: () => void | Promise<void>;
  /**
   * 共有処理を呼び出し側で行う場合のコールバック。
   * 未生成Blobを遅延生成してから共有したい画面で使う。
   */
  onShare?: () => void | Promise<void>;
  /** 共有済み/生成済みBlobを直接使う場合の取得関数 */
  getShareBlob?: () => Blob | null;
  /** 共有時のファイル名（getShareBlobを使う場合に必要） */
  filename?: string;
  /** 無効化（変換中など） */
  disabled?: boolean;
  /** エラーメッセージ表示コールバック */
  onError?: (msg: string) => void;
};

function ShareIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M4 12V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 6L12 2L8 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 2V15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function FileActionButtons({
  onDownload,
  onShare,
  getShareBlob,
  filename,
  disabled = false,
  onError,
}: FileActionButtonsProps) {
  const [shareSupported, setShareSupported] = useState(false);

  useEffect(() => {
    // Blobの生成有無とは分離して、ブラウザのWeb Share API対応だけで表示判定する。
    setShareSupported(isFileShareSupported());
  }, []);

  async function handleShare() {
    try {
      // 変換/PDFのように、共有押下時にBlobを遅延生成する画面はこちらを使う。
      if (onShare) {
        await onShare();
        return;
      }

      // 画像編集のように、すでに生成済みBlobがある画面はこちらを使う。
      const blob = getShareBlob?.();
      if (!blob || !filename) {
        onError?.("共有するファイルがありません");
        return;
      }

      const { ok, cancelled } = await shareFile(blob, filename);
      if (cancelled) return;
      if (!ok) {
        onError?.("このファイルを共有できませんでした");
      }
    } catch {
      onError?.("このファイルを共有できませんでした");
    }
  }

  return (
    <div className="flex w-full gap-2">
      <button
        type="button"
        onClick={onDownload}
        disabled={disabled}
        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:opacity-40 sm:px-5 sm:py-2"
      >
        ダウンロード
      </button>

      {shareSupported && (
        <button
          type="button"
          onClick={handleShare}
          disabled={disabled}
          aria-label="共有"
          title="共有"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-gray-50 hover:text-gray-800 disabled:opacity-40"
        >
          <ShareIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
