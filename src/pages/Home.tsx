import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useJSON, fmt, type Drug, type Stats } from "../lib/data";
import { Icon, type IconName } from "../components/Icon";
import { ErrorState } from "../components/States";
import { enSafe, nuclideEn, stageLabel, useLang, useT } from "../lib/i18n";

const PAGE = 30;

/** 研发阶段归一：取**最高阶段**。数据里 `status` 常是多阶段并列
 *  （如 `Approval / Phase 1 / Phase 2`，同一药在不同适应症/国家不同期）⇒ 只取最高的那档显示，
 *  原始写法保留在 tooltip。2026-11-03 起把「临床」细分为具体期数（owner 要求显示 1/2/3 期）。 */
function stageOf(s: string | null): string {
  if (!s) return "未标注";
  const t = s.toLowerCase();
  if (t.includes("approval")) return "已上市";
  if (t.includes("phase 4")) return "4期";
  if (t.includes("phase 3")) return "3期";
  if (t.includes("phase 2/3")) return "2/3期";
  if (t.includes("phase 2")) return "2期";
  if (t.includes("phase 1/2")) return "1/2期";
  if (t.includes("phase 1")) return "1期";
  if (t.includes("clinical trial")) return "临床";
  if (t.includes("preclinical")) return "临床前";
  return "未标注";
}

const STAGE_ORDER = ["已上市", "4期", "3期", "2/3期", "2期", "1/2期", "1期", "临床", "临床前", "未标注"];
const STAGE_TONE: Record<string, string> = {
  已上市: "bg-[#e6f4f1] text-[#0a7d6f] border-[#c6e8e1]",
  "4期": "bg-[#e6eefb] text-[#134a86] border-[#cfdff5]",
  "3期": "bg-[#e8f0fa] text-[#164a8a] border-[#d3e2f6]",
  "2/3期": "bg-[#eaf3fc] text-[#245e9c] border-[#d7e6f7]",
  "2期": "bg-[#ecf4fd] text-[#2a6aa8] border-[#dae9f9]",
  "1/2期": "bg-[#eef6fe] text-[#2f6fae] border-[#ddebf9]",
  "1期": "bg-[#f0f7ff] text-[#3576b4] border-[#e0edfa]",
  临床: "bg-[#f2f6fc] text-[#475f7d] border-[#e2e9f3]",
  临床前: "bg-[#f3e8fb] text-[#7a3fa8] border-[#e6d2f2]",
  未标注: "bg-[#eef2f8] text-[#516078] border-[#dfe6f0]",
};

/** 元素中文 → 符号（让搜索框同时支持「镥」和「Lu」） */
const ELEM_ALIAS: Record<string, string> = {
  镓: "ga", 氟: "f", 锝: "tc", 锆: "zr", 镥: "lu", 铜: "cu", 铟: "in", 碳: "c",
  碘: "i", 锕: "ac", 钇: "y", 钐: "sm", 铼: "re", 铋: "bi", 铅: "pb", 钪: "sc",
  溴: "br", 砷: "as", 砹: "at", 氧: "o", 氮: "n", 磷: "p", 金: "au", 钍: "th",
  钛: "ti", 钬: "ho", 镭: "ra", 铯: "cs", 铷: "rb", 锶: "sr", 铊: "tl", 铱: "ir",
  钌: "ru", 钯: "pd", 银: "ag", 碲: "te", 氙: "xe", 铍: "be", 钴: "co", 铁: "fe",
  锌: "zn", 硒: "se", 铬: "cr", 钼: "mo", 钨: "w", 铂: "pt", 汞: "hg", 铒: "er",
  铥: "tm", 镱: "yb", 镝: "dy", 钆: "gd", 钕: "nd", 镨: "pr", 铈: "ce", 镧: "la",
};

/** 核素搜索键：「镥-177」→「镥-177 lu-177」 */
function nucKey(n: string): string {
  const [zh, num] = n.split("-");
  const sym = ELEM_ALIAS[zh] ?? "";
  return `${n} ${sym ? `${sym}-${num ?? ""}` : ""}`.toLowerCase();
}

/** 按「、」拆分并去重。 */
function splitUniq(values: (string | null)[]): string[] {
  const set = new Set<string>();
  for (const v of values) {
    if (!v) continue;
    for (const x of String(v).split("、")) if (x.trim()) set.add(x.trim());
  }
  return [...set].sort();
}

function Chip({ on, children, onClick }: { on?: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`chip ${on ? "chip-on" : "chip-off"}`}>
      {on && <span className="text-[11px] leading-none">✓</span>}
      {children}
    </button>
  );
}

function GroupLabel({ icon, children, count }: {
  icon: IconName; children: React.ReactNode; count?: number;
}) {
  return (
    <div className="mb-2.5 flex items-center gap-1.5 text-[12.5px] font-medium text-ink-3">
      <Icon name={icon} size={14} className="text-ink-3/80" />
      <span>{children}</span>
      {count !== undefined && (
        <span className="rounded bg-[#eef2f8] px-1.5 py-[1px] text-[11px] tabular-nums text-ink-3">
          {count}
        </span>
      )}
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="px-1">
      <div className="text-[12.5px] font-medium text-ink-3">{label}</div>
      <div className="num mt-1 text-[26px] font-semibold leading-none tracking-tight">{value}</div>
      {hint && <div className="mt-1.5 text-[11.5px] text-ink-3">{hint}</div>}
    </div>
  );
}

export default function Home() {
  const { data: drugs, error, reload } = useJSON<Drug[]>("drugs.json");
  const { data: st } = useJSON<Stats>("stats.json");

  const [sp, setSp] = useSearchParams();
  const kw = sp.get("q") ?? "";
  const setKw = (v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set("q", v);
    else n.delete("q");
    setSp(n, { replace: true });
  };
  const arr = (k: string) => {
    const v = sp.get(k);
    return v ? v.split(",").filter(Boolean) : [];
  };
  const tr = useT();
  const { lang } = useLang();
  /** 类型显示：中文站做中文化简，英文站保留原枚举（`home.microsphere` 在两语言下各取所需） */
  const typeLabel = (t: string | null) => {
    if (!t) return tr("home.uncategorized");
    return t.replace("-based RP", "").replace("Microsphere/Nanoconstruct", tr("home.microsphere"));
  };
  /** 核素：中文站显示「镥-177」，英文站规则转「Lu-177」（数据层只有中文核素名） */
  const nucLabel = (v: string | null | undefined) => (lang === "en" ? nuclideEn(v) || "—" : v || "—");
  const [types, setTypes] = useState<string[]>(() => arr("type"));
  const [nucs, setNucs] = useState<string[]>(() => arr("nuc"));
  const [targets, setTargets] = useState<string[]>(() => arr("tgt"));
  const [diseases, setDiseases] = useState<string[]>(() => arr("dis"));
  const [sort, setSort] = useState(() => sp.get("sort") ?? "阶段优先");
  const [page, setPage] = useState(() => Number(sp.get("p") ?? 0) || 0);
  const [onlyPts, setOnlyPts] = useState(() => sp.get("pts") === "1");
  const [hideBad, setHideBad] = useState(() => sp.get("hide") === "1");
  // ★ 筛选区：核素默认 Top12 + 可展开栏；三个维度各有搜索框
  const [nucAll, setNucAll] = useState(false);
  const [qNuc, setQNuc] = useState("");
  const [qTgt, setQTgt] = useState("");
  const [qDis, setQDis] = useState("");
  useEffect(() => {
    setPage(0);
  }, [kw]);
  /* 筛选状态 ⇄ URL（可分享 · 从详情页返回时自动恢复） */
  useEffect(() => {
    setSp(
      (prev) => {
        const n = new URLSearchParams(prev);
        const put = (k: string, v: string) => (v ? n.set(k, v) : n.delete(k));
        put("type", types.join(","));
        put("nuc", nucs.join(","));
        put("tgt", targets.join(","));
        put("dis", diseases.join(","));
        put("sort", sort === "阶段优先" ? "" : sort);
        put("p", page > 0 ? String(page) : "");
        put("pts", onlyPts ? "1" : "");
        put("hide", hideBad ? "1" : "");
        return n.toString() === prev.toString() ? prev : n;
      },
      { replace: true }
    );
  }, [types, nucs, targets, diseases, sort, page, onlyPts, hideBad, setSp]);

  const allTypes = useMemo(
    () => [...new Set((drugs ?? []).map((d) => d.drug_type || "未分类"))].sort(),
    [drugs]
  );
  const allTargets = useMemo(() => splitUniq((drugs ?? []).map((d) => d.targets_zh)), [drugs]);
  const allDiseases = useMemo(() => splitUniq((drugs ?? []).map((d) => d.diseases_zh)), [drugs]);

  /** ★ facet：除「核素」外的所有筛选条件 → 用于计算核素的动态 Top（选别的维度时，核素 Top 跟着变） */
  const facetBase = useMemo(() => {
    let v = drugs ?? [];
    const k = kw.trim().toLowerCase();
    if (k) v = v.filter((d) => (d.name_en || "").toLowerCase().includes(k) || (d.name_zh || "").includes(k));
    if (types.length) v = v.filter((d) => types.includes(d.drug_type || "未分类"));
    if (onlyPts) v = v.filter((d) => (d.n_points ?? 0) > 0);
    if (hideBad) v = v.filter((d) => d.name_ok !== 0);
    const hit = (field: string | null, sel: string[]) => sel.some((x) => (field || "").includes(x));
    if (targets.length) v = v.filter((d) => hit(d.targets_zh, targets));
    if (diseases.length) v = v.filter((d) => hit(d.diseases_zh, diseases));
    return v;
  }, [drugs, kw, types, onlyPts, hideBad, targets, diseases]);

  /** 核素频次（在当前 facet 结果里） */
  const nucFreq = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of facetBase) {
      for (const x of String(d.radionuclides_zh || "").split("、")) {
        const s = x.trim();
        if (s) m.set(s, (m.get(s) ?? 0) + 1);
      }
    }
    return m;
  }, [facetBase]);

  /** 排序后的核素：频次降序；已选中的永远留在最前；搜索框有输入则全量过滤 */
  const nucOrdered = useMemo(() => {
    const q = qNuc.trim().toLowerCase();
    const all = [...nucFreq.keys()].filter((n) => (q ? nucKey(n).includes(q) : true));
    all.sort((a, b) => (nucFreq.get(b) ?? 0) - (nucFreq.get(a) ?? 0) || a.localeCompare(b));
    const missing = nucs.filter((n) => !all.includes(n));
    return [...missing, ...all];
  }, [nucFreq, qNuc, nucs]);

  const shownNucs = nucAll || qNuc.trim() ? nucOrdered : nucOrdered.slice(0, 12);

  const view = useMemo(() => {
    let v = drugs ?? [];
    const k = kw.trim().toLowerCase();
    if (k) v = v.filter((d) => (d.name_en || "").toLowerCase().includes(k) || (d.name_zh || "").includes(k));
    if (types.length) v = v.filter((d) => types.includes(d.drug_type || "未分类"));
    const hit = (field: string | null, sel: string[]) => sel.some((x) => (field || "").includes(x));
    if (onlyPts) v = v.filter((d) => (d.n_points ?? 0) > 0);
    if (hideBad) v = v.filter((d) => d.name_ok !== 0);
    if (nucs.length) v = v.filter((d) => hit(d.radionuclides_zh, nucs));
    if (targets.length) v = v.filter((d) => hit(d.targets_zh, targets));
    if (diseases.length) v = v.filter((d) => hit(d.diseases_zh, diseases));
    const withStage = v.map((d) => ({ ...d, stage: stageOf(d.status) }));
    if (sort === "名称 A→Z") withStage.sort((a, b) => a.name_en.localeCompare(b.name_en));
    else if (sort === "名称 Z→A") withStage.sort((a, b) => b.name_en.localeCompare(a.name_en));
    else
      withStage.sort(
        (a, b) =>
          STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) ||
          a.name_en.localeCompare(b.name_en)
      );
    return withStage;
  }, [drugs, kw, types, nucs, targets, diseases, sort]);

  const stageCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of view) m[d.stage] = (m[d.stage] ?? 0) + 1;
    return m;
  }, [view]);

  const nStruct = useMemo(() => view.filter((d) => d.has_struct).length, [view]);
  const pages = Math.max(1, Math.ceil(view.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const rows = view.slice(cur * PAGE, cur * PAGE + PAGE);

  const reset = () => {
    setKw("");
    setTypes([]);
    setNucs([]);
    setTargets([]);
    setDiseases([]);
    setPage(0);
  };

  return (
    <div className="pb-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-[26px] font-bold tracking-tight">{tr("home.title")}</h1>
        <p className="text-[13px] text-ink-3">
          {tr("home.countLine", {
            a: st?.coverage ? fmt(st.coverage.drugs_with_biodist) : "…",
            b: st ? fmt(st.drugs) : "…",
          })}
        </p>
      </div>
      <p className="mt-1.5 text-[13px] text-ink-3">{tr("home.lead")}</p>

      {error && (
        <div className="mt-4">
          <ErrorState message={tr("home.errDrugs") + error} onRetry={reload} />
        </div>
      )}

      {/* 常用查询（一行胶囊 · 不占版面） */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-ink-3">{tr("home.quick")}</span>
        <Chip on={onlyPts} onClick={() => setOnlyPts((v) => !v)}>
          {tr("home.onlyPts", { n: st?.coverage ? fmt(st.coverage.drugs_with_biodist) : "…" })}
        </Chip>
        <Chip on={hideBad} onClick={() => setHideBad((v) => !v)}>
          {tr("home.hideBad", { n: 175 })}
        </Chip>
        <Chip onClick={() => setKw("PSMA")}>{tr("home.psma")}</Chip>
        <Chip onClick={() => setNucs(["镥-177"])}>{tr("home.lu177")}</Chip>
        <Chip onClick={() => setNucs(["镓-68"])}>{tr("home.ga68")}</Chip>
      </div>

      {/* 筛选卡（常驻展开 · 对齐原页「不要折叠」） */}
      <section className="card mt-5 p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <b className="text-[15px] tracking-tight">{tr("home.filters")}</b>
            <span className="rounded-full bg-[#eef2f8] px-2 py-0.5 text-[11.5px] font-medium text-ink-3">
              {view.length !== (drugs?.length ?? 0) ? tr("home.filtered") : tr("home.allLib")}
            </span>
          </div>
          <button onClick={reset} className="text-[13px] text-ink-3 transition hover:text-brand">
            {tr("home.reset")}
          </button>
        </div>

        <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
          <div>
            <GroupLabel icon="layers" count={allTypes.length}>
              {tr("home.drugType")}
            </GroupLabel>
            <div className="flex flex-wrap gap-2">
              {allTypes.map((t) => (
                <Chip
                  key={t}
                  on={types.includes(t)}
                  onClick={() => {
                    setTypes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
                    setPage(0);
                  }}
                >
                  {typeLabel(t)}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <GroupLabel icon="atom" count={nucFreq.size}>
              {tr("home.isotope")}{" "}
              <span className="font-normal text-ink-3/60">· {tr("home.dynamicOrder")}</span>
            </GroupLabel>
            <input
              value={qNuc}
              onChange={(e) => setQNuc(e.target.value)}
              placeholder={tr("home.searchIsotope", { n: nucOrdered.length })}
              className="mb-2 h-8 w-full rounded-lg border border-line bg-white px-2.5 text-[12.5px] outline-none focus:border-[#9dc0ea]"
            />
            <div
              className={
                nucAll && !qNuc.trim()
                  ? "max-h-[210px] overflow-y-auto rounded-lg border border-line bg-white p-2"
                  : ""
              }
            >
              <div className="flex flex-wrap gap-2">
                {shownNucs.map((n) => (
                  <Chip
                    key={n}
                    on={nucs.includes(n)}
                    onClick={() => {
                      setNucs((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));
                      setPage(0);
                    }}
                  >
                    {nucLabel(n)}
                    <span className="ml-1 text-[10.5px] opacity-60">{nucFreq.get(n) ?? 0}</span>
                  </Chip>
                ))}
              </div>
            </div>
            {!qNuc.trim() && nucOrdered.length > 12 && (
              <button
                type="button"
                onClick={() => setNucAll((v) => !v)}
                className="mt-2 flex w-full items-center justify-between rounded-lg border border-line bg-[#f7f9fd] px-2.5 py-1.5 text-[12px] text-ink-2 transition hover:border-[#b9d0e9] hover:bg-white"
              >
                <span>
                  {nucAll ? tr("home.collapse") : tr("home.expand", { n: nucOrdered.length })}
                </span>
                <span className="text-ink-3">{nucAll ? "▲" : "▼"}</span>
              </button>
            )}
          </div>

          <div className="md:col-span-2">
            <GroupLabel icon="target" count={allTargets.length}>{tr("home.targets")}</GroupLabel>
            <input
              value={qTgt}
              onChange={(e) => setQTgt(e.target.value)}
              placeholder={tr("home.searchTargets", { n: allTargets.length })}
              className="mb-2 h-8 w-full rounded-lg border border-line bg-white px-2.5 text-[12.5px] outline-none focus:border-[#9dc0ea]"
            />
            <select
              multiple
              size={9}
              value={targets}
              onChange={(e) => {
                setTargets([...e.target.selectedOptions].map((o) => o.value));
                setPage(0);
              }}
              className="w-full rounded-lg border border-line bg-white px-2 text-[12.5px] leading-5 outline-none focus:border-[#9dc0ea]"
            >
              {[...new Set([...targets, ...(qTgt.trim() ? allTargets.filter((t) => t.toLowerCase().includes(qTgt.trim().toLowerCase())) : allTargets)])].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {lang === "zh" ? (
            <div className="md:col-span-2">
              <GroupLabel icon="heart" count={allDiseases.length}>{tr("home.diseases")}</GroupLabel>
              <input
                value={qDis}
                onChange={(e) => setQDis(e.target.value)}
                placeholder={tr("home.searchDiseases", { n: allDiseases.length })}
                className="mb-2 h-8 w-full rounded-lg border border-line bg-white px-2.5 text-[12.5px] outline-none focus:border-[#9dc0ea]"
              />
              <select
                multiple
                size={9}
                value={diseases}
                onChange={(e) => {
                  setDiseases([...e.target.selectedOptions].map((o) => o.value));
                  setPage(0);
                }}
                className="w-full rounded-lg border border-line bg-white px-2 text-[12.5px] leading-5 outline-none focus:border-[#9dc0ea]"
              >
                {[...new Set([...diseases, ...(qDis.trim() ? allDiseases.filter((t) => t.toLowerCase().includes(qDis.trim().toLowerCase())) : allDiseases)])].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="md:col-span-2">
              <GroupLabel icon="heart" count={0}>{tr("home.diseases")}</GroupLabel>
              <p className="text-[12.5px] leading-relaxed text-ink-3">{tr("home.diseasesEnOnly")}</p>
            </div>
          )}
        </div>
      </section>

      {/* 结果带：4 个指标（对齐原页 st.metric 四格） */}
      <section className="mt-5 grid grid-cols-2 gap-4 border-y border-line py-4 lg:grid-cols-4">
        <Metric
          label={tr("home.kpiResult")}
          value={fmt(view.length)}
          hint={tr("home.kpiResultHint", {
            a: st?.coverage ? fmt(st.coverage.drugs_with_biodist) : "…",
            b: st ? fmt(st.drugs) : "…",
          })}
        />
        <Metric
          label={tr("home.kpiApproved")}
          value={fmt(stageCount["已上市"] ?? 0)}
          hint={tr("home.kpiApprovedHint")}
        />
        <Metric
          label={tr("home.kpiStruct")}
          value={fmt(nStruct)}
          hint={tr("home.kpiStructHint", {
            p: view.length ? ((nStruct / view.length) * 100).toFixed(1) : "0.0",
          })}
        />
        <Metric
          label={tr("home.kpiDosim")}
          value={fmt(st?.dosimetry?.total ?? 0)}
          hint={
            st?.dosimetry
              ? tr("home.kpiDosimHint", { a: fmt(st.dosimetry.drugs), b: st.dosimetry.organs })
              : tr("home.none")
          }
        />
      </section>

      {/* 研发阶段徽章 + 排序 */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-ink-3">{tr("home.stage")}</span>
          {STAGE_ORDER.filter((s) => stageCount[s]).map((s) => (
            <span
              key={s}
              className={`rounded-full border px-2 py-0.5 text-[11.5px] font-medium ${STAGE_TONE[s]}`}
            >
              {stageLabel(lang, s)} {fmt(stageCount[s])}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-ink-3">{tr("home.sort")}</span>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(0);
            }}
            className="rounded-lg border border-line bg-white px-2 py-1 text-[12.5px] outline-none focus:border-[#9dc0ea]"
          >
            {[
              { v: "阶段优先", k: "home.sortStage" as const },
              { v: "名称 A→Z", k: "home.sortAZ" as const },
              { v: "名称 Z→A", k: "home.sortZA" as const },
            ].map((o) => (
              <option key={o.v} value={o.v}>
                {tr(o.k)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <h2 className="mt-6 text-[16px] font-semibold">{tr("home.list")}</h2>

      <div className="card mt-3 overflow-hidden">
        <div className="hscroll">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line bg-[#fafbfe] text-[11.5px] uppercase tracking-wide text-ink-3">
                <th className="px-2 py-2.5 text-center font-semibold sm:px-3">{tr("home.thProfile")}</th>
                <th className="px-2 py-2.5 text-left font-semibold sm:px-4">{tr("home.thDrug")}</th>
                <th className="px-2 py-2.5 text-left font-semibold sm:px-3">{tr("home.thType")}</th>
                <th className="hidden px-3 py-2.5 text-left font-semibold sm:table-cell">{tr("home.thIsotope")}</th>
                <th className="hidden px-3 py-2.5 text-left font-semibold lg:table-cell">{tr("home.thTarget")}</th>
                <th className="hidden px-3 py-2.5 text-left font-semibold lg:table-cell">{tr("home.thDisease")}</th>
                <th className="hidden px-3 py-2.5 text-left font-semibold sm:table-cell">{tr("home.thStage")}</th>
                <th className="px-2 py-2.5 text-center font-semibold sm:px-3">{tr("home.thPoints")}</th>
                <th className="hidden px-3 py-2.5 text-center font-semibold sm:table-cell">{tr("home.thStruct")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.drug_id} className="border-b border-[#f1f4f9] transition hover:bg-[#f9fbfe]">
                  <td className="px-2 py-2.5 text-center sm:px-3">
                    <Link
                      to={`/drug/${d.drug_id}`}
                      className="inline-block whitespace-nowrap rounded-lg border border-line bg-white px-2.5 py-1 text-[12px] font-medium text-brand transition hover:border-brand hover:bg-brand-soft"
                    >
                      {tr("home.view")}
                    </Link>
                  </td>
                  <td className="px-2 py-2.5 sm:px-4">
                    <Link
                      to={`/drug/${d.drug_id}`}
                      className="font-medium text-ink transition hover:text-brand hover:underline"
                    >
                      {d.name_en}
                    </Link>
                    <div className="text-[11px] text-ink-3 sm:hidden">
                      {nucLabel(d.radionuclides_zh)} · {stageLabel(lang, d.stage)}
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-ink-2 sm:px-3">{typeLabel(d.drug_type)}</td>
                  <td className="hidden px-3 py-2.5 text-ink-2 sm:table-cell">{nucLabel(d.radionuclides_zh)}</td>
                  <td
                    className="hidden max-w-[190px] truncate px-3 py-2.5 text-ink-2 lg:table-cell"
                    title={enSafe(lang, d.targets_zh)}
                  >
                    {enSafe(lang, d.targets_zh) || "—"}
                  </td>
                  <td
                    className="hidden max-w-[190px] truncate px-3 py-2.5 text-ink-2 lg:table-cell"
                    title={enSafe(lang, d.diseases_zh)}
                  >
                    {enSafe(lang, d.diseases_zh) || "—"}
                  </td>
                  <td className="hidden px-3 py-2.5 sm:table-cell">
                    <span
                      className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${STAGE_TONE[d.stage]}`}
                      title={enSafe(lang, d.status)}
                    >
                      {stageLabel(lang, d.stage)}
                    </span>
                  </td>
                  <td className="num px-2 py-2.5 text-center text-[12.5px] sm:px-3">
                    {d.n_points ? (
                      <span className="font-semibold text-ink">{d.n_points}</span>
                    ) : (
                      <span className="text-ink-3" title={tr("home.noPts")}>
                        —
                      </span>
                    )}
                  </td>
                  <td className="hidden px-3 py-2.5 text-center text-[13px] sm:table-cell">
                    {d.has_struct ? <span className="text-ok">✓</span> : <span className="text-ink-3">—</span>}
                  </td>
                </tr>
              ))}

              {/* 加载骨架：数据未到时用灰条占位，避免白屏（出错时交给 ErrorState，不再闪骨架） */}
              {!drugs &&
                !error &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="border-b border-[#f1f4f9]">
                    <td className="px-3 py-2.5">
                      <div className="mx-auto h-6 w-16 animate-pulse rounded bg-[#eef2f8]" />
                    </td>
                    {[0, 1, 2, 3, 4, 5, 6].map((c) => (
                      <td key={c} className="px-3 py-2.5">
                        <div
                          className="h-3.5 animate-pulse rounded bg-[#eef2f8]"
                          style={{ width: `${[70, 55, 40, 80, 65, 35, 45][c]}%` }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}

              {/* 空态出口：筛到 0 条时给一键清除 */}
              {drugs && !rows.length && (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <div className="text-[13.5px] font-medium text-ink-2">{tr("home.emptyTitle")}</div>
                    <div className="mt-1 text-[12.5px] text-ink-3">{tr("home.emptyHint")}</div>
                    <button
                      onClick={reset}
                      className="mt-4 rounded-lg border border-brand bg-brand-soft px-4 py-2 text-[13px] font-medium text-brand-deep transition hover:bg-brand/15"
                    >
                      {tr("home.clearAll", { n: drugs.length.toLocaleString("en-US") })}
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-ink-3">
        <div>{tr("home.pageInfo", { n: fmt(view.length), a: cur + 1, b: pages })}</div>
        <div className="flex gap-2">
          <button
            disabled={cur === 0}
            onClick={() => setPage(cur - 1)}
            className="rounded-lg border border-line bg-white px-3 py-1 transition hover:border-[#c3d6ea] disabled:opacity-40"
          >
            {tr("home.prev")}
          </button>
          <button
            disabled={cur >= pages - 1}
            onClick={() => setPage(cur + 1)}
            className="rounded-lg border border-line bg-white px-3 py-1 transition hover:border-[#c3d6ea] disabled:opacity-40"
          >
            {tr("home.next")}
          </button>
        </div>
      </div>
    </div>
  );
}
