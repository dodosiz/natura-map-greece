# data-greece – Natura 2000 Greece

Analysis of the Greek Natura 2000 protected sites (Habitats + Birds Directives).
Analysis report: [natura-data-report.md](natura-data-report.md).

**`natura-data/` is git-ignored** – it holds only downloaded or derived data. Recreate it with the steps below.
This README is the guide for future (LLM) sessions: where the data comes from, how to fetch it, and the pitfalls already found.

## 1. Setup (Windows / PowerShell)

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:PYTHONIOENCODING = 'utf-8'   # scripts print Greek text
```

## 2. Regenerate the data (in this order)

| Step | Command | Produces (in `natura-data/`) |
|---|---|---|
| 1 | `python download_natura.py` | `natura2000_gr_raw_epsg2100.geojson` (raw WFS), `natura2000_gr.gpkg` (layer `sites`), `DOWNLOAD_INFO.txt` |
| 2 | `python enrich_natura.py` | `natura2000_gr_enriched.gpkg` (layer `sites_enriched`), `natura2000_gr_enriched.csv`, `boundaries/` cache |

Optional – the catalogue metadata (ISO 19139/INSPIRE) that started the project:

```powershell
curl.exe -o natura-data\metadata.xml "http://geoportal.ypen.gr/geonetwork/srv/eng/csw?service=CSW&version=2.0.2&request=GetRecordById&id=c140c8d2-3820-4847-bfdc-1d6668d66325&elementSetName=full&outputSchema=http://www.isotc211.org/2005/gmd"
```

Catalogue page (JavaScript app, not scrapable): `http://geoportal.ypen.gr/geonetwork/srv/eng/catalog.search#/metadata/c140c8d2-3820-4847-bfdc-1d6668d66325`

## 3. Data sources

| What | Source | Notes |
|---|---|---|
| Site boundaries | YPEN geoportal WFS `http://geoportal.ypen.gr/geoserver/ows`, WFS **2.0.0**, layer `ps:PS.ProtectedSitesNatura2000` | Used by `download_natura.py`. Outputs: `application/json`, `SHAPE-ZIP`, `csv`, GML, KML. CRS **EPSG:2100**. |
| Site names | Wikidata SPARQL, property **P3425** (Natura 2000 site ID) | Stand-in for the EEA database (see pitfalls). 30 of 446 sites unlabelled. |
| Regions | geoBoundaries API `https://www.geoboundaries.org/api/current/gbOpen/GRC/{ADM1,ADM2}/` | 2016, generalised, CC BY 4.0. ADM2 = 13 regions + Mount Athos. |
| Authoritative names/habitats/species (not yet used) | EEA *Natura 2000 (tabular) end 2024 rev.01*: `https://www.eea.europa.eu/en/datahub/datahubitem-view/6fc8ad2d-195d-40f4-bdec-576e7d1268e4` | Download CSVs manually, join on `SITECODE` = `sitecode`. Also the EEA vector (SHP/GPKG, EPSG:3035). |

Licence of the Greek data: CC BY-SA 4.0 (source: Ministry for Environment and Energy, ΥΠΕΝ). Keep attribution and share-alike.

## 4. Layer schema (`ps:PS.ProtectedSitesNatura2000`)

`objectid` (int), `sitecode` (e.g. `GR1110003`, unique), `sitetype` (`SCI` | `SPA` | `SCISPA`), `shape_leng` (m), `shape_area` (m²), `geom` (MultiPolygon, EPSG:2100).
446 features: 239 SCI, 181 SPA, 26 SCISPA. SCI and SPA polygons overlap – dissolve before summing areas.

Enriched extra columns: `area_km2`, `geom_valid`, `name_en`, `name_el`, `wikidata`, `wikidata_ambiguous`, `region_primary/_all/_count`, `decentr_admin_primary/_all/_count`, `land_share_pct`, `outside_land_boundary`.

## 5. Pitfalls already discovered

- The WFS advertised in the metadata (`.../geoserver/ps_natura2000/ows`, type `ProtectedSite`) returns an empty feature-type list – **do not use it**; use the global `/geoserver/ows` endpoint above.
- The metadata says ETRS89 / 1:100 000, but the actual layer is EPSG:2100 (GGRS87). Use EPSG:2100 or 3035 for areas, 4326 for web maps.
- EEA services block automation: `bio.discomap.eea.europa.eu` ArcGIS returned 502, `natura2000.eea.europa.eu` SDF pages 403, the `sdi.eea.europa.eu` WebDAV share has no direct file links.
- Windows PowerShell mangles UTF-8 output; use `PYTHONIOENCODING=utf-8`, and read `index.csv`/`info.xml` as UTF-8.
- Metadata abstract says 244 SCI + 202 SPA; the layer has 265 SCI-designated (239+26) and 207 SPA-designated (181+26) sites.
- Other related YPEN WFS layers (same endpoint): `ps:PS.NationallyDesignatedAreasCDDA`, `hb:HB.HabitatsDistrGrid`, `sd:SD.BirdsDistrGrid`, `hb:HB.HabitatsRangeGrid`, `sd:SD.BirdsRangeGrid`, flood/SEVESO/wastewater layers (list via `GetCapabilities`).

## 6. Analysis

`python analyze_natura.py` (needs the enriched file from step 2) writes tables and maps to `natura-data/analysis/`. Results are summarised in section 11 of [natura-data-report.md](natura-data-report.md).

`python map_natura.py` builds the interactive map `natura-data/analysis/natura_map.html` (layers per site type, hover tooltips, region-coverage choropleth; needs the output of `analyze_natura.py`).
