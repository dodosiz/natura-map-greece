"""Load: write everything to SQLite in one transaction (readers never see a half-loaded DB)."""
import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

log = logging.getLogger(__name__)

SCHEMA = """
CREATE TABLE IF NOT EXISTS sites (
    sitecode TEXT PRIMARY KEY,
    objectid INTEGER,
    sitetype TEXT NOT NULL CHECK (sitetype IN ('SCI', 'SPA', 'SCISPA')),
    name_en TEXT,
    name_el TEXT,
    wikidata TEXT,
    wikidata_ambiguous INTEGER NOT NULL DEFAULT 0,
    perimeter_km REAL,
    area_km2 REAL NOT NULL,
    land_share_pct REAL,
    region_primary TEXT,
    centroid_lon REAL, centroid_lat REAL,
    min_lon REAL, min_lat REAL, max_lon REAL, max_lat REAL,
    geom_simplified TEXT NOT NULL,   -- GeoJSON geometry, WGS84, simplified (map overview)
    geom_full TEXT NOT NULL          -- GeoJSON geometry, WGS84, full detail
);
CREATE INDEX IF NOT EXISTS idx_sites_type ON sites (sitetype);
CREATE INDEX IF NOT EXISTS idx_sites_region ON sites (region_primary);

CREATE TABLE IF NOT EXISTS site_regions (
    sitecode TEXT NOT NULL REFERENCES sites (sitecode) ON DELETE CASCADE,
    region TEXT NOT NULL,
    overlap_km2 REAL NOT NULL,
    PRIMARY KEY (sitecode, region)
);
CREATE INDEX IF NOT EXISTS idx_site_regions_region ON site_regions (region);

CREATE TABLE IF NOT EXISTS regions (
    name TEXT PRIMARY KEY,
    name_el TEXT,
    name_en TEXT,
    area_km2 REAL NOT NULL,
    protected_km2 REAL NOT NULL,
    protected_pct REAL NOT NULL,
    n_sites INTEGER NOT NULL,
    geometry TEXT NOT NULL           -- GeoJSON geometry, WGS84, simplified
);

CREATE TABLE IF NOT EXISTS stats (
    key TEXT PRIMARY KEY,
    value REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS etl_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    finished_at TEXT NOT NULL,
    source TEXT NOT NULL,
    n_sites INTEGER NOT NULL,
    n_named INTEGER NOT NULL,
    n_regions INTEGER NOT NULL
);
"""

SITE_COLUMNS = [
    "sitecode", "objectid", "sitetype", "name_en", "name_el", "wikidata", "wikidata_ambiguous",
    "perimeter_km", "area_km2", "land_share_pct", "region_primary", "centroid_lon", "centroid_lat",
    "min_lon", "min_lat", "max_lon", "max_lat", "geom_simplified", "geom_full",
]


def load(db_path: Path, sites: list[dict], links: list[dict], regions: list[dict],
         stats: dict[str, float], source: str) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(db_path)
    try:
        con.execute("PRAGMA journal_mode = WAL")
        con.executescript(SCHEMA)
        existing = {r[1] for r in con.execute("PRAGMA table_info(regions)")}
        for col in ("name_el", "name_en"):
            if col not in existing:
                con.execute(f"ALTER TABLE regions ADD COLUMN {col} TEXT")
        with con:  # single transaction: full refresh
            for table in ("site_regions", "sites", "regions", "stats"):
                con.execute(f"DELETE FROM {table}")
            placeholders = ", ".join(f":{c}" for c in SITE_COLUMNS)
            con.executemany(f"INSERT INTO sites ({', '.join(SITE_COLUMNS)}) VALUES ({placeholders})", sites)
            con.executemany(
                "INSERT INTO site_regions (sitecode, region, overlap_km2) VALUES (:sitecode, :region, :overlap_km2)",
                links)
            con.executemany(
                "INSERT INTO regions (name, name_el, name_en, area_km2, protected_km2, protected_pct, n_sites, geometry) "
                "VALUES (:name, :name_el, :name_en, :area_km2, :protected_km2, :protected_pct, :n_sites, :geometry)",
                regions)
            con.executemany("INSERT INTO stats (key, value) VALUES (?, ?)", stats.items())
            con.execute(
                "INSERT INTO etl_runs (finished_at, source, n_sites, n_named, n_regions) VALUES (?, ?, ?, ?, ?)",
                (datetime.now(timezone.utc).isoformat(timespec="seconds"), source, len(sites),
                 sum(1 for s in sites if s["name_en"] or s["name_el"]), len(regions)))
        con.execute("VACUUM")
    finally:
        con.close()
    log.info("loaded %d sites, %d regions into %s", len(sites), len(regions), db_path)
