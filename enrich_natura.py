"""Enrich the Natura 2000 Greece sites with names (Wikidata) and regions (geoBoundaries)."""
from pathlib import Path

import geopandas as gpd
import pandas as pd
import requests

ROOT = Path(__file__).parent
DATA = ROOT / "natura-data"
SRC = DATA / "natura2000_gr.gpkg"
OUT_GPKG = DATA / "natura2000_gr_enriched.gpkg"
OUT_CSV = DATA / "natura2000_gr_enriched.csv"
UA = {"User-Agent": "data-greece-natura/0.1 (research)"}

SPARQL = """
SELECT ?code ?item ?en ?el WHERE {
  ?item wdt:P3425 ?code . FILTER(STRSTARTS(?code, "GR"))
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item rdfs:label ?el FILTER(LANG(?el) = "el") }
}"""


def fetch_names() -> pd.DataFrame:
    r = requests.get("https://query.wikidata.org/sparql",
                     params={"query": SPARQL, "format": "json"}, headers=UA, timeout=180)
    r.raise_for_status()
    rows = [{"sitecode": b["code"]["value"],
             "wikidata": b["item"]["value"].rsplit("/", 1)[-1],
             "name_en": b.get("en", {}).get("value"),
             "name_el": b.get("el", {}).get("value")}
            for b in r.json()["results"]["bindings"]]
    df = pd.DataFrame(rows)
    df["_has_name"] = df[["name_en", "name_el"]].notna().any(axis=1)
    # codes mapped to several Wikidata items: keep the one with labels, lowest Q-id
    df["_q"] = df["wikidata"].str[1:].astype(int)
    df = df.sort_values(["sitecode", "_has_name", "_q"], ascending=[True, False, True])
    dup_codes = df.loc[df["sitecode"].duplicated(keep=False), "sitecode"].unique()
    df = df.drop_duplicates("sitecode").drop(columns=["_has_name", "_q"])
    df["wikidata_ambiguous"] = df["sitecode"].isin(dup_codes)
    return df


def fetch_boundaries(level: str) -> gpd.GeoDataFrame:
    meta = requests.get(f"https://www.geoboundaries.org/api/current/gbOpen/GRC/{level}/",
                        headers=UA, timeout=60).json()
    cache = DATA / "boundaries" / f"geoBoundaries-GRC-{level}.geojson"
    cache.parent.mkdir(exist_ok=True)
    if not cache.exists():
        cache.write_bytes(requests.get(meta["gjDownloadURL"], headers=UA, timeout=300).content)
    return gpd.read_file(cache).to_crs(2100)[["shapeName", "geometry"]]


def assign(sites: gpd.GeoDataFrame, bounds: gpd.GeoDataFrame, prefix: str) -> pd.DataFrame:
    """Primary unit = largest overlap; also list all units and the share of the site on land."""
    inter = gpd.overlay(sites[["sitecode", "geometry"]], bounds, how="intersection",
                        keep_geom_type=True)
    inter["ov_m2"] = inter.geometry.area
    inter = inter.sort_values(["sitecode", "ov_m2"], ascending=[True, False])
    g = inter.groupby("sitecode")
    out = pd.DataFrame({
        f"{prefix}_primary": g["shapeName"].first(),
        f"{prefix}_all": g["shapeName"].agg(lambda s: "; ".join(s)),
        f"{prefix}_count": g["shapeName"].nunique(),
        "_land_m2": g["ov_m2"].sum(),
    })
    return out.reset_index()


def main() -> None:
    sites = gpd.read_file(SRC, layer="sites")
    names = fetch_names()
    print(f"Wikidata GR codes: {len(names)} | named: {names['name_en'].notna().sum()} en, "
          f"{names['name_el'].notna().sum()} el")

    enriched = sites.merge(names, on="sitecode", how="left")
    print("sites without Wikidata match:", int(enriched["wikidata"].isna().sum()))
    print("wikidata codes not in layer:", sorted(set(names["sitecode"]) - set(sites["sitecode"])))

    # ADM2 = 13 regions (+ Mount Athos); ADM1 = 9 coarser administrative groupings
    admin = assign(sites, fetch_boundaries("ADM1"), "decentr_admin").drop(columns="_land_m2")
    region = assign(sites, fetch_boundaries("ADM2"), "region")
    enriched = enriched.merge(admin, on="sitecode", how="left").merge(region, on="sitecode", how="left")
    enriched["land_share_pct"] = (enriched["_land_m2"] / (enriched["area_km2"] * 1e6) * 100).clip(upper=100)
    enriched = enriched.drop(columns="_land_m2")
    # no overlap with the (coarse) land boundaries: offshore sites and small islets
    enriched["outside_land_boundary"] = enriched["region_primary"].isna()

    print("\nsites per region (primary):\n", enriched["region_primary"].value_counts(dropna=False))
    print("\noutside land boundaries:", int(enriched["outside_land_boundary"].sum()))
    print("land share % describe:\n", enriched["land_share_pct"].describe().round(1))
    print("\nrank by type x region (primary):")
    print(pd.crosstab(enriched["region_primary"].fillna("(none)"), enriched["sitetype"]))

    enriched.to_file(OUT_GPKG, layer="sites_enriched", driver="GPKG")
    enriched.drop(columns="geometry").to_csv(OUT_CSV, index=False, encoding="utf-8-sig")
    print("\nsaved", OUT_GPKG.name, "and", OUT_CSV.name)


if __name__ == "__main__":
    main()

