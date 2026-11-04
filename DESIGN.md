# DESIGN.md · 视觉与动效规格（v6 · 2026-11-04）

> 本文件是 web 仓库的**设计真源**：颜色/字体/间距/动效都从这里取值，组件里不再随手写十六进制或 `0.3s`。
> 目标气质：**学术出版物的克制 + 数据产品的清晰** —— 信息密度可以高，但节奏必须稳。

## 0. 四条原则

1. **排版驱动**：层级靠字号/字重/留白，不靠阴影堆叠；
2. **留白节律**：间距只从 4/8/12/16/24/32/40 里取；
3. **色彩克制**：1 主色（brand）+ 3 点缀（accent/violet/sand）+ 中性灰阶；
4. **动效有因果**：短（120–320ms）、缓（ease-out）、可关闭；只动 `opacity` / `transform`。

## 1. 颜色令牌（`tailwind.config.js`）

| 用途 | 令牌 | 值 |
|---|---|---|
| 主色 / 深 / 浅 / 光 | `brand` / `brand-deep` / `brand-soft` / `brand-glow` | `#1e5ba8` / `#164a8a` / `#e8f0fa` / `#4a8ee0` |
| 数据点缀 1（青） | `accent` / `accent-deep` / `accent-soft` | `#0d9488` / `#0a7d6f` / `#e6f7f4` |
| 数据点缀 2（紫） | `violet` / `violet-soft` | `#6d5bd0` / `#efecfc` |
| 数据点缀 3（沙） | `sand` / `sand-soft` | `#b4761f` / `#fdf4e6` |
| 文字 | `ink` / `ink-2` / `ink-3` | `#0f172a` / `#475569` / `#94a3b8` |
| 分隔线 | `line` | `#e4e9f2` |

**图表色板 = Okabe–Ito（色盲友好，学术界事实标准）**
`#0072B2 · #56B4E9 · #009E73 · #E69F00 · #CC79A7 · #D55E00 · #6d5bd0 · #8c8c8c`
论文配图直接复用同一套，避免"网页一套色、投稿一套色"。

## 2. 字体

| 用途 | 字体栈 |
|---|---|
| 正文 / UI | `Inter` → `"Noto Sans SC"` → `system-ui` |
| 标题（h1/h2） | `"Noto Serif SC"` → `"Source Han Serif SC"` → `Songti SC` → `Georgia` |
| 数字 / 单位 | `SFMono-Regular` / `Consolas`（配合 `tabular-nums`，禁止等宽数字跳动） |

> 药名等"数据型标题"用 `font-sans` 覆盖（utilities 层优先于 base 层）。

## 3. 字阶与行高

| 场景 | 字号 | 行高 | 字重 |
|---|---|---|---|
| 页面标题（PageBar h1） | 19–20px | 1.2 | 700 |
| 区块标题（h2 / `.sec-h`） | 16px | 1.3 | 600 |
| 卡片标题 | 13–15px | 1.4 | 600 |
| 正文 | 13–14px | **1.6** | 400 |
| 辅助说明 | 11.5–12.5px | 1.5 | 400 |
| 大数字（KPI） | 27px | 1.0 | 700，`tabular-nums` |

## 4. 圆角 / 阴影

| 元素 | 圆角 | 阴影 |
|---|---|---|
| 卡片 | 12px（`md2`） | `s1`（默认）/ `s2`（悬停） |
| 面板 / Hero | 16px（`lg2`） | `glow`（仅深色块） |
| 按钮 / 输入框 | 8–10px | 无 / `inset` 高光 |
| 胶囊（chip / 徽标） | 全圆角 | 选中时 `0 2px 8px -2px rgba(30,91,168,.55)` |

## 5. 动效令牌

| 令牌 | 值 | 用途 |
|---|---|---|
| `duration-120` | 120ms | 颜色/边框微变 |
| `duration-160` | 160ms | 悬停抬升 |
| `duration-240` | 240ms | 进入渐显、展开收起 |
| `duration-320` | 320ms | 布局位移 |
| `duration-600` | 600ms | 数字计数、图表生长 |
| `ease-standard` | `cubic-bezier(.2,0,.38,.9)` | 默认 |
| `ease-entrance` | `cubic-bezier(0,0,.38,.9)` | 进场 |
| `ease-exit` | `cubic-bezier(.2,0,1,.9)` | 退场 |
| `ease-emphasis` | `cubic-bezier(.2,0,0,1)` | 强调（慎用） |

### 已实现的动效清单

| # | 动效 | 实现位置 | 参数 |
|---|---|---|---|
| 1 | KPI 数字计数 | `lib/useCountUp.ts` + `Home` 的 `Metric` | 600ms / easeOutCubic |
| 2 | 区块进入渐显 | `components/Reveal.tsx`（KPI 区、图集网格） | 240ms / 8px / 交错 40ms |
| 3 | 图表两段式绘制 | `DrugDetail` 的 `organOption` / `curveOption` | 600ms / cubicOut / 每系列 +40ms |
| 4 | 表格行聚焦 | `index.css` 的 `.table-zebra` | 150ms / 其余行 85% |
| 5 | 结构图微倾放大 | `DrugDetail` 结构图按钮 | 200ms / scale 1.015 |

### 暂缓（原因）

| 动效 | 原因 |
|---|---|
| **路由切换 View Transitions** | SPA 下需 `flushSync` 包裹导航；`/drug/:id → /drug/:id` 会触发整页重挂、丢 Tab 状态 ⇒ 先用现有淡入，等有充足测试再上 |

## 5.1 图像内文字的硬规则（2026-11-04 owner 追加）

**任何会进入站点的图片，图内文字一律英文。**

- 原因：站内的"英文模式零汉字"自检（`App.tsx` 的 DOM 扫描）**扫不到图片像素** ⇒ 中文标注会静默泄露；
- 现状：575 张 `schematic`（抗体海报图）含大量中文（`核素` / `螯合剂` / `半衰期` / `抗体 / 载体` / 底部说明），**已于 2026-11-04 停止展示**；
- 规则：绘图脚本里禁止出现中文标签；若必须双语气泡，只允许英文 + 单位符号（`h`、`d`、`MBq`）。

## 5.2 结构图口径（2026-11-04）

| 来源 | 是否展示 | 标题 | 备注 |
|---|---|---|---|
| `ligand`（浙大外部） | ✅ | 配体结构（外部来源 · 仅配体部分） | 884 条；无 SMILES |
| `rdkit`（库内 SMILES） | ✅ | 结构图（由库内 SMILES 经 RDKit 绘制） | 759 条，100% 有 SMILES |
| `peptide2d` | ✅ | 肽段 2D 结构 | 11 条 |
| **`schematic`** | ❌ **不展示** | —— | 575 条，全为抗体类；仅 2 条有 SMILES，示意图无结构信息 |

> 列表页的「✓ 结构」与 KPI「结构图覆盖」都按**上表可展示项**统计（加载 36 KB `struct/manifest.json` 判定）。


1. 全部动效包在 `@media (prefers-reduced-motion: no-preference)` 或运行时读取该媒体查询（见 `useCountUp` / `Reveal`）；
2. 键盘焦点统一 `:focus-visible { outline: 2px solid rgba(74,142,224,.55); outline-offset: 2px; }`；
3. 只对 `transform` / `opacity` 做动画，禁止 `width/height/top/left`（避免掉帧）；
4. 文字对比度 ≥ 4.5:1（`ink-3` 仅用于辅助信息，不用于正文）。

## 7. 参考（可借鉴的对象）

- **排版/图表范式**：Distill.pub（图先行 + 边注）、Our World in Data（灰阶坐标轴 + 单一强调色）
- **学术数据库交互**：Human Protein Atlas / GTEx / ENCODE / cBioPortal / UniProt / PDB
- **设计系统（抄数值）**：IBM Carbon（motion 分档）、GitHub Primer（表格/空态）、Radix Colors（色阶）
- **色板**：Okabe–Ito（色盲友好）；**字体**：Inter、IBM Plex、Source Serif 4、Noto Serif SC
- **WebGL 玻璃（vendor 而非依赖）**：[Lens](https://ruiqichenbiec.github.io/design-systems/)（MIT · `src/vendor/lens/`）
  —— 真折射 / 色散 / 弹簧；接入规矩见 **§11**

## 8. 明确不做

视差滚动 / 滚动劫持 · **无边界**的玻璃拟态（玻璃只允许出现在 §11 划定的「外壳」上，数据区永远纯白）·
首屏自动播放视频 · 超过 400ms 的界面过渡 · 给所有卡片加悬停抬升。

## 9. 变更记录

| 日期 | 内容 |
|---|---|
| 2026-11-04 | v6：字阶/令牌落表；h1/h2 改衬线；动效 1–5 上线；图表色板换 Okabe–Ito；`prefers-reduced-motion` 全站兜底 |
| 2026-11-04 | **v7 学术版式**：三线表（`.table-booktabs`）上首页目录与单药分布表；卡片 1px 内高光；目录标题加「表 1 / Table 1」；数值列右对齐 |
| 2026-11-04 | **v17 WebGL 背景色场**：新增 `src/lib/backgroundShader.ts` —— 单 canvas 全屏 quad，片元着色器画 **4 个指数衰减柔光球**（暖橙/淡紫/薄荷/天蓝）以 ~3.5% 振幅极慢漂移 + **1.5/255 抖动去 banding**；DPR ≤1.5、**限 30fps**、页面隐藏即停、`prefers-reduced-motion` 只画一帧、≤640px 不启用、WebGL 不可用返回 null（CSS 背景原样保留）。玻璃卡片仍用 `backdrop-filter` 采样这层**活颜色** |
| 2026-11-04 | **v18.1 玻璃扩围（≤6 处舞台）**：由「导航 + KPI」扩到 **6 处 / 11 个面片** —— 导航条 · 首页 KPI · 首页筛选卡 · About 内容卡组（**2 舞台 / 5 面片**）· 单药详情首屏三卡（1 舞台 / 3 面片）。新增 **两档材质**（`strength`：外壳 1 / 内容 0.5）与两个必须知道的坑：① 渲染器默认 `brightness:.95`，**大面积会变灰板** ⇒ 内容区设 `1.02`；② `.lg-stage button{border:0}` 会清掉舞台内按钮描边 ⇒ `index.css` 按类还原。**不做**：每卡一舞台（上下文上限）、数据面板玻璃化 |
| 2026-11-04 | **v19 最大档（质感重做）**：v18 的问题被定位为**背景太淡**（近白背景折射=看不出），改为 **3 档高对比绸带背景**（`shell` / `veil` / `edge`）+ 材质提到 `refr .90 / disp .42`；**数据表也进玻璃**（`edge` 档：绸带 + 饱和色环 + 内缩白板，行底 `rgba(255,255,255,.62)`，打印强制纯白）。实测：导航 chroma **35** / KPI **32** / 表格中心 值 **253** / 边带 chroma **17**。舞台 **7 处 / 13 面片**（每页 ≤4，全部 `webgl-ready`） |
| 2026-11-04 | **v20 一体背景 + 组件浮起（owner 指定形态）**："背景是一体的、组件和按钮在上面做液态玻璃" ⇒ 架构改为 **1 个舞台**（`position:fixed` 铺满视口 + 唯一 canvas）+ 内部 `.app-scroll` 承载页面滚动；背景改**淡 + 虚化**（近白 + 4 团柔光 + `blur(≈5vw)` + 8% 白纱）；面片扩到 **13 个**（含导航 tab 4 个、chip、两张数据表）；撤掉 v17 背景色场与 v10 丝绸层（两套背景会打架）。实测背景左 chroma **13.6** / 右 **19.6**、导航 **16.7/242**、表格中心 **249**；单 `lg-canvas` 无回退 |
| 2026-11-04 | **v18 真折射玻璃（vendor Lens · WebGL2）**：`src/vendor/lens/`（MIT · ruiqichenbiec/design-systems · 22 文件 158 KB 源码，**零依赖、不进 package.json**）。`components/GlassStage.tsx` 把**导航条**与**首页 KPI 带**变成真玻璃：`artwork()` 自绘「近白 + 极淡三色柔光 + 冷灰丝绸曲线」作为**场景纹理**，片元着色器对其真实采样弯折（`refraction .72 / blur .18 / dispersion .28`），并带 `JellyController` 弹簧；文字仍是**真 DOM**（`.webgl-ready .lg-surface` 只把背景置透明）⇒ 可读、可选中、可打印。≤640px / 无 WebGL2 / `prefers-reduced-motion` ⇒ `.fallback` 退回 CSS 毛玻璃。实测增量 **+19.7 KB gzip (JS) + 5.1 KB (CSS)** |

## 10. 版式骨架（v8 起）

| 区域 | 规则 |
|---|---|
| **报头** | 衬线标题 25–28px；其下一行 11.5px 元信息（`lead · 版本 · sha · 许可`，用 1px 竖线分隔）；底部 **2px 墨线**（`#0f172a/80`） |
| **数据报头** | 4 格横排，格间竖细线，数值 30px；标签 `.label-caps`（10.5px 大写 .16em）。**v18 起整条外套一层真折射玻璃**（`GlassStage` + `data-glass="panel"`），格内**仍然没有卡片底色** |
| **章节** | 标题前加 `.sec-no`（`01`…），等宽 11px、灰 |
| **表格** | 三线表：顶线 1.5px / 表头下线 1px / 底线 1.5px；**无竖线、无斑马纹**；表号在标题左侧 |
| **图注** | `Fig. n` + 归属徽标 + 药名链接；正文 11.5px `ink-3`，最多 3 行 |
| **页脚** | 三列：Cite as（衬线引用串）/ Version（等宽）/ License；顶部 1px 细线 |
| **打印** | 白底、隐藏导航与页脚、`thead` 每页重复、卡片/图/行 `break-inside: avoid`、关掉所有动效 |

## 11. 玻璃系统（v18 · vendor Lens）

**它做什么**：把 `artwork()` 自绘的 canvas 上传成**场景纹理**，舞台内所有 `[data-glass]` 元素由片元着色器
**真实采样并弯折**那张纹理（含边缘色散）—— 这是 CSS `backdrop-filter` 做不到的（它只能模糊）。

**为什么 vendor 而不 `npm i`**：本项目**零新依赖**原则；它是 MIT + 零运行时依赖 + `as-is` 不再维护
⇒ 固定版本拷进 `src/vendor/lens/`，保留 `LICENSE`，**不 fork 维护**，升级=重拷 + 重跑验收。

**允许挂玻璃的地方（v20：**1 个舞台 / 13 个面片**）**

| 面片（`data-glass`） | 数量 | 备注 |
|---|---|---|
| 导航条（`panel` + `.glass-bar`） | 1 | 满宽直角 |
| 导航 tab（`small`） | 4 | `.tab-on.lg-surface` 洗一层淡色保住选中态 |
| 首页 KPI 带（`panel`） | 1 | — |
| 首页筛选卡（`panel`） | 1 | chip 也是 `small` 面片 |
| 首页 chip（`small`） | 3+ | chip 底改半透明，玻璃透出来 |
| About 内容卡（`panel`） | 5 | — |
| 单药详情首屏（`panel`） | 3 | — |
| 数据表（`panel` + `.glass-edge`） | 2 | 首页药物清单 + 详情剂量表 |

**禁止**：再**新增舞台**（每多一个 = 多一张背景 = 拼接感回来）；图集海报不做玻璃（图是主体）。

**v20 架构：一体背景 + 组件浮起（现行）**

```
<div class="lg-stage app-stage">        ← fixed inset:0，唯一的 canvas（= 唯一背景）
  <div class="app-scroll">              ← 页面滚动容器（sticky/锚点/IO 均照常）
     <nav> <main> <footer>              ← 组件都是 [data-glass] 面片，浮在背景上
```

- **为什么必须一个舞台**：Lens 的玻璃只采样**同舞台内**画布（`renderer.js`：`stage.querySelectorAll('[data-glass]')`，
  canvas 尺寸 = 舞台面积 × dpr）。多舞台 ⇒ 背景被切成一块块拼接色块（v19 的毛病）+ canvas 面积 ×N。
- **代价（已处理）**：`body{overflow:hidden}`；路由切换手动 `.app-scroll.scrollTo(0)`；
  `@media print` 把 stage/scroll 还原成静态流式；`--scroll-v` 与 `window.scrollY` 全项目本就无使用处。
- **背景**：近白 + 4 团柔光（alpha .58–.78）+ `ctx.filter: blur(≈5vw)` 整组糊掉 + 8% 白纱 ⇒ 淡、虚化、**一体**。
- **材质**：`refraction .70 / blur .12 / dispersion .38`，`brightness 1.00`（⚠ 1.06 会把淡色洗成白：实测 chroma 13.6→2.6）。
- **面片**：导航条 / KPI / 筛选卡 / About 卡组 / 详情首屏 / 两张数据表 = `panel`；导航 tab 与 chip = `small`（共 13 个）。
- **实测**（1440×900 采样）：背景左 `chroma 13.6` 暖、右 `chroma 19.6` 冷（同一张壁纸的两侧）、导航 `chroma 16.7 / 值 242`、
  KPI `13.5 / 245`、表格中心 `值 249`（白纸可读）；`webgl-ready`×1 · `lg-canvas`×1 · 面片 13 ⇒ 单上下文、无回退。
- **旋钮**：`GlassApp.tsx` 的 `material.*` / `paintWallpaper` 的 alpha 与 blur / `.glass-edge` 行底透明度（.62）。

**用法**（新增一处玻璃）：
```tsx
<GlassStage>                                    {/* 舞台：内含 canvas + 生命周期 */}
  <section data-glass="panel" className="lg-surface">…</section>
</GlassStage>
```

**材质常量**（改之前先看效果，别调成"彩色横幅"）：
`refraction .72 / blur .18 / dispersion .28`；背景 `artwork` 的柔光 alpha 只到 **.16–.20** ——
玻璃的质感来自**边缘弯折与色散**，不是背景本身有颜色。

**回退链**：WebGL2 不可用 → `onFallback` → `.fallback` 类（CSS 毛玻璃 `rgba(245,250,255,.30)` + `blur`）；
≤640px → 组件直接不建系统，挂 `.fallback`；`prefers-reduced-motion` → `motion:false` 只渲染静态帧。

**性能纪律**：舞台后台自带 `ResizeObserver` + `IntersectionObserver`（**离屏即暂停 rAF**），
所以面片数要保持少（当前 2 个）；新增面片前先看首屏 JS 预算（§「验收」≤120 KB gzip 增量，当前 **+19.7**）。

**已知边界（不是 bug）**：折射只采样它**自己的**画布，**不抓取页面 DOM** ⇒
玻璃不会"弯折"它下面的表格文字；要看到弯折，必须让 `artwork` 里有点结构（柔光/曲线）。


