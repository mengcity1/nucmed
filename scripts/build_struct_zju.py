"""pk330b 用浙大原图（SVG）替换"整药组成示意"：
- 源：logs/pk101_scratch/out3/assembled/<src_id>.svg（3,342 个）
- 出：web/public/compose/<drug_id>.svg
- 另出 vector_real_manifest.json：只把"真结构（ligand/peptide2d）"的药列出来，
  前端据此决定 ④ 载体 卡片是否显示小图（不再显示我们画的海报式示意图）。
只读库 + 只写 web/public。
"""
import json
import shutil
import sqlite3
from pathlib import Path

ROOT = Path(r"D:\nucmed")
A = ROOT / "logs" / "pk101_scratch" / "out3" / "assembled"
STRUCT = ROOT / "docs" / "assets" / "structures"
OUT = ROOT / "web" / "public" / "compose"
MAN = ROOT / "web" / "public" / "parts" / "vector_real_manifest.json"

con = sqlite3.connect(f"file:{(ROOT/'db'/'nucmed.db').as_posix()}?mode=ro", uri=True)
con.execute("PRAGMA query_only=1")
rows = con.execute("select id, src_id, coalesce(drug_type,'') from drug").fetchall()
con.close()

OUT.mkdir(parents=True, exist_ok=True)
n_svg = 0
real = {}
for did, sid, dtype in rows:
    src = A / f"{sid}.svg" if sid else None
    if src and src.exists():
        shutil.copyfile(src, OUT / f"{did}.svg")
        n_svg += 1
    # 真结构（小分子/肽）才算"配体结构"，抗体等没有小分子结构的留空
    if not dtype.lower().startswith("antibody"):
        for sub in ("ligand", "peptide2d"):
            d = STRUCT / sub
            if (d / f"drug_{did}.png").exists() or (d / f"{did}.png").exists():
                real[str(did)] = sub
                break

MAN.write_text(json.dumps(real, ensure_ascii=False, sort_keys=True), encoding="utf-8")
print(f"ZJU 整药示意图 → compose/*.svg : {n_svg} 个（源 {len(list(A.glob('*.svg')))}）")
print(f"真结构（载体卡片可显示）：{len(real)} 个 → {MAN.name}")
print(f"compose 目录总文件：{len(list(OUT.glob('*')))}")
