"use client";

import { useRef, useState } from "react";
import FileInputIcon from "@/components/FileInputIcon";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function DropZone({
  file,
  onFile,
  accept,
  compact,
}: {
  file: File | null;
  onFile: (f: File) => void;
  accept?: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  if (compact) {
    return (
      <div
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
          drag
            ? "border-green-400 bg-green-50"
            : "border-gray-200 bg-white hover:border-gray-300"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
        <FileInputIcon className="h-6 w-6 shrink-0" />
        {file ? (
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-gray-700">
              {file.name}
            </div>
            <div className="text-xs text-gray-400">{formatBytes(file.size)}</div>
          </div>
        ) : (
          <span className="text-sm text-gray-400">クリックまたはドロップして画像を選択</span>
        )}
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      onClick={() => inputRef.current?.click()}
      className={`flex h-32 w-full max-w-[320px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition sm:h-40 sm:w-56 sm:max-w-none ${
        drag ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-gray-400"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />

      {file ? (
        <>
          <FileInputIcon className="h-8 w-8 sm:h-10 sm:w-10" />
          <span className="mt-2 line-clamp-2 break-all text-sm font-medium">
            {file.name}
          </span>
          <span className="text-xs text-gray-400">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </span>
        </>
      ) : (
        <>
          <FileInputIcon className="h-8 w-8 sm:h-10 sm:w-10" />
          <span className="mt-2 text-sm text-gray-500">
            ファイルをドロップ
            <br />
            またはクリックして選択
          </span>
        </>
      )}
    </div>
  );
}