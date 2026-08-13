"use client";

import { useEffect, useMemo, useState } from "react";
import DropZone from "@/components/DropZone";
import DownloadArea from "@/components/DownloadArea";
import { convertFile } from "@/lib/convert";
import { getCategory, getExt, normalizeExt } from "@/lib/formats";

type ResizeMode = "percent" | "pixels";
type EditStatus = "idle" | "editing" | "done" | "error";
type PreviewMode = "native" | "converted";

const IMAGE_EDIT_OUTPUTS = ["png", "jpg", "webp", "avif", "gif", "bmp", "tiff"];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function getImageEditTargets(ext: string) {
  const normalized = normalizeExt(ext);
  const outputs = [...IMAGE_EDIT_OUTPUTS];

  if (outputs.includes(normalized)) {
    return [normalized, ...outputs.filter((f) => f !== normalized)];
  }

  return outputs;
}

export default function EditPanel() {
  const [file, setFile] = useState<File | null>(null);

  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null);
  const [sourcePreviewMode, setSourcePreviewMode] =
    useState<PreviewMode>("native");
  const [sourcePreviewLoading, setSourcePreviewLoading] = useState(false);

  const [editedUrl, setEditedUrl] = useState<string | null>(null);
  const [editedSize, setEditedSize] = useState<number | null>(null);

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
  const [quality, setQuality] = useState(82);

  const [status, setStatus] = useState<EditStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const ext = file ? getExt(file.name) : "";
  const normalizedExt = normalizeExt(ext);

  const targets = useMemo(() => {
    if (!file) return IMAGE_EDIT_OUTPUTS;
    return getImageEditTargets(ext);
  }, [file, ext]);

  const showQuality = ["jpg", "webp", "avif"].includes(target);

  const outName = file
    ? `${file.name.replace(/\.[^.]+$/, "")}_edited.${target}`
    : `edited.${target}`;

  const baseRatio = useMemo(() => {
    if (!sourceWidth || !sourceHeight) return null;

    const rotated = rotate === 90 || rotate === 270;
    const w = rotated ? sourceHeight : sourceWidth;
    const h = rotated ? sourceWidth : sourceHeight;

    if (!w || !h) return null;

    return h / w;
  }, [sourceWidth, sourceHeight, rotate]);

  function resetResult() {
    setEditedUrl(null);
    setEditedSize(null);
    setStatus("idle");
    setProgress(0);
    setError("");
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
    setQuality(82);
  }

  function handleFile(f: File) {
    const sourceExt = getExt(f.name);

    resetResult();
    resetImageSettings();

    if (getCategory(sourceExt) !== "image") {
      setFile(null);
      setSourcePreviewUrl(null);
      setError("編集タブでは画像ファイルを選択してください。");
      return;
    }

    const nextTargets = getImageEditTargets(sourceExt);

    setFile(f);
    setTarget(nextTargets[0] ?? "png");
    setSourcePreviewMode("native");
    setSourcePreviewLoading(false);
    setSourcePreviewUrl(URL.createObjectURL(f));
    setStatus("idle");
    setProgress(0);
    setError("");
  }

  async function createConvertedSourcePreview() {
    if (!file) return;

    // すでに変換プレビューを試した後なら、無限ループを避ける
    if (sourcePreviewMode === "converted") {
      setSourcePreviewLoading(false);
      setSourcePreviewUrl(null);
      setError("この画像形式はプレビュー表示できませんでした。編集は試せます。");
      return;
    }

    try {
      setSourcePreviewLoading(true);
      setSourcePreviewMode("converted");

      // ブラウザで直接表示できない画像は、プレビュー用にPNGへ変換する
      const previewBlob = await convertFile(
        file,
        "png",
        {
          scalePct: 100,
          rotate: 0,
          quality: 90,
        },
        () => {},
      );

      setSourcePreviewUrl(URL.createObjectURL(previewBlob));
      setSourcePreviewLoading(false);
    } catch {
      setSourcePreviewLoading(false);
      setSourcePreviewUrl(null);
      setError("元画像プレビューの生成に失敗しました。");
    }
  }

  function handleOriginalImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;

    setSourceWidth(img.naturalWidth);
    setSourceHeight(img.naturalHeight);

    // ファイル選択直後のみ、元画像のサイズを初期値として入れる
    setWidth((prev) => prev || String(img.naturalWidth));
    setHeight((prev) => prev || String(img.naturalHeight));
  }

  function handleWidthChange(value: string) {
    const clean = value.replace(/[^\d]/g, "");
    setWidth(clean);

    if (keepAspect && baseRatio && clean) {
      const nextHeight = Math.round(Number(clean) * baseRatio);
      setHeight(String(nextHeight));
    }
  }

  function handleHeightChange(value: string) {
    const clean = value.replace(/[^\d]/g, "");
    setHeight(clean);

    if (keepAspect && baseRatio && clean) {
      const nextWidth = Math.round(Number(clean) / baseRatio);
      setWidth(String(nextWidth));
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

  async function handleEdit() {
    if (!file) return;

    setStatus("editing");
    setProgress(0);
    setError("");

    try {
      const blob = await convertFile(
        file,
        target,
        {
          scalePct: resizeMode === "percent" ? scalePct : undefined,
          width: resizeMode === "pixels" && width ? Number(width) : undefined,
          height:
            resizeMode === "pixels" && height ? Number(height) : undefined,
          keepAspect,
          rotate,
          flipX,
          flipY,
          quality,
        },
        (p) => {
          setProgress(p);
        },
      );

      setEditedUrl(URL.createObjectURL(blob));
      setEditedSize(blob.size);
      setProgress(1);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "編集に失敗しました。");
    }
  }

  useEffect(() => {
    return () => {
      if (sourcePreviewUrl) {
        URL.revokeObjectURL(sourcePreviewUrl);
      }
    };
  }, [sourcePreviewUrl]);

  useEffect(() => {
    return () => {
      if (editedUrl) {
        URL.revokeObjectURL(editedUrl);
      }
    };
  }, [editedUrl]);

  return (
    <section className="flex w-full flex-col items-center gap-4">
      <DropZone file={file} onFile={handleFile} />

      <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-[1fr_1.1fr]">
        {/* プレビュー */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-bold text-gray-700">元画像</h2>

            <div className="mt-3 flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-gray-50">
              {sourcePreviewLoading ? (
                <span className="text-sm text-gray-400">
                  プレビュー生成中…
                </span>
              ) : sourcePreviewUrl ? (
                <img
                  src={sourcePreviewUrl}
                  alt="元画像プレビュー"
                  onLoad={handleOriginalImageLoad}
                  onError={createConvertedSourcePreview}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="text-sm text-gray-400">
                  画像を選択してください
                </span>
              )}
            </div>

            {file && (
              <div className="mt-3 text-xs text-gray-500">
                <div className="break-all">{file.name}</div>
                <div>{formatBytes(file.size)}</div>
                {sourceWidth && sourceHeight && (
                  <div>
                    {sourceWidth} × {sourceHeight}px
                    {sourcePreviewMode === "converted" && "（PNGプレビュー）"}
                  </div>
                )}
                {!sourceWidth && sourcePreviewMode === "converted" && (
                  <div>PNGプレビューを生成しました</div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-bold text-gray-700">編集後</h2>

            <div className="mt-3 flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-gray-50">
              {editedUrl ? (
                <img
                  src={editedUrl}
                  alt="編集後プレビュー"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="text-sm text-gray-400">
                  編集後のプレビュー
                </span>
              )}
            </div>

            {editedSize !== null && (
              <div className="mt-3 text-xs text-gray-500">
                出力サイズ: {formatBytes(editedSize)}
              </div>
            )}
          </div>
        </div>

        {/* 編集設定 */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <h2 className="text-sm font-bold text-gray-700">編集設定</h2>

          <div className="mt-4 flex flex-col gap-4">
            <label className="grid grid-cols-[5rem_1fr] items-center gap-3 text-sm text-gray-600">
              <span>出力形式</span>
              <select
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value);
                  resetResult();
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base"
              >
                {targets.map((t) => (
                  <option key={t} value={t}>
                    {t.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-xl bg-white p-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setResizeMode("percent");
                    resetResult();
                  }}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
                    resizeMode === "percent"
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  %
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setResizeMode("pixels");
                    resetResult();
                  }}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
                    resizeMode === "pixels"
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  px指定
                </button>
              </div>

              {resizeMode === "percent" ? (
                <label className="mt-3 grid grid-cols-[5rem_1fr_3rem] items-center gap-2 text-sm text-gray-600">
                  <span>サイズ</span>
                  <input
                    type="range"
                    min={10}
                    max={200}
                    value={scalePct}
                    onChange={(e) => {
                      setScalePct(Number(e.target.value));
                      resetResult();
                    }}
                    className="w-full"
                  />
                  <span className="text-right tabular-nums">{scalePct}%</span>
                </label>
              ) : (
                <div className="mt-3 flex flex-col gap-3">
                  <label className="grid grid-cols-[5rem_1fr] items-center gap-2 text-sm text-gray-600">
                    <span>幅</span>
                    <input
                      value={width}
                      onChange={(e) => {
                        handleWidthChange(e.target.value);
                        resetResult();
                      }}
                      inputMode="numeric"
                      placeholder="例: 1200"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    />
                  </label>

                  <label className="grid grid-cols-[5rem_1fr] items-center gap-2 text-sm text-gray-600">
                    <span>高さ</span>
                    <input
                      value={height}
                      onChange={(e) => {
                        handleHeightChange(e.target.value);
                        resetResult();
                      }}
                      inputMode="numeric"
                      placeholder="例: 800"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    />
                  </label>

                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={keepAspect}
                      onChange={(e) => {
                        setKeepAspect(e.target.checked);
                        resetResult();
                      }}
                    />
                    縦横比を固定
                  </label>
                </div>
              )}
            </div>

            <div className="rounded-xl bg-white p-3">
              <div className="text-sm font-medium text-gray-600">回転</div>

              <div className="mt-2 grid grid-cols-4 gap-2">
                {[0, 90, 180, 270].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      handleRotate(r);
                      resetResult();
                    }}
                    className={`rounded-lg px-2 py-2 text-sm font-medium ${
                      rotate === r
                        ? "bg-green-600 text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {r}°
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-white p-3">
              <div className="text-sm font-medium text-gray-600">反転</div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFlipX((v) => !v);
                    resetResult();
                  }}
                  className={`rounded-lg px-2 py-2 text-sm font-medium ${
                    flipX
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  左右反転
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFlipY((v) => !v);
                    resetResult();
                  }}
                  className={`rounded-lg px-2 py-2 text-sm font-medium ${
                    flipY
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  上下反転
                </button>
              </div>
            </div>

            {showQuality && (
              <label className="grid grid-cols-[5rem_1fr_3rem] items-center gap-2 rounded-xl bg-white p-3 text-sm text-gray-600">
                <span>品質</span>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={quality}
                  onChange={(e) => {
                    setQuality(Number(e.target.value));
                    resetResult();
                  }}
                  className="w-full"
                />
                <span className="text-right tabular-nums">{quality}%</span>
              </label>
            )}

            <button
              type="button"
              onClick={handleEdit}
              disabled={!file || status === "editing"}
              className="rounded-xl bg-green-600 px-7 py-3 font-medium text-white shadow hover:bg-green-700 disabled:opacity-40"
            >
              {status === "editing" ? "編集中…" : "編集してダウンロード"}
            </button>

            <div className="h-4 text-center text-xs text-gray-500">
              {status === "editing"
                ? `編集中 ${Math.round(progress * 100)}%`
                : status === "done"
                  ? "完了"
                  : ""}
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <DownloadArea url={editedUrl} name={outName} />
          </div>
        </div>
      </div>

      <p className="max-w-2xl text-center text-xs leading-5 text-gray-400">
        ※ 編集タブは画像編集から対応しています。PDFページ編集は次のステップで追加します。
      </p>
    </section>
  );
}