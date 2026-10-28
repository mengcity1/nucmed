# NucMed DB

Traceable radiopharmaceutical biodistribution resource with organ-level uptake,
PMID anchors, FDA-label dosimetry, and a reproducible benchmark.

Static React site (Vite + ECharts), no backend: every figure on the site is served
from pre-exported JSON under `public/data/`.

## What is in here

| Layer | Count | Source |
|---|---|---|
| Biodistribution points | 3,875 | PubMed / PMC full text & tables |
| Drugs with biodistribution data | 861 (of 5,159 catalogued) | — |
| Organ classes | 32 | — |
| Dosimetry records | 403 (35 drugs, 21 organs) | FDA approved drug labels |
| Structure images | 2,229 whole-drug + 1,703 fragments | radiopharm.idrblab.cn / RDKit |

Every biodistribution point keeps its **raw text snippet** and **PMID**, so each
number can be traced back to the sentence or table cell it came from.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
```

## Build

```bash
npm run build      # → dist/  (also emits 404.html for SPA fallback)
npm run preview
```

## Re-export data from the database

The site reads only exported JSON. To regenerate after the SQLite database changes:

```bash
python web/scripts/export_data.py     # run from the repository root of the DB project
```

## Layout

```
src/                 React app (3 pages: overview / drug detail / about)
  pages/Home.tsx       drug list + filters + coverage metrics
  pages/DrugDetail.tsx per-drug profile (biodistribution, dosimetry, TBR, refs)
  pages/About.tsx      license, citation, data availability
scripts/             export & structure-rendering scripts (Python)
public/data/         exported JSON (site data source)
public/struct/       whole-drug structures (WebP)
public/parts/        chelator / linker / vector fragments (PNG)
```

## License

- **Code**: MIT (see `LICENSE`)
- **Data**: CC BY-NC 4.0 (see `LICENSE`)

Underlying sources: PubMed / PMC (per-article licenses), FDA drug labels (public
domain), radiopharm.idrblab.cn (ligand structures).
