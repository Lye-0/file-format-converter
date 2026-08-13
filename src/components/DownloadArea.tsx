"use client";

export default function DownloadArea({
  url,
  name,
}: {
  url: string | null;
  name: string;
}) {
  return (
    <div className="flex h-40 w-56 flex-col items-center justify-center rounded-xl border-2 border-gray-200 p-4 text-center">
      {url ? (
        <>
          <span className="text-3xl">✅</span>
          <a
            href={url}
            download={name}
            className="mt-3 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            ダウンロード
          </a>
          <span className="mt-2 line-clamp-2 break-all text-xs text-gray-400">
            {name}
          </span>
        </>
      ) : (
        <span className="text-sm text-gray-400">変換後のファイル</span>
      )}
    </div>
  );
}
