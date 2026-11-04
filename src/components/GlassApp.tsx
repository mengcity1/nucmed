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

/** 背景壁纸：**整片柔和的浅色**（不是四角上色、中间发白），再整层糊掉。
 *  ① 先铺一条覆盖全幅的浅色斜向渐变（暖 → 冷 → 薄荷 → 藕），保证任何位置都有色；
 *  ② 再叠 5 团大半径柔光打散均匀；
 *  ③ 最后 `blur(≈4.5vw)` 抹平边界 + 7% 白纱压淡。
 *  ⇒ 观感 = 一整张浅色雾面，组件浮在上面；文字区仍近白，不影响对比度。 */
function paintWallpaper(ctx: CanvasRenderingContext2D, { width: w, height: h }: { width: number; height: number }) {
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, "#fdf6f2");
  base.addColorStop(0.42, "#f4f7ff");
  base.addColorStop(0.72, "#f3fbf8");
  base.addColorStop(1, "#fdf7fb");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  const blob = (x: number, y: number, r: number, c: string) => {
    const rg = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * Math.max(w, h));
    rg.addColorStop(0, c);
    rg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
  };
  ctx.save();
  ctx.filter = `blur(${Math.max(36, Math.round(w * 0.045))}px)`;
  blob(0.05, 0.08, 0.5, "rgba(255,204,176,.42)"); // 暖橙
  blob(0.5, -0.05, 0.55, "rgba(186,203,255,.4)"); // 冷蓝
  blob(0.97, 0.18, 0.5, "rgba(170,236,222,.38)"); // 薄荷
  blob(0.22, 0.95, 0.5, "rgba(240,196,228,.34)"); // 藕粉
  blob(0.78, 0.88, 0.5, "rgba(190,214,255,.36)"); // 天蓝
  ctx.restore();
  ctx.fillStyle = "rgba(253,254,255,.07)";
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
      material: { refraction: 0.78, blur: 0.16, dispersion: 0.40 },
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
