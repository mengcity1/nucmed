import { useEffect, useRef, useState } from "react";

/** 数字滚动（2026-11-04 动效批次）：把上一次的值补间到新值（默认 600ms，easeOutCubic）。
 *  ★ 首帧从 0 起跳，所以「数据加载完成」会自然产生一次计数动画；
 *  ★ `prefers-reduced-motion: reduce` 或非有限值时直接给终值（可访问性硬约束）。 */
export function useCountUp(target: number, duration = 600): number {
  const [val, setVal] = useState(() => (Number.isFinite(target) ? 0 : target));
  const fromRef = useRef(0);

  useEffect(() => {
    if (!Number.isFinite(target)) {
      setVal(target);
      return;
    }
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      fromRef.current = target;
      setVal(target);
      return;
    }
    const from = fromRef.current;
    if (from === target) {
      setVal(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return val;
}