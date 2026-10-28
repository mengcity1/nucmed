import { useJSON, pct, fmt, type Stats } from "../lib/data";

function Kpi({ label, value, unit, hint, warn }: {
  label: string; value: string; unit?: string; hint?: string; warn?: boolean;
}) {
  return (
    <div className="card card-hover px-5 py-5">
      <div className="label">{label}</div>
      <div className="kpi-val">
        {value}
        {unit && (
          <small className="ml-1 font-sans text-[13px] font-medium tracking-normal text-ink-3">{unit}</small>
        )}
      </div>
      {hint && <div className={`mt-2 text-[12px] font-medium ${warn ? "text-warn" : "text-ok"}`}>{hint}</div>}
    </div>
  );
}

function Tier({ name, sub, value, total, tone }: {
  name: string; sub: string; value: number; total: number; tone: "a" | "b" | "c";
}) {
  const p = pct(value, total);
  const bar =
    tone === "a"
      ? "bg-gradient-to-r from-brand to-[#3d84d6]"
      : tone === "b"
        ? "bg-gradient-to-r from-[#4b8fd0] to-[#78b0e2]"
        : "bg-gradient-to-r from-[#93b8dd] to-[#b9d2ea]";
  return (
    <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[190px_1fr_92px] md:gap-4">
      <div className="text-[13px] font-semibold text-ink">
        {name}
        <span className="mt-0.5 block text-[11.5px] font-normal text-ink-3">{sub}</span>
      </div>
      <div className="h-[9px] overflow-hidden rounded-full bg-[#eef2f8]">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${p}%` }} />
      </div>
      <div className="num text-right text-[15px] font-semibold">
        {p.toFixed(1)}%
        <small className="block font-sans text-[11px] font-normal text-ink-3">
          {fmt(value)} / {fmt(total)}
        </small>
      </div>
    </div>
  );
}

export default function Overview() {
  const { data: s, error } = useJSON<Stats>("stats.json");

  return (
    <div className="pb-4">
      <section>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d3e2f6] bg-brand-soft px-3 py-1 text-[12px] font-semibold text-brand-deep">
          <i className="block h-1.5 w-1.5 rounded-full bg-ok" />
          数据已冻结 · 2026-10-27
        </div>
        <h1 className="max-w-[840px] text-[32px] font-bold leading-[1.24] tracking-tight md:text-[40px]">
          可追溯的核药<span className="text-brand">生物分布</span>资源，
          <br />
          与一个诚实可复现的基准
        </h1>
        <p className="mt-4 max-w-[760px] text-[15px] leading-[1.75] text-ink-2">
          器官级摄取记录，每条都带 <b className="font-semibold text-ink">原始文本片段</b> 与{" "}
          <b className="font-semibold text-ink">PMID 指针</b>；并用四类基线回答一个问题：
          <b className="font-semibold text-ink">现有数据到底能支持多强的预测</b>。
        </p>
      </section>

      {error && (
        <div className="mt-6 rounded-md2 border border-[#f6c9c9] bg-[#fdf2f2] p-4 text-[13px] text-bad">{error}</div>
      )}

      <section className="mt-9 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {s ? (
          <>
            <Kpi label="摄取记录" value={fmt(s.total)} unit="条" hint="当前冻结版本" />
            <Kpi
              label="核药"
              value={fmt(s.drugs)}
              unit="个"
              hint={`平均 ${(s.total / s.drugs).toFixed(2)} 条 / 药`}
            />
            <Kpi label="器官" value={fmt(s.organs)} unit="类" hint="肿瘤 / 血池 / 肝肾为主" />
            <Kpi label="分布表" value={fmt(s.tables)} unit="张" hint="部分记录缺表锚点" warn />
          </>
        ) : (
          <div className="col-span-4 text-[13px] text-ink-3">加载中…</div>
        )}
      </section>

      <section className="card mt-7 p-6 md:p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[17px] font-semibold tracking-tight">可追溯性 · 三层级</h2>
          <div className="text-[12.5px] text-ink-3">每层比上一层更严格，引用时必须点名层级</div>
        </div>
        <p className="mb-6 mt-1.5 max-w-[820px] text-[13px] text-ink-2">
          不是所有"有出处"的记录都能立刻验证。我们把可追溯性拆成三层，
          <b className="text-ink">逐层报告真实数值</b>，而不是把最宽松的那层写进摘要。
        </p>
        {s ? (
          <div className="grid gap-4">
            <Tier name="L1 有指针" sub="doc_pmid 非空" value={s.tiers.l1_has_pmid} total={s.total} tone="a" />
            <Tier name="L2 库内可落地" sub="能关联到文献元数据" value={s.tiers.l2_in_lit} total={s.total} tone="b" />
            <Tier name="L3 已标注 OA" sub="oa_status = open · 下界" value={s.tiers.l3_oa} total={s.total} tone="c" />
          </div>
        ) : (
          <div className="text-[13px] text-ink-3">加载中…</div>
        )}
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="card p-6">
          <h3 className="text-[15px] font-semibold">证据等级分布</h3>
          <p className="mb-5 mt-1 text-[12.5px] text-ink-3">只有 A、C 两档可用 · 不声称四级梯度</p>
          {s && (
            <div className="flex items-end gap-4">
              {s.by_grade.map((g) => {
                const max = Math.max(...s.by_grade.map((x) => x.n));
                const h = Math.max(3, Math.round((g.n / max) * 96));
                const tone = g.k === "A" ? "bg-gradient-to-t from-brand to-[#3d84d6]" : "bg-[#c9d6e6]";
                return (
                  <div key={g.k} className="flex flex-1 flex-col items-center gap-2">
                    <div className="num text-[12px] text-ink-2">{fmt(g.n)}</div>
                    <div className={`w-full rounded-t-md ${tone}`} style={{ height: h }} />
                    <div className="text-[11px] text-ink-3">{g.k}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card p-6">
          <h3 className="text-[15px] font-semibold">来源构成</h3>
          <p className="mb-5 mt-1 text-[12.5px] text-ink-3">正文段落 / 表格 / 结构化站点字段</p>
          {s && (
            <ul className="grid gap-2.5">
              {s.by_source.map((x) => (
                <li key={x.k} className="flex items-center gap-3 text-[13px]">
                  <span className="w-[92px] shrink-0 text-ink-2">{x.k}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#eef2f8]">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-brand to-[#3d84d6]"
                      style={{ width: `${pct(x.n, s.total)}%` }}
                    />
                  </span>
                  <span className="num w-[74px] text-right text-ink">{fmt(x.n)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
