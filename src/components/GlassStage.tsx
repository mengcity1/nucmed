/**
 * GlassStage —— 真折射液态玻璃舞台（2026-11-04 v18）
 *
 * 为什么不用纯 CSS：`backdrop-filter` 只能"模糊"，**折不了光**，所以质感永远是"毛玻璃"。
 * 这里 vendor 了 Lens（MIT · ruiqichenbiec/design-systems · WebGL2 · 零运行时依赖）：
 *   1) 它把 `artwork()` 自绘的 canvas 上传成**场景纹理**；
 *   2) 舞台内所有 `[data-glass]` 元素由片元着色器**真实采样并弯折**那张纹理（含边缘色散）；
 *   3) 文字仍是真 DOM —— `.webgl-ready .lg-surface` 只把**背景**置透明，故可读、可选中、可打印。
 *
 * 有意守住的边界：
 *   - 只包「装饰性外壳」（KPI 带、页头）；**数据表/图集保持纯白 `card-solid`**（读数与打印优先）；
 *   - ≤640px 或 WebGL2 不可用 ⇒ 走 CSS 毛玻璃回退（与 v16 一致），不在手机上跑 GPU；
 *   - `prefers-reduced-motion` 由它内部 `matchMedia` 处理；我们额外传 `motion:false` 保持静止；
 *   - 卸载时 `destroy()`，避免路由切换后残留 canvas / rAF。
 */
import { useEffect, useRef, type ReactNode } from "react";
import { createGlassSystem } from "../vendor/lens/runtime.js";
import "../vendor/lens/tokens.css";
import "../vendor/lens/components.css";

/** 舞台背景（= 会被玻璃真实折射的那张图）：近白底 + 极淡三色柔光 + 几道冷灰丝绸曲线。
 *  刻意做得**很淡**：v16 的取向是"透明极简"，玻璃的质感靠**边缘折射与色散**，
 *  而不是靠背景本身有颜色 —— 底色一浓就变成"彩色横幅"了。
 *  但仍需保留一点点结构（柔光 + 曲线），否则纯白背景折射出来什么也看不见。
 *  `strength` 用来分级：外壳（导航/KPI）= 1；内容区（成组卡片）= 0.5，避免整片染色。 */
function paintArtwork(
  ctx: CanvasRenderingContext2D,
  { width, height }: { width: number; height: number },
  strength = 1
) {
  const k = Math.max(0, Math.min(1, strength));
  const g = ctx.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, "#fcfdfe");
  g.addColorStop(0.52, "#fbfbfc");
  g.addColorStop(1, "#fafcfd");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  const blob = (x: number, y: number, r: number, color: string) => {
    const rg = ctx.createRadialGradient(x * width, y * height, 0, x * width, y * height, r * width);
    rg.addColorStop(0, color);
    rg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, width, height);
  };
  // 三团柔光：alpha 只到 .18 ~ .22（×strength）—— 是"玻璃透出的那点色温"，不是底色
  blob(0.06, 0.34, 0.38, `rgba(255,203,170,${(0.2 * k).toFixed(3)})`);
  blob(0.44, 0.0, 0.34, `rgba(191,203,255,${(0.18 * k).toFixed(3)})`);
  blob(0.95, 0.58, 0.38, `rgba(172,232,219,${(0.16 * k).toFixed(3)})`);

  // 丝绸曲线：用冷灰而非白色（白线在白底上等于没画），给折射一点可辨识的"边"
  ctx.lineCap = "round";
  for (let i = 0; i < 5; i++) {
    const y = (0.16 + i * 0.17) * height;
    ctx.strokeStyle = `rgba(120,140,175,${((0.1 - i * 0.014) * k).toFixed(3)})`;
    ctx.lineWidth = Math.max(1, height * 0.03);
    ctx.beginPath();
    ctx.moveTo(-0.1 * width, y);
    ctx.bezierCurveTo(0.3 * width, y - height * 0.5, 0.62 * width, y + height * 0.45, 1.1 * width, y - height * 0.1);
    ctx.stroke();
  }
}

export default function GlassStage({
  children,
  className = "",
  strength = 1,
}: {
  children: ReactNode;
  className?: string;
  /** 背景柔光强度：外壳 1（导航/KPI）· 内容卡组 0.5（避免整片染色） */
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

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
      material:
        strength >= 1
          ? { refraction: 0.72, blur: 0.18, dispersion: 0.28 }
          : { refraction: 0.66, blur: 0.2, dispersion: 0.14 },
      scene: "aurora",
      motion: !calm,
      audio: { enabled: false },
      artwork: (ctx, info) => paintArtwork(ctx, info, strength),
    });
    // 渲染器默认 `brightness:.95`（renderer.js:253）——小面板看不出，**大面积会变灰板**；
    // 内容区把亮度拉回中性，避免"玻璃=灰底"的观感事故。
    if (strength < 1) sys.renderer?.set({ brightness: 1.02 });
    return () => sys.destroy();
  }, []);

  return (
    <div ref={ref} className={`lg-stage glass-stage ${className}`}>
      {children}
    </div>
  );
}
