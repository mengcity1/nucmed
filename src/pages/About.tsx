import { useJSON, fmt, type Meta, type Stats } from "../lib/data";
import { useT } from "../lib/i18n";
import { Chart, PALETTE, AXIS } from "../components/Chart";

const LIC = "CC BY-NC 4.0";
// ★ 2026-10-28：原为 github.com/<TODO-OWNER> 占位（会显示成一个不存在的地址）。
//   主库实际在 Gitee；GitHub 只作部署镜像，Pages 上线后再补。
const REPO = "https://gitee.com/mengcity1/nucmed";

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-[#f1f4f9] py-2.5 last:border-0 sm:grid-cols-[150px_1fr] sm:gap-3">
      <div className="text-[12.5px] text-ink-3">{k}</div>
      <div className="break-words text-[13px] text-ink">{v}</div>
    </div>
  );
}

/** ★ 2026-11-04：本页文案全部走 i18n（原来 0 条键、整页中文硬编码 ⇒ 英文站只能被 EnGate 挡住）。
 *  数字仍然来自 meta.json / stats.json，没有一处是手写的。 */
export default function About() {
  const { data: m } = useJSON<Meta>("meta.json");
  const { data: st } = useJSON<Stats>("stats.json");
  const tr = useT();
  const base = import.meta.env.BASE_URL;
  /** "(null)" / 空串统一显示为「未标注」（stats.json 里确有这两类键） */
  const lbl = (k: string) => (k === "(null)" || k === "" ? tr("about.na") : k);
  const top = (d: { k: string; n: number }[], n: number) => d.slice(0, n);
  const sum = (d: { k: string; n: number }[]) => d.reduce((a, b) => a + b.n, 0);

  return (
    <div className="pb-4">
      {/* v18：内容卡组交给真折射玻璃（**1 个舞台 / 5 个面片**）。
          为什么不每卡一舞台：每个舞台 = 1 个 WebGL 上下文 + 1 块"舞台尺寸"的 canvas，
          上下文有上限（~8–16）、canvas 显存按面积算 ⇒ 唯一可扩展的单位是"区"，不是卡片。 */}
      <section data-glass="panel" className="card lg-surface mt-5 p-6">
        <h2 className="text-[16px] font-semibold">{tr("about.verTitle")}</h2>
        <div className="mt-3">
          {m ? (
            <>
              <Row k={tr("about.kVersion")} v={<span className="font-mono">{m.version}</span>} />
              <Row
                k={tr("about.kSha")}
                v={
                  <span className="font-mono">
                    {m.db_sha16}
                    <span className="text-ink-3">{tr("about.shaSuffix")}</span>
                  </span>
                }
              />
              <Row
                k={tr("about.kBytes")}
                v={
                  <span className="font-mono">
                    {(m.db_bytes / 1048576).toFixed(1)} MB
                    <span className="text-ink-3"> ({fmt(m.db_bytes)} B)</span>
                  </span>
                }
              />
              <Row k={tr("about.kExported")} v={<span className="font-mono">{m.generated_at}</span>} />
              <Row
                k={tr("about.kScale")}
                v={tr("about.scaleLine", {
                  a: fmt(m.counts.biodist),
                  b: fmt(m.counts.drugs),
                  c: fmt(m.counts.tables),
                  d: fmt(m.counts.refs),
                })}
              />
              {st?.raw_total_unfiltered ? (
                <Row
                  k={tr("about.kContext")}
                  v={tr("about.contextLine", {
                    a: fmt(st.total),
                    b: fmt(st.raw_total_unfiltered),
                    c: fmt(st.raw_total_unfiltered - st.total),
                  })}
                />
              ) : null}
              <Row k={tr("about.kLicense")} v={<b>{LIC}</b>} />
            </>
          ) : (
            <div className="py-6 text-[13px] text-ink-3">{tr("about.loading")}</div>
          )}
        </div>
      </section>

      <section data-glass="panel" className="card lg-surface mt-5 p-6">
        <h2 className="text-[16px] font-semibold">{tr("about.availTitle")}</h2>
        <p className="mt-1 text-[12.5px] text-balance text-ink-3">{tr("about.availLead")}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {m &&
            Object.entries(m.files)
              .filter(([n]) => n.endsWith(".json"))
              .sort((a, b) => b[1] - a[1])
              .map(([n, size]) => (
                <a
                  key={n}
                  href={`${base}data/${n}`}
                  download
                  className="flex items-center justify-between rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-[13px] transition hover:-translate-y-px hover:border-[#b9d0e9] hover:shadow-s2"
                >
                  <span className="font-mono text-ink">{n}</span>
                  <span className="num text-[12px] text-ink-3">{(size / 1024).toFixed(0)} KB ↓</span>
                </a>
              ))}
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-ink-3">
          {tr("about.availFullDb", { mb: m ? (m.db_bytes / 1048576).toFixed(1) : "…" })}
        </p>
      </section>

      {/* 2026-11-05：数据分布五图 —— 此前 stats.json 的 by_organ / by_isotope /
          by_species / by_grade / by_source **没有任何页面渲染**（只在 data.ts 类型里出现）。
          全部零新数据：直接读 stats.json，随导出层一致刷新；每图副标题给分母。 */}
      {st ? (
        <section data-glass="panel" className="card lg-surface mt-5 p-6">
          <h2 className="text-[16px] font-semibold">{tr("about.distTitle")}</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">{tr("about.distLead")}</p>
          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <figure>
              <figcaption className="label-caps">{tr("about.organ")}</figcaption>
              <div className="mt-0.5 text-[11.5px] text-ink-3">
                {tr("about.organHint", { n: fmt(st.total) })}
              </div>
              <Chart
                height={300}
                option={{
                  grid: { left: 4, right: 22, top: 6, bottom: 4, containLabel: true },
                  tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
                  xAxis: { type: "value", ...AXIS },
                  yAxis: {
                    type: "category",
                    data: top(st.by_organ, 12).map((d) => lbl(d.k)).reverse(),
                    ...AXIS,
                  },
                  series: [
                    {
                      type: "bar",
                      data: top(st.by_organ, 12).map((d) => d.n).reverse(),
                      itemStyle: { color: PALETTE[0], borderRadius: [0, 4, 4, 0] },
                      barMaxWidth: 13,
                    },
                  ],
                }}
              />
            </figure>

            <figure>
              <figcaption className="label-caps">{tr("about.isotope")}</figcaption>
              <div className="mt-0.5 text-[11.5px] text-ink-3">
                {tr("about.isotopeHint", { n: fmt(st.total), m: st.by_isotope.length })}
              </div>
              <Chart
                height={300}
                option={{
                  grid: { left: 4, right: 8, top: 10, bottom: 4, containLabel: true },
                  tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
                  xAxis: {
                    type: "category",
                    data: top(st.by_isotope, 12).map((d) => lbl(d.k)),
                    ...AXIS,
                    axisLabel: { ...AXIS.axisLabel, rotate: 38, interval: 0, fontSize: 10.5 },
                  },
                  yAxis: { type: "value", ...AXIS },
                  series: [
                    {
                      type: "bar",
                      data: top(st.by_isotope, 12).map((d) => d.n),
                      itemStyle: { color: PALETTE[2], borderRadius: [4, 4, 0, 0] },
                      barMaxWidth: 18,
                    },
                  ],
                }}
              />
            </figure>

            <figure>
              <figcaption className="label-caps">{tr("about.species")}</figcaption>
              <div className="mt-0.5 text-[11.5px] text-ink-3">
                {tr("about.speciesHint", { n: fmt(st.total) })}
              </div>
              <Chart
                height={220}
                option={{
                  grid: { left: 4, right: 22, top: 6, bottom: 4, containLabel: true },
                  tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
                  xAxis: { type: "value", ...AXIS },
                  yAxis: {
                    type: "category",
                    data: st.by_species.map((d) => lbl(d.k)).reverse(),
                    ...AXIS,
                  },
                  series: [
                    {
                      type: "bar",
                      data: st.by_species.map((d) => d.n).reverse(),
                      itemStyle: {
                        color: (p: { dataIndex: number }) =>
                          PALETTE[(p.dataIndex + 2) % PALETTE.length],
                        borderRadius: [0, 4, 4, 0],
                      },
                      barMaxWidth: 13,
                    },
                  ],
                }}
              />
            </figure>

            <figure>
              <figcaption className="label-caps">{tr("about.grade")}</figcaption>
              <div className="mt-0.5 text-[11.5px] text-ink-3">
                {tr("about.gradeHint", { n: fmt(sum(st.by_grade)) })}
              </div>
              <Chart
                height={220}
                option={{
                  grid: { left: 4, right: 22, top: 6, bottom: 4, containLabel: true },
                  tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
                  xAxis: { type: "value", ...AXIS },
                  yAxis: {
                    type: "category",
                    data: st.by_grade.map((d) => d.k).reverse(),
                    ...AXIS,
                  },
                  series: [
                    {
                      type: "bar",
                      data: st.by_grade.map((d) => d.n).reverse(),
                      itemStyle: {
                        color: (p: { dataIndex: number }) =>
                          ["#c9d3e0", PALETTE[4], PALETTE[0]][p.dataIndex] ?? PALETTE[0],
                        borderRadius: [0, 4, 4, 0],
                      },
                      barMaxWidth: 20,
                    },
                  ],
                }}
              />
            </figure>

            <figure className="lg:col-span-2">
              <figcaption className="label-caps">{tr("about.source")}</figcaption>
              <div className="mt-0.5 text-[11.5px] text-ink-3">
                {tr("about.gradeHint", { n: fmt(sum(st.by_source)) })}
              </div>
              <Chart
                height={200}
                option={{
                  grid: { left: 4, right: 22, top: 6, bottom: 4, containLabel: true },
                  tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
                  xAxis: { type: "value", ...AXIS },
                  yAxis: {
                    type: "category",
                    data: st.by_source.map((d) => d.k).reverse(),
                    ...AXIS,
                  },
                  series: [
                    {
                      type: "bar",
                      data: st.by_source.map((d) => d.n).reverse(),
                      itemStyle: {
                        color: (p: { dataIndex: number }) =>
                          PALETTE[(p.dataIndex + 5) % PALETTE.length],
                        borderRadius: [0, 4, 4, 0],
                      },
                      barMaxWidth: 18,
                    },
                  ],
                }}
              />
            </figure>
          </div>
        </section>
      ) : null}

      {/* 第二组：引用 / 数据字典 / 联系（3 个面片）—— 拆两个舞台是为了把单块 canvas 面积压下去
          （显存按面积算；一块覆盖整页的 stage 在长页面上既不划算也更容易触发帧缓冲失败） */}
      <section data-glass="panel" className="card lg-surface mt-5 p-6">
        <h2 className="text-[16px] font-semibold">{tr("about.citeTitle")}</h2>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-[#fafbfe] p-4 text-[12px] leading-relaxed text-ink-2">
{`@article{nucmeddb2026,
  title   = {NucMed DB: a traceable radiopharmaceutical
             biodistribution resource with a reproducible benchmark},
  author  = {NucMed DB contributors},
  journal = {Briefings in Bioinformatics},
  year    = {2026},
  note    = {Data version ${m?.version ?? "data-v2026-10-27"}, db sha256 ${m?.db_sha16 ?? "…"}}
}`}
        </pre>
        <p className="mt-2 text-[12px] text-ink-3">{tr("about.citeNote")}</p>
      </section>

      <section data-glass="panel" className="card lg-surface mt-5 p-6">
        <h2 className="text-[16px] font-semibold">{tr("about.srcTitle")}</h2>
        <ul className="prose-serif mt-3 grid gap-2">
          <li>
            · <b className="text-ink">{tr("about.srcIngest")}</b>：{tr("about.srcIngestBody")}
          </li>
          <li>
            · <b className="text-ink">{tr("about.srcStruct")}</b>：{tr("about.srcStructBody")}
          </li>
          <li>
            · <b className="text-ink">{tr("about.srcDose")}</b>：{tr("about.srcDoseBody")}
          </li>
          <li>
            · <b className="text-ink">{tr("about.srcTrace")}</b>：{tr("about.srcTraceBody")}
          </li>
          <li>
            · <b className="text-ink">{tr("about.srcMissing")}</b>：{tr("about.srcMissingBody")}
          </li>
        </ul>
      </section>

      <section data-glass="panel" className="card lg-surface mt-5 p-6">
        <h2 className="text-[16px] font-semibold">{tr("about.contactTitle")}</h2>
        <div className="mt-3">
          <Row k={tr("about.kOrg")} v={tr("about.org")} />
          <Row
            k={tr("about.kIssues")}
            v={<span className="font-mono text-ink-3">{tr("about.issuesAt", { repo: REPO })}</span>}
          />
          <Row k={tr("about.kStack")} v={tr("about.stack")} />
        </div>
      </section>
    </div>
  );
}
