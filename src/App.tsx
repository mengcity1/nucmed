import { NavLink, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Suspense, lazy, useEffect, useState } from "react";
import { setDataLang, useJSON, type Meta } from "./lib/data";
import { LangCtx, useLang, useT, type Lang, type StrKey } from "./lib/i18n";
import { Icon, type IconName } from "./components/Icon";
import Overview from "./pages/Home";
// ★ pk262 B6：单药画像按需加载 —— Chart 依赖 echarts（586 kB / gzip 195 kB），
//   静态引入会让总览首屏也拉这个包。改为路由级 lazy 后 echarts 只在进入画像时才下载。
const DrugDetail = lazy(() => import("./pages/DrugDetail"));
import About from "./pages/About";
import Atlas from "./pages/Atlas";

/** 全站 4 页（3 页 + 2026-10-28 新增「文献影像图集」）· 标签文案走 i18n 表 */
const TABS: { to: string; key: StrKey; icon: IconName; end: boolean }[] = [
  { to: "/", key: "nav.overview", icon: "grid", end: true },
  { to: "/drug", key: "nav.drug", icon: "flask", end: false },
  { to: "/atlas", key: "nav.atlas", icon: "layers", end: false },
  { to: "/about", key: "nav.about", icon: "info", end: false },
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
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const loc = useLocation();
  /** ★ 2026-11-04：首页自己有一条「细带 + 宽搜索框」，导航里的搜索在本页隐藏（避免两个输入框同步同一参数）。 */
  const onHome = loc.pathname === "/";
  const q = sp.get("q") ?? "";
  const tr = useT();
  const { lang, setLang } = useLang();
  /** 小屏搜索：<md 时把搜索框折叠成图标，点开后在第二行铺满（2026-11-01 小屏适配） */
  const [mOpen, setMOpen] = useState(false);
  useEffect(() => {
    if (!mOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mOpen]);
  const onSearch = (v: string) => {
    const next = new URLSearchParams(sp);
    if (v) next.set("q", v);
    else next.delete("q");
    nav({ pathname: "/", search: next.toString() }, { replace: true });
  };
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white/80 backdrop-blur-xl backdrop-saturate-150">
      {/* 顶部渐变细带（2026-11-04 视觉升级）：给固定导航一个品牌锚点，不占高度 */}
      <span aria-hidden className="block h-[3px] w-full bg-gradient-to-r from-[#1e5ba8] via-[#4a8ee0] to-[#0d9488]" />
      <div className="wrap flex h-16 items-center gap-3 sm:gap-7">
        <NavLink to="/" className="flex shrink-0 items-center gap-2.5">
          <span className="grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-gradient-to-br from-brand to-[#2f7ad1] text-[17px] text-white shadow-[0_4px_12px_-4px_rgba(30,91,168,.55)]">
            ⚛
          </span>
          <span className="hidden min-w-0 leading-none sm:block">
            <b className="block truncate text-[15px] font-semibold tracking-wide">{tr("brand.name")}</b>
            <span className="mt-0.5 block max-w-[200px] truncate text-[11px] font-medium tracking-[.6px] text-ink-3">
              {tr("brand.sub")}
            </span>
          </span>
        </NavLink>

        {!onHome && (
        <div className="relative hidden min-w-0 flex-1 max-w-[360px] md:block">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] text-[#9aa8bd]">
            🔍
          </span>
          <input
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={tr("nav.searchPh")}
            className="h-[38px] w-full rounded-[10px] border border-line bg-white pl-9 pr-3.5 text-[13.5px] outline-none transition focus:border-[#9dc0ea] focus:ring-[3px] focus:ring-brand/10"
          />
        </div>
        )}

        {!onHome && (
        <button
          type="button"
          onClick={() => setMOpen((v) => !v)}
          aria-label={mOpen ? tr("nav.searchClose") : tr("nav.searchOpen")}
          aria-expanded={mOpen}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] border border-line bg-white text-[15px] text-ink-2 transition hover:border-[#b9d0e9] hover:text-ink md:hidden"
        >
          {mOpen ? "✕" : "🔍"}
        </button>
        )}

        <nav className="ml-auto flex min-w-0 gap-1 overflow-x-auto rounded-[14px] border border-line bg-[#f5f8fc] p-1">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `tab shrink-0 max-sm:px-2.5 max-sm:text-[12.5px] ${isActive ? "tab-on" : ""}`
              }
            >
              <span className="hidden sm:inline-flex">
                <Icon name={tab.icon} size={15} className="shrink-0 opacity-90" />
              </span>
              {tr(tab.key)}
            </NavLink>
          ))}
        </nav>
        <div
          role="group"
          aria-label="Language"
          data-allow-cjk=""
          className="ml-1 flex shrink-0 items-center rounded-[10px] border border-line bg-[#f5f8fc] p-0.5"
        >
          {([
            { v: "zh" as Lang, label: "中文" },
            { v: "en" as Lang, label: "EN" },
          ]).map((o) => {
            const on = lang === o.v;
            return (
              <button
                key={o.v}
                type="button"
                onClick={() => {
                  setLang(o.v);
                  const p = new URLSearchParams(sp);
                  if (o.v === "en") p.set("lang", "en");
                  else p.delete("lang");
                  setSp(p, { replace: true });
                }}
                aria-pressed={on}
                aria-label={o.v === "zh" ? "Chinese" : "English"}
                title={o.v === "zh" ? "Chinese" : "English"}
                className={`rounded-[8px] px-2 py-1 text-[11.5px] font-medium transition ${
                  on ? "bg-white text-brand-deep shadow-s1" : "text-ink-3 hover:text-ink"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 小屏展开式搜索：整行铺满，Esc 或 ✕ 收起 */}
      {!onHome && mOpen && (
        <div className="wrap pb-3 md:hidden">
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] text-[#9aa8bd]">
              🔍
            </span>
            <input
              autoFocus
              value={q}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={tr("nav.searchPh")}
              className="h-11 w-full rounded-[10px] border border-line bg-white pl-9 pr-3.5 text-[14px] outline-none transition focus:border-[#9dc0ea] focus:ring-[3px] focus:ring-brand/10"
            />
          </div>
        </div>
      )}
    </header>
  );
}

function Footer() {
  const { data: meta } = useJSON<Meta>("meta.json");
  const tr = useT();
  return (
    <footer className="wrap mt-12 border-t border-line pb-14 pt-6 text-[12px] text-ink-3">
      <div className="flex flex-wrap justify-between gap-4 pt-1">
        <div>
          {meta ? (
            <>
              {tr("footer.version")} <b className="font-semibold text-ink-2">{meta.version}</b> · sha{" "}
              <b className="font-mono font-semibold text-ink-2">{meta.db_sha16}</b> ·{" "}
              {meta.db_bytes.toLocaleString("en-US")} B ·{" "}
              <b className="text-ink-2">{tr("footer.license")}</b>
            </>
          ) : (
            "…"
          )}
        </div>
        <div>
          {tr("brand.name")} · {tr("footer.org")}
        </div>
      </div>
    </footer>
  );
}

/** ★ 2026-11-04：EnGate（「本页英文版正在翻译」占位门禁）已删除 ——
 *  总览 / 影像图集 / 单药画像 / 关于 四页英文全部实装，
 *  英文模式由 `App` 的 DOM 汉字自检（下方 useEffect）兜底。 */

export default function App() {
  /** 语言：URL `?lang=en` 优先，其次上次选择（localStorage），默认中文 */
  const [lang, setLang] = useState<Lang>(() => {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (q === "en" || q === "zh") return q;
    return localStorage.getItem("nucmed.lang") === "en" ? "en" : "zh";
  });
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    setDataLang(lang);
    try {
      localStorage.setItem("nucmed.lang", lang);
    } catch {
      /* 隐私模式下 storage 可能被禁用，忽略 */
    }
  }, [lang]);

  /** ★ 英文模式守卫：DOM 里一旦出现汉字就告警。
   *  这是「英文版零汉字」的现场自检 —— 迁移漏了哪一处，控制台立刻点名。
   *  唯一白名单：语言切换器本身（它必须写「中文」，owner 2026-11-03 明确要求）。 */
  useEffect(() => {
    if (lang !== "en") return;
    const timer = window.setTimeout(() => {
      const clone = document.body.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("[data-allow-cjk]").forEach((n) => n.remove());
      const hits = (clone.textContent ?? "").match(/[\u4e00-\u9fa5]+/g);
      if (hits) console.warn("[i18n] English mode still contains Chinese:", [...new Set(hits)].slice(0, 20));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [lang]);

  return (
    <LangCtx.Provider value={{ lang, setLang }}>
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
            <Route path="/atlas" element={<Atlas />} />
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
    </LangCtx.Provider>
  );
}
