"use client";

import FileInputIcon from "@/components/FileInputIcon";

type OutputAreaProps = {
  file: File | null;
  outName: string;
  isConverting: boolean;
  error: string;
  onDownload: () => void;
};

export default function OutputArea({
  file,
  outName,
  isConverting,
  error,
  onDownload,
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
      <button
        type="button"
        onClick={onDownload}
        disabled={isConverting}
        className="mt-auto w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
      >
        {isConverting ? "変換中…" : "ダウンロード"}
      </button>
    </div>
  );
}
