import { useEffect, useRef, useState } from "react";

/** 进入渐显（2026-11-04 动效批次）：元素首次进入视口时，240ms 内从 8px 下方淡入。
 *  ★ 用 IntersectionObserver，不劫持滚动、不监听 scroll（60fps 友好）；
 *  ★ 只动 opacity/transform；reduced-motion 或环境不支持 observer ⇒ 直接显示，绝不把内容藏起来。 */
export default function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  /** 交错延迟（ms），同一屏多个区块建议 0 / 40 / 80 */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!el || reduce || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.04 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : "translateY(8px)",
        transition: `opacity 240ms cubic-bezier(.22,.61,.36,1) ${delay}ms, transform 240ms cubic-bezier(.22,.61,.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}