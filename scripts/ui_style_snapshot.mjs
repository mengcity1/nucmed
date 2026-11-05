/**
 * 计算样式快照 / 前后比对（2026-11-05 · 为"删死规则"提供**可信回归**）
 *
 * 为什么需要它：本机截图**不可重复**（同一页连拍两张就差 62.9 万像素，页面有入场动画），
 * 没法用截图证明"删掉这些声明没有影响"。Playwright 能读 `getComputedStyle`，
 * 于是把"每个关键元素在每页每主题下的最终计算值"拍成 JSON，改前改后逐值比对。
 *
 * 用法：
 *   node scripts/ui_style_snapshot.mjs --out logs/snapA.json                 # 拍快照
 *   node scripts/ui_style_snapshot.mjs --diff logs/snapA.json logs/snapB.json # 比对（有差异 rc=1）
 *   --base 默认 http://127.0.0.1:4175（先把 dist 用静态服务器发出来）
 */
import { chromium } from "playwright";
import { writeFileSync, readFileSync } from "node:fs";

const args = process.argv.slice(2);
const arg = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const BASE = arg("--base", "http://127.0.0.1:4175");
const OUT = arg("--out", "");
const DIFF = args.includes("--diff");

/** 只比对"看得见"的属性；transform/animation 这类会随时间抖的不收 */
const PROPS = [
  "background-color",
  "background-image",
  "color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "box-shadow",
  "font-weight",
  "opacity",
  "backdrop-filter",
];

/** 每页每主题都拍的组件（取前 n 个实例）
 *  ⚠ 2026-11-05：**采集面必须覆盖"被 !important 覆盖的那类元素"**，否则会得出假的"0 差异"。
 *  第一次做 S4 时只采了 12 个控件，得出"去掉 107 个 !important 无变化"的错误结论 ——
 *  因为多数 !important 是**文字色**（.text-ink / text-[#…] / KPI / 徽标 / 表格），根本没采到。 */
const TARGETS = [
  // 控件
  { sel: ".tab", n: 3 },
  { sel: ".tab-on", n: 2, pseudo: "::after" },
  { sel: ".chip", n: 2 },
  { sel: ".chip-sm", n: 3 },
  { sel: ".chip-on", n: 2 },
  { sel: ".chip-off", n: 2 },
  { sel: ".chip-badge", n: 2 },
  { sel: ".is-selected", n: 2 },
  { sel: "button", n: 4 },
  // 面板
  { sel: ".card", n: 2 },
  { sel: ".card-solid", n: 2 },
  { sel: ".lg-surface", n: 2 },
  // 文字 / 表格（!important 集中的地方）
  { sel: ".text-ink", n: 3 },
  { sel: ".text-ink-2", n: 3 },
  { sel: ".text-ink-3", n: 3 },
  { sel: ".text-brand", n: 2 },
  { sel: ".text-brand-deep", n: 2 },
  { sel: ".text-bad", n: 2 },
  { sel: ".text-good", n: 2 },
  { sel: ".text-ok", n: 2 },
  { sel: ".kpi-val", n: 3 },
  { sel: ".badge", n: 3 },
  { sel: ".label-caps", n: 2 },
  { sel: ".sec-no", n: 2 },
  { sel: ".num", n: 3 },
  { sel: "h1", n: 1 },
  { sel: "h2", n: 2 },
  { sel: "p", n: 3 },
  { sel: "a", n: 3 },
  { sel: "th", n: 3 },
  { sel: "td", n: 5 },
  { sel: ".table-booktabs tbody tr", n: 2 },
  { sel: ".prose-serif", n: 2 },
  { sel: "input", n: 2 },
  { sel: "select", n: 1 },
];

const PAGES = [
  ["home-light", "/?theme=light&bg=none"],
  ["home-dark", "/?theme=dark&bg=none"],
  ["drug-light", "/drug/1145?theme=light&bg=none"],
  ["drug-dark", "/drug/1145?theme=dark&bg=none"],
  ["atlas-light", "/atlas?drug=3&theme=light&bg=none"],
  ["atlas-dark", "/atlas?drug=3&theme=dark&bg=none"],
  ["about-light", "/about?theme=light&bg=none"],
  ["about-dark", "/about?theme=dark&bg=none"],
];

async function snap() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const all = {};
  for (const [name, path] of PAGES) {
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 60000 });
    // 冻结动效，保证可重复
    await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
    await page.waitForTimeout(400);
    const dump = await page.evaluate(
      ({ targets, props }) => {
        const out = {};
        for (const t of targets) {
          const els = [...document.querySelectorAll(t.sel)].slice(0, t.n);
          els.forEach((el, i) => {
            const rec = {};
            const cs = getComputedStyle(el);
            for (const p of props) rec[p] = cs.getPropertyValue(p);
            out[`${t.sel}#${i}`] = rec;
            if (t.pseudo) {
              const ps = getComputedStyle(el, t.pseudo);
              const p2 = {};
              for (const p of props) p2[p] = ps.getPropertyValue(p);
              out[`${t.sel}#${i}${t.pseudo}`] = p2;
            }
          });
        }
        /* ★ 全页指纹：把**每一个元素**的 11 个关键属性压成一个 FNV-1a 哈希。
           采样点只能证明"采到的没变"，全页指纹能证明"整页没有一处样式漂移"。
           （2026-11-05：第一次做 S4 时只靠 12 个采样点，差点得出"去掉 107 个 !important 无变化"的假结论。） */
        let h = 2166136261 >>> 0;
        const push = (s) => {
          for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619) >>> 0;
          }
        };
        const all = document.querySelectorAll("*");
        for (const el of Array.from(all)) {
          push(el.tagName);
          const cs = getComputedStyle(el);
          for (const p of props) push(cs.getPropertyValue(p));
        }
        out.__full = { elements: String(all.length), hash: h.toString(16) };
        return out;
      },
      { targets: TARGETS, props: PROPS },
    );
    all[name] = dump;
    console.log(`${name}: ${Object.keys(dump).length} 个元素快照`);
  }
  await browser.close();
  return all;
}

function diff(a, b) {
  const rows = [];
  const pages = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const pg of pages) {
    const ea = a[pg] ?? {};
    const eb = b[pg] ?? {};
    const keys = new Set([...Object.keys(ea), ...Object.keys(eb)]);
    for (const k of keys) {
      if (!ea[k] || !eb[k]) {
        rows.push(`${pg} ${k}: 元素只在${ea[k] ? "前" : "后"}存在`);
        continue;
      }
      if (k === "__full") {
        if (ea[k].hash !== eb[k].hash || ea[k].elements !== eb[k].elements) {
          rows.push(
            `${pg} 全页指纹不同：${ea[k].elements} 元素 / ${ea[k].hash} → ${eb[k].elements} 元素 / ${eb[k].hash}`,
          );
        }
        continue;
      }
      for (const p of PROPS) {
        const va = ea[k][p];
        const vb = eb[k][p];
        if (va !== vb) rows.push(`${pg} ${k} ${p}\n    前: ${va}\n    后: ${vb}`);
      }
    }
  }
  return rows;
}

if (DIFF) {
  const i = args.indexOf("--diff");
  const A = JSON.parse(readFileSync(args[i + 1], "utf8"));
  const B = JSON.parse(readFileSync(args[i + 2], "utf8"));
  const rows = diff(A, B);
  if (!rows.length) {
    console.log("✓ 计算样式完全一致（0 处差异）");
    process.exit(0);
  }
  console.log(`✗ ${rows.length} 处差异：`);
  for (const r of rows.slice(0, 60)) console.log("  " + r);
  process.exit(1);
} else {
  const data = await snap();
  writeFileSync(OUT || "logs/ui_snap.json", JSON.stringify(data, null, 1), "utf8");
  console.log(`已写入 ${OUT || "logs/ui_snap.json"}`);
}
