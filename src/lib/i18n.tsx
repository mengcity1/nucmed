import { createContext, useContext } from "react";

/** 站点语言。zh = 中文（默认），en = English。
 *  ★ 为什么只有 UI 文案层：数据层实测 `name_zh` 有值 0/5,159、`targets_zh` 是英文、
 *    `diseases_zh` 是中文 MeSH —— 双语的难点不在框架，而在**数据字段本身就不齐**（见 docs/plan）。 */
export type Lang = "zh" | "en";

/** UI 文案表：新增文案只加这里一处，禁止在组件里写死两种语言的 if。 */
export const STR = {
  "common.loading": { zh: "加载中", en: "Loading" },
  "common.retry": { zh: "重试", en: "Retry" },
  "common.errorTitle": { zh: "数据加载失败", en: "Could not load data" },
  "common.emptyTitle": { zh: "没有匹配的记录", en: "No matching records" },
  "brand.name": { zh: "核药数据库", en: "NucMed DB" },
  "brand.sub": { zh: "可追溯的核药资源", en: "TRACEABLE RADIOPHARMACEUTICALS" },
  "nav.overview": { zh: "核药总览", en: "Overview" },
  "nav.drug": { zh: "单药画像", en: "Drug profile" },
  "nav.atlas": { zh: "影像图集", en: "Imaging atlas" },
  "nav.about": { zh: "关于", en: "About" },
  "nav.searchPh": { zh: "搜索核药、器官、核素…", en: "Search drugs, organs, isotopes…" },
  "nav.searchOpen": { zh: "打开搜索", en: "Open search" },
  "nav.searchClose": { zh: "关闭搜索", en: "Close search" },
  "en.pending.title": { zh: "本页英文版正在翻译", en: "This page is not available in English yet" },
  "en.pending.body": {
    zh: "英文版正在逐页翻译中。可先切回中文查看完整内容；总览与影像图集已支持英文。",
    en: "The English edition is being translated page by page. Please switch to the Chinese edition for this page for now — the Overview and the Imaging atlas are already available in English.",
  },
  "en.pending.back": { zh: "回总览", en: "Back to overview" },
  "nav.lang.zh": { zh: "中文", en: "中文" },
  "nav.lang.en": { zh: "EN", en: "EN" },
  "footer.license": { zh: "CC BY-NC 4.0", en: "CC BY-NC 4.0" },
  "footer.version": { zh: "版本", en: "Version" },
  "footer.org": { zh: "中国药科大学", en: "China Pharmaceutical University" },

  "home.title": { zh: "💊 核药总览", en: "💊 Overview" },
  "home.countLine": { zh: "有数据 {a} 个 · 目录收录 {b}", en: "{a} with data · {b} in catalogue" },
  "home.lead": {
    zh: "按类型 / 核素 / 靶点 / 适应症筛选 · 点标签即生效",
    en: "Filter by type / isotope / target / indication — tags apply instantly",
  },
  "home.errDrugs": { zh: "药物目录（drugs.json）加载失败：", en: "Failed to load drug catalogue (drugs.json): " },
  "home.quick": { zh: "常用：", en: "Quick:" },
  "home.onlyPts": { zh: "有生物分布数据（{n}）", en: "Has biodistribution ({n})" },
  "home.hideBad": { zh: "隐藏疑似非药名（{n}）", en: "Hide non-drug names ({n})" },
  "home.psma": { zh: "PSMA 相关核药", en: "PSMA-related drugs" },
  "home.lu177": { zh: "Lu-177 标记药物", en: "Lu-177 labelled" },
  "home.ga68": { zh: "Ga-68 标记药物", en: "Ga-68 labelled" },
  "home.filters": { zh: "筛选条件", en: "Filters" },
  "home.filtered": { zh: "已筛选", en: "filtered" },
  "home.allLib": { zh: "全库", en: "all" },
  "home.reset": { zh: "↺ 重置", en: "↺ Reset" },
  "home.drugType": { zh: "药物类型", en: "Drug type" },
  "home.isotope": { zh: "核素", en: "Isotope" },
  "home.diseasesEnOnly": {
    zh: "（英文版暂不可用：库内适应症为中文 MeSH）",
    en: "Not available in the English edition: the stored MeSH terms are Chinese-only.",
  },
  "home.dynamicOrder": { zh: "按当前筛选动态排序", en: "ordered by current filter" },
  "home.searchIsotope": {
    zh: "搜索核素（中文或符号，如 镥 / Lu）· 共 {n} 个",
    en: "Search isotope (symbol, e.g. Lu) · {n} total",
  },
  "home.collapse": { zh: "收起（只看前 12 个）", en: "Collapse (first 12)" },
  "home.expand": { zh: "展开全部 {n} 个核素", en: "Show all {n} isotopes" },
  "home.targets": { zh: "靶点", en: "Targets" },
  "home.searchTargets": { zh: "搜索靶点（共 {n} 个）", en: "Search targets ({n})" },
  "home.diseases": { zh: "适应症", en: "Indications" },
  "home.searchDiseases": { zh: "搜索适应症（共 {n} 个）", en: "Search indications ({n})" },
  "home.kpiResult": { zh: "结果药物", en: "Matching drugs" },
  "home.kpiResultHint": { zh: "有数据 {a} / 目录 {b}", en: "{a} with data / {b} in catalogue" },
  "home.kpiApproved": { zh: "已上市", en: "Approved" },
  "home.kpiApprovedHint": { zh: "最高阶段 = Approval", en: "highest stage = Approval" },
  "home.kpiStruct": { zh: "结构图覆盖", en: "Structure coverage" },
  "home.kpiStructHint": { zh: "{p}% · 有背证结构", en: "{p}% with curated structure" },
  "home.kpiDosim": { zh: "剂量学记录", en: "Dosimetry rows" },
  "home.kpiDosimHint": { zh: "{a} 个药 · {b} 器官", en: "{a} drugs · {b} organs" },
  "home.none": { zh: "暂无", en: "none" },
  "home.stage": { zh: "研发阶段：", en: "Stage:" },
  "home.sort": { zh: "排序", en: "Sort" },
  "home.sortStage": { zh: "阶段优先", en: "Stage first" },
  "home.sortAZ": { zh: "名称 A→Z", en: "Name A→Z" },
  "home.sortZA": { zh: "名称 Z→A", en: "Name Z→A" },
  "home.list": { zh: "药物清单", en: "Drug list" },
  "home.thProfile": { zh: "单药画像", en: "Profile" },
  "home.thDrug": { zh: "核药", en: "Drug" },
  "home.thType": { zh: "类型", en: "Type" },
  "home.thIsotope": { zh: "核素", en: "Isotope" },
  "home.thTarget": { zh: "靶点", en: "Target" },
  "home.thDisease": { zh: "适应症", en: "Indication" },
  "home.thStage": { zh: "阶段", en: "Stage" },
  "home.thPoints": { zh: "分布", en: "Points" },
  "home.thStruct": { zh: "结构", en: "Structure" },
  "home.view": { zh: "查看 →", en: "View →" },
  "home.emptyTitle": { zh: "当前条件没有匹配的核药", en: "No drugs match these filters" },
  "home.emptyHint": { zh: "试试去掉最窄的那个条件（靶点 / 适应症通常最窄）", en: "Try dropping the narrowest condition (target / indication usually is)" },
  "home.clearAll": { zh: "清除全部筛选 · 回到全库 {n} 个", en: "Clear all filters · back to {n} drugs" },
  "home.pageInfo": { zh: "共 {n} 条 · 第 {a} / {b} 页", en: "{n} rows · page {a} / {b}" },
  "home.prev": { zh: "上一页", en: "Previous" },
  "home.next": { zh: "下一页", en: "Next" },
  "home.noPts": { zh: "暂无生物分布记录", en: "No biodistribution records" },
  "home.uncategorized": { zh: "未分类", en: "Uncategorised" },
  "home.stageApproved": { zh: "已上市", en: "Approved" },
  "home.stageP4": { zh: "4期", en: "Phase 4" },
  "home.stageP3": { zh: "3期", en: "Phase 3" },
  "home.stageP23": { zh: "2/3期", en: "Phase 2/3" },
  "home.stageP2": { zh: "2期", en: "Phase 2" },
  "home.stageP12": { zh: "1/2期", en: "Phase 1/2" },
  "home.stageP1": { zh: "1期", en: "Phase 1" },
  "home.stageClinical": { zh: "临床", en: "Clinical" },
  "home.stagePreclinical": { zh: "临床前", en: "Preclinical" },
  "home.stageUnknown": { zh: "未标注", en: "Unspecified" },
  "home.microsphere": { zh: "微球/纳米", en: "Microsphere/Nanoconstruct" },

  "atlas.title": { zh: "🖼 文献影像图集", en: "🖼 Imaging atlas" },
  "atlas.lead": {
    zh: "PET / PET-CT 小动物全身显像图，全部引自原文 Figure（非本库生成，非重绘）。每张图保留原文图注、PMID / PMCID 与许可，可一键回原文核对。",
    en: "PET / PET-CT small-animal images, all reproduced from the original Figures (not generated or redrawn here). Each image keeps its caption, PMID / PMCID and licence, with a one-click link back to the source.",
  },
  "atlas.howto": { zh: "怎么读这个标签：", en: "How to read the tags:" },
  "atlas.attrib": { zh: "归属：", en: "Attribution:" },
  "atlas.all": { zh: "全部", en: "All" },
  "atlas.drug": { zh: "药物：", en: "Drug:" },
  "atlas.drugPh": { zh: "输入药名检索…", en: "Search a drug…" },
  "atlas.drugClear": { zh: "清除药名筛选", en: "Clear drug filter" },
  "atlas.drugCount": { zh: "个药有影像", en: "drugs imaged" },
  "atlas.drugCountLine": { zh: "共 {n} 个药有影像", en: "{n} drugs imaged" },
  "atlas.imgUnit": { zh: "张", en: "images" },
  "atlas.drugProfile": { zh: "单药画像 ↗", en: "Drug profile ↗" },
  "atlas.loadMore": { zh: "加载更多（剩 {n} 张）", en: "Load more ({n} left)" },
  "atlas.shown": { zh: "当前筛选 {a} 张 · 已显示 {b} 张", en: "{a} matches · showing {b}" },
  "atlas.copyright": {
    zh: "图像版权归原作者，按原文许可（多数为 CC BY 4.0）转载并保留出处；本库仅作陈列，未做任何像素改动。",
    en: "Image copyright belongs to the original authors; reproduced under the original licence (mostly CC BY 4.0) with attribution. No pixel-level modification is made here.",
  },
  "atlas.emptyTitle": { zh: "这个筛选下暂无影像图", en: "No images under this filter" },
  "atlas.clear": { zh: "清除筛选", en: "Clear filters" },
  "atlas.toOverview": { zh: "回总览 →", en: "Back to overview →" },
  "atlas.viewerHint": {
    zh: "滚轮 / ＋− 缩放 · 拖动平移 · 双击切换 · Esc 关闭",
    en: "Wheel / +− to zoom · drag to pan · double-click to toggle · Esc to close",
  },
  "atlas.narrow": {
    zh: "源图较窄（{w} px），放大只能看清局部，细节以原文为准",
    en: "Source image is narrow ({w} px) — zooming only reveals pixels; check the original for detail",
  },
  "atlas.pmc": { zh: "PMC 原图页 ↗", en: "PMC figure page ↗" },
  "atlas.attr.target": { zh: "图注点名本药", en: "Named in caption" },
  "atlas.attr.unclear": { zh: "图注未点名", en: "Not named in caption" },
  "atlas.attr.comparator": { zh: "图注是别的药", en: "Caption names another drug" },
  "atlas.attr.targetWhy": { zh: "图注文本里出现了该药的名称/别名", en: "The drug name or an alias appears in the caption" },
  "atlas.attr.unclearWhy": { zh: "图注没有指明具体药物，需回原文核对", en: "Caption does not name the drug; check the source" },
  "atlas.attr.comparatorWhy": { zh: "图注里出现的是另一种示踪剂", en: "The caption refers to a different tracer" },
  "atlas.allAttr": { zh: "全部归属", en: "All attributions" },
  "atlas.emptyHint": {
    zh: "本图集只收「原文图注明确是 PET / MIP / 全身显像」的 Figure。换一个药物、或点「全部」看看；也可回总览检索其他核药。",
    en: "This atlas only collects Figures whose captions mention PET / MIP / whole-body imaging. Try another drug or “All”; you can also search from the overview.",
  },
} as const;

export type StrKey = keyof typeof STR;

const CJK_RE = /[\u4e00-\u9fa5]/;

/** ★ 英文站兜底：任何含汉字且没有英文替代的数据字段 ⇒ 显示 "—"。
 *  这是「英文版绝不出现汉字」的机械保证 —— 即使某处文案漏迁，也不会漏出中文。 */
export function enSafe(lang: Lang, s: string | null | undefined): string {
  if (!s) return "";
  return lang === "zh" || !CJK_RE.test(s) ? s : "—";
}

/** 研发阶段：内部值仍是中文（排序/分组依赖它），只在显示时翻译 */
export function stageLabel(lang: Lang, s: string): string {
  const m: Record<string, StrKey> = {
    已上市: "home.stageApproved",
    "4期": "home.stageP4",
    "3期": "home.stageP3",
    "2/3期": "home.stageP23",
    "2期": "home.stageP2",
    "1/2期": "home.stageP12",
    "1期": "home.stageP1",
    临床: "home.stageClinical",
    临床前: "home.stagePreclinical",
    未标注: "home.stageUnknown",
  };
  const k = m[s];
  return k ? STR[k][lang] : enSafe(lang, s);
}

/** 中文元素名 → 符号：「镥-177」→「Lu-177」「镓-68、氟-18」→「Ga-68 · F-18」。
 *  数据层只有中文核素名（`radionuclides_zh`，88.1% 有值且全为中文），英文站必须转换。 */
const ELEM_SYM: Record<string, string> = {
  镓: "Ga", 氟: "F", 锝: "Tc", 锆: "Zr", 镥: "Lu", 铜: "Cu", 铟: "In", 碳: "C",
  碘: "I", 锕: "Ac", 钇: "Y", 钐: "Sm", 铼: "Re", 铋: "Bi", 铅: "Pb", 钪: "Sc",
  溴: "Br", 砷: "As", 砹: "At", 氧: "O", 氮: "N", 磷: "P", 金: "Au", 钍: "Th",
  钛: "Ti", 钬: "Ho", 镭: "Ra", 铯: "Cs", 铷: "Rb", 锶: "Sr", 铊: "Tl", 铱: "Ir",
  钌: "Ru", 钯: "Pd", 银: "Ag", 碲: "Te", 氙: "Xe", 铍: "Be", 钴: "Co", 铁: "Fe",
  锌: "Zn", 硒: "Se", 铬: "Cr", 钼: "Mo", 钨: "W", 铂: "Pt", 汞: "Hg", 铒: "Er",
  铥: "Tm", 镱: "Yb", 镝: "Dy", 钆: "Gd", 钕: "Nd", 镨: "Pr", 铈: "Ce", 镧: "La",
};

export function nuclideEn(zh: string | null | undefined): string {
  if (!zh) return "";
  return zh
    .split("、")
    .map((raw) => {
      const part = raw.trim();
      const m = part.match(/^([\u4e00-\u9fa5]+)-(\d+m?)$/);
      if (!m) return part;
      const sym = ELEM_SYM[m[1]];
      return sym ? `${sym}-${m[2]}` : part;
    })
    .filter(Boolean)
    .join(" · ");
}


type LangState = { lang: Lang; setLang: (l: Lang) => void };
export const LangCtx = createContext<LangState>({ lang: "zh", setLang: () => {} });
export const useLang = () => useContext(LangCtx);

/** 取文案：`const t = useT(); t("nav.about")`
 *  支持 {n} 占位替换：`t("atlas.loadMore", { n: 40 })`（只做单层替换，够用且无依赖） */
export function useT() {
  const { lang } = useLang();
  return (k: StrKey, vars?: Record<string, string | number>) => {
    let s: string = STR[k][lang];
    if (vars) for (const [key, v] of Object.entries(vars)) s = s.replace(`{${key}}`, String(v));
    return s;
  };
}
