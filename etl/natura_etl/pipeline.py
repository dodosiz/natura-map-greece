"""Pipeline orchestration: extract -> transform -> validate -> load."""
import logging
from pathlib import Path

from . import config, extract, load, transform

log = logging.getLogger(__name__)


def run(db_path: Path = config.DB_PATH, use_cache: bool = False) -> dict:
    raw_sites = extract.fetch_sites(use_cache)
    names = transform.parse_names(extract.fetch_wikidata_names(use_cache))
    regions = transform.parse_regions(extract.fetch_regions(use_cache))
    log.info("extracted %d sites, %d names, %d regions", len(raw_sites["features"]), len(names), len(regions))

    sites, geoms, links = transform.build_sites(raw_sites, names, regions)
    transform.validate(sites)
    region_rows, stats = transform.build_regions(regions, geoms, links)

    load.load(db_path, sites, links, region_rows, stats, source=f"{config.WFS_URL} {config.WFS_LAYER}")
    return {
        "sites": len(sites),
        "named": sum(1 for s in sites if s["name_en"] or s["name_el"]),
        "regions": len(region_rows),
        "network_land_pct": round(stats["network_land_pct"], 1),
        "db": str(db_path),
    }
