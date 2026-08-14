"use client";

import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { PDFDocument, degrees } from "pdf-lib";
import FileInputIcon from "@/components/FileInputIcon";

/* ── Dynamic pdfjs-dist import (browser only) ── */

type PdfjsLib = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfjsLib> | null = null;

async function getPdfjs(): Promise<PdfjsLib> {
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

/* ── Types ── */

interface PdfPageItem {
  id: string;
  sourceDocId: string;
  sourcePageIndex: number;
  rotation: number;
  thumbnail: string | null;
}

interface PdfDocGroup {
  id: string;
  name: string;
  pages: PdfPageItem[];
}

interface PageDragSource {
  groupId: string;
  pageIndex: number;
}

/* ── Helpers ── */

let nextId = 0;
function uid() {
  return `p${++nextId}_${Date.now()}`;
}
function docUid() {
  return `d${++nextId}_${Date.now()}`;
}

function getOutputFilename(group: PdfDocGroup, index: number, total: number): string {
  if (total <= 1) return group.name.replace(/\.pdf$/i, "") + "_edited.pdf";
  const base = group.name.replace(/\.pdf$/i, "");
  return `${base}_part${index + 1}.pdf`;
}

/* ── Thumbnail generation ── */

async function renderThumbnail(pdf: any, pageIndex: number, maxDim = 200): Promise<string> {
  const page = await pdf.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: 1 });
  const scale = maxDim / Math.max(viewport.width, viewport.height);
  const scaled = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = scaled.width;
  canvas.height = scaled.height;
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, canvas, viewport: scaled }).promise;
  const url = canvas.toDataURL("image/jpeg", 0.7);
  canvas.width = 0;
  canvas.height = 0;
  return url;
}

/* ── Generate PDF bytes from a group ── */

async function generateGroupPdf(
  group: PdfDocGroup,
  pdfCache: Map<string, any>,
): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const p of group.pages) {
    const srcPdf = pdfCache.get(p.sourceDocId);
    if (!srcPdf) continue;
    const srcBuf = await srcPdf.getData();
    const srcDoc = await PDFDocument.load(srcBuf);
    const [copied] = await out.copyPages(srcDoc, [p.sourcePageIndex]);
    const page = out.addPage(copied);
      if (p.rotation !== 0) {
        page.setRotation(degrees(p.rotation));
      }
  }
  return out.save();
}

/* ── Split modal ── */

/* ── Single PDF group block ── */

function PdfGroupBlock({
  group,
  groupIndex,
  totalGroups,
  pdfCache,
  thumbUrls,
  pageDragSource,
  onPageDragStart,
  onPageDragEnd,
  onPageMove,
  onSplit,
  onDelete,
  onUpdatePages,
  error,
  setError,
}: {
  group: PdfDocGroup;
  groupIndex: number;
  totalGroups: number;
  pdfCache: Map<string, any>;
  thumbUrls: Set<string>;
  pageDragSource: PageDragSource | null;
  onPageDragStart: (groupId: string, pageIndex: number) => void;
  onPageDragEnd: () => void;
  onPageMove: (
    sourceGroupId: string,
    sourcePageIndex: number,
    targetGroupId: string,
    targetPosition: number,
  ) => void;
  onSplit: (groupId: string, splitIndex: number) => void;
  onDelete: (groupId: string) => void;
  onUpdatePages: (groupId: string, pages: PdfPageItem[]) => void;
  error: string;
  setError: (msg: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null);
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const pages = group.pages;
  const selectedIndex = pages.findIndex((p) => p.id === selectedId);
  const isSource = pageDragSource?.groupId === group.id;

  function selectPage(id: string) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  function rotatePage(direction: 1 | -1) {
    if (selectedIndex < 0) return;
    const next = pages.map((p, i) =>
      i === selectedIndex
        ? { ...p, rotation: (p.rotation + direction * 90 + 360) % 360 }
        : p,
    );
    onUpdatePages(group.id, next);
  }

  function deletePage() {
    if (selectedIndex < 0) return;
    if (pages.length <= 1) {
      setConfirmDeleteGroupId(group.id);
      return;
    }
    onUpdatePages(
      group.id,
      pages.filter((_, i) => i !== selectedIndex),
    );
    setSelectedId(null);
  }

  function confirmDeleteGroup() {
    if (confirmDeleteGroupId) {
      onDelete(confirmDeleteGroupId);
      setConfirmDeleteGroupId(null);
      setSelectedId(null);
    }
  }

  /* ── Page drag handlers ── */

  function handlePageDragStart(index: number) {
    onPageDragStart(group.id, index);
  }

  function handlePageDragOverCard(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.stopPropagation();
    if (!pageDragSource) return;

    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const isLeftHalf = e.clientX < centerX;

    if (isSource) {
      // Same-block: account for removed page
      const vi = index < pageDragSource.pageIndex ? index : index - 1;
      setDropIndicatorIndex(isLeftHalf ? vi : vi + 1);
    } else {
      // Cross-block: direct position in target
      setDropIndicatorIndex(isLeftHalf ? index : index + 1);
    }
  }

  function handlePageDragOverGrid(e: React.DragEvent) {
    e.preventDefault();
    if (!pageDragSource) return;
    setDropIndicatorIndex(pages.length);
  }

  function handlePageDragLeave(e: React.DragEvent) {
    // Only clear if leaving the grid entirely
    const related = e.relatedTarget as HTMLElement;
    if (related && e.currentTarget.contains(related)) return;
    setDropIndicatorIndex(null);
  }

  function handlePageDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!pageDragSource || dropIndicatorIndex === null) {
      onPageDragEnd();
      return;
    }

    onPageMove(
      pageDragSource.groupId,
      pageDragSource.pageIndex,
      group.id,
      dropIndicatorIndex,
    );
    setDropIndicatorIndex(null);
    onPageDragEnd();
  }

  function handlePageDragEnd() {
    setDropIndicatorIndex(null);
    onPageDragEnd();
  }

  /* ── Split ── */

  function handleAddPdf() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,application/pdf";
    input.onchange = async (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      try {
        const buf = await f.arrayBuffer();
        const pdfjsLib = await getPdfjs();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        const docId = docUid();
        pdfCache.set(docId, pdf);
        const newPages: PdfPageItem[] = [];
        for (let i = 0; i < pdf.numPages; i++) {
          const thumbnail = await renderThumbnail(pdf, i);
          thumbUrls.add(thumbnail);
          newPages.push({
            id: uid(),
            sourceDocId: docId,
            sourcePageIndex: i,
            rotation: 0,
            thumbnail,
          });
        }
        onUpdatePages(group.id, [...pages, ...newPages]);
      } catch {
        setError("このPDFは現在編集できません");
      }
    };
    input.click();
  }

  /* ── Download ── */

  async function downloadGroup() {
    setExporting(true);
    try {
      const bytes = await generateGroupPdf(group, pdfCache);
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = getOutputFilename(group, groupIndex, totalGroups);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("PDFの生成に失敗しました");
    } finally {
      setExporting(false);
    }
  }

  const isDropTarget = pageDragSource && !isSource;

  return (
    <div
      className={`rounded-2xl border-2 bg-white p-4 transition sm:p-5 ${
        isDropTarget ? "border-green-300" : "border-gray-200"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">
              PDF {groupIndex + 1}
            </span>
            <span className="text-xs text-gray-400">{pages.length}ページ</span>
          </div>
          <div className="truncate text-xs text-gray-400">{group.name}</div>
        </div>
        <button
          type="button"
          onClick={handleAddPdf}
          className="pdf-btn-join shrink-0 whitespace-nowrap"
        >
          ＋ PDFを結合
        </button>
      </div>

      {/* Toolbar */}
      <div className="pdf-toolbar mt-2 flex items-center rounded-xl border border-gray-200 bg-gray-50 sm:mt-3 sm:px-4 sm:py-2.5 pdf-toolbar-pc">
        <span className="pdf-status whitespace-nowrap text-gray-400 sm:text-xs">
          {selectedIndex >= 0 ? `${selectedIndex + 1}ページ目` : "選択"}
        </span>
        <button
          type="button"
          disabled={selectedIndex < 0}
          onClick={() => rotatePage(-1)}
          className="pdf-btn-compact whitespace-nowrap"
        >
          ↶ 左回転
        </button>
        <button
          type="button"
          disabled={selectedIndex < 0}
          onClick={() => rotatePage(1)}
          className="pdf-btn-compact whitespace-nowrap"
        >
          ↷ 右回転
        </button>
        <button
          type="button"
          disabled={selectedIndex < 0 || selectedIndex === 0 || pages.length < 2}
          onClick={() => {
            if (selectedIndex > 0 && selectedIndex < pages.length) {
              onSplit(group.id, selectedIndex);
              setSelectedId(null);
            }
          }}
          className="pdf-btn-compact whitespace-nowrap"
        >
          分割
        </button>
        {/* Spacer */}
        <div />
        <button
          type="button"
          disabled={selectedIndex < 0}
          onClick={deletePage}
          className="pdf-btn-delete whitespace-nowrap"
        >
          削除
        </button>
      </div>

      {/* Page grid */}
      <div
        className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5"
        onDragOver={handlePageDragOverGrid}
        onDragLeave={handlePageDragLeave}
        onDrop={handlePageDrop}
      >
        {pages.map((page, index) => {
          const isSelected = page.id === selectedId;
          const isDragging = isSource && pageDragSource?.pageIndex === index;

          const vi = isSource
            ? index < (pageDragSource?.pageIndex ?? Infinity)
              ? index
              : index - 1
            : index;
          const showLeftIndicator =
            pageDragSource !== null &&
            dropIndicatorIndex !== null &&
            !isDragging &&
            vi === dropIndicatorIndex;
          const showRightIndicator =
            pageDragSource !== null &&
            dropIndicatorIndex !== null &&
            !isDragging &&
            vi + 1 === dropIndicatorIndex;

          return (
            <div key={page.id} className="relative">
              {showLeftIndicator && (
                <div className="absolute -left-[5px] top-1 bottom-1 w-[3px] rounded-full bg-green-500" />
              )}

              <div
                draggable
                onDragStart={() => handlePageDragStart(index)}
                onDragOver={(e) => handlePageDragOverCard(e, index)}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePageDrop(e);
                }}
                onDragEnd={handlePageDragEnd}
                onClick={() => selectPage(page.id)}
                className={`group relative cursor-pointer rounded-xl border-2 bg-white p-1.5 transition sm:p-2 ${
                  isDragging
                    ? "opacity-40 shadow-md"
                    : isSelected
                      ? "border-green-400 bg-green-50"
                      : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="aspect-[3/4] overflow-hidden rounded-lg bg-gray-50">
                  {page.thumbnail ? (
                    <img
                      src={page.thumbnail}
                      alt={`ページ ${index + 1}`}
                      className="h-full w-full object-contain"
                      style={{
                        transform: page.rotation !== 0 ? `rotate(${page.rotation}deg)` : undefined,
                      }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-gray-400">
                      読み込み中…
                    </div>
                  )}
                </div>
                <div className="mt-1 flex items-center justify-between px-0.5">
                  <span className="text-xs font-medium text-gray-500">{index + 1}</span>
                  {page.rotation !== 0 && (
                    <span className="text-[10px] text-gray-400">{page.rotation}°</span>
                  )}
                </div>
                <div className="absolute left-1 top-1 hidden rounded bg-black/5 px-1 text-[10px] text-gray-400 group-hover:block">
                  ⠿
                </div>
              </div>

              {showRightIndicator && (
                <div className="absolute -right-[5px] top-1 bottom-1 w-[3px] rounded-full bg-green-500" />
              )}
            </div>
          );
        })}
      </div>

      {/* Download button */}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={downloadGroup}
          disabled={exporting || pages.length === 0}
          className="rounded-lg bg-green-600 px-4 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-40"
        >
          {exporting ? "生成中…" : "ダウンロード"}
        </button>
      </div>

      {/* Delete group confirmation modal */}
      {confirmDeleteGroupId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
            <h3 className="text-base font-semibold text-gray-800">PDFを削除</h3>
            <p className="mt-2 text-sm text-gray-600">
              このPDFには1ページしかありません。
            </p>
            <p className="mt-1 text-sm text-gray-600">
              このページを削除すると、このPDF自体が編集画面から削除されます。
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteGroupId(null)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={confirmDeleteGroup}
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
              >
                PDFを削除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main component ── */

export default function PdfEditPanel() {
  const [groups, setGroups] = useState<PdfDocGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadingAllPdfs, setDownloadingAllPdfs] = useState(false);
  const [pageDragSource, setPageDragSource] = useState<PageDragSource | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfCache = useRef<Map<string, any>>(new Map());
  const thumbUrls = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      thumbUrls.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const totalPages = groups.reduce((sum, g) => sum + g.pages.length, 0);
  const hasMultiple = groups.length > 1;

  /* ── PDF loading ── */

  async function loadPdf(file: File) {
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      setError("PDFファイルを選択してください");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const buf = await file.arrayBuffer();
      const pdfjsLib = await getPdfjs();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const docId = docUid();
      pdfCache.current.set(docId, pdf);
      const newPages: PdfPageItem[] = [];
      for (let i = 0; i < pdf.numPages; i++) {
        const thumbnail = await renderThumbnail(pdf, i);
        thumbUrls.current.add(thumbnail);
        newPages.push({
          id: uid(),
          sourceDocId: docId,
          sourcePageIndex: i,
          rotation: 0,
          thumbnail,
        });
      }
      setGroups((prev) => [
        ...prev,
        { id: docUid(), name: file.name, pages: newPages },
      ]);
    } catch {
      setError("このPDFは現在編集できません");
    } finally {
      setLoading(false);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) loadPdf(f);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) loadPdf(f);
  }

  /* ── Group operations ── */

  function handleUpdatePages(groupId: string, pages: PdfPageItem[]) {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, pages } : g)));
  }

  function handleSplit(groupId: string, splitIndex: number) {
    setGroups((prev) => {
      const idx = prev.findIndex((g) => g.id === groupId);
      if (idx < 0) return prev;
      const group = prev[idx];
      const part1 = group.pages.slice(0, splitIndex);
      const part2 = group.pages.slice(splitIndex);
      if (part2.length === 0) return prev;
      const base = group.name.replace(/\.pdf$/i, "");
      const newGroup: PdfDocGroup = {
        id: docUid(),
        name: `${base}_part2.pdf`,
        pages: part2,
      };
      const next = [...prev];
      next[idx] = { ...group, name: `${base}_part1.pdf`, pages: part1 };
      next.splice(idx + 1, 0, newGroup);
      return next;
    });
  }

  function handleDeleteGroup(groupId: string) {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  }

  /* ── Page move between groups ── */

  function handlePageDragStart(groupId: string, pageIndex: number) {
    setPageDragSource({ groupId, pageIndex });
  }

  function handlePageDragEnd() {
    setPageDragSource(null);
  }

  function handlePageMove(
    sourceGroupId: string,
    sourcePageIndex: number,
    targetGroupId: string,
    targetPosition: number,
  ) {
    setGroups((prev) => {
      const sourceGroup = prev.find((g) => g.id === sourceGroupId);
      if (!sourceGroup) return prev;

      const page = sourceGroup.pages[sourcePageIndex];
      if (!page) return prev;

      // Same-block reorder
      if (sourceGroupId === targetGroupId) {
        const next = [...prev];
        const idx = next.findIndex((g) => g.id === sourceGroupId);
        const pages = [...next[idx].pages];
        const [moved] = pages.splice(sourcePageIndex, 1);
        pages.splice(targetPosition, 0, moved);
        next[idx] = { ...next[idx], pages };
        return next;
      }

      // Cross-block move
      const newSourcePages = sourceGroup.pages.filter((_, i) => i !== sourcePageIndex);
      const targetGroup = prev.find((g) => g.id === targetGroupId);
      if (!targetGroup) return prev;

      const newTargetPages = [...targetGroup.pages];
      newTargetPages.splice(targetPosition, 0, page);

      let next = prev.map((g) => {
        if (g.id === sourceGroupId) return { ...g, pages: newSourcePages };
        if (g.id === targetGroupId) return { ...g, pages: newTargetPages };
        return g;
      });

      // Remove empty source group
      if (newSourcePages.length === 0) {
        next = next.filter((g) => g.id !== sourceGroupId);
      }

      return next;
    });
  }

  /* ── Download all as ZIP ── */

  async function downloadAll() {
    if (groups.length === 0) return;
    setDownloadingAll(true);
    setError("");
    try {
      if (groups.length === 1) {
        const bytes = await generateGroupPdf(groups[0], pdfCache.current);
        const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = getOutputFilename(groups[0], 0, 1);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }
      const zip = new JSZip();
      for (let i = 0; i < groups.length; i++) {
        const bytes = await generateGroupPdf(groups[i], pdfCache.current);
        zip.file(getOutputFilename(groups[i], i, groups.length), bytes);
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pdf_edited.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("一括ダウンロードに失敗しました");
    } finally {
      setDownloadingAll(false);
    }
  }

  /* ── Download all as individual PDFs ── */

  async function downloadAllPdfs() {
    if (groups.length === 0) return;
    setDownloadingAllPdfs(true);
    setError("");
    try {
      for (let i = 0; i < groups.length; i++) {
        const bytes = await generateGroupPdf(groups[i], pdfCache.current);
        const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = getOutputFilename(groups[i], i, groups.length);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      setError("PDFの生成に失敗しました");
    } finally {
      setDownloadingAllPdfs(false);
    }
  }

  /* ── Render ── */

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleFileInput}
      />

      {groups.length === 0 ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white py-20 text-gray-400 transition hover:border-green-400 hover:bg-green-50 ${
            loading ? "pointer-events-none opacity-60" : ""
          }`}
        >
          <FileInputIcon className="h-12 w-12" />
          <span className="mt-3 text-sm">
            {loading ? "PDFを読み込んでいます…" : "PDFを選択"}
          </span>
          {!loading && <span className="mt-1 text-xs">またはここにドロップ</span>}
        </div>
      ) : (
        <>
          {/* Global header */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-700">
                {totalPages}ページ ・ {groups.length}つのPDF
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                ＋ PDFを追加
              </button>
            </div>
          </div>

          {/* PDF group blocks */}
          <div className="flex flex-col gap-4">
            {groups.map((group, i) => (
              <PdfGroupBlock
                key={group.id}
                group={group}
                groupIndex={i}
                totalGroups={groups.length}
                pdfCache={pdfCache.current}
                thumbUrls={thumbUrls.current}
                pageDragSource={pageDragSource}
                onPageDragStart={handlePageDragStart}
                onPageDragEnd={handlePageDragEnd}
                onPageMove={handlePageMove}
                onSplit={handleSplit}
                onDelete={handleDeleteGroup}
                onUpdatePages={handleUpdatePages}
                error={error}
                setError={setError}
              />
            ))}
          </div>

          {/* Global download all */}
          {hasMultiple && (
            <div className="mt-4 flex justify-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={downloadAll}
                disabled={downloadingAll || downloadingAllPdfs}
                className="whitespace-nowrap rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[12px] font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-40 sm:px-5 sm:py-3 sm:text-sm"
              >
                {downloadingAll ? "生成中…" : "ZIPで一括保存"}
              </button>
              <button
                type="button"
                onClick={downloadAllPdfs}
                disabled={downloadingAll || downloadingAllPdfs}
                className="whitespace-nowrap rounded-xl bg-green-600 px-3 py-2.5 text-[12px] font-medium text-white shadow-sm hover:bg-green-700 disabled:opacity-40 sm:px-5 sm:py-3 sm:text-sm"
              >
                {downloadingAllPdfs ? "生成中…" : "PDFを一括保存"}
              </button>
            </div>
          )}
        </>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
    </section>
  );
}
