"use client";

import { getPdfjs } from "./utils/pdfjs";

// PDF の 1 ページ目を画像化する。
// フェーズ1ではシンプルに「先頭ページのみ」対応。
export async function pdfToFirstPageImage(
  file: File,
  target: "png" | "jpg",
  onProgress: (p: number) => void,
): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("PDF変換はブラウザ上でのみ実行できます。");
  }

  onProgress(0.05);

  const pdfjsLib = await getPdfjs();

  onProgress(0.15);

  const data = new Uint8Array(await file.arrayBuffer());

  const loadingTask = pdfjsLib.getDocument({
    data,
  });

  const pdf = await loadingTask.promise;

  onProgress(0.35);

  const page = await pdf.getPage(1);

  const viewport = page.getViewport({
    scale: 2,
  });

  const canvas = document.createElement("canvas");

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas の初期化に失敗しました。");
  }

  onProgress(0.55);

  await page.render({
    canvasContext: ctx,
    canvas,
    viewport,
  }).promise;

  onProgress(0.9);

  const mime = target === "png" ? "image/png" : "image/jpeg";

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("PDFページの画像化に失敗しました。"));
      },
      mime,
      0.92,
    );
  });

  onProgress(1);

  return blob;
}