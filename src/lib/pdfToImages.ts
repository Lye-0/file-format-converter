"use client";
import * as pdfjsLib from "pdfjs-dist";

// pdf.js のワーカーを同一オリジンから読み込む
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

// PDF の 1 ページ目を画像化（フェーズ1では先頭ページのみ）
export async function pdfToFirstPageImage(
  file: File,
  target: "png" | "jpg",
  onProgress: (p: number) => void,
): Promise<Blob> {
  onProgress(0.1);
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;
  onProgress(0.5);

  await page.render({ canvasContext: ctx, viewport }).promise;
  onProgress(0.9);

  const mime = target === "png" ? "image/png" : "image/jpeg";
  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b!), mime, 0.92),
  );
  onProgress(1);
  return blob;
}
