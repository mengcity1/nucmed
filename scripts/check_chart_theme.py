"""图表配色/点径的自动门（2026-11-05 立 · 挂 DESIGN v43）

**为什么要有这一门**：2026-11-05 一天之内，同一张「生物分布可视化」因配色/尺寸返工 **4 次** ——
深色点看不见 → 深色点又被放大成 11px+柔光（像误差条）→ 浅色网格线淡到测不出 → 又一次补强。
四次都是 owner 截图才发现的，**没有任何自动检查**。本脚本把那次讨论里定下的判据固化：

| 判据 | 阈值 | 针对的事故 |
|---|---|---|
| `pointSize` / `lineSymbolSize` 跨主题**必须相等** | 相等 | 深 11px vs 浅 9px ⇒ 同一批数据看着"胖一圈" |
| `pointStyle()` 里**不得**有 `shadowBlur` | 无 | 12px 光晕把 9px 点撑到 ~15px |
| 数据色对各自底色 **≥ 3.0:1**（WCAG 图形对象门槛） | 3.0 | 深色沿用浅色板 `#1e5ba8` ⇒ 1.6:1，等于没画 |
| 网格线对底色**亮度差 ∈ [6, 28]/255**（画到的像素） | 6–28 | `#eef3fa` 在浅底 ≈3（看不见）；在深底 ≈177（抢数据） |
| 图例 / tooltip 文字 **≥ 4.5:1** | 4.5 | `#475569` 压深底读不出 |
| （只报不拦）轴标签 / 轴名对比度 | 建议 ≥4.5 | 浅色 `#8fa0b8` 实测 ≈2.4，属既有设计，先记账 |

**唯一实现处**：`src/components/Chart.tsx` 的 `LIGHT_TONE` / `DARK_TONE` / `PALETTE*` / `pointStyle()`。
本脚本只**读**它、不复制颜色 —— 改配色只改那一处，这里自动跟上（与项目「禁止第二份口径」同理）。

**已知欠账走"描边兜底"**：v4 色板为「6 个时点」做深/浅同色相配对，浅色成员在亮底上只有
1.79:1 / 2.23:1。2026-11-05 按 owner 决策**不改色板**，改为给浅色点加 1px 暗边
（`withAlpha("#0b1220", 0.8)`，实测对底色 **9.68:1**、亮度 63 vs 底 246）⇒ 本门规则：
**填色 <3:1 时必须有 ≥3:1 的描边兜底**，两者都不到才判红（这样"把暗边改回白边"也会被抓住）。

用法：
    python scripts/check_chart_theme.py              # 门：rc=1 表示有回归
    python scripts/check_chart_theme.py --self-test  # 负测：5 个历史坏值必须全部判红
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

# 控制台可能是 GBK（Windows / 管道）⇒ 不让 ✓ / 中文把门自己搞崩
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # pragma: no cover - 老解释器/被重定向
    pass

SRC = Path(__file__).resolve().parent.parent / "src" / "components" / "Chart.tsx"

# 底色 = 实测值（`logs/web_chart_check/probe_rows.py` 对 /drug/1511 图表区取行均色，
# 浅色中位 245.6 / 深色 RGB(64,64,81)）。换主题或换玻璃材质要同步改这两个常量。
LIGHT_BG = (246, 246, 242)
DARK_BG = (64, 64, 81)

GRID_MIN, GRID_MAX = 6.0, 28.0
POINT_MIN = 3.0
TEXT_MIN = 4.5


# ── 颜色小工具 ────────────────────────────────────────────────────────────
def hex2rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def parse_color(v: str):
    """`"#dde5f1"` / `withAlpha("#0b1220", 0.5)` / `"rgba(22,24,32,0.94)"` → (rgb, alpha)"""
    v = v.strip()
    m = re.fullmatch(r'"#([0-9a-fA-F]{6})"', v)
    if m:
        return hex2rgb(m.group(1)), 1.0
    m = re.fullmatch(r'withAlpha\("#([0-9a-fA-F]{6})",\s*([0-9.]+)\)', v)
    if m:
        return hex2rgb(m.group(1)), float(m.group(2))
    m = re.fullmatch(r'"rgba?\(([^)]*)\)"', v)
    if m:
        p = [x.strip() for x in m.group(1).split(",")]
        return (int(p[0]), int(p[1]), int(p[2])), float(p[3]) if len(p) > 3 else 1.0
    raise ValueError(f"无法解析颜色: {v!r}")


def over(fg, bg):
    """把带 alpha 的前景合成到不透明底色上"""
    (r, g, b), a = fg
    return (r * a + bg[0] * (1 - a), g * a + bg[1] * (1 - a), b * a + bg[2] * (1 - a))


def luma255(c) -> float:
    """0–255 亮度（与截图里"行均色差"同一标尺，便于跟实测对上）"""
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def rel_lum(c) -> float:
    """WCAG 相对亮度"""
    def f(v):
        x = v / 255
        return x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4

    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])


def contrast(a, b) -> float:
    la, lb = rel_lum(a), rel_lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


# ── 从源码里取"唯一实现处"的值 ────────────────────────────────────────────
def tone_block(src: str, name: str) -> dict[str, str]:
    i = src.index(f"const {name}: ChartTone = {{")
    j = src.index("\n};", i)
    body = re.sub(r"/\*.*?\*/", "", src[i:j], flags=re.S)
    out = {}
    for m in re.finditer(r"^\s*(\w+):\s*(.+?)\s*$", body, flags=re.M):
        out[m.group(1)] = m.group(2).rstrip(",").strip()
    return out


def palette(src: str, name: str) -> list[str]:
    i = src.index(f"export const {name} = [")
    j = src.index("];", i)
    return re.findall(r'"(#[0-9a-fA-F]{6})"', src[i:j])


def point_style_src(src: str) -> str:
    i = src.index("export function pointStyle")
    j = src.index("\n}", i)
    return re.sub(r"/\*.*?\*/", "", src[i:j], flags=re.S)


# ── 判据 ──────────────────────────────────────────────────────────────────
def run_checks(light: dict, dark: dict, pal_l: list[str], pal_d: list[str], psrc: str):
    """返回 [(ok, 名称, 说明)]；纯函数，负测可直接喂假数据。"""
    rows: list[tuple[bool, str, str]] = []

    for key in ("pointSize", "lineSymbolSize"):
        rows.append((light.get(key) == dark.get(key), f"{key} 跨主题一致",
                     f"浅 {light.get(key)} / 深 {dark.get(key)}"))

    glow = "shadowBlur" in psrc
    rows.append((not glow, "pointStyle 无光晕", "出现 shadowBlur" if glow else "未出现 shadowBlur"))

    for label, tone, bg, pal in (("浅色", light, LIGHT_BG, pal_l), ("深色", dark, DARK_BG, pal_d)):
        # 填色不够时，看 1px 描边能不能兜底（浅色主题用暗边、深色主题用暗缝，同一思路）
        edge = contrast(over(parse_color(tone["pointBorder"]), bg), bg)
        weak, bad = [], []
        for h in pal:
            r = contrast(hex2rgb(h), bg)
            if r >= POINT_MIN:
                continue
            if edge >= POINT_MIN:
                weak.append(f"{h}={r:.2f}")
            else:
                bad.append(f"{h}={r:.2f}")
        if bad:
            detail = "低于门槛且无兜底：" + "、".join(bad)
        elif weak:
            detail = "靠描边补足：" + "、".join(weak) + f"（描边 {edge:.2f}:1）"
        else:
            detail = f"{len(pal)} 色全部达标"
        rows.append((not bad, f"{label}数据色 ≥{POINT_MIN}", detail))

    for label, tone, bg in (("浅色", light, LIGHT_BG), ("深色", dark, DARK_BG)):
        line = over(parse_color(tone["splitLine"]), bg)
        d = abs(luma255(line) - luma255(bg))
        rows.append((GRID_MIN <= d <= GRID_MAX,
                     f"{label}网格线亮度差 ∈[{GRID_MIN:.0f},{GRID_MAX:.0f}]", f"实测 {d:.1f}/255"))

    for label, tone, bg in (("浅色", light, LIGHT_BG), ("深色", dark, DARK_BG)):
        r = contrast(over(parse_color(tone["legend"]), bg), bg)
        rows.append((r >= TEXT_MIN, f"{label}.legend ≥{TEXT_MIN}", f"{r:.2f}:1"))
        tb = over(parse_color(tone["tooltipBg"]), bg)
        r = contrast(over(parse_color(tone["tooltipText"]), tb), tb)
        rows.append((r >= TEXT_MIN, f"{label}.tooltip 文字 ≥{TEXT_MIN}", f"{r:.2f}:1"))

    return rows


def warnings(light: dict, dark: dict):
    """只报不拦：轴标签/轴名对比度（既有设计可能不足 4.5，先记账）"""
    out = []
    for label, tone, bg in (("浅色", light, LIGHT_BG), ("深色", dark, DARK_BG)):
        for key in ("label", "axisName"):
            r = contrast(over(parse_color(tone[key]), bg), bg)
            out.append((f"{label}.{key}", r, r >= TEXT_MIN))
    return out


def show(rows):
    print(f"{'结果':<4}{'判据':<34}实测")
    print("-" * 80)
    for ok, name, detail in rows:
        print(f"{'✓' if ok else '✗'}   {name:<34}{detail}")


# ── 负测：5 个真实发生过的坏值必须全部判红 ────────────────────────────────
def self_test(src: str) -> int:
    light, dark = tone_block(src, "LIGHT_TONE"), tone_block(src, "DARK_TONE")
    pl, pd = palette(src, "PALETTE"), palette(src, "PALETTE_DARK")
    psrc = point_style_src(src)
    cases = [
        ("深色网格线用浅色 #eef3fa（v38：抢数据）", light, {**dark, "splitLine": '"#eef3fa"'}, pl, pd, psrc),
        ("浅色网格线 #eef3fa（v41：淡到测不出）", {**light, "splitLine": '"#eef3fa"'}, dark, pl, pd, psrc),
        ("深色点径 11 / 浅色 9（v40：看着像误差）", light, {**dark, "pointSize": "11"}, pl, pd, psrc),
        ("深色套用浅色板（v38：1.6:1）", light, dark, pl, pl, psrc),
        ("pointStyle 加回 shadowBlur 12（v38：视觉直径撑大）", light, dark, pl, pd,
         psrc.replace("borderWidth: 1,", "borderWidth: 1, shadowBlur: 12,")),
        ("浅色描边改回白边（色板浅成员就没人兜底了）", {**light, "pointBorder": '"#ffffff"'}, dark, pl, pd, psrc),
    ]
    caught = 0
    for name, lg, dk, p1, p2, ps in cases:
        red = [r for r in run_checks(lg, dk, p1, p2, ps) if not r[0]]
        print(f"{'✓' if red else '✗'}  {name} —— 判红 {len(red)} 项" + (f"（{red[0][1]}）" if red else "（**没抓住**）"))
        caught += 1 if red else 0
    print(f"\n负测 {caught}/{len(cases)} 抓红")
    return 0 if caught == len(cases) else 1


def main() -> int:
    src = SRC.read_text(encoding="utf-8")
    if "--self-test" in sys.argv:
        return self_test(src)

    light, dark = tone_block(src, "LIGHT_TONE"), tone_block(src, "DARK_TONE")
    rows = run_checks(light, dark, palette(src, "PALETTE"), palette(src, "PALETTE_DARK"), point_style_src(src))
    show(rows)
    print("\n只报不拦（既有设计，改不改由 owner 定）：")
    for name, r, ok in warnings(light, dark):
        print(f"  {'✓' if ok else '!'}  {name:<12} {r:.2f}:1")

    bad = [r for r in rows if not r[0]]
    print(f"\n{len(rows) - len(bad)}/{len(rows)} PASS")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())

