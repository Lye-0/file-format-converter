"use client";

export default function ArrowProgress({
  progress,
  active,
}: {
  progress: number;
  active: boolean;
}) {
  const p = Math.max(0, Math.min(1, progress));
  const pct = (p * 100).toFixed(1);

  return (
    <div className="flex flex-col items-center select-none">
      {/* スマホ: 下向き矢印。少し長め */}
      <svg
        className="block h-20 w-12 sm:hidden"
        viewBox="0 0 48 96"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="arrowFillMobile" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset={`${pct}%`} stopColor="#22c55e" />
            <stop offset={`${pct}%`} stopColor="#e5e7eb" />
            <stop offset="100%" stopColor="#e5e7eb" />
          </linearGradient>
        </defs>

        <path
          d="M18 4 H30 V62 H40 L24 92 L8 62 H18 Z"
          fill="url(#arrowFillMobile)"
          stroke="#9ca3af"
          strokeWidth="1"
        />
      </svg>

      {/* PC: 従来通り横向き矢印 */}
      <svg
        className="hidden h-12 w-40 sm:block"
        viewBox="0 0 160 48"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="arrowFillDesktop" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset={`${pct}%`} stopColor="#22c55e" />
            <stop offset={`${pct}%`} stopColor="#e5e7eb" />
            <stop offset="100%" stopColor="#e5e7eb" />
          </linearGradient>
        </defs>

        <path
          d="M4 18 H120 V8 L156 24 L120 40 V30 H4 Z"
          fill="url(#arrowFillDesktop)"
          stroke="#9ca3af"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}