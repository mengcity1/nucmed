import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fmt, useJSON, type DoseRow } from "../lib/data";
import { EmptyState, ErrorState, TableSkeleton } from "../components/States";

/* ------------------------------------------------------------------
   剂量学页：dosimetry.json 的 403 行全部可查（此前前端无任何入口）。
   一行 = 一个「药物 × 器官 × 原文单位」，同一器官可能因原文括注出现
   两个单位口径（如 0.0247 mGy/MBq (91 mrad/mCi)），因此保留不合并。
   ------------------------------------------------------------------ */

/** 单位口径 → 归一化到 mGy/MBq 的系数（mSv/MBq 是有效剂量，不可换算）。 */
const TO_MGY: Record<string, number> = {
  "mGy/MBq": 1,
  "μGy/MBq": 0.001,
  "Gy/MBq": 1000,
  "rad/mCi": 0.2702703,
  "mrad/mCi": 0.0002702703,
};

const UNIT_ORDER = ["mGy/MBq", "μGy/MBq", "Gy/MBq", "mSv/MBq", "rad/mCi", "mrad/mCi"];

const UNIT_HINT: Record<string, string> = {
  "mGy/MBq": "器官吸收剂量",
  "μGy/MBq": "器官吸收剂量（1 μGy/MBq = 0.001 mGy/MBq）",
  "Gy/MBq": "器官吸收剂量（原文即以 Gy/MBq 计，量级偏高，已在审计清单）",
  "mSv/MBq": "全身有效剂量，不是器官吸收剂量",
  "rad/mCi": "旧单位（1 rad/mCi = 0.2703 mGy/MBq）",
  "mrad/mCi": "旧单位（1 mrad/mCi = 0.2703 μGy/MBq）",
};

const norm = (r: DoseRow): number | null => {
  const k = TO_MGY[r.u];
  return k === undefined ? null : r.v * k;
};

const showNum = (n: number | null) =>
  n === null ? "—" : n >= 0.01 ? String(Number(n.toPrecision(4))) : n.toExponential(2);

/** organ 是库内归一化英文键（小写），显示时首字母大写；null 单列，避免被静默丢掉。 */
const NONE = "__none__";
const organLabel = (o: string | null) =>
  o ? o.charAt(0).toUpperCase() + o.slice(1) : "未标注器官";
const organKey = (o: string | null) => o ?? NONE;

/** 热图色阶：按 log10 取值在浅→深蓝之间插值（剂量跨 3–4 个量级，线性会把弱器官全压成空白）。 */
const shade = (v: number, lo: number, hi: number): { bg: string; dark: boolean } => {
  if (!(v > 0)) return { bg: "#f6f8fb", dark: false };
  const a = Math.log10(lo);
  const b = Math.log10(hi);
  const t = b > a ? Math.min(1, Math.max(0, (Math.log10(v) - a) / (b - a))) : 0.5;
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
  return {
    bg: `rgb(${mix(234, 23)},${mix(241, 63)},${mix(250, 110)})`,
    dark: t > 0.55,
  };
};

type SortKey = "default" | "value-desc" | "value-asc" | "drug";

export default function Dosimetry() {
  const { data, error, loading, reload } = useJSON<DoseRow[]>("dosimetry.json");
  const [q, setQ] = useState("");
  const [organ, setOrgan] = useState("all");
  const [iso, setIso] = useState("all");
  /** 表格默认「全部单位」= 403 行全可查；图表的默认口径另由 chartUnit 固定为 mGy/MBq。 */
  const [unit, setUnit] = useState("all");
  const [grade, setGrade] = useState("all");
  const [drug, setDrug] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("default");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  const rows = data ?? [];

  const organs = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = organKey(r.organ);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const isos = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.iso) m.set(r.iso, (m.get(r.iso) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const units = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.u, (m.get(r.u) ?? 0) + 1);
    return [...m.entries()].sort(
      (a, b) => UNIT_ORDER.indexOf(a[0]) - UNIT_ORDER.indexOf(b[0]) || b[1] - a[1]
    );
  }, [rows]);

  /** 同 (药, 器官) 出现多单位口径 → 详情里标注「原文双单位」，避免误读为两条独立证据。 */
  const multiUnit = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const r of rows) {
      const k = `${r.did}|${organKey(r.organ)}`;
      const s = m.get(k) ?? new Set<string>();
      s.add(r.u);
      m.set(k, s);
    }
    const out = new Set<string>();
    for (const [k, s] of m) if (s.size > 1) out.add(k);
    return out;
  }, [rows]);

  const view = useMemo(() => {
    const k = q.trim().toLowerCase();
    const out = rows.filter(
      (r) =>
        (unit === "all" || r.u === unit) &&
        (organ === "all" || organKey(r.organ) === organ) &&
        (iso === "all" || r.iso === iso) &&
        (grade === "all" || r.grade === grade) &&
        (!k ||
          r.drug.toLowerCase().includes(k) ||
          (r.organ ?? "").toLowerCase().includes(k) ||
          organLabel(r.organ).toLowerCase().includes(k) ||
          (r.organ_raw ?? "").toLowerCase().includes(k) ||
          (r.iso ?? "").toLowerCase().includes(k) ||
          (r.model ?? "").toLowerCase().includes(k) ||
          r.raw.toLowerCase().includes(k))
    );
    if (sort === "drug")
      out.sort(
        (a, b) => a.drug.localeCompare(b.drug) || (a.organ ?? "").localeCompare(b.organ ?? "")
      );
    else if (sort !== "default") {
      const dir = sort === "value-desc" ? -1 : 1;
      // 跨单位不可直接比：先按单位分组，再在组内排序。
      out.sort((a, b) => a.u.localeCompare(b.u) * -1 || (a.v - b.v) * dir);
    }
    return out;
  }, [rows, q, unit, organ, iso, grade, sort]);

  const pageSize = 40;
  const pages = Math.max(1, Math.ceil(view.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const shown = view.slice(cur * pageSize, cur * pageSize + pageSize);
  const viewUnits = useMemo(() => [...new Set(view.map((r) => r.u))], [view]);

  /* ---------- 第一 / 二层：热图（总览）+ 单药条形（明细） ----------
     图表只在「单一单位」下成立：切「全部单位」时固定 mGy/MBq，绝不混色。 */
  const chartUnit = unit === "all" ? "mGy/MBq" : unit;
  const chartRows = useMemo(() => rows.filter((r) => r.u === chartUnit), [rows, chartUnit]);

  /** 药 × 器官 → 最大值（同一格多条记录不叠加，只取最大并记条数）。 */
  const grid = useMemo(() => {
    const m = new Map<string, Map<string, { v: number; n: number }>>();
    for (const r of chartRows) {
      const row = m.get(r.drug) ?? new Map<string, { v: number; n: number }>();
      const o = organKey(r.organ);
      const prev = row.get(o);
      row.set(o, { v: prev ? Math.max(prev.v, r.v) : r.v, n: (prev?.n ?? 0) + 1 });
      m.set(r.drug, row);
    }
    return m;
  }, [chartRows]);

  const gridOrgans = useMemo(() => {
    const c = new Map<string, number>();
    for (const row of grid.values()) for (const o of row.keys()) c.set(o, (c.get(o) ?? 0) + 1);
    return [...c.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([o]) => o);
  }, [grid]);

  const gridDrugs = useMemo(() => [...grid.keys()].sort((a, b) => a.localeCompare(b)), [grid]);

  const cellVals = useMemo(
    () =>
      [...grid.values()]
        .flatMap((row) => [...row.values()].map((c) => c.v))
        .filter((v) => v > 0),
    [grid]
  );
  const cellLo = cellVals.length ? Math.min(...cellVals) : 0;
  const cellHi = cellVals.length ? Math.max(...cellVals) : 1;

  /** 默认选「器官覆盖最广的药」（并列时取更热的那个），进页即有完整画像；点热图格子换药。 */
  const defaultDrug = useMemo(() => {
    let best: string | null = null;
    let bOrgans = -1;
    let bMax = -Infinity;
    for (const [d, row] of grid) {
      let mx = 0;
      for (const c of row.values()) mx = Math.max(mx, c.v);
      if (row.size > bOrgans || (row.size === bOrgans && mx > bMax)) {
        best = d;
        bOrgans = row.size;
        bMax = mx;
      }
    }
    return best;
  }, [grid]);
  const selDrug = drug && grid.has(drug) ? drug : defaultDrug;

  const bars = useMemo(
    () =>
      chartRows
        .filter((r) => r.drug === selDrug)
        .slice()
        .sort((a, b) => b.v - a.v),
    [chartRows, selDrug]
  );
  const barMax = bars.length ? Math.max(...bars.map((r) => r.v)) : 1;
  const barMin = bars.length ? Math.min(...bars.map((r) => r.v)) : 1;
  /** 跨度 > 2 个数量级时线性条会让小值全不可见 ⇒ 条长改按 log10 比例（脚注写明）。 */
  const barLog = barMax / Math.max(barMin, 1e-12) > 100;
  const barWidth = (v: number) => {
    if (!barLog) return Math.max(1.5, (v / barMax) * 100);
    const lo = Math.log10(Math.max(barMin, 1e-12));
    const hi = Math.log10(barMax);
    if (hi - lo < 1e-9) return 100;
    return Math.max(1.5, ((Math.log10(Math.max(v, 1e-12)) - lo) / (hi - lo)) * 100);
  };

  const reset = () => {
    setQ("");
    setOrgan("all");
    setIso("all");
    setUnit("all");
    setGrade("all");
    setSort("default");
    setPage(0);
    setDrug(null);
  };
  const dirty =
    q !== "" || organ !== "all" || iso !== "all" || unit !== "all" || grade !== "all";

  return (
    <div className="pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">☢ 剂量学</h1>
          <p className="mt-1.5 max-w-[820px] text-[13px] leading-relaxed text-ink-3">
            器官吸收剂量与全身有效剂量，逐条保留原文单位与原文句子；<b className="text-ink-2">不跨单位比较</b>。
          </p>
        </div>
        <div className="rounded-[10px] border border-line bg-white px-3.5 py-2 text-[12.5px] text-ink-3 shadow-s1">
          当前口径 ⇒ <b className="num text-[15px] text-ink">{fmt(view.length)}</b>
          <span className="text-ink-3"> / {fmt(rows.length)}</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-ink-3">
        <span>
          <b className="num text-ink-2">{fmt(rows.length)}</b> 行
        </span>
        <span>
          <b className="num text-ink-2">{new Set(rows.map((r) => r.did)).size}</b> 药
        </span>
        <span>
          <b className="num text-ink-2">{organs.length}</b> 器官
        </span>
        <span>
          <b className="num text-ink-2">{units.length}</b> 种单位口径
        </span>
        <span className="text-[#8b98ad]">
          证据级 A {rows.filter((r) => r.grade === "A").length} · B{" "}
          {rows.filter((r) => r.grade === "B").length}
        </span>
      </div>
      {/* ① 总览热图：药 × 器官，颜色 = 当前口径的剂量（对数色阶） */}
      {!error && !loading && gridDrugs.length > 0 && (
        <section className="card mt-5 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 md:px-5">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">① 药 × 器官 热图</h2>
              <p className="mt-0.5 text-[11.5px] text-ink-3">
                颜色越深 = 剂量越高（对数色阶）；点任一格 → 下方切换成该药的器官排行。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-ink-3">
              <span className="rounded-md border border-line bg-[#fafbfe] px-2 py-0.5 font-mono text-[11px] text-ink-2">
                {chartUnit}
              </span>
              <span
                className="h-2.5 w-24 rounded-full"
                style={{ background: "linear-gradient(90deg,#eaf1fa,#173f6e)" }}
                aria-hidden="true"
              />
              <span className="num">
                {showNum(cellLo)} → {showNum(cellHi)}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 border-b border-r border-line bg-[#fafbfe] px-3 py-2 text-left text-[11px] font-semibold text-ink-3">
                    药物 \ 器官
                  </th>
                  {gridOrgans.map((o) => (
                    <th
                      key={o}
                      className="border-b border-line bg-[#fafbfe] px-1 pb-1.5 pt-2 align-bottom"
                    >
                      <div className="mx-auto h-[104px] w-4 whitespace-nowrap text-[10.5px] font-medium text-ink-3 [writing-mode:vertical-rl] rotate-180">
                        {organLabel(o === NONE ? null : o)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gridDrugs.map((d) => (
                  <tr key={d} className="border-b border-[#f1f4f9]">
                    <th
                      className={`sticky left-0 z-10 border-r border-line px-3 py-1 text-left text-[11.5px] font-medium ${
                        d === selDrug ? "bg-[#eef4fc] text-brand" : "bg-white text-ink-2"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setDrug(d)}
                        className="whitespace-nowrap transition hover:text-brand"
                        title={`看 ${d} 的器官排行`}
                      >
                        {d}
                      </button>
                    </th>
                    {gridOrgans.map((o) => {
                      const c = grid.get(d)?.get(o);
                      if (!c)
                        return (
                          <td key={o} className="px-1 py-1">
                            <div className="h-6 w-9 rounded-[3px] bg-[#f6f8fb]" />
                          </td>
                        );
                      const s = shade(c.v, cellLo, cellHi);
                      return (
                        <td key={o} className="px-1 py-1">
                          <button
                            type="button"
                            onClick={() => {
                              setDrug(d);
                              document
                                .getElementById("dose-bars")
                                ?.scrollIntoView({ behavior: "smooth", block: "center" });
                            }}
                            title={`${d} · ${organLabel(o === NONE ? null : o)} = ${c.v} ${chartUnit}${
                              c.n > 1 ? `（同器官 ${c.n} 条，取最大）` : ""
                            }`}
                            aria-label={`${d} ${organLabel(o === NONE ? null : o)} ${c.v} ${chartUnit}`}
                            className="flex h-6 w-9 items-center justify-center rounded-[3px] transition hover:ring-2 hover:ring-brand/40"
                            style={{ backgroundColor: s.bg }}
                          >
                            {d === selDrug && (
                              <span
                                className={`h-1 w-1 rounded-full ${s.dark ? "bg-white" : "bg-brand"}`}
                              />
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-line px-4 py-2 text-[11px] leading-relaxed text-ink-3 md:px-5">
            {gridDrugs.length} 药 × {gridOrgans.length} 器官 · 同格多条记录取<b>最大</b>值（不叠加、不合格）
            · 图表只按<b>单位口径</b>重算，不受下方表格筛选影响
            {unit === "all" && " · 当前表格为「全部单位」，图表固定 mGy/MBq"}
          </div>
        </section>
      )}



      {error && (
        <div className="mt-4">
          <ErrorState message={error} onRetry={reload} />
        </div>
      )}

      {/* ② 单药排行：回答「这个药哪个器官剂量最高」 */}
      {!error && !loading && bars.length > 0 && (
        <section id="dose-bars" className="card mt-4 scroll-mt-24 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 md:px-5">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">② 单药器官排行</h2>
              <p className="mt-0.5 text-[11.5px] text-ink-3">
                按剂量降序，条上标数值与单位；最长条 = 该药最高器官。默认选<b>器官覆盖最广</b>的药，点上方热图任一格可换药。
              </p>
            </div>
            <label className="flex items-center gap-2 text-[11.5px] text-ink-3">
              药物
              <select
                value={selDrug ?? ""}
                onChange={(e) => setDrug(e.target.value)}
                aria-label="选择药物查看器官排行"
                className="h-8 max-w-[260px] rounded-[9px] border border-line bg-white px-2 text-[12.5px] text-ink-2 outline-none focus:border-[#9dc0ea]"
              >
                {gridDrugs.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="px-4 py-3.5 md:px-5">
            <div className="space-y-1.5">
              {bars.map((r, i) => (
                <div
                  key={`${r.did}-${i}`}
                  className="grid grid-cols-[minmax(86px,150px)_1fr_auto] items-center gap-2.5"
                >
                  <div
                    className="truncate text-[12px] text-ink-2"
                    title={`${organLabel(r.organ)}${r.organ_raw ? `（${r.organ_raw}）` : ""}`}
                  >
                    {organLabel(r.organ)}
                  </div>
                  <div className="h-3.5 rounded-[4px] bg-[#f1f5fb]" aria-hidden="true">
                    <div
                      className={`h-full rounded-[4px] ${i === 0 ? "bg-brand" : "bg-[#6f9ed0]"}`}
                      style={{ width: `${barWidth(r.v)}%` }}
                    />
                  </div>
                  <div className="num w-[140px] text-right text-[12px] text-ink">
                    <b>{r.v}</b>{" "}
                    <span className="font-mono text-[11px] text-ink-3">{r.u}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2.5 text-[11px] leading-relaxed text-ink-3">
              口径 <span className="font-mono">{chartUnit}</span> · 共 {bars.length} 条记录 · 条形长度为
              {barLog ? (
                <>
                  <b className="text-ink-2">对数比例</b>（跨度 {Math.floor(Math.log10(barMax / Math.max(barMin, 1e-12)))} 个数量级，线性条会让小值全不可见）
                </>
              ) : (
                "线性比例"
              )}
              （最长 = <b className="text-ink-2">{bars[0].v}</b> {bars[0].u}）
            </p>
          </div>
        </section>
      )}


      <section className="card mt-5 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3.5 md:px-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">③ 全量明细表</h2>
              <p className="mt-0.5 text-[11.5px] text-ink-3">
                403 行逐条可筛可排；点「原文」展开 FDA 表注与来源标识。
              </p>
            </div>
            <span className="text-[11.5px] text-ink-3">
              当前筛选 <b className="num text-ink-2">{fmt(view.length)}</b> 行
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-0 flex-1 md:max-w-[300px]">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[#9aa8bd]">
                🔍
              </span>
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(0);
                }}
                placeholder="药名 / 器官 / 核素 / 原文…"
                aria-label="搜索剂量记录"
                className="h-9 w-full rounded-[10px] border border-line bg-white pl-8 pr-3 text-[13px] outline-none transition focus:border-[#9dc0ea] focus:ring-[3px] focus:ring-brand/10"
              />
            </div>
            <select
              value={organ}
              onChange={(e) => {
                setOrgan(e.target.value);
                setPage(0);
              }}
              aria-label="按器官筛选"
              className="h-9 rounded-[10px] border border-line bg-white px-2.5 text-[12.5px] text-ink-2 outline-none focus:border-[#9dc0ea]"
            >
              <option value="all">全部器官</option>
              {organs.map(([k, n]) => (
                <option key={k} value={k}>
                  {organLabel(k === NONE ? null : k)}（{n}）
                </option>
              ))}
            </select>
            <select
              value={iso}
              onChange={(e) => {
                setIso(e.target.value);
                setPage(0);
              }}
              aria-label="按核素筛选"
              className="h-9 rounded-[10px] border border-line bg-white px-2.5 text-[12.5px] text-ink-2 outline-none focus:border-[#9dc0ea]"
            >
              <option value="all">全部核素</option>
              {isos.map(([k, n]) => (
                <option key={k} value={k}>
                  {k}（{n}）
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as SortKey);
                setPage(0);
              }}
              aria-label="排序方式"
              className="h-9 rounded-[10px] border border-line bg-white px-2.5 text-[12.5px] text-ink-2 outline-none focus:border-[#9dc0ea]"
            >
              <option value="default">默认顺序</option>
              <option value="value-desc">数值 高→低（同单位内）</option>
              <option value="value-asc">数值 低→高（同单位内）</option>
              <option value="drug">药名 A→Z</option>
            </select>
            {dirty && (
              <button
                type="button"
                onClick={reset}
                className="h-9 rounded-[10px] border border-line bg-white px-3 text-[12.5px] text-ink-2 transition hover:border-[#c3d6ea] hover:text-ink"
              >
                清空筛选
              </button>
            )}
            <span className="ml-auto hidden text-[11.5px] text-ink-3 sm:inline">
              读数口径：mSv/MBq 为全身有效剂量，不能与器官吸收剂量并列比较
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11.5px] uppercase tracking-wide text-ink-3">单位</span>
            <button
              type="button"
              onClick={() => {
                setUnit("all");
                setPage(0);
              }}
              className={`rounded-full border px-2.5 py-1 text-[12px] transition ${
                unit === "all"
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-white text-ink-2 hover:border-[#c3d6ea]"
              }`}
            >
              全部单位 {rows.length}
            </button>
            {units.map(([k, n]) => (
              <button
                key={k}
                type="button"
                title={UNIT_HINT[k]}
                onClick={() => {
                  setUnit(k);
                  setPage(0);
                }}
                className={`rounded-full border px-2.5 py-1 text-[12px] transition ${
                  unit === k
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-white text-ink-2 hover:border-[#c3d6ea]"
                }`}
              >
                <span className="font-mono">{k}</span> {n}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11.5px] uppercase tracking-wide text-ink-3">证据级</span>
            {["all", "A", "B"].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  setGrade(g);
                  setPage(0);
                }}
                className={`rounded-full border px-2.5 py-1 text-[12px] transition ${
                  grade === g
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-white text-ink-2 hover:border-[#c3d6ea]"
                }`}
              >
                {g === "all" ? "全部" : `Grade ${g}`}
              </button>
            ))}
          </div>
        </div>


        {viewUnits.length > 1 && (
          <div className="border-b border-[#f2e6cf] bg-[#fdf8ee] px-4 py-2 text-[12px] leading-relaxed text-[#8a6217] md:px-5">
            当前结果含 <b>{viewUnits.length}</b> 种单位（{viewUnits.join(" · ")}）。
            数值排序已按单位分组，<b>跨单位数值不可直接比较</b>；需要横比请先按单位筛选，或看详情里换算后的 mGy/MBq。
            {unit === "all" && "（上方热图/条形固定 mGy/MBq 口径，不随此处混色）"}
          </div>
        )}

        {loading ? (
          <TableSkeleton rows={10} cols={7} />
        ) : view.length === 0 ? (
          <EmptyState
            title={rows.length ? "当前筛选没有命中" : "剂量学数据为空"}
            hint={
              rows.length
                ? "试试放宽单位 / 器官 / 证据级，或清空搜索词。"
                : "dosimetry.json 未加载到任何行，请检查 public/data 导出。"
            }
          >
            {dirty && (
              <button
                type="button"
                onClick={reset}
                className="rounded-lg border border-line bg-white px-3 py-1.5 text-[12.5px] text-ink-2 transition hover:border-[#c3d6ea]"
              >
                清空筛选
              </button>
            )}
            <Link
              to="/"
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-[12.5px] text-ink-2 transition hover:border-[#c3d6ea]"
            >
              返回总览
            </Link>
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-line bg-[#fafbfe] text-[11.5px] uppercase tracking-wide text-ink-3">
                  <th className="sticky left-0 z-10 bg-[#fafbfe] px-4 py-2.5 text-left font-semibold">药物</th>
                  <th className="px-4 py-2.5 text-left font-semibold">核素</th>
                  <th className="px-4 py-2.5 text-left font-semibold">器官</th>
                  <th className="px-4 py-2.5 text-right font-semibold">数值</th>
                  <th className="px-4 py-2.5 text-left font-semibold">单位</th>
                  <th className="px-4 py-2.5 text-left font-semibold">证据</th>
                  <th className="px-4 py-2.5 text-left font-semibold">详情</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r, i) => {
                  const key = `${cur * pageSize + i}-${r.did}`;
                  const isOpen = open === key;
                  const dup = multiUnit.has(`${r.did}|${organKey(r.organ)}`);
                  const nm = norm(r);
                  return (
                    <Fragment key={key}>
                      <tr
                        className={`border-b border-[#f1f4f9] transition hover:bg-[#f9fbfe] ${
                          i % 2 ? "bg-[#fcfdff]" : "bg-white"
                        }`}
                      >
                        <td className="sticky left-0 z-10 bg-inherit px-4 py-2.5 font-medium text-ink">
                          {r.drug}
                        </td>
                        <td className="px-4 py-2.5 text-ink-2">{r.iso ?? "—"}</td>
                        <td className="px-4 py-2.5 text-ink-2">
                          {r.organ ? (
                            organLabel(r.organ)
                          ) : (
                            <span className="text-ink-3" title="原文未点名单一器官，数值无法归到器官列">
                              未标注器官
                            </span>
                          )}
                          {r.organ_raw && r.organ_raw.toLowerCase() !== (r.organ ?? "") && (
                            <span className="ml-1 text-[11px] text-ink-3">（{r.organ_raw}）</span>
                          )}
                          {dup && (
                            <span
                              className="badge badge-b ml-1.5"
                              title="同一器官在原文中同时给出两种单位口径，两行都保留"
                            >
                              双单位
                            </span>
                          )}
                        </td>
                        <td className="num px-4 py-2.5 text-right font-semibold text-ink">{r.v}</td>
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-[12px] text-ink-2">{r.u}</span>
                          {r.u === "mSv/MBq" && (
                            <span className="badge badge-c ml-1.5" title="全身有效剂量，非器官吸收剂量">
                              有效剂量
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`badge ${r.grade === "A" ? "badge-a" : "badge-b"}`}>
                            {r.grade}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            onClick={() => setOpen(isOpen ? null : key)}
                            aria-expanded={isOpen}
                            className="rounded-md border border-line px-2 py-0.5 text-[11.5px] text-ink-2 transition hover:border-[#c3d6ea] hover:text-ink"
                          >
                            {isOpen ? "收起" : "原文"}
                          </button>
                        </td>
                      </tr>


                      {isOpen && (
                        <tr className="border-b border-[#e9eef6] bg-[#fbfcfe]">
                          <td colSpan={7} className="px-4 py-3.5">
                            <div className="grid gap-3 text-[12px] leading-relaxed md:grid-cols-[1fr_260px]">
                              <div>
                                <div className="text-[11px] uppercase tracking-wide text-ink-3">原文</div>
                                <p className="mt-1 whitespace-pre-wrap text-ink-2">{r.raw || "—"}</p>
                              </div>
                              <div className="space-y-1.5 rounded-[10px] border border-line bg-white p-3">
                                <KV k="药物 ID" v={`#${r.did}`} />
                                <KV k="器官（原文）" v={r.organ_raw ?? "—"} />
                                <KV k="物种" v={r.species ?? "—"} />
                                <KV k="模型 / 来源" v={r.model ?? "—"} />
                                <KV
                                  k="归一到 mGy/MBq"
                                  v={nm === null ? "不可换算（有效剂量）" : showNum(nm)}
                                />
                                <KV k="来源标识" v={r.src} mono />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-[12.5px] text-ink-3 md:px-5">
          <div>
            第 {cur + 1} / {pages} 页 · 每页 {pageSize} 行 · 共 {fmt(view.length)} 行
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={cur === 0}
              onClick={() => setPage(cur - 1)}
              className="rounded-lg border border-line bg-white px-3 py-1 transition hover:border-[#c3d6ea] disabled:opacity-40"
            >
              上一页
            </button>
            <button
              type="button"
              disabled={cur >= pages - 1}
              onClick={() => setPage(cur + 1)}
              className="rounded-lg border border-line bg-white px-3 py-1 transition hover:border-[#c3d6ea] disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        </div>
      </section>

      <p className="mt-4 text-[12px] leading-relaxed text-ink-3">
        口径说明：一行 = 一个「药物 × 器官 × 原文单位」，同一器官的原文双单位行不合并；数值为原文照录，
        <b className="text-ink-2">未做任何单位换算</b>。mSv/MBq 标注为「有效剂量」，属于全身量，不能与器官吸收剂量并列比较。
        证据级 A = 原文表格直接给出，B = 原文正文括注或推算。
      </p>
    </div>
  );
}

function KV({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex gap-2 text-[11.5px]">
      <span className="w-[96px] shrink-0 text-ink-3">{k}</span>
      <span className={`min-w-0 break-all text-ink-2 ${mono ? "font-mono text-[10.5px]" : ""}`}>
        {v}
      </span>
    </div>
  );
}

