import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { EmptyState, ErrorState } from "../components/States";
import { fmt, loadFigManifest, refLink, type Fig } from "../lib/data";

const BASE = import.meta.env.BASE_URL;

const ATTRIB: Record<Fig["attrib"], { t: string; cls: string; why: string }> = {
  target: { t: "图注点名本药", cls: "bg-[#dcfce7] text-[#166534]", why: "图注文本里出现了该药的名称/别名" },
  unclear: { t: "图注未点名", cls: "bg-[#fef3c7] text-[#92400e]", why: "图注没有指明具体药物，需回原文核对" },
  comparator: { t: "图注是别的药", cls: "bg-[#fee2e2] text-[#991b1b]", why: "图注里出现的是另一种示踪剂" },
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
      <h1 className="text-[26px] font-bold tracking-tight">🖼 文献影像图集</h1>
      <p className="mt-1.5 max-w-[860px] text-[13px] leading-relaxed text-ink-3">
        PET / PET-CT 小动物全身显像图，<b className="text-ink-2">全部引自原文 Figure</b>
        （非本库生成，非重绘）。每张图保留原文图注、PMID / PMCID 与许可，可一键回原文核对。
      </p>

      <div className="mt-4 rounded-[10px] border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-[12.5px] leading-relaxed text-[#92400e]">
        <b>怎么读这个标签：</b>
        本库只做「陈列 + 标注」，不做任何推断。图注里出现该药名称/别名的标
        <span className="mx-1 rounded bg-[#dcfce7] px-1.5 py-0.5 text-[#166534]">图注点名本药</span>；
        出现的是另一种示踪剂的标
        <span className="mx-1 rounded bg-[#fee2e2] px-1.5 py-0.5 text-[#991b1b]">图注是别的药</span>
        ——这类图**不代表本药**，只是同一篇文献里的对照面板，保留是为了可追溯。
      </div>

      {/* 归属筛选（带计数 · 语义上先于药名） */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-ink-3">归属：</span>
        {(["all", "target", "unclear", "comparator"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter({ attrib: k })}
            title={k === "all" ? "不过滤归属（全部张数）" : ATTRIB[k].why}
            className={`rounded-full border px-3 py-1 text-[12.5px] transition ${
              attrib === k ? "border-brand bg-brand-soft text-brand-deep" : "border-line bg-white text-ink-2 hover:border-[#b9d0e9]"
            }`}
          >
            {k === "all" ? "全部" : ATTRIB[k].t}
            <span className="num ml-1 text-[11px] opacity-70">{data ? fmt(counts[k]) : "…"}</span>
          </button>
        ))}
      </div>

      {/* 药名：不再逐个铺 chip（510 个药），改成输入即建议；选中即写 URL ?drug=，并可跳单药画像 */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-ink-3">药物：</span>
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
            placeholder="输入药名检索…"
            aria-label="按药名检索影像图"
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
              aria-label="清除药名筛选"
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
                    <span className="num shrink-0 text-[11px] text-ink-3">{d.n} 张</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {selected && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand bg-brand-soft px-3 py-1 text-[12.5px] text-brand-deep">
            {selected[1].name} · {selected[1].n} 张
            <Link to={`/drug/${selected[0]}`} className="underline decoration-dashed underline-offset-2">
              单药画像 ↗
            </Link>
          </span>
        )}
        <span className="text-[11.5px] text-ink-3">{data ? `共 ${fmt(drugs.length)} 个药有影像` : "…"}</span>
      </div>

      {err && <div className="mt-5"><ErrorState message={err} onRetry={reload} /></div>}

      {loading && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card animate-pulse p-3">
              <div className="h-[150px] rounded-[10px] bg-[#f2f5fa]" />
              <div className="mt-3 h-3 w-2/3 rounded bg-[#e9eef6]" />
              <div className="mt-2 h-3 w-1/2 rounded bg-[#f0f3f9]" />
            </div>
          ))}
        </div>
      )}

      {!loading && !err && list.length === 0 && (
        <div className="card mt-5">
          <EmptyState
            title="这个筛选下暂无影像图"
            hint="本图集只收「原文图注明确是 PET / MIP / 全身显像」的 Figure。换一个药物、或点「全部归属」看看；也可回总览检索其他核药。"
          >
            <button
              type="button"
              onClick={() => setFilter({ drug: 0, attrib: "all" })}
              className="rounded-lg border border-brand bg-brand-soft px-3.5 py-2 text-[12.5px] font-medium text-brand-deep transition hover:bg-brand/15"
            >
              清除筛选
            </button>
            <Link
              to="/"
              className="rounded-lg border border-line bg-white px-3.5 py-2 text-[12.5px] font-medium text-ink-2 transition hover:-translate-y-px hover:border-[#b9d0e9]"
            >
              回总览 →
            </Link>
          </EmptyState>
        </div>
      )}

      {!loading && !err && list.length > 0 && (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((f) => (
              <figure key={f.file} className="card m-0 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setZoom(f)}
                  className="block w-full cursor-zoom-in bg-[#0b1220]"
                  title="点击放大"
                >
                  <img
                    src={`${BASE}figs/${f.file}`}
                    alt={`${f.drug_name} · ${f.label}`}
                    loading="lazy"
                    decoding="async"
                    className="h-[190px] w-full object-contain"
                  />
                </button>
                <figcaption className="p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-medium ${ATTRIB[f.attrib].cls}`}>
                      {ATTRIB[f.attrib].t}
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
              当前筛选 <b className="num text-ink-2">{fmt(list.length)}</b> 张 · 已显示{" "}
              <b className="num text-ink-2">{fmt(shown.length)}</b> 张 · 图像版权归原作者，
              按原文许可（多数为 CC BY 4.0）转载并保留出处；本库仅作陈列，未做任何像素改动。
            </p>
            {shown.length < list.length && (
              <button
                type="button"
                onClick={() => setLimit((v) => v + PAGE)}
                className="shrink-0 rounded-lg border border-brand bg-brand-soft px-4 py-2 text-[12.5px] font-medium text-brand-deep transition hover:bg-brand/15"
              >
                加载更多（剩 {fmt(list.length - shown.length)} 张）
              </button>
            )}
          </div>
        </>
      )}

      {zoom && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${zoom.drug_name} · ${zoom.label} 大图`}
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[92vh] max-w-[96vw] overflow-auto rounded-xl bg-white p-3"
          >
            <button
              type="button"
              onClick={() => setZoom(null)}
              aria-label="关闭大图（Esc）"
              className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full border border-line bg-white/95 text-[14px] text-ink-2 shadow-s2 transition hover:text-ink"
            >
              ✕
            </button>
            <img
              src={`${BASE}figs/${zoom.file}`}
              alt={zoom.label}
              decoding="async"
              className="max-h-[78vh] max-w-full"
            />
            <div className="mt-2 max-w-[900px] text-[12px] leading-relaxed text-ink-2">
              <b>{zoom.drug_name}</b> · {zoom.label} · PMID {zoom.pmid} · {zoom.pmcid} · {zoom.license}
              <div className="mt-1 text-ink-3">{zoom.caption}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
