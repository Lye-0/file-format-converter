"use client";

import { useEffect, useState } from "react";
import AppTabs, { type AppTab } from "@/components/AppTabs";
import ConvertPanel from "@/components/ConvertPanel";
import EditPanel from "@/components/EditPanel";
import PdfEditPanel from "@/components/PdfEditPanel";

export default function HomeShell({ initialTab }: { initialTab: AppTab }) {
  const [activeTab, setActiveTab] = useState<AppTab>(initialTab);

  function handleTabChange(tab: AppTab) {
    setActiveTab(tab);

    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);

    window.history.pushState(null, "", url.toString());
  }

  useEffect(() => {
    function handlePopState() {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");

      if (tab === "edit" || tab === "pdf") {
        setActiveTab(tab);
      } else {
        setActiveTab("convert");
      }
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col items-center justify-start gap-4 px-4 py-7 sm:min-h-screen sm:justify-center sm:gap-6 sm:p-6">
      <h1 className="text-2xl font-bold sm:text-2xl">
        {activeTab === "edit"
          ? "ファイル編集"
          : activeTab === "pdf"
            ? "PDF編集"
            : "ファイル形式変換"}
      </h1>

      <AppTabs activeTab={activeTab} onChange={handleTabChange} />

      <section
        className={activeTab === "convert" ? "contents" : "hidden"}
        aria-hidden={activeTab !== "convert"}
      >
        <ConvertPanel />
      </section>

      <section
        className={activeTab === "edit" ? "contents" : "hidden"}
        aria-hidden={activeTab !== "edit"}
      >
        <EditPanel />
      </section>

      <section
        className={activeTab === "pdf" ? "contents" : "hidden"}
        aria-hidden={activeTab !== "pdf"}
      >
        <PdfEditPanel />
      </section>
    </main>
  );
}
