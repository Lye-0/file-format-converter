"use client";

import { useEffect, useRef } from "react";

export function useLatest<T>(value: T): React.MutableRefObject<T> {
  const ref = useRef<T>(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
