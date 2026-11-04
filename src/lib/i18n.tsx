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

  "drug.title": { zh: "🔬 单药画像", en: "🔬 Drug profile" },
  "drug.lead": {
    zh: "搜索并选择一个核药，查看它的结构、生物分布与来源文献",
    en: "Search a drug to see its structure, biodistribution and source literature",
  },
  "drug.searchPh": { zh: "输入药名（中英文），如 PSMA…", en: "Search a drug name, e.g. PSMA…" },
  "drug.errDrugs": { zh: "药物目录（drugs.json）加载失败：", en: "Failed to load drug catalogue (drugs.json): " },
  "drug.noMatch": { zh: "没有匹配的核药", en: "No matching drugs" },
  "drug.noMatchHint": {
    zh: "关键词「{q}」在库内 {n} 个核药里没有命中。可以试英文名 / 通用名，或只输入片段（如 PSMA、DOTA）。",
    en: "No hit for “{q}” among {n} drugs. Try an English/generic name or a fragment (e.g. PSMA, DOTA).",
  },
  "drug.clearKw": { zh: "清空关键词", en: "Clear keyword" },
  "drug.hasStructTag": { zh: "✓ 结构", en: "✓ structure" },
  "drug.listCount": { zh: "共 {n} 个核药 · 仅显示前 24 个匹配项", en: "{n} drugs · showing the first 24 matches" },
  "drug.notFoundTitle": { zh: "没有 #{id} 这个核药", en: "No drug with id #{id}" },
  "drug.notFoundHint": {
    zh: "链接里的编号在库内不存在（可能是旧链接或被合并的编号）。可以回总览重新筛选，或去「单药画像」按名字选。",
    en: "That id does not exist in the database (old link or merged id). Go back to the overview, or pick a drug by name.",
  },
  "drug.backOverview": { zh: "← 回总览", en: "← Back to overview" },
  "drug.pickByName": { zh: "去「单药画像」选择 →", en: "Pick a drug by name →" },
  "drug.tabBio": { zh: "生物分布", en: "Biodistribution" },
  "drug.tabDos": { zh: "剂量学", en: "Dosimetry" },
  "drug.tabTbr": { zh: "靶本比", en: "Tumour / background" },
  "drug.tabRefs": { zh: "文献", en: "Literature" },
  "drug.tabImg": { zh: "文献影像", en: "Figures" },
  "drug.rows": { zh: "{n} 条", en: "{n} rows" },
  "drug.articles": { zh: "{n} 篇", en: "{n} papers" },
  "drug.figsN": { zh: "{n} 张", en: "{n} images" },
  "drug.hasRecord": { zh: "有记录", en: "available" },
  "drug.none": { zh: "该药暂无", en: "none" },
  "drug.back": { zh: "← 返回（保留筛选条件）", en: "← Back (filters kept)" },
  "drug.hasStruct": { zh: "✓ 有结构图", en: "✓ structure image" },
  "drug.noStruct": { zh: "无结构图", en: "no structure image" },
  "drug.fType": { zh: "类型", en: "Type" },
  "drug.fIsotope": { zh: "核素", en: "Isotope" },
  "drug.fStage": { zh: "研发阶段", en: "Stage" },
  "drug.fNameZh": { zh: "中文名", en: "Chinese name" },
  "drug.fTargets": { zh: "靶点", en: "Targets" },
  "drug.fDiseases": { zh: "适应症", en: "Indications" },
  "drug.parts": { zh: "分子组成", en: "Molecular composition" },
  "drug.partsHint": { zh: "五段分解 · 缺失段显示「—」", en: "Five parts · missing parts show “—”" },
  "drug.partIsotope": { zh: "① 核素", en: "① Isotope" },
  "drug.partChelator": { zh: "② 螯合剂", en: "② Chelator" },
  "drug.partLinker": { zh: "③ 连接子", en: "③ Linker" },
  "drug.partVector": { zh: "④ 载体", en: "④ Vector" },
  "drug.partTarget": { zh: "⑤ 靶点", en: "⑤ Target" },
  "drug.structFull": { zh: "完整结构图（点击放大）", en: "Full structure (click to zoom)" },
  "drug.structSchematic": { zh: "分子组成示意（非精确结构）", en: "Composition schematic (not exact structure)" },
  "drug.structSrcLigand": { zh: "radiopharm.idrblab.cn · 外部来源（ligand_only）", en: "radiopharm.idrblab.cn · external source (ligand_only)" },
  "drug.structSrcSchematic": { zh: "抗体/多肽示意图 · 本库绘制（非精确结构）", en: "Antibody/peptide schematic · drawn here (not exact)" },
  "drug.structSrcPeptide": { zh: "肽段 2D 结构 · 本库整理", en: "Peptide 2D structure · curated here" },
  "drug.structSrcRdkit": { zh: "由库内 SMILES 经 RDKit 现画", en: "Rendered from in-database SMILES via RDKit" },
  "drug.structSrcUnknown": { zh: "来源未标注", en: "source not labelled" },
  "drug.structLoadFail": {
    zh: "结构图加载失败（该药标记为有结构，但图片未取到）",
    en: "Structure image failed to load (flagged as having one, but the file is missing)",
  },
  "drug.clickZoom": { zh: "点击放大", en: "Click to zoom" },
  "drug.tablist": { zh: "单药画像分区", en: "Drug profile sections" },

  "dose.title": { zh: "器官吸收剂量", en: "Organ absorbed dose" },
  "dose.sortedBy": { zh: "按 mGy/MBq 降序", en: "sorted by mGy/MBq" },
  "dose.rawScale": { zh: "原文口径", en: "as reported" },
  "dose.countLine": { zh: "共 {a} 条 / {b} 个器官", en: "{a} rows / {b} organs" },
  "dose.isotope": { zh: "核素", en: "Isotope" },
  "dose.species": { zh: "物种", en: "Species" },
  "dose.topOrgan": { zh: "最高器官", en: "Top organ" },
  "dose.topValue": { zh: "最高值", en: "Top value" },
  "dose.rowsN": { zh: "{n} 条", en: "{n} rows" },
  "dose.unitUnregistered": { zh: "未登记口径", en: "unit not registered" },
  "dose.rawLabel": { zh: "原文：", en: "Source: " },
  "dose.mixedUnit": {
    zh: "该药的 {n} 条记录全部是「{u}」口径，不与器官吸收剂量同轴比较 —— 下列按原文列出",
    en: "All {n} records of this drug use “{u}”, which is not comparable with organ absorbed dose — listed as reported",
  },
  "dose.unmappable": {
    zh: "不可归一口径（不参与排序）· {a} 个器官 / {b} 条",
    en: "Non-normalisable units (not sorted) · {a} organs / {b} rows",
  },
  "dose.note": {
    zh: "口径：仅取 FDA 获批说明书「剂量与给药」表（{src}），每条保留 set_id 与原始单元格文本；μGy/Gy 与旧单位先归一到 mGy/MBq 再排序。",
    en: "Source: the “Dosage and administration” table of FDA-approved labels ({src}); each row keeps its set_id and raw cell text. μGy/Gy and legacy units are normalised to mGy/MBq before sorting.",
  },
  "dose.models": { zh: "模型：", en: "Models: " },
  "dose.unitScope": { zh: "单位口径：", en: "Units: " },
  "dose.clickToExpand": { zh: "点击任意器官可展开逐条原文。", en: "Click any organ to expand its source rows." },
  "dose.library": { zh: "剂量学全库", en: "Dosimetry library" },
  "dose.libraryLine": {
    zh: "{a} 个药 / {b} 条器官剂量记录 · 来自 FDA 获批说明书",
    en: "{a} drugs / {b} organ-dose rows · from FDA-approved labels",
  },
  "dose.searchPh": { zh: "药名 / drug_id…", en: "Drug name / drug_id…" },
  "dose.noMatch": { zh: "没有匹配的药物", en: "No matching drugs" },
  "dose.noMatchHint": {
    zh: "当前 {n} 个药全部不含「{q}」。可改用 drug_id 或英文名片段。",
    en: "None of the {n} drugs matches “{q}”. Try a drug_id or an English fragment.",
  },
  "dose.clear": { zh: "清空搜索", en: "Clear search" },
  "dose.thDrug": { zh: "药物", en: "Drug" },
  "dose.thIsotope": { zh: "核素", en: "Isotope" },
  "dose.thOrgans": { zh: "器官", en: "Organs" },
  "dose.thRows": { zh: "记录", en: "Rows" },
  "dose.thTopOrgan": { zh: "最高器官", en: "Top organ" },
  "dose.thTopValue": { zh: "最高剂量", en: "Top dose" },
  "dose.thUnit": { zh: "口径", en: "Unit" },
  "dose.thEvidence": { zh: "证据", en: "Evidence" },
  "dose.thProfile": { zh: "画像", en: "Profile" },
  "dose.detail": { zh: "详情 →", en: "Detail →" },
  "dose.errLoad": { zh: "剂量学数据（dosimetry.json）加载失败：", en: "Failed to load dosimetry data (dosimetry.json): " },
  "dose.emptyTitle": { zh: "该药暂无剂量学数据", en: "No dosimetry data for this drug" },
  "dose.emptyHint": {
    zh: "库内剂量学层只覆盖能从 FDA 获批说明书「剂量与给药」表机器提取的器官剂量；其余药物为空白，不代表不存在剂量学资料。",
    en: "The dosimetry layer only covers organ doses machine-extracted from FDA labels’ “Dosage and administration” tables; blanks do not mean no dosimetry exists.",
  },
  "dose.libLine": { zh: "全库 {a} 条 · 覆盖 {b} 个药", en: "{a} rows library-wide · {b} drugs" },
  "dose.layerEmptyTitle": { zh: "剂量学层为空", en: "Dosimetry layer is empty" },
  "dose.layerEmptyHint": {
    zh: "public/data/dosimetry.json 已加载，但没有记录 —— 可能是导出脚本未包含剂量学层。",
    en: "public/data/dosimetry.json loaded but contains no rows — the export script may have skipped the dosimetry layer.",
  },
  "dose.organUnknown": { zh: "未标注器官", en: "Unlabelled organ" },



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
  "atlas.origSize": { zh: "原图 {w} × {h} px", en: "Source {w} × {h} px" },
  "atlas.reset": { zh: "重置", en: "Reset" },
  "atlas.close": { zh: "关闭 ✕", en: "Close ✕" },
  "atlas.captionLabel": { zh: "原文图注：", en: "Caption: " },
  "atlas.truncated": {
    zh: "图注已在 400 字符处截断，完整内容请看 PMC 原图页",
    en: "Caption truncated at 400 characters — see the PMC figure page for the full text",
  },
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

  /* ── 关于页（2026-11-04 英文化：原来 0 条键、全页中文硬编码）── */
  "about.title": { zh: "ℹ 关于", en: "ℹ About" },
  "about.lead": {
    zh: "核药数据库（NucMed DB）· 可追溯的器官级生物分布资源与可复现基准",
    en: "NucMed DB — a traceable organ-level biodistribution resource with a reproducible benchmark",
  },
  "about.verTitle": { zh: "版本与标识", en: "Version and identifiers" },
  "about.kVersion": { zh: "数据版本", en: "Data version" },
  "about.kSha": { zh: "库指纹 sha256", en: "Database fingerprint (sha256)" },
  "about.shaSuffix": { zh: "（前 16 位）", en: " (first 16 hex chars)" },
  "about.kBytes": { zh: "库体积", en: "Database size" },
  "about.kExported": { zh: "导出时间", en: "Exported at" },
  "about.kScale": { zh: "规模", en: "Scale" },
  "about.scaleLine": {
    zh: "{a} 条分布记录 · {b} 个核药 · {c} 张表 · {d} 篇文献",
    en: "{a} biodistribution records · {b} drugs · {c} tables · {d} papers",
  },
  "about.kContext": { zh: "语境校验", en: "Context check" },
  "about.contextLine": {
    zh: "{a} / {b} 条通过多药比较句校验（剔除 {c} 条 C 级记录）",
    en: "{a} / {b} rows passed the multi-drug comparative-sentence check ({c} tier-C rows removed)",
  },
  "about.kLicense": { zh: "许可", en: "Licence" },
  "about.loading": { zh: "加载中…", en: "Loading…" },
  "about.availTitle": { zh: "数据可用性", en: "Data availability" },
  "about.availLead": {
    zh: "前端所用的全部数据均可直接下载（JSON · UTF-8）——不需要账号，不需要申请",
    en: "All data used by this site can be downloaded directly (JSON, UTF-8) — no account and no application required",
  },
  "about.availFullDb": {
    zh: "完整 SQLite 库（{mb} MB）与复现脚本见仓库；论文正式发表后补充 Zenodo DOI。",
    en: "The full SQLite database ({mb} MB) and the reproduction scripts are in the repository; a Zenodo DOI will be added on publication.",
  },
  "about.citeTitle": { zh: "引用", en: "Citation" },
  "about.citeNote": {
    zh: "作者顺序与 DOI 将在论文接收后更新；当前以「NucMed DB contributors」统一署名。",
    en: "Author order and DOI will be updated after acceptance; until then the dataset is attributed to “NucMed DB contributors”.",
  },
  "about.srcTitle": { zh: "数据来源与口径", en: "Data sources and definitions" },
  "about.srcIngest": { zh: "摄取记录", en: "Record ingestion" },
  "about.srcIngestBody": {
    zh: "PubMed / PMC 全文与表格抽取，保留原始文本片段与 PMID 指针；少数无原文片段的记录在详情页明确标注「仅文献级追溯」，只给 PMID，不用空白框冒充原文。",
    en: "Extracted from PubMed / PMC full texts and tables, keeping the original text snippet and a PMID pointer. For the few records without a snippet, the drug page explicitly marks “literature-level traceability only” and shows the PMID — no blank box is used to imitate a quotation.",
  },
  "about.srcStruct": { zh: "结构数据", en: "Structures" },
  "about.srcStructBody": {
    zh: "配体结构来自 radiopharm.idrblab.cn（口径 ligand_only）；分段结构（螯合剂 / 连接子 / 载体）由库内 SMILES 经 RDKit 现画。",
    en: "Ligand structures come from radiopharm.idrblab.cn (ligand_only convention); component-level schematics (chelator / linker / vector) are rendered from in-database SMILES via RDKit.",
  },
  "about.srcDose": { zh: "剂量学", en: "Dosimetry" },
  "about.srcDoseBody": {
    zh: "仅取自 FDA 获批药品说明书的「剂量与给药」表（dosage_and_administration_table），每条保留 set_id 与原始单元格文本；未经单位换算的原始数值不参与统计，μGy/Gy 一律先归一到 mGy/MBq 再入库。",
    en: "Taken only from the “Dosage and administration” tables of FDA-approved labels (dosage_and_administration_table); each row keeps its set_id and raw cell text. Unconverted values never enter statistics — μGy/Gy are normalised to mGy/MBq before ingestion.",
  },
  "about.srcTrace": { zh: "可追溯性", en: "Traceability" },
  "about.srcTraceBody": {
    zh: "分三层报告 —— 有 PMID 指针 / 库内可关联文献元数据 / 已标注 OA，不合并成一个百分比。",
    en: "Reported as three separate layers — has a PMID pointer / linkable in-database metadata / flagged open access — never merged into a single percentage.",
  },
  "about.srcMissing": { zh: "未收录即不画", en: "Nothing is drawn unless recorded" },
  "about.srcMissingBody": {
    zh: "缺失的组件显示「—」或虚线框，不用占位图冒充数据。",
    en: "Missing components show “—” or a dashed box; no placeholder image is used to imitate data.",
  },
  "about.contactTitle": { zh: "联系与反馈", en: "Contact and feedback" },
  "about.kOrg": { zh: "维护单位", en: "Maintained by" },
  "about.org": { zh: "中国药科大学", en: "China Pharmaceutical University" },
  "about.kIssues": { zh: "问题反馈", en: "Issues" },
  "about.issuesAt": { zh: "{repo}/issues（占位）", en: "{repo}/issues (placeholder)" },
  "about.kStack": { zh: "技术栈", en: "Stack" },
  "about.stack": {
    zh: "Vite + React + TypeScript + Tailwind CSS（纯静态，无后端）",
    en: "Vite + React + TypeScript + Tailwind CSS (static site, no backend)",
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
