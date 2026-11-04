/**
 * GlassStage —— 真折射液态玻璃舞台（2026-11-04 v19 · "最大档"）
 *
 * 引擎 = vendor 的 Lens（MIT · WebGL2 · 零依赖）**原样迁移**；本文件只负责三件事：
 *   1) 给舞台画"玻璃背后那张画"（artwork）—— **这才是质感的来源**；
 *   2) 选材质（折射 / 雾化 / 色散）；
 *   3) 生命周期（≤640px 不建、卸载 destroy）。
 *
 * 为什么背景决定观感：着色器是把这张图**真的弯折**给人看。背景若近乎纯白，
 * 弯折纯白 = 视觉上什么都没发生（v18 的教训）。所以 v19 用高对比绸带。
 *
 * 三档背景（`variant`）：
 *   shell 外壳（导航 / KPI）：彩色绸带，玻璃把它弯成流动的光 —— 最接近参考站
 *   veil  内容卡（筛选卡 / About / 详情首屏）：绸带 + 62% 白纱 —— 有质感且文字高对比
 *   edge  数据表：四周彩色光带 + 中心压白 —— **中间是白纸（读数/打印），边缘是强折射**
 */
import { useEffect, useRef, type ReactNode } from "react";
import { createGlassSystem } from "../vendor/lens/runtime.js";
import "../vendor/lens/tokens.css";
import "../vendor/lens/components.css";

type Ctx2D = CanvasRenderingContext2D;
type Size = { width: number; height: number };

/** 彩色绸带：参考站那种"薄片层层叠"的高对比背景（玻璃弯折才看得见） */
function ribbons(ctx: Ctx2D, { width: w, height: h }: Size) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#c6e7e1");
  g.addColorStop(0.45, "#a3bce0");
  g.addColorStop(1, "#d8b9d6");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const sheet = (off: number, c1: string, c2: string) => {
    const p = new Path2D();
    p.moveTo(-w * 0.1, h * (0.98 + off));
    p.bezierCurveTo(w * 0.13, h * (0.39 + off), w * 0.48, h * (0.86 + off), w * 1.1, h * (-0.32 + off));
    p.lineTo(w * 1.15, h * 1.4);
    p.lineTo(-w * 0.1, h * 1.4);
    p.closePath();
    const lg = ctx.createLinearGradient(w * 0.05, h * 0.1, w * 0.87, h * 0.92);
    lg.addColorStop(0, c1);
    lg.addColorStop(0.48, c2);
    lg.addColorStop(1, "#f0d2c8");
    ctx.save();
    ctx.shadowColor = "#3a4a6a33";
    ctx.shadowBlur = Math.max(8, w * 0.02);
    ctx.shadowOffsetY = -Math.max(3, h * 0.02);
    ctx.fillStyle = lg;
    ctx.fill(p);
    ctx.restore();
  };
  sheet(-0.31, "#c2e6e0", "#a3bce0");
  sheet(-0.1, "#a3bce0", "#98a3e4");
  sheet(0.18, "#98a3e4", "#d8b9d6");
  sheet(0.44, "#d8b9d6", "#f0d2c8");
}

/** 白纱：压在绸带上，保证卡内文字对比度（≈磨砂玻璃） */
function veilOverlay(ctx: Ctx2D, { width: w, height: h }: Size) {
  ctx.fillStyle = "rgba(252,253,255,.62)";
  ctx.fillRect(0, 0, w, h);
}

/** 圆角矩形路径（不用 ctx.roundRect，兼容性更稳） */
function roundRectPath(ctx: Ctx2D, x0: number, y0: number, x1: number, y1: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x0 + r, y0);
  ctx.lineTo(x1 - r, y0);
  ctx.quadraticCurveTo(x1, y0, x1, y0 + r);
  ctx.lineTo(x1, y1 - r);
  ctx.quadraticCurveTo(x1, y1, x1 - r, y1);
  ctx.lineTo(x0 + r, y1);
  ctx.quadraticCurveTo(x0, y1, x0, y1 - r);
  ctx.lineTo(x0, y0 + r);
  ctx.quadraticCurveTo(x0, y0, x0 + r, y0);
  ctx.closePath();
}

/** 边光：四周彩色绸带 + **内缩的白色板**（模糊边）—— 表格中央是白纸，边缘一圈是玻璃 */
function edgeGlow(ctx: Ctx2D, { width: w, height: h }: Size) {
  ribbons(ctx, { width: w, height: h });
  const rim = Math.max(30, Math.min(w, h) * 0.1);
  const rr = Math.max(6, rim * 0.55);
  const x0 = rim;
  const y0 = rim;
  const x1 = w - rim;
  const y1 = h - rim;
  // 饱和色环：绸带调色偏淡，表格边框再压一圈饱和色 ⇒ 边缘折射才看得出"彩色玻璃"
  const ring = ctx.createLinearGradient(0, 0, w, h);
  ring.addColorStop(0, "#8ea9ec");
  ring.addColorStop(0.5, "#9fb0f2");
  ring.addColorStop(1, "#79d2c6");
  ctx.save();
  ctx.filter = `blur(${Math.max(5, rim * 0.42).toFixed(1)}px)`;
  ctx.strokeStyle = ring;
  ctx.lineWidth = rim * 1.05;
  roundRectPath(ctx, x0 * 0.62, y0 * 0.62, w - x0 * 0.62, h - y0 * 0.62, rr);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  // 白色内板：模糊边 ⇒ 与彩色光带自然过渡（不出现硬边）
  ctx.filter = `blur(${Math.max(6, rim * 0.38).toFixed(1)}px)`;
  ctx.fillStyle = "rgba(253,254,255,.97)";
  roundRectPath(ctx, x0, y0, x1, y1, rr);
  ctx.fill();
  ctx.restore();
  // 极淡丝绸线，给折射一点可读的"边"
  ctx.strokeStyle = "rgba(120,140,175,.08)";
  ctx.lineWidth = Math.max(1, h * 0.004);
  for (let i = 0; i < 4; i++) {
    const y = (0.2 + i * 0.2) * h;
    ctx.beginPath();
    ctx.moveTo(-0.1 * w, y);
    ctx.bezierCurveTo(0.3 * w, y - h * 0.16, 0.62 * w, y + h * 0.16, 1.1 * w, y - h * 0.05);
    ctx.stroke();
  }
}

export type GlassVariant = "shell" | "veil" | "edge";

const PRESET: Record<
  GlassVariant,
  { paint: (ctx: Ctx2D, size: Size) => void; material: Record<string, number>; brightness?: number; radius: number }
> = {
  // 外壳：彩绸不遮，玻璃把颜色弯成流动的光
  shell: { paint: ribbons, material: { refraction: 0.9, blur: 0.12, dispersion: 0.42 }, radius: 20 },
  // 内容：彩绸 + 白纱，文字仍高对比
  veil: {
    paint: (ctx, size) => {
      ribbons(ctx, size);
      veilOverlay(ctx, size);
    },
    material: { refraction: 0.84, blur: 0.16, dispersion: 0.34 },
    brightness: 1.02,
    radius: 14,
  },
  // 数据表：中间白纸 + 四边彩光
  edge: { paint: edgeGlow, material: { refraction: 0.9, blur: 0.14, dispersion: 0.4 }, brightness: 1.02, radius: 14 },
};

export default function GlassStage({
  children,
  className = "",
  variant = "shell",
  radius,
}: {
  children: ReactNode;
  className?: string;
  variant?: GlassVariant;
  /** 覆盖圆角（px）。渲染器按元素的 computed border-radius 决定透镜半径 ⇒ 圆角越大、弯折带越宽 */
  radius?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const preset = PRESET[variant];
  const r = radius ?? preset.radius;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // ① ≤640px：**不建系统**（手机不跑 GPU），挂 `.fallback` 走 CSS 毛玻璃；
    // ② 减少动效：**照建**，但 `motion:false` 只渲染静态帧（它内部还会监听媒体查询变化）。
    const narrow = window.matchMedia("(max-width: 640px)").matches;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (narrow) {
      el.classList.add("fallback");
      return;
    }
    const sys = createGlassSystem(el, {
      material: preset.material,
      scene: "aurora",
      motion: !calm,
      audio: { enabled: false },
      artwork: (ctx, info) => preset.paint(ctx, info),
    });
    if (preset.brightness) sys.renderer?.set({ brightness: preset.brightness });
    return () => sys.destroy();
  }, [preset]);

  return (
    <div
      ref={ref}
      className={`lg-stage glass-stage glass-${variant} ${className}`}
      style={{ ["--glass-r" as string]: `${r}px` }}
    >
      {children}
    </div>
  );
}
