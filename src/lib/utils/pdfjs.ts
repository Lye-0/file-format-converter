"use client";

type PdfjsLib = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfjsLib> | null = null;

export async function getPdfjs(): Promise<PdfjsLib> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      if (typeof window === "undefined") {
        throw new Error("PDF.js はブラウザ上でのみ実行できます。");
      }
      const dynamicImport = new Function(
        "path",
        "return import(path)",
      ) as (path: string) => Promise<PdfjsLib>;
      const lib = await dynamicImport("/pdfjs/pdf.mjs");
      lib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.mjs";
      return lib;
    })();
  }
  return pdfjsPromise;
}
