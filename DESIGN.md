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

## 6. 可访问性（硬约束，不许打折）

1. 全部动效包在 `@media (prefers-reduced-motion: no-preference)` 或运行时读取该媒体查询（见 `useCountUp` / `Reveal`）；
2. 键盘焦点统一 `:focus-visible { outline: 2px solid rgba(74,142,224,.55); outline-offset: 2px; }`；
3. 只对 `transform` / `opacity` 做动画，禁止 `width/height/top/left`（避免掉帧）；
4. 文字对比度 ≥ 4.5:1（`ink-3` 仅用于辅助信息，不用于正文）。

## 7. 参考（可借鉴的对象）

- **排版/图表范式**：Distill.pub（图先行 + 边注）、Our World in Data（灰阶坐标轴 + 单一强调色）
- **学术数据库交互**：Human Protein Atlas / GTEx / ENCODE / cBioPortal / UniProt / PDB
- **设计系统（抄数值）**：IBM Carbon（motion 分档）、GitHub Primer（表格/空态）、Radix Colors（色阶）
- **色板**：Okabe–Ito（色盲友好）；**字体**：Inter、IBM Plex、Source Serif 4、Noto Serif SC

## 8. 明确不做

视差滚动 / 滚动劫持 · 大面积玻璃拟态 · 首屏自动播放视频 · 超过 400ms 的界面过渡 · 给所有卡片加悬停抬升。

## 9. 变更记录

| 日期 | 内容 |
|---|---|
| 2026-11-04 | v6：字阶/令牌落表；h1/h2 改衬线；动效 1–5 上线；图表色板换 Okabe–Ito；`prefers-reduced-motion` 全站兜底 |
