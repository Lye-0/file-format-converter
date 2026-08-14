"use client";

import { useRef, useState, useCallback, useEffect } from "react";

type SliderProps = {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;
  suffix?: string;
  id?: string;
};

export default function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  suffix = "",
  id,
}: SliderProps) {
  const [local, setLocal] = useState(value);
  const draggingRef = useRef(false);
  const lastReportedRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  // 外部から value が変わったとき、ドラッグ中でなければ追従
  useEffect(() => {
    if (!draggingRef.current) {
      setLocal(value);
      lastReportedRef.current = value;
    }
  }, [value]);

  const reportValue = useCallback(
    (next: number) => {
      if (next !== lastReportedRef.current) {
        lastReportedRef.current = next;
        onChange(next);
      }
    },
    [onChange],
  );

  const handleInput = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      const next = Number((e.target as HTMLInputElement).value);
      setLocal(next);
      // ドラッグ中は rAF で throttling
      if (draggingRef.current) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          reportValue(next);
        });
      } else {
        reportValue(next);
      }
    },
    [reportValue],
  );

  const handlePointerDown = useCallback(() => {
    draggingRef.current = true;
  }, []);

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    reportValue(local);
  }, [local, reportValue]);

  return (
    <div className="grid grid-cols-[4rem_1fr_3rem] items-center gap-2 text-sm text-gray-600">
      {label && (
        <label htmlFor={id} className="select-none">
          {label}
        </label>
      )}
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={local}
        onInput={handleInput}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="w-full"
      />
      <span className="text-right tabular-nums select-none">
        {local}
        {suffix}
      </span>
    </div>
  );
}
