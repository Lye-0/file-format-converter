"use client";

type ImageOptionsProps = {
  scalePct: number;
  rotate: number;
  onScaleChange: (value: number) => void;
  onRotateChange: (value: number) => void;
  variant: "mobile" | "desktop";
};

export default function ImageOptionsBlock({
  scalePct,
  rotate,
  onScaleChange,
  onRotateChange,
  variant,
}: ImageOptionsProps) {
  if (variant === "mobile") {
    return (
      <div className="mt-3 flex flex-col gap-3 sm:hidden">
        <label className="grid grid-cols-[4rem_1fr_2.7rem] items-center gap-2 text-sm text-gray-600">
          <span>画像サイズ</span>
          <input
            type="range"
            min={10}
            max={100}
            value={scalePct}
            onChange={(e) => onScaleChange(Number(e.target.value))}
            className="w-full"
          />
          <span className="text-right tabular-nums">{scalePct}%</span>
        </label>

        <label className="grid grid-cols-[4rem_1fr] items-center gap-2 text-sm text-gray-600">
          <span>回転</span>
          <select
            value={rotate}
            onChange={(e) => onRotateChange(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base"
          >
            <option value={0}>0°</option>
            <option value={90}>90°</option>
            <option value={180}>180°</option>
            <option value={270}>270°</option>
          </select>
        </label>
      </div>
    );
  }

  return (
    <div className="hidden text-sm text-gray-600 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-6">
      <label className="flex items-center gap-2">
        <span>画像サイズ</span>
        <input
          type="range"
          min={10}
          max={100}
          value={scalePct}
          onChange={(e) => onScaleChange(Number(e.target.value))}
        />
        <span className="w-10 tabular-nums">{scalePct}%</span>
      </label>

      <label className="flex items-center gap-2">
        <span>回転</span>
        <select
          value={rotate}
          onChange={(e) => onRotateChange(Number(e.target.value))}
          className="rounded border border-gray-300 px-2 py-1"
        >
          <option value={0}>0°</option>
          <option value={90}>90°</option>
          <option value={180}>180°</option>
          <option value={270}>270°</option>
        </select>
      </label>
    </div>
  );
}
