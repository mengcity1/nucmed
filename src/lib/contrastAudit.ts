/**
 * 对比度自检（`?contrast=1`）—— 2026-11-04 加，用于"看不见截图"时定位"字不明显"。
 * 把每个**直接含文字**的元素算 WCAG 对比度（前景 vs 最近的不透明祖背景），
 * 低于 4.5 的排前，写进页面右下角的 `<pre id="contrast-report">`（这样无头浏览器 dump-dom 就能读到）。
 */
export function runContrastAudit() {
  document.getElementById("contrast-report")?.remove();
  const pre = document.createElement("pre");
  pre.id = "contrast-report";
  pre.style.cssText =
    "position:fixed;right:8px;bottom:8px;z-index:99999;max-width:46vw;max-height:50vh;overflow:auto;" +
    "background:#000c;color:#fff;font:11px/1.45 ui-monospace,monospace;padding:8px 10px;border-radius:8px;white-space:pre-wrap";
  pre.textContent = "contrast audit running…";
  document.body.appendChild(pre);
  try {
  const nums = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
  const lum = (r: number, g: number, b: number) => {
    const f = (v: number) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const bgOf = (el: Element): number[] => {
    let n: Element | null = el;
    while (n) {
      // body/html 的浅底在深色下是被舞台盖住的，不能作为文字底色
      if (n === document.body || n === document.documentElement) break;
      const c = nums(getComputedStyle(n).backgroundColor);
      if (c.length >= 3 && (c[3] === undefined || c[3] > 0.55)) return c;
      n = n.parentElement;
    }
    // 走到头都没有不透明底 ⇒ 说明文字浮在 canvas 玻璃上：用**舞台底色**近似（CSS 拿不到 canvas 像素）
    return document.querySelector(".app-stage.dark") ? [74, 77, 82] : [247, 241, 227];
  };

  type Row = { sel: string; ratio: number; color: string; bg: string; text: string };
  const rows: Row[] = [];
  document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => (n.textContent ?? "").trim())
      .join(" ");
    if (!own) return;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) < 0.3) return;
    const fg = nums(s.color);
    if (fg.length < 3) return;
    const bg = bgOf(el);
    const L1 = lum(fg[0], fg[1], fg[2]);
    const L2 = lum(bg[0], bg[1], bg[2]);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (ratio >= 4.5) return;
    const cls = String(el.className || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .join(".");
    rows.push({
      sel: el.tagName.toLowerCase() + (cls ? `.${cls}` : ""),
      ratio: Number(ratio.toFixed(2)),
      color: s.color,
      bg: `rgb(${Math.round(bg[0])},${Math.round(bg[1])},${Math.round(bg[2])})`,
      text: own.slice(0, 40),
    });
  });

  rows.sort((a, b) => a.ratio - b.ratio);
  pre.textContent =
    `LOW CONTRAST (<4.5): ${rows.length}\n` +
    rows
      .slice(0, 40)
      .map((r) => `${r.ratio.toFixed(2)}  ${r.sel}  fg=${r.color} bg=${r.bg}  «${r.text}»`)
      .join("\n");
  document.body.appendChild(pre);
  } catch (e) {
    pre.textContent += "\nERROR: " + String(e);
  }
}
