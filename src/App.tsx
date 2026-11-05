import { NavLink, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Suspense, lazy, useEffect, useState } from "react";
import { setDataLang, useJSON, type Meta } from "./lib/data";
import { LangCtx, useLang, useT, type Lang, type StrKey } from "./lib/i18n";
import { Icon, type IconName } from "./components/Icon";
import GlassApp from "./components/GlassApp";
import { useTheme } from "./lib/theme";
import Overview from "./pages/Home";
// ★ pk262 B6：单药画像按需加载 —— Chart 依赖 echarts（586 kB / gzip 195 kB），
//   静态引入会让总览首屏也拉这个包。改为路由级 lazy 后 echarts 只在进入画像时才下载。
const DrugDetail = lazy(() => import("./pages/DrugDetail"));
/** 临时：背景结构对照页（选完删除） */
const GlassBgLab = lazy(() => import("./pages/GlassBgLab"));
/** ★ 2026-11-05：About 也改路由级 lazy —— 它 `import Chart`，而 Chart 依赖 echarts
 *  （573 KB / gzip 195 KB）⇒ 静态引入会把 echarts 拉进 **entry 依赖图**，`dist/index.html`
 *  因此对全站（含总览/图集）`modulepreload` 了它在。改 lazy 后 echarts 只在进 /about 时才下载。 */
const About = lazy(() => import("./pages/About"));
import Atlas from "./pages/Atlas";
/** 临时：液态玻璃选型对照页（选完删除） */

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
  const [theme, setTheme] = useTheme();
  const tr = useT();
  const { lang, setLang } = useLang();
  return (
    <header className="sticky top-0 z-50 px-3 pt-2">
      {/* v20.4（实测驱动）：canvas 玻璃的效果强度≈**圆角**。之前给导航条设 radius:0（满宽直角）
          ⇒ 零透镜效应，看着完全不像玻璃。改为**悬浮圆角玻璃条**（radius 22），两端与上下沿都能折光。 */}
        {/* v36（2026-11-04 owner：拖到底时"原来的液态玻璃框会留在原地"）——
            吸顶件**不再参与 canvas 折射**（摘掉 data-glass）：canvas 的玻璃是"把背景纹理
            按当前矩形弯折后画在画布上"，而吸顶件背后是**滚动的内容**、它的矩形要每帧重读，
            跟不上就会把上一帧的框留在原处。吸顶件改由 `backdrop-filter` 承担（`.glass-sticky`），
            内容穿过时被真正模糊，且不依赖任何 JS 重绘。 */}
        <div className="lg-surface glass-bar glass-sticky">
          <div className="wrap flex h-14 items-center gap-3 sm:gap-6">
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

            <nav className="ml-auto flex min-w-0 items-center gap-1 overflow-x-auto">
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
            {/* 深浅色切换（v22）：深色 / 米白浅色，选择写进 localStorage */}
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={theme === "dark" ? tr("theme.toLight") : tr("theme.toDark")}
              title={theme === "dark" ? tr("theme.toLight") : tr("theme.toDark")}
              className="ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-[14px] text-ink-2"
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
            <div
              role="group"
              aria-label="Language"
              data-allow-cjk=""
              className="ml-1 flex shrink-0 items-center rounded-[10px] border border-white/60 bg-white/50 p-0.5"
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
        </div>
    </header>
  );
}

function Footer() {
  const { data: meta } = useJSON<Meta>("meta.json");
  const tr = useT();
  return (
    <>
    <div aria-hidden className="mt-12 h-px w-full bg-gradient-to-r from-transparent via-[#d9e5f6] to-transparent" />
    <footer className="wrap pb-12 pt-6 text-[12px] text-ink-3">
      {/* 页脚三列（2026-11-04 v8）：引用格式 / 版本 / 许可 —— 出版物版权页的写法 */}
      <div className="grid gap-6 border-t border-line pt-5 sm:grid-cols-[1.6fr_1fr_1fr]">
        <div className="min-w-0">
          <div className="label-caps">{tr("footer.cite")}</div>
          <code className="mt-2 block break-words font-mono text-[11px] leading-relaxed text-ink-2">
            NucMed DB contributors (2026). NucMed DB: a traceable radiopharmaceutical biodistribution
            resource with a reproducible benchmark. Data version {meta?.version ?? "…"}, db sha256{" "}
            {meta?.db_sha16 ?? "…"}.
          </code>
        </div>
        <div>
          <div className="label-caps">{tr("footer.version")}</div>
          <div className="mt-2 font-mono text-[11px] leading-relaxed text-ink-2">
            {meta?.version ?? "…"}
            <br />
            sha {meta?.db_sha16 ?? "…"}
            <br />
            {meta ? `${meta.db_bytes.toLocaleString("en-US")} B` : "…"}
          </div>
        </div>
        <div>
          <div className="label-caps">{tr("footer.license")}</div>
          <div className="mt-2 text-[11px] leading-relaxed text-ink-2">
            {tr("footer.org")}
            <br />
            {tr("brand.name")}
          </div>
        </div>
      </div>
    </footer>
    </>
  );
}

/** ★ 2026-11-04：EnGate（「本页英文版正在翻译」占位门禁）已删除 ——
 *  总览 / 影像图集 / 单药画像 / 关于 四页英文全部实装，
 *  英文模式由 `App` 的 DOM 汉字自检（下方 useEffect）兜底。 */

/** 页面标题条（2026-11-04 v3）：与顶部导航**连成同一块**（同底色 / 通栏 / 无圆角 / 无间距），
 *  左边标题、右边搜索框。原「深色大横幅」已删除（owner：大标签没什么用，和顶部搜索合并）。
 *  ★ 标题与搜索框同处一条带：搜索的真值仍是 URL 的 `?q=`，在任何页输入都回首页并带上该参数。 */
const PAGE_META: { match: (p: string) => boolean; title: StrKey; lead?: StrKey }[] = [
  { match: (p) => p === "/", title: "home.title", lead: "home.lead" },
  { match: (p) => p.startsWith("/drug"), title: "drug.title" },
  { match: (p) => p.startsWith("/atlas"), title: "atlas.title", lead: "atlas.lead" },
  { match: (p) => p.startsWith("/about"), title: "about.title", lead: "about.lead" },
];

function PageBar({ pathname, q, onSearch }: { pathname: string; q: string; onSearch: (v: string) => void }) {
  const tr = useT();
  const { data: meta } = useJSON<Meta>("meta.json");
  const page = PAGE_META.find((m) => m.match(pathname)) ?? PAGE_META[0];
  return (
    /* 报头（masthead · 2026-11-04 v8）：衬线大标题 + 一行元信息（版本/sha/许可）+ 底部 2px 墨线
       —— 取代原来的"工具栏式"细带，视觉上从"SaaS 面板"转成"出版物"。 */
    <div className="relative">
      <div className="wrap relative flex flex-wrap items-end justify-between gap-x-8 gap-y-3 pb-2 pt-6">
        <div className="min-w-0">
          <h1 className="text-[25px] font-bold leading-none tracking-tight text-ink sm:text-[28px]">{tr(page.title)}</h1>
          <p className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-ink-3">
            {page.lead ? (
              <>
                <span>{tr(page.lead)}</span>
                <span aria-hidden className="h-3 w-px bg-line" />
              </>
            ) : null}
            <span className="font-mono">{meta?.version ?? "…"}</span>
            <span aria-hidden className="h-3 w-px bg-line" />
            <span className="font-mono">sha {meta?.db_sha16 ? meta.db_sha16.slice(0, 8) : "…"}</span>
            <span aria-hidden className="h-3 w-px bg-line" />
            <span>{tr("footer.license")}</span>
          </p>
        </div>
        <div className="relative w-full sm:w-[380px] lg:w-[420px]">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-ink-3">🔍</span>
          <input
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={tr("nav.searchPh")}
            aria-label={tr("nav.searchPh")}
            className="h-9 w-full rounded-[10px] border border-white/60 bg-white/45 pl-9 pr-9 text-[13.5px] shadow-ceil outline-none backdrop-blur-xl transition placeholder:text-ink-3 focus:border-white focus:bg-white/75 focus:ring-[3px] focus:ring-white/60"
          />
          {q ? (
            <button
              type="button"
              onClick={() => onSearch("")}
              aria-label={tr("drug.clearKw")}
              className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-ink-3 transition hover:bg-[#eef2f8] hover:text-ink"
            >
              ✕
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const loc = useLocation();
  const q = sp.get("q") ?? "";
  const onSearch = (v: string) => {
    const next = new URLSearchParams(sp);
    if (v) next.set("q", v);
    else next.delete("q");
    nav({ pathname: "/", search: next.toString() }, { replace: true });
  };
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

  /** v20：页面滚动改由 `.app-scroll` 承载 ⇒ 路由切换必须**手动回到顶部**
   *  （document 不再滚动，浏览器/Router 的默认行为都失效，不加这条会"翻页后停在半页"）。 */
  useEffect(() => {
    document.querySelector<HTMLElement>(".app-scroll")?.scrollTo({ top: 0, behavior: "auto" });
  }, [loc.pathname]);

  return (
    <LangCtx.Provider value={{ lang, setLang }}>
    {/* v20：全站只有**一个**玻璃舞台 —— 固定壁纸 + 页内滚动容器；组件浮在上面做液态玻璃。
        旧的 v17 背景色场与 v10 丝绸层都撤掉（否则两套背景打架）。 */}
    <GlassApp>
      <Nav />
      <PageBar pathname={loc.pathname} q={q} onSearch={onSearch} />
      <main className="wrap pt-6">
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
            <Route path="/lab/bg" element={<GlassBgLab />} />
            {LEGACY.map((p) => (
              <Route key={p} path={p} element={<Navigate to="/" replace />} />
            ))}
            {/* 未知路径不白屏，回总览 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </GlassApp>
    </LangCtx.Provider>
  );
}
