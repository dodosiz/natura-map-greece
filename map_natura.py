"""Build a self-contained interactive HTML map of the enriched Natura 2000 Greece sites."""
import re
from pathlib import Path

import folium
import geopandas as gpd
import pandas as pd
import requests

DATA = Path(__file__).parent / "natura-data"
OUT = DATA / "analysis" / "natura_map.html"
VENDOR = DATA / "vendor"
OUT.parent.mkdir(exist_ok=True)
VENDOR.mkdir(exist_ok=True)

# Only these are needed for polygons + tooltips + choropleth; everything else is dropped.
INLINE = {
    "https://cdn.jsdelivr.net/npm/leaflet@1.9.3/dist/leaflet.css": "css",
    "https://cdn.jsdelivr.net/npm/leaflet@1.9.3/dist/leaflet.js": "js",
    "https://cdnjs.cloudflare.com/ajax/libs/d3/3.5.5/d3.min.js": "js",
    "https://code.jquery.com/jquery-3.7.1.min.js": "js",
}


def vendored(url: str) -> str:
    f = VENDOR / url.rsplit("/", 1)[-1]
    if not f.exists():
        r = requests.get(url, timeout=60)
        r.raise_for_status()
        f.write_bytes(r.content)
    return f.read_text(encoding="utf-8")


def make_self_contained(html: str) -> str:
    def repl(m: re.Match) -> str:
        url = m.group(1)
        if url in INLINE:
            body = vendored(url).replace("</script", "<\\/script")
            return f"<style>{body}</style>" if INLINE[url] == "css" else f"<script>{body}</script>"
        return ""  # bootstrap, fontawesome, awesome-markers, glyphicons: unused here

    html = re.sub(r'<script src="(https?://[^"]+)"></script>', repl, html)
    html = re.sub(r'<link rel="stylesheet" href="(https?://[^"]+)"\s*/?>', repl, html)
    return html


sites = gpd.read_file(DATA / "natura2000_gr_enriched.gpkg", layer="sites_enriched")
regions = gpd.read_file(DATA / "boundaries" / "geoBoundaries-GRC-ADM2.geojson").to_crs(2100)
cov = pd.read_csv(DATA / "analysis" / "region_coverage.csv")
regions = regions.merge(cov, left_on="shapeName", right_on="region")

# simplify in metres (EPSG:2100) before converting to WGS84 to keep the HTML light
sites["geometry"] = sites.geometry.simplify(150, preserve_topology=True)
regions["geometry"] = regions.geometry.simplify(300, preserve_topology=True)
sites = sites.to_crs(4326)
regions = regions.to_crs(4326)

sites["name"] = sites.name_en.fillna(sites.name_el).fillna("(no name)")
sites["area"] = sites.area_km2.round(1)
sites["land"] = sites.land_share_pct.round(0)
sites["region"] = sites.region_primary.fillna("offshore / n.a.")
cols = ["sitecode", "name", "sitetype", "area", "land", "region", "geometry"]

m = folium.Map(location=[38.5, 24.0], zoom_start=6, tiles="OpenStreetMap")

# Land outline keeps the map readable even when the OSM tile server is unreachable
folium.GeoJson(
    regions[["shapeName", "geometry"]].to_json(), name="Greece (land outline)",
    style_function=lambda _f: {"color": "#777777", "weight": 0.7, "fillColor": "#eeeeee", "fillOpacity": 0.6},
).add_to(m)

folium.Choropleth(
    geo_data=regions[["shapeName", "geometry"]].to_json(), data=regions,
    columns=["shapeName", "protected_pct"], key_on="feature.properties.shapeName",
    fill_color="YlGn", fill_opacity=0.5, line_opacity=0.6, line_weight=1,
    legend_name="% of region land covered by Natura 2000", name="Region coverage (%)", show=False,
).add_to(m)

colors = {"SCI": "#2b8cbe", "SPA": "#e6550d", "SCISPA": "#31a354"}
labels = {"SCI": "SCI - Habitats Directive", "SPA": "SPA - Birds Directive", "SCISPA": "SCI + SPA (both)"}
def make_tooltip() -> folium.GeoJsonTooltip:
    # one instance per layer: folium cannot share a tooltip between several layers
    return folium.GeoJsonTooltip(
        fields=["sitecode", "name", "sitetype", "area", "land", "region"],
        aliases=["Code", "Name", "Type", "Area km²", "Land %", "Region"], sticky=True)


for t, c in colors.items():
    folium.GeoJson(
        sites.loc[sites.sitetype == t, cols].to_json(), name=labels[t],
        style_function=lambda _f, c=c: {"color": c, "weight": 0.8, "fillColor": c, "fillOpacity": 0.45},
        highlight_function=lambda _f: {"weight": 3, "fillOpacity": 0.7},
        tooltip=make_tooltip(),
    ).add_to(m)

folium.LayerControl(collapsed=False).add_to(m)
html = make_self_contained(m.get_root().render())
OUT.write_text(html, encoding="utf-8")
print(f"saved {OUT} ({OUT.stat().st_size / 1e6:.1f} MB)")
