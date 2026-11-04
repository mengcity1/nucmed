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

/** 背景结构变体（地址栏 `?bg=` 切换，默认 mesh）——四种"给玻璃可折射的结构"的极简做法。
 *  共同点：**全部无色相**（灰白），只靠明暗与微小纹理制造层次；底色仍是同一条中性纵向渐变。 */
export type BgVariant = "mesh" | "dots" | "grain" | "waves" | "none";

const BG_VARIANTS: BgVariant[] = ["mesh", "dots", "grain", "waves", "none"];

/** 背景壁纸：中性纵向渐变（共同底）+ 按变体叠结构。
 *  - mesh  ：多层超大柔光交织（云雾感，**无线条**，最不抢眼）
 *  - dots  ：极淡点阵（间距 22px、直径 2px、alpha .06）
 *  - grain ：细噪点（像纸张/毛玻璃底，无方向感）
 *  - waves ：极淡斜向宽光带（绸缎感，最"有质感"但最容易被看出"有条纹"）
 *  - none  ：只有渐变（最极简，但玻璃几乎看不出透明） */
function paintWallpaper(
  ctx: CanvasRenderingContext2D,
  { width: w, height: h }: { width: number; height: number },
  variant: BgVariant = "mesh"
) {
  // ① 共同底：中性纵向明暗
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

  if (variant === "mesh") {
    ctx.save();
    ctx.filter = `blur(${Math.max(24, Math.round(w * 0.03))}px)`;
    blob(0.16, 0.04, 0.62, "rgba(255,255,255,.75)");
    blob(0.86, 0.22, 0.55, "rgba(203,210,222,.34)");
    blob(0.52, 0.58, 0.6, "rgba(255,255,255,.55)");
    blob(0.1, 0.96, 0.5, "rgba(198,205,218,.3)");
    blob(0.94, 0.88, 0.45, "rgba(255,255,255,.6)");
    ctx.restore();
    return;
  }

  if (variant === "dots") {
    ctx.save();
    ctx.fillStyle = "rgba(15,23,42,.06)";
    const step = 22;
    for (let y = step / 2; y < h; y += step) {
      for (let x = step / 2; x < w; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    return;
  }

  if (variant === "grain") {
    // 细噪点：先画 96×96 随机噪点，再当 pattern 平铺（低 alpha ⇒ 只是一层"毛面"）
    const tile = document.createElement("canvas");
    tile.width = 96;
    tile.height = 96;
    const tctx = tile.getContext("2d");
    if (tctx) {
      const img = tctx.createImageData(96, 96);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 120 + Math.random() * 135; // 亮噪点为主，避免"脏"
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = 16;
      }
      tctx.putImageData(img, 0, 0);
      const pat = ctx.createPattern(tile, "repeat");
      if (pat) {
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, w, h);
      }
    }
    return;
  }

  if (variant === "waves") {
    // 极淡斜向宽光带（方向 45°，间距 110px，宽 46px，白色 alpha .5）
    ctx.save();
    ctx.lineWidth = 46;
    ctx.strokeStyle = "rgba(255,255,255,.5)";
    for (let i = -h; i < w + h; i += 110) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i - h, h);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  // none：只剩渐变
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
    // ?g=soft|mid|strong —— 玻璃强度；?bg=mesh|dots|grain|waves|none —— 背景结构（都只在浏览器地址栏生效）
    const qs = new URLSearchParams(window.location.search);
    const g = (qs.get("g") ?? "mid").toLowerCase();
    const bgRaw = (qs.get("bg") ?? "mesh").toLowerCase();
    const bg: BgVariant = (BG_VARIANTS as string[]).includes(bgRaw) ? (bgRaw as BgVariant) : "mesh";
    const material = MATERIALS[g] ?? MATERIALS.mid;
    const sys = createGlassSystem(el, {
      material,
      scene: "aurora",
      motion: !calm,
      audio: { enabled: false },
      artwork: (ctx, info) => paintWallpaper(ctx, info, bg),
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
