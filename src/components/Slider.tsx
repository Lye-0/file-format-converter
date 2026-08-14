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
  children?: React.ReactNode;
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
  children,
}: SliderProps) {
  const [local, setLocal] = useState(value);
  const draggingRef = useRef(false);
  const lastReportedRef = useRef(value);
  const rafRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const updateSliderFill = useCallback((el: HTMLInputElement | null, val: number) => {
    if (!el) return;
    const pct = ((val - min) / (max - min)) * 100;
    el.style.setProperty("--fill", `${pct}%`);
  }, [min, max]);

  const handleInput = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      const next = Number((e.target as HTMLInputElement).value);
      setLocal(next);
      updateSliderFill(e.currentTarget, next);
      if (draggingRef.current) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          reportValue(next);
        });
      } else {
        reportValue(next);
      }
    },
    [reportValue, updateSliderFill],
  );

  const handlePointerDown = useCallback(() => {
    draggingRef.current = true;
  }, []);

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    reportValue(local);
  }, [local, reportValue]);

  useEffect(() => {
    updateSliderFill(inputRef.current, local);
  }, [local, updateSliderFill]);

  const displayValue = draggingRef.current ? local : value;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {label && (
          <label htmlFor={id} className="select-none text-sm text-gray-600">
            {label}
          </label>
        )}
        <span className="tabular-nums select-none text-sm font-medium text-gray-700">
          {displayValue}
          {suffix}
        </span>
      </div>

      <input
        ref={inputRef}
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
        className="slider mt-2 w-full"
      />

      {children}
    </div>
  );
}
