import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { BarChart, HeatmapChart, LineChart, ScatterChart } from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  BarChart,
  HeatmapChart,
  LineChart,
  ScatterChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  TitleComponent,
  DataZoomComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

/** ECharts 统一配色（与站点设计令牌对齐 · 2026-11-04 v4 重排为 品牌蓝→青→紫→沙 四族） */
export const PALETTE = [
  "#1e5ba8",
  "#4a8ee0",
  "#0d9488",
  "#4ecdc4",
  "#6d5bd0",
  "#a99cf0",
  "#b4761f",
  "#7c8ba1",
];

/** 深色版数据色（2026-11-05 加 · 与 `PALETTE` 同色相、只提亮）
 *  原因：石墨灰底（≈`#3f4350`）上，浅色版 `#1e5ba8` 只有 **1.6:1**、`#4a8ee0` **2.9:1**
 *  ⇒ 点看着像"没画"（owner：「深色模式这里的点可视化效果很差」）。
 *  这一组对 `#3f4350` 都在 **4.5:1** 以上（WCAG 图形对象门槛是 3:1）。 */
export const PALETTE_DARK = [
  "#6fb2ff",
  "#9ccbff",
  "#2ecfb2",
  "#8ae8d5",
  "#b39bff",
  "#d3c7ff",
  "#f0be74",
  "#c2cddd",
];

/** `#rgb` / `#rrggbb` → `rgba()`：点的柔光晕、图例渐隐色都要带透明度 */
export function withAlpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h)) return hex;
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function Chart({
  option,
  height = 320,
}: {
  option: echarts.EChartsCoreOption;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  /** ECharts 实例：跨 `option` 变更复用，只有卸载才 dispose（见下方 init effect 的注释） */
  const instRef = useRef<ReturnType<typeof echarts.init> | null>(null);
  /** 小屏（<640px）高度按 0.72 缩放：320 → 230，避免手机上一屏放不下（2026-11-01 小屏适配） */
  const [h, setH] = useState(height);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setH(mq.matches ? Math.round(height * 0.72) : height);
    apply();
    if (mq.addEventListener) mq.addEventListener("change", apply);
    else mq.addListener(apply);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", apply);
      else mq.removeListener(apply);
    };
  }, [height]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    /* ★ 2026-11-05：实例**只建一次**。旧写法把 init/dispose 放在 `[option, h]` 上 ⇒
       切主题、切「器官对比/时间曲线」、改筛选都会 dispose 再 init：canvas 重建、
       600ms 入场动画重放、hover/选中状态丢失（观感就是"闪一下"）。 */
    const inst = echarts.init(el);
    instRef.current = inst;
    const onResize = () => inst.resize();
    // ResizeObserver 优于 window.resize：容器因布局/断点变化而变宽时也会重绘
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(onResize);
      ro.observe(el);
    } else {
      window.addEventListener("resize", onResize);
    }
    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", onResize);
      inst.dispose();
      instRef.current = null;
    };
  }, []);

  /* 选项变化只**更新**，不重建：`notMerge = true` 保证系列/坐标轴整体替换（切换视图时类型会变） */
  useEffect(() => {
    instRef.current?.setOption(option, true);
  }, [option]);

  return <div ref={ref} style={{ height: h }} className="w-full" />;
}

/** 图表主题令牌（2026-11-05 立 · owner：「深色模式这里的点可视化效果很差，然后实线也过于显眼」）
 *
 *  **为什么不能靠 CSS**：ECharts 画在 `<canvas>` 上，`index.css` 里那一整套
 *  `.app-stage.dark …` 覆盖**摸不到像素** ⇒ 浅色版的值原样上屏，于是深色下：
 *   - `splitLine #eef3fa`（近白）压在石墨灰底上 ⇒ 一排**白实线**比数据还抢眼；
 *   - 点 `#1e5ba8` / `#4a8ee0` 对比度 1.6:1 / 2.9:1 ⇒ 像是没画点；
 *   - 图例 `#475569` 深底上几乎读不出（截图里「1 h / 2 h」就是这种状态）。
 *  ⇒ 颜色与线型必须由 JS 按主题传进去：`chartTone(dark)` + `axisStyle/legendStyle/tooltipStyle`。 */
export type ChartTone = {
  dark: boolean;
  /** 数据色（按系列顺序取） */
  palette: string[];
  /** 散点直径（**深浅必须一致**：2026-11-05 曾在深色给到 11px，结果同一批数据
   *  在深色下显得比浅色"胖"一圈，被判成"误差很大" —— 点径是数据语义的一部分，不能随主题变） */
  pointSize: number;
  /** 折线视图上数据点的直径（比散点略小：点在线上要"压得住线"） */
  lineSymbolSize: number;
  /** 点描边：深色用**贴着底色的暗边**（同浅色的白边），只当边缘/缝用 ——
   *  不要用亮边或柔光，否则会增大"看着的直径"（见 `pointSize` 注） */
  pointBorder: string;
  /** 折线宽度 */
  lineWidth: number;
  axisLine: string;
  splitLine: string;
  splitLineType: "solid" | "dashed";
  label: string;
  axisName: string;
  legend: string;
  legendInactive: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
};

const LIGHT_TONE: ChartTone = {
  dark: false,
  palette: PALETTE,
  pointSize: 9,
  lineSymbolSize: 6,
  /* 浅色描边（2026-11-05 改）：原先是纯白 —— 压在浅底上等于没有边，色板里 #4ecdc4(1.79:1) /
     #a99cf0(2.23:1) 这类"浅色成员"就整片糊掉。改成**暗色细边**（与深色的暗缝同一思路）：
     填色可保持既有色板（6 个时点的深/浅同色相配对），可见性由 1px 边兜底。
     ⚠ 取值要**比所有填色都暗**（最深的 #1e5ba8 亮度 ≈75/255）：0.55 时描边亮度 ≈130，
     压在深蓝点上会变成"亮光圈"；0.8 时 ≈64，对最深的点也只是更暗的边，不产生光圈。 */
  pointBorder: withAlpha("#0b1220", 0.8),
  lineWidth: 2,
  /* 浅色网格线：早前 `#eef3fa` + 虚线实测**每行只差 ~2/255**（等于没画，owner：「浅色模式这里的线太不明显了」）。
     现取 `#dde5f1`：对浅底 ~246 的行均值差 ≈ -8/255（虚线覆盖约一半），仍远弱于数据点（Δ≈130）。
     轴线 `#cfdaea` 比网格线再重一档 —— 它是"坐标系的下边界"，不是网格。 */
  axisLine: "#cfdaea",
  splitLine: "#dde5f1",
  splitLineType: "dashed",
  label: "#8fa0b8",
  axisName: "#94a3b8",
  legend: "#475569",
  legendInactive: "#c3ccd9",
  tooltipBg: "#ffffff",
  tooltipBorder: "#e4e9f2",
  tooltipText: "#0f172a",
};

const DARK_TONE: ChartTone = {
  dark: true,
  palette: PALETTE_DARK,
  pointSize: 9,
  lineSymbolSize: 6,
  /* 描边取**贴着底色**的暗色（浅色主题同理用白边）：只当"边缘/缝"用，不增加视觉直径。
     早前用 55% 白描边，实测像素面积比浅色大 ~30px（9px 点看着像 11px）⇒ 仍被判"深色点更大"。 */
  pointBorder: withAlpha("#0b1220", 0.5),
  lineWidth: 2,
  axisLine: withAlpha("#ffffff", 0.16),
  splitLine: withAlpha("#ffffff", 0.1),
  splitLineType: "dashed",
  label: "#b9c6d8",
  axisName: "#c6d2e2",
  legend: "#dbe6f4",
  legendInactive: withAlpha("#dbe6f4", 0.32),
  tooltipBg: "rgba(22,24,32,0.94)",
  tooltipBorder: withAlpha("#ffffff", 0.16),
  tooltipText: "#e8eef7",
};

export function chartTone(dark: boolean): ChartTone {
  return dark ? DARK_TONE : LIGHT_TONE;
}

/** 通用坐标轴样式（网格线一律**虚线**：实线会和"数据线"抢同一语义，深色下尤其明显） */
export function axisStyle(tone: ChartTone) {
  return {
    axisLine: { lineStyle: { color: tone.axisLine } },
    axisTick: { show: false },
    axisLabel: { color: tone.label, fontSize: 11 },
    splitLine: { lineStyle: { color: tone.splitLine, width: 1, type: tone.splitLineType } },
  };
}

/** 散点样式：亮色 + 细描边
 *  ⚠ 不加柔光晕（`shadowBlur`）：光晕会把 9px 的视觉直径撑到 ~15px，深色下比浅色"胖"一圈，
 *  被当成误差条（2026-11-05 实测反馈）。可读性靠**配色**解决（`PALETTE_DARK` ≥4.5:1），不靠放大。 */
export function pointStyle(tone: ChartTone, color: string) {
  return {
    color,
    borderColor: tone.pointBorder,
    borderWidth: 1,
  };
}

/** 图例（两个视图共用一份口径，别各写一套） */
export function legendStyle(tone: ChartTone) {
  return {
    type: "scroll" as const,
    top: 0,
    itemWidth: 10,
    itemHeight: 10,
    itemGap: 10,
    textStyle: { fontSize: 11, color: tone.legend },
    inactiveColor: tone.legendInactive,
  };
}

/** tooltip（默认是纯白卡片 —— 深色下会变成一块"白砖"，这里跟着主题走） */
export function tooltipStyle(tone: ChartTone) {
  return {
    backgroundColor: tone.tooltipBg,
    borderColor: tone.tooltipBorder,
    borderWidth: 1,
    padding: [7, 10] as [number, number],
    textStyle: { color: tone.tooltipText, fontSize: 12 },
    extraCssText: "border-radius:10px;backdrop-filter:blur(10px);box-shadow:0 14px 32px -16px rgba(0,0,0,.55);",
  };
}
