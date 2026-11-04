/** 主题（深色 / 浅色·米白）—— 2026-11-04 实装
 *  - 默认深色；`?theme=light|dark` 可临时覆盖；选择写进 localStorage。
 *  - 切换通过自定义事件广播，GlassApp 监听后重建舞台（重画背景）。
 */
import { useEffect, useState } from "react";

export type Theme = "dark" | "light";
const KEY = "nucmed.theme";
export const THEME_EVENT = "nucmed:theme";

export function readTheme(): Theme {
  const q = new URLSearchParams(window.location.search).get("theme");
  if (q === "dark" || q === "light") return q;
  try {
    const s = localStorage.getItem(KEY);
    if (s === "dark" || s === "light") return s;
  } catch {
    /* 隐私模式禁用 storage，忽略 */
  }
  return "dark";
}

export function writeTheme(t: Theme) {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* 忽略 */
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => readTheme());
  useEffect(() => {
    const on = () => setTheme(readTheme());
    window.addEventListener(THEME_EVENT, on);
    return () => window.removeEventListener(THEME_EVENT, on);
  }, []);
  return [theme, writeTheme];
}
