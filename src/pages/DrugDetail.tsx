import { Fragment, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useJSON, fmt, type Drug, type Point } from "../lib/data";
import { Chart, PALETTE, AXIS } from "../components/Chart";

type Ref = { pmid: string; title: string | null; journal: string | null; year: number | null };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11.5px] font-medium text-ink-3">{label}</div>
      <div className="mt-0.5 text-[13.5px] text-ink">{children}</div>
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

export default function DrugDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const did = id ? Number(id) : 0;
  const { data: drugs } = useJSON<Drug[]>("drugs.json");
  const { data: pts } = useJSON<Point[]>("biodist.json");
  const { data: refs } = useJSON<Ref[]>("refs.json");
  const { data: raw } = useJSON<Record<string, string>>("raw.json");
  const [pick, setPick] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  // ★ 图片加载失败要「说出来」，不能静默 display:none（否则表现为「有标题、没图」）
  const [imgErr, setImgErr] = useState<Record<string, boolean>>({});

  const drug = useMemo(() => (drugs ?? []).find((d) => d.drug_id === did), [drugs, did]);
  const mine = useMemo(() => (pts ?? []).filter((p) => p.drug_id === did), [pts, did]);
  const pmids = useMemo(
    () => [...new Set(mine.map((p) => p.doc_pmid).filter(Boolean) as string[])],
    [mine]
  );
  const myRefs = useMemo(() => (refs ?? []).filter((r) => pmids.includes(r.pmid)), [refs, pmids]);
  const hits = useMemo(() => {
    const k = pick.trim().toLowerCase();
    return (drugs ?? [])
      .filter((d) => !k || (d.name_en || "").toLowerCase().includes(k) || (d.name_zh || "").includes(k))
      .slice(0, 24);
  }, [drugs, pick]);

  /* 无 id ⇒ 选择器（导航「单药画像」直接进来时） */
  if (!did) {
    return (
      <div className="pb-4">
        <h1 className="text-[26px] font-bold tracking-tight">🔬 单药画像</h1>
        <p className="mt-1.5 text-[13px] text-ink-3">
          搜索并选择一个核药，查看它的结构、生物分布与来源文献
        </p>
        <div className="card mt-5 p-6">
          <input
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            placeholder="输入药名（中英文均可），如 PSMA / DOTATATE…"
            className="h-10 w-full rounded-[10px] border border-line bg-white px-3.5 text-[13.5px] outline-none focus:border-[#9dc0ea] focus:ring-[3px] focus:ring-brand/10"
          />
          <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {hits.map((d) => (
              <Link
                key={d.drug_id}
                to={`/drugs/${d.drug_id}`}
                className="flex items-center justify-between rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-[13px] transition hover:-translate-y-px hover:border-[#b9d0e9] hover:shadow-s2"
              >
                <span className="truncate font-medium text-ink">{d.name_en}</span>
                <span className="ml-2 shrink-0 text-[11.5px] text-ink-3">
                  {d.has_struct ? "✓ 结构" : ""}
                </span>
              </Link>
            ))}
            {!hits.length && (
              <div className="col-span-full py-8 text-center text-[13px] text-ink-3">
                {drugs ? "没有匹配的核药" : "加载中…"}
              </div>
            )}
          </div>
          {drugs && (
            <div className="mt-3 text-[12px] text-ink-3">
              共 {drugs.length.toLocaleString("en-US")} 个核药 · 仅显示前 24 个匹配项
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!drug) {
    return <div className="py-20 text-center text-[13px] text-ink-3">加载中…（或该药不存在）</div>;
  }

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
        <h1 className="text-[26px] font-bold tracking-tight">{drug.name_en}</h1>
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
              <span className="text-[13px] font-medium text-ink">完整结构图（点击放大）</span>
              <span className="text-[11.5px] text-ink-3">
                radiopharm.idrblab.cn · 口径 ligand_only
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

      <section className="mt-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[16px] font-semibold">生物分布记录</h2>
          <span className="text-[12.5px] text-ink-3">
            共 <b className="num text-ink-2">{fmt(mine.length)}</b> 条 · 点任意行查看原文
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
                  <th className="px-4 py-2.5 text-left font-semibold">证据</th>
                  <th className="px-4 py-2.5 text-left font-semibold">PMID / 原文</th>
                </tr>
              </thead>
              <tbody>
                {mine.slice(0, 40).map((p) => (
                  <Fragment key={p.id}>
                    <tr
                      onClick={() => setOpenId(openId === p.id ? null : p.id)}
                      className={`cursor-pointer border-b border-[#f1f4f9] transition hover:bg-[#f9fbfe] ${
                        openId === p.id ? "bg-[#f9fbfe]" : ""
                      }`}
                    >
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
                        {p.doc_pmid ? (
                          <a
                            href={`https://pubmed.ncbi.nlm.nih.gov/${p.doc_pmid}/`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="num text-brand underline decoration-dashed underline-offset-2"
                          >
                            {p.doc_pmid}
                          </a>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>
                    </tr>
                    {openId === p.id && (
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

      <section className="mt-5">
        <h2 className="text-[16px] font-semibold">相关文献</h2>
        <div className="card mt-3 divide-y divide-[#f1f4f9]">
          {myRefs.slice(0, 12).map((r) => (
            <div key={r.pmid} className="px-5 py-3">
              <a
                href={`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`}
                target="_blank"
                rel="noreferrer"
                className="text-[13px] font-medium text-brand hover:underline"
              >
                {r.title || `PMID ${r.pmid}`}
              </a>
              <div className="mt-0.5 text-[12px] text-ink-3">
                <span className="num">{r.pmid}</span> · {r.journal ?? "—"} {r.year ?? ""}
              </div>
            </div>
          ))}
          {!myRefs.length && (
            <div className="px-5 py-8 text-center text-[13px] text-ink-3">暂无关联文献记录</div>
          )}
        </div>
      </section>
    </div>
  );
}

