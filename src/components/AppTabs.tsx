"use client";

export type AppTab = "convert" | "edit" | "pdf";

export default function AppTabs({
  activeTab,
  onChange,
}: {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
}) {
  const tabs: { id: AppTab; label: string }[] = [
    { id: "convert", label: "変換" },
    { id: "edit", label: "画像編集" },
    { id: "pdf", label: "PDF編集" },
  ];

  return (
    <div
      role="tablist"
      aria-label="機能切り替え"
      className="flex rounded-full border border-gray-200 bg-gray-50 p-1"
    >
      {tabs.map((tab) => {
        const active = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition sm:px-5 ${
              active
                ? "bg-green-600 text-white shadow"
                : "text-gray-600 hover:bg-white hover:text-gray-900"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
