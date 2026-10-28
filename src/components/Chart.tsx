import { useEffect, useRef } from "react";
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
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const inst = echarts.init(el);
    inst.setOption(option);
    const onResize = () => inst.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      inst.dispose();
    };
  }, [option]);
  return <div ref={ref} style={{ height }} className="w-full" />;
}

/** 通用坐标轴样式 */
export const AXIS = {
  axisLine: { lineStyle: { color: "#e4e9f2" } },
  axisTick: { show: false },
  axisLabel: { color: "#94a3b8", fontSize: 11 },
  splitLine: { lineStyle: { color: "#f1f4f9" } },
};
