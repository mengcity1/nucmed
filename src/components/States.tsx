/**
 * 三种状态（加载 / 空 / 错）的统一呈现。
 * 原则：空状态必须说清「为什么空 + 下一步能做什么」，错误状态必须可重试。
 */

/** 骨架屏：表格形态，行数 / 列数可调。 */
export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="animate-pulse p-1" aria-busy="true" aria-label="加载中">
      <div className="flex gap-3 border-b border-[#f1f4f9] px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <div
            key={i}
            className="h-3 rounded bg-[#e9eef6]"
            style={{ width: i === 0 ? "22%" : `${Math.max(10, 60 / cols)}%` }}
          />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3 border-b border-[#f6f8fc] px-4 py-3">
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className="h-3 rounded bg-[#f0f3f9]"
              style={{ width: c === 0 ? "22%" : `${Math.max(10, 60 / cols)}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** 卡片骨架：图表 / KPI 区用。 */
export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`card animate-pulse p-6 ${className}`} aria-busy="true">
      <div className="h-3.5 w-32 rounded bg-[#e9eef6]" />
      <div className="mt-4 h-[180px] rounded-[10px] bg-[#f2f5fa]" />
    </div>
  );
}

export function EmptyState({
  title = "没有匹配的记录",
  hint,
  children,
}: {
  title?: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-full border border-line bg-[#f7f9fd] text-[18px] text-ink-3">
        ∅
      </div>
      <div className="mt-3 text-[14px] font-semibold text-ink">{title}</div>
      {hint && <div className="mt-1.5 max-w-[460px] text-[12.5px] leading-relaxed text-ink-3">{hint}</div>}
      {children && <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-md2 border border-[#f6c9c9] bg-[#fdf2f2] p-5 text-[13px] text-bad">
      <div className="font-semibold">数据加载失败</div>
      <div className="mt-1.5 break-all text-[12.5px] leading-relaxed text-[#a23b3b]">{message}</div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg border border-[#eeb9b9] bg-white px-3 py-1.5 text-[12.5px] font-medium text-bad transition hover:bg-[#fff7f7]"
        >
          重试
        </button>
      )}
    </div>
  );
}
