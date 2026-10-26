import json
import sqlite3
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse

from .db import get_db

router = APIRouter(prefix="/api")

SiteType = Literal["SCI", "SPA", "SCISPA"]
SORTS = {"name": "COALESCE(name_en, name_el, sitecode)", "area": "area_km2", "code": "sitecode"}
SUMMARY_COLS = ("sitecode, sitetype, name_en, name_el, area_km2, land_share_pct, region_primary, "
                "centroid_lon, centroid_lat")


def _filters(type, region, q, min_area, max_area, bbox):
    where, params = [], []
    if type:
        where.append(f"sitetype IN ({','.join('?' * len(type))})")
        params += type
    if region:
        where.append("sitecode IN (SELECT sitecode FROM site_regions WHERE region = ?)")
        params.append(region)
    if q:
        where.append("(sitecode LIKE ? OR name_en LIKE ? OR name_el LIKE ?)")
        params += [f"%{q}%"] * 3
    if min_area is not None:
        where.append("area_km2 >= ?")
        params.append(min_area)
    if max_area is not None:
        where.append("area_km2 <= ?")
        params.append(max_area)
    if bbox:
        try:
            w, s, e, n = (float(v) for v in bbox.split(","))
        except ValueError:
            raise HTTPException(422, "bbox must be 'west,south,east,north'")
        where.append("max_lon >= ? AND min_lon <= ? AND max_lat >= ? AND min_lat <= ?")
        params += [w, e, s, n]
    return (" WHERE " + " AND ".join(where)) if where else "", params


def _common(
    type: list[SiteType] | None = Query(None, description="Site type(s); repeat for several"),
    region: str | None = Query(None, description="Region name (any overlapping region)"),
    q: str | None = Query(None, description="Search in code and names"),
    min_area: float | None = Query(None, ge=0, description="Minimum area, km²"),
    max_area: float | None = Query(None, ge=0, description="Maximum area, km²"),
    bbox: str | None = Query(None, description="west,south,east,north (WGS84)"),
):
    return _filters(type, region, q, min_area, max_area, bbox)


def _feature(row, geom_col, props):
    return {"type": "Feature", "id": row["sitecode"], "properties": props, "geometry": json.loads(row[geom_col])}


def _geojson(features):
    return JSONResponse({"type": "FeatureCollection", "features": features},
                        media_type="application/geo+json")


@router.get("/health")
def health(db: sqlite3.Connection = Depends(get_db)):
    n = db.execute("SELECT COUNT(*) FROM sites").fetchone()[0]
    return {"status": "ok", "sites": n}


@router.get("/sites")
def list_sites(
    flt=Depends(_common),
    sort: Literal["name", "area", "code"] = "name",
    order: Literal["asc", "desc"] = "asc",
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: sqlite3.Connection = Depends(get_db),
):
    """Paged site list without geometry."""
    where, params = flt
    total = db.execute(f"SELECT COUNT(*) FROM sites{where}", params).fetchone()[0]
    rows = db.execute(
        f"SELECT {SUMMARY_COLS} FROM sites{where} ORDER BY {SORTS[sort]} {order} LIMIT ? OFFSET ?",
        [*params, limit, offset]).fetchall()
    return {"total": total, "limit": limit, "offset": offset, "items": [dict(r) for r in rows]}


@router.get("/sites/geojson")
def sites_geojson(flt=Depends(_common), db: sqlite3.Connection = Depends(get_db)):
    """FeatureCollection with simplified geometries, for map rendering."""
    where, params = flt
    rows = db.execute(f"SELECT {SUMMARY_COLS}, geom_simplified FROM sites{where}", params).fetchall()
    props = lambda r: {k: r[k] for k in r.keys() if k != "geom_simplified"}  # noqa: E731
    return _geojson([_feature(r, "geom_simplified", props(r)) for r in rows])


@router.get("/sites/{code}")
def get_site(
    code: str,
    geometry: Literal["full", "simplified", "none"] = "full",
    db: sqlite3.Connection = Depends(get_db),
):
    row = db.execute("SELECT * FROM sites WHERE sitecode = ?", (code,)).fetchone()
    if row is None:
        raise HTTPException(404, f"site {code} not found")
    props = {k: row[k] for k in row.keys() if k not in ("geom_full", "geom_simplified")}
    props["regions"] = [dict(r) for r in db.execute(
        "SELECT region, overlap_km2 FROM site_regions WHERE sitecode = ? ORDER BY overlap_km2 DESC", (code,))]
    if geometry == "none":
        return {"type": "Feature", "id": code, "properties": props, "geometry": None}
    return _feature(row, "geom_full" if geometry == "full" else "geom_simplified", props)


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
