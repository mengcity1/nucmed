/** 页头 Hero（2026-11-04 视觉升级）：统一各页的开头节奏 —— 眉标 + 大标题 + 渐变横条 + 右侧指标槽。
 *  ★ 为什么不用 gradient text：标题含 emoji（💊 / 🖼 / ℹ），`background-clip:text` 在部分浏览器
 *    会把 emoji 一起 clip 成透明；这里改用「实色标题 + 渐变小横条」，稳且不花。
 *  ★ 装饰光斑 pointer-events-none + aria-hidden：不挡点击、不进无障碍树。 */
export default function PageHero({
  eyebrow,
  title,
  lead,
  right,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  right?: React.ReactNode;
}) {
  return (
    <section className="motion-safe:animate-fadeUp relative overflow-hidden rounded-lg2 border border-[#dce8f9] bg-white/75 px-5 py-5 shadow-s1 backdrop-blur-[2px] sm:px-7 sm:py-6">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full"
        style={{ background: "radial-gradient(circle at center, #d8e9fc 0%, rgba(216,233,252,0) 70%)" }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-12 h-48 w-48 rounded-full"
        style={{ background: "radial-gradient(circle at center, #e3f5f1 0%, rgba(227,245,241,0) 70%)" }}
      />
      <div className="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
          <h1 className="hero-title mt-2">{title}</h1>
          <span className="hero-rule block" />
          {lead ? <p className="mt-3 max-w-[840px] text-[13px] leading-relaxed text-ink-2">{lead}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </section>
  );
}