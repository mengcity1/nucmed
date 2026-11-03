import { createContext, useContext } from "react";

/** 站点语言。zh = 中文（默认），en = English。
 *  ★ 为什么只有 UI 文案层：数据层实测 `name_zh` 有值 0/5,159、`targets_zh` 是英文、
 *    `diseases_zh` 是中文 MeSH —— 双语的难点不在框架，而在**数据字段本身就不齐**（见 docs/plan）。 */
export type Lang = "zh" | "en";

/** UI 文案表：新增文案只加这里一处，禁止在组件里写死两种语言的 if。 */
export const STR = {
  "brand.name": { zh: "核药数据库", en: "NucMed DB" },
  "brand.sub": { zh: "NUCMED DB", en: "RADIOPHARMACEUTICALS" },
  "nav.overview": { zh: "核药总览", en: "Overview" },
  "nav.drug": { zh: "单药画像", en: "Drug profile" },
  "nav.atlas": { zh: "影像图集", en: "Imaging atlas" },
  "nav.about": { zh: "关于", en: "About" },
  "nav.searchPh": { zh: "搜索核药、器官、核素…", en: "Search drugs, organs, isotopes…" },
  "nav.searchOpen": { zh: "打开搜索", en: "Open search" },
  "nav.searchClose": { zh: "关闭搜索", en: "Close search" },
  "nav.lang.zh": { zh: "中文", en: "中文" },
  "nav.lang.en": { zh: "EN", en: "EN" },
  "footer.license": { zh: "CC BY-NC 4.0", en: "CC BY-NC 4.0" },
  "footer.version": { zh: "版本", en: "Version" },
  "footer.org": { zh: "中国药科大学", en: "China Pharmaceutical University" },

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
