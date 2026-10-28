"""把配体结构图 PNG 转成 WebP（控体积 · 供静态站按需加载）。

用法：python web\\scripts\\convert_struct.py
输入：docs/assets/structures/ligand/*.png（884 张）
输出：web/public/struct/<id>.webp
"""
from pathlib import Path

from PIL import Image

ROOT = Path(r"D:\nucmed")
STRUCT = ROOT / "docs" / "assets" / "structures"
OUT = ROOT / "web" / "public" / "struct"
# 按优先级处理：同 id 只保留第一个命中的（真结构 > 肽段 2D > 抗体示意）
SRCS = ["ligand", "peptide2d", "schematic"]
MAXW = 900
QUALITY = 82


def main() -> int:
    if not STRUCT.exists():
        print(f"FAIL 源目录不存在：{STRUCT}")
        return 2
    OUT.mkdir(parents=True, exist_ok=True)
    n = 0
    total = 0
    skipped = 0
    for sub in SRCS:
        src_dir = STRUCT / sub
        if not src_dir.exists():
            print(f"skip missing dir: {sub}")
            continue
        for p in sorted(src_dir.glob("*.png")):
            # 统一命名：schematic/peptide2d 是 drug_1105.png，ligand 是 1105.png
            stem = p.stem.replace("drug_", "")
            out = OUT / (stem + ".webp")
            if out.exists():
                skipped += 1
                continue
            with Image.open(p) as raw:
                im = raw.convert("RGBA")
            if im.width > MAXW:
                h = max(1, round(im.height * MAXW / im.width))
                im = im.resize((MAXW, h), Image.LANCZOS)
            bg = Image.new("RGB", im.size, (255, 255, 255))
            bg.paste(im, mask=im.split()[3])
            bg.save(out, "WEBP", quality=QUALITY, method=6)
            n += 1
            total += out.stat().st_size
        print(f"  {sub}: done (cumulative new={n})")
    print(f"converted {n} new files (+{skipped} skipped) -> {total / 1024 / 1024:.2f} MB")
    print(f"out = {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
