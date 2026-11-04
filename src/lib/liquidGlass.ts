import { useEffect } from "react";

/** 液态玻璃（2026-11-04 v15）—— 真折射，不是"模糊 + 白边"
 *
 *  原理（与 shuding/liquid-glass 同源，MIT）：
 *    ① 运行时用 canvas 生成一张**位移图**：按圆角矩形的 SDF 计算"距离边缘越近、位移越大"，
 *       把 dx / dy 编码进 R / G 通道（feDisplacementMap 约定）；
 *    ② 建一个隐藏的 SVG <filter>：feImage(位移图) + feDisplacementMap(scale=2·strength)；
 *    ③ 元素上写 `backdrop-filter: url(#filter) blur() saturate()` ⇒ **背景在该元素边缘被真实弯曲**。
 *
 *  ★ 浏览器支持：只有 Chromium 支持 `backdrop-filter: url()`。
 *    Safari / Firefox 走 CSS 玻璃兜底（本函数检测失败就直接 return，不改任何样式）。
 *  ★ 成本：位移图只在挂载与尺寸变化时生成（导航 ~70k 像素，毫秒级），滚动时零开销。
 */

const smoothstep = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

/** 仅 Chromium 且支持 backdrop-filter url() 时启用 */
export function liquidGlassSupported(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const isChromium = /Chrome\/|Chromium\/|Edg\//.test(ua) && !/Firefox\//.test(ua);
  const hasBackdrop =
    "backdropFilter" in document.documentElement.style ||
    "-webkit-backdrop-filter" in document.documentElement.style;
  /* 小屏不做折射：位移图生成 + 大面积 backdrop 采样在低端机上很贵（与 CSS 降级策略一致） */
  const bigEnough = !window.matchMedia?.("(max-width: 640px)").matches;
  return isChromium && hasBackdrop && bigEnough;
}

/** 生成位移图（data URL）+ 返回建议的 feDisplacementMap scale */
function buildMap(w: number, h: number, radius: number, strength: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(w, h);
  const data = img.data;

  const halfW = w / 2;
  const halfH = h / 2;
  const r = Math.max(0, Math.min(radius, Math.min(halfW, halfH)));
  const band = Math.max(12, Math.min(30, h * 0.5)); // 边缘影响带宽度
  const maxDisp = Math.max(2, strength);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - halfW;
      const py = y + 0.5 - halfH;
      // 圆角矩形 SDF（<0 在内部）
      const qx = Math.abs(px) - (halfW - r);
      const qy = Math.abs(py) - (halfH - r);
      const out = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
      const sdf = Math.min(Math.max(qx, qy), 0) + out - r;
      // 只在靠近边缘的一圈产生位移
      const k = 1 - smoothstep(0, band, -sdf);
      const len = Math.max(1e-4, Math.hypot(px, py));
      const dx = (px / len) * k * maxDisp;
      const dy = (py / len) * k * maxDisp;

      const i = (y * w + x) * 4;
      data[i] = Math.round((dx / maxDisp) * 127.5 + 127.5);
      data[i + 1] = Math.round((dy / maxDisp) * 127.5 + 127.5);
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { href: canvas.toDataURL(), scale: maxDisp * 2 };
}

let seq = 0;

/** 给一个元素装上液态玻璃；返回清理函数 */
function attach(el: HTMLElement, opts: { radius: number; strength: number; tint?: string }): () => void {
  const id = `lg-${++seq}`;
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;pointer-events:none";

  const filter = document.createElementNS(svgNS, "filter");
  filter.setAttribute("id", id);
  filter.setAttribute("filterUnits", "userSpaceOnUse");
  filter.setAttribute("color-interpolation-filters", "sRGB");
  const feImage = document.createElementNS(svgNS, "feImage");
  const feDisp = document.createElementNS(svgNS, "feDisplacementMap");
  feDisp.setAttribute("in", "SourceGraphic");
  feDisp.setAttribute("in2", `lgm-${seq}`);
  feDisp.setAttribute("xChannelSelector", "R");
  feDisp.setAttribute("yChannelSelector", "G");
  feImage.setAttribute("id", `lgm-${seq}`);
  filter.appendChild(feImage);
  filter.appendChild(feDisp);
  const defs = document.createElementNS(svgNS, "defs");
  defs.appendChild(filter);
  svg.appendChild(defs);
  document.body.appendChild(svg);

  const paint = () => {
    const w = el.clientWidth | 0;
    const h = el.clientHeight | 0;
    if (!w || !h) return;
    const map = buildMap(w, h, opts.radius, opts.strength);
    if (!map) return;
    filter.setAttribute("x", "0");
    filter.setAttribute("y", "0");
    filter.setAttribute("width", String(w));
    filter.setAttribute("height", String(h));
    feImage.setAttribute("width", String(w));
    feImage.setAttribute("height", String(h));
    feImage.setAttributeNS("http://www.w3.org/1999/xlink", "href", map.href);
    feImage.setAttribute("href", map.href);
    feDisp.setAttribute("scale", String(map.scale));
    const css = `url(#${id}) blur(0.6px) saturate(1.7) brightness(1.03)`;
    el.style.setProperty("-webkit-backdrop-filter", css);
    el.style.setProperty("backdrop-filter", css);
  };

  paint();
  let t = 0;
  const ro =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          window.clearTimeout(t);
          t = window.setTimeout(paint, 160);
        })
      : null;
  ro?.observe(el);

  return () => {
    window.clearTimeout(t);
    ro?.disconnect();
    el.style.removeProperty("backdrop-filter");
    el.style.removeProperty("-webkit-backdrop-filter");
    svg.remove();
  };
}

/** React 钩子：`const ref = useLiquidGlass<HTMLDivElement>({radius: 22, strength: 10})` */
export function useLiquidGlass<T extends HTMLElement>(
  ref: { current: T | null },
  opts: { radius: number; strength?: number }
) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !liquidGlassSupported()) return;
    return attach(el, { radius: opts.radius, strength: opts.strength ?? 10 });
  }, [ref, opts.radius, opts.strength]);
}
