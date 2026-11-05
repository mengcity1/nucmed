/**
 * 页面级对比度体检（2026-11-05）
 *
 * 站内已有的 `?contrast=1` 会把"文字 < 4.5:1"的元素写进 `#contrast-report`（`lib/contrastAudit.ts`），
 * 但它只是把报告**画在页面上**，人得自己看。这个脚本用 Playwright 把报告读出来并汇总：
 *
 *   node scripts/ui_contrast_audit.mjs                 # 汇总所有页面 × 深浅
 *   node scripts/ui_contrast_audit.mjs --base http://127.0.0.1:4175
 *
 * 退出码：0 = 全部 ≥4.5；1 = 有低于 4.5 的（供人工决定改不改）。
 */
import { chromium } from "playwright";

const args = process.argv.slice(2);
const arg = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const BASE = arg("--base", "http://127.0.0.1:4175");

/* 覆盖面（v61）：不只首页 —— 药页按**分期徽标**各挑一个（Phase 2 / Phase 1 /  preclinical 点数最多的），
   图集换两个药。这些页的徽标色族不同（badge-a/b/c），最容易出现"深色漏覆盖"那类问题。 */
const PAGES = [
  ["home", "/?contrast=1"],
  ["drug-a", "/drug/1145?contrast=1"],
  ["drug-phase2", "/drug/278?contrast=1"],
  ["drug-phase1", "/drug/2448?contrast=1"],
  ["drug-preclin", "/drug/2400?contrast=1"],
  ["atlas-3", "/atlas?drug=3&contrast=1"],
  ["atlas-2400", "/atlas?drug=2400&contrast=1"],
  ["about", "/about?contrast=1"],
];
const THEMES = ["light", "dark"];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const all = [];

for (const [name, path] of PAGES) {
  for (const theme of THEMES) {
    const sep = path.includes("?") ? "&" : "?";
    const url = `${BASE}${path}${sep}theme=${theme}`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    // 等主题类真的落到 .app-stage 上（页面内 `?contrast=1` 报告在 2.5 s 内可能采到未加类的一帧）
    await page.waitForFunction(
      (t) => !!document.querySelector(`.app-stage.${t}`),
      theme,
      { timeout: 15000 },
    );
    await page.waitForTimeout(400);
    /* 自己算：与 `src/lib/contrastAudit.ts` 同一算法，但在**主题已就绪**后执行，
       避免把"未加 light/dark 类的那一帧"算进来（会产出 #164a8a on 深底 这类假阳性）。 */
    const rows = await page.evaluate(() => {
      const nums = (c) => (c.match(/[\d.]+/g) ?? []).map(Number);
      const lum = (r, g, b) => {
        const f = (v) => {
          const x = v / 255;
          return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const bgOf = (el) => {
        let n = el;
        while (n) {
          if (n === document.body || n === document.documentElement) break;
          const cs = getComputedStyle(n);
          const c = nums(cs.backgroundColor);
          if (c.length >= 3 && (c[3] === undefined || c[3] > 0.55)) return c;
          // v58：渐变底（如 brand 渐变图标块）backgroundColor 是透明的，只看 bg 会把
          // 白字压蓝底误判成 1.13:1 ⇒ 取渐变里各色 rgb 的均值近似。
          if (cs.backgroundImage && cs.backgroundImage.includes("gradient")) {
            const stops = cs.backgroundImage.match(/rgba?\([^)]*\)/g) ?? [];
            const rgbOnly = stops
              .map((s) => nums(s))
              .filter((a) => a.length >= 3 && (a.length < 4 || a[3] > 0.5));
            if (rgbOnly.length) {
              const avg = [0, 1, 2].map((i) => rgbOnly.reduce((s, a) => s + a[i], 0) / rgbOnly.length);
              return avg;
            }
          }
          n = n.parentElement;
        }
        return document.querySelector(".app-stage.dark") ? [74, 77, 82] : [247, 241, 227];
      };
      const out = [];
      for (const el of document.querySelectorAll("body *")) {
        if (el.id === "contrast-report") continue;
        const own = [...el.childNodes]
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => (n.textContent ?? "").trim())
          .join(" ");
        if (!own) continue;
        const s = getComputedStyle(el);
        if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) < 0.3) continue;
        const fg = nums(s.color);
        if (fg.length < 3) continue;
        const bg = bgOf(el);
        const L1 = lum(fg[0], fg[1], fg[2]);
        const L2 = lum(bg[0], bg[1], bg[2]);
        const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        if (ratio >= 4.5) continue;
        const cls = String(el.className || "").split(/\s+/).filter(Boolean).slice(0, 2).join(".");
        out.push({
          ratio: Number(ratio.toFixed(2)),
          sel: el.tagName.toLowerCase() + (cls ? `.${cls}` : ""),
          fg: s.color,
          bg: `rgb(${Math.round(bg[0])},${Math.round(bg[1])},${Math.round(bg[2])})`,
          text: own.slice(0, 40),
        });
      }
      return out;
    });
    all.push({ page: name, theme, count: rows.length, rows });
    console.log(`${name}/${theme}: ${rows.length} 处 < 4.5`);
  }
}
await browser.close();

const bucket = new Map();
for (const { page, theme, rows } of all) {
  for (const r of rows) {
    const key = `${theme} ${r.sel} fg=${r.fg} bg=${r.bg}`;
    const cur = bucket.get(key) ?? { ratio: r.ratio, pages: new Set(), sample: r.text };
    cur.ratio = Math.min(cur.ratio, r.ratio);
    cur.pages.add(page);
    bucket.set(key, cur);
  }
}

const sorted = [...bucket.entries()].sort((a, b) => a[1].ratio - b[1].ratio);
console.log(`\n=== 归并后 ${sorted.length} 类（按对比度升序）===`);
for (const [key, v] of sorted) {
  console.log(`${v.ratio.toFixed(2)}  ${key}  [${[...v.pages].join(",")}]  «${v.sample.slice(0, 24)}»`);
}
const total = all.reduce((n, x) => n + x.count, 0);
console.log(`\n总命中 ${total} 处；归并 ${sorted.length} 类`);
process.exit(total ? 1 : 0);
