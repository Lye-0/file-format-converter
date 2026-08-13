"use client";

export default function DownloadArea({
  url,
  name,
}: {
  url: string | null;
  name: string;
}) {
  return (
    <div className="flex h-36 w-full max-w-[340px] flex-col items-center justify-center rounded-xl border-2 border-gray-200 p-4 text-center sm:h-40 sm:w-56 sm:max-w-none">
      {url ? (
        <>
          <span className="text-2xl sm:text-3xl">✅</span>

          <a
            href={url}
            download={name}
            className="mt-3 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            ダウンロード
          </a>

          <span className="mt-2 max-w-full truncate text-xs text-gray-400">
            {name}
          </span>
        </>
      ) : (
        <span className="text-sm text-gray-400">変換後のファイル</span>
      )}
    </div>
  );
}