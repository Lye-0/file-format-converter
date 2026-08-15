"use client";

import { useEffect, useRef, useState } from "react";
import {
  canShareFile,
  isFileShareSupported,
  shareFile,
} from "@/lib/utils/share";

type FileActionButtonsProps = {
  onDownload: () => void | Promise<void>;
  onShare?: () => void | Promise<void>;
  getShareBlob?: () => Blob | null;
  filename?: string;
  disabled?: boolean;
  onError?: (msg: string) => void;
  progress?: number;
  showProgress?: boolean;
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
  progress = 0,
  showProgress = false,
}: FileActionButtonsProps) {
  const [shareSupported, setShareSupported] = useState(false);
  const [fauxProgress, setFauxProgress] = useState(0);
  const fauxRef = useRef<number | null>(null);
  const complete = progress >= 1;
  const isAvif = filename?.toLowerCase().endsWith(".avif") ?? false;
  const progressPct = Math.max(0, Math.min(100, fauxProgress * 100));

  useEffect(() => {
    const blob = getShareBlob?.();
    if (blob && filename) {
      setShareSupported(canShareFile(blob, filename));
      return;
    }
    setShareSupported(isFileShareSupported());
  }, [getShareBlob, filename]);

  useEffect(() => {
    if (fauxRef.current !== null) {
      clearInterval(fauxRef.current);
      fauxRef.current = null;
    }

    if (!showProgress) {
      setFauxProgress(0);
      return;
    }

    if (complete) {
      setFauxProgress(1);
      return;
    }

    setFauxProgress(0);
    const step = isAvif ? 0.015 : 0.03;

    fauxRef.current = window.setInterval(() => {
      setFauxProgress((p) => {
        if (p < 0.9) return Math.min(0.9, p + step);
        return p;
      });
    }, 100);

    return () => {
      if (fauxRef.current !== null) {
        clearInterval(fauxRef.current);
        fauxRef.current = null;
      }
    };
  }, [showProgress, complete, isAvif]);

  async function handleShare() {
    try {
      if (onShare) {
        await onShare();
        return;
      }

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
        className={`relative flex flex-1 items-center justify-center overflow-hidden rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed sm:px-5 sm:py-2 ${
          showProgress ? "" : "disabled:opacity-40"
        }`}
      >
        {showProgress && (
          <span
            className="absolute inset-y-0 left-0 bg-green-900/45 transition-[width] duration-100 ease-linear"
            style={{ width: `${progressPct}%` }}
            aria-hidden="true"
          />
        )}
        <span className="relative z-10">ダウンロード</span>
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
