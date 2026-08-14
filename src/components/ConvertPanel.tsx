"use client";

import { useEffect, useRef, useState } from "react";
import DropZone from "@/components/DropZone";
import FormatSelect from "@/components/FormatSelect";
import ArrowProgress from "@/components/ArrowProgress";
import DownloadArea from "@/components/DownloadArea";
import { convertFile } from "@/lib/convert";
import {
  getCategory,
  getExt,
  getTargets,
  normalizeExt,
} from "@/lib/formats";

export default function ConvertPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [targets, setTargets] = useState<string[]>([]);
  const [target, setTarget] = useState("");
  const [status, setStatus] = useState<
    "idle" | "converting" | "done" | "error"
  >("idle");
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fauxRef = useRef<number | null>(null);

  const ext = file ? getExt(file.name) : "";
  const normalizedExt = normalizeExt(ext);
  const cat = getCategory(ext);

  function handleFile(f: File) {
    const sourceExt = getExt(f.name);
    const availableTargets = getTargets(sourceExt);

    setResultUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    setFile(f);
    setTargets(availableTargets);
    setTarget(availableTargets[0] ?? "");
    setStatus("idle");
    setProgress(0);

    setError(
      getCategory(sourceExt) === "unsupported" ? "未対応の形式です" : "",
    );
  }

  function stopFauxProgress() {
    if (fauxRef.current) {
      clearInterval(fauxRef.current);
      fauxRef.current = null;
    }
  }

  function startFauxProgress() {
    stopFauxProgress();

    fauxRef.current = window.setInterval(() => {
      setProgress((p) => {
        if (p < 0.9) return p + 0.03;
        return p;
      });
    }, 100);
  }

  async function handleConvert() {
    if (!file || !target) return;

    setStatus("converting");
    setProgress(0);
    setError("");

    const useFauxProgress = cat !== "audio";

    if (useFauxProgress) {
      startFauxProgress();
    }

    try {
      const blob = await convertFile(
        file,
        target,
        {},
        (p) => {
          if (!useFauxProgress) {
            setProgress(p);
          }
        },
      );

      stopFauxProgress();

      setProgress(1);
      setResultUrl(URL.createObjectURL(blob));
      setStatus("done");
    } catch (err) {
      stopFauxProgress();

      setStatus("error");
      setError(err instanceof Error ? err.message : "変換に失敗しました");
    }
  }

  useEffect(() => {
    return () => {
      stopFauxProgress();

      if (resultUrl) {
        URL.revokeObjectURL(resultUrl);
      }
    };
    // resultUrlを依存配列に入れるとURL生成のたびにcleanupが走るため、
    // このcleanupはアンマウント時用として扱う。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const outName = file
    ? `${file.name.replace(/\.[^.]+$/, "")}${
        normalizedExt === target ? "_converted" : ""
      }.${target}`
    : `output.${target || "dat"}`;

  const progressLabel =
    status === "done"
      ? "完了"
      : status === "converting"
        ? `変換中 ${Math.round(progress * 100)}%`
        : "";

  const convertButton = (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={handleConvert}
        disabled={!file || !target || status === "converting"}
        className="rounded-xl bg-green-600 px-7 py-2.5 font-medium text-white shadow hover:bg-green-700 disabled:opacity-40 sm:px-8 sm:py-3"
      >
        {status === "converting" ? "変換中…" : "変換する"}
      </button>

      <span className="h-4 text-xs text-gray-500">{progressLabel}</span>
    </div>
  );

  return (
    <>
      <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row sm:gap-6">
        <DropZone file={file} onFile={handleFile} />

        <div className="flex w-full max-w-[340px] flex-col items-center gap-1 sm:w-auto sm:max-w-none">
          {/* スマホ用: 矢印をオプションブロックの上に表示 */}
          <div className="sm:hidden">
            <ArrowProgress
              progress={progress}
              active={status === "converting"}
            />
          </div>

          {/* 変換先セレクト */}
          <div className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-3 sm:w-auto sm:border-0 sm:bg-transparent sm:p-0">
            <div className="flex items-center justify-between gap-3 sm:flex sm:justify-center">
              <span className="shrink-0 text-sm font-medium text-gray-600 sm:hidden">
                変換先
              </span>

              <FormatSelect
                targets={targets}
                value={target}
                onChange={setTarget}
                disabled={status === "converting"}
              />
            </div>

            {/* PC用: プルダウンの下に横向き矢印 */}
            <div className="hidden sm:block">
              <ArrowProgress
                progress={progress}
                active={status === "converting"}
              />
            </div>
          </div>
        </div>

        {/* PC用の出力欄 */}
        <div className="hidden sm:block">
          <DownloadArea url={resultUrl} name={outName} />
        </div>
      </div>

      {/* スマホ: 変換ボタンを出力欄の上に配置 */}
      <div className="flex sm:hidden">{convertButton}</div>

      {/* スマホ用の出力欄 */}
      <div className="flex w-full justify-center sm:hidden">
        <DownloadArea url={resultUrl} name={outName} />
      </div>

      {/* PC: 変換ボタンは従来通り下部 */}
      <div className="hidden sm:flex">{convertButton}</div>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </>
  );
}
