"use client";

// 矢印の根元→先端に向かって色が満ちて進捗を表す
export default function ArrowProgress({
  progress,
  active,
}: {
  progress: number;
  active: boolean;
}) {
  const p = Math.max(0, Math.min(1, progress));
  const pct = (p * 100).toFixed(1);
  const done = p >= 1;

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <svg width="160" height="48" viewBox="0 0 160 48">
        <defs>
          <linearGradient id="arrowFill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset={`${pct}%`} stopColor="#22c55e" />
            <stop offset={`${pct}%`} stopColor="#e5e7eb" />
            <stop offset="100%" stopColor="#e5e7eb" />
          </linearGradient>
        </defs>
        <path
          d="M4 18 H120 V8 L156 24 L120 40 V30 H4 Z"
          fill="url(#arrowFill)"
          stroke="#9ca3af"
          strokeWidth="1"
        />
      </svg>
      <span className="h-4 text-xs text-gray-500">
        {done ? "完了" : active ? `変換中 ${Math.round(p * 100)}%` : ""}
      </span>
    </div>
  );
}
