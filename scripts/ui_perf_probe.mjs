/**
 * 首屏重量探针（2026-11-05 · v60）
 *
 * 目的：给"用户真能感觉到"的性能改动用**数字**说话。
 * 只做测量，不改任何东西：
 *
 *   node scripts/ui_perf_probe.mjs                       # 默认测线上站点
 *   node scripts/ui_perf_probe.mjs --base http://127.0.0.1:4175
 *
 * 输出：每页的 传输字节（按类型）/ 请求数 / DCL / load / LCP，以及最重的 8 个资源。
 * 注意：GitHub Pages 对文本资源做 gzip/br，`encodedBodySize` 才是"用户真的下载了多少"。
 */
import { chromium } from "playwright";

const args = process.argv.slice(2);
const arg = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const BASE = arg("--base", "https://mengcity1.github.io/nucmed");

const PAGES = [
  ["home", "/"],
  ["drug", "/drug/1145"],
  ["atlas", "/atlas?drug=3"],
  ["about", "/about"],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

for (const [name, path] of PAGES) {
  const page = await ctx.newPage();
  const res = [];
  page.on("response", async (r) => {
    try {
      const sizes = await r.request().sizes();
      const url = r.url().replace(BASE, "");
      const type = url.includes("/assets/")
        ? url.endsWith(".css")
          ? "css"
          : url.endsWith(".js")
            ? "js"
            : "asset"
        : url.includes("/data/")
          ? "json"
          : url.match(/\.(png|jpg|jpeg|webp|svg)$/)
            ? "img"
            : "other";
      res.push({ url, type, wire: sizes.responseBodySize, dec: sizes.responseHeadersSize + sizes.responseBodySize });
    } catch {
      /* 某些重定向拿不到 sizes，忽略 */
    }
  });
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 90000 });
  let prev = -1;
  for (let i = 0; i < 30; i++) {
    const n = await page.evaluate(() => document.querySelectorAll("*").length);
    if (n === prev && n > 100) break;
    prev = n;
    await page.waitForTimeout(300);
  }
  const nav = await page.evaluate(() => {
    const t = performance.getEntriesByType("navigation")[0];
    return {
      dcl: t ? Math.round(t.domContentLoadedEventEnd) : -1,
      load: t ? Math.round(t.loadEventEnd) : -1,
      lcp: (() => {
        const e = performance.getEntriesByType("largest-contentful-paint");
        return e.length ? Math.round(e[e.length - 1].startTime) : -1;
      })(),
    };
  });

  const byType = {};
  for (const r of res) {
    byType[r.type] = byType[r.type] || { n: 0, wire: 0 };
    byType[r.type].n += 1;
    byType[r.type].wire += r.wire;
  }
  const total = res.reduce((s, r) => s + r.wire, 0);
  console.log(`\n=== ${name} (${path}) ===`);
  console.log(
    `总传输 ${(total / 1024).toFixed(0)} KB · 请求 ${res.length} · DCL ${nav.dcl} ms · load ${nav.load} ms · LCP ${nav.lcp} ms`,
  );
  for (const [t, v] of Object.entries(byType).sort((a, b) => b[1].wire - a[1].wire)) {
    console.log(`  ${t.padEnd(6)} ${(v.wire / 1024).toFixed(0).padStart(6)} KB  ×${v.n}`);
  }
  console.log("  最重的 8 个：");
  for (const r of [...res].sort((a, b) => b.wire - a.wire).slice(0, 8)) {
    console.log(`   ${(r.wire / 1024).toFixed(0).padStart(6)} KB  ${r.url.slice(0, 70)}`);
  }
  await page.close();
}

await browser.close();
