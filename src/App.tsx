import { NavLink, Navigate, Route, Routes, useNavigate, useSearchParams } from "react-router-dom";
import { Suspense, lazy } from "react";
import { useJSON, type Meta } from "./lib/data";
import { Icon, type IconName } from "./components/Icon";
import Overview from "./pages/Home";
// ★ pk262 B6：单药画像按需加载 —— Chart 依赖 echarts（586 kB / gzip 195 kB），
//   静态引入会让总览首屏也拉这个包。改为路由级 lazy 后 echarts 只在进入画像时才下载。
const DrugDetail = lazy(() => import("./pages/DrugDetail"));
import About from "./pages/About";

/** 全站只保留 3 页（pk261 v2 · 2026-10-28 owner 拍板：8 页 → 3 页） */
const TABS: { to: string; label: string; icon: IconName; end: boolean }[] = [
  { to: "/", label: "核药总览", icon: "grid", end: true },
  { to: "/drug", label: "单药画像", icon: "flask", end: false },
  { to: "/about", label: "关于", icon: "info", end: false },
];

/** 已下线路径（v2 砍掉的 6 页 + 独立剂量学页）⇒ 一律回总览，不留白屏 */
const LEGACY = [
  "/biodist",
  "/tnr",
  "/properties",
  "/props",
  "/candidates",
  "/structures",
  "/quality",
  "/dosimetry",
];

function Nav() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const q = sp.get("q") ?? "";
  const onSearch = (v: string) => {
    const next = new URLSearchParams(sp);
    if (v) next.set("q", v);
    else next.delete("q");
    nav({ pathname: "/", search: next.toString() }, { replace: true });
  };
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="wrap flex h-16 items-center gap-3 sm:gap-7">
        <NavLink to="/" className="flex shrink-0 items-center gap-2.5">
          <span className="grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-gradient-to-br from-brand to-[#2f7ad1] text-[17px] text-white shadow-[0_4px_12px_-4px_rgba(30,91,168,.55)]">
            ⚛
          </span>
          <span className="hidden leading-none sm:block">
            <b className="block text-[15px] font-semibold tracking-wide">核药数据库</b>
            <span className="mt-0.5 block text-[11px] font-medium tracking-[.6px] text-ink-3">
              NUCMED DB
            </span>
          </span>
        </NavLink>

        <div className="relative hidden min-w-0 flex-1 max-w-[360px] md:block">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] text-[#9aa8bd]">
            🔍
          </span>
          <input
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="搜索核药、器官、核素…"
            className="h-[38px] w-full rounded-[10px] border border-line bg-white pl-9 pr-3.5 text-[13.5px] outline-none transition focus:border-[#9dc0ea] focus:ring-[3px] focus:ring-brand/10"
          />
        </div>

        <nav className="ml-auto flex min-w-0 gap-1 overflow-x-auto rounded-[14px] border border-line bg-[#f5f8fc] p-1">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `tab shrink-0 max-sm:px-2.5 max-sm:text-[12.5px] ${isActive ? "tab-on" : ""}`
              }
            >
              <span className="hidden sm:inline-flex">
                <Icon name={t.icon} size={15} className="shrink-0 opacity-90" />
              </span>
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  const { data: meta } = useJSON<Meta>("meta.json");
  return (
    <footer className="wrap mt-12 border-t border-line pb-14 pt-6 text-[12px] text-ink-3">
      <div className="flex flex-wrap justify-between gap-4 pt-1">
        <div>
          {meta ? (
            <>
              版本 <b className="font-semibold text-ink-2">{meta.version}</b> · sha{" "}
              <b className="font-mono font-semibold text-ink-2">{meta.db_sha16}</b> ·{" "}
              {meta.db_bytes.toLocaleString("en-US")} B · <b className="text-ink-2">CC BY-NC 4.0</b>
            </>
          ) : (
            "加载版本信息…"
          )}
        </div>
        <div>NucMed DB · 中国药科大学</div>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <div className="min-h-screen">
      <Nav />
      <main className="wrap pt-12">
        <Suspense
          fallback={
            <div className="mt-6 space-y-4" aria-busy="true" aria-label="页面加载中">
              <div className="h-8 w-40 animate-pulse rounded-lg bg-[#eef2f8]" />
              <div className="h-4 w-64 animate-pulse rounded bg-[#f2f5fa]" />
              <div className="h-40 animate-pulse rounded-2xl bg-[#eef2f8]" />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/drug" element={<DrugDetail />} />
            <Route path="/drug/:id" element={<DrugDetail />} />
            {/* 兼容旧链接 /drugs/:id */}
            <Route path="/drugs/:id" element={<DrugDetail />} />
            <Route path="/about" element={<About />} />
            {LEGACY.map((p) => (
              <Route key={p} path={p} element={<Navigate to="/" replace />} />
            ))}
            {/* 未知路径不白屏，回总览 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
