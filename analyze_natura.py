"""First analysis of the enriched Natura 2000 Greece layer: coverage, overlap, sizes, regions, maps."""
from pathlib import Path

import geopandas as gpd
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
from matplotlib.patches import Patch

DATA = Path(__file__).parent / "natura-data"
OUT = DATA / "analysis"
OUT.mkdir(exist_ok=True)

sites = gpd.read_file(DATA / "natura2000_gr_enriched.gpkg", layer="sites_enriched")
land = gpd.read_file(DATA / "boundaries" / "geoBoundaries-GRC-ADM1.geojson").to_crs(2100)
regions = gpd.read_file(DATA / "boundaries" / "geoBoundaries-GRC-ADM2.geojson").to_crs(2100)
land_union = land.geometry.union_all()
land_km2 = land_union.area / 1e6

sci = sites[sites.sitetype.isin(["SCI", "SCISPA"])]
spa = sites[sites.sitetype.isin(["SPA", "SCISPA"])]
u_all, u_sci, u_spa = (g.geometry.union_all() for g in (sites, sci, spa))
u_both = u_sci.intersection(u_spa)

km2 = lambda g: g.area / 1e6
cov = pd.DataFrame(
    {
        "area_km2": [km2(u_all), km2(u_sci), km2(u_spa), km2(u_both)],
        "land_km2": [km2(g.intersection(land_union)) for g in (u_all, u_sci, u_spa, u_both)],
    },
    index=["Natura 2000 (union)", "SCI (Habitats, incl. SCISPA)", "SPA (Birds, incl. SCISPA)", "SCI ∩ SPA overlap"],
)
cov["marine_or_outside_km2"] = cov.area_km2 - cov.land_km2
cov["land_pct_of_greece_land"] = cov.land_km2 / land_km2 * 100
cov.round(1).to_csv(OUT / "coverage.csv", encoding="utf-8-sig")

naive = sites.area_km2.sum()
print(f"Greece land (geoBoundaries ADM1, coarse): {land_km2:,.0f} km2")
print(f"Naive sum of site areas: {naive:,.0f} km2 vs dissolved: {cov.area_km2.iloc[0]:,.0f} km2 "
      f"(double counting {naive / cov.area_km2.iloc[0] - 1:.0%})")
print(cov.round(1).to_string())

# Size distribution
bins = [0, 1, 10, 50, 100, 500, 1000, 1e9]
labels = ["<1", "1-10", "10-50", "50-100", "100-500", "500-1000", ">1000"]
sites["size_class_km2"] = pd.cut(sites.area_km2, bins, labels=labels)
size = pd.crosstab(sites.size_class_km2, sites.sitetype, margins=True)
size.to_csv(OUT / "size_classes.csv")
print("\nSize classes (km2):\n", size.to_string())
top = sites.nlargest(10, "area_km2")[["sitecode", "sitetype", "name_en", "area_km2", "land_share_pct"]]
top.round(1).to_csv(OUT / "top10_largest.csv", index=False, encoding="utf-8-sig")
print("\nTop 10 largest:\n", top.round(1).to_string(index=False))
srt = sites.area_km2.sort_values(ascending=False)
print(f"\nTop 10% of sites hold {srt.head(len(srt) // 10).sum() / srt.sum():.0%} of summed area; "
      f"median {sites.area_km2.median():.0f} km2, mean {sites.area_km2.mean():.0f} km2")

# Land / sea character
sites["character"] = pd.cut(sites.land_share_pct.fillna(0), [-1, 10, 90, 101],
                            labels=["mostly marine (<10% land)", "mixed", "terrestrial (>90% land)"])
char = pd.crosstab(sites.character, sites.sitetype, margins=True)
char.to_csv(OUT / "land_sea_character.csv")
print("\nLand/sea character:\n", char.to_string())

# Per-region coverage (land part, dissolved per region)
rows = []
for _, r in regions.iterrows():
    reg_land = r.geometry
    prot = u_all.intersection(reg_land)
    rows.append({"region": r.shapeName, "region_km2": reg_land.area / 1e6, "protected_land_km2": prot.area / 1e6,
                 "n_sites_touching": int(sites.intersects(reg_land).sum())})
reg = pd.DataFrame(rows)
reg["protected_pct"] = reg.protected_land_km2 / reg.region_km2 * 100
reg = reg.sort_values("protected_pct", ascending=False)
reg.round(1).to_csv(OUT / "region_coverage.csv", index=False, encoding="utf-8-sig")
print("\nProtected land share per region:\n", reg.round(1).to_string(index=False))

# Charts and maps
fig, axes = plt.subplots(1, 2, figsize=(13, 5))
sites.groupby("sitetype").area_km2.sum().plot.bar(ax=axes[0], color=["#2b8cbe", "#fdae6b", "#31a354"])
axes[0].set_title("Summed site area by type (km²) – overlaps double counted")
axes[0].tick_params(axis="x", rotation=0)
sites.area_km2.plot.hist(bins=[0, 1, 10, 50, 100, 500, 1000, 3000], ax=axes[1], color="#756bb1", log=True)
axes[1].set_title("Site area distribution (km², log count)")
fig.tight_layout(); fig.savefig(OUT / "charts.png", dpi=130); plt.close(fig)

fig, ax = plt.subplots(figsize=(9, 9))
land.plot(ax=ax, color="#f0f0f0", edgecolor="#bbbbbb", linewidth=0.4)
colors = {"SCI": "#2b8cbe", "SPA": "#e6550d", "SCISPA": "#31a354"}
for t, c in colors.items():
    sites[sites.sitetype == t].plot(ax=ax, color=c, alpha=0.6, linewidth=0)
ax.legend(handles=[Patch(color=c, alpha=0.6, label=t) for t, c in colors.items()], title="Site type")
ax.set_axis_off(); ax.set_title("Natura 2000 sites in Greece")
fig.tight_layout(); fig.savefig(OUT / "map_sites.png", dpi=130); plt.close(fig)

fig, ax = plt.subplots(figsize=(9, 9))
regions.merge(reg, left_on="shapeName", right_on="region").plot(
    column="protected_pct", cmap="YlGn", legend=True, ax=ax, edgecolor="white",
    legend_kwds={"label": "% of region land covered by Natura 2000"})
ax.set_axis_off(); ax.set_title("Protected land share per region")
fig.tight_layout(); fig.savefig(OUT / "map_region_coverage.png", dpi=130); plt.close(fig)
print("\nSaved outputs to", OUT)
