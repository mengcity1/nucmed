import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useJSON, fmt, refLink, type Drug, type Point } from "../lib/data";
import { Chart, PALETTE, AXIS } from "../components/Chart";
import DosimetryPanel from "../components/DosimetryPanel";
import { EmptyState, ErrorState, TableSkeleton } from "../components/States";

type Ref = { pmid: string; title: string | null; journal: string | null; year: number | null };

/** 单药画像的 4 个 Tab（pk262 B1） */
type TabKey = "bio" | "dos" | "tbr" | "refs";
const TAB_ORDER: TabKey[] = ["bio", "dos", "tbr", "refs"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11.5px] font-medium text-ink-3">{label}</div>
      <div className="mt-0.5 text-[13.5px] text-ink">{children}</div>
    </div>
  );
}

/** 详情页加载骨架：与真实版面同形（标题 + 信息卡 + 面板），避免加载完成时跳动。 */
function DetailSkeleton() {
  return (
    <div className="pb-4" aria-busy="true">
      <div className="h-3.5 w-24 animate-pulse rounded bg-[#eef2f8]" />
      <div className="mt-4 h-7 w-64 animate-pulse rounded bg-[#e9eef6]" />
      <div className="card mt-5 p-6">
        <div className="grid gap-5 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="h-3 w-12 animate-pulse rounded bg-[#eef2f8]" />
              <div className="mt-2 h-4 w-24 animate-pulse rounded bg-[#e9eef6]" />
            </div>
          ))}
        </div>
      </div>
      <div className="card mt-5 p-6">
        <div className="h-4 w-20 animate-pulse rounded bg-[#e9eef6]" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-[10px] bg-[#f2f5fa]" />
          ))}
        </div>
      </div>
      <div className="card mt-5 p-6">
        <TableSkeleton rows={5} cols={4} />
      </div>
    </div>
  );
}

/** 该药的时间-摄取曲线（每个器官一条线 · 只画 ≥2 个时间点的器官） */
function DrugCurve({ pts }: { pts: Point[] }) {
  const series = useMemo(() => {
    const byOrgan = new Map<string, [number, number][]>();
    for (const p of pts) {
      if (p.time_h === null || p.time_h <= 0 || p.value_num <= 0) continue;
      const arr = byOrgan.get(p.organ_norm) ?? [];
      arr.push([p.time_h, p.value_num]);
      byOrgan.set(p.organ_norm, arr);
    }
    return [...byOrgan.entries()]
      .filter(([, a]) => a.length >= 2)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 6)
      .map(([organ, data]) => ({
        name: organ,
        type: "line" as const,
        smooth: true,
        symbolSize: 6,
        connectNulls: true,
        data: [...data].sort((x, y) => x[0] - y[0]),
      }));
  }, [pts]);

  const option = useMemo(
    () => ({
      color: PALETTE,
      tooltip: {
        trigger: "axis",
        formatter: (ps: { seriesName: string; value: [number, number] }[]) =>
          ps
            .map((p) => `${p.seriesName}: ${p.value[0]} h → ${p.value[1]} %ID/g`)
            .join("<br/>"),
      },
      legend: { type: "scroll", top: 0, textStyle: { fontSize: 11, color: "#475569" } },
      grid: { left: 54, right: 16, top: 38, bottom: 34 },
      xAxis: {
        type: "log",
        name: "时间 (h, 对数)",
        nameTextStyle: { color: "#94a3b8", fontSize: 11 },
        ...AXIS,
      },
      yAxis: {
        type: "log",
        name: "%ID/g",
        nameTextStyle: { color: "#94a3b8", fontSize: 11 },
        ...AXIS,
      },
      series,
    }),
    [series]
  );

  if (!series.length) {
    return (
      <div className="rounded-lg border border-dashed border-[#e8edf5] px-4 py-5 text-center text-[12.5px] text-ink-3">
        该药的记录不足以画趋势（需要同一器官有 ≥2 个时点）
      </div>
    );
  }
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-ink">时间-摄取曲线</span>
        <span className="text-[11.5px] text-ink-3">
          每条线 = 一个器官 · 仅画 ≥2 个时点的器官（最多 6 条）· 双对数轴
        </span>
      </div>
      <Chart option={option} height={300} />
    </div>
  );
}

/** 靶本比 Tab：`drugs.json` 的 `has_tbr=1` 只说明「库内该药有 TBR 记录」，
 *  TBR 明细不在 `public/data/` 导出层（导出脚本受红线保护，本轮不改）。
 *  这里**不自行重算比值**（分子/分母/时点口径各篇论文不同，前端重算会造出第二份口径），
 *  只把能看见的「分子」摊开 —— 该药的肿瘤摄取点，分母去「生物分布」Tab 对照。 */
function TbrPanel({ pts, hasTbr, onGoBio }: { pts: Point[]; hasTbr: boolean; onGoBio: () => void }) {
  const tumor = useMemo(() => pts.filter((p) => p.is_tumor === 1), [pts]);

  const goBio = (
    <button
      type="button"
      onClick={onGoBio}
      className="rounded-lg border border-line bg-white px-3.5 py-2 text-[12.5px] font-medium text-ink-2 transition hover:-translate-y-px hover:border-[#b9d0e9] hover:shadow-s2"
    >
      去「生物分布」看正常器官对照 →
    </button>
  );

  /* 库内没有 TBR 记录：不摆空表、不补算，给一句「为什么空」+ 一条能走的路 */
  if (!hasTbr) {
    return (
      <div className="card p-5 sm:p-6">
        <EmptyState
          title="该药暂无靶本比记录"
          hint="库内只记录「该药是否存在 TBR 记录」，明细（分子 / 分母 / 时点 / 单位口径）未随本站数据导出 —— 这里不猜、也不自行重算比值。"
        >
          {goBio}
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="card p-5 sm:p-6">
      <div className="rounded-[10px] border border-[#f6e3c8] bg-[#fdf3e7] px-3.5 py-3 text-[12.5px] leading-relaxed text-[#8a5310]">
        <b>库内标记该药有靶本比记录</b>，但 TBR 明细（分子 / 分母 / 时点 / 单位口径）未随本站数据导出，
        本轮不改导出脚本，因此这里<b>不展示重算出的比值</b>
        {tumor.length > 0 ? "，只列原始肿瘤摄取点" : ""}；分母（正常器官 / 血池）在「生物分布」Tab。
      </div>

      {tumor.length > 0 ? (
        <>
          <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[13px] font-medium text-ink">肿瘤摄取点（TBR 的分子）</span>
            <span className="text-[11.5px] text-ink-3">
              共 <b className="num text-ink-2">{fmt(tumor.length)}</b> 条 · 口径以原文为准
            </span>
          </div>
          <div className="mt-2 overflow-x-auto rounded-[10px] border border-line">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-line bg-[#fafbfe] text-[11.5px] uppercase tracking-wide text-ink-3">
                  <th className="px-4 py-2 text-left font-semibold">器官 / 模型</th>
                  <th className="px-4 py-2 text-left font-semibold">时点 (h)</th>
                  <th className="px-4 py-2 text-right font-semibold">值</th>
                  <th className="px-4 py-2 text-left font-semibold">单位</th>
                  <th className="px-4 py-2 text-left font-semibold">证据</th>
                  <th className="px-4 py-2 text-left font-semibold">PMID</th>
                </tr>
              </thead>
              <tbody>
                {tumor.slice(0, 40).map((p) => (
                  <tr key={p.id} className="border-b border-[#f1f4f9] last:border-0">
                    <td className="px-4 py-2 font-medium text-ink">{p.organ_norm}</td>
                    <td className="num px-4 py-2">{p.time_h ?? "—"}</td>
                    <td className="num px-4 py-2 text-right font-medium">{p.value_num}</td>
                    <td className="px-4 py-2">{p.value_unit}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`badge ${
                          p.evidence_grade === "A" ? "badge-a" : p.evidence_grade === "C" ? "badge-c" : "badge-b"
                        }`}
                      >
                        {p.evidence_grade ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {(() => {
                        const L = refLink(p.doc_pmid);
                        return L.href ? (
                          <a
                            href={L.href}
                            target="_blank"
                            rel="noreferrer"
                            className="num text-brand underline decoration-dashed underline-offset-2"
                          >
                            {p.doc_pmid}
                          </a>
                        ) : (
                          <span className="text-ink-3">—</span>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-[#e8edf5] px-4 py-6 text-center text-[12.5px] text-ink-3">
          库内有 TBR 记录，但该药的生物分布点里没有标记为 tumor 的摄取点 —— 分子端未导出
        </div>
      )}

      <div className="mt-4">{goBio}</div>
    </div>
  );
}

export default function DrugDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const did = id ? Number(id) : 0;
  const { data: drugs, error: drugsErr, loading: drugsLoading, reload: reloadDrugs } = useJSON<Drug[]>("drugs.json");
  const { data: pts } = useJSON<Point[]>("biodist.json");
  const { data: raw } = useJSON<Record<string, string>>("raw.json");
  const [pick, setPick] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("bio");
  // ★ 结构图来源（884 浙大 / 575 示意图 / 11 肽段 2D / 759 本地 RDKit）：此前一律标成 radiopharm，属错标
  const [structSrc, setStructSrc] = useState<string | null>(null);
  // ★ 文献 Tab 数字：挂载即取 drug_refs（104 KB，小）；题录 refs_all（979 KB）仍懒加载
  const [drugRefs, setDrugRefs] = useState<string[] | null>(null);
  const [refMeta, setRefMeta] = useState<Record<string, Ref> | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${import.meta.env.BASE_URL}struct/manifest.json`, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((m: Record<string, string>) => alive && setStructSrc(m[String(did)] ?? null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [did]);

  /* 药 → pmids：进页面就取，供 Tab 显示真实文献数（不再显示「该药暂无」） */
  useEffect(() => {
    let alive = true;
    setDrugRefs(null);
    fetch(`${import.meta.env.BASE_URL}data/drug_refs.json`, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((m: Record<string, string[]>) => alive && setDrugRefs(m[String(did)] ?? []))
      .catch(() => alive && setDrugRefs([]));
    return () => {
      alive = false;
    };
  }, [did]);

  /* 题录（979 KB）：只在切到「文献」Tab 时拉 */
  useEffect(() => {
    if (tab !== "refs" || refMeta) return;
    let alive = true;
    fetch(`${import.meta.env.BASE_URL}data/refs_all.json`, { cache: "no-cache" })
      .then((r) => r.json())
      .then((meta: Ref[]) => {
        if (!alive) return;
        const idx: Record<string, Ref> = {};
        for (const r of meta) idx[String(r.pmid)] = r;
        setRefMeta(idx);
      })
      .catch(() => alive && setRefMeta({}));
    return () => {
      alive = false;
    };
  }, [tab, refMeta]);

  // ★ 图片加载失败要「说出来」，不能静默 display:none（否则表现为「有标题、没图」）
  const [imgErr, setImgErr] = useState<Record<string, boolean>>({});


  const drug = useMemo(() => (drugs ?? []).find((d) => d.drug_id === did), [drugs, did]);
  const mine = useMemo(() => (pts ?? []).filter((p) => p.drug_id === did), [pts, did]);
  /** `has_raw = 0` ⇒ 只有 PMID、没有原文片段（487/3,391，pk263）。
   *  这类行不展开、不留空白框，直接在表格里标明「仅文献级追溯」。 */
  const noRawCount = useMemo(() => mine.filter((p) => p.has_raw === 0).length, [mine]);
  const pmids = useMemo(
    () => [...new Set(mine.map((p) => p.doc_pmid).filter(Boolean) as string[])],
    [mine]
  );
  /** 文献列表：优先药物级参考文献（drug_refs + refs_all）；未加载完时先按 biodist 来源占位 */
  const refList = useMemo<Ref[]>(() => {
    const ids = drugRefs ?? pmids;
    return ids.map((p) => refMeta?.[p] ?? { pmid: p, title: null, journal: null, year: null });
  }, [drugRefs, refMeta, pmids]);

  /** 分两组：① 该药生物分布数值的出处 ② 其余相关文献（背景/方法/临床） */
  const srcRefs = useMemo(() => refList.filter((r) => pmids.includes(r.pmid)), [refList, pmids]);
  const otherRefs = useMemo(() => refList.filter((r) => !pmids.includes(r.pmid)), [refList, pmids]);
  const hits = useMemo(() => {
    const k = pick.trim().toLowerCase();
    return (drugs ?? [])
      .filter((d) => !k || (d.name_en || "").toLowerCase().includes(k) || (d.name_zh || "").includes(k))
      .slice(0, 24);
  }, [drugs, pick]);

  /* 切药时把 Tab 落到「有数据的第一个」，否则停在上一个药的 Tab 上会看到空面板 */
  useEffect(() => {
    if (!drug) return;
    const ok: Record<TabKey, boolean> = {
      bio: (drug.n_points ?? mine.length) > 0,
      dos: (drug.n_dosim ?? 0) > 0,
      tbr: (drug.has_tbr ?? 0) === 1,
      refs: (drug.n_refs ?? 0) > 0,
    };
    setTab((cur) => (ok[cur] ? cur : TAB_ORDER.find((k) => ok[k]) ?? "bio"));
  }, [drug, mine.length]);

  /* 无 id ⇒ 选择器（导航「单药画像」直接进来时） */
  if (!did) {
    return (
      <div className="pb-4">
        <h1 className="text-[26px] font-bold tracking-tight">🔬 单药画像</h1>
        <p className="mt-1.5 text-[13px] text-ink-3 text-balance">
          搜索并选择一个核药，查看它的结构、生物分布与来源文献
        </p>
        <div className="card mt-5 p-6">
          <input
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            placeholder="输入药名（中英文），如 PSMA…"
            className="h-10 w-full rounded-[10px] border border-line bg-white px-3.5 text-[13.5px] outline-none focus:border-[#9dc0ea] focus:ring-[3px] focus:ring-brand/10"
          />
          {drugsErr && (
            <div className="mt-4">
              <ErrorState message={`药物目录（drugs.json）加载失败：${drugsErr}`} onRetry={reloadDrugs} />
            </div>
          )}

          {/* 加载：与结果网格同形的卡片骨架 */}
          {drugsLoading && (
            <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-[42px] animate-pulse rounded-[10px] bg-[#f0f3f9]" />
              ))}
            </div>
          )}

          {/* 空：关键词 0 命中 —— 说清「查了什么 + 还有多少药 + 一键清空」 */}
          {!drugsErr && !drugsLoading && !hits.length && (
            <EmptyState
              title="没有匹配的核药"
              hint={`关键词「${pick.trim()}」在库内 ${fmt(drugs?.length ?? 0)} 个核药里没有命中。可以试英文名 / 通用名，或只输入片段（如 PSMA、DOTA）。`}
            >
              <button
                type="button"
                onClick={() => setPick("")}
                className="rounded-lg border border-brand bg-brand-soft px-3.5 py-2 text-[12.5px] font-medium text-brand-deep transition hover:bg-brand/15"
              >
                清空关键词
              </button>
            </EmptyState>
          )}

          {!drugsErr && !drugsLoading && hits.length > 0 && (
            <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {hits.map((d) => (
                <Link
                  key={d.drug_id}
                  to={`/drug/${d.drug_id}`}
                  title={d.name_en}
                  className="flex min-w-0 items-center justify-between rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-[13px] transition hover:-translate-y-px hover:border-[#b9d0e9] hover:shadow-s2"
                >
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">{d.name_en}</span>
                  <span className="ml-2 shrink-0 text-[11.5px] text-ink-3">
                    {d.has_struct ? "✓ 结构" : ""}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {drugs && !drugsErr && (
            <div className="mt-3 text-[12px] text-ink-3">
              共 {fmt(drugs.length)} 个核药 · 仅显示前 24 个匹配项
            </div>
          )}
        </div>
      </div>
    );
  }

  /* 详情页三态（pk262 B5）：加载骨架 / 目录加载失败可重试 / 编号不存在给出口 */
  if (!drug) {
    if (drugsErr) {
      return (
        <div className="pb-4">
          <ErrorState message={`药物目录（drugs.json）加载失败：${drugsErr}`} onRetry={reloadDrugs} />
        </div>
      );
    }
    if (drugsLoading) return <DetailSkeleton />;
    return (
      <div className="pb-4">
        <div className="card mt-5">
          <EmptyState
            title={`没有 #${did} 这个核药`}
            hint="链接里的编号在库内不存在（可能是旧链接或被合并的编号）。可以回总览重新筛选，或去「单药画像」按名字选。"
          >
            <Link
              to="/"
              className="rounded-lg border border-line bg-white px-3.5 py-2 text-[12.5px] font-medium text-ink-2 transition hover:border-[#b9d0e9] hover:shadow-s2"
            >
              ← 回总览
            </Link>
            <Link
              to="/drug"
              className="rounded-lg border border-brand bg-brand-soft px-3.5 py-2 text-[12.5px] font-medium text-brand-deep transition hover:bg-brand/15"
            >
              去「单药画像」选择 →
            </Link>
          </EmptyState>
        </div>
      </div>
    );
  }

  /* Tab 可见性由 drugs.json 的导出字段决定；不可见仍显示（灰态 + 该药暂无），不直接隐藏 */
  const tabs: { key: TabKey; label: string; ok: boolean; hint: string }[] = [
    {
      key: "bio",
      label: "生物分布",
      ok: (drug.n_points ?? mine.length) > 0,
      hint: `${fmt(drug.n_points ?? mine.length)} 条`,
    },
    { key: "dos", label: "剂量学", ok: (drug.n_dosim ?? 0) > 0, hint: `${fmt(drug.n_dosim ?? 0)} 条` },
    { key: "tbr", label: "靶本比", ok: (drug.has_tbr ?? 0) === 1, hint: "有记录" },
    {
      key: "refs",
      label: "文献",
      // ★ 用「药物级参考文献」的真实条数（drug_refs），而不是 biodist 来源数；
      //   无文献时不显示「该药暂无」（用户要求），只显示「文献」两个字。
      ok: (drugRefs?.length ?? drug.n_refs ?? 0) > 0,
      hint: drugRefs && drugRefs.length ? `${fmt(drugRefs.length)} 篇` : "",
    },
  ];

  return (
    <div className="pb-4">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
        className="text-[12.5px] text-ink-3 transition hover:text-brand"
      >
        ← 返回（保留筛选条件）
      </button>

      <div className="mt-3 flex flex-wrap items-baseline gap-3">
        <h1 className="text-[22px] font-bold tracking-tight sm:text-[26px]">{drug.name_en}</h1>
        <span className="rounded-full border border-[#dfe6f0] bg-[#eef2f8] px-2.5 py-0.5 text-[12px] text-[#516078]">
          # {drug.drug_id}
        </span>
        {drug.has_struct ? (
          <span className="text-[12px] text-ok">✓ 有结构图</span>
        ) : (
          <span className="text-[12px] text-ink-3">无结构图</span>
        )}
      </div>

      <section className="card mt-5 grid gap-5 p-6 md:grid-cols-4">
        <Field label="类型">{drug.drug_type ?? "—"}</Field>
        <Field label="核素">{drug.radionuclides_zh ?? "—"}</Field>
        <Field label="研发阶段">{drug.status ?? "—"}</Field>
        <Field label="中文名">{drug.name_zh ?? "—"}</Field>
        <div className="md:col-span-2">
          <Field label="靶点">{drug.targets_zh ?? "—"}</Field>
        </div>
        <div className="md:col-span-2">
          <Field label="适应症">{drug.diseases_zh ?? "—"}</Field>
        </div>
      </section>

      {/* 五段组成分解（数据来自 v_drug_overview；图只作辅助，点击可放大） */}
      <section className="card mt-5 p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[16px] font-semibold">分子组成</h2>
          <span className="text-[12px] text-ink-3">五段分解 · 缺失段显示「—」</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { k: "① 核素", v: drug.radionuclides_zh, part: null as string | null },
            { k: "② 螯合剂", v: drug.chelators_zh, part: "chelator" },
            { k: "③ 连接子", v: drug.linkers_zh, part: "linker" },
            { k: "④ 载体", v: drug.vectors_zh, part: "vector" },
            { k: "⑤ 靶点", v: drug.targets_zh, part: null },
          ].map((p) => (
            <div
              key={p.k}
              className={`rounded-[10px] border p-3 ${
                p.v ? "border-line bg-[#fafbfe]" : "border-dashed border-[#e8edf5] bg-white"
              }`}
            >
              <div className="text-[11.5px] font-medium tracking-wide text-ink-3">{p.k}</div>
              <div
                className={`mt-1.5 text-[15px] font-semibold leading-snug ${
                  p.v ? "text-ink" : "text-ink-3"
                }`}
              >
                {p.v || "—"}
              </div>
              {p.k === "① 核素" && p.v && (
                <div className="mt-1 font-mono text-[12.5px] font-semibold text-brand">
                  {p.v
                    .split("、")
                    .map((x) => {
                      const m = x.match(/^([\u4e00-\u9fa5]+)-(\d+m?)$/);
                      const E: Record<string, string> = {
                        镥: "Lu", 锝: "Tc", 镓: "Ga", 铟: "In", 碘: "I", 氟: "F", 碳: "C",
                        锆: "Zr", 铜: "Cu", 钇: "Y", 铼: "Re", 砹: "At", 铽: "Tb", 镭: "Ra",
                        铅: "Pb", 铋: "Bi", 锶: "Sr", 钐: "Sm", 钪: "Sc", 溴: "Br", 氮: "N",
                        氧: "O", 磷: "P", 硫: "S", 氢: "H", 铊: "Tl", 钡: "Ba",
                      };
                      return m ? `${E[m[1]] ?? m[1]}-${m[2]}` : x;
                    })
                    .join(" · ")}
                </div>
              )}
              {p.part && !imgErr[`part:${p.part}`] && (
                <img
                  src={`${import.meta.env.BASE_URL}parts/${drug.drug_id}_${p.part}.png`}
                  alt={`${p.k} 结构`}
                  loading="lazy"
                  onClick={() => setZoom(`${import.meta.env.BASE_URL}parts/${drug.drug_id}_${p.part}.png`)}
                  className="mt-2 w-full cursor-zoom-in rounded border border-[#eef2f8] bg-white transition hover:opacity-90"
                  onError={() => setImgErr((s) => ({ ...s, [`part:${p.part}`]: true }))}
                />
              )}
            </div>
          ))}
        </div>

        {drug.has_struct === 1 && (
          <div className="mt-5 border-t border-line pt-4">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-[13px] font-medium text-ink">
                {structSrc === "schematic" ? "分子组成示意（非精确结构）" : "完整结构图（点击放大）"}
              </span>
              <span className="text-[11.5px] text-ink-3">
                {structSrc === "ligand" && "radiopharm.idrblab.cn · 外部来源（ligand_only）"}
                {structSrc === "schematic" && "抗体/多肽示意图 · 本库绘制（非精确结构）"}
                {structSrc === "peptide2d" && "肽段 2D 结构 · 本库整理"}
                {structSrc === "rdkit" && "由库内 SMILES 经 RDKit 现画"}
                {!structSrc && "来源未标注"}
              </span>
            </div>
            <div className="flex justify-center">
              {imgErr.struct ? (
                <div className="w-full rounded-lg border border-dashed border-line bg-paper-2 px-4 py-8 text-center text-[12.5px] text-ink-3">
                  结构图加载失败（该药标记为有结构，但图片未取到）
                  <div className="mt-1 font-mono text-[11.5px]">/struct/{drug.drug_id}.webp</div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setZoom(`${import.meta.env.BASE_URL}struct/${drug.drug_id}.webp`)}
                  className="cursor-zoom-in rounded-lg transition hover:opacity-90"
                  title="点击放大"
                >
                  <img
                    src={`${import.meta.env.BASE_URL}struct/${drug.drug_id}.webp`}
                    alt={drug.name_en}
                    loading="lazy"
                    className="max-h-[380px] w-auto max-w-full rounded-lg border border-line bg-white p-3"
                    onError={() => setImgErr((s) => ({ ...s, struct: true }))}
                  />
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 4 个 Tab（B1）：可见性来自 drugs.json 导出字段；灰态 Tab 不隐藏、仍可点，
          点进去是「该药暂无 + 覆盖说明」，避免用户以为功能被砍掉 */}
      <div className="-mx-1 mt-5 px-1 pb-1">
        <div
          role="tablist"
          aria-label="单药画像分区"
          className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-[#f7f9fd] p-1 sm:inline-flex sm:shrink-0"
        >
          {tabs.map((t) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.key)}
                className={`tab min-w-0 justify-center whitespace-nowrap px-2.5 text-[12.5px] sm:px-4 sm:text-[13px] ${on ? "tab-on" : ""} ${
                  !t.ok && !on ? "text-ink-3 hover:bg-white" : ""
                }`}
              >
                {t.label}
                <span
                  className={`num text-[11.5px] ${
                    on ? "text-white/75" : t.ok ? "text-ink-3" : "text-[#a98a5c]"
                  }`}
                >
                  {t.key === "refs" ? t.hint : t.ok ? t.hint : "该药暂无"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {zoom && (
        <div
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-black/75 p-6 backdrop-blur-sm"
        >
          <img
            src={zoom}
            alt="放大预览"
            className="max-h-[90vh] max-w-[90vw] rounded-xl bg-white p-6 shadow-2xl"
          />
          <span className="pointer-events-none absolute right-6 top-5 rounded-lg bg-white/90 px-3 py-1.5 text-[13px] font-medium text-ink">
            点击任意处关闭 ✕
          </span>
        </div>
      )}

      {tab === "bio" && (
      <section className="mt-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[16px] font-semibold">生物分布记录</h2>
          <span className="text-[12.5px] text-ink-3">
            共 <b className="num text-ink-2">{fmt(mine.length)}</b> 条
            {noRawCount > 0 ? (
              <>
                {" · "}可展开原文 <b className="num text-ink-2">{fmt(mine.length - noRawCount)}</b> 条 · 仅文献级追溯{" "}
                <b className="num text-ink-2">{fmt(noRawCount)}</b> 条
              </>
            ) : (
              <> · 点任意行查看原文</>
            )}
          </span>
        </div>

        {mine.length > 0 && (
          <div className="card mt-3 p-4">
            <DrugCurve pts={mine} />
          </div>
        )}
        <div className="card mt-3 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-line bg-[#fafbfe] text-[11.5px] uppercase tracking-wide text-ink-3">
                  <th className="px-4 py-2.5 text-left font-semibold">器官</th>
                  <th className="px-4 py-2.5 text-left font-semibold">时点 (h)</th>
                  <th className="px-4 py-2.5 text-right font-semibold">值</th>
                  <th className="px-4 py-2.5 text-left font-semibold">单位</th>
                  <th className="hidden px-4 py-2.5 text-left font-semibold sm:table-cell">证据</th>
                  <th className="hidden px-4 py-2.5 text-left font-semibold sm:table-cell">PMID / 原文</th>
                </tr>
              </thead>
              <tbody>
                {mine.slice(0, 40).map((p) => (
                  <Fragment key={p.id}>
                    <tr
                      onClick={() => setOpenId(p.has_raw === 0 ? null : openId === p.id ? null : p.id)}
                      title={p.has_raw === 0 ? "该行无原文片段，仅有 PMID 可追溯" : undefined}
                      className={`border-b border-[#f1f4f9] transition ${
                        p.has_raw === 0
                          ? "cursor-default"
                          : `cursor-pointer hover:bg-[#f9fbfe] ${openId === p.id ? "bg-[#f9fbfe]" : ""}`
                      }`}
                    >
                      <td className="px-4 py-2 font-medium text-ink">
                        {p.organ_norm}
                        {p.has_raw === 0 && (
                          <span className="ml-1.5 text-[10.5px] font-normal text-ink-3 sm:hidden">仅文献</span>
                        )}
                      </td>
                      <td className="num px-4 py-2">{p.time_h ?? "—"}</td>
                      <td className="num px-4 py-2 text-right font-medium">{p.value_num}</td>
                      <td className="px-4 py-2">{p.value_unit}</td>
                      <td className="hidden px-4 py-2 sm:table-cell">
                        <span
                          className={`badge ${
                            p.evidence_grade === "A" ? "badge-a" : p.evidence_grade === "C" ? "badge-c" : "badge-b"
                          }`}
                        >
                          {p.evidence_grade ?? "—"}
                        </span>
                      </td>
                      <td className="hidden px-4 py-2 sm:table-cell">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {(() => {
                            const L = refLink(p.doc_pmid);
                            return L.href ? (
                              <a
                                href={L.href}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="num text-brand underline decoration-dashed underline-offset-2"
                              >
                                {p.doc_pmid}
                              </a>
                            ) : (
                              <span className="text-ink-3">—</span>
                            );
                          })()}
                          {p.has_raw === 0 && (
                            <span
                              className="rounded border border-dashed border-[#cbd5e1] px-1.5 py-0.5 text-[10.5px] font-medium text-ink-3"
                              title="该行没有原文片段，只能追到 PMID 指向的文献"
                            >
                              仅文献级追溯
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {openId === p.id && p.has_raw !== 0 && (
                      <tr className="border-b border-[#f1f4f9]">
                        <td colSpan={6} className="bg-[#fafbfe] px-4 py-3">
                          <div className="text-[12px] leading-relaxed text-ink-2">
                            <span className="font-medium text-ink">原文片段：</span>
                            {raw?.[String(p.id)] ?? "（该行无原文片段）"}
                          </div>
                          <div className="mt-1.5 text-[11.5px] text-ink-3">
                            source_kind = {p.source_kind} · subject_key = {p.subject_key ?? "—"} · 行 id ={" "}
                            {p.id}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {!mine.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="text-[13.5px] font-medium text-ink-2">
                        该药在库内暂无生物分布记录
                      </div>
                      <div className="mt-1.5 text-[12.5px] text-ink-3">
                        全库 {drugs ? drugs.length.toLocaleString("en-US") : "…"} 个核药中，有分布数据的仅{" "}
                        <b className="text-ink-2">{drugs ? drugs.filter((d) => (d.n_points ?? 0) > 0).length.toLocaleString("en-US") : "…"}</b>{" "}
                        个 —— 这是数据覆盖范围，不是本页故障
                      </div>
                      <Link
                        to="/"
                        className="mt-4 inline-block rounded-lg border border-brand bg-brand-soft px-4 py-2 text-[13px] font-medium text-brand-deep transition hover:bg-brand/15"
                      >
                        回总览检索其他核药 →
                      </Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      )}

      {tab === "dos" && (
        <section className="mt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[16px] font-semibold">剂量学</h2>
            <span className="text-[12.5px] text-ink-3">
              {(drug.n_dosim ?? 0) > 0 ? "同一器官多口径并列，不跨单位合并" : "该药暂无剂量学记录"}
            </span>
          </div>
          <div className="mt-3">
            <DosimetryPanel drugId={drug.drug_id} />
          </div>
        </section>
      )}

      {tab === "tbr" && (
        <section className="mt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[16px] font-semibold">靶本比</h2>
            <span className="text-[12.5px] text-ink-3">
              {(drug.has_tbr ?? 0) === 1 ? "明细未随本站导出 · 以原文为准" : "库内无 TBR 记录"}
            </span>
          </div>
          <div className="mt-3">
            <TbrPanel pts={mine} hasTbr={(drug.has_tbr ?? 0) === 1} onGoBio={() => setTab("bio")} />
          </div>
        </section>
      )}

      {tab === "refs" && (
      <section className="mt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[16px] font-semibold">相关文献</h2>
          <span className="text-[12.5px] text-ink-3">
            {drugRefs === null
              ? "加载中…"
              : `共 ${fmt(refList.length)} 篇 = 分布来源 ${fmt(srcRefs.length)} + 其他 ${fmt(otherRefs.length)}`}
          </span>
        </div>

        {drugRefs !== null &&
          [
            { key: "src", title: "生物分布来源", tone: "src", items: srcRefs,
              hint: "该药分布数值的出处 —— 能和「生物分布」Tab 里的 PMID 对上" },
            { key: "other", title: "其他相关文献", tone: "other", items: otherRefs,
              hint: "背景 / 方法 / 临床研究；未直接提供本站的分布数值" },
          ]
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <div key={g.key} className="mt-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-[13.5px] font-semibold">
                    <span
                      className={
                        g.tone === "src"
                          ? "rounded bg-[#dcfce7] px-1.5 py-0.5 text-[10.5px] font-medium text-[#166534]"
                          : "rounded bg-[#eef2f8] px-1.5 py-0.5 text-[10.5px] font-medium text-ink-3"
                      }
                    >
                      {g.tone === "src" ? "来源" : "背景"}
                    </span>
                    {g.title} · {fmt(g.items.length)} 篇
                  </h3>
                  <span className="text-[11.5px] text-ink-3">{g.hint}</span>
                </div>
                <div className="card mt-2 divide-y divide-[#f1f4f9]">
                  {g.items.slice(0, 30).map((r) => {
                    const L = refLink(r.pmid);
                    return (
                      <div key={r.pmid} className="px-5 py-3">
                        {L.href ? (
                          <a
                            href={L.href}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[13px] font-medium text-brand hover:underline"
                          >
                            {r.title || L.text}
                          </a>
                        ) : (
                          <span className="text-[13px] font-medium text-ink-2">{r.title || L.text}</span>
                        )}
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-3">
                          <span
                            className={`num ${
                              L.kind === "nct" || L.kind === "url"
                                ? "rounded bg-[#eef2f8] px-1.5 py-0.5 text-[10.5px] text-ink-2"
                                : ""
                            }`}
                          >
                            {L.text}
                          </span>
                          <span>· {r.journal ?? "—"} {r.year ?? ""}</span>
                        </div>
                      </div>
                    );
                  })}
                  {g.items.length > 30 && (
                    <div className="px-5 py-3 text-[12px] text-ink-3">
                      仅显示前 30 篇（共 {fmt(g.items.length)} 篇）—— 按 PMID 升序。
                    </div>
                  )}
                </div>
              </div>
            ))}

        {drugRefs !== null && !refList.length && (
          <div className="card mt-3">
            <EmptyState
              title="该药暂无关联文献"
              hint="库内既没有它的生物分布来源文献，也没有药物级参考文献关联。"
            >
              {(drug.n_points ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => setTab("bio")}
                  className="rounded-lg border border-line bg-white px-3.5 py-2 text-[12.5px] font-medium text-ink-2 transition hover:border-[#b9d0e9] hover:shadow-s2"
                >
                  去「生物分布」看原始记录 →
                </button>
              )}
            </EmptyState>
          </div>
        )}
      </section>
      )}
    </div>
  );
}

