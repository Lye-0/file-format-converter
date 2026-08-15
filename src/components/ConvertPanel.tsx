"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DropZone from "@/components/DropZone";
import FormatSelect from "@/components/FormatSelect";
import ArrowProgress from "@/components/ArrowProgress";
import OutputArea from "@/components/OutputArea";
import { convertFile } from "@/lib/convert";
import { triggerDownload } from "@/lib/utils/download";
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
  const [shareError, setShareError] = useState("");

  const fauxRef = useRef<number | null>(null);
  const cachedBlobRef = useRef<Blob | null>(null);
  const cachedKeyRef = useRef<string>("");

  const ext = file ? getExt(file.name) : "";
  const normalizedExt = normalizeExt(ext);
  const cat = getCategory(ext);

  const outName = file
    ? `${file.name.replace(/\.[^.]+$/, "")}.${target || "dat"}`
    : `output.${target || "dat"}`;

  const cacheKey = file ? `${file.name}_${file.size}_${target}` : "";

  function stopFauxProgress() {
    if (fauxRef.current) {
      clearInterval(fauxRef.current);
      fauxRef.current = null;
    }
  }

  function startFauxProgress(outputTarget: string) {
    stopFauxProgress();
    const step = outputTarget === "avif" ? 0.015 : 0.03;

    fauxRef.current = window.setInterval(() => {
      setProgress((p) => {
        if (p < 0.9) return Math.min(0.9, p + step);
        return p;
      });
    }, 100);
  }

  /**
   * 変換を実行し、Blobを返す。
   * 既にキャッシュがあればキャッシュを返す。
   */
  const generateBlob = useCallback(async (): Promise<Blob> => {
    if (!file || !target) throw new Error("変換できません");
    if (normalizedExt === target) throw new Error("同じ形式への変換はできません");

    if (cachedBlobRef.current && cachedKeyRef.current === cacheKey) {
      return cachedBlobRef.current;
    }

    setIsConverting(true);
    setProgress(0);
    setError("");
    setShareError("");

    // 音声はFFmpegの実進捗、それ以外は従来の疑似進捗を使う。
    // AVIFは実際の待ち時間に合わせて疑似進捗をゆっくり進める。
    const useFauxProgress = cat !== "audio";
    if (useFauxProgress) startFauxProgress(target);

    try {
      const blob = await convertFile(
        file,
        target,
        {},
        (p) => {
          if (!useFauxProgress) setProgress(p);
        },
      );

      stopFauxProgress();
      setProgress(1);

      cachedBlobRef.current = blob;
      cachedKeyRef.current = cacheKey;

      return blob;
    } catch (err) {
      stopFauxProgress();
      throw err;
    } finally {
      setIsConverting(false);
    }
  }, [file, target, normalizedExt, cat, cacheKey]);

  const handleDownload = useCallback(async () => {
    try {
      setShareError("");
      const blob = await generateBlob();
      triggerDownload(URL.createObjectURL(blob), outName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "変換に失敗しました");
    }
  }, [generateBlob, outName]);

  const handleShare = useCallback(async () => {
    try {
      setError("");
      const blob = await generateBlob();
      const { shareFile } = await import("@/lib/utils/share");
      const { ok, cancelled } = await shareFile(blob, outName);

      if (cancelled) return;

      if (!ok) {
        setShareError("このファイルを共有できませんでした。もう一度共有ボタンを押してください。");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "共有に失敗しました");
    }
  }, [generateBlob, outName]);

  function handleFile(f: File) {
    const sourceExt = getExt(f.name);
    const availableTargets = getTargets(sourceExt);
    const normSource = normalizeExt(sourceExt);

    let newTarget = target;
    if (normSource === target || !availableTargets.includes(target)) {
      newTarget = availableTargets.find((t) => t !== normSource) ?? "";
    }

    cachedBlobRef.current = null;
    cachedKeyRef.current = "";

    setFile(f);
    setTargets(availableTargets);
    setTarget(newTarget);
    setError("");
    setShareError("");
    setProgress(0);
  }

  function handleTargetChange(v: string) {
    setTarget(v);
    setError("");
    setShareError("");
    setProgress(0);

    cachedBlobRef.current = null;
    cachedKeyRef.current = "";
  }

  const getShareBlob = useCallback(() => cachedBlobRef.current, []);

  useEffect(() => {
    return () => {
      stopFauxProgress();
    };
  }, []);

  return (
    <>
      <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row sm:gap-6">
        <DropZone file={file} onFile={handleFile} />

        <div className="flex w-full max-w-[340px] flex-col items-center gap-1 sm:w-auto sm:max-w-none">
          <div className="relative flex w-full justify-center sm:hidden">
            <ArrowProgress progress={progress} active={isConverting} />
            <div
              className="absolute top-1/2 -translate-y-1/2"
              style={{ left: "calc(50% + 26px)" }}
            >
              <FormatSelect
                targets={targets}
                value={target}
                onChange={handleTargetChange}
                disabled={isConverting}
                disabledTarget={normalizedExt}
              />
            </div>
          </div>

          <div className="hidden sm:flex sm:flex-col sm:items-center sm:gap-1">
            <FormatSelect
              targets={targets}
              value={target}
              onChange={handleTargetChange}
              disabled={isConverting}
              disabledTarget={normalizedExt}
            />
            <ArrowProgress progress={progress} active={isConverting} />
          </div>
        </div>

        <div className="hidden sm:block">
          <OutputArea
            file={file}
            outName={outName}
            isConverting={isConverting}
            error={error}
            shareError={shareError}
            onDownload={handleDownload}
            onShare={handleShare}
            getShareBlob={getShareBlob}
          />
        </div>
      </div>

      <div className="mt-2 flex w-full justify-center sm:hidden">
        <OutputArea
          file={file}
          outName={outName}
          isConverting={isConverting}
          error={error}
          shareError={shareError}
          onDownload={handleDownload}
          onShare={handleShare}
          getShareBlob={getShareBlob}
        />
      </div>
    </>
  );
}
