# Natura 2000 – Greece

Three independent projects that turn the official Greek Natura 2000 dataset into an interactive map:

```
 YPEN WFS ─┐
 Wikidata ─┼─► etl/  ──►  data/natura.db  ──►  api/ (FastAPI)  ──►  web/ (React + Leaflet)
 geoBoundaries ┘          (SQLite file)        /api/*  JSON            browser
```

| Project | Stack | Role |
|---|---|---|
| [`etl/`](etl) | Python, requests, shapely, pyproj, sqlite3 | Fetches online data, transforms it, loads `data/natura.db` |
| [`api/`](api) | FastAPI, uvicorn | Read-only HTTP API over the database |
| [`web/`](web) | React, TypeScript, Vite, Leaflet (react-leaflet) | Map UI |

The only contract between ETL and API is the SQLite file (default `data/natura.db`, override with `NATURA_DB_PATH`). `data/` is git-ignored: regenerate it with the ETL.

## Quick start

Requirements: Python 3.10+, Node 18+. Run each step in its own terminal from the repo root (PowerShell shown; use `source .venv/bin/activate` on Linux/macOS).

```powershell
# 1. ETL – build the database (takes ~2 min, downloads ~60 MB)
cd etl
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m natura_etl

# 2. API – http://localhost:8000  (docs at /docs)
cd ..\api
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --port 8000

# 3. Frontend – http://localhost:5173
cd ..\web
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:8000` (override with `VITE_PROXY_TARGET`).

## 1. ETL (`etl/`)

`python -m natura_etl [--db PATH] [--use-cache] [-v]`

`--use-cache` reuses downloads in `data/raw/` (git-ignored) instead of fetching again. Each run is a full refresh.

### Sources

| Data | Source | Notes |
|---|---|---|
| Site polygons (446) | YPEN geoportal WFS `http://geoportal.ypen.gr/geoserver/ows`, layer `ps:PS.ProtectedSitesNatura2000` | Licence CC BY-SA 4.0 (Ministry of Environment & Energy). Served in **EPSG:2100** (GGRS87), not ETRS89 as the metadata claims. The WFS advertised in the catalogue metadata (`/geoserver/ps_natura2000/ows`) is broken. Fields: `sitecode`, `sitetype` (SCI/SPA/SCISPA), `objectid`, `shape_leng`, `shape_area`. |
| Site names | Wikidata SPARQL, property P3425 (Natura 2000 site ID) | The geoportal has no names. 416 of 446 sites have a name; 4 codes map to several items (the labelled one with the lowest Q-id is kept, `wikidata_ambiguous = 1`). |
| Regions | geoBoundaries `gbOpen/GRC/ADM2` (CC BY 4.0) | 13 regions + Agion Oros. A coarse 2016 boundary, so land/sea splits are approximate. |

Catalogue record: `http://geoportal.ypen.gr/geonetwork/srv/eng/catalog.search#/metadata/c140c8d2-3820-4847-bfdc-1d6668d66325` (an AngularJS app; fetch it via CSW `GetRecordById` instead).

### Pipeline (`natura_etl/`)

| Module | Step |
|---|---|
| `extract.py` | HTTP downloads + optional cache |
| `transform.py` | Repair invalid geometries; area (km²) and perimeter in the metric CRS; reproject to WGS84 (EPSG:4326); simplify (150 m sites, 300 m regions) with coordinates snapped to ~1 m; assign regions by spatial overlap; land share; per-region and network-wide coverage from **dissolved** geometries (so overlapping SCI/SPA are not double counted) |
| `load.py` | Creates schema and replaces all data in a single transaction; readers never see a half-loaded DB |
| `pipeline.py`, `cli.py` | Orchestration; **validation runs before the DB is touched** (≥ 400 sites, unique codes, known types, non-empty geometry, centroids inside Greece) |

Tests: `cd etl; pytest`.

### Database schema (SQLite)

- `sites` – `sitecode` (PK), `objectid`, `sitetype`, `name_en`, `name_el`, `wikidata`, `wikidata_ambiguous`, `perimeter_km`, `area_km2`, `land_share_pct`, `region_primary`, `centroid_lon/lat`, `min/max_lon/lat` (bbox), `geom_simplified`, `geom_full` (GeoJSON text, WGS84)
- `site_regions` – `sitecode`, `region`, `overlap_km2` (a site can span several regions)
- `regions` – `name` (PK), `area_km2`, `protected_km2`, `protected_pct`, `n_sites`, `geometry` (simplified GeoJSON)
- `stats` – key/value: `greece_land_km2`, `network_km2`, `network_land_km2`, `network_land_pct`, `sci_km2`, `spa_km2`, `sci_spa_overlap_km2`, `sum_of_site_areas_km2`
- `etl_runs` – one row per run (time, source, counts)

Reference values after a run: 446 sites (239 SCI, 181 SPA, 26 SCISPA), network 58,773 km², 27.4 % of Greek land. Summing site areas gives 72,524 km², which double counts overlaps.

## 2. API (`api/`)

Start: `uvicorn app.main:app --port 8000` (interactive docs: `/docs`). Read-only; opens the DB with `mode=ro`. Returns **503** if the DB does not exist. Responses are gzip-compressed.

Environment: `NATURA_DB_PATH`, `CORS_ORIGINS` (comma separated, default `http://localhost:5173`).

| Endpoint | Description |
|---|---|
| `GET /api/health` | `{status, sites}` |
| `GET /api/sites` | Paged list, no geometry. Filters: `type` (repeatable: SCI, SPA, SCISPA), `region`, `q` (code/name search), `min_area`, `max_area` (km²), `bbox=west,south,east,north`. Paging/sorting: `limit` (1–1000, default 100), `offset`, `sort` (name/area/code), `order`. Returns `{total, limit, offset, items}` |
| `GET /api/sites/geojson` | FeatureCollection with **simplified** geometries; same filters as `/api/sites`. Used by the map |
| `GET /api/sites/{code}` | One Feature with properties (incl. `regions` and overlap area). `?geometry=full` (default) `simplified` `none`. 404 if unknown |
| `GET /api/regions` | Region FeatureCollection with `area_km2`, `protected_km2`, `protected_pct`, `n_sites` |
| `GET /api/stats` | Counts and areas by type, network coverage numbers, last ETL run |

Example: `curl "http://localhost:8000/api/sites?type=SPA&region=Kritis&sort=area&order=desc&limit=5"`

Tests: `cd api; pytest` (uses a temporary fixture DB built from the ETL schema).

## 3. Frontend (`web/`)

React + TypeScript + Vite, map with Leaflet via `react-leaflet`.

- Map of all sites coloured by type (SCI blue, SPA orange, SCISPA green), with hover tooltips
- Type toggles, name/code search, region filter, sortable site list
- Click a site (map or list): fetches full geometry from the API, highlights and zooms to it, shows details
- Optional choropleth of the protected share per region
- Header with network totals from `/api/stats`

Configuration: the API base URL is `/api` (proxied in dev). For a separate host set `VITE_API_URL=https://host/api` at build time and add the frontend origin to `CORS_ORIGINS`.

`npm run build` type-checks and builds to `web/dist` (serve with any static server; `npm run preview` to try it, which needs `VITE_API_URL` pointing to the API).

## Attribution

Site data © Ministry of Environment and Energy (ΥΠΕΝ), CC BY-SA 4.0. Names from Wikidata (CC0). Regions from geoBoundaries (CC BY 4.0). Base map © OpenStreetMap contributors.
