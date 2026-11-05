"""选中态可见性 + 样式膨胀棘轮（2026-11-05 立 · 见 docs/ui_style_consolidation_20261105.md 第六节）

**为什么有这一门**：2026-11-05 一天内"看不出选中"返工 3 次，其中一次**改了等于没改**
（`bg-brand` 被全站玻璃规则的 `background-image: … !important` 洗掉）。本脚本把判据固化：

| 判据 | 阈值 | 挡的事故 |
|---|---|---|
| 每个**选中类**必须有明确可视标记（`::after/::before` 或**不透明** background 或伴随 `chip-badge`） | 必居其一 | "选中 = 淡色渐变"，与未选中几乎同亮度 |
| TSX 里**禁止**用 `bg-brand text-white` 表达选中 | 0 处 | 被玻璃规则 `!important` 盖住 ⇒ 点了没变化 |
| `index.css` 的 `!important` 计数 | ≤ **114**（棘轮，只降不升） | 115 处 `!important` ⇒ "改一处要猜谁赢" |
| `.chip*` / `.tab*` / `:is(button` 规则块数 | ≤ **30 / 13 / 15**（棘轮） | 同族规则层层叠加（31/14/15） |

用法：
    python scripts/check_ui_tokens.py              # 门（rc=1 = 有回归）
    python scripts/check_ui_tokens.py --self-test  # 负测：3 个历史坏例子必须全部判红
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # pragma: no cover
    pass

ROOT = Path(__file__).resolve().parent.parent
CSS = ROOT / "src" / "index.css"
SRC = ROOT / "src"

# 棘轮基线（**只允许往下调**；2026-11-05 批次 B 删掉 8 个重复/死规则后实测值）
BASE_IMPORTANT = 110
BASE_CHIP = 30
BASE_TAB = 13
BASE_BUTTON = 15

SELECTED = ("chip-on", "tab-on", "is-selected")
OPAQUE_BG = re.compile(r"background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3}\b|#[0-9a-fA-F]{6}\b|rgb\(\s*\d+[,\s]+\d+[,\s]+\d+\s*\)|var\(--ui-marker-bg\))")
BAD_JSX = re.compile(r"bg-brand[^\"'`\n]{0,40}text-white|text-white[^\"'`\n]{0,40}bg-brand")


def uncommented(text: str) -> str:
    return re.sub(r"/\*.*?\*/", "", text, flags=re.S)


def strip_js_comments(text: str) -> str:
    """去掉 JS/TSX 的块注释与**整行** `//` 注释（行尾 `//` 不动，避免误伤 URL）"""
    t = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return "\n".join(ln for ln in t.splitlines() if not ln.lstrip().startswith("//"))


def rules_of(css: str):
    body = uncommented(css)
    return [
        (" ".join(m.group(1).split()), " ".join(m.group(2).split()))
        for m in re.finditer(r"([^{}]+)\{([^{}]*)\}", body)
        if not m.group(1).strip().startswith("@")
    ]


def tsx_files():
    return {p: p.read_text(encoding="utf-8") for p in SRC.rglob("*.tsx")}


def tsx_code():
    """只保留"代码"（去注释），供各类 lint 用 —— 否则注释里提到的反例会被误判。"""
    return {p: strip_js_comments(t) for p, t in tsx_files().items()}


def check_selected_marker(css: str, tsx: dict) -> tuple[bool, str]:
    """每个选中类都要有"看得见"的实现。返回 (ok, 明细)"""
    rs = rules_of(css)
    detail, bad = [], []
    for cls in SELECTED:
        own = [(s, b) for s, b in rs if re.search(rf"\.{re.escape(cls)}(?![a-z-])", s)]
        has_pseudo = any(("::after" in s or "::before" in s) for s, _ in own)
        has_opaque = any(OPAQUE_BG.search(b) for _, b in own)
        with_badge = [str(p.relative_to(ROOT)) for p, t in tsx.items() if cls in t and "chip-badge" in t]
        used_anywhere = [str(p.relative_to(ROOT)) for p, t in tsx.items() if cls in t]
        ok = has_pseudo or has_opaque or bool(with_badge)
        how = ("::after/::before" if has_pseudo else "不透明底色" if has_opaque else f"伴随 chip-badge（{len(with_badge)} 个文件）" if with_badge else "**没有**")
        detail.append(f".{cls}: {how}" + ("" if used_anywhere else "（未被使用）"))
        if used_anywhere and not ok:
            bad.append(cls)
    return (not bad, "；".join(detail) if not bad else f"缺可见标记：{bad}｜{'; '.join(detail)}")


def check_bg_only(css_tsx: dict) -> tuple[bool, str]:
    hits = [f"{p.relative_to(ROOT)}: {m.group(0)}" for p, t in css_tsx.items() for m in BAD_JSX.finditer(t)]
    return (not hits, "未出现 `bg-brand … text-white` 写法" if not hits else "禁止只用背景色表达选中 → " + "；".join(hits))


def check_counts(css: str) -> tuple[bool, str]:
    rs = rules_of(css)
    imp = css.count("!important")
    chip = sum(1 for s, _ in rs if ".chip" in s)
    tab = sum(1 for s, _ in rs if re.search(r"\.tab(?:-on)?(?![a-z-])", s))
    btn = sum(1 for s, _ in rs if ":is(button" in s)
    ok = imp <= BASE_IMPORTANT and chip <= BASE_CHIP and tab <= BASE_TAB and btn <= BASE_BUTTON
    return (
        ok,
        f"!important {imp}/{BASE_IMPORTANT} · chip {chip}/{BASE_CHIP} · tab {tab}/{BASE_TAB} · button {btn}/{BASE_BUTTON}",
    )


def run(css: str, tsx: dict):
    return [
        ("选中态可见标记", *check_selected_marker(css, tsx)),
        ("禁止纯背景色选中", *check_bg_only(tsx)),
        ("样式膨胀棘轮", *check_counts(css)),
    ]


def show(rows):
    print(f"{'结果':<4}{'判据':<18}实测")
    print("-" * 96)
    for name, ok, detail in rows:
        print(f"{'✓' if ok else '✗'}   {name:<18}{detail}")


def self_test() -> int:
    css_ok = CSS.read_text(encoding="utf-8")
    tsx_ok = tsx_code()
    # ① 把"徽标"整个拿掉 ⇒ 选中态只剩淡渐变
    css_no_badge = css_ok.replace("chip-badge", "not-a-badge")
    tsx_no_badge = {p: t.replace("chip-badge", "not-a-badge") for p, t in tsx_ok.items()}
    # ② 新增一个用 `bg-brand text-white` 表达选中的文件
    tsx_bg_only = {**tsx_ok, ROOT / "src" / "FAKE.tsx": 'const x = on ? "border-brand bg-brand text-white" : "chip-off";'}
    # ③ 把 !important 灌到超基线
    css_padded = css_ok + "\n" + "".join(f".dummy{i}{{color:red !important}}\n" for i in range(30))
    cases = [
        ("选中态只剩淡渐变（去掉 chip-badge）", css_no_badge, tsx_no_badge),
        ("TSX 用 bg-brand + text-white 表达选中", css_ok, tsx_bg_only),
        ("!important 超过棘轮基线", css_padded, tsx_ok),
    ]
    caught = 0
    for name, css, tsx in cases:
        rows = run(css, tsx)
        red = [r for r in rows if not r[1]]
        print(f"{'✓' if red else '✗'}  {name} —— 判红 {len(red)} 项" + (f"（{red[0][0]}）" if red else "（**没抓住**）"))
        caught += 1 if red else 0
    print(f"\n负测 {caught}/{len(cases)} 抓红")
    return 0 if caught == len(cases) else 1


def main() -> int:
    if "--self-test" in sys.argv:
        return self_test()
    rows = run(CSS.read_text(encoding="utf-8"), tsx_code())
    show(rows)
    bad = [r for r in rows if not r[1]]
    print(f"\n{len(rows) - len(bad)}/{len(rows)} PASS")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
