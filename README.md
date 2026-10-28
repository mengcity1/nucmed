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

## Deploy elsewhere (self-hosting / institutional platform)

This is a **pure static site** — no backend, no database connection at runtime. The
build output in `dist/` can be served from any static host.

```bash
npm run build      # → dist/
```

### Sub-path deployment

If the site will live under a sub-path (e.g. `https://data.example.edu.cn/nucmed/`),
set `VITE_BASE` before building so all asset URLs are prefixed correctly:

```powershell
$env:VITE_BASE = "/nucmed/"      # PowerShell
npm run build
```

```bash
VITE_BASE=/nucmed/ npm run build  # bash
```

Default (variable unset) is `base = "/"`, which is correct for:
- GitHub Pages **user/organization** sites (`user.github.io`)
- Netlify / Vercel / any dedicated domain
- local `npm run dev` / `npm run preview`

### SPA fallback (must be configured on the host)

`react-router` uses client-side routes (`/drug/322`). Every host needs a rewrite to
`index.html`, otherwise a direct visit returns 404:

| Host | Already provided |
|---|---|
| GitHub Pages | `dist/404.html` (emitted automatically by `npm run build`) |
| Netlify / Cloudflare Pages | `public/_redirects` (`/*  /index.html  200`) |
| Vercel | `vercel.json` (`rewrites`) |
| nginx | `try_files $uri $uri/ /index.html;` |
| Apache | `FallbackResource /index.html` |

## License

- **Code**: MIT (see `LICENSE`)
- **Data**: CC BY-NC 4.0 (see `LICENSE`)

Underlying sources: PubMed / PMC (per-article licenses), FDA drug labels (public
domain), radiopharm.idrblab.cn (ligand structures).
