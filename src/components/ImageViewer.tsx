import { useEffect, useRef, useState } from "react";
import { useT } from "../lib/i18n";

/** 图片查看器（2026-11-03 新增）：缩放（滚轮 / 按钮 / 双击）、拖动平移、Esc 关闭，并显示原图像素尺寸。
 *
 *  为什么加：实测 `public/figs` 1,739 个文件里 **96%（1,670 张）宽度 < 800 px**、中位 741 px，
 *  `public/parts` 全是 420×300 —— 旧弹层只把图按原尺寸居中显示，用户点开依然看不清。
 *  注意：放大**不会**凭空提升清晰度（源图像素是上限），所以这里同时显示「原图 W × H」，
 *  并在 ≥3× 时用 `pixelated` 避免插值发虚；要看真正的原图请走 footer 里给的 PMC 链接。 */
export default function ImageViewer({
  src,
  alt = "",
  onClose,
  footer,
}: {
  src: string;
  alt?: string;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const tr = useT();

  const clamp = (v: number) => Math.min(6, Math.max(1, Math.round(v * 10) / 10));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "+" || e.key === "=") setScale((v) => clamp(v + 0.5));
      else if (e.key === "-") setScale((v) => clamp(v - 0.5));
      else if (e.key === "0") {
        setScale(1);
        setPos({ x: 0, y: 0 });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  /** 滚轮缩放必须用原生监听 + passive:false，React 的 onWheel 无法 preventDefault */
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale((v) => clamp(v + (e.deltaY < 0 ? 0.4 : -0.4)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || "图片查看"}
      className="fixed inset-0 z-[100] flex flex-col bg-black/88 backdrop-blur-sm"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/15 bg-black/40 px-3 py-2.5 text-white">
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{alt}</span>
        {nat && (
          <span className="num text-[12.5px] text-white/75">
            {tr("atlas.origSize", { w: nat.w, h: nat.h })}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setScale((v) => clamp(v - 0.5))}
            aria-label="Zoom out"
            className="grid h-10 w-10 place-items-center rounded-lg border border-white/30 text-[18px] leading-none transition hover:bg-white/15 active:bg-white/25"
          >
            −
          </button>
          <span className="num w-16 text-center text-[14px] font-semibold">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setScale((v) => clamp(v + 0.5))}
            aria-label="Zoom in"
            className="grid h-10 w-10 place-items-center rounded-lg border border-white/30 text-[18px] leading-none transition hover:bg-white/15 active:bg-white/25"
          >
            ＋
          </button>
          <button
            type="button"
            onClick={() => {
              setScale(1);
              setPos({ x: 0, y: 0 });
            }}
            className="rounded-lg border border-white/30 px-3 py-2 text-[13px] font-medium transition hover:bg-white/15 active:bg-white/25"
          >
            {tr("atlas.reset")}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close (Esc)"
            className="rounded-lg border border-white/30 px-3 py-2 text-[13px] font-medium transition hover:bg-white/15 active:bg-white/25"
          >
            {tr("atlas.close")}
          </button>
        </span>
      </div>

      <div
        ref={boxRef}
        className="relative flex flex-1 items-center justify-center overflow-hidden touch-none"
        onPointerDown={(e) => {
          dragRef.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = dragRef.current;
          if (!d) return;
          setPos({ x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) });
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        onDoubleClick={() => setScale((v) => (v > 1 ? 1 : 2.5))}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            imageRendering: scale >= 3 ? "pixelated" : "auto",
          }}
          className="max-h-full max-w-full cursor-grab select-none active:cursor-grabbing"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-white/15 bg-black/40 px-3 py-2.5 text-[13px] leading-relaxed text-white/85">
        <span>{tr("atlas.viewerHint")}</span>
        {nat && nat.w < 800 && (
          <span className="rounded bg-amber-400/20 px-2 py-0.5 text-[12.5px] font-medium text-amber-100">
            {tr("atlas.narrow", { w: nat.w })}
          </span>
        )}
        {footer && <span className="ml-auto max-w-full">{footer}</span>}
      </div>
    </div>
  );
}
