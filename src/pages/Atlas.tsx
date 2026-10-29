import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState } from "../components/States";
import { refLink } from "../lib/data";

/** 文献影像图（public/figs/manifest.json，非 public/data ⇒ 不被导出器覆盖） */
type Fig = {
  drug_id: number;
  drug_name: string;
  pmid: string;
  pmcid: string;
  label: string;
  caption: string;
  license: string;
  attrib: "target" | "unclear" | "comparator";
  file: string;
};

const BASE = import.meta.env.BASE_URL;

const ATTRIB: Record<Fig["attrib"], { t: string; cls: string; why: string }> = {
  target: { t: "图注点名本药", cls: "bg-[#dcfce7] text-[#166534]", why: "图注文本里出现了该药的名称/别名" },
  unclear: { t: "图注未点名", cls: "bg-[#fef3c7] text-[#92400e]", why: "图注没有指明具体药物，需回原文核对" },
  comparator: { t: "图注是别的药", cls: "bg-[#fee2e2] text-[#991b1b]", why: "图注里出现的是另一种示踪剂" },
};

function useFigs() {
  const [data, setData] = useState<Fig[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    setErr(null);
    fetch(`${BASE}figs/manifest.json`, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`manifest.json 加载失败：HTTP ${r.status}`))))
      .then((v: Fig[]) => alive && setData(v))
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [n]);
  return { data, err, loading: !data && !err, reload: () => setN((x) => x + 1) };
}

export default function Atlas() {
  const { data, err, loading, reload } = useFigs();
  const [drug, setDrug] = useState<number | 0>(0);
  const [attrib, setAttrib] = useState<Fig["attrib"] | "all">("all");
  const [zoom, setZoom] = useState<Fig | null>(null);

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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setDrug(0)}
          className={`rounded-full border px-3 py-1 text-[12.5px] transition ${
            drug === 0 ? "border-brand bg-brand-soft text-brand-deep" : "border-line bg-white text-ink-2 hover:border-[#b9d0e9]"
          }`}
        >
          全部药物 {data ? data.length : "…"}
        </button>
        {drugs.map(([id, d]) => (
          <button
            key={id}
            type="button"
            onClick={() => setDrug(id)}
            className={`rounded-full border px-3 py-1 text-[12.5px] transition ${
              drug === id ? "border-brand bg-brand-soft text-brand-deep" : "border-line bg-white text-ink-2 hover:border-[#b9d0e9]"
            }`}
          >
            {d.name} · {d.n}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-line" />
        {(["all", "target", "unclear", "comparator"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setAttrib(k)}
            className={`rounded-full border px-3 py-1 text-[12.5px] transition ${
              attrib === k ? "border-brand bg-brand-soft text-brand-deep" : "border-line bg-white text-ink-2 hover:border-[#b9d0e9]"
            }`}
          >
            {k === "all" ? "全部归属" : ATTRIB[k].t}
          </button>
        ))}
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
              onClick={() => {
                setDrug(0);
                setAttrib("all");
              }}
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
            {list.map((f) => (
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

          <p className="mt-4 text-[11.5px] leading-relaxed text-ink-3">
            共 <b className="num text-ink-2">{list.length}</b> 张 · 图像版权归原作者，
            按原文许可（多数为 CC BY 4.0）转载并保留出处；本库仅作陈列，未做任何像素改动。
          </p>
        </>
      )}

      {zoom && (
        <div
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div className="max-h-[92vh] max-w-[96vw] overflow-auto rounded-xl bg-white p-3">
            <img src={`${BASE}figs/${zoom.file}`} alt={zoom.label} className="max-h-[78vh] max-w-full" />
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
