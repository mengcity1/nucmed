/**
 * /lab/bg —— 背景结构 5 款对照页（临时，选完删除）
 * 每一条都是独立舞台：同一张中性底 + 不同结构，上面浮同一块玻璃面板与一个玻璃按钮，
 * 目的是让 owner 一眼比出"哪个结构下玻璃看起来最像玻璃、又不花"。
 */
import { useEffect, useRef } from "react";
import { createGlassSystem } from "../vendor/lens/runtime.js";
import "../vendor/lens/tokens.css";
import "../vendor/lens/components.css";
import { paintWallpaper, type BgVariant } from "../components/GlassApp";

const LIST: { k: BgVariant; label: string; note: string }[] = [
  { k: "mesh", label: "① mesh（当前默认）", note: "多层超大柔光交织 · 无线条 · 最干净但透明感最弱" },
  { k: "dots", label: "② dots", note: "22px 点阵 · 秩序感 · 透过玻璃会糊掉" },
  { k: "grain", label: "③ grain", note: "细噪点 · 像纸/毛玻璃底 · 透明感最自然" },
  { k: "waves", label: "④ waves", note: "45° 白色宽光带 · 绸缎感 · 可能显条纹" },
  { k: "none", label: "⑤ none", note: "只有中性渐变 · 最极简 · 玻璃几乎看不出透明" },
  { k: "dark", label: "⑥ dark（深色渐变）", note: "深底 + 冷蓝/青/紫柔光 · 文字与表格整体翻深色 · **玻璃折射在深底上最明显**" },
];

function Strip({ k, label, note }: { k: BgVariant; label: string; note: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sys = createGlassSystem(el, {
      material: { refraction: 0.78, blur: 0.26, dispersion: 0.4 },
      scene: "aurora",
      motion: false,
      audio: { enabled: false },
      artwork: (ctx, info) => paintWallpaper(ctx, info, k),
    });
    sys.renderer?.set({ brightness: 1.0 });
    return () => sys.destroy();
  }, [k]);

  return (
    <section className="mt-7">
      <div className="text-[13px] font-medium">
        {label} <span className="font-normal text-ink-3">— {note}</span>
      </div>
      <div ref={ref} className={`lg-stage app-stage lab-stage ${k === "dark" ? "dark" : ""} mt-2`}>
        <div className="flex h-full items-center gap-5 px-6">
          <div data-glass="panel" className="lg-surface p-4" style={{ borderRadius: 18 }}>
            <div className="label-caps">玻璃面板</div>
            <div className="num mt-1 text-[22px] font-semibold text-[#12457f]">5,159</div>
            <div className="text-[11.5px] text-ink-3">文字仍是 DOM</div>
          </div>
          <button type="button" className="px-4 py-2 text-[13px] text-ink-2">
            玻璃按钮
          </button>
          <div className="ml-auto text-[12px] text-ink-3">把鼠标在这条上移动，看光斑</div>
        </div>
      </div>
    </section>
  );
}

export default function GlassBgLab() {
  return (
    <div className="pb-12">
      <h1 className="text-[22px] font-bold tracking-tight">背景结构对照（5 款）</h1>
      <p className="mt-1.5 text-[13px] text-ink-3">
        全部同一张中性底（无彩色），只改"结构"；每条的玻璃材质与按钮完全一致。选定后我把默认改成它。
      </p>
      {LIST.map((v) => (
        <Strip key={v.k} {...v} />
      ))}
    </div>
  );
}
