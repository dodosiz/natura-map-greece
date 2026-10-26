"""Download the Natura 2000 Greece layer from the YPEN geoportal WFS and store it locally."""
import datetime as dt
import hashlib
from pathlib import Path

import geopandas as gpd
import requests

WFS = "http://geoportal.ypen.gr/geoserver/ows"
PARAMS = {
    "service": "WFS",
    "version": "2.0.0",
    "request": "GetFeature",
    "typeNames": "ps:PS.ProtectedSitesNatura2000",
    "outputFormat": "application/json",
}
OUT = Path(__file__).parent / "natura-data"
RAW = OUT / "natura2000_gr_raw_epsg2100.geojson"
GPKG = OUT / "natura2000_gr.gpkg"

OUT.mkdir(exist_ok=True)
r = requests.get(WFS, params=PARAMS, timeout=300)
r.raise_for_status()
RAW.write_bytes(r.content)
sha = hashlib.sha256(r.content).hexdigest()
print(f"raw: {RAW.name}, {len(r.content)/1e6:.1f} MB")

gdf = gpd.read_file(RAW)
if gdf.crs is None:
    gdf = gdf.set_crs(2100)
print("CRS:", gdf.crs.to_string(), "| features:", len(gdf))

gdf["geom_valid"] = gdf.is_valid
print("invalid geometries:", int((~gdf["geom_valid"]).sum()))
gdf["geometry"] = gdf.geometry.make_valid()

# Recomputed in EPSG:2100 (metric) to compare with the provider's shape_area
gdf["area_km2"] = gdf.geometry.area / 1e6
gdf["area_diff_pct"] = (gdf["area_km2"] * 1e6 / gdf["shape_area"].astype(float) - 1) * 100
print("area diff vs shape_area (%):")
print(gdf["area_diff_pct"].describe().round(4))

print("sitetype counts:\n", gdf["sitetype"].value_counts())
print("duplicate sitecodes:", int(gdf["sitecode"].duplicated().sum()))
print("geometry types:", gdf.geom_type.value_counts().to_dict())
print("bounds (EPSG:2100):", [round(v) for v in gdf.total_bounds])
print("bounds (WGS84):", [round(v, 2) for v in gdf.to_crs(4326).total_bounds])

gdf.to_file(GPKG, layer="sites", driver="GPKG")
(OUT / "DOWNLOAD_INFO.txt").write_text(
    f"Source: {WFS}\nLayer: ps:PS.ProtectedSitesNatura2000\n"
    f"Downloaded: {dt.datetime.now().isoformat(timespec='seconds')}\n"
    f"Features: {len(gdf)}\nCRS: EPSG:2100\nSHA256 raw: {sha}\n"
    "Licence: CC BY-SA 4.0 - Source: Ministry for Environment and Energy (YPEN)\n",
    encoding="utf-8",
)
print("saved", GPKG.name)
