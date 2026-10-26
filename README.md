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
| Site polygons (446) | [YPEN geoportal WFS](http://geoportal.ypen.gr/geoserver/ows), layer `ps:PS.ProtectedSitesNatura2000` | Ministry of Environment & Energy data, CC BY-SA 4.0. Served in **EPSG:2100** (GGRS87), not ETRS89 as the metadata claims. The WFS advertised in the catalogue metadata (`/geoserver/ps_natura2000/ows`) is broken. Fields: `sitecode`, `sitetype` (SCI/SPA/SCISPA), `objectid`, `shape_leng`, `shape_area`. |
| Site names | [Wikidata](https://www.wikidata.org/wiki/Property:P3425) SPARQL, property P3425 (Natura 2000 site ID) | Structured data is dedicated to the public domain under CC0. The geoportal has no names. 416 of 446 sites have a name; 4 codes map to several items (the labelled one with the lowest Q-id is kept, `wikidata_ambiguous = 1`). |
| Regions | [geoBoundaries](https://www.geoboundaries.org/) `gbOpen/GRC/ADM2` (CC BY 4.0) | 13 regions + Agion Oros. A coarse 2016 boundary, so land/sea splits are approximate. geoBoundaries requests prominent credit and a link on web products. |

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
- `regions` – `name` (PK), `name_el`, `name_en`, `area_km2`, `protected_km2`, `protected_pct`, `n_sites`, `geometry` (simplified GeoJSON)
- `stats` – key/value: `greece_land_km2`, `network_km2`, `network_land_km2`, `network_land_pct`, `sci_km2`, `spa_km2`, `sci_spa_overlap_km2`, `sum_of_site_areas_km2`
- `etl_runs` – one row per run (time, source, counts)

Reference values after a run: 446 sites (239 SCI, 181 SPA, 26 SCISPA), network 58,773 km², 27.4 % of Greek land. Summing site areas gives 72,524 km², which double counts overlaps.

## 2. API (`api/`)

Start: `uvicorn app.main:app --port 8000` (interactive docs: `/docs`). Read-only; opens the DB with `mode=ro`. Returns **503** if the DB does not exist. Responses are gzip-compressed.

Environment: `NATURA_DB_PATH`, `CORS_ORIGINS` (comma separated, default `http://localhost:5173`).

| Endpoint | Description |
|---|---|
| `GET /api/sites/geojson` | All sites as a FeatureCollection with **simplified** geometries and properties (`sitecode`, `sitetype`, names, `area_km2`, `land_share_pct`, `region_primary`) |
| `GET /api/regions` | Region FeatureCollection with `area_km2`, `protected_km2`, `protected_pct`, `n_sites` |
| `GET /api/stats` | Counts and areas by type, network coverage numbers, last ETL run |

These are exactly the endpoints the frontend uses. Example: `curl http://localhost:8000/api/stats`

Tests: `cd api; pytest` (uses a temporary fixture DB built from the ETL schema).

## 3. Frontend (`web/`)

React + TypeScript + Vite, map with Leaflet via `react-leaflet`.

- Map of all sites coloured by type (SCI blue, SPA orange, SCISPA green), with hover tooltips
- Header with network totals from `/api/stats`
- Checkboxes for SCI, SPA, SCI + SPA and an optional choropleth of the protected share per region
- An **info (i) button** next to the title explaining Natura 2000, SCI, SPA and what they mean for construction and other activities (text in `src/InfoButton.tsx`; sources: European Commission Natura 2000, Habitats and Birds Directive pages)
- A **"Where am I?" button** that asks the browser for permission to use the visitor's location (Geolocation API, only after the click). With permission, the position is shown on the map and a status line shows 🟢 in a Natura 2000 area, 🔴 not in one, or ⚪ no current location data (before consent, if denied, or unavailable). The point-in-polygon check (`src/geo.ts`) uses the simplified site geometries, so it is approximate near borders and has no legal force.

Configuration: the API base URL is `/api` (proxied in dev). For a separate host set `VITE_API_URL=https://host/api` at build time and add the frontend origin to `CORS_ORIGINS`.

`npm run build` type-checks and builds to `web/dist` (serve with any static server; `npm run preview` to try it, which needs `VITE_API_URL` pointing to the API).

## Privacy (GDPR / ePrivacy)

Location is personal data. The location feature is opt-in: nothing is requested until the visitor clicks "Where am I?" and grants the browser permission, which can be withdrawn at any time (stop button or browser settings). The position is processed only in the browser to compare it with the already downloaded site polygons; it is **not** sent to the API or any server, logged, stored, or put in cookies/localStorage. The UI states this next to the button. Note that map tiles are requested from OpenStreetMap when the map pans to the position, which exposes the viewed tile area (not the exact coordinates) and the visitor's IP address to that service. If you add analytics, logging of coordinates, or server-side location processing, update this section and obtain a legal basis and a privacy notice. Geolocation requires a secure context (HTTPS, or localhost).

## Data attribution and licensing

The original project code in this repository is licensed under the MIT License; see [LICENSE](LICENSE). That license does not apply to third-party data, libraries, or services. Each data source retains its own license:

- Natura 2000 site polygons: © Ministry of Environment and Energy (ΥΠΕΝ), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The project reprojects and simplifies geometries and computes areas, perimeters, and coverage statistics from them. Those adaptations must be credited as modified; the source license applies to adaptations of this dataset.
- Site labels: [Wikidata property P3425](https://www.wikidata.org/wiki/Property:P3425); structured data is available under [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
- Administrative boundaries: [geoBoundaries](https://www.geoboundaries.org/), CC BY 4.0. Its web-use guidance asks for prominent linked credit.
- Base map tiles: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), [ODbL](https://opendatacommons.org/licenses/odbl/1-0/). The site uses the standard OSM tile service; follow its [tile usage policy](https://operations.osmfoundation.org/policies/tiles/).

Third-party libraries and applications retain their own licenses and terms; see the dependency manifests and lockfiles for the packages used by this project. The MIT License does not grant rights to those dependencies or external services. The map is for orientation only; check official boundaries and decisions with the competent Greek authorities.
