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
import { useTheme } from "../lib/theme";
import { runContrastAudit } from "../lib/contrastAudit";
import { createGlassSystem } from "../vendor/lens/runtime.js";
import "../vendor/lens/tokens.css";
import "../vendor/lens/components.css";

/** 背景结构变体（地址栏 `?bg=` 切换，默认 mesh）——四种"给玻璃可折射的结构"的极简做法。
 *  共同点：**全部无色相**（灰白），只靠明暗与微小纹理制造层次；底色仍是同一条中性纵向渐变。 */
export type BgVariant = "mesh" | "dots" | "grain" | "waves" | "none" | "dark" | "cream" | "platinum";

const BG_VARIANTS: BgVariant[] = ["mesh", "dots", "grain", "waves", "none", "dark", "cream", "platinum"];

/** 背景壁纸：中性纵向渐变（共同底）+ 按变体叠结构。
 *  - mesh  ：多层超大柔光交织（云雾感，**无线条**，最不抢眼）
 *  - dots  ：极淡点阵（间距 22px、直径 2px、alpha .06）
 *  - grain ：细噪点（像纸张/毛玻璃底，无方向感）
 *  - waves ：极淡斜向宽光带（绸缎感，最"有质感"但最容易被看出"有条纹"）
 *  - none  ：只有渐变（最极简，但玻璃几乎看不出透明） */
export function paintWallpaper(
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

  if (variant === "dark") {
    // v30（owner）：底再加深一点 + 带一点**蓝紫**（不是中性灰了）；
    // 配方仍是参考图那套：深底 + 极淡冷光 + 玻璃白 13%/blur16/白 19% 描边。
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#15161f");
    g.addColorStop(0.5, "#191a28");
    g.addColorStop(1, "#101118");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.filter = `blur(${Math.max(34, Math.round(w * 0.045))}px)`;
    // 蓝紫微光：主光偏蓝紫，中心稍亮；右下角一点紫，避免整片发灰
    blob(0.52, 0.42, 0.58, "rgba(110,130,255,.22)");
    blob(0.5, 0.45, 0.24, "rgba(196,204,255,.16)");
    blob(0.14, 0.05, 0.5, "rgba(255,255,255,.04)");
    blob(0.88, 0.92, 0.55, "rgba(124,92,200,.16)");
    ctx.restore();
    return;
  }

  if (variant === "platinum") {
    // 亮铂金 · 金属版（2026-11-04 v35）：① 更硬的明暗过渡 ② 115° 多段金属亮带 ③ 细拉丝纹理（各向异性）
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#f7f5ef");
    g.addColorStop(0.5, "#eae5db");
    g.addColorStop(1, "#f9f7f2");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // ② 金属亮带：亮 → 半亮 → 微暗 → 次亮 → 边缘暗（拉丝金属的宏观反射）
    const sheen = ctx.createLinearGradient(0, 0, w * 0.95, h);
    sheen.addColorStop(0.0, "rgba(255,255,255,.62)");
    sheen.addColorStop(0.3, "rgba(255,255,255,.18)");
    sheen.addColorStop(0.46, "rgba(150,146,136,.07)");
    sheen.addColorStop(0.66, "rgba(255,255,255,.10)");
    sheen.addColorStop(1.0, "rgba(120,118,110,.10)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, w, h);

    // ③ 细拉丝纹理：沿 115° 的 1px 线，亮/暗交替，alpha 1–5%（各向异性 = 金属的关键）
    const step = Math.max(2, Math.round(w / 520));
    for (let i = -h; i < w + h; i += step) {
      const a = 0.012 + Math.random() * 0.03;
      ctx.strokeStyle =
        (i / step) % 3 === 0 ? `rgba(255,255,255,${(a * 1.7).toFixed(3)})` : `rgba(120,116,108,${a.toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i - h, h);
      ctx.stroke();
    }

    // ④ 中心柔光压弱（金属是有方向性的，柔光太强会变"塑料"）
    ctx.save();
    ctx.filter = `blur(${Math.max(26, Math.round(w * 0.035))}px)`;
    blob(0.45, 0.32, 0.55, "rgba(255,255,255,.35)");
    blob(0.9, 0.95, 0.5, "rgba(150,148,140,.22)");
    ctx.restore();
    return;
  }

  if (variant === "cream") {
    // 浅色模式：米白（暖白纸张感）
    // 浅色模式：**米白**（暖白纸张感），不加任何彩度
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#fdfaf3");
    g.addColorStop(0.55, "#f7f1e3");
    g.addColorStop(1, "#f3ecdb");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.filter = `blur(${Math.max(30, Math.round(w * 0.04))}px)`;
    // v29：按深色参考图的配方做"正向版"——中心一团柔光（对应蓝微光）+ 四角极淡明暗
    blob(0.5, 0.42, 0.58, "rgba(255,255,255,.55)");
    blob(0.52, 0.46, 0.26, "rgba(255,253,244,.6)");
    blob(0.16, 0.06, 0.55, "rgba(255,255,255,.4)");
    blob(0.86, 0.9, 0.55, "rgba(226,214,186,.3)");
    ctx.restore();
    // 纸面微颗粒（v24）：米白底太平，加一层很淡的噪点当"纸纹"，玻璃压上去更有质感
    const tile = document.createElement("canvas");
    tile.width = 96;
    tile.height = 96;
    const tctx = tile.getContext("2d");
    if (tctx) {
      const img = tctx.createImageData(96, 96);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 150 + Math.random() * 105;
        img.data[i] = v;
        img.data[i + 1] = v * 0.99;
        img.data[i + 2] = v * 0.96;
        img.data[i + 3] = 12;
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
  const [theme] = useTheme();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const narrow = window.matchMedia("(max-width: 900px)").matches;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ── 主题与材质（地址栏可覆盖：?bg=mesh|dots|grain|waves|none|dark · ?g=soft|mid|strong）──
    //    2026-11-04 **实装**：默认 = 深色（owner 定）；浅色方案仍可 `?bg=mesh` 等切回。
    const qs = new URLSearchParams(window.location.search);
    const g = (qs.get("g") ?? "mid").toLowerCase();
    const bgRaw = (qs.get("bg") ?? (theme === "light" ? "platinum" : "dark")).toLowerCase();
    const bg: BgVariant = (BG_VARIANTS as string[]).includes(bgRaw)
      ? (bgRaw as BgVariant)
      : theme === "light"
        ? "platinum"
        : "dark";
    // ★ `.dark` 必须**在**窄屏早退之前加上：手机端不建 WebGL，靠 CSS 深色令牌渲染；
    //   若放在后面，手机就会退回"浅底 + 浅字"（不可读）。
    el.classList.toggle("dark", bg === "dark");
    el.classList.toggle("light", bg === "cream" || bg === "platinum");
    el.classList.toggle("platinum", bg === "platinum");

    // 浅色模式"跟随光标的光泽"配色（`?glow=cool|cyan|champagne|violet|blue|mono`，默认 cool）
    // 说明：米白偏暖 ⇒ 光泽越"无色"越像真玻璃；带色只是为了气质，不是必须。
    const GLOWS: Record<string, [string, string, string, string]> = {
      cool: ["rgba(226,236,246,.30)", "rgba(226,236,246,.07)", "rgba(226,236,246,.32)", "rgba(232,242,250,.40)"],
      cyan: ["rgba(198,240,234,.30)", "rgba(198,240,234,.07)", "rgba(198,240,234,.32)", "rgba(190,236,228,.40)"],
      champagne: ["rgba(255,246,224,.34)", "rgba(255,246,224,.08)", "rgba(255,246,224,.36)", "rgba(255,248,230,.44)"],
      violet: ["rgba(226,214,255,.30)", "rgba(226,214,255,.07)", "rgba(226,214,255,.32)", "rgba(232,222,255,.40)"],
      blue: ["rgba(206,224,255,.22)", "rgba(206,224,255,.05)", "rgba(206,224,255,.24)", "rgba(186,212,255,.32)"],
      mono: ["rgba(255,255,255,.30)", "rgba(255,255,255,.08)", "rgba(255,255,255,.32)", "rgba(255,255,255,.42)"],
    };
    const glowPreset = GLOWS[(qs.get("glow") ?? "cool").toLowerCase()] ?? GLOWS.cool;
    el.style.setProperty("--glow-a", glowPreset[0]);
    el.style.setProperty("--glow-b", glowPreset[1]);
    el.style.setProperty("--glow-c", glowPreset[2]);
    el.style.setProperty("--glow-d", glowPreset[3]);

    if (narrow) {
      el.classList.add("fallback");
      return;
    }
    const material = MATERIALS[g] ?? MATERIALS.mid;
    const sys = createGlassSystem(el, {
      material,
      scene: "aurora",
      motion: !calm,
      audio: { enabled: false },
      artwork: (ctx, info) => paintWallpaper(ctx, info, bg),
    });
    sys.renderer?.set({ brightness: 1.0 });
    // v37（2026-11-04 owner：「我只要拖到底了没框就行」）——
    // **画布从此不画面板玻璃**：`renderer.js:488` 的 `if(!settings.opaque)` 整段跳过透镜 pass，
    // 画布只剩背景壁纸。原因：canvas 的框要主线程重读矩形再画，而滚动在合成器线程 ⇒
    // 二者永远差 1–2 帧（拖动时框拖在原地、停下来又"追上去"= 一闪一闪）。
    // 面板玻璃改由 CSS `backdrop-filter` 承担（与滚动同在合成器层 ⇒ 天然同步），
    // 从此**不存在任何"留在原地"的框**，也不需要按滚动来回切换（那正是闪的来源）。
    sys.renderer?.set({ opaque: true });

    // v20.5：**光标波纹**（CSS 层，独立于 WebGL）——
    // 着色器的 glint 也跟指针，但只在面板边缘看得出；这一层让每块玻璃上都能看到柔光斑随光标移动。
    let raf = 0;
    let px = 0;
    let py = 0;
    const paint = () => {
      raf = 0;
      // 每个面板写**自身坐标**（background-position 以元素自身为基准）
      // v31：玻璃面板 + **按钮/chip/tab** 都吃这个光斑（按钮的镜面高光跟着指针走）
      el.querySelectorAll<HTMLElement>('.lg-surface, button, [role="tab"], a[class*="rounded"], .chip, .chip-sm').forEach((s) => {
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

    // ?contrast=1：对比度自检（结果写进 DOM，便于无头浏览器读取）
    if (qs.get("contrast") === "1") {
      runContrastAudit();
      window.setTimeout(runContrastAudit, 2500);
    }
    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
      sys.destroy();
    };
  }, [theme]);

  return (
    <div ref={ref} className="lg-stage app-stage">
      <div className="app-scroll">{children}</div>
    </div>
  );
}
