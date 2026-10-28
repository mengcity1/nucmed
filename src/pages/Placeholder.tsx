export default function Placeholder({ title }: { title: string }) {
  return (
    <section className="card p-10 text-center">
      <h2 className="text-[17px] font-semibold">{title}</h2>
      <p className="mt-2 text-[13px] text-ink-3">
        建设中（P1 / P2 阶段实现）· 数据已就绪：<code className="font-mono">web/public/data/*.json</code>
      </p>
    </section>
  );
}
