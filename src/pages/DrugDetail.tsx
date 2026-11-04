import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useJSON, fmt, loadFigManifest, refLink, type Drug, type Fig, type Point } from "../lib/data";
import { enSafe, nuclideEn, stageLabel, useLang, useT } from "../lib/i18n";
import { Chart, PALETTE, AXIS } from "../components/Chart";
import DosimetryPanel from "../components/DosimetryPanel";
import { EmptyState, ErrorState, TableSkeleton } from "../components/States";
import ImageViewer from "../components/ImageViewer";

type Ref = { pmid: string; title: string | null; journal: string | null; year: number | null };

/** 单药画像的 4 个 Tab（pk262 B1） */
type TabKey = "bio" | "dos" | "tbr" | "refs" | "img";

/** 文献影像图（pk295 U1）：类型与加载都来自 `lib/data`（与图集页共用一次下载/解析） */
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

/** 生物分布可视化（2026-11-03 重构）。
 *  旧版只画「时间-摄取曲线」，但实测 808 个有数据的药里 584 个（72.3%）只有单个时点 ⇒
 *  大多数药只看到一句「不足以画趋势」。现在：
 *  ① 默认「器官对比」散点（单时点也成立 · 不聚合、不跨文献连线 · 按时点上色）；
 *  ② 只有存在「同一器官 ≥2 个时点」时才提供「时间曲线」，按 PMID 分段断线、可切线性/对数；
 *  ③ 单位分开选：%ID/g 3,110 行 / %ID 256 行 / %ID/mL 25 行，混在一个轴上会失真。 */
function DrugCurve({ pts }: { pts: Point[] }) {
  const tr = useT();
  const { lang } = useLang();
  const units = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pts) m.set(p.value_unit, (m.get(p.value_unit) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [pts]);
  const [unit, setUnit] = useState(() => units[0]?.[0] ?? "");
  const [view, setView] = useState<"organ" | "curve">("organ");
  const [logX, setLogX] = useState(false);

  const rows = useMemo(() => pts.filter((p) => p.value_unit === unit && p.value_num > 0), [pts, unit]);

  const times = useMemo(() => {
    const s = new Set<number>();
    for (const p of rows) if (p.time_h !== null && p.time_h > 0) s.add(p.time_h);
    return [...s].sort((a, b) => a - b);
  }, [rows]);

  /** 可画时间曲线的器官（同一器官 ≥2 个时点） */
  const curvable = useMemo(() => {
    const m = new Map<string, Set<number>>();
    for (const p of rows) {
      if (p.time_h === null || p.time_h <= 0) continue;
      const s = m.get(p.organ_norm) ?? new Set<number>();
      s.add(p.time_h);
      m.set(p.organ_norm, s);
    }
    return [...m.entries()].filter(([, s]) => s.size >= 2).map(([k]) => k);
  }, [rows]);

  /** 换药后若原单位已不存在，回落到行数最多的单位 */
  useEffect(() => {
    if (units.length && !units.some(([u]) => u === unit)) setUnit(units[0][0]);
  }, [units, unit]);

  /** 「器官对比」：x = 器官（按最大值降序取前 12），按时点分色，不聚合 */
  const organOption = useMemo(() => {
    const organs = (() => {
      const m = new Map<string, number>();
      for (const p of rows) m.set(p.organ_norm, Math.max(m.get(p.organ_norm) ?? 0, p.value_num));
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k]) => k);
    })();
    const mk = (arr: Point[]) =>
      arr.map((p) => ({
        value: p.value_num,
        name: p.organ_norm,
        sd: p.value_sd,
        pmid: p.doc_pmid,
        species: p.species,
      }));
    const series: { name: string; type: "scatter"; symbolSize: number; data: unknown[] }[] = times
      .slice(0, 6)
      .map((t) => ({
        name: `${t} h`,
        type: "scatter",
        symbolSize: 9,
        data: mk(rows.filter((p) => p.time_h === t && organs.includes(p.organ_norm))),
      }));
    const noT = rows.filter((p) => (p.time_h === null || p.time_h <= 0) && organs.includes(p.organ_norm));
    if (noT.length) series.push({ name: tr("drug.chartNoTime"), type: "scatter", symbolSize: 9, data: mk(noT) });

    return {
      color: PALETTE,
      /* 动效：先出坐标轴、再错峰落点（600ms / cubicOut / 每系列 +40ms） */
      animationDuration: 600,
      animationEasing: "cubicOut" as const,
      animationDelay: (idx: number) => idx * 40,
      tooltip: {
        trigger: "item" as const,
        formatter: (q: {
          data: { name?: string; value: number; sd?: number | null; pmid?: string | null; species?: string | null };
        }) => {
          const d = q.data;
          const sd = d.sd != null ? ` ± ${d.sd}` : "";
          return [
            `<b>${d.name}</b>`,
            `${d.value}${sd} ${unit}`,
            d.species ? tr("drug.chartSpecies", { s: d.species }) : "",
            d.pmid ? `PMID ${d.pmid}` : "",
          ]
            .filter(Boolean)
            .join("<br/>");
        },
      },
      legend: { type: "scroll" as const, top: 0, textStyle: { fontSize: 11, color: "#475569" } },
      grid: { left: 56, right: 18, top: 40, bottom: 62 },
      xAxis: {
        type: "category" as const,
        data: organs,
        axisLabel: { color: "#94a3b8", fontSize: 10.5, rotate: 32, interval: 0 },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#e4e9f2" } },
      },
      yAxis: { type: "value" as const, name: unit, nameTextStyle: { color: "#94a3b8", fontSize: 11 }, ...AXIS },
      series,
    };
  }, [rows, times, unit, lang]);

  /** 「时间曲线」：每个器官一条线，按 PMID 分段（换文献处断线，不把两篇论文连成一条趋势） */
  const curveOption = useMemo(() => {
    const series = curvable.slice(0, 6).map((organ) => {
      const arr = rows.filter((p) => p.organ_norm === organ && p.time_h !== null && p.time_h > 0);
      const byPmid = new Map<string, Point[]>();
      for (const p of arr) {
        const k = p.doc_pmid ?? "—";
        const cur = byPmid.get(k);
        if (cur) cur.push(p);
        else byPmid.set(k, [p]);
      }
      const data: ({ value: [number, number]; pmid: string | null } | null)[] = [];
      for (const [, group] of byPmid) {
        for (const p of [...group].sort((a, b) => (a.time_h as number) - (b.time_h as number))) {
          data.push({ value: [p.time_h as number, p.value_num], pmid: p.doc_pmid });
        }
        data.push(null);
      }
      return { name: organ, type: "line" as const, symbolSize: 6, connectNulls: false, smooth: false, data };
    });
    return {
      color: PALETTE,
      /* 动效：曲线同样 600ms 生长；换视图时用 300ms 过渡，不闪 */
      animationDuration: 600,
      animationDurationUpdate: 300,
      animationEasing: "cubicOut" as const,
      animationEasingUpdate: "cubicOut" as const,
      tooltip: {
        trigger: "item" as const,
        formatter: (q: { seriesName: string; data: { value: [number, number]; pmid: string | null } | null }) => {
          if (!q.data) return "";
          const [t, v] = q.data.value;
          return `<b>${q.seriesName}</b><br/>${t} h → ${v} ${unit}` + (q.data.pmid ? `<br/>PMID ${q.data.pmid}` : "");
        },
      },
      legend: { type: "scroll" as const, top: 0, textStyle: { fontSize: 11, color: "#475569" } },
      grid: { left: 56, right: 18, top: 40, bottom: 40 },
      xAxis: {
        type: logX ? ("log" as const) : ("value" as const),
        name: logX ? tr("drug.chartTimeLog") : tr("drug.chartTime"),
        nameTextStyle: { color: "#94a3b8", fontSize: 11 },
        ...AXIS,
      },
      yAxis: { type: "log" as const, name: unit, nameTextStyle: { color: "#94a3b8", fontSize: 11 }, ...AXIS },
      series,
    };
  }, [rows, curvable, unit, logX, lang]);

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-dashed border-[#e8edf5] px-4 py-5 text-center text-[12.5px] text-ink-3">
        {tr("drug.chartEmpty", { u: unit || "—" })}
      </div>
    );
  }
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-medium text-ink">{tr("drug.chartTitle")}</span>
        {units.length > 1 && (
          <span className="flex flex-wrap items-center gap-1">
            {units.map(([u, n]) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                className={`rounded-full border px-2.5 py-0.5 text-[11.5px] transition ${
                  unit === u ? "border-brand bg-brand-soft text-brand-deep" : "border-line bg-white text-ink-2 hover:border-[#b9d0e9]"
                }`}
              >
                {u} · {n}
              </button>
            ))}
          </span>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setView("organ")}
            className={`rounded-full border px-2.5 py-0.5 text-[11.5px] transition ${
              view === "organ" ? "border-brand bg-brand-soft text-brand-deep" : "border-line bg-white text-ink-2 hover:border-[#b9d0e9]"
            }`}
          >
            {tr("drug.chartOrgan")}
          </button>
          <button
            type="button"
            onClick={() => setView("curve")}
            disabled={!curvable.length}
            title={curvable.length ? tr("drug.chartCurveHint") : tr("drug.chartCurveOff")}
            className={`rounded-full border px-2.5 py-0.5 text-[11.5px] transition ${
              view === "curve" ? "border-brand bg-brand-soft text-brand-deep" : "border-line bg-white text-ink-2 hover:border-[#b9d0e9]"
            } ${curvable.length ? "" : "cursor-not-allowed opacity-45 hover:border-line"}`}
          >
            {tr("drug.chartCurve")}{curvable.length ? "" : tr("drug.unavailable")}
          </button>
          {view === "curve" && (
            <button
              type="button"
              onClick={() => setLogX((v) => !v)}
              className="rounded-full border border-line bg-white px-2.5 py-0.5 text-[11.5px] text-ink-2 transition hover:border-[#b9d0e9]"
            >
              {logX ? tr("drug.axisLinear") : tr("drug.axisLog")}
            </button>
          )}
        </span>
      </div>
      <Chart option={view === "organ" ? organOption : curveOption} height={340} />
      <div className="mt-1.5 text-[11.5px] leading-relaxed text-ink-3">
        {view === "organ"
          ? tr("drug.chartNoteOrgan", { u: unit })
          : tr("drug.chartNoteCurve", { n: curvable.length })}
      </div>
    </div>
  );
}

/** 靶本比 Tab：`drugs.json` 的 `has_tbr=1` 只说明「库内该药有 TBR 记录」，
 *  TBR 明细不在 `public/data/` 导出层（导出脚本受红线保护，本轮不改）。
 *  这里**不自行重算比值**（分子/分母/时点口径各篇论文不同，前端重算会造出第二份口径），
 *  只把能看见的「分子」摊开 —— 该药的肿瘤摄取点，分母去「生物分布」Tab 对照。 */
function TbrPanel({ pts, hasTbr, onGoBio }: { pts: Point[]; hasTbr: boolean; onGoBio: () => void }) {
  const tr = useT();
  const tumor = useMemo(() => pts.filter((p) => p.is_tumor === 1), [pts]);

  const goBio = (
    <button
      type="button"
      onClick={onGoBio}
      className="rounded-lg border border-line bg-white px-3.5 py-2 text-[12.5px] font-medium text-ink-2 transition hover:-translate-y-px hover:border-[#b9d0e9] hover:shadow-s2"
    >
      {tr("drug.tbrGoBio")}
    </button>
  );

  /* 库内没有 TBR 记录：不摆空表、不补算，给一句「为什么空」+ 一条能走的路 */
  if (!hasTbr) {
    return (
      <div className="card p-5 sm:p-6">
        <EmptyState
          title={tr("drug.tbrEmptyTitle")}
          hint={tr("drug.tbrEmptyHint")}
        >
          {goBio}
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="card p-5 sm:p-6">
      <div className="rounded-[10px] border border-[#f6e3c8] bg-[#fdf3e7] px-3.5 py-3 text-[12.5px] leading-relaxed text-[#8a5310]">
        <b>{tr("drug.tbrBannerTitle")}</b>
        {tr("drug.tbrBannerBody", { extra: tumor.length > 0 ? tr("drug.tbrBannerExtra") : "" })}
      </div>

      {tumor.length > 0 ? (
        <>
          <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[13px] font-medium text-ink">{tr("drug.tbrTumourTitle")}</span>
            <span className="text-[11.5px] text-ink-3">
              {tr("drug.tbrTumourCount", { n: fmt(tumor.length) })}
            </span>
          </div>
          <div className="mt-2 hscroll rounded-[10px] border border-line">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-line bg-[#fafbfe] text-[11.5px] uppercase tracking-wide text-ink-3">
                  <th className="px-4 py-2 text-left font-semibold">{tr("drug.thOrganModel")}</th>
                  <th className="px-4 py-2 text-left font-semibold">{tr("drug.thTime")}</th>
                  <th className="px-4 py-2 text-right font-semibold">{tr("drug.thValue")}</th>
                  <th className="px-4 py-2 text-left font-semibold">{tr("drug.thUnit")}</th>
                  <th className="px-4 py-2 text-left font-semibold">{tr("drug.thEvidence")}</th>
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
          {tr("drug.tbrNoTumour")}
        </div>
      )}

      <div className="mt-4">{goBio}</div>
    </div>
  );
}

export default function DrugDetail() {
  const tr = useT();
  const { lang } = useLang();
  const { id } = useParams();
  const navigate = useNavigate();
  const did = id ? Number(id) : 0;
  const { data: drugs, error: drugsErr, loading: drugsLoading, reload: reloadDrugs } = useJSON<Drug[]>("drugs.json");
  const { data: pts } = useJSON<Point[]>("biodist.json");
  const { data: raw } = useJSON<Record<string, string>>("raw.json");
  const [pick, setPick] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [zoom, setZoom] = useState<{ src: string; alt?: string; pmc?: string } | null>(null);
  const [tab, setTab] = useState<TabKey>("bio");
  // ★ 结构图来源（884 浙大 / 575 示意图 / 11 肽段 2D / 759 本地 RDKit）：此前一律标成 radiopharm，属错标
  const [structSrc, setStructSrc] = useState<string | null>(null);
  // ★ 文献 Tab 数字：挂载即取 drug_refs（104 KB，小）；题录 refs_all（979 KB）仍懒加载
  const [drugRefs, setDrugRefs] = useState<string[] | null>(null);
  const [refMeta, setRefMeta] = useState<Record<string, Ref> | null>(null);
  // ★ 文献影像（pk295 U1）：`figs/manifest.json` 每条带 drug_id ⇒ 单药可直接筛
  const [figs, setFigs] = useState<Fig[] | null>(null);
  /** 全库影像规模：用于空态说明「不是坏了，是这药还没命中」 */
  const [figStats, setFigStats] = useState<{ total: number; drugs: number } | null>(null);

  useEffect(() => {
    let alive = true;
    loadFigManifest()
      .then((m) => {
        if (!alive) return;
        setFigs(m.filter((f) => f.drug_id === did));
        const s = new Set<number>();
        for (const f of m) s.add(f.drug_id);
        setFigStats({ total: m.length, drugs: s.size });
      })
      .catch(() => alive && setFigs([]));
    return () => {
      alive = false;
    };
  }, [did]);

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
  /** ★ 2026-11-04：`schematic` 不再当作「结构图」展示 —— 这批 575 张是**海报式示意图**
   *  （抗体 Y 形卡通 + 大量中文标注，含"核素/螯合剂/半衰期"等重复信息），既无结构信息、
   *  又会在英文站露出中文（站内自检只扫 DOM，扫不到图片像素）。等浙大 2D 图补齐后再替换。 */
  const hasRealStruct = drug?.has_struct === 1 && structSrc !== "schematic";

  /** 器官去重数：详情页头「关键指标」用（同一器官多个时点只算一次） */
  const organCount = useMemo(() => new Set(mine.map((p) => p.organ_norm)).size, [mine]);
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
      img: (figs?.length ?? 0) > 0,
    };
    setTab((cur) => (ok[cur] ? cur : TAB_ORDER.find((k) => ok[k]) ?? "bio"));
  }, [drug, mine.length, figs?.length]);

  /* 无 id ⇒ 选择器（导航「单药画像」直接进来时） */
  if (!did) {
    return (
      <div className="pb-4">
        <h1 className="text-[26px] font-bold tracking-tight">{tr("drug.title")}</h1>
        <p className="mt-1.5 text-[13px] text-ink-3 text-balance">{tr("drug.lead")}</p>
        <div className="card mt-5 p-6">
          <input
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            placeholder={tr("drug.searchPh")}
            className="h-10 w-full rounded-[10px] border border-line bg-white px-3.5 text-[13.5px] outline-none focus:border-[#9dc0ea] focus:ring-[3px] focus:ring-brand/10"
          />
          {drugsErr && (
            <div className="mt-4">
              <ErrorState message={tr("drug.errDrugs") + drugsErr} onRetry={reloadDrugs} />
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
              title={tr("drug.noMatch")}
              hint={tr("drug.noMatchHint", { q: pick.trim(), n: fmt(drugs?.length ?? 0) })}
            >
              <button
                type="button"
                onClick={() => setPick("")}
                className="rounded-lg border border-brand bg-brand-soft px-3.5 py-2 text-[12.5px] font-medium text-brand-deep transition hover:bg-brand/15"
              >
                {tr("drug.clearKw")}
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
                    {d.has_struct ? tr("drug.hasStructTag") : ""}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {drugs && !drugsErr && (
            <div className="mt-3 text-[12px] text-ink-3">
              {tr("drug.listCount", { n: fmt(drugs.length) })}
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
          <ErrorState message={tr("drug.errDrugs") + drugsErr} onRetry={reloadDrugs} />
        </div>
      );
    }
    if (drugsLoading) return <DetailSkeleton />;
    return (
      <div className="pb-4">
        <div className="card mt-5">
          <EmptyState
            title={tr("drug.notFoundTitle", { id: did })}
            hint={tr("drug.notFoundHint")}
          >
            <Link
              to="/"
              className="rounded-lg border border-line bg-white px-3.5 py-2 text-[12.5px] font-medium text-ink-2 transition hover:border-[#b9d0e9] hover:shadow-s2"
            >
              {tr("drug.backOverview")}
            </Link>
            <Link
              to="/drug"
              className="rounded-lg border border-brand bg-brand-soft px-3.5 py-2 text-[12.5px] font-medium text-brand-deep transition hover:bg-brand/15"
            >
              {tr("drug.pickByName")}
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
      label: tr("drug.tabBio"),
      ok: (drug.n_points ?? mine.length) > 0,
      hint: tr("drug.rows", { n: fmt(drug.n_points ?? mine.length) }),
    },
    {
      key: "dos",
      label: tr("drug.tabDos"),
      ok: (drug.n_dosim ?? 0) > 0,
      hint: tr("drug.rows", { n: fmt(drug.n_dosim ?? 0) }),
    },
    { key: "tbr", label: tr("drug.tabTbr"), ok: (drug.has_tbr ?? 0) === 1, hint: tr("drug.hasRecord") },
    {
      key: "refs",
      label: tr("drug.tabRefs"),
      // ★ 用「药物级参考文献」的真实条数（drug_refs），而不是 biodist 来源数；
      //   无文献时不显示「该药暂无」（用户要求），只显示「文献」两个字。
      ok: (drugRefs?.length ?? drug.n_refs ?? 0) > 0,
      hint: drugRefs && drugRefs.length ? tr("drug.articles", { n: fmt(drugRefs.length) }) : "",
    },
    {
      key: "img",
      label: tr("drug.tabImg"),
      // pk295 U1：figs/manifest.json 里该药的图（含 target/unclear/comparator 三类，渲染时分区）
      ok: (figs?.length ?? 0) > 0,
      hint: figs && figs.length ? tr("drug.figsN", { n: fmt(figs.length) }) : "",
    },
  ];

  return (
    <div className="pb-4">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
        className="text-[12.5px] text-ink-3 transition hover:text-brand"
      >
        {tr("drug.back")}
      </button>

      {/* 详情页页头（2026-11-04 v4）：结构缩略 + 药名 + 编号 + 一行关键指标 + 渐变细条 */}
      <section className="card mt-3 flex flex-wrap items-center gap-4 p-4">
        <div className="hidden h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-line bg-white sm:flex">
          {hasRealStruct && !imgErr.struct ? (
            <img
              src={`${import.meta.env.BASE_URL}struct/${drug.drug_id}.webp`}
              alt={drug.name_en}
              loading="lazy"
              className="h-full w-full object-contain p-1"
            />
          ) : (
            <span className="px-1 text-center text-[10.5px] leading-tight text-ink-3">{tr("drug.noStruct")}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h1 className="font-sans text-[22px] font-bold tracking-tight sm:text-[26px]">{drug.name_en}</h1>
            <span className="rounded-full border border-[#dfe6f0] bg-[#eef2f8] px-2.5 py-0.5 text-[12px] text-[#516078]">
              # {drug.drug_id}
            </span>
            <span className={`text-[12px] ${hasRealStruct ? "text-ok" : "text-ink-3"}`}>
              {hasRealStruct ? tr("drug.hasStruct") : tr("drug.noStruct")}
            </span>
          </div>
          <span
            aria-hidden
            className="mt-2 block h-[3px] w-16 rounded-full bg-gradient-to-r from-brand via-[#4a8ee0] to-accent"
          />
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-3">
            <span>
              {tr("drug.tabBio")} <b className="num text-ink-2">{fmt(mine.length)}</b>
            </span>
            <span>
              {tr("drug.thOrgan")} <b className="num text-ink-2">{fmt(organCount)}</b>
            </span>
            <span>
              {tr("drug.tabRefs")} <b className="num text-ink-2">{fmt(drugRefs?.length ?? drug.n_refs ?? 0)}</b>
            </span>
            <span>
              {tr("drug.tabDos")} <b className="num text-ink-2">{fmt(drug.n_dosim ?? 0)}</b>
            </span>
          </div>
        </div>
      </section>

      <section className="card mt-5 grid gap-5 p-6 md:grid-cols-4">
        <Field label={tr("drug.fType")}>{enSafe(lang, drug.drug_type) || "—"}</Field>
        <Field label={tr("drug.fIsotope")}>
          {lang === "en" ? nuclideEn(drug.radionuclides_zh) || "—" : drug.radionuclides_zh || "—"}
        </Field>
        <Field label={tr("drug.fStage")}>{drug.status ? stageLabel(lang, drug.status) : "—"}</Field>
        <Field label={tr("drug.fNameZh")}>{enSafe(lang, drug.name_zh) || "—"}</Field>
        <div className="md:col-span-2">
          <Field label={tr("drug.fTargets")}>{enSafe(lang, drug.targets_zh) || "—"}</Field>
        </div>
        <div className="md:col-span-2">
          <Field label={tr("drug.fDiseases")}>{enSafe(lang, drug.diseases_zh) || "—"}</Field>
        </div>
      </section>

      {/* 五段组成分解（数据来自 v_drug_overview；图只作辅助，点击可放大） */}
      <section className="card mt-5 p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[16px] font-semibold"><span className="sec-no">01</span>{tr("drug.parts")}</h2>
          <span className="text-[12px] text-ink-3">{tr("drug.partsHint")}</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { key: "isotope", k: tr("drug.partIsotope"), v: drug.radionuclides_zh, part: null as string | null },
            { key: "chelator", k: tr("drug.partChelator"), v: drug.chelators_zh, part: "chelator" },
            { key: "linker", k: tr("drug.partLinker"), v: drug.linkers_zh, part: "linker" },
            { key: "vector", k: tr("drug.partVector"), v: drug.vectors_zh, part: "vector" },
            { key: "target", k: tr("drug.partTarget"), v: drug.targets_zh, part: null },
          ].map((p) => (
            <div
              key={p.key}
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
                {p.v
                  ? p.key === "isotope"
                    ? lang === "en"
                      ? nuclideEn(p.v)
                      : p.v
                    : enSafe(lang, p.v) || "—"
                  : "—"}
              </div>
              {p.key === "isotope" && p.v && (
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
                  alt={tr("drug.partAlt", { k: p.k })}
                  loading="lazy"
                  onClick={() =>
                    setZoom({
                      src: `${import.meta.env.BASE_URL}parts/${drug.drug_id}_${p.part}.png`,
                      alt: tr("drug.partAltZoom", { d: drug.name_en, k: p.k }),
                    })
                  }
                  className="mt-2 w-full cursor-zoom-in rounded border border-[#eef2f8] bg-white transition hover:opacity-90"
                  onError={() => setImgErr((s) => ({ ...s, [`part:${p.part}`]: true }))}
                />
              )}
            </div>
          ))}
        </div>

        {hasRealStruct && (
          <div className="mt-5 border-t border-line pt-4">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-[13px] font-medium text-ink">
                {structSrc === "schematic"
                  ? tr("drug.structSchematic")
                  : structSrc === "ligand"
                  ? tr("drug.structTitleLigand")
                  : structSrc === "peptide2d"
                  ? tr("drug.structTitlePeptide")
                  : tr("drug.structTitleSmiles")}
              </span>
              <span className="text-[11.5px] text-ink-3">
                {structSrc === "ligand" && tr("drug.structSrcLigand")}
                {structSrc === "schematic" && tr("drug.structSrcSchematic")}
                {structSrc === "peptide2d" && tr("drug.structSrcPeptide")}
                {structSrc === "rdkit" && tr("drug.structSrcRdkit")}
                {!structSrc && tr("drug.structSrcUnknown")}
              </span>
            </div>
            <div className="flex justify-center">
              {imgErr.struct ? (
                <div className="w-full rounded-lg border border-dashed border-line bg-paper-2 px-4 py-8 text-center text-[12.5px] text-ink-3">
                  {tr("drug.structLoadFail")}
                  <div className="mt-1 font-mono text-[11.5px]">/struct/{drug.drug_id}.webp</div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setZoom({
                      src: `${import.meta.env.BASE_URL}struct/${drug.drug_id}.webp`,
                      alt: tr("drug.structAlt", { d: drug.name_en }),
                    })
                  }
                  className="cursor-zoom-in rounded-lg transition duration-200 ease-out hover:scale-[1.015] hover:shadow-s2"
                  title={tr("drug.clickZoom")}
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
          aria-label={tr("drug.tablist")}
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
                  {t.key === "refs" ? t.hint : t.ok ? t.hint : tr("drug.none")}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {zoom && (
        <ImageViewer
          src={zoom.src}
          alt={zoom.alt}
          onClose={() => setZoom(null)}
          footer={
            zoom.pmc ? (
              <a
                className="underline decoration-dashed underline-offset-2 hover:text-white"
                href={`https://pmc.ncbi.nlm.nih.gov/articles/${zoom.pmc}/`}
                target="_blank"
                rel="noreferrer"
              >
                {tr("atlas.pmc")}
              </a>
            ) : undefined
          }
        />
      )}

      {tab === "bio" && (
      <section className="mt-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[16px] font-semibold"><span className="sec-no">02</span>{tr("drug.bioTitle")}</h2>
          <span className="text-[12.5px] text-ink-3">
            {tr("drug.bioCount", { n: fmt(mine.length) })}
            {noRawCount > 0 ? (
              <>
                {" · "}
                {tr("drug.bioExpandable", { n: fmt(mine.length - noRawCount) })}
                {" · "}
                {tr("drug.traceOnlyShort", { n: fmt(noRawCount) })}
              </>
            ) : (
              <> · {tr("drug.bioClickRow")}</>
            )}
          </span>
        </div>

        {mine.length > 0 && (
          <div className="card mt-3 p-4">
            <DrugCurve pts={mine} />
          </div>
        )}
        <div className="card mt-3 overflow-hidden">
          <div className="hscroll">
            <table className="table-booktabs w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-line bg-[#fafbfe] text-[11.5px] uppercase tracking-wide text-ink-3">
                  <th className="px-4 py-2.5 text-left font-semibold">{tr("drug.thOrgan")}</th>
                  <th className="px-4 py-2.5 text-left font-semibold">{tr("drug.thTime")}</th>
                  <th className="px-4 py-2.5 text-right font-semibold">{tr("drug.thValue")}</th>
                  <th className="px-4 py-2.5 text-left font-semibold">{tr("drug.thUnit")}</th>
                  <th className="hidden px-4 py-2.5 text-left font-semibold sm:table-cell">{tr("drug.thEvidence")}</th>
                  <th className="hidden px-4 py-2.5 text-left font-semibold sm:table-cell">{tr("drug.thPmidRaw")}</th>
                </tr>
              </thead>
              <tbody>
                {mine.slice(0, 40).map((p) => (
                  <Fragment key={p.id}>
                    <tr
                      onClick={() => setOpenId(p.has_raw === 0 ? null : openId === p.id ? null : p.id)}
                      title={p.has_raw === 0 ? tr("drug.rowNoRawTitle") : undefined}
                      className={`border-b border-[#f1f4f9] transition ${
                        p.has_raw === 0
                          ? "cursor-default"
                          : `cursor-pointer hover:bg-[#f9fbfe] ${openId === p.id ? "bg-[#f9fbfe]" : ""}`
                      }`}
                    >
                      <td className="px-4 py-2 font-medium text-ink">
                        {p.organ_norm}
                        {p.has_raw === 0 && (
                          <span className="ml-1.5 text-[10.5px] font-normal text-ink-3 sm:hidden">{tr("drug.onlyLit")}</span>
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
                              title={tr("drug.rowNoRawTitle")}
                            >
                              {tr("drug.traceOnly")}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {openId === p.id && p.has_raw !== 0 && (
                      <tr className="border-b border-[#f1f4f9]">
                        <td colSpan={6} className="bg-[#fafbfe] px-4 py-3">
                          <div className="text-[12px] leading-relaxed text-ink-2">
                            <span className="font-medium text-ink">{tr("drug.rawSnippet")}</span>
                            {raw?.[String(p.id)] ?? tr("drug.noRawPlaceholder")}
                          </div>
                          <div className="mt-1.5 text-[11.5px] text-ink-3">
                            source_kind = {p.source_kind} · subject_key = {p.subject_key ?? "—"} · row id ={" "}
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
                        {tr("drug.bioEmptyTitle")}
                      </div>
                      <div className="mt-1.5 text-[12.5px] text-ink-3">
                        {tr("drug.bioEmptyHint", {
                          a: drugs ? drugs.length.toLocaleString("en-US") : "…",
                          b: drugs
                            ? drugs.filter((d) => (d.n_points ?? 0) > 0).length.toLocaleString("en-US")
                            : "…",
                        })}
                      </div>
                      <Link
                        to="/"
                        className="mt-4 inline-block rounded-lg border border-brand bg-brand-soft px-4 py-2 text-[13px] font-medium text-brand-deep transition hover:bg-brand/15"
                      >
                        {tr("drug.bioEmptyCta")}
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
            <h2 className="text-[16px] font-semibold"><span className="sec-no">03</span>{tr("drug.tabDos")}</h2>
            <span className="text-[12.5px] text-ink-3">
              {(drug.n_dosim ?? 0) > 0 ? tr("drug.dosNote") : tr("drug.dosEmpty")}
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
            <h2 className="text-[16px] font-semibold"><span className="sec-no">04</span>{tr("drug.tabTbr")}</h2>
            <span className="text-[12.5px] text-ink-3">
              {(drug.has_tbr ?? 0) === 1 ? tr("drug.tbrNote") : tr("drug.tbrNone")}
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
          <h2 className="text-[16px] font-semibold"><span className="sec-no">05</span>{tr("drug.refsTitle")}</h2>
          <span className="text-[12.5px] text-ink-3">
            {drugRefs === null
              ? tr("common.loading") + "…"
              : tr("drug.refsCount", {
                  a: fmt(refList.length),
                  b: fmt(srcRefs.length),
                  c: fmt(otherRefs.length),
                })}
          </span>
        </div>

        {drugRefs !== null &&
          [
            { key: "src", title: tr("drug.refsSrc"), tone: "src", items: srcRefs,
              hint: tr("drug.refsSrcHint") },
            { key: "other", title: tr("drug.refsOther"), tone: "other", items: otherRefs,
              hint: tr("drug.refsOtherHint") },
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
                      {g.tone === "src" ? tr("drug.badgeSrc") : tr("drug.badgeBg")}
                    </span>
                    {g.title} {tr("drug.refsGroupCount", { n: fmt(g.items.length) })}
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
                      {tr("drug.refsTruncated", { n: fmt(g.items.length) })}
                    </div>
                  )}
                </div>
              </div>
            ))}

        {drugRefs !== null && !refList.length && (
          <div className="card mt-3">
            <EmptyState
              title={tr("drug.refsEmptyTitle")}
              hint={tr("drug.refsEmptyHint")}
            >
              {(drug.n_points ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => setTab("bio")}
                  className="rounded-lg border border-line bg-white px-3.5 py-2 text-[12.5px] font-medium text-ink-2 transition hover:border-[#b9d0e9] hover:shadow-s2"
                >
                  {tr("drug.refsGoBio")}
                </button>
              )}
            </EmptyState>
          </div>
        )}
      </section>
      )}

      {tab === "img" && (
        <section className="mt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[16px] font-semibold"><span className="sec-no">06</span>{tr("drug.tabImg")}</h2>
            <span className="text-[12.5px] text-ink-3">
              {figs === null
                ? tr("common.loading") + "…"
                : figs.length
                ? tr("drug.figsLine", { n: fmt(figs.length) })
                : tr("drug.figsNone")}
            </span>
          </div>
          {figs && figs.length > 0 && (
            <>
              {[
                { k: "target" as Fig["attrib"], t: tr("atlas.attr.target"), cls: "bg-[#dcfce7] text-[#166534]" },
                { k: "unclear" as Fig["attrib"], t: tr("atlas.attr.unclear"), cls: "bg-[#fef3c7] text-[#92400e]" },
                { k: "comparator" as Fig["attrib"], t: tr("atlas.attr.comparator"), cls: "bg-[#fee2e2] text-[#991b1b]" },
              ].map((g) => {
                const rows = figs.filter((f) => f.attrib === g.k);
                if (!rows.length) return null;
                return (
                  <div key={g.k} className="mt-4">
                    <div className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11.5px] font-medium ${g.cls}`}>
                      {g.t} {tr("drug.figsGroupCount", { n: rows.length })}
                    </div>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {rows.map((f) => (
                        <figure key={f.file} className="card m-0 overflow-hidden">
                          <button
                            type="button"
                            onClick={() =>
                              setZoom({
                                src: `${import.meta.env.BASE_URL}figs/${f.file}`,
                                alt: `${f.drug_name} · ${f.label}`,
                                pmc: f.pmcid,
                              })
                            }
                            className="block w-full cursor-zoom-in"
                            title={tr("drug.clickZoom")}
                          >
                            <img
                              src={`${import.meta.env.BASE_URL}figs/${f.file}`}
                              alt={f.label}
                              loading="lazy"
                              className="h-44 w-full object-cover"
                              onError={() => setImgErr((s) => ({ ...s, [f.file]: true }))}
                            />
                          </button>
                          <figcaption className="p-3 text-[12px] leading-snug text-ink-2">
                            <div className="max-h-10 overflow-hidden">{f.caption || f.label}</div>
                            <div className="mt-1.5 text-[11.5px] text-ink-3">
                              PMID {f.pmid} · {f.license}
                            </div>
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="mt-3 text-[11.5px] text-ink-3">
                {tr("drug.figsNote")}
              </div>
            </>
          )}

          {figs && figs.length === 0 && (
            <div className="card mt-4">
              <EmptyState
                title={tr("drug.figsEmptyTitle")}
                hint={
                  figStats
                    ? tr("drug.figsEmptyHint", {
                        t: fmt(figStats.total),
                        d: fmt(figStats.drugs),
                      })
                    : tr("drug.figsEmptyHintShort")
                }
              >
                <Link
                  to="/atlas"
                  className="rounded-lg border border-brand bg-brand-soft px-3.5 py-2 text-[12.5px] font-medium text-brand-deep transition hover:bg-brand/15"
                >
                  {tr("drug.figsEmptyCta")}
                </Link>
              </EmptyState>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

