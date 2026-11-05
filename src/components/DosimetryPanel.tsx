import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fmt, useJSON, type DoseRow } from "../lib/data";
import { STR, useLang, useT, type Lang } from "../lib/i18n";
import { EmptyState, ErrorState, TableSkeleton } from "./States";

/* ------------------------------------------------------------------
   剂量学面板（pk262 B1）：把 dosimetry.json 的 403 行接进单药画像。
   一行 = 一个「药物 × 器官 × 原文单位」，同一器官可能因原文括注出现
   两个单位口径（如 0.0247 mGy/MBq (91 mrad/mCi)），因此**保留不合并**，
   只在聚合视图里按器官归组（组内仍逐条列出，原文可展开）。

   - 传 drugId ⇒ 单药视图：横向条形图，按归一化剂量降序
   - 不传     ⇒ 全库视图：按药聚合的表格（保留全库检索能力）
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

const UNIT_HINT: Record<string, { zh: string; en: string }> = {
  "mGy/MBq": { zh: "器官吸收剂量", en: "organ absorbed dose" },
  "μGy/MBq": { zh: "器官吸收剂量（1 μGy/MBq = 0.001 mGy/MBq）", en: "organ absorbed dose (1 μGy/MBq = 0.001 mGy/MBq)" },
  "Gy/MBq": { zh: "器官吸收剂量（原文即以 Gy/MBq 计，量级偏高，已在审计清单）", en: "organ absorbed dose (reported in Gy/MBq; high magnitude, flagged in the audit list)" },
  "mSv/MBq": { zh: "全身有效剂量，不是器官吸收剂量 —— 不参与排序", en: "whole-body effective dose, not organ absorbed dose — not sorted" },
  "rad/mCi": { zh: "旧单位（1 rad/mCi = 0.2703 mGy/MBq）", en: "legacy unit (1 rad/mCi = 0.2703 mGy/MBq)" },
  "mrad/mCi": { zh: "旧单位（1 mrad/mCi = 0.2703 μGy/MBq）", en: "legacy unit (1 mrad/mCi = 0.2703 μGy/MBq)" },
};

const norm = (r: DoseRow): number | null => {
  const k = TO_MGY[r.u];
  return k === undefined ? null : r.v * k;
};

const showNum = (n: number | null) =>
  n === null ? "—" : n >= 0.01 ? String(Number(n.toPrecision(4))) : n.toExponential(2);

/** organ 是库内归一化英文键（小写），显示时首字母大写；null 单列，避免被静默丢掉。 */
const NONE = "__none__";
const organLabel = (o: string | null, lang: Lang) =>
  o ? o.charAt(0).toUpperCase() + o.slice(1) : STR["dose.organUnknown"][lang];
const organKey = (o: string | null) => o ?? NONE;

type Agg = {
  key: string;
  organ: string | null;
  rows: DoseRow[];
  /** 该器官的最大归一值（mGy/MBq）；整组不可归一时为 null */
  mgy: number | null;
  /** 条形图/表格的代表行 */
  primary: DoseRow;
};

/** 按器官归组；组内按归一值降序，代表行取最大者（不可归一的排最后）。 */
function aggregate(rows: DoseRow[]): Agg[] {
  const m = new Map<string, DoseRow[]>();
  for (const r of rows) {
    const k = organKey(r.organ);
    const a = m.get(k);
    if (a) a.push(r);
    else m.set(k, [r]);
  }
  return [...m.entries()].map(([key, rs]) => {
    const sorted = [...rs].sort((a, b) => (norm(b) ?? -1) - (norm(a) ?? -1));
    return {
      key,
      organ: rs[0].organ,
      rows: sorted,
      mgy: norm(sorted[0]),
      primary: sorted[0],
    };
  });
}

function Badge({ grade }: { grade: string }) {
  return (
    <span
      className={`badge ${
        grade === "A" ? "badge-a" : grade === "C" ? "badge-c" : "badge-b"
      }`}
    >
      {grade}
    </span>
  );
}


/** 单药视图：横向条形图（按归一化剂量降序）+ 组内原文可展开。 */
function DrugView({ rows }: { rows: DoseRow[] }) {
  const tr = useT();
  const { lang } = useLang();
  const [open, setOpen] = useState<string | null>(null);

  const aggs = useMemo(
    () =>
      aggregate(rows).sort(
        (a, b) => (b.mgy ?? -1) - (a.mgy ?? -1) || a.key.localeCompare(b.key)
      ),
    [rows]
  );

  const bars = aggs.filter((a) => a.mgy !== null && a.mgy > 0);
  const noBar = aggs.filter((a) => a.mgy === null);
  const max = bars.length ? Math.max(...bars.map((a) => a.mgy as number)) : 0;
  const top = bars[0];

  const isotopes = [...new Set(rows.map((r) => r.iso).filter(Boolean))].join(" / ") || "—";
  const species = [...new Set(rows.map((r) => r.species).filter(Boolean))].join(" / ") || "—";
  const models = [...new Set(rows.map((r) => r.model).filter(Boolean))].join(" / ") || "—";
  const units = [...new Set(rows.map((r) => r.u))].sort(
    (a, b) => UNIT_ORDER.indexOf(a) - UNIT_ORDER.indexOf(b)
  );
  const missing = rows.filter((r) => norm(r) === null).length;

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
        <h3 className="text-[15px] font-semibold text-ink">{tr("dose.title")}</h3>
        <span className="text-[11.5px] leading-relaxed text-ink-3">
          {bars.length > 0 ? tr("dose.sortedBy") : tr("dose.rawScale")} ·{" "}
          {tr("dose.countLine", { a: fmt(rows.length), b: fmt(aggs.length) })}
        </span>
      </div>

      <div
        className={`mt-3 grid gap-x-4 gap-y-2 rounded-[10px] bg-tint-soft px-3.5 py-3 text-[12px] ${
          top ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"
        }`}
      >
        <div>
          <div className="text-ink-3">{tr("dose.isotope")}</div>
          <div className="mt-0.5 font-medium text-ink">{isotopes}</div>
        </div>
        <div>
          <div className="text-ink-3">{tr("dose.species")}</div>
          <div className="mt-0.5 font-medium text-ink">{species}</div>
        </div>
        {top && (
          <div>
            <div className="text-ink-3">{tr("dose.topOrgan")}</div>
            <div className="mt-0.5 font-medium text-ink">{organLabel(top.organ, lang)}</div>
          </div>
        )}
        {top && (
          <div>
            <div className="text-ink-3">{tr("dose.topValue")}</div>
            <div className="num mt-0.5 font-medium text-ink">{`${showNum(top.mgy)} mGy/MBq`}</div>
          </div>
        )}
      </div>

      {bars.length > 0 && (
        <ul className="mt-4 space-y-2.5">
          {bars.map((a) => {
            const v = a.mgy as number;
            const w = max > 0 ? Math.max(1.5, (v / max) * 100) : 0;
            const isOpen = open === a.key;
            return (
              <li key={a.key}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : a.key)}
                  className="w-full cursor-pointer text-left"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] font-medium text-ink">
                      {organLabel(a.organ, lang)}
                      {a.rows.length > 1 && (
                        <span className="ml-1.5 rounded bg-tint px-1.5 py-[1px] text-[10.5px] font-normal text-ink-3">
                          {tr("dose.rowsN", { n: a.rows.length })}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="num text-[13px] font-semibold text-ink">{showNum(a.mgy)}</span>
                      <span className="ml-1 text-[11px] text-ink-3">mGy/MBq</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-tint">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#4b8fd9] to-brand"
                      style={{ width: `${w}%` }}
                    />
                  </div>
                  {a.primary.u !== "mGy/MBq" && (
                    <div className="mt-0.5 text-[11px] text-ink-3">
                      {tr("dose.rawLabel")}
                      {a.primary.v} {a.primary.u} ·{" "}
                      {UNIT_HINT[a.primary.u]?.[lang] ?? tr("dose.unitUnregistered")}
                    </div>
                  )}
                </button>
                {isOpen && (
                  <div className="mt-1.5 rounded-[8px] border border-line bg-tint-soft px-3 py-2">
                    {a.rows.map((r) => (
                      <div
                        key={`${r.did}-${r.organ}-${r.u}-${r.v}`}
                        className="py-0.5 text-[11.5px] text-ink-2"
                      >
                        <span className="num">
                          {r.v} {r.u}
                        </span>
                        <span className="ml-2 text-ink-3">
                          {r.organ_raw ?? "—"} · {r.model ?? "—"} · src={r.src}
                        </span>
                        <span className="ml-2 inline-flex align-middle">
                          <Badge grade={r.grade} />
                        </span>
                        {r.raw && (
                          <div className="mt-0.5 break-words text-[11px] leading-relaxed text-ink-3">
                            {tr("dose.rawLabel")}
                            {r.raw}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}



      {bars.length === 0 && (
        <div className="mt-4 rounded-lg border border-dashed border-[#e8edf5] px-4 py-5 text-center text-[12.5px] leading-relaxed text-ink-3">
          {tr("dose.mixedUnit", { n: fmt(rows.length), u: units.join(" / ") })}
        </div>
      )}

      {noBar.length > 0 && (
        <div className="mt-4 rounded-[10px] border border-[#f6e3c8] bg-[#fdf8f1] px-3.5 py-3">
          <div className="text-[12px] font-medium text-[#a9620d]">
            {tr("dose.unmappable", { a: noBar.length, b: missing })}
          </div>
          <div className="mt-1 space-y-1">
            {noBar.map((a) => (
              <div key={a.key} className="text-[12px] text-ink-2">
                <span className="font-medium">{organLabel(a.organ, lang)}</span>
                <span className="num ml-2">
                  {a.primary.v} {a.primary.u}
                </span>
                <span className="ml-2 text-ink-3">{UNIT_HINT[a.primary.u]?.[lang] ?? ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-3">
        {tr("dose.note", { src: "dosage_and_administration_table" })} {tr("dose.models")}
        <span className="font-mono">{models}</span>
        {units.length > 1 && (
          <>
            {" · "}
            {tr("dose.unitScope")}
            {units.join(" / ")}
          </>
        )}
        <> · {tr("dose.clickToExpand")}</>
      </div>
    </div>
  );
}

type Group = {
  did: number;
  name: string;
  rows: DoseRow[];
  organs: number;
  top: Agg | null;
  units: string[];
  grades: string[];
  iso: string;
};

/** 全库视图：按药聚合，保留检索（药名 / id）—— 剂量学层的全库入口。 */
function LibraryView({ rows }: { rows: DoseRow[] }) {
  const tr = useT();
  const { lang } = useLang();
  const [q, setQ] = useState("");

  const groups = useMemo<Group[]>(() => {
    const m = new Map<number, DoseRow[]>();
    for (const r of rows) {
      const a = m.get(r.did);
      if (a) a.push(r);
      else m.set(r.did, [r]);
    }
    return [...m.entries()].map(([did, rs]) => {
      const aggs = aggregate(rs).sort((a, b) => (b.mgy ?? -1) - (a.mgy ?? -1));
      return {
        did,
        name: rs[0].drug,
        rows: rs,
        organs: aggs.length,
        top: aggs[0] ?? null,
        units: [...new Set(rs.map((r) => r.u))],
        grades: [...new Set(rs.map((r) => r.grade))].sort(),
        iso: [...new Set(rs.map((r) => r.iso).filter(Boolean))].join(" / "),
      };
    });
  }, [rows]);

  const kw = q.trim().toLowerCase();
  const list = useMemo(
    () =>
      groups
        .filter((g) => !kw || g.name.toLowerCase().includes(kw) || String(g.did).includes(kw))
        .sort((a, b) => b.organs - a.organs || a.did - b.did),
    [groups, kw]
  );

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">{tr("dose.library")}</h2>
          <p className="mt-0.5 text-[12px] text-ink-3">
            {tr("dose.libraryLine", { a: fmt(groups.length), b: fmt(rows.length) })}
          </p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tr("dose.searchPh")}
          className="w-full rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] text-ink outline-none transition placeholder:text-ink-3 focus:border-[#8fb8e8] sm:w-[240px]"
        />
      </div>

      {list.length === 0 ? (
        <EmptyState
          title={tr("dose.noMatch")}
          hint={tr("dose.noMatchHint", { n: fmt(groups.length), q })}
        >
          <button
            type="button"
            onClick={() => setQ("")}
            className="rounded-lg border border-line bg-white px-3 py-1.5 text-[12.5px] text-ink-2 transition hover:bg-[#f7f9fd]"
          >
            {tr("dose.clear")}
          </button>
        </EmptyState>
      ) : (
        <div className="hscroll">
          <table className="w-full min-w-[720px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-line bg-tint-soft text-[11px] uppercase tracking-wide text-ink-3">
                <th className="px-4 py-2 text-left font-medium">{tr("dose.thDrug")}</th>
                <th className="px-3 py-2 text-left font-medium">{tr("dose.thIsotope")}</th>
                <th className="px-3 py-2 text-right font-medium">{tr("dose.thOrgans")}</th>
                <th className="px-3 py-2 text-right font-medium">{tr("dose.thRows")}</th>
                <th className="px-3 py-2 text-left font-medium">{tr("dose.thTopOrgan")}</th>
                <th className="px-3 py-2 text-right font-medium">{tr("dose.thTopValue")}</th>
                <th className="px-3 py-2 text-left font-medium">{tr("dose.thUnit")}</th>
                <th className="px-3 py-2 text-center font-medium">{tr("dose.thEvidence")}</th>
                <th className="px-4 py-2 text-right font-medium">{tr("dose.thProfile")}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((g) => (
                <tr key={g.did} className="border-b border-[#f4f6fb] transition hover:bg-tint-soft">
                  <td className="max-w-[240px] px-4 py-2">
                    <div className="truncate font-medium text-ink">{g.name}</div>
                    <div className="num text-[11px] text-ink-3">#{g.did}</div>
                  </td>
                  <td className="px-3 py-2 text-ink-2">{g.iso || "—"}</td>
                  <td className="num px-3 py-2 text-right text-ink-2">{g.organs}</td>
                  <td className="num px-3 py-2 text-right text-ink-3">{g.rows.length}</td>
                  <td className="px-3 py-2 text-ink-2">{g.top ? organLabel(g.top.organ, lang) : "—"}</td>
                  <td className="num px-3 py-2 text-right font-semibold text-ink">
                    {g.top && g.top.mgy !== null ? showNum(g.top.mgy) : "—"}
                  </td>
                  <td className="px-3 py-2 text-[11.5px] text-ink-3">{g.units.join(" / ")}</td>
                  <td className="px-3 py-2 text-center">
                    {g.grades.map((x) => (
                      <span key={x} className="ml-1 inline-flex">
                        <Badge grade={x} />
                      </span>
                    ))}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      to={`/drug/${g.did}`}
                      className="text-[12px] font-medium text-brand hover:underline"
                    >
                      {tr("dose.detail")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function DosimetryPanel({ drugId }: { drugId?: number }) {
  const tr = useT();
  const { data, error, loading, reload } = useJSON<DoseRow[]>("dosimetry.json");
  const rows = data ?? [];

  const mine = useMemo(
    () => (drugId === undefined ? [] : rows.filter((r) => r.did === drugId)),
    [rows, drugId]
  );

  if (loading) return <TableSkeleton rows={6} cols={4} />;
  if (error)
    return (
      <ErrorState message={tr("dose.errLoad") + error} onRetry={reload} />
    );

  if (drugId !== undefined) {
    if (mine.length === 0)
      return (
        <EmptyState title={tr("dose.emptyTitle")} hint={tr("dose.emptyHint")}>
          {/* 不给 /dosimetry 链接：该路由在 App.tsx 的 LEGACY 里 redirect 回首页，点了会白跑一趟 */}
          <span className="num text-[12px] text-ink-3">
            {tr("dose.libLine", { a: fmt(rows.length), b: fmt(new Set(rows.map((r) => r.did)).size) })}
          </span>
        </EmptyState>
      );
    return <DrugView rows={mine} />;
  }

  if (rows.length === 0)
    return (
      <EmptyState title={tr("dose.layerEmptyTitle")} hint={tr("dose.layerEmptyHint")} />
    );

  return <LibraryView rows={rows} />;
}


