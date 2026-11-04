import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { EmptyState, ErrorState } from "../components/States";
import ImageViewer from "../components/ImageViewer";
import { fmt, loadFigManifest, refLink, type Fig } from "../lib/data";
import { useT, type StrKey } from "../lib/i18n";

const BASE = import.meta.env.BASE_URL;

/** 归属标签：文案走 i18n（`lib/i18n.tsx`），这里只保留配色 */
const ATTRIB: Record<Fig["attrib"], { key: StrKey; whyKey: StrKey; cls: string }> = {
  target: { key: "atlas.attr.target", whyKey: "atlas.attr.targetWhy", cls: "bg-[#dcfce7] text-[#166534]" },
  unclear: { key: "atlas.attr.unclear", whyKey: "atlas.attr.unclearWhy", cls: "bg-[#fef3c7] text-[#92400e]" },
  comparator: { key: "atlas.attr.comparator", whyKey: "atlas.attr.comparatorWhy", cls: "bg-[#fee2e2] text-[#991b1b]" },
};

/** manifest 走 `lib/data` 的单例缓存 ⇒ 图集页与单药页共用同一次下载/解析 */
function useFigs() {
  const [data, setData] = useState<Fig[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    setErr(null);
    loadFigManifest(n > 0)
      .then((v) => alive && setData(v))
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [n]);
  return { data, err, loading: !data && !err, reload: () => setN((x) => x + 1) };
}

/** 每次「加载更多」渲染的张数。图池已 2,011 张，全量渲染会一次造几万 DOM 节点 ⇒ 渐进渲染。 */
const PAGE = 60;

const isAttrib = (v: string): v is Fig["attrib"] => v === "target" || v === "unclear" || v === "comparator";

export default function Atlas() {
  const { data, err, loading, reload } = useFigs();
  const tr = useT();
  /** 筛选写进 URL（?drug=&attrib=）⇒ 可分享、刷新保持、前进后退可用。
   *  与顶部搜索共用同一个 URLSearchParams ⇒ 只动自己的键，不碰 q。 */
  const [sp, setSp] = useSearchParams();
  const drug = Number(sp.get("drug") ?? 0) || 0;
  const rawAttrib = sp.get("attrib") ?? "all";
  const attrib: Fig["attrib"] | "all" = isAttrib(rawAttrib) ? rawAttrib : "all";
  const setFilter = (next: { drug?: number; attrib?: Fig["attrib"] | "all" }) => {
    const p = new URLSearchParams(sp);
    const d = next.drug ?? drug;
    const a = next.attrib ?? attrib;
    if (d) p.set("drug", String(d));
    else p.delete("drug");
    if (a === "all") p.delete("attrib");
    else p.set("attrib", a);
    setSp(p, { replace: true });
  };
  const [zoom, setZoom] = useState<Fig | null>(null);
  const [limit, setLimit] = useState(PAGE);
  /** 药名检索：输入即给建议（前 8 个匹配药），选中后写进 URL 的 ?drug=（510 个药不再逐个铺 chip） */
  const [drugQ, setDrugQ] = useState("");
  const [sugOpen, setSugOpen] = useState(false);

  const drugs = useMemo(() => {
    const m = new Map<number, { name: string; n: number }>();
    for (const f of data ?? []) {
      const cur = m.get(f.drug_id);
      m.set(f.drug_id, { name: f.drug_name, n: (cur?.n ?? 0) + 1 });
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [data]);

  const list = useMemo(() => {
    const rank: Record<Fig["attrib"], number> = { target: 0, unclear: 1, comparator: 2 };
    return (data ?? [])
      .filter((f) => (drug === 0 || f.drug_id === drug) && (attrib === "all" || f.attrib === attrib))
      .sort((a, b) => rank[a.attrib] - rank[b.attrib] || a.drug_id - b.drug_id);
  }, [data, drug, attrib]);

  /** 筛选条件变化 ⇒ 回到第一页（否则会在新结果里停在很深的 offset） */
  useEffect(() => setLimit(PAGE), [drug, attrib, data]);

  /** 弹层：Esc 关闭（键盘可达） */
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoom(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  const shown = useMemo(() => list.slice(0, limit), [list, limit]);

  /** 当前选中的药（来自 URL `?drug=`），用于搜索框回显与「清除」 */
  const selected = useMemo(() => (drug ? drugs.find(([id]) => id === drug) : undefined), [drug, drugs]);

  /** 检索建议：输入非空时给前 8 个匹配药（按图数排序，故热门药在前） */
  const suggest = useMemo(() => {
    const k = drugQ.trim().toLowerCase();
    if (!k) return [];
    return drugs.filter(([, d]) => d.name.toLowerCase().includes(k)).slice(0, 8);
  }, [drugs, drugQ]);

  /** 选中建议项：写进 URL，并把输入框回显为该药名 */
  const pickDrug = (id: number, name: string) => {
    setFilter({ drug: id });
    setDrugQ(name);
    setSugOpen(false);
  };

  /** 归属按钮上的计数：让「全部 2,011」与「图注点名本药 1,728」一眼可比 */
  const counts = useMemo(() => {
    const c: Record<Fig["attrib"] | "all", number> = { all: 0, target: 0, unclear: 0, comparator: 0 };
    for (const f of data ?? []) {
      c.all += 1;
      c[f.attrib] += 1;
    }
    return c;
  }, [data]);

  return (
    <div className="pb-4">
      <div className="mt-4 rounded-[10px] border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-[12.5px] leading-relaxed text-[#92400e]">
        <b>{tr("atlas.howto")}</b>
        <span className="mx-1 rounded bg-[#dcfce7] px-1.5 py-0.5 text-[#166534]">{tr("atlas.attr.target")}</span>
        <span className="mx-1 rounded bg-[#fee2e2] px-1.5 py-0.5 text-[#991b1b]">{tr("atlas.attr.comparator")}</span>
        <span className="mx-1 rounded bg-[#fef3c7] px-1.5 py-0.5 text-[#92400e]">{tr("atlas.attr.unclear")}</span>
      </div>

      {/* 归属筛选（带计数 · 语义上先于药名） */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-ink-3">{tr("atlas.attrib")}</span>
        {(["all", "target", "unclear", "comparator"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter({ attrib: k })}
            title={k === "all" ? tr("atlas.all") : tr(ATTRIB[k].whyKey)}
            className={`rounded-full border px-3 py-1 text-[12.5px] transition ${
              attrib === k ? "border-brand bg-brand-soft text-brand-deep" : "border-line bg-white text-ink-2 hover:border-[#b9d0e9]"
            }`}
          >
            {k === "all" ? tr("atlas.all") : tr(ATTRIB[k].key)}
            <span className="num ml-1 text-[11px] opacity-70">{data ? fmt(counts[k]) : "…"}</span>
          </button>
        ))}
      </div>

      {/* 药名：不再逐个铺 chip（510 个药），改成输入即建议；选中即写 URL ?drug=，并可跳单药画像 */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-ink-3">{tr("atlas.drug")}</span>
        <div className="relative">
          <input
            value={drugQ}
            onChange={(e) => {
              setDrugQ(e.target.value);
              setSugOpen(true);
              if (!e.target.value.trim()) setFilter({ drug: 0 });
            }}
            onFocus={() => setSugOpen(true)}
            onBlur={() => setSugOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSugOpen(false);
              if (e.key === "Enter" && suggest[0]) pickDrug(suggest[0][0], suggest[0][1].name);
            }}
            placeholder={tr("atlas.drugPh")}
            aria-label={tr("atlas.drugPh")}
            className="h-9 w-[220px] rounded-full border border-line bg-white px-3.5 pr-8 text-[12.5px] outline-none transition focus:border-[#9dc0ea] focus:ring-[3px] focus:ring-brand/10"
          />
          {drugQ && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setDrugQ("");
                setSugOpen(false);
                setFilter({ drug: 0 });
              }}
              aria-label={tr("atlas.drugClear")}
              className="absolute right-2 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-[11px] text-ink-3 transition hover:bg-[#eef2f8] hover:text-ink"
            >
              ✕
            </button>
          )}
          {sugOpen && suggest.length > 0 && (
            <ul className="absolute left-0 top-10 z-40 max-h-[280px] w-[260px] overflow-auto rounded-[10px] border border-line bg-white py-1 shadow-s2">
              {suggest.map(([id, d]) => (
                <li key={id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickDrug(id, d.name)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[12.5px] transition hover:bg-brand-soft ${
                      drug === id ? "text-brand-deep" : "text-ink-2"
                    }`}
                  >
                    <span className="truncate">{d.name}</span>
                    <span className="num shrink-0 text-[11px] text-ink-3">{d.n} {tr("atlas.imgUnit")}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {selected && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand bg-brand-soft px-3 py-1 text-[12.5px] text-brand-deep">
            {selected[1].name} · {selected[1].n} {tr("atlas.imgUnit")}
            <Link to={`/drug/${selected[0]}`} className="underline decoration-dashed underline-offset-2">
              {tr("atlas.drugProfile")}
            </Link>
          </span>
        )}
        <span className="text-[11.5px] text-ink-3">
          {data ? tr("atlas.drugCountLine", { n: fmt(drugs.length) }) : "…"}
        </span>
      </div>

      {err && <div className="mt-5"><ErrorState message={err} onRetry={reload} /></div>}

      {loading && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-3">
              <div className="shimmer aspect-[4/3] rounded-[10px] bg-[#f2f5fa]" />
              <div className="shimmer mt-3 h-3 w-2/3 rounded bg-[#e9eef6]" />
              <div className="shimmer mt-2 h-3 w-1/2 rounded bg-[#f0f3f9]" />
            </div>
          ))}
        </div>
      )}

      {!loading && !err && list.length === 0 && (
        <div className="card mt-5">
          <EmptyState title={tr("atlas.emptyTitle")} hint={tr("atlas.emptyHint")}>
            <button
              type="button"
              onClick={() => setFilter({ drug: 0, attrib: "all" })}
              className="rounded-lg border border-brand bg-brand-soft px-3.5 py-2 text-[12.5px] font-medium text-brand-deep transition hover:bg-brand/15"
            >
              {tr("atlas.clear")}
            </button>
            <Link
              to="/"
              className="rounded-lg border border-line bg-white px-3.5 py-2 text-[12.5px] font-medium text-ink-2 transition hover:-translate-y-px hover:border-[#b9d0e9]"
            >
              {tr("atlas.toOverview")}
            </Link>
          </EmptyState>
        </div>
      )}

      {!loading && !err && list.length > 0 && (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((f) => (
              <figure key={f.file} className="card card-hover group m-0 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setZoom(f)}
                  className="relative block aspect-[4/3] w-full cursor-zoom-in overflow-hidden bg-[#0b1220]"
                  title={tr("drug.clickZoom")}
                >
                  <img
                    src={`${BASE}figs/${f.file}`}
                    alt={`${f.drug_name} · ${f.label}`}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-contain transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                  />
                </button>
                <figcaption className="p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-medium ${ATTRIB[f.attrib].cls}`}>
                      {tr(ATTRIB[f.attrib].key)}
                    </span>
                    <Link
                      to={`/drug/${f.drug_id}`}
                      className="text-[12.5px] font-semibold text-ink hover:text-brand-deep"
                    >
                      {f.drug_name}
                    </Link>
                    <span className="text-[11.5px] text-ink-3">{f.label}</span>
                  </div>
                  <p
                    className="mt-1.5 text-[11.5px] leading-relaxed text-ink-3"
                    style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                    title={f.caption}
                  >
                    {f.caption}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-3">
                    {(() => {
                      const L = refLink(f.pmid);
                      return L.href ? (
                        <a
                          href={L.href}
                          target="_blank"
                          rel="noreferrer"
                          className="num text-brand underline decoration-dashed underline-offset-2"
                        >
                          {L.text}
                        </a>
                      ) : (
                        <span className="num">{L.text}</span>
                      );
                    })()}
                    {f.pmcid && (
                      <a
                        href={`https://pmc.ncbi.nlm.nih.gov/articles/${f.pmcid}/`}
                        target="_blank"
                        rel="noreferrer"
                        className="num text-brand underline decoration-dashed underline-offset-2"
                      >
                        {f.pmcid}
                      </a>
                    )}
                    <span>· {f.license}</span>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11.5px] leading-relaxed text-ink-3">
              {tr("atlas.shown", { a: fmt(list.length), b: fmt(shown.length) })} · {tr("atlas.copyright")}
            </p>
            {shown.length < list.length && (
              <button
                type="button"
                onClick={() => setLimit((v) => v + PAGE)}
                className="shrink-0 rounded-lg border border-brand bg-brand-soft px-4 py-2 text-[12.5px] font-medium text-brand-deep transition hover:bg-brand/15"
              >
                {tr("atlas.loadMore", { n: fmt(list.length - shown.length) })}
              </button>
            )}
          </div>
        </>
      )}

      {zoom && (
        <ImageViewer
          src={`${BASE}figs/${zoom.file}`}
          alt={`${zoom.drug_name} · ${zoom.label}`}
          onClose={() => setZoom(null)}
          footer={
            <span className="text-[12.5px] leading-relaxed">
              {zoom.caption && (
                <>
                  <span className="text-white/60">{tr("atlas.captionLabel")}</span>
                  {zoom.caption}
                  {zoom.caption.length >= 400 && (
                    <span className="ml-1.5 text-amber-200">{tr("atlas.truncated")}</span>
                  )}
                  {" · "}
                </>
              )}
              PMID {zoom.pmid}
              {zoom.pmcid && (
                <>
                  {" · "}
                  <a
                    className="underline decoration-dashed underline-offset-2 hover:text-white"
                    href={`https://pmc.ncbi.nlm.nih.gov/articles/${zoom.pmcid}/`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {tr("atlas.pmc")}
                  </a>
                </>
              )}
              {" · "}
              {zoom.license}
            </span>
          }
        />
      )}
    </div>
  );
}
