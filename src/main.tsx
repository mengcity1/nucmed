import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root 不存在");

/** ★ 2026-10-28：GitHub Pages 项目站部署在 /nucmed/ 子路径，
 *  路由必须带 basename，否则刷新 /nucmed/drug/3 时 pathname 与 /drug/:id 不匹配
 *  → 落到 "*" 兜底 → 被重定向到站点根（github.io/），再刷新就是真 404。
 *  BASE_URL 由 vite 的 base 决定：Pages 上是 "/nucmed/"，本地是 "/"。 */
const base = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter basename={base}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
