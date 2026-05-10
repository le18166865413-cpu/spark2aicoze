"use client";

import { useEffect } from "react";

export function ConsoleFilter() {
  useEffect(() => {
    const shouldFilter = (args: unknown[]) => {
      const text = args
        .map((a) => (typeof a === "string" ? a : ""))
        .join(" ");
      return (
        text.includes("postMessage") && text.includes("code.coze.cn")
      );
    };

    const originalError = console.error;
    const originalWarn = console.warn;

    console.error = function (...args: unknown[]) {
      if (shouldFilter(args)) return;
      originalError.apply(this, args);
    };

    console.warn = function (...args: unknown[]) {
      if (shouldFilter(args)) return;
      originalWarn.apply(this, args);
    };

    return () => {
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  return null;
}
