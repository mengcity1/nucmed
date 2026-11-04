/** 页头 Hero（2026-11-04 视觉升级）：统一各页的开头节奏 —— 眉标 + 大标题 + 渐变横条 + 右侧指标槽。
 *  ★ 为什么不用 gradient text：标题含 emoji（💊 / 🖼 / ℹ），`background-clip:text` 在部分浏览器
 *    会把 emoji 一起 clip 成透明；这里改用「实色标题 + 渐变小横条」，稳且不花。
 *  ★ 装饰光斑 pointer-events-none + aria-hidden：不挡点击、不进无障碍树。 */
export default function PageHero({
  title,
  lead,
  right,
}: {
  title: string;
  lead?: string;
  right?: React.ReactNode;
}) {
  return (
    <section className="motion-safe:animate-fadeUp relative overflow-hidden rounded-lg2 shadow-glow">
      {/* 深色渐变主块（2026-11-04 v2）：解决「太清淡」——首屏给一块有重量的色块 */}
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(115deg,#0a2648_0%,#153f76_52%,#0b6159_100%)]" />
      {/* 细网格 + 两团光斑（在深底上，白线透明度 .16，不刺眼） */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[.16]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.55) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.55) 1px,transparent 1px)",
          backgroundSize: "30px 30px",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-28 h-72 w-72 rounded-full"
        style={{ background: "radial-gradient(circle at center, rgba(110,190,255,.42) 0%, rgba(110,190,255,0) 70%)" }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-32 left-1/4 h-64 w-64 rounded-full"
        style={{ background: "radial-gradient(circle at center, rgba(78,205,196,.34) 0%, rgba(78,205,196,0) 70%)" }}
      />
      <div className="relative flex flex-wrap items-end justify-between gap-x-8 gap-y-4 px-6 py-7 sm:px-9 sm:py-9">
        <div className="min-w-0">
          <h1 className="hero-title">{title}</h1>
          <span className="hero-rule block" />
          {lead ? <p className="mt-3 max-w-[720px] text-[13px] leading-relaxed text-white/70">{lead}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </section>
  );
}