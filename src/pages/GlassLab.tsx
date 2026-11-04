/**
 * /lab/glass —— 一次性对照页（**只为选型，选完即删**）
 *
 * 四个变体共用同一套 vendor 引擎（`createGlassSystem`），只改"玻璃背后那张画 + 材质"：
 *   A 现状：近白丝绸（alpha .16–.20）+ `refr .66 / blur .20 / disp .14` / brightness 1.02
 *   B 参考站内置场景（不传 artwork，用它自己的 aurora 绸带 + 默认 thick 材质）
 *   C 强色绸带（自绘 alpha .55）+ 默认厚玻璃
 *   D 强色绸带 + 大口径（`refr .92 / blur .10 / disp .45`）+ 60px 大圆角（pill 感）
 */
import { useEffect, useRef, type ReactNode } from "react";
import { createGlassSystem } from "../vendor/lens/runtime.js";
import "../vendor/lens/tokens.css";
import "../vendor/lens/components.css";

/** 强色绸带：模拟参考站那种"彩色薄片层层叠"的背景（高对比，玻璃才看得出弯折） */
function paintVivid(ctx: CanvasRenderingContext2D, { width, height }: { width: number; height: number }) {
  const g = ctx.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, "#bfe3dd");
  g.addColorStop(0.45, "#9db7dc");
  g.addColorStop(1, "#d3b4d2");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  const ribbon = (off: number, c1: string, c2: string) => {
    const p = new Path2D();
    p.moveTo(-width * 0.1, height * (0.98 + off));
    p.bezierCurveTo(width * 0.13, height * (0.39 + off), width * 0.48, height * (0.86 + off), width * 1.1, height * (-0.32 + off));
    p.lineTo(width * 1.15, height * 1.4);
    p.lineTo(-width * 0.1, height * 1.4);
    p.closePath();
    const lg = ctx.createLinearGradient(width * 0.05, height * 0.1, width * 0.87, height * 0.92);
    lg.addColorStop(0, c1);
    lg.addColorStop(0.48, c2);
    lg.addColorStop(1, "#eccbc1");
    ctx.save();
    ctx.shadowColor = "#38486830";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = -6;
    ctx.fillStyle = lg;
    ctx.fill(p);
    ctx.restore();
  };
  ribbon(-0.31, "#badde8", "#9db7dc");
  ribbon(-0.10, "#9db7dc", "#929ee0");
  ribbon(0.18, "#929ee0", "#d3b4d2");
  ribbon(0.44, "#d3b4d2", "#eccbc1");
}

type Variant = {
  key: string;
  title: string;
  note: string;
  scene?: "aurora";
  artwork?: (ctx: CanvasRenderingContext2D, info: { width: number; height: number; dpr: number }) => void;
  material?: Record<string, number>;
  brightness?: number;
  radius?: number;
};

const VARIANTS: Variant[] = [
  {
    key: "A",
    title: "A · 现状（近白极简）",
    note: "artwork alpha .16–.20 · refr .66 / blur .20 / disp .14 · brightness 1.02",
    artwork: (ctx, { width, height }) => {
      ctx.fillStyle = "#fcfdfe";
      ctx.fillRect(0, 0, width, height);
      const blob = (x: number, y: number, r: number, c: string) => {
        const rg = ctx.createRadialGradient(x * width, y * height, 0, x * width, y * height, r * width);
        rg.addColorStop(0, c);
        rg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, width, height);
      };
      blob(0.06, 0.34, 0.38, "rgba(255,203,170,.2)");
      blob(0.44, 0.0, 0.34, "rgba(191,203,255,.18)");
      blob(0.95, 0.58, 0.38, "rgba(172,232,219,.16)");
      ctx.strokeStyle = "rgba(120,140,175,.1)";
      ctx.lineWidth = Math.max(1, height * 0.03);
      for (let i = 0; i < 5; i++) {
        const y = (0.16 + i * 0.17) * height;
        ctx.beginPath();
        ctx.moveTo(-0.1 * width, y);
        ctx.bezierCurveTo(0.3 * width, y - height * 0.5, 0.62 * width, y + height * 0.45, 1.1 * width, y - height * 0.1);
        ctx.stroke();
      }
    },
    material: { refraction: 0.66, blur: 0.2, dispersion: 0.14 },
    brightness: 1.02,
    radius: 14,
  },
  {
    key: "B",
    title: "B · 参考站内置场景（aurora）",
    note: "不传 artwork（用它自己的绸带）· 默认 thick 材质",
    scene: "aurora",
    radius: 34,
  },
  {
    key: "C",
    title: "C · 强色绸带 + 厚玻璃",
    note: "自绘绸带（高对比）· refr .78 / blur .18 / disp .32",
    artwork: paintVivid,
    material: { refraction: 0.78, blur: 0.18, dispersion: 0.32 },
    radius: 34,
  },
  {
    key: "D",
    title: "D · 大口径（pill 感）",
    note: "自绘绸带 · refr .92 / blur .10 / disp .45 · 60px 大圆角",
    artwork: paintVivid,
    material: { refraction: 0.92, blur: 0.1, dispersion: 0.45 },
    radius: 60,
  },
];

function Stage({ v, children }: { v: Variant; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sys = createGlassSystem(el, {
      material: v.material ?? "thick",
      scene: "aurora",
      motion: false,
      audio: { enabled: false },
      artwork: v.artwork,
    });
    if (v.brightness) sys.renderer?.set({ brightness: v.brightness });
    return () => sys.destroy();
  }, [v]);
  return (
    <div ref={ref} className="lg-stage glass-stage" style={{ ["--lg-radius-panel" as string]: `${v.radius ?? 14}px` }}>
      {children}
    </div>
  );
}

export default function GlassLab() {
  return (
    <div className="pb-10">
      <h1 className="text-[20px] font-semibold">液态玻璃对照（选型用）</h1>
      <p className="mt-1 text-[12.5px] text-ink-3">
        四块面板都跑同一套 WebGL2 引擎（真折射 / 色散 / 弹簧），差别只在“玻璃背后那张画 + 材质”。
      </p>
      {VARIANTS.map((v) => (
        <section key={v.key} className="mt-7">
          <div className="text-[13px] font-medium">{v.title}</div>
          <div className="mt-1 text-[11.5px] text-ink-3">{v.note}</div>
          <Stage v={v}>
            <div
              data-glass="panel"
              className="lg-surface mt-2 flex items-center gap-6 p-6"
              style={{ borderRadius: `${v.radius ?? 14}px` }}
            >
              <div className="text-[13px]">
                <div className="label-caps">玻璃面板里的真实文字</div>
                <div className="num mt-1 text-[22px] font-semibold">5,159</div>
                <div className="mt-1 text-[11.5px] text-ink-3">数字仍是 DOM：可选中、可打印</div>
              </div>
              <div className="ml-auto text-[12px] text-ink-2">拖动/滚动时，边缘应能看到背景被弯折</div>
            </div>
          </Stage>
        </section>
      ))}
    </div>
  );
}
