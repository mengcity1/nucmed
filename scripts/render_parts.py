"""试点：按组件（螯合剂/连接子/载体）分别渲染化学结构小图。

用法：python web\\scripts\\render_parts.py
输出：web/public/parts/<drug_id>_<kind>.png（420×300）
"""
import sqlite3
from pathlib import Path

from rdkit import Chem
from rdkit.Chem.Draw import rdMolDraw2D

ROOT = Path(r"D:\nucmed")
DB = ROOT / "db" / "nucmed.db"
OUT = ROOT / "web" / "public" / "parts"
W, H = 420, 300

KINDS = {
    "chelator": ("rel_drug_chelator", "chelator_id", "chelator"),
    "linker": ("rel_drug_linker", "linker_id", "linker"),
    "vector": ("rel_drug_vector", "vector_id", "vector"),
}


def draw(smiles: str, path: Path) -> bool:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return False
    drawer = rdMolDraw2D.MolDraw2DCairo(W, H)
    drawer.drawOptions().padding = 0.08
    drawer.drawOptions().bondLineWidth = 2
    rdMolDraw2D.PrepareAndDrawMolecule(drawer, mol)
    drawer.FinishDrawing()
    path.write_bytes(drawer.GetDrawingText())
    return True


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    con.execute("PRAGMA query_only=1")
    total = 0
    for kind, (rel, fk, tbl) in KINDS.items():
        rows = con.execute(
            f"SELECT DISTINCT r.drug_id, t.smiles FROM {rel} r JOIN {tbl} t ON t.id = r.{fk} "
            f"WHERE t.smiles IS NOT NULL AND LENGTH(TRIM(t.smiles)) > 10"
        ).fetchall()
        n = 0
        bad = 0
        for drug_id, smiles in rows:
            path = OUT / f"{drug_id}_{kind}.png"
            if path.exists():
                continue
            if draw(smiles, path):
                n += 1
            else:
                bad += 1
        total += n
        print(f"  {kind}: rendered {n} / candidates {len(rows)} (unparseable {bad})")
    con.close()
    files = list(OUT.glob("*.png"))
    size = sum(f.stat().st_size for f in files) / 1024 / 1024
    print(f"total new {total} · now {len(files)} png / {size:.1f} MB")
    print(f"out = {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
