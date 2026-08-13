"use client";
import { useEffect, useRef, useState } from "react";
import DropZone from "@/components/DropZone";
import FormatSelect from "@/components/FormatSelect";
import ArrowProgress from "@/components/ArrowProgress";
import DownloadArea from "@/components/DownloadArea";
import { convertFile } from "@/lib/convert";
import { getCategory, getExt, getTargets } from "@/lib/formats";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [targets, setTargets] = useState<string[]>([]);
  const [target, setTarget] = useState("");
  const [status, setStatus] = useState<"idle" | "converting" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [scalePct, setScalePct] = useState(100);
  const [rotate, setRotate] = useState(0);
  const fauxRef = useRef<number | null>(null);

  const ext = file ? getExt(file.name) : "";
  const cat = getCategory(ext);

  function handleFile(f: File) {
    const e = getExt(f.name);
    const t = getTargets(e);
    setResultUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setFile(f);
    setTargets(t);
    setTarget(t[0] ?? "");
    setStatus("idle");
    setProgress(0);
    setScalePct(100);
    setRotate(0);
    setError(getCategory(e) === "unsupported" ? "未対応の形式です" : "");
  }

  function stopFaux() {
    if (fauxRef.current) {
      clearInterval(fauxRef.current);
      fauxRef.current = null;
    }
  }
  function startFaux() {
    stopFaux();
    fauxRef.current = window.setInterval(() => {
      setProgress((p) => (p < 0.9 ? p + 0.03 : p));
    }, 100);
  }

  async function handleConvert() {
    if (!file || !target) return;
    setStatus("converting");
    setProgress(0);
    setError("");
    const useFaux = cat !== "audio"; // 音声のみ実進捗、それ以外は擬似進捗
    if (useFaux) startFaux();
    try {
      const blob = await convertFile(
        file,
        target,
        { scalePct, rotate },
        (p) => {
          if (!useFaux) setProgress(p);
        },
      );
      stopFaux();
      setProgress(1);
      setResultUrl(URL.createObjectURL(blob));
      setStatus("done");
    } catch (err) {
      stopFaux();
      setStatus("error");
      setError(err instanceof Error ? err.message : "変換に失敗しました");
    }
  }

  useEffect(
    () => () => {
      stopFaux();
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const outName = file
    ? file.name.replace(/\.[^.]+$/, "") + "." + target
    : "output";

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 p-6">
      <h1 className="text-2xl font-bold">ファイル形式変換</h1>

      <div className="flex flex-col items-center gap-6 sm:flex-row">
        <DropZone file={file} onFile={handleFile} />

        <div className="flex flex-col items-center gap-2">
          <FormatSelect
            targets={targets}
            value={target}
            onChange={setTarget}
            disabled={status === "converting"}
          />
          <ArrowProgress progress={progress} active={status === "converting"} />
        </div>

        <DownloadArea url={resultUrl} name={outName} />
      </div>

      {cat === "image" && (
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-600">
          <label className="flex items-center gap-2">
            解像度
            <input
              type="range"
              min={10}
              max={100}
              value={scalePct}
              onChange={(e) => setScalePct(Number(e.target.value))}
            />
            <span className="w-10 tabular-nums">{scalePct}%</span>
          </label>
          <label className="flex items-center gap-2">
            回転
            <select
              value={rotate}
              onChange={(e) => setRotate(Number(e.target.value))}
              className="rounded border border-gray-300 px-2 py-1"
            >
              <option value={0}>0°</option>
              <option value={90}>90°</option>
              <option value={180}>180°</option>
              <option value={270}>270°</option>
            </select>
          </label>
        </div>
      )}

      <button
        onClick={handleConvert}
        disabled={!file || !target || status === "converting"}
        className="rounded-xl bg-green-600 px-8 py-3 font-medium text-white shadow hover:bg-green-700 disabled:opacity-40"
      >
        {status === "converting" ? "変換中…" : "変換する"}
      </button>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </main>
  );
}
