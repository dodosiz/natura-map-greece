# Natura 2000 Greece – Dataset Analysis & Next Steps

## 1. TL;DR

- The `natura-data` folder contains **only the GeoNetwork metadata export** (ISO 19139 XML + index files). The `public/` and `private/` folders are **empty** – there are **no geometries or attribute tables** locally.
- The real data is served by the Ministry's (ΥΠΕΝ) **OGC web services** (WFS/WMS). I queried the live WFS and found it contains **446 Natura 2000 sites** (polygons) with a very simple attribute table (5 fields + geometry).
- The data can be downloaded as GeoJSON / Shapefile / CSV / GML via WFS and analysed with Python (GeoPandas) or QGIS.

## 2. What is in `natura-data`

| File | Content |
|---|---|
| `index.csv`, `index.html` | GeoNetwork export index: 1 record, UUID `c140c8d2-3820-4847-bfdc-1d6668d66325`, local id 341 |
| `<uuid>/info.xml` | Record info: created 2022-02-24, last changed 2023-04-03, public view/download allowed |
| `<uuid>/metadata/metadata.xml` | Full ISO 19139 / INSPIRE metadata (the useful part) |
| `<uuid>/public/`, `<uuid>/private/` | Empty – no attachments were exported |

Note: `index.csv`/`info.xml` show mojibake (e.g. `â€“`) when read in a non-UTF-8 tool; the files are UTF-8, open them with UTF-8 encoding.

## 3. Metadata summary (from the catalog record)

- **Title:** [INSPIRE] Προστατευόμενες τοποθεσίες NATURA 2000 / Protected Sites – Natura 2000
- **Dataset ID:** `http://nsdi.gov.gr/set/dataset/MINENV/ps_Natura2000`
- **Content:** boundaries of Special Areas of Conservation / SCI (Habitats Directive 92/43/EEC – 244 sites per the abstract) and Special Protection Areas / SPA (Birds Directive 2009/147/EC – 202 sites). Includes areas designated nationally but still awaiting EU adoption (2018 delivery).
- **Owner:** ΥΠΕΝ – Τμήμα Προστατευόμενων Περιοχών; **Provider:** Ministry for Environment and Energy (`eygep.support@prv.ypeka.gr`).
- **Type / scale:** vector, equivalent scale **1:100 000**; topic category *environment*.
- **Reference system (metadata):** ETRS89 (EPSG:4258). *The actual WFS “AS-IS” layer is delivered in **EPSG:2100 (GGRS87 / Greek Grid)** – see §5.*
- **Bounding box:** W 17.77, E 30.75, S 33.14, N 41.77.
- **Lineage:** polygons updated by the Hellenic Cadastre (base survey 1999–2001), using 1:5000 orthophotos plus field sampling; harmonised to INSPIRE by the Ministry's Geospatial Information Directorate.
- **Conformity:** INSPIRE Regulation 1089/2010 and Protected Sites data specification (D2.8.I.9, GML app schema 3.2rc1) – conformant.
- **Access/licence:** no public-access limitations; use under **CC BY-SA 4.0** (stated as not officially approved by an administrative act → attribute the source and share-alike).
- **Online resources:**
  - WMS: `http://geoportal.ypen.gr/geoserver/natura-wms/ows?service=wms&version=1.3.0&request=GetCapabilities` (layer `PS.ProtectedSite`)
  - WFS (INSPIRE): `http://geoportal.ypen.gr/geoserver/ps_natura2000/ows?` (declared type `ps_natura2000:ProtectedSite`)
  - CSW: `http://geoportal.ypen.gr/geonetwork/srv/eng/csw?SERVICE=CSW&VERSION=2.0.2&REQUEST=GetCapabilities`

## 4. Fetching the website

The catalog page is an AngularJS single-page app; fetching it returns only the HTML shell, so the information on it is equivalent to (and best obtained from) the local `metadata.xml`. I therefore went to the underlying services listed in the metadata.

## 5. The actual data (queried live from the WFS)

**Findings about the services**

- The advertised INSPIRE WFS (`ps_natura2000/ows`, WFS 1.1.0) returns an **empty FeatureTypeList** and rejects `ProtectedSite` requests (“Feature type unknown”) – it appears **misconfigured / not usable** at the time of testing.
- The **global endpoint works**: `http://geoportal.ypen.gr/geoserver/ows` (WFS 2.0.0), layer **`ps:PS.ProtectedSitesNatura2000`** (“[AS-IS] Protected sites Natura 2000”). Supported output formats: GeoJSON, Shapefile (`SHAPE-ZIP`), CSV, KML, GML 2/3/3.2.

**Schema** (`ps:PS.ProtectedSitesNatura2000`)

| Field | Type | Meaning |
|---|---|---|
| `objectid` | int | Row id |
| `sitecode` | string | Official Natura 2000 code, e.g. `GR1110003` (unique, no nulls) |
| `sitetype` | string | `SCI`, `SPA` or `SCISPA` (both designations) |
| `shape_leng` | decimal | Perimeter, in **metres** |
| `shape_area` | decimal | Area, in **m²** |
| `geom` | MultiSurface | MultiPolygon, **EPSG:2100** (GGRS87 / Greek Grid) |

**Content statistics (computed from the live attribute table)**

- **446 features**, 446 unique `sitecode`s, no null attributes, all start with `GR`.
- By type:

| sitetype | Sites | Total area (km²) | Median site (km²) | Largest (km²) |
|---|---|---|---|---|
| SCI (Habitats) | 239 | ≈ 33 874 | ≈ 67 | ≈ 2 366 |
| SPA (Birds) | 181 | ≈ 33 087 | ≈ 119 | ≈ 1 606 |
| SCISPA (both) | 26 | ≈ 5 563 | ≈ 66 | ≈ 2 492 |

  Summing these double-counts overlaps (SCI and SPA polygons overlap heavily), so **do not add them** to get the protected surface; dissolve first.
- Sites per region prefix (`sitecode[2:4]`, matches the old EL NUTS-2 style numbering used in Greek Natura codes): GR42 62, GR43 54, GR12 52, GR11 37, GR23 34, GR24 32, GR25 32, GR14 30, GR41 29, GR21 27, GR22 22, GR13 18, GR30 17.
  > Interpretation of the digits is an assumption (they follow the Greek NUTS-2 administrative-region numbering); verify against the official Natura 2000 standard data form.

**Gaps / caveats**

- No site **names**, designation dates, habitat/species lists, management bodies or regions as columns – only code, type and shape metrics. Names and ecological content come from the **EEA Natura 2000 end-user database** (NATURA2000_end20XX.sqlite/CSV) joined on `SITECODE`.
- The abstract says 244 SCI + 202 SPA ≈ 446 *sites*; the layer has 446 *features* that include 26 combined `SCISPA` ones, so SCI+SCISPA = 265 and SPA+SCISPA = 207. Counts therefore differ from the abstract (extra/pending sites, newer update) – reconcile before quoting figures.
- Metadata says ETRS89 / scale 1:100 000 but the layer is EPSG:2100 – reproject (e.g. to EPSG:4326 or 3035) before combining with other datasets; use an equal-area CRS (EPSG:3035 or 2100) for area work.
- Layer is labelled **AS-IS**; the INSPIRE-harmonised version (`ProtectedSite`) was unreachable through the WFS.
- Metadata last changed 2023-04-03; the dataset itself may be newer or older – check the layer's `timeStamp`/update date.

## 6. How to get the data

```text
GeoJSON (reprojected to WGS84):
http://geoportal.ypen.gr/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=ps:PS.ProtectedSitesNatura2000&outputFormat=application/json&srsName=EPSG:4326

Shapefile:   ...&outputFormat=SHAPE-ZIP
Attributes only (CSV, no geometry): ...&outputFormat=csv&propertyName=objectid,sitecode,sitetype,shape_leng,shape_area
```

Python:

```python
import geopandas as gpd
url = ("http://geoportal.ypen.gr/geoserver/ows?service=WFS&version=2.0.0"
       "&request=GetFeature&typeNames=ps:PS.ProtectedSitesNatura2000"
       "&outputFormat=application/json")
gdf = gpd.read_file(url)          # EPSG:2100
gdf.to_file("natura-data/natura2000_gr.gpkg", layer="sites", driver="GPKG")
```

## 7. What you can analyse

1. **Coverage:** total protected area per type (after `dissolve`), share of Greece's land + marine area (needs Greek coastline/boundary, e.g. GADM / Natural Earth / ELSTAT / Geoportal admin boundaries; split land vs. sea).
2. **Distribution:** number/size of sites per region/prefecture/municipality (spatial join with administrative boundaries); size distribution (many tiny, a few huge).
3. **Overlap:** SCI ∩ SPA overlap area; sites that are `SCISPA` vs. separate overlapping polygons.
4. **Pressure analysis:** overlay with other layers from the same Geoportal (national parks/CDDA `ps:PS.NationallyDesignatedAreasCDDA`, flood zones, SEVESO sites, wastewater plants, bathing waters, monitoring stations) and external ones (CORINE Land Cover, wind/solar licences, mining, roads, wildfires/burnt areas, Urban Atlas).
5. **Ecological enrichment:** join EEA Natura 2000 tables (site names, habitats Annex I, species, threats) on `sitecode`; also the dataset's `hb:HB.HabitatsDistrGrid` / `sd:SD.BirdsDistrGrid` 10 km grids (Art. 17 / Art. 12 reporting).
6. **Time/consistency:** compare with previous releases to see changes (new sites, boundary updates).

## 8. Recommended next steps

1. **Download** the layer (§6) and store it as GeoPackage in `natura-data/` (the current folder has no real data); keep the raw GeoJSON/Shapefile for provenance with a note of download date.
2. **Data quality checks:** valid geometries (`gdf.is_valid`, `make_valid`), duplicates, recompute areas in EPSG:2100/3035 and compare with `shape_area`, confirm CRS.
3. **Enrich** with site names and region via EEA Natura 2000 database + administrative boundaries; reconcile the 446 vs 244+202 count.
4. **Try the other services** to complete the picture: WMS `PS.ProtectedSite` (styles/legend), INSPIRE WFS once fixed (or contact `eygep.support@prv.ypeka.gr`), CSW for other related datasets.
5. **Build first analyses:** summary table by `sitetype`, dissolved total area, maps (GeoPandas/Folium or QGIS), choropleth per region.
6. **Document licensing:** CC BY-SA 4.0 – credit "Υπουργείο Περιβάλλοντος και Ενέργειας (ΥΠΕΝ)" and keep share-alike for derived datasets.
7. Optionally set up a small reproducible pipeline (script/notebook + `requirements.txt`) so the data can be refreshed.

## 9. Method notes

- Sources used: local `index.csv`, `index.html`, `info.xml`, `metadata.xml`; live geoportal WFS/WMS capabilities, `DescribeFeatureType` and attribute-only `GetFeature` (queried 2026-10-26).
- Figures in §5 were computed from the service's attribute table; geometry-based figures (true union area, overlaps) were **not** computed because the geometries have not been downloaded.

## 10. Progress log – steps 1 & 3 (done)

- **Environment:** `.venv` + [requirements.txt](requirements.txt) (`python -m venv .venv`, then `.\.venv\Scripts\Activate.ps1`, `pip install -r requirements.txt`).
- **Download:** `download_natura.py` -> `natura-data/natura2000_gr.gpkg` (446 valid MultiPolygons, EPSG:2100, areas match `shape_area`).
- **Enrichment:** `enrich_natura.py` -> `natura-data/natura2000_gr_enriched.gpkg` / `.csv`.
  - **Names** (`name_en`, `name_el`, `wikidata`) come from **Wikidata** (property P3425 "Natura 2000 site ID"), because the EEA end-user database could not be downloaded automatically (EEA ArcGIS service returned 502; SDF pages return 403; the tabular download sits behind a WebDAV share). All 446 sites match a Wikidata item, **30 have no label** (4 codes are ambiguous, flagged in `wikidata_ambiguous`). Wikidata also has 5 GR codes absent from the layer.
  - **Regions** come from **geoBoundaries** (CC BY 4.0, 2016; `region_*` = ADM2, the 13 regions + Mount Athos; `decentr_admin_*` = ADM1, coarser grouping). Columns: `*_primary` (largest overlap), `*_all`, `*_count`, `land_share_pct`, `outside_land_boundary`.
  - 28 sites span >1 region; 16 sites (offshore/small islets) do not intersect the coarse land boundary; median land share is 99%, mean 78% (many marine sites).
  - Count reconciliation: 265 sites with an SCI designation (239 + 26 SCISPA) and 207 with an SPA designation (181 + 26) versus 244/202 in the metadata abstract - the layer is newer/larger than the abstract.
- **Caveats:** geoBoundaries is a generalised 2016 boundary (coastline is coarse), so region assignment of coastal/island sites is approximate. For authoritative names, habitats and species, manually download the EEA *Natura 2000 (tabular) end 2024* CSVs (<https://www.eea.europa.eu/en/datahub/datahubitem-view/6fc8ad2d-195d-40f4-bdec-576e7d1268e4>) and join on `sitecode` (`SITECODE`).
- Large/derived files (`*.gpkg`, `*.geojson`, `natura-data/boundaries/`) are git-ignored; rerun the scripts to regenerate.
