import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

DB_PATH = Path(os.environ.get("NATURA_DB_PATH", REPO_ROOT / "data" / "natura.db"))
RAW_DIR = Path(os.environ.get("NATURA_RAW_DIR", REPO_ROOT / "data" / "raw"))

# Greek ministry (YPEN) geoportal. The WFS advertised in the catalogue metadata
# (/geoserver/ps_natura2000/ows) is broken; this global endpoint serves the layer.
WFS_URL = "http://geoportal.ypen.gr/geoserver/ows"
WFS_LAYER = "ps:PS.ProtectedSitesNatura2000"
SOURCE_CRS = 2100  # GGRS87 / Greek Grid (metres)
OUTPUT_CRS = 4326

WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
GEOBOUNDARIES_API = "https://www.geoboundaries.org/api/current/gbOpen/GRC/ADM2/"

USER_AGENT = "data-greece-natura-etl/1.0 (research)"
HTTP_TIMEOUT = 300

# Geometry simplification tolerances, in metres (applied in EPSG:2100)
SITE_SIMPLIFY_M = 150
REGION_SIMPLIFY_M = 300
# Coordinates are snapped to ~1 m (1e-5 degrees) to keep the stored GeoJSON small
COORD_PRECISION = 1e-5

MIN_EXPECTED_SITES = 400
