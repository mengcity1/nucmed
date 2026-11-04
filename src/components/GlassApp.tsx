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

/** 背景壁纸：**极简中性 + 可被玻璃模糊的结构**（v20.8）
 *  上一版（v20.7）纯中性灰白 ⇒ 玻璃背后没有任何细节 ⇒ 看起来就是"白卡片"，没有透明感。
 *  这一版仍保持单一中性色（不加彩色），但补两样"结构"：
 *   ① 从顶到底的**轻微明暗渐变**（#fcfdff → #eceff5）：玻璃面板在深浅交界处能看出透过关系；
 *   ② **极淡细网格**（28px、alpha .045）—— 在纸上是清晰的，透过玻璃被模糊/扭曲 ⇒ 一眼看出透明。
 *  ⇒ 既不花，又有透明感。 */
function paintWallpaper(ctx: CanvasRenderingContext2D, { width: w, height: h }: { width: number; height: number }) {
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, "#fdfeff");
  base.addColorStop(0.55, "#f4f6fa");
  base.addColorStop(1, "#e9edf4");
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
  ctx.filter = `blur(${Math.max(30, Math.round(w * 0.035))}px)`;
  blob(0.18, 0.02, 0.6, "rgba(255,255,255,.55)"); // 上方一团白光（提亮、出层次）
  blob(0.92, 0.95, 0.55, "rgba(196,204,218,.30)"); // 右下压一点冷灰
  ctx.restore();

  // 极淡细网格（**不过 blur**）：纸上清晰、玻璃后模糊 ⇒ 透明感的来源
  ctx.save();
  ctx.strokeStyle = "rgba(15,23,42,.075)";
  ctx.lineWidth = 1;
  const step = 28;
  for (let x = 0; x <= w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

/** 三档强度：地址栏加 `?g=soft|mid|strong` 即可在线切换（默认 mid）。
 *  用途：owner 现场挑档，不用每次都改代码重部署。 */
const MATERIALS: Record<string, Record<string, number>> = {
  soft: { refraction: 0.6, blur: 0.26, dispersion: 0.28 },
  mid: { refraction: 0.78, blur: 0.26, dispersion: 0.4 },
  strong: { refraction: 0.95, blur: 0.08, dispersion: 0.55 },
};

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
    // ?g=soft|mid|strong —— 只在浏览器地址栏生效，不写进构建
    const g = (new URLSearchParams(window.location.search).get("g") ?? "mid").toLowerCase();
    const material = MATERIALS[g] ?? MATERIALS.mid;
    const sys = createGlassSystem(el, {
      material,
      scene: "aurora",
      motion: !calm,
      audio: { enabled: false },
      artwork: paintWallpaper,
    });
    sys.renderer?.set({ brightness: 1.0 });

    // v20.5：**光标波纹**（CSS 层，独立于 WebGL）——
    // 着色器的 glint 也跟指针，但只在面板边缘看得出；这一层让每块玻璃上都能看到柔光斑随光标移动。
    let raf = 0;
    let px = 0;
    let py = 0;
    const paint = () => {
      raf = 0;
      // 每个面板写**自身坐标**（background-position 以元素自身为基准）
      el.querySelectorAll<HTMLElement>(".lg-surface").forEach((s) => {
        const r = s.getBoundingClientRect();
        s.style.setProperty("--mx", `${(px - r.left).toFixed(0)}px`);
        s.style.setProperty("--my", `${(py - r.top).toFixed(0)}px`);
      });
    };
    const onMove = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      if (!raf) raf = requestAnimationFrame(paint);
    };
    if (!calm) el.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
      sys.destroy();
    };
  }, []);

  return (
    <div ref={ref} className="lg-stage app-stage">
      <div className="app-scroll">{children}</div>
    </div>
  );
}
