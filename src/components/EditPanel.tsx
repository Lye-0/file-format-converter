"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Slider from "@/components/Slider";
import FileInputIcon from "@/components/FileInputIcon";
import FileActionButtons from "@/components/FileActionButtons";
import { convertFile } from "@/lib/convert";
import { getCategory, getExt, normalizeExt } from "@/lib/formats";
import { formatBytes } from "@/lib/utils/formatBytes";
import { triggerDownload } from "@/lib/utils/download";
import { useLatest } from "@/lib/hooks/useLatest";

type ResizeMode = "percent" | "pixels";
type PreviewMode = "native" | "converted";

const IMAGE_EDIT_OUTPUTS = ["png", "jpg", "webp", "avif", "gif", "bmp", "tiff"];
const DEBOUNCE_MS = 300;

function getImageEditTargets(ext: string) {
  const normalized = normalizeExt(ext);
  const outputs = [...IMAGE_EDIT_OUTPUTS];
  if (outputs.includes(normalized)) {
    return [normalized, ...outputs.filter((f) => f !== normalized)];
  }
  return outputs;
}

function calcOutputDimensions(
  srcW: number | null,
  srcH: number | null,
  rotate: number,
  resizeMode: ResizeMode,
  scalePct: number,
  pxW: string,
  pxH: string,
  keepAspect: boolean,
) {
  if (!srcW || !srcH) return { w: 0, h: 0 };

  let w: number;
  let h: number;

  if (resizeMode === "percent") {
    w = Math.round(srcW * (scalePct / 100));
    h = Math.round(srcH * (scalePct / 100));
  } else {
    const numW = parseInt(pxW, 10);
    const numH = parseInt(pxH, 10);
    if (keepAspect && srcW && srcH) {
      const ratio = srcH / srcW;
      if (numW && !numH) {
        w = numW;
        h = Math.round(numW * ratio);
      } else if (numH && !numW) {
        w = Math.round(numH / ratio);
        h = numH;
      } else if (numW && numH) {
        w = numW;
        h = numH;
      } else {
        w = srcW;
        h = srcH;
      }
    } else {
      w = numW || srcW;
      h = numH || srcH;
    }
  }

  if (rotate === 90 || rotate === 270) {
    return { w: h, h: w };
  }
  return { w, h };
}

function getOutFileName(file: File | null, target: string) {
  if (!file) return `edited.${target}`;
  const base = file.name.replace(/\.[^.]+$/, "");
  return `${base}_edited.${target}`;
}

const ACTIVE_BTN = "bg-green-50 text-green-700 border border-green-200";
const INACTIVE_BTN = "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100";

export default function EditPanel() {
  const [file, setFile] = useState<File | null>(null);

  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null);
  const [sourcePreviewMode, setSourcePreviewMode] =
    useState<PreviewMode>("native");
  const [sourcePreviewLoading, setSourcePreviewLoading] = useState(false);

  const [editedUrl, setEditedUrl] = useState<string | null>(null);
  const [editedSize, setEditedSize] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [target, setTarget] = useState("png");
  const [resizeMode, setResizeMode] = useState<ResizeMode>("percent");
  const [scalePct, setScalePct] = useState(100);

  const [sourceWidth, setSourceWidth] = useState<number | null>(null);
  const [sourceHeight, setSourceHeight] = useState<number | null>(null);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [keepAspect, setKeepAspect] = useState(true);

  const [rotate, setRotate] = useState(0);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [quality, setQuality] = useState(100);

  const [error, setError] = useState("");

  const sourceUrlRef = useRef<string | null>(null);
  const editedUrlRef = useRef<string | null>(null);
  const editedBlobRef = useRef<Blob | null>(null);
  const downloadUrlRef = useRef<string | null>(null);

  const fileRef = useRef<File | null>(null);
  const targetRef = useLatest(target);
  const resizeModeRef = useLatest(resizeMode);
  const scalePctRef = useLatest(scalePct);
  const widthRef = useLatest(width);
  const heightRef = useLatest(height);
  const keepAspectRef = useLatest(keepAspect);
  const rotateRef = useLatest(rotate);
  const flipXRef = useLatest(flipX);
  const flipYRef = useLatest(flipY);
  const qualityRef = useLatest(quality);

  const debounceTimerRef = useRef<number | null>(null);
  const conversionVersionRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sourceDrag, setSourceDrag] = useState(false);
  const [sourceHover, setSourceHover] = useState(false);

  useEffect(() => {
    if (!fileRef.current) return;
    scheduleConversion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, resizeMode, scalePct, width, height, keepAspect, rotate, flipX, flipY, quality]);

  const ext = file ? getExt(file.name) : "";
  const normalizedExt = normalizeExt(ext);

  const targets = useMemo(() => {
    if (!file) return IMAGE_EDIT_OUTPUTS;
    return getImageEditTargets(ext);
  }, [file, ext]);

  const showQuality = ["jpg", "webp", "avif"].includes(target);

  const outName = getOutFileName(file, target);

  const outDim = useMemo(
    () =>
      calcOutputDimensions(
        sourceWidth,
        sourceHeight,
        rotate,
        resizeMode,
        scalePct,
        width,
        height,
        keepAspect,
      ),
    [sourceWidth, sourceHeight, rotate, resizeMode, scalePct, width, height, keepAspect],
  );

  const baseRatio = useMemo(() => {
    if (!sourceWidth || !sourceHeight) return null;
    const rotated = rotate === 90 || rotate === 270;
    const w = rotated ? sourceHeight : sourceWidth;
    const h = rotated ? sourceWidth : sourceHeight;
    if (!w || !h) return null;
    return h / w;
  }, [sourceWidth, sourceHeight, rotate]);

  function revokeRef(ref: React.MutableRefObject<string | null>) {
    if (ref.current) {
      URL.revokeObjectURL(ref.current);
      ref.current = null;
    }
  }

  function setSourceUrl(url: string) {
    revokeRef(sourceUrlRef);
    sourceUrlRef.current = url;
    setSourcePreviewUrl(url);
  }

  function setEditedUrlValue(url: string) {
    revokeRef(editedUrlRef);
    editedUrlRef.current = url;
    setEditedUrl(url);
  }

  function setDownloadUrlValue(url: string) {
    revokeRef(downloadUrlRef);
    downloadUrlRef.current = url;
  }

  function clearPreviews() {
    setEditedUrlValue("");
    setEditedSize(null);
    setDownloadUrlValue("");
    setError("");
    setPreviewLoading(false);
    editedBlobRef.current = null;
  }

  function resetImageSettings() {
    setResizeMode("percent");
    setScalePct(100);
    setSourceWidth(null);
    setSourceHeight(null);
    setWidth("");
    setHeight("");
    setKeepAspect(true);
    setRotate(0);
    setFlipX(false);
    setFlipY(false);
    setQuality(100);
  }

  async function runConversion() {
    const f = fileRef.current;
    if (!f) return;

    const version = ++conversionVersionRef.current;
    const currentTarget = targetRef.current;
    const options = {
      scalePct: resizeModeRef.current === "percent" ? scalePctRef.current : undefined,
      width:
        resizeModeRef.current === "pixels" && widthRef.current
          ? Number(widthRef.current)
          : undefined,
      height:
        resizeModeRef.current === "pixels" && heightRef.current
          ? Number(heightRef.current)
          : undefined,
      keepAspect: keepAspectRef.current,
      rotate: rotateRef.current,
      flipX: flipXRef.current,
      flipY: flipYRef.current,
      quality: qualityRef.current,
    };

    setPreviewLoading(true);

    try {
      const blob = await convertFile(f, currentTarget, options, () => {});
      if (version !== conversionVersionRef.current) return;
      if (blob.size === 0) {
        setError("変換結果が空です。別の形式を試してください。");
        return;
      }

      let previewBlob = blob;
      let previewError = "";

      if (currentTarget === "tiff") {
        try {
          previewBlob = await convertFile(f, "png", options, () => {});
          if (previewBlob.size === 0) {
            throw new Error("プレビュー結果が空です。");
          }
        } catch (err) {
          console.error("TIFF preview conversion failed:", err);
          previewError = "TIFFは生成できましたが、プレビューの生成に失敗しました。";
        }
      }

      if (version !== conversionVersionRef.current) return;

      const downloadUrl = URL.createObjectURL(blob);
      setDownloadUrlValue(downloadUrl);
      editedBlobRef.current = blob;
      setEditedSize(blob.size);

      if (previewError) {
        setEditedUrlValue("");
        setError(previewError);
        return;
      }

      if (currentTarget === "tiff") {
        setEditedUrlValue(URL.createObjectURL(previewBlob));
      } else {
        setEditedUrlValue(downloadUrl);
      }
      setError("");
    } catch (err) {
      if (version !== conversionVersionRef.current) return;
      console.error("Preview conversion failed:", err);
      setError(
        err instanceof Error ? err.message : "プレビュー生成に失敗しました。",
      );
    } finally {
      if (version === conversionVersionRef.current) {
        setPreviewLoading(false);
      }
    }
  }

  function scheduleConversion() {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      runConversion();
    }, DEBOUNCE_MS);
  }

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      revokeRef(sourceUrlRef);
      revokeRef(editedUrlRef);
      revokeRef(downloadUrlRef);
    };
  }, []);

  function handleFile(f: File) {
    const sourceExt = getExt(f.name);
    clearPreviews();
    resetImageSettings();

    if (getCategory(sourceExt) !== "image") {
      setFile(null);
      fileRef.current = null;
      setSourceUrl("");
      setError("編集タブでは画像ファイルを選択してください。");
      return;
    }

    const nextTargets = getImageEditTargets(sourceExt);

    setFile(f);
    fileRef.current = f;
    setTarget(nextTargets[0] ?? "png");
    setSourcePreviewMode("native");
    setSourcePreviewLoading(false);
    setSourceUrl(URL.createObjectURL(f));
    setError("");

    scheduleConversion();
  }

  async function createConvertedSourcePreview() {
    if (!file) return;
    if (sourcePreviewMode === "converted") {
      setSourcePreviewLoading(false);
      setSourceUrl("");
      setError("この画像形式はプレビュー表示できませんでした。編集は試せます。");
      return;
    }
    try {
      setSourcePreviewLoading(true);
      setSourcePreviewMode("converted");
      const previewBlob = await convertFile(
        file,
        "png",
        { scalePct: 100, rotate: 0, quality: 90 },
        () => {},
      );
      setSourceUrl(URL.createObjectURL(previewBlob));
      setSourcePreviewLoading(false);
    } catch {
      setSourcePreviewLoading(false);
      setSourceUrl("");
      setError("元画像プレビューの生成に失敗しました。");
    }
  }

  function handleOriginalImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    setSourceWidth(img.naturalWidth);
    setSourceHeight(img.naturalHeight);
    setWidth((prev) => prev || String(img.naturalWidth));
    setHeight((prev) => prev || String(img.naturalHeight));
  }

  function handleWidthChange(value: string) {
    const clean = value.replace(/[^\d]/g, "");
    setWidth(clean);
    if (keepAspect && baseRatio && clean) {
      setHeight(String(Math.round(Number(clean) * baseRatio)));
    }
  }

  function handleHeightChange(value: string) {
    const clean = value.replace(/[^\d]/g, "");
    setHeight(clean);
    if (keepAspect && baseRatio && clean) {
      setWidth(String(Math.round(Number(clean) / baseRatio)));
    }
  }

  function handleRotate(nextRotate: number) {
    setRotate(nextRotate);
    if (keepAspect && sourceWidth && sourceHeight && width) {
      const rotated = nextRotate === 90 || nextRotate === 270;
      const w = rotated ? sourceHeight : sourceWidth;
      const h = rotated ? sourceWidth : sourceHeight;
      const ratio = h / w;
      setHeight(String(Math.round(Number(width) * ratio)));
    }
  }

  function handleDownload() {
    const url = downloadUrlRef.current;
    if (!url) return;
    triggerDownload(url, outName);
  }

  function getShareBlob() {
    return editedBlobRef.current;
  }

  function FileInfoRow({ label, value }: { label: string; value: string }) {
    return (
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className="text-right text-gray-700">{value}</span>
      </div>
    );
  }

  function handleSourceClick() {
    fileInputRef.current?.click();
  }

  function handleSourceDrop(e: React.DragEvent) {
    e.preventDefault();
    setSourceDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2">

        {/* ── 元画像 ── */}
        <div className="order-1 rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-700">元画像</h3>
          <div
            role="button"
            tabIndex={0}
            onClick={handleSourceClick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleSourceClick();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setSourceDrag(true);
            }}
            onDragLeave={() => setSourceDrag(false)}
            onDrop={handleSourceDrop}
            onMouseEnter={() => file && setSourceHover(true)}
            onMouseLeave={() => setSourceHover(false)}
              className={`relative mt-3 flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl transition ${
                sourceDrag
                  ? "border-2 border-green-400 bg-green-50"
                  : "border-2 border-transparent bg-gray-50 hover:border-gray-200"
              } ${!file ? "aspect-[4/3] sm:aspect-video" : "aspect-video"}`}
          >
            {sourcePreviewLoading ? (
              <span className="text-sm text-gray-400">プレビュー生成中…</span>
            ) : sourcePreviewUrl ? (
              <>
                <img
                  src={sourcePreviewUrl}
                  alt="元画像プレビュー"
                  onLoad={handleOriginalImageLoad}
                  onError={createConvertedSourcePreview}
                  className="max-h-full max-w-full object-contain"
                />
                {sourceHover && !sourceDrag && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity">
                    <span className="rounded-lg bg-white/90 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm">
                      画像を変更
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <FileInputIcon className="h-10 w-10 sm:h-12 sm:w-12" />
                <span className="text-sm">画像を選択</span>
                <span className="text-xs">またはここにドロップ</span>
              </div>
            )}
            {sourceDrag && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="rounded-lg bg-green-100 px-4 py-2 text-sm font-medium text-green-700">
                  ここにドロップ
                </span>
              </div>
            )}
          </div>
          {file && (
            <div className="mt-2 space-y-1 sm:mt-3 sm:space-y-1.5">
              <FileInfoRow label="ファイル名" value={file.name} />
              <FileInfoRow label="形式" value={normalizedExt.toUpperCase()} />
              <FileInfoRow
                label="画像サイズ"
                value={
                  sourceWidth && sourceHeight
                    ? `${sourceWidth} × ${sourceHeight}px`
                    : "—"
                }
              />
              <FileInfoRow label="ファイルサイズ" value={formatBytes(file.size)} />
            </div>
          )}
        </div>

        {/* ── 編集後 ── */}
        <div className="order-3 rounded-2xl border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-gray-700">編集後</h3>
            <div className={`relative mt-3 flex items-center justify-center overflow-hidden rounded-xl bg-gray-50 ${
              editedUrl ? "aspect-video" : "aspect-[4/3] sm:aspect-video"
            }`}>
              {editedUrl ? (
                <img
                  src={editedUrl}
                  alt="編集後プレビュー"
                  onError={() =>
                    setError("編集後の画像を表示できませんでした。別の形式を試してください。")
                  }
                  className={`max-h-full max-w-full object-contain transition-opacity ${
                    previewLoading ? "opacity-50" : "opacity-100"
                  }`}
                />
              ) : (
                <span className="text-sm text-gray-400">編集後のプレビュー</span>
              )}
              {previewLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                  <span className="text-sm text-gray-500">更新中…</span>
                </div>
              )}
            </div>
            <div className="mt-3 space-y-1.5">
              <FileInfoRow label="ファイル名" value={outName} />
              <FileInfoRow label="形式" value={target.toUpperCase()} />
              <FileInfoRow
                label="画像サイズ"
                value={`${outDim.w} × ${outDim.h}px`}
              />
              <FileInfoRow
                label="ファイルサイズ"
                value={
                  editedSize !== null
                    ? formatBytes(editedSize)
                    : previewLoading
                      ? "計算中…"
                      : "—"
                }
              />
            </div>
            <div className="mt-4">
              <FileActionButtons
                onDownload={handleDownload}
                getShareBlob={getShareBlob}
                filename={outName}
                disabled={!downloadUrlRef.current || previewLoading}
              />
            </div>
          </div>

        {/* ── 編集設定 ── */}
        <div className="order-2 rounded-2xl border border-gray-200 bg-white p-5 sm:row-span-2">
          <h3 className="text-sm font-semibold text-gray-700">編集設定</h3>

          {/* Output format */}
          <div className="mt-4 border-t border-gray-100 pt-4">
            <h4 className="text-xs font-medium tracking-wide text-gray-600 uppercase">
              出力形式
            </h4>
            <div className="mt-2">
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
              >
                {targets.map((t) => (
                  <option key={t} value={t}>
                    {t.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Resolution */}
          <div className="mt-4 border-t border-gray-100 pt-4">
            <h4 className="text-xs font-medium tracking-wide text-gray-600 uppercase">
              画像サイズ
            </h4>
            <div className="mt-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setResizeMode("percent")}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
                    resizeMode === "percent" ? ACTIVE_BTN : INACTIVE_BTN
                  }`}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => setResizeMode("pixels")}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
                    resizeMode === "pixels" ? ACTIVE_BTN : INACTIVE_BTN
                  }`}
                >
                  px指定
                </button>
              </div>
              {/* Detail area — indented with left border */}
              <div className="mt-3 ml-4 border-l-2 border-gray-200 pl-4">
                {resizeMode === "percent" ? (
                  <Slider
                    id="scale-slider"
                    label="サイズ"
                    labelClassName="select-none text-[10px] text-gray-600 sm:text-xs"
                    value={scalePct}
                    min={10}
                    max={200}
                    onChange={setScalePct}
                    suffix="%"
                  >
                    {sourceWidth && sourceHeight && (
                      <div className="mt-2 flex items-center justify-center gap-2 text-xs text-gray-400">
                        <span>
                          {sourceWidth} × {sourceHeight}px
                        </span>
                        <span className="text-green-600">→</span>
                        <span className="font-medium text-gray-700">
                          {outDim.w} × {outDim.h}px
                        </span>
                      </div>
                    )}
                  </Slider>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div>
                      <span className="text-[10px] text-gray-600 sm:text-xs">幅</span>
                      <input
                        value={width}
                        onChange={(e) => handleWidthChange(e.target.value)}
                        inputMode="numeric"
                        placeholder="例: 1200"
                        className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-600 sm:text-xs">高さ</span>
                      <input
                        value={height}
                        onChange={(e) => handleHeightChange(e.target.value)}
                        inputMode="numeric"
                        placeholder="例: 800"
                        className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={keepAspect}
                        onChange={(e) => setKeepAspect(e.target.checked)}
                      />
                      縦横比を固定
                    </label>
                    {sourceWidth && sourceHeight && (
                      <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                        <span>
                          {sourceWidth} × {sourceHeight}px
                        </span>
                        <span className="text-green-600">→</span>
                        <span className="font-medium text-gray-700">
                          {outDim.w} × {outDim.h}px
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Rotation */}
          <div className="mt-4 border-t border-gray-100 pt-4">
            <h4 className="text-xs font-medium tracking-wide text-gray-600 uppercase">
              回転
            </h4>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {[0, 90, 180, 270].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRotate(r)}
                  className={`rounded-lg px-2 py-2 text-sm font-medium ${
                    rotate === r ? ACTIVE_BTN : INACTIVE_BTN
                  }`}
                >
                  {r}°
                </button>
              ))}
            </div>
          </div>

          {/* Flip */}
          <div className="mt-4 border-t border-gray-100 pt-4">
            <h4 className="text-xs font-medium tracking-wide text-gray-600 uppercase">
              反転
            </h4>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFlipX((v) => !v)}
                className={`rounded-lg px-2 py-2 text-sm font-medium ${
                  flipX ? ACTIVE_BTN : INACTIVE_BTN
                }`}
              >
                左右反転
              </button>
              <button
                type="button"
                onClick={() => setFlipY((v) => !v)}
                className={`rounded-lg px-2 py-2 text-sm font-medium ${
                  flipY ? ACTIVE_BTN : INACTIVE_BTN
                }`}
              >
                上下反転
              </button>
            </div>
          </div>

          {/* Quality */}
          {showQuality && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <Slider
                id="quality-slider"
                label="品質"
                labelClassName="select-none text-xs font-medium tracking-wide text-gray-600 uppercase"
                value={quality}
                min={1}
                max={100}
                onChange={setQuality}
                suffix="%"
              />
            </div>
          )}
        </div>
      </div>

      {previewLoading && !editedUrl && (
        <div className="mt-2 text-center text-xs text-gray-400">
          プレビュー更新中…
        </div>
      )}
      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      
    </section>
  );
}
