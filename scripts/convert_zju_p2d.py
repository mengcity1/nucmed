"""把浙大 p2d 原图转成 WebP → web/public/compose/zju/<drug_id>.webp"""
import sqlite3
from pathlib import Path

from PIL import Image

ROOT = Path(r"D:\nucmed")
SRC = ROOT / "data" / "raw" / "_harvest" / "ext" / "radiopharm_p2d" / "png"
OUT = ROOT / "web" / "public" / "compose" / "zju"
MAXW = 900
Q = 82

OUT.mkdir(parents=True, exist_ok=True)
con = sqlite3.connect(f"file:{(ROOT/'db'/'nucmed.db').as_posix()}?mode=ro", uri=True)
rows = con.execute("select id, src_id from drug").fetchall()
con.close()

ok = skip = miss = 0
for did, sid in rows:
    src = SRC / f"{sid}.png"
    dst = OUT / f"{did}.webp"
    if not src.exists():
        miss += 1
        continue
    if dst.exists():
        skip += 1
        continue
    with Image.open(src) as raw:
        im = raw.convert("RGB")
    if im.width > MAXW:
        im = im.resize((MAXW, max(1, round(im.height * MAXW / im.width))), Image.LANCZOS)
    im.save(dst, "WEBP", quality=Q, method=6)
    ok += 1

total = sum(p.stat().st_size for p in OUT.glob("*.webp"))
print(f"转换 {ok} · 跳过 {skip} · 无源 {miss} · 合计 {total/1024/1024:.1f} MB")
