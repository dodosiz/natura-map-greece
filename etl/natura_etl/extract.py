"""Extract: download the raw data from the online sources (with an optional local cache)."""
import json
import logging
from pathlib import Path

import requests

from . import config

log = logging.getLogger(__name__)

# Finds Natura 2000 items with GR-prefixed codes and optional English/Greek labels.
SPARQL = """
SELECT ?code ?item ?en ?el WHERE {
  ?item wdt:P3425 ?code . FILTER(STRSTARTS(?code, "GR"))
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item rdfs:label ?el FILTER(LANG(?el) = "el") }
}"""


def _get(url: str, **kwargs) -> requests.Response:
    headers = {"User-Agent": config.USER_AGENT, **kwargs.pop("headers", {})}
    resp = requests.get(url, headers=headers, timeout=config.HTTP_TIMEOUT, **kwargs)
    resp.raise_for_status()
    return resp


def _cached(path: Path, use_cache: bool, fetch):
    if use_cache and path.exists():
        log.info("using cached %s", path.name)
        return json.loads(path.read_text(encoding="utf-8"))
    data = fetch()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data), encoding="utf-8")
    return data


def fetch_sites(use_cache: bool = False) -> dict:
    """Site polygons as a GeoJSON FeatureCollection in EPSG:2100."""
    def fetch():
        log.info("downloading sites from the YPEN WFS (~60 MB)")
        params = {
            "service": "WFS", "version": "2.0.0", "request": "GetFeature",
            "typeNames": config.WFS_LAYER, "outputFormat": "application/json",
        }
        return _get(config.WFS_URL, params=params).json()

    return _cached(config.RAW_DIR / "sites_epsg2100.json", use_cache, fetch)


def fetch_wikidata_names(use_cache: bool = False) -> list[dict]:
    """Site names keyed by Natura 2000 code (Wikidata property P3425)."""
    def fetch():
        log.info("querying Wikidata for site names")
        resp = _get(config.WIKIDATA_SPARQL, params={"query": SPARQL, "format": "json"})
        return resp.json()["results"]["bindings"]

    return _cached(config.RAW_DIR / "wikidata_names.json", use_cache, fetch)


def fetch_regions(use_cache: bool = False) -> dict:
    """Greek regions (geoBoundaries ADM2, WGS84 GeoJSON)."""
    def fetch():
        log.info("downloading region boundaries from geoBoundaries")
        meta = _get(config.GEOBOUNDARIES_API).json()
        return _get(meta["gjDownloadURL"]).json()

    return _cached(config.RAW_DIR / "regions_adm2.json", use_cache, fetch)
