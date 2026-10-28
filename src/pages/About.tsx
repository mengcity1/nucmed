import { useJSON, fmt, type Meta, type Stats } from "../lib/data";

const LIC = "CC BY-NC 4.0";
// ★ 2026-10-28：原为 github.com/<TODO-OWNER> 占位（会显示成一个不存在的地址）。
//   主库实际在 Gitee；GitHub 只作部署镜像，Pages 上线后再补。
const REPO = "https://gitee.com/mengcity1/nucmed";

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-[#f1f4f9] py-2.5 last:border-0 sm:grid-cols-[150px_1fr] sm:gap-3">
      <div className="text-[12.5px] text-ink-3">{k}</div>
      <div className="break-words text-[13px] text-ink">{v}</div>
    </div>
  );
}

export default function About() {
  const { data: m } = useJSON<Meta>("meta.json");
  const { data: st } = useJSON<Stats>("stats.json");
  const base = import.meta.env.BASE_URL;

  return (
    <div className="pb-4">
      <h1 className="text-[26px] font-bold tracking-tight">ℹ 关于</h1>
      <p className="mt-1.5 max-w-[820px] text-[13px] leading-relaxed text-ink-3">
        核药数据库（NucMed DB）· 可追溯的器官级生物分布资源与可复现基准
      </p>

      <section className="card mt-5 p-6">
        <h2 className="text-[16px] font-semibold">版本与标识</h2>
        <div className="mt-3">
          {m ? (
            <>
              <Row k="数据版本" v={<span className="font-mono">{m.version}</span>} />
              <Row k="库指纹 sha256" v={<span className="font-mono">{m.db_sha16}<span className="text-ink-3">（前 16 位）</span></span>} />
              <Row k="库体积" v={<span className="font-mono">{(m.db_bytes / 1048576).toFixed(1)} MB<span className="text-ink-3">（{fmt(m.db_bytes)} B）</span></span>} />
              <Row k="导出时间" v={<span className="font-mono">{m.generated_at}</span>} />
              <Row
                k="规模"
                v={`${fmt(m.counts.biodist)} 条分布记录 · ${fmt(m.counts.drugs)} 个核药 · ${fmt(m.counts.tables)} 张表 · ${fmt(m.counts.refs)} 篇文献`}
              />
              {st?.raw_total_unfiltered ? (
                <Row
                  k="语境校验"
                  v={`${fmt(st.total)} / ${fmt(st.raw_total_unfiltered)} 条通过多药比较句校验（剔除 ${fmt(
                    st.raw_total_unfiltered - st.total
                  )} 条 C 级记录）`}
                />
              ) : null}
              <Row k="许可" v={<b>{LIC}</b>} />
            </>
          ) : (
            <div className="py-6 text-[13px] text-ink-3">加载中…</div>
          )}
        </div>
      </section>

      <section className="card mt-5 p-6">
        <h2 className="text-[16px] font-semibold">数据可用性</h2>
        <p className="mt-1 text-[12.5px] text-balance text-ink-3">
          前端所用的全部数据均可直接下载（JSON · <span className="whitespace-nowrap">UTF-8</span>）——不需要账号，不需要申请
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {m &&
            Object.entries(m.files)
              .filter(([n]) => n.endsWith(".json"))
              .sort((a, b) => b[1] - a[1])
              .map(([n, size]) => (
                <a
                  key={n}
                  href={`${base}data/${n}`}
                  download
                  className="flex items-center justify-between rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-[13px] transition hover:-translate-y-px hover:border-[#b9d0e9] hover:shadow-s2"
                >
                  <span className="font-mono text-ink">{n}</span>
                  <span className="num text-[12px] text-ink-3">{(size / 1024).toFixed(0)} KB ↓</span>
                </a>
              ))}
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-ink-3">
          完整 SQLite 库（{m ? (m.db_bytes / 1048576).toFixed(1) : "…"} MB）与复现脚本：见下方仓库占位。论文正式发表后将补充 Zenodo DOI。
        </p>
      </section>

      <section className="card mt-5 p-6">
        <h2 className="text-[16px] font-semibold">引用</h2>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-[#fafbfe] p-4 text-[12px] leading-relaxed text-ink-2">
{`@article{nucmeddb2026,
  title   = {NucMed DB: a traceable radiopharmaceutical
             biodistribution resource with a reproducible benchmark},
  author  = {NucMed DB contributors},
  journal = {Briefings in Bioinformatics},
  year    = {2026},
  note    = {Data version ${m?.version ?? "data-v2026-10-27"}, db sha256 ${m?.db_sha16 ?? "…"}}
}`}
        </pre>
        <p className="mt-2 text-[12px] text-ink-3">
          作者顺序与 DOI 将在论文接收后更新；当前以「NucMed DB contributors」统一署名。
        </p>
      </section>

      <section className="card mt-5 p-6">
        <h2 className="text-[16px] font-semibold">数据来源与口径</h2>
        <ul className="mt-3 grid gap-2 text-[13px] leading-relaxed text-ink-2">
          <li>
            · <b className="text-ink">摄取记录</b>：PubMed / PMC 全文与表格抽取，保留原始文本片段与 PMID 指针；
            少数无原文片段的记录在详情页明确标注<b className="text-ink">「仅文献级追溯」</b>，只给 PMID，不用空白框冒充原文。
          </li>
          <li>
            · <b className="text-ink">结构数据</b>：配体结构来自 radiopharm.idrblab.cn（口径 <code className="font-mono">ligand_only</code>）；
            分段结构（螯合剂/连接子/载体）由库内 SMILES 经 RDKit 现画。
          </li>
          <li>
            · <b className="text-ink">剂量学</b>：仅取自 FDA 获批药品说明书的「剂量与给药」表
            （<code className="font-mono">dosage_and_administration_table</code>），
            每条保留 <code className="font-mono">set_id</code> 与原始单元格文本；
            <b className="text-ink">未经单位换算的原始数值不参与统计</b>，μGy/Gy 一律先归一到 mGy/MBq 再入库。
          </li>
          <li>
            · <b className="text-ink">可追溯性</b>：分三层报告 —— 有 PMID 指针 / 库内可关联文献元数据 / 已标注 OA，<b>不合并成一个百分比</b>。
          </li>
          <li>
            · <b className="text-ink">未收录即不画</b>：缺失的组件显示「—」或虚线框，不用占位图冒充数据。
          </li>
        </ul>
      </section>

      <section className="card mt-5 p-6">
        <h2 className="text-[16px] font-semibold">联系与反馈</h2>
        <div className="mt-3">
          <Row k="维护单位" v="中国药科大学" />
          <Row
            k="问题反馈"
            v={<span className="font-mono text-ink-3">{REPO}/issues（占位）</span>}
          />
          <Row k="技术栈" v="Vite + React + TypeScript + Tailwind CSS（纯静态，无后端）" />
        </div>
      </section>
    </div>
  );
}
