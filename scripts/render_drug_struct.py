"""给「库内有 SMILES 但 web/public/struct 没有图」的药补渲整药结构图（WebP）。

用法：python web\\scripts\\render_drug_struct.py
输出：web/public/struct/<drug_id>.webp（已存在则跳过，可反复重跑）
"""
import io
import sqlite3
from pathlib import Path

from PIL import Image
from rdkit import Chem, RDLogger
from rdkit.Chem.Draw import rdMolDraw2D

RDLogger.DisableLog("rdApp.*")

ROOT = Path(r"D:\nucmed")
DB = ROOT / "db" / "nucmed.db"
OUT = ROOT / "web" / "public" / "struct"
W, H = 900, 700
QUALITY = 85


def render(smiles: str) -> bytes | None:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    drawer = rdMolDraw2D.MolDraw2DCairo(W, H)
    opts = drawer.drawOptions()
    opts.padding = 0.06
    opts.bondLineWidth = 2
    opts.addStereoAnnotation = False
    rdMolDraw2D.PrepareAndDrawMolecule(drawer, mol)
    drawer.FinishDrawing()
    png = drawer.GetDrawingText()
    try:
        with Image.open(io.BytesIO(png)) as im:
            return im.convert("RGB").tobytes()
    except OSError:
        return png


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    con.execute("PRAGMA query_only=1")
    rows = con.execute(
        "SELECT id, smiles FROM drug "
        "WHERE smiles IS NOT NULL AND LENGTH(TRIM(smiles)) > 10 ORDER BY id"
    ).fetchall()
    con.close()

    todo = [(i, s) for i, s in rows if not (OUT / f"{i}.webp").exists()]
    print(f"candidates with SMILES: {len(rows)} · missing image: {len(todo)}")
    ok = 0
    bad = 0
    for drug_id, smiles in todo:
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            bad += 1
            continue
        drawer = rdMolDraw2D.MolDraw2DCairo(W, H)
        opts = drawer.drawOptions()
        opts.padding = 0.06
        opts.bondLineWidth = 2
        rdMolDraw2D.PrepareAndDrawMolecule(drawer, mol)
        drawer.FinishDrawing()
        try:
            with Image.open(io.BytesIO(drawer.GetDrawingText())) as im:
                im.convert("RGB").save(OUT / f"{drug_id}.webp", "WEBP", quality=QUALITY, method=6)
            ok += 1
        except OSError:
            bad += 1
    files = list(OUT.glob("*.webp"))
    size = sum(f.stat().st_size for f in files) / 1024 / 1024
    print(f"rendered {ok} · unparseable {bad} · struct 总数 {len(files)} / {size:.1f} MB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
