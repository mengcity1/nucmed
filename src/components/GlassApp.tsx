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
  base.addColorStop(0, "#f8e3d2");
  base.addColorStop(0.42, "#e3eaff");
  base.addColorStop(0.72, "#dcf4ea");
  base.addColorStop(1, "#f9e0ee");
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
  // v20.5：加深一档 —— 指针高光（着色器 glint）在浅底上几乎看不出来，只能靠背景有"色"来承接
  blob(0.05, 0.08, 0.5, "rgba(255,170,118,.62)"); // 暖橙
  blob(0.5, -0.05, 0.55, "rgba(132,164,255,.6)"); // 冷蓝
  blob(0.97, 0.18, 0.5, "rgba(110,224,200,.52)"); // 薄荷
  blob(0.22, 0.95, 0.5, "rgba(246,150,206,.5)"); // 藕粉
  blob(0.78, 0.88, 0.5, "rgba(150,186,255,.52)"); // 天蓝
  ctx.restore();
  ctx.fillStyle = "rgba(253,254,255,.02)";
  ctx.fillRect(0, 0, w, h);
}

/** 三档强度：地址栏加 `?g=soft|mid|strong` 即可在线切换（默认 mid）。
 *  用途：owner 现场挑档，不用每次都改代码重部署。 */
const MATERIALS: Record<string, Record<string, number>> = {
  soft: { refraction: 0.6, blur: 0.26, dispersion: 0.28 },
  mid: { refraction: 0.78, blur: 0.16, dispersion: 0.4 },
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
