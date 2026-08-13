"use client";
import { useRef, useState } from "react";

export default function DropZone({
  file,
  onFile,
}: {
  file: File | null;
  onFile: (f: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

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
      className={`flex h-40 w-56 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition ${
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
          <span className="text-3xl">📄</span>
          <span className="mt-2 line-clamp-2 break-all text-sm font-medium">
            {file.name}
          </span>
          <span className="text-xs text-gray-400">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </span>
        </>
      ) : (
        <>
          <span className="text-3xl">⬆️</span>
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
