#!/usr/bin/env node
/**
 * 部署状态自查（2026-11-04 立 · 事故驱动）
 *
 * 为什么需要这个：2026-11-04 本机 SSH 公钥失效，`build` 成功、`commit` 成功、工作区干净，
 * 只有 `git push` 静默失败 ⇒ 差点把"本地已提交"当成"线上已更新"。
 * 结论：**推送之后必须核 Actions 的 conclusion，而不是只看 git 没报错。**
 *
 * 用法：
 *   node web/scripts/deploy_status.mjs          # 看最近 3 次
 *   node web/scripts/deploy_status.mjs --wait   # 轮询直到最新一次结束（最长 5 分钟）
 *
 * 退出码：0 = 最新一次 success；1 = 失败/取消；2 = 仍在跑（未 --wait 时）/ 网络错误。
 * 依赖：Node 18+（内置 fetch）；公开仓库只读，无需 token。
 */
const REPO = "mengcity1/nucmed";
const API = `https://api.github.com/repos/${REPO}/actions/runs?per_page=3`;
const WAIT = process.argv.includes("--wait");
const TIMEOUT_MS = 5 * 60 * 1000;
const INTERVAL_MS = 10 * 1000;

async function runs() {
  const r = await fetch(API, {
    headers: { "User-Agent": "nucmed-deploy-check", Accept: "application/vnd.github+json" },
  });
  if (!r.ok) throw new Error(`GitHub API ${r.status} ${r.statusText}`);
  const j = await r.json();
  return j.workflow_runs ?? [];
}

const pad = (s, n) => String(s).padEnd(n);

async function main() {
  const started = Date.now();
  for (;;) {
    let list;
    try {
      list = await runs();
    } catch (e) {
      console.error(`FAIL  ${e.message}`);
      return 2;
    }
    if (!list.length) {
      console.error("FAIL  没有 workflow run（仓库或 Actions 未启用？）");
      return 2;
    }
    const [latest] = list;
    console.log(`仓库 ${REPO} · 最近 ${list.length} 次：`);
    for (const r of list) {
      console.log(
        `  #${pad(r.run_number, 4)} ${r.head_sha.slice(0, 7)}  ${pad(r.status, 10)} ${pad(r.conclusion ?? "-", 9)} ${r.created_at}  ${r.display_title.slice(0, 60)}`
      );
    }
    if (latest.status === "completed") {
      const ok = latest.conclusion === "success";
      console.log(`\n最新 #${latest.run_number} → ${latest.conclusion}`);
      if (!ok) console.log(`详情：${latest.html_url}`);
      return ok ? 0 : 1;
    }
    if (!WAIT) {
      console.log(`\n最新 #${latest.run_number} 仍在 ${latest.status}（加 --wait 轮询）`);
      return 2;
    }
    if (Date.now() - started > TIMEOUT_MS) {
      console.log(`\n超时：${TIMEOUT_MS / 1000}s 内未完成，最后状态 ${latest.status}`);
      return 2;
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

main().then((code) => process.exit(code));
