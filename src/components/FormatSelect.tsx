"use client";

export default function FormatSelect({
  targets,
  value,
  onChange,
  disabled,
}: {
  targets: string[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled || targets.length === 0}
      onChange={(e) => onChange(e.target.value)}
      className="w-32 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base shadow-sm focus:border-green-500 focus:outline-none disabled:opacity-50 sm:w-auto sm:px-3 sm:py-1.5 sm:text-sm"
    >
      {targets.length === 0 && <option>—</option>}

      {targets.map((t) => (
        <option key={t} value={t}>
          {t.toUpperCase()}
        </option>
      ))}
    </select>
  );
}