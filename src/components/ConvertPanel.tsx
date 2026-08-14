"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DropZone from "@/components/DropZone";
import FormatSelect from "@/components/FormatSelect";
import ArrowProgress from "@/components/ArrowProgress";
import OutputArea from "@/components/OutputArea";
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
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const fauxRef = useRef<number | null>(null);
  const convertingRef = useRef(false);

  const ext = file ? getExt(file.name) : "";
  const normalizedExt = normalizeExt(ext);
  const cat = getCategory(ext);

  const outName = file
    ? `${file.name.replace(/\.[^.]+$/, "")}.${target || "dat"}`
    : `output.${target || "dat"}`;

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

  const handleDownload = useCallback(() => {
    if (!file || !target || convertingRef.current) return;
    if (normalizedExt === target) return;

    convertingRef.current = true;
    setIsConverting(true);
    setProgress(0);
    setError("");

    const useFauxProgress = cat !== "audio";
    if (useFauxProgress) startFauxProgress();

    convertFile(file, target, {}, (p) => {
      if (!useFauxProgress) setProgress(p);
    })
      .then((blob) => {
        stopFauxProgress();
        setProgress(1);

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = outName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      })
      .catch((err) => {
        stopFauxProgress();
        setError(err instanceof Error ? err.message : "変換に失敗しました");
      })
      .finally(() => {
        convertingRef.current = false;
        setIsConverting(false);
      });
  }, [file, target, normalizedExt, cat, outName]);

  function handleFile(f: File) {
    const sourceExt = getExt(f.name);
    const availableTargets = getTargets(sourceExt);
    const normSource = normalizeExt(sourceExt);

    let newTarget = target;
    if (normSource === target || !availableTargets.includes(target)) {
      newTarget = availableTargets.find((t) => t !== normSource) ?? "";
    }

    setFile(f);
    setTargets(availableTargets);
    setTarget(newTarget);
    setError("");
    setProgress(0);
  }

  function handleTargetChange(v: string) {
    setTarget(v);
    setError("");
    setProgress(0);
  }

  useEffect(() => {
    return () => {
      stopFauxProgress();
    };
  }, []);

  return (
    <>
      <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row sm:gap-6">
        {/* 入力 */}
        <DropZone file={file} onFile={handleFile} />

        {/* 中央: 矢印 + プルダウン */}
        <div className="flex w-full max-w-[340px] flex-col items-center gap-1 sm:w-auto sm:max-w-none">
          {/* スマホ: 矢印を中央に、プルダウンはそのすぐ右 */}
          <div className="relative flex w-full justify-center sm:hidden">
            <ArrowProgress
              progress={progress}
              active={isConverting}
            />
            <div className="absolute top-1/2 -translate-y-1/2" style={{ left: 'calc(50% + 26px)' }}>
              <FormatSelect
                targets={targets}
                value={target}
                onChange={handleTargetChange}
                disabled={isConverting}
                disabledTarget={normalizedExt}
              />
            </div>
          </div>

          {/* PC: プルダウン + 横向き矢印 */}
          <div className="hidden sm:flex sm:flex-col sm:items-center sm:gap-1">
            <FormatSelect
              targets={targets}
              value={target}
              onChange={handleTargetChange}
              disabled={isConverting}
              disabledTarget={normalizedExt}
            />
            <ArrowProgress
              progress={progress}
              active={isConverting}
            />
          </div>
        </div>

        {/* 出力 */}
        <div className="hidden sm:block">
          <OutputArea
            file={file}
            outName={outName}
            isConverting={isConverting}
            error={error}
            onDownload={handleDownload}
          />
        </div>
      </div>

      {/* スマホ用の出力欄 */}
      <div className="mt-2 flex w-full justify-center sm:hidden">
        <OutputArea
          file={file}
          outName={outName}
          isConverting={isConverting}
          error={error}
          onDownload={handleDownload}
        />
      </div>
    </>
  );
}
