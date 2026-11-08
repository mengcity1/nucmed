"""pk330 结构图接线修复：
① 载体名下放"配体/载体结构图" → web/public/parts/<id>_vector.png
   规则：抗体类（无小分子结构）用卡通示意图；其余用 ligand 真结构；再退 peptide2d。
② 底部大图放"整个药的结构示意图" → web/public/compose/<id>.webp + compose/manifest.json
   规则：优先 parts4 四部件组成图；没有则退 schematic。

只读库（drug.id / drug_type），只写 web/public 下的资产与 manifest，不改数据库。
"""
import json
import sqlite3
from pathlib import Path

from PIL import Image

ROOT = Path(r"D:\nucmed")
STRUCT = ROOT / "docs" / "assets" / "structures"
PUB = ROOT / "web" / "public"
PARTS = PUB / "parts"
COMPOSE = PUB / "compose"
MAXW = 900
QUALITY = 82


def save_webp(src: Path, dst: Path) -> int:
    with Image.open(src) as raw:
        im = raw.convert("RGBA")
    if im.width > MAXW:
        im = im.resize((MAXW, max(1, round(im.height * MAXW / im.width))), Image.LANCZOS)
    bg = Image.new("RGB", im.size, (255, 255, 255))
    bg.paste(im, mask=im.split()[3])
    dst.parent.mkdir(parents=True, exist_ok=True)
    bg.save(dst, "WEBP", quality=QUALITY, method=6)
    return dst.stat().st_size


def find(sub: str, did: int):
    d = STRUCT / sub
    for name in (f"drug_{did}.png", f"{did}.png"):
        p = d / name
        if p.exists():
            return p
    return None


def main() -> int:
    con = sqlite3.connect(f"file:{(ROOT/'db'/'nucmed.db').as_posix()}?mode=ro", uri=True)
    con.execute("PRAGMA query_only=1")
    rows = con.execute("select id, coalesce(drug_type,'') from drug").fetchall()
    con.close()

    COMPOSE.mkdir(parents=True, exist_ok=True)
    v_ok = v_skip = c_ok = c_none = 0
    compose_manifest = {}

    for did, dtype in rows:
        is_ab = dtype.lower().startswith("antibody")
        # ① 载体名下：配体/载体结构图
        dst_v = PARTS / f"{did}_vector.png"
        if dst_v.exists():
            v_skip += 1
        else:
            order = ["schematic", "ligand", "peptide2d"] if is_ab else ["ligand", "peptide2d", "schematic"]
            for sub in order:
                src = find(sub, did)
                if src:
                    dst_v.parent.mkdir(parents=True, exist_ok=True)
                    with Image.open(src) as im:
                        im.convert("RGBA").save(dst_v, "PNG", optimize=True)
                    v_ok += 1
                    break

        # ② 底部：整个药的结构示意图
        src_c, tag = find("parts4", did), "parts4"
        if not src_c:
            src_c, tag = find("schematic", did), "schematic"
        if src_c:
            save_webp(src_c, COMPOSE / f"{did}.webp")
            compose_manifest[str(did)] = tag
            c_ok += 1
        else:
            c_none += 1

    (COMPOSE / "manifest.json").write_text(
        json.dumps(compose_manifest, ensure_ascii=False, sort_keys=True), encoding="utf-8")

    print(f"① 载体图：新增 {v_ok} · 已有跳过 {v_skip} · 合计 parts/*_vector.png "
          f"{len(list(PARTS.glob('*_vector.png')))}")
    print(f"② 组成图：生成 {c_ok} · 无源 {c_none} · compose/manifest.json {len(compose_manifest)} 项")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
