"use client";

export default function FormatSelect({
  targets,
  value,
  onChange,
  disabled,
  disabledTarget,
}: {
  targets: string[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  disabledTarget?: string;
}) {
  return (
    <select
      value={value}
      disabled={disabled || targets.length === 0}
      onChange={(e) => onChange(e.target.value)}
      className="w-20 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-green-500 focus:outline-none disabled:opacity-50"
    >
      {targets.length === 0 && <option>—</option>}

      {targets.map((t) => (
        <option
          key={t}
          value={t}
          disabled={t === disabledTarget}
        >
          {t.toUpperCase()}
          {t === disabledTarget ? "（元の形式）" : ""}
        </option>
      ))}
    </select>
  );
}
