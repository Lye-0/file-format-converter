"use client";

import { useRef, useState } from "react";
import FileInputIcon from "@/components/FileInputIcon";
import { formatBytes } from "@/lib/utils/formatBytes";

export default function CompactDropZone({
  file,
  onFile,
  accept,
}: {
  file: File | null;
  onFile: (f: File) => void;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

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
