import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useJSON, fmt, type Drug, type Stats } from "../lib/data";
import { Icon, type IconName } from "../components/Icon";
import { ErrorState } from "../components/States";

const PAGE = 30;

/** 研发阶段归一（对齐原 app.py 的 stage_code：取最高阶段）。 */
function stageOf(s: string | null): string {
  if (!s) return "未标注";
  if (/approval/i.test(s)) return "已上市";
  if (/phase|clinical trial/i.test(s)) return "临床";
  if (/preclinical/i.test(s)) return "临床前";
  return "未标注";
}

const STAGE_ORDER = ["已上市", "临床", "临床前", "未标注"];
const STAGE_TONE: Record<string, string> = {
  已上市: "bg-[#e6f4f1] text-[#0a7d6f] border-[#c6e8e1]",
  临床: "bg-[#e8f0fa] text-[#164a8a] border-[#d3e2f6]",
  临床前: "bg-[#f3e8fb] text-[#7a3fa8] border-[#e6d2f2]",
  未标注: "bg-[#eef2f8] text-[#516078] border-[#dfe6f0]",
};

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
  const [types, setTypes] = useState<string[]>(() => arr("type"));
  const [nucs, setNucs] = useState<string[]>(() => arr("nuc"));
  const [targets, setTargets] = useState<string[]>(() => arr("tgt"));
  const [diseases, setDiseases] = useState<string[]>(() => arr("dis"));
  const [sort, setSort] = useState(() => sp.get("sort") ?? "阶段优先");
  const [page, setPage] = useState(() => Number(sp.get("p") ?? 0) || 0);
  const [onlyPts, setOnlyPts] = useState(() => sp.get("pts") === "1");
  const [hideBad, setHideBad] = useState(() => sp.get("hide") === "1");
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
  const allNucs = useMemo(() => splitUniq((drugs ?? []).map((d) => d.radionuclides_zh)), [drugs]);
  const allTargets = useMemo(() => splitUniq((drugs ?? []).map((d) => d.targets_zh)), [drugs]);
  const allDiseases = useMemo(() => splitUniq((drugs ?? []).map((d) => d.diseases_zh)), [drugs]);

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
        <h1 className="text-[26px] font-bold tracking-tight">💊 核药总览</h1>
        <p className="text-[13px] text-ink-3">
          有数据 <b className="num font-semibold text-ink-2">{st?.coverage ? fmt(st.coverage.drugs_with_biodist) : "…"}</b> 个
          · 目录收录 <b className="num font-semibold text-ink-2">{st ? fmt(st.drugs) : "…"}</b>
        </p>
      </div>
      <p className="mt-1.5 text-[13px] text-ink-3">按类型 / 核素 / 靶点 / 适应症筛选 · 点标签即生效</p>

      {error && (
        <div className="mt-4">
          <ErrorState message={`药物目录（drugs.json）加载失败：${error}`} onRetry={reload} />
        </div>
      )}

      {/* 常用查询（一行胶囊 · 不占版面） */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-ink-3">常用：</span>
        <Chip on={onlyPts} onClick={() => setOnlyPts((v) => !v)}>
          有生物分布数据（{st?.coverage ? fmt(st.coverage.drugs_with_biodist) : "…"}）
        </Chip>
        <Chip on={hideBad} onClick={() => setHideBad((v) => !v)}>
          隐藏疑似非药名（175）
        </Chip>
        <Chip onClick={() => setKw("PSMA")}>PSMA 相关核药</Chip>
        <Chip onClick={() => setNucs(["镥-177"])}>Lu-177 标记药物</Chip>
        <Chip onClick={() => setNucs(["镓-68"])}>Ga-68 标记药物</Chip>
      </div>

      {/* 筛选卡（常驻展开 · 对齐原页「不要折叠」） */}
      <section className="card mt-5 p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <b className="text-[15px] tracking-tight">筛选条件</b>
            <span className="rounded-full bg-[#eef2f8] px-2 py-0.5 text-[11.5px] font-medium text-ink-3">
              {view.length !== (drugs?.length ?? 0) ? "已筛选" : "全库"}
            </span>
          </div>
          <button onClick={reset} className="text-[13px] text-ink-3 transition hover:text-brand">
            ↺ 重置
          </button>
        </div>

        <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
          <div>
            <GroupLabel icon="layers" count={allTypes.length}>
              药物类型
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
                  {t.replace("-based RP", "").replace("Microsphere/Nanoconstruct", "微球/纳米")}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <GroupLabel icon="atom" count={allNucs.length}>
              核素 <span className="font-normal text-ink-3/60">· Top 12</span>
            </GroupLabel>
            <div className="flex flex-wrap gap-2">
              {allNucs.slice(0, 12).map((n) => (
                <Chip
                  key={n}
                  on={nucs.includes(n)}
                  onClick={() => {
                    setNucs((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));
                    setPage(0);
                  }}
                >
                  {n}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <GroupLabel icon="target" count={allTargets.length}>靶点</GroupLabel>
            <select
              multiple
              size={4}
              value={targets}
              onChange={(e) => {
                setTargets([...e.target.selectedOptions].map((o) => o.value));
                setPage(0);
              }}
              className="w-full rounded-lg border border-line bg-white px-2 text-[12.5px] leading-5 outline-none focus:border-[#9dc0ea]"
            >
              {allTargets.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <GroupLabel icon="heart" count={allDiseases.length}>适应症</GroupLabel>
            <select
              multiple
              size={4}
              value={diseases}
              onChange={(e) => {
                setDiseases([...e.target.selectedOptions].map((o) => o.value));
                setPage(0);
              }}
              className="w-full rounded-lg border border-line bg-white px-2 text-[12.5px] leading-5 outline-none focus:border-[#9dc0ea]"
            >
              {allDiseases.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* 结果带：4 个指标（对齐原页 st.metric 四格） */}
      <section className="mt-5 grid grid-cols-2 gap-4 border-y border-line py-4 lg:grid-cols-4">
        <Metric
          label="结果药物"
          value={fmt(view.length)}
          hint={`有数据 ${st?.coverage ? fmt(st.coverage.drugs_with_biodist) : "…"} / 目录 ${st ? fmt(st.drugs) : "…"}`}
        />
        <Metric label="已上市" value={fmt(stageCount["已上市"] ?? 0)} hint="最高阶段 = Approval" />
        <Metric
          label="结构图覆盖"
          value={fmt(nStruct)}
          hint={`${view.length ? ((nStruct / view.length) * 100).toFixed(1) : "0.0"}% · 有背证结构`}
        />
        <Metric
          label="剂量学记录"
          value={fmt(st?.dosimetry?.total ?? 0)}
          hint={
            st?.dosimetry ? `${fmt(st.dosimetry.drugs)} 个药 · ${st.dosimetry.organs} 器官` : "暂无"
          }
        />
      </section>

      {/* 研发阶段徽章 + 排序 */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-ink-3">研发阶段：</span>
          {STAGE_ORDER.filter((s) => stageCount[s]).map((s) => (
            <span
              key={s}
              className={`rounded-full border px-2 py-0.5 text-[11.5px] font-medium ${STAGE_TONE[s]}`}
            >
              {s} {fmt(stageCount[s])}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-ink-3">排序</span>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(0);
            }}
            className="rounded-lg border border-line bg-white px-2 py-1 text-[12.5px] outline-none focus:border-[#9dc0ea]"
          >
            {["阶段优先", "名称 A→Z", "名称 Z→A"].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
      </div>

      <h2 className="mt-6 text-[16px] font-semibold">药物清单</h2>

      <div className="card mt-3 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line bg-[#fafbfe] text-[11.5px] uppercase tracking-wide text-ink-3">
                <th className="px-2 py-2.5 text-center font-semibold sm:px-3">单药画像</th>
                <th className="px-2 py-2.5 text-left font-semibold sm:px-4">核药</th>
                <th className="px-2 py-2.5 text-left font-semibold sm:px-3">类型</th>
                <th className="hidden px-3 py-2.5 text-left font-semibold sm:table-cell">核素</th>
                <th className="hidden px-3 py-2.5 text-left font-semibold lg:table-cell">靶点</th>
                <th className="hidden px-3 py-2.5 text-left font-semibold lg:table-cell">适应症</th>
                <th className="hidden px-3 py-2.5 text-left font-semibold sm:table-cell">阶段</th>
                <th className="px-2 py-2.5 text-center font-semibold sm:px-3">分布</th>
                <th className="hidden px-3 py-2.5 text-center font-semibold sm:table-cell">结构</th>
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
                      查看 →
                    </Link>
                  </td>
                  <td className="px-2 py-2.5 sm:px-4">
                    <Link
                      to={`/drug/${d.drug_id}`}
                      className="font-medium text-ink transition hover:text-brand hover:underline"
                    >
                      {d.name_en}
                    </Link>
                    {d.name_zh && <div className="text-[11.5px] text-ink-3">{d.name_zh}</div>}
                    <div className="text-[11px] text-ink-3 sm:hidden">
                      {d.radionuclides_zh || "—"} · {d.stage}
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-ink-2 sm:px-3">
                    {(d.drug_type || "未分类").replace("-based RP", "")}
                  </td>
                  <td className="hidden px-3 py-2.5 text-ink-2 sm:table-cell">{d.radionuclides_zh || "—"}</td>
                  <td
                    className="hidden max-w-[190px] truncate px-3 py-2.5 text-ink-2 lg:table-cell"
                    title={d.targets_zh || ""}
                  >
                    {d.targets_zh || "—"}
                  </td>
                  <td
                    className="hidden max-w-[190px] truncate px-3 py-2.5 text-ink-2 lg:table-cell"
                    title={d.diseases_zh || ""}
                  >
                    {d.diseases_zh || "—"}
                  </td>
                  <td className="hidden px-3 py-2.5 sm:table-cell">
                    <span
                      className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${STAGE_TONE[d.stage]}`}
                    >
                      {d.stage}
                    </span>
                  </td>
                  <td className="num px-2 py-2.5 text-center text-[12.5px] sm:px-3">
                    {d.n_points ? (
                      <span className="font-semibold text-ink">{d.n_points}</span>
                    ) : (
                      <span className="text-ink-3" title="暂无生物分布记录">
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
                    <div className="text-[13.5px] font-medium text-ink-2">当前条件没有匹配的核药</div>
                    <div className="mt-1 text-[12.5px] text-ink-3">
                      试试去掉最窄的那个条件（靶点 / 适应症通常最窄）
                    </div>
                    <button
                      onClick={reset}
                      className="mt-4 rounded-lg border border-brand bg-brand-soft px-4 py-2 text-[13px] font-medium text-brand-deep transition hover:bg-brand/15"
                    >
                      清除全部筛选 · 回到全库 {drugs.length.toLocaleString("en-US")} 个
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-ink-3">
        <div>
          共 {fmt(view.length)} 条 · 第 {cur + 1} / {pages} 页
        </div>
        <div className="flex gap-2">
          <button
            disabled={cur === 0}
            onClick={() => setPage(cur - 1)}
            className="rounded-lg border border-line bg-white px-3 py-1 transition hover:border-[#c3d6ea] disabled:opacity-40"
          >
            上一页
          </button>
          <button
            disabled={cur >= pages - 1}
            onClick={() => setPage(cur + 1)}
            className="rounded-lg border border-line bg-white px-3 py-1 transition hover:border-[#c3d6ea] disabled:opacity-40"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
}
