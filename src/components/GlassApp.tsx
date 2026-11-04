/**
 * GlassApp —— 全站唯一的玻璃舞台（2026-11-04 v20 · "一体背景 + 组件浮起"）
 *
 * 架构（这是 owner 要的形态）：
 *   ┌ .lg-stage（固定、铺满视口）── 一张 canvas = **唯一的背景**（淡 + 虚化）
 *   │   └ .app-scroll（页内滚动容器）── 导航 / 内容 / 页脚都在里面
 *   └ 所有 `[data-glass]` 组件（导航条、KPI、卡组、数据表、chip/按钮）
 *     由同一个片元着色器**真实采样并弯折**那张背景 ⇒ 液态玻璃；文字仍是真 DOM。
 *
 * 为什么必须"页内滚动"：Lens 的玻璃只能采样**同一舞台内**的画布（renderer.js:
 * `stage.querySelectorAll('[data-glass]')` + canvas 尺寸 = 舞台面积×dpr）。
 * 若让每个区块各建一个舞台 ⇒ 背景变成一张张拼接的色块（v19 的问题），且 canvas 面积×N。
 * 一个舞台 + 一个滚动容器 ⇒ **背景一体、只有一个 GL 上下文**，代价是页面滚动改由
 * `.app-scroll` 承载（sticky/锚点/IntersectionObserver 均照常；`window.scrollY` 已无使用处）。
 */
import { useEffect, useRef, type ReactNode } from "react";
import { createGlassSystem } from "../vendor/lens/runtime.js";
import "../vendor/lens/tokens.css";
import "../vendor/lens/components.css";

/** 背景壁纸：近白底 + 大半径柔和色斑，**整层再被 blur 糊掉**（"淡一点、虚化一点"） */
function paintWallpaper(ctx: CanvasRenderingContext2D, { width: w, height: h }: { width: number; height: number }) {
  ctx.fillStyle = "#fbfcfe";
  ctx.fillRect(0, 0, w, h);
  const blob = (x: number, y: number, r: number, c: string) => {
    const rg = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * Math.max(w, h));
    rg.addColorStop(0, c);
    rg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
  };
  ctx.save();
  // 虚化：整组色斑一次性糊掉（够大才有"雾"的感觉，不是色块）
  ctx.filter = `blur(${Math.max(40, Math.round(w * 0.05))}px)`;
  blob(0.12, 0.04, 0.55, "rgba(255,206,176,.78)"); // 暖橙
  blob(0.88, 0.08, 0.5, "rgba(176,196,255,.78)"); // 淡紫蓝
  blob(0.56, 0.82, 0.6, "rgba(160,232,220,.66)"); // 薄荷
  blob(0.02, 0.88, 0.45, "rgba(238,196,232,.58)"); // 藕粉
  ctx.restore();
  // 再压一层白纱：整体更淡（不做"彩带"，只做"雾"）
  ctx.fillStyle = "rgba(252,253,255,.08)";
  ctx.fillRect(0, 0, w, h);
}

export default function GlassApp({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const narrow = window.matchMedia("(max-width: 900px)").matches;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (narrow) {
      el.classList.add("fallback");
      return;
    }
    const sys = createGlassSystem(el, {
      // 背景是虚化的雾 ⇒ 玻璃要"宽而柔"：折射带大、雾化高、只留少量色散
      material: { refraction: 0.70, blur: 0.12, dispersion: 0.38 },
      scene: "aurora",
      motion: !calm,
      audio: { enabled: false },
      artwork: paintWallpaper,
    });
    sys.renderer?.set({ brightness: 1.0 });
    return () => sys.destroy();
  }, []);

  return (
    <div ref={ref} className="lg-stage app-stage">
      <div className="app-scroll">{children}</div>
    </div>
  );
}
