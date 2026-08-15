"use client";

import FileInputIcon from "@/components/FileInputIcon";
import FileActionButtons from "@/components/FileActionButtons";

type OutputAreaProps = {
  file: File | null;
  outName: string;
  isConverting: boolean;
  error: string;
  shareError: string;
  onDownload: () => void;
  onShare: () => void | Promise<void>;
  getShareBlob: () => Blob | null;
};

export default function OutputArea({
  file,
  outName,
  isConverting,
  error,
  shareError,
  onDownload,
  onShare,
  getShareBlob,
}: OutputAreaProps) {
  if (!file) {
    return (
      <div className="flex min-h-[9rem] w-full max-w-[320px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-4 py-5 text-center sm:min-h-[10rem] sm:w-56 sm:max-w-none sm:gap-3">
        <span className="text-sm text-gray-400">変換後のファイル</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[9rem] w-full max-w-[320px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-4 py-5 text-center sm:min-h-[10rem] sm:w-56 sm:max-w-none sm:gap-3">
        <span className="text-2xl text-red-400"></span>
        <span className="text-sm text-red-500">{error}</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-[9rem] w-full max-w-[320px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-4 py-5 text-center sm:min-h-[10rem] sm:w-56 sm:max-w-none sm:gap-3">
      <FileInputIcon className="h-8 w-8 shrink-0 sm:h-10 sm:w-10" color="blue" />
      <p className="w-full truncate text-xs font-medium text-gray-700" title={outName}>
        {outName}
      </p>
      <FileActionButtons
        onDownload={onDownload}
        onShare={onShare}
        getShareBlob={getShareBlob}
        filename={outName}
        disabled={isConverting}
      />
      {shareError && (
        <p className="mt-1 text-xs text-amber-600">{shareError}</p>
      )}
    </div>
  );
}
