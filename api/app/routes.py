import json
import sqlite3

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from .db import get_db

router = APIRouter(prefix="/api")

SITE_PROPS = "sitecode, sitetype, name_en, name_el, area_km2, land_share_pct, region_primary"


def _geojson(features):
    return JSONResponse({"type": "FeatureCollection", "features": features},
                        media_type="application/geo+json")


@router.get("/sites/geojson")
def sites_geojson(db: sqlite3.Connection = Depends(get_db)):
    """All sites as a FeatureCollection with simplified geometries, for map rendering."""
    feats = []
    for r in db.execute(f"SELECT {SITE_PROPS}, geom_simplified FROM sites"):
        props = {k: r[k] for k in r.keys() if k != "geom_simplified"}
        feats.append({"type": "Feature", "id": r["sitecode"], "properties": props,
                      "geometry": json.loads(r["geom_simplified"])})
    return _geojson(feats)


@router.get("/regions")
def regions(db: sqlite3.Connection = Depends(get_db)):
    """Regions as GeoJSON with protected-area coverage statistics."""
    feats = []
    for r in db.execute("SELECT * FROM regions ORDER BY name"):
        props = {k: r[k] for k in r.keys() if k != "geometry"}
        feats.append({"type": "Feature", "id": r["name"], "properties": props,
                      "geometry": json.loads(r["geometry"])})
    return _geojson(feats)


@router.get("/stats")
def stats(db: sqlite3.Connection = Depends(get_db)):
    by_type = {r["sitetype"]: {"count": r["n"], "area_km2": r["a"]} for r in db.execute(
        "SELECT sitetype, COUNT(*) n, SUM(area_km2) a FROM sites GROUP BY sitetype")}
    run = db.execute("SELECT finished_at, source, n_sites, n_named, n_regions FROM etl_runs "
                     "ORDER BY id DESC LIMIT 1").fetchone()
    return {
        "total_sites": sum(v["count"] for v in by_type.values()),
        "by_type": by_type,
        "coverage": {r["key"]: r["value"] for r in db.execute("SELECT key, value FROM stats")},
        "last_etl_run": dict(run) if run else None,
    }
