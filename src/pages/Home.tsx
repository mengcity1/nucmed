import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useJSON, fmt, type Drug, type Stats } from "../lib/data";
import { Icon, type IconName } from "../components/Icon";
import Reveal from "../components/Reveal";
import { useCountUp } from "../lib/useCountUp";
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

function Chip({
  on,
  children,
  onClick,
  sm,
}: {
  on?: boolean;
  children: React.ReactNode;
  onClick: () => void;
  sm?: boolean;
}) {
  return (
    <button onClick={onClick} className={`${sm ? "chip-sm" : "chip"} ${on ? "chip-on" : "chip-off"}`}>
      {on && <span className="text-[10.5px] leading-none">✓</span>}
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

type MetricTone = "brand" | "accent" | "violet" | "sand";

/** 指标（2026-11-04 v16 简约）：**无底、无框、无阴影**，只有排版 + 细线分栏。
 *  计数动画保留；颜色只落在数字上（轻声量级，不抢视线）。 */
function Metric({
  label,
  value,
  hint,
  tone = "brand",
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: MetricTone;
}) {
  const shown = useCountUp(value);
  const val: Record<MetricTone, string> = {
    brand: "text-[#12457f]",
    accent: "text-[#0a6f66]",
    violet: "text-[#4b3ea3]",
    sand: "text-[#8a5a12]",
  };
  return (
    <div className="px-4 py-4 sm:border-l sm:border-[rgba(15,23,42,.08)] sm:first:border-l-0">
      <div className="label-caps">{label}</div>
      <div className={`num mt-2 text-[28px] font-semibold leading-none tracking-tight ${val[tone]}`}>{fmt(shown)}</div>
      {hint && <div className="mt-1.5 text-[11.5px] leading-snug text-ink-3">{hint}</div>}
    </div>
  );
}
export default function Home() {
  const { data: drugs, error, reload } = useJSON<Drug[]>("drugs.json");
  const { data: st } = useJSON<Stats>("stats.json");

  /** ★ 2026-11-04：结构图来源表（36 KB）—— 用来把 `schematic`（海报式示意图）从「✓ 结构」里剔除，
   *  否则 575 个抗体药会在列表里假装"有结构图"。 */
  const [structSrc, setStructSrc] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`${import.meta.env.BASE_URL}struct/manifest.json`, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((m: Record<string, string>) => alive && setStructSrc(m ?? {}))
      .catch(() => alive && setStructSrc({}));
    return () => {
      alive = false;
    };
  }, []);
  /** 真结构 = 库内标记有图 ∧ 来源不是 schematic（manifest 未到时先按库内标记显示） */
  const realStruct = (id: number, flag?: number) =>
    !!flag && (structSrc ? structSrc[String(id)] !== "schematic" : true);

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
  /** ★ 研发阶段筛选（2026-11-04 owner 要求）：把原来只读的阶段徽标改成可点选（多选，与其它维度叠加）。 */
  const [stages, setStages] = useState<string[]>(() => arr("stage"));
  /** 筛选面板开合（2026-11-04 v23）：**状态放进 URL（`?f=1|0`）**
   *  ⇒ 从详情页返回、或前进后退，都能保留"筛选项 + 展开状态"。
   *  没显式写过 `f` 时：有任一筛选条件就默认展开（避免"筛选生效但面板看不见"）。 */
  const hasSel =
    arr("type").length + arr("nuc").length + arr("tgt").length + arr("dis").length + arr("stage").length > 0;
  const fParam = sp.get("f");
  const fOpen = fParam === null ? hasSel : fParam === "1";
  const setFOpen = (v: boolean) =>
    setSp(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set("f", v ? "1" : "0");
        return n;
      },
      { replace: true }
    );
  // ★ 筛选区：核素默认 Top12 + 可展开栏；三个维度各有搜索框
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
        put("stage", stages.join(","));
        put("sort", sort === "阶段优先" ? "" : sort);
        put("p", page > 0 ? String(page) : "");
        put("pts", onlyPts ? "1" : "");
        put("hide", hideBad ? "1" : "");
        return n.toString() === prev.toString() ? prev : n;
      },
      { replace: true }
    );
  }, [types, nucs, targets, diseases, stages, sort, page, onlyPts, hideBad, setSp]);

  const allTypes = useMemo(
    () => [...new Set((drugs ?? []).map((d) => d.drug_type || "未分类"))].sort(),
    [drugs]
  );
  const allTargets = useMemo(() => splitUniq((drugs ?? []).map((d) => d.targets_zh)), [drugs]);
  const allDiseases = useMemo(() => splitUniq((drugs ?? []).map((d) => d.diseases_zh)), [drugs]);

  /** 筛选卡用 chip 多选代替原生 `<select multiple size=9>`（2026-11-04）：
   *  只渲染「已选 + 前 30 个匹配」，其余靠搜索框缩小范围 —— 原来的两个 9 行列表框占 ~400px 高。 */
  const tgtList = useMemo(() => {
    const q = qTgt.trim().toLowerCase();
    const pool = q ? allTargets.filter((t) => t.toLowerCase().includes(q)) : allTargets;
    const uniq = [...new Set([...targets, ...pool])];
    return { items: uniq, total: uniq.length };
  }, [allTargets, targets, qTgt]);
  const disList = useMemo(() => {
    const q = qDis.trim().toLowerCase();
    const pool = q ? allDiseases.filter((t) => t.toLowerCase().includes(q)) : allDiseases;
    const uniq = [...new Set([...diseases, ...pool])];
    return { items: uniq, total: uniq.length };
  }, [allDiseases, diseases, qDis]);
  const nSel = types.length + nucs.length + targets.length + diseases.length + stages.length;

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
    const afterStage = stages.length ? withStage.filter((d) => stages.includes(d.stage)) : withStage;
    if (sort === "名称 A→Z") afterStage.sort((a, b) => a.name_en.localeCompare(b.name_en));
    else if (sort === "名称 Z→A") afterStage.sort((a, b) => b.name_en.localeCompare(a.name_en));
    else
      afterStage.sort(
        (a, b) =>
          STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) ||
          a.name_en.localeCompare(b.name_en)
      );
    return afterStage;
  }, [drugs, kw, types, nucs, targets, diseases, stages, sort]);

  const stageCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of view) m[d.stage] = (m[d.stage] ?? 0) + 1;
    return m;
  }, [view]);

  /** 阶段徽标的分面计数：基于「排除阶段自身」的 facetBase ⇒
   *  选中某阶段后，其它阶段仍显示「切过去会有多少」，而不是塌成 0。 */
  const stageFacet = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of facetBase) {
      const s = stageOf(d.status);
      m[s] = (m[s] ?? 0) + 1;
    }
    return m;
  }, [facetBase]);

  const nStruct = useMemo(
    () => view.filter((d) => realStruct(d.drug_id, d.has_struct)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, structSrc]
  );
  const pages = Math.max(1, Math.ceil(view.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const rows = view.slice(cur * PAGE, cur * PAGE + PAGE);

  const reset = () => {
    setKw("");
    setTypes([]);
    setNucs([]);
    setTargets([]);
    setDiseases([]);
    setStages([]);
    setPage(0);
  };

  /** v23：把**筛选项同步进 URL**（`replace`，不产生历史）——
   *  之前只"从 URL 读初值"、改动不写回 ⇒ 进详情再返回时选项全没了（owner 反馈）。
   *  现在「选项 + 展开状态（f）」都在 URL 里，返回/前进后退都能原样恢复。 */
  useEffect(() => {
    setSp(
      (prev) => {
        const n = new URLSearchParams(prev);
        const put = (k: string, v: string[]) => {
          if (v.length) n.set(k, v.join(","));
          else n.delete(k);
        };
        put("type", types);
        put("nuc", nucs);
        put("tgt", targets);
        put("dis", diseases);
        put("stage", stages);
        if (kw) n.set("q", kw);
        else n.delete("q");
        return n.toString() === prev.toString() ? prev : n;
      },
      { replace: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types, nucs, targets, diseases, stages, kw]);

  return (
    <div className="pb-4">
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

      {/* 筛选卡（2026-11-04 重做）：默认折叠 · 展开后四列紧凑 · 靶点/适应症改为 chip 多选
          v18：外层再套一层真折射玻璃（1 舞台 / 1 面片）；chip 的描边由 index.css 还原 */}
      <section data-glass="panel" className="card-tint lg-surface px-5 py-3">
        {/* v23（owner）：**整条可点**展开/收起；只保留「重置」一个按钮；不再有"展开筛选"小按钮 */}
        <div
          role="button"
          tabIndex={0}
          aria-expanded={fOpen}
          aria-controls="home-filter-panel"
          title={tr("home.filterBarHint")}
          onClick={() => setFOpen(!fOpen)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setFOpen(!fOpen);
            }
          }}
          className="flex cursor-pointer select-none flex-wrap items-center gap-x-3 gap-y-2 rounded-[10px] py-1.5 outline-none transition hover:bg-white/45 focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <b className="text-[14px] tracking-tight">{tr("home.filters")}</b>
          <span className="rounded-full bg-white px-2 py-0.5 text-[11.5px] font-medium text-ink-3 ring-1 ring-[#e3e9f4]">
            {view.length !== (drugs?.length ?? 0) ? tr("home.filtered") : tr("home.allLib")}
          </span>
          {nSel > 0 && <span className="text-[11.5px] text-ink-3">{tr("home.selectedN", { n: nSel })}</span>}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              reset();
            }}
            className="ml-auto text-[12.5px] text-ink-3 transition hover:text-brand"
          >
            {tr("home.reset")}
          </button>
          <span
            aria-hidden
            className={`text-[10px] text-ink-3 transition-transform duration-200 ${fOpen ? "rotate-180" : ""}`}
          >
            ▼
          </span>
        </div>

        {fOpen && (
        <div id="home-filter-panel" className="mt-4 grid gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <GroupLabel icon="layers" count={allTypes.length}>
              {tr("home.drugType")}
            </GroupLabel>
            <div className="flex flex-wrap gap-1.5">
              {allTypes.map((t) => (
                <Chip
                  key={t}
                  sm
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
            <GroupLabel icon="atom" count={nucFreq.size}>{tr("home.isotope")}</GroupLabel>
            <input
              value={qNuc}
              onChange={(e) => setQNuc(e.target.value)}
              placeholder={tr("home.searchIsotope", { n: nucOrdered.length })}
              className="mb-1.5 h-7 w-full rounded-md border border-line bg-white px-2 text-[12px] outline-none focus:border-[#9dc0ea]"
            />
            {/* v25：核素不再"展开/收起"，全部放进常驻滚动区（去掉原来的 nucAll 切换） */}
            <div className="filter-scroll max-h-[148px] overflow-y-auto pr-1.5">
              <div className="flex flex-wrap gap-1.5">
                {nucOrdered.map((n) => (
                  <Chip
                    key={n}
                    sm
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
          </div>

          <div>
            <GroupLabel icon="target" count={allTargets.length}>{tr("home.targets")}</GroupLabel>
            <input
              value={qTgt}
              onChange={(e) => setQTgt(e.target.value)}
              placeholder={tr("home.searchTargets", { n: allTargets.length })}
              className="mb-1.5 h-7 w-full rounded-md border border-line bg-white px-2 text-[12px] outline-none focus:border-[#9dc0ea]"
            />
            <div className="filter-scroll flex max-h-[148px] flex-wrap gap-1.5 overflow-y-auto pr-1.5">
              {tgtList.items.map((t) => (
                <Chip
                  key={t}
                  sm
                  on={targets.includes(t)}
                  onClick={() => {
                    setTargets((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
                    setPage(0);
                  }}
                >
                  {t}
                </Chip>
              ))}
            </div>
            {tgtList.total > tgtList.items.length && (
              <div className="mt-1.5 text-[11px] text-ink-3">
                {tr("home.moreHint", { n: tgtList.total - tgtList.items.length })}
              </div>
            )}
          </div>

          {lang === "zh" ? (
            <div>
              <GroupLabel icon="heart" count={allDiseases.length}>{tr("home.diseases")}</GroupLabel>
              <input
                value={qDis}
                onChange={(e) => setQDis(e.target.value)}
                placeholder={tr("home.searchDiseases", { n: allDiseases.length })}
                className="mb-1.5 h-7 w-full rounded-md border border-line bg-white px-2 text-[12px] outline-none focus:border-[#9dc0ea]"
              />
              <div className="filter-scroll flex max-h-[148px] flex-wrap gap-1.5 overflow-y-auto pr-1.5">
                {disList.items.map((t) => (
                  <Chip
                    key={t}
                    sm
                    on={diseases.includes(t)}
                    onClick={() => {
                      setDiseases((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
                      setPage(0);
                    }}
                  >
                    {t}
                  </Chip>
                ))}
              </div>
              {disList.total > disList.items.length && (
                <div className="mt-1.5 text-[11px] text-ink-3">
                  {tr("home.moreHint", { n: disList.total - disList.items.length })}
                </div>
              )}
            </div>
          ) : (
            <div>
              <GroupLabel icon="heart" count={0}>{tr("home.diseases")}</GroupLabel>
              <p className="text-[12px] leading-relaxed text-ink-3">{tr("home.diseasesEnOnly")}</p>
            </div>
          )}
        </div>
        )}
      </section>

      {/* 结果带：4 个指标（2026-11-04 v18：外套一层**真折射**玻璃舞台 ——
          背景由 WebGL 采样并弯折，指标本身仍是排版 + 发丝线，不加底色） */}
      <Reveal className="mt-6">
          <section
            data-glass="panel"
            className="lg-surface grid grid-cols-2 gap-y-1 px-1.5 py-1.5 sm:grid-cols-4 sm:gap-0"
          >
            <Metric
              tone="brand"
              label={tr("home.kpiResult")}
              value={view.length}
              hint={tr("home.kpiResultHint", {
                a: st?.coverage ? fmt(st.coverage.drugs_with_biodist) : "…",
                b: st ? fmt(st.drugs) : "…",
              })}
            />
            <Metric
              tone="accent"
              label={tr("home.kpiApproved")}
              value={stageCount["已上市"] ?? 0}
              hint={tr("home.kpiApprovedHint")}
            />
            <Metric
              tone="violet"
              label={tr("home.kpiStruct")}
              value={nStruct}
              hint={tr("home.kpiStructHint", {
                p: view.length ? ((nStruct / view.length) * 100).toFixed(1) : "0.0",
              })}
            />
            <Metric
              tone="sand"
              label={tr("home.kpiDosim")}
              value={st?.dosimetry?.total ?? 0}
              hint={
                st?.dosimetry
                  ? tr("home.kpiDosimHint", { a: fmt(st.dosimetry.drugs), b: st.dosimetry.organs })
                  : tr("home.none")
              }
            />
          </section>
      </Reveal>

      {/* 研发阶段徽章 + 排序 */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-ink-3">{tr("home.stage")}</span>
          {STAGE_ORDER.filter((s) => stageFacet[s]).map((s) => {
            const on = stages.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setStages((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
                  setPage(0);
                }}
                className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition hover:ring-1 hover:ring-brand/30 ${
                  on
                    ? "border-brand bg-brand text-white shadow-[0_2px_8px_-2px_rgba(30,91,168,.55)]"
                    : `${STAGE_TONE[s]} hover:-translate-y-px hover:shadow-s1`
                }`}
                title={tr("home.stageClick")}
              >
                {stageLabel(lang, s)}{" "}
                <span className="tabular-nums opacity-80">{fmt(stageFacet[s])}</span>
              </button>
            );
          })}
          {stages.length > 0 && (
            <button
              type="button"
              onClick={() => setStages([])}
              className="text-[11.5px] font-medium text-brand-deep transition hover:underline"
            >
              {tr("home.stageClear")}
            </button>
          )}
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

      <div className="mt-7 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2.5">
          <span className="font-mono text-[11px] uppercase tracking-[.14em] text-ink-3">{tr("home.tableNo")}</span>
          <h2 className="sec-h">{tr("home.list")}</h2>
        </div>
        <span className="text-[12px] text-ink-3">
          {tr("home.countLine", {
            a: st?.coverage ? fmt(st.coverage.drugs_with_biodist) : "…",
            b: st ? fmt(st.drugs) : "…",
          })}
        </span>
      </div>

      {/* v19：主表也进玻璃 —— "边光型"背景（中间压白，四边彩光）⇒ 数字仍落在白纸上，
          但表框与四角是强折射 + 色散；行背景是白 `tr`，不受玻璃化影响 */}
      <div data-glass="panel" className="card-solid lg-surface glass-edge mt-3 overflow-hidden">
        <div className="hscroll max-h-[calc(100vh-230px)] overflow-y-auto">
          <table className="table-booktabs w-full border-collapse text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-line bg-white text-[11.5px] uppercase tracking-wide text-ink-3 shadow-[0_1px_0_rgba(228,234,244,.9)]">
                <th className="px-2 py-2.5 text-center font-semibold sm:px-3">{tr("home.thProfile")}</th>
                <th className="px-2 py-2.5 text-left font-semibold sm:px-4">{tr("home.thDrug")}</th>
                <th className="px-2 py-2.5 text-left font-semibold sm:px-3">{tr("home.thType")}</th>
                <th className="hidden px-3 py-2.5 text-left font-semibold sm:table-cell">{tr("home.thIsotope")}</th>
                <th className="hidden px-3 py-2.5 text-left font-semibold lg:table-cell">{tr("home.thTarget")}</th>
                <th className="hidden px-3 py-2.5 text-left font-semibold lg:table-cell">{tr("home.thDisease")}</th>
                <th className="hidden px-3 py-2.5 text-left font-semibold sm:table-cell">{tr("home.thStage")}</th>
                <th className="px-2 py-2.5 text-right font-semibold sm:px-3">{tr("home.thPoints")}</th>
                <th className="hidden px-3 py-2.5 text-center font-semibold sm:table-cell">{tr("home.thStruct")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.drug_id} className="group border-b border-[#f1f4f9] transition-colors hover:bg-[#f7fbff]">
                  <td className="border-l-2 border-transparent px-2 py-2.5 text-center transition-colors group-hover:border-l-brand/50 sm:px-3">
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
                  <td className="num px-2 py-2.5 text-right text-[12.5px] sm:px-3">
                    {d.n_points ? (
                      <span className="font-semibold text-ink">{d.n_points}</span>
                    ) : (
                      <span className="text-ink-3" title={tr("home.noPts")}>
                        —
                      </span>
                    )}
                  </td>
                  <td className="hidden px-3 py-2.5 text-center text-[13px] sm:table-cell">
                    {realStruct(d.drug_id, d.has_struct) ? (
                      <span className="text-ok">✓</span>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
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