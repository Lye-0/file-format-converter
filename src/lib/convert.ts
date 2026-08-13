"use client";
import * as Comlink from "comlink";
import type { WorkerApi } from "@/workers/convert.worker";
import { getCategory, getExt, MIME } from "./formats";
import { pdfToFirstPageImage } from "./pdfToImages";

let remote: Comlink.Remote<WorkerApi> | null = null;
function getRemote() {
  if (!remote) {
    const worker = new Worker(
      new URL("../workers/convert.worker.ts", import.meta.url),
    );
    remote = Comlink.wrap<WorkerApi>(worker);
  }
  return remote;
}

export type ConvertOpts = { scalePct?: number; rotate?: number; quality?: number };

export async function convertFile(
  file: File,
  target: string,
  opts: ConvertOpts,
  onProgress: (p: number) => void,
): Promise<Blob> {
  const ext = getExt(file.name);
  const cat = getCategory(ext);
  const api = getRemote();

  if (cat === "image") {
    const buf = await file.arrayBuffer();
    if (target === "pdf") {
      const out = (await api.imageToPdf(buf, opts)) as ArrayBuffer;
      return new Blob([out], { type: "application/pdf" });
    }
    const out = (await api.convertImage(buf, target, opts)) as ArrayBuffer;
    return new Blob([out], { type: MIME[target] });
  }

  if (cat === "audio") {
    const buf = await file.arrayBuffer();
    const out = (await api.convertAudio(
      buf,
      `input.${ext}`,
      target,
      Comlink.proxy(onProgress),
    )) as ArrayBuffer;
    return new Blob([out], { type: MIME[target] });
  }

  if (cat === "pdf") {
    // pdf.js は canvas を使うためメインスレッドで実行
    return await pdfToFirstPageImage(file, target as "png" | "jpg", onProgress);
  }

  throw new Error("未対応の形式です");
}
