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

/** ECharts 统一配色（与站点设计令牌对齐） */
export const PALETTE = [
  "#1e5ba8",
  "#3d84d6",
  "#78b0e2",
  "#0d9488",
  "#d97706",
  "#dc2626",
  "#7a3fa8",
  "#64748b",
];

export function Chart({
  option,
  height = 320,
}: {
  option: echarts.EChartsCoreOption;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
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
    const inst = echarts.init(el);
    inst.setOption(option);
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
    };
  }, [option, h]);
  return <div ref={ref} style={{ height: h }} className="w-full" />;
}

/** 通用坐标轴样式 */
export const AXIS = {
  axisLine: { lineStyle: { color: "#e4e9f2" } },
  axisTick: { show: false },
  axisLabel: { color: "#94a3b8", fontSize: 11 },
  splitLine: { lineStyle: { color: "#f1f4f9" } },
};
