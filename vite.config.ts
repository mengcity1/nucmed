import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // ★ base 由环境变量控制（2026-10-28 pk261）：
  //   - Vercel / Netlify / 自有域名：不设变量 ⇒ "/"
  //   - GitHub Pages 项目站（https://user.github.io/<repo>/）：构建时设 VITE_BASE=/<repo>/
  //   历史上这里写死过 "./"，导致 /drug/:id 下相对路径解析成 /drug/struct/xx.webp 全部 404。
  base: process.env.VITE_BASE ?? "/",
  build: {
    outDir: "dist",
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          echarts: ["echarts"],
        },
      },
    },
  },
  server: { port: 5173, open: true },
});
