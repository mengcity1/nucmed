/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#1e5ba8", deep: "#164a8a", soft: "#e8f0fa", glow: "#4a8ee0" },
        ink: { DEFAULT: "#0f172a", 2: "#475569", 3: "#94a3b8" },
        line: "#e4e9f2",
        ok: "#0d9488",
        warn: "#d97706",
        bad: "#dc2626",
        /* ★ 2026-11-04 视觉升级：数据用色（KPI 彩带 / 区块强调），只做点缀不改主色 */
        accent: { DEFAULT: "#0d9488", deep: "#0a7d6f", soft: "#e6f7f4" },
        violet: { DEFAULT: "#6d5bd0", soft: "#efecfc" },
        sand: { DEFAULT: "#b4761f", soft: "#fdf4e6" },
        /* ★ 2026-11-04 v9「ins 氛围」：低饱和暖/冷底色，只用于背景与玻璃卡 */
        cream: "#fff7f0",
        blush: "#ffe9e4",
        lilac: "#efeafb",
        mint: "#e6f5f0",
        sky: "#e8f1fb",
      },
      fontFamily: {
        sans: ['Inter', '"Noto Sans SC"', "system-ui", "sans-serif"],
        mono: ['"SFMono-Regular"', "Consolas", "monospace"],
      },
      borderRadius: { lg2: "16px", md2: "12px", sm2: "8px", xl2: "20px", xl3: "26px" },
      boxShadow: {
        s1: "0 1px 2px rgba(15,23,42,.04)",
        s2: "0 1px 2px rgba(15,23,42,.04), 0 8px 24px -8px rgba(15,23,42,.10)",
        s3: "0 2px 6px rgba(15,23,42,.05), 0 20px 44px -20px rgba(15,23,42,.22)",
        glow: "0 0 0 1px rgba(30,91,168,.10), 0 18px 40px -18px rgba(30,91,168,.40)",
        /* ★ v9：ins 风的大扩散柔光（低不透明度、大位移、无硬边） */
        soft: "0 1px 2px rgba(15,23,42,.03), 0 10px 28px -14px rgba(15,23,42,.12)",
        float: "0 2px 6px rgba(15,23,42,.04), 0 24px 60px -28px rgba(15,23,42,.22)",
        ceil: "inset 0 1px 0 rgba(255,255,255,.75)",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "none" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        fadeUp: "fadeUp .38s cubic-bezier(.22,.61,.36,1) both",
        fadeIn: "fadeIn .24s cubic-bezier(.22,.61,.36,1) both",
      },
      /* ★ 2026-11-04 动效令牌（对齐 IBM Carbon 的 productive/expressive 分档）：
         - standard/entrance/exit 三条曲线覆盖 90% 场景
         - 时长只用 120/160/240/320/600 五档，禁止随手写 0.3s */
      transitionDuration: {
        120: "120ms",
        160: "160ms",
        240: "240ms",
        320: "320ms",
        600: "600ms",
      },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.2, 0, 0.38, 0.9)",
        entrance: "cubic-bezier(0, 0, 0.38, 0.9)",
        exit: "cubic-bezier(0.2, 0, 1, 0.9)",
        emphasis: "cubic-bezier(0.2, 0, 0, 1)",
      },
    },
  },
  plugins: [],
};
