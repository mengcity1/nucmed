import { useEffect, useRef, useState } from "react";
import { fmt } from "../lib/data";
import { useT } from "../lib/i18n";

/** 图注折叠/展开（2026-11-05 · 全站**唯一**实现）
 *
 *  背景：图集卡片与单药画像「文献影像」Tab 都用硬裁剪（前者 `-webkit-line-clamp:3`、
 *  后者 `max-h-10`），而 `figs/manifest.json` 的图注中位 **400 字**、>300 字占 1,347/2,011
 *  ⇒ 绝大多数卡片都断在半句上，且**点了也没有任何入口**能把话看完。
 *
 *  做法：默认 n 行 + 「展开全文（N 字）」/「收起」；按钮**只在真溢出时出现** —— 用
 *  `ResizeObserver` 量 `scrollHeight - clientHeight`，不用字数阈值（卡片宽度随 1/2/3 列断点变，
 *  同一段字在不同宽度下行数不同）。导出层在 **400 字符**处截断的条目（856/2,011），展开后
 *  补一句说明，免得被当成"前端又没显示全"；>400 字的那部分是完整文本，不提示。
 *
 *  ⚠ 不要再在页面里另写一份 clamp —— 两份口径迟早不一致（本项目 §二.6 同理）。 */
export function Caption({
  text,
  lines = 3,
  className = "text-[11.5px] leading-relaxed text-ink-3",
}: {
  text: string;
  lines?: number;
  className?: string;
}) {
  const tr = useT();
  const ref = useRef<HTMLParagraphElement>(null);
  const [over, setOver] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const measure = () => setOver(el.scrollHeight - el.clientHeight > 2);
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [open, text, lines]);

  return (
    <>
      <p
        ref={ref}
        className={className}
        style={
          open
            ? undefined
            : { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" }
        }
        title={open ? undefined : text}
      >
        {text}
      </p>
      {over && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="mt-1 rounded text-[11.5px] font-medium text-brand-deep transition hover:underline"
        >
          {open ? tr("common.captionLess") : tr("common.captionMore", { n: fmt(text.length) })}
        </button>
      )}
      {open && text.length === 400 && (
        <p className="mt-0.5 text-[11px] leading-relaxed text-ink-3">{tr("common.captionTruncated")}</p>
      )}
    </>
  );
}
