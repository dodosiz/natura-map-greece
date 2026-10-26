"""Transform: clean geometries, compute areas, join names, assign regions, compute coverage."""
import logging
from collections import defaultdict

import shapely
from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree
from shapely.validation import make_valid

from . import config

log = logging.getLogger(__name__)

_TO_WGS84 = Transformer.from_crs(config.SOURCE_CRS, config.OUTPUT_CRS, always_xy=True)
_FROM_WGS84 = Transformer.from_crs(config.OUTPUT_CRS, config.SOURCE_CRS, always_xy=True)

SITE_TYPES = {"SCI", "SPA", "SCISPA"}


class ValidationError(RuntimeError):
    pass


def _valid(geom):
    return geom if geom.is_valid else make_valid(geom)


def _wgs84_geojson(geom) -> str:
    """Reproject EPSG:2100 -> WGS84 and serialise as GeoJSON with snapped coordinates."""
    snapped = shapely.set_precision(transform(_TO_WGS84.transform, geom), config.COORD_PRECISION)
    return shapely.to_geojson(snapped)


def parse_names(bindings: list[dict]) -> dict[str, dict]:
    """Wikidata bindings -> {sitecode: {wikidata, name_en, name_el, ambiguous}}.

    A few codes map to several Wikidata items; keep a labelled one (lowest Q-id) and flag it.
    """
    by_code: dict[str, list[dict]] = defaultdict(list)
    for b in bindings:
        by_code[b["code"]["value"]].append({
            "wikidata": b["item"]["value"].rsplit("/", 1)[-1],
            "name_en": b.get("en", {}).get("value"),
            "name_el": b.get("el", {}).get("value"),
        })
    out = {}
    for code, items in by_code.items():
        items.sort(key=lambda i: (not (i["name_en"] or i["name_el"]), int(i["wikidata"][1:])))
        out[code] = {**items[0], "ambiguous": len(items) > 1}
    return out


def parse_regions(geojson: dict) -> list[tuple[str, object]]:
    """geoBoundaries ADM2 (WGS84) -> [(name, geometry in EPSG:2100)]."""
    regions = []
    for f in geojson["features"]:
        geom = transform(_FROM_WGS84.transform, shape(f["geometry"]))
        regions.append((f["properties"]["shapeName"], _valid(geom)))
    if len({n for n, _ in regions}) != len(regions):
        raise ValidationError("duplicate region names in boundary data")
    return regions


def build_sites(raw: dict, names: dict[str, dict], regions: list[tuple[str, object]]):
    """Return (site records, {sitecode: (sitetype, geometry EPSG:2100)}, site_region rows)."""
    region_geoms = [g for _, g in regions]
    tree = STRtree(region_geoms)

    records, geoms, links = [], {}, []
    for feat in raw["features"]:
        p = feat["properties"]
        code = p["sitecode"]
        geom = _valid(shape(feat["geometry"]))
        area_km2 = geom.area / 1e6

        overlaps = []
        for idx in tree.query(geom, predicate="intersects"):
            inter = geom.intersection(region_geoms[idx]).area / 1e6
            if inter > 0:
                overlaps.append((regions[idx][0], inter))
        overlaps.sort(key=lambda o: -o[1])
        land_km2 = sum(o[1] for o in overlaps)

        centroid = shapely.Point(geom.representative_point())
        lon, lat = _TO_WGS84.transform(centroid.x, centroid.y)
        min_lon, min_lat = _TO_WGS84.transform(*geom.bounds[:2])
        max_lon, max_lat = _TO_WGS84.transform(*geom.bounds[2:])
        name = names.get(code, {})

        records.append({
            "sitecode": code,
            "objectid": p.get("objectid"),
            "sitetype": p["sitetype"],
            "name_en": name.get("name_en"),
            "name_el": name.get("name_el"),
            "wikidata": name.get("wikidata"),
            "wikidata_ambiguous": int(bool(name.get("ambiguous"))),
            "perimeter_km": geom.length / 1e3,
            "area_km2": area_km2,
            "land_share_pct": min(100.0, land_km2 / area_km2 * 100) if area_km2 else 0.0,
            "region_primary": overlaps[0][0] if overlaps else None,
            "centroid_lon": lon, "centroid_lat": lat,
            "min_lon": min_lon, "min_lat": min_lat, "max_lon": max_lon, "max_lat": max_lat,
            "geom_simplified": _wgs84_geojson(geom.simplify(config.SITE_SIMPLIFY_M, preserve_topology=True)),
            "geom_full": _wgs84_geojson(geom),
        })
        links.extend({"sitecode": code, "region": r, "overlap_km2": a} for r, a in overlaps)
        geoms[code] = (p["sitetype"], geom)
    return records, geoms, links


def build_regions(regions, geoms, links):
    """Per-region protected-land coverage plus network-wide statistics."""
    all_union = unary_union([g for _, g in geoms.values()])
    sci_union = unary_union([g for t, g in geoms.values() if t in ("SCI", "SCISPA")])
    spa_union = unary_union([g for t, g in geoms.values() if t in ("SPA", "SCISPA")])
    land_union = unary_union([g for _, g in regions])

    sites_per_region: dict[str, int] = defaultdict(int)
    for link in links:
        sites_per_region[link["region"]] += 1

    out = []
    for name, geom in regions:
        area_km2 = geom.area / 1e6
        protected_km2 = all_union.intersection(geom).area / 1e6
        names = config.REGION_NAMES.get(name) or config.REGION_NAMES.get(name.strip())
        if names is None:
            log.warning("no translation for region %r; using source name", name)
        out.append({
            "name": name,
            "name_el": names["el"] if names else name,
            "name_en": names["en"] if names else name,
            "area_km2": area_km2,
            "protected_km2": protected_km2,
            "protected_pct": protected_km2 / area_km2 * 100 if area_km2 else 0.0,
            "n_sites": sites_per_region[name],
            "geometry": _wgs84_geojson(geom.simplify(config.REGION_SIMPLIFY_M, preserve_topology=True)),
        })

    km2 = lambda g: g.area / 1e6  # noqa: E731
    stats = {
        "greece_land_km2": km2(land_union),
        "network_km2": km2(all_union),
        "network_land_km2": km2(all_union.intersection(land_union)),
        "network_land_pct": km2(all_union.intersection(land_union)) / km2(land_union) * 100,
        "sci_km2": km2(sci_union),
        "spa_km2": km2(spa_union),
        "sci_spa_overlap_km2": km2(sci_union.intersection(spa_union)),
        "sum_of_site_areas_km2": sum(km2(g) for _, g in geoms.values()),
    }
    return out, stats


def validate(records: list[dict]) -> None:
    """Abort before touching the database if the download looks wrong."""
    if len(records) < config.MIN_EXPECTED_SITES:
        raise ValidationError(f"only {len(records)} sites downloaded, expected >= {config.MIN_EXPECTED_SITES}")
    codes = [r["sitecode"] for r in records]
    if len(set(codes)) != len(codes):
        raise ValidationError("duplicate site codes")
    bad_types = {r["sitetype"] for r in records} - SITE_TYPES
    if bad_types:
        raise ValidationError(f"unexpected site types: {bad_types}")
    if any(not r["area_km2"] > 0 for r in records):
        raise ValidationError("site with empty geometry")
    if any(not (19 < r["centroid_lon"] < 30 and 34 < r["centroid_lat"] < 42) for r in records):
        raise ValidationError("site centroid outside Greece - wrong CRS?")
