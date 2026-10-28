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

## Deploy to Google Cloud Run

The GitHub Actions workflow in `.github/workflows/deploy-cloud-run.yml` deploys the app as one public Cloud Run service. FastAPI serves both the built frontend and `/api/*` from the same origin. On each push to `main`, the workflow regenerates `data/natura.db`, builds and pushes a container image to Artifact Registry, and deploys a new Cloud Run revision. The database is read-only at runtime and bundled into that image; do not rely on container filesystem writes for persistence. The service scales to zero when idle and is capped at three instances to limit unexpected scale-out; adjust `--max=3` in the workflow if your traffic requirements change.

### Cost and traffic controls

For a small public map, Cloud Run's request-based pricing and scale-to-zero can keep compute costs low, often within the monthly free tier. The current published free tier includes 2 million requests, 180,000 vCPU-seconds, and 360,000 GiB-seconds per month (aggregated across projects on a billing account). Usage beyond that is billed. This is not a guaranteed $0 cap: outbound internet data transfer, Artifact Registry storage, and GitHub Actions usage may also cost money. Prices vary by Cloud Run region and visitors' destinations; use the [Cloud Run pricing page](https://cloud.google.com/run/pricing) and [Google Cloud pricing calculator](https://cloud.google.com/products/calculator) for your region.

The map downloads three API responses when it opens. With the current bundled database and gzip responses, these are approximately 413 KiB per page load (about 0.4 GiB for 1,000 loads or 4 GiB for 10,000 loads). This is an estimate based on a local build; actual transferred bytes vary. Google Cloud charges for internet egress according to region and destination. The OpenStreetMap tile requests are made directly by each visitor's browser to the tile service, not proxied through Cloud Run, so they do not add Google Cloud egress charges. ETL source downloads happen during GitHub Actions deployments, not on visitor requests.

The workflow's three-instance maximum is the low-friction cost guardrail. It limits ordinary autoscaling, but Google notes that a maximum can be exceeded briefly during spikes. You can lower the cap or set it on the service directly:

```sh
gcloud run services update YOUR_SERVICE --region=YOUR_REGION --min=0 --max=1
```

Create a monthly [Cloud Billing budget and email alerts](https://cloud.google.com/billing/docs/how-to/budgets) as an additional safeguard. Budget alerts monitor spend; they do **not** automatically stop service or cap charges.

A per-IP request limiter inside the app would not provide a reliable global limit across multiple Cloud Run instances, and requests still incur some Cloud Run cost before the limiter responds. Edge rate limiting with Cloud Armor requires an external Application Load Balancer and adds cost and setup. Since this app makes no paid server-side outbound requests per visitor, the instance cap, scale-to-zero, and budget alerts are a better starting point. Consider Cloud Armor only if you later need protection from abusive traffic and its added load-balancer cost is justified.

### One-time Google Cloud setup

Choose a Google Cloud project and region, then enable the required APIs and create a Docker Artifact Registry repository:

```sh
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com artifactregistry.googleapis.com iamcredentials.googleapis.com sts.googleapis.com
gcloud artifacts repositories create natura-map \
  --repository-format=docker \
  --location=YOUR_REGION
```

Create a dedicated deployer service account and a separate, permission-free runtime service account:

```sh
gcloud iam service-accounts create github-cloud-run-deployer
gcloud iam service-accounts create natura-map-runtime
```

Create a Workload Identity Federation pool and OIDC provider for GitHub Actions. Restrict the provider to this repository's `main` branch:

```sh
gcloud iam workload-identity-pools create github-actions \
  --location=global \
  --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc github \
  --location=global \
  --workload-identity-pool=github-actions \
  --display-name="Natura map deploy" \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository == 'dodosiz/natura-map-greece' && assertion.ref == 'refs/heads/main'"
```

Allow only this repository's federated identity to impersonate the deployer account. Substitute your project number and service-account email:

```sh
PROJECT_NUMBER="$(gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)')"
DEPLOYER="github-cloud-run-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com"
RUNTIME="natura-map-runtime@YOUR_PROJECT_ID.iam.gserviceaccount.com"

gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-actions/attribute.repository/dodosiz/natura-map-greece"
```

Grant the deployer permission to push to the image repository, deploy the Cloud Run service, and attach its runtime identity. These project-level Cloud Run permissions allow the workflow to make the service publicly invokable:

```sh
gcloud artifacts repositories add-iam-policy-binding natura-map \
  --location=YOUR_REGION \
  --member="serviceAccount:${DEPLOYER}" \
  --role=roles/artifactregistry.writer
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:${DEPLOYER}" \
  --role=roles/run.admin
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:${DEPLOYER}" \
  --role=roles/serviceusage.serviceUsageConsumer
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME" \
  --member="serviceAccount:${DEPLOYER}" \
  --role=roles/iam.serviceAccountUser
```

### Configure GitHub and deploy

In the repository's **Settings → Secrets and variables → Actions → Variables**, add:

| Variable | Value |
|---|---|
| `GCP_PROJECT_ID` | Google Cloud project ID |
| `GCP_REGION` | Cloud Run and Artifact Registry region, e.g. `europe-west1` |
| `GCP_ARTIFACT_REGISTRY_REPOSITORY` | Artifact Registry repository name, e.g. `natura-map` |
| `CLOUD_RUN_SERVICE` | Cloud Run service name, e.g. `natura-map` |
| `GCP_WIF_PROVIDER` | Full provider resource name, e.g. `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions/providers/github` |
| `GCP_WIF_SERVICE_ACCOUNT` | Deployer service-account email |
| `GCP_RUNTIME_SERVICE_ACCOUNT` | Runtime service-account email |

No service-account key or other GitHub secret is needed. Push or merge to `main` to deploy. The first run creates the service; subsequent runs publish a new image and revision. The build downloads source datasets to regenerate the database, so upstream sources must be reachable by the GitHub-hosted runner.

After the workflow succeeds, open the service URL from its deployment summary and check that the map loads. You can also check `https://YOUR_SERVICE_URL/api/stats`. Each deployment refreshes the bundled dataset; no separate database migration or volume is used.

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

Search metadata and localized page descriptions are provided for Greek and English, with a crawler-readable HTML fallback, `public/robots.txt`, and `public/sitemap.xml`.

Configuration: the API base URL is `/api` (proxied in dev). For a separate host set `VITE_API_URL=https://host/api` at build time and add the frontend origin to `CORS_ORIGINS`.

`npm run build` type-checks and builds to `web/dist` (serve with any static server; `npm run preview` to try it, which needs `VITE_API_URL` pointing to the API).

## Privacy (GDPR / ePrivacy)

Location is personal data. The location feature is opt-in: nothing is requested until the visitor clicks "Where am I?" and grants the browser permission, which can be withdrawn at any time (stop button or browser settings). The position is processed only in the browser to compare it with the already downloaded site polygons; it is **not** sent to the API or any server, logged, stored, or put in cookies/localStorage. The UI states this next to the button. Note that map tiles are requested from OpenStreetMap when the map pans to the position, which exposes the viewed tile area (not the exact coordinates) and the visitor's IP address to that service.

In production, Cloud Run automatically writes request logs to Google Cloud Logging. These may contain visitors' IP addresses and technical request metadata, but not the browser-only geolocation coordinates. Log retention and storage location depend on the Google Cloud project configuration. The public [privacy policy](https://natura-map.gr/privacy) and [imprint](https://natura-map.gr/imprint) describe the site's current processing. If analytics, coordinate logging, or server-side location processing is introduced, update both the notice and this section, and assess the required legal basis. Geolocation requires a secure context (HTTPS, or localhost).

## Data attribution and licensing

The original project code in this repository is licensed under the MIT License; see [LICENSE](LICENSE). That license does not apply to third-party data, libraries, or services. Each data source retains its own license:

- Natura 2000 site polygons: © Ministry of Environment and Energy (ΥΠΕΝ), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The project reprojects and simplifies geometries and computes areas, perimeters, and coverage statistics from them. Those adaptations must be credited as modified; the source license applies to adaptations of this dataset.
- Site labels: [Wikidata property P3425](https://www.wikidata.org/wiki/Property:P3425); structured data is available under [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
- Administrative boundaries: [geoBoundaries](https://www.geoboundaries.org/), CC BY 4.0. Its web-use guidance asks for prominent linked credit.
- Base map tiles: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), [ODbL](https://opendatacommons.org/licenses/odbl/1-0/). The site uses the standard OSM tile service; follow its [tile usage policy](https://operations.osmfoundation.org/policies/tiles/).

Third-party libraries and applications retain their own licenses and terms; see the dependency manifests and lockfiles for the packages used by this project. The MIT License does not grant rights to those dependencies or external services. The map is for orientation only; check official boundaries and decisions with the competent Greek authorities.
