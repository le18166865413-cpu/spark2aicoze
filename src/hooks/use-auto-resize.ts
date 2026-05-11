import { useEffect, useRef, useCallback } from "react";

export function useAutoResize<T extends HTMLTextAreaElement>(value: string) {
  const ref = useRef<T>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // Only enable on desktop (>= 768px)
    if (window.innerWidth < 768) {
      el.style.height = "";
      el.style.overflow = "";
      return;
    }
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    el.style.overflow = "hidden";
  }, []);

  useEffect(() => {
    resize();
  }, [value, resize]);

  useEffect(() => {
    const handleResize = () => resize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [resize]);

  return ref;
}
