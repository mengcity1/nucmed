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

const PAGES = [
  ["home", "/?contrast=1"],
  ["drug", "/drug/1145?contrast=1"],
  ["atlas", "/atlas?drug=3&contrast=1"],
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
    await page.waitForFunction(() => !!document.getElementById("contrast-report"), null, { timeout: 15000 }).catch(() => {});
    const txt = await page.evaluate(() => document.getElementById("contrast-report")?.textContent ?? "");
    const lines = txt.split("\n").slice(1).filter((l) => l.trim());
    all.push({ page: name, theme, count: lines.length, rows: lines });
    console.log(`${name}/${theme}: ${lines.length} 处 < 4.5`);
  }
}
await browser.close();

// 汇总：按 "选择器 + 前景/背景" 归并
const bucket = new Map();
for (const { page, theme, rows } of all) {
  for (const r of rows) {
    const m = r.match(/^\s*([\d.]+)\s+(\S+)\s+fg=(.+?)\s+bg=(.+?)\s+«(.*)»/);
    if (!m) continue;
    const key = `${theme} ${m[2]} fg=${m[3]} bg=${m[4]}`;
    const cur = bucket.get(key) ?? { ratio: Number(m[1]), pages: new Set(), sample: m[5] };
    cur.ratio = Math.min(cur.ratio, Number(m[1]));
    cur.pages.add(page);
    bucket.set(key, cur);
  }
}

const sorted = [...bucket.entries()].sort((a, b) => a[1].ratio - b[1].ratio);
console.log(`\n=== 归并后 ${sorted.length} 类（按对比度升序，前 25）===`);
for (const [key, v] of sorted.slice(0, 25)) {
  console.log(`${v.ratio.toFixed(2)}  ${key}  [${[...v.pages].join(",")}]  «${v.sample.slice(0, 24)}»`);
}
const total = all.reduce((n, x) => n + x.count, 0);
console.log(`\n总命中 ${total} 处；归并 ${sorted.length} 类`);
process.exit(total ? 1 : 0);
