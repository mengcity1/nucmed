import { useMemo, useState } from "react";
import { useJSON, fmt } from "../lib/data";

export type Col<T> = {
  label: string;
  render: (row: T) => React.ReactNode;
  className?: string;
};

/** 通用数据页：加载 JSON → 页内搜索 → 分页表格。5 个数据页共用。 */
export function DataPage<T>({
  title,
  sub,
  file,
  cols,
  search,
  chart,
  pageSize = 30,
}: {
  title: string;
  sub?: string;
  file: string;
  cols: Col<T>[];
  search: (row: T, q: string) => boolean;
  chart?: (rows: T[]) => React.ReactNode;
  pageSize?: number;
}) {
  const { data, error } = useJSON<T[]>(file);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const view = useMemo(() => {
    const rows = data ?? [];
    const k = q.trim().toLowerCase();
    return k ? rows.filter((r) => search(r, k)) : rows;
    // search 为纯函数，不纳入依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, q]);

  const pages = Math.max(1, Math.ceil(view.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const rows = view.slice(cur * pageSize, cur * pageSize + pageSize);

  return (
    <div className="pb-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-[26px] font-bold tracking-tight">{title}</h1>
        {sub && <p className="text-[13px] text-ink-3">{sub}</p>}
      </div>

      {error && (
        <div className="mt-4 rounded-md2 border border-[#f6c9c9] bg-[#fdf2f2] p-4 text-[13px] text-bad">
          {error}
        </div>
      )}

      <div className="card mt-5 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[#9aa8bd]">
              🔍
            </span>
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="在结果中搜索…"
              className="h-9 w-[260px] rounded-[10px] border border-line bg-white pl-8 pr-3 text-[13px] outline-none transition focus:border-[#9dc0ea] focus:ring-[3px] focus:ring-brand/10"
            />
          </div>
          <span className="ml-auto text-[12.5px] text-ink-3">
            共 <b className="num text-ink-2">{fmt(view.length)}</b> 条
          </span>
        </div>

        {chart && view.length > 0 && (
          <div className="border-b border-line px-5 py-4">{chart(view)}</div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line bg-[#fafbfe] text-[11.5px] uppercase tracking-wide text-ink-3">
                {cols.map((c) => (
                  <th key={c.label} className={`px-4 py-2.5 text-left font-semibold ${c.className ?? ""}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={cur * pageSize + i}
                  className="border-b border-[#f1f4f9] transition hover:bg-[#f9fbfe]"
                >
                  {cols.map((c) => (
                    <td key={c.label} className="px-4 py-2.5 text-ink-2">
                      {c.render(r)}
                    </td>
                  ))}
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={cols.length} className="px-4 py-10 text-center text-[13px] text-ink-3">
                    {data ? "没有匹配的记录" : "加载中…"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3 text-[12.5px] text-ink-3">
          <div>
            第 {cur + 1} / {pages} 页
          </div>
          <div className="flex gap-2">
            <button
              disabled={cur === 0}
              onClick={() => setPage(cur - 1)}
              className="rounded-lg border border-line bg-white px-3 py-1 transition hover:border-[#c3d6ea] disabled:opacity-40"
            >
              上一页
            </button>
            <button
              disabled={cur >= pages - 1}
              onClick={() => setPage(cur + 1)}
              className="rounded-lg border border-line bg-white px-3 py-1 transition hover:border-[#c3d6ea] disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
