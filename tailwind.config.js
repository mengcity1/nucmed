/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#1e5ba8", deep: "#164a8a", soft: "#e8f0fa" },
        ink: { DEFAULT: "#0f172a", 2: "#475569", 3: "#94a3b8" },
        line: "#e4e9f2",
        ok: "#0d9488",
        warn: "#d97706",
        bad: "#dc2626",
      },
      fontFamily: {
        sans: ['Inter', '"Noto Sans SC"', "system-ui", "sans-serif"],
        mono: ['"SFMono-Regular"', "Consolas", "monospace"],
      },
      borderRadius: { lg2: "16px", md2: "12px", sm2: "8px" },
      boxShadow: {
        s1: "0 1px 2px rgba(15,23,42,.04)",
        s2: "0 1px 2px rgba(15,23,42,.04), 0 8px 24px -8px rgba(15,23,42,.10)",
      },
    },
  },
  plugins: [],
};
