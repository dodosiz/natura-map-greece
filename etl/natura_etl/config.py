import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

DB_PATH = Path(os.environ.get("NATURA_DB_PATH", REPO_ROOT / "data" / "natura.db"))
RAW_DIR = Path(os.environ.get("NATURA_RAW_DIR", REPO_ROOT / "data" / "raw"))

# WFS (Web Feature Service) serves geographic features from the Greek ministry
# (YPEN) geoportal. The catalogue endpoint is broken; this global endpoint serves the layer.
WFS_URL = "http://geoportal.ypen.gr/geoserver/ows"
WFS_LAYER = "ps:PS.ProtectedSitesNatura2000"
# CRS (Coordinate Reference System) defines how coordinates map to Earth.
# The WFS site geometries use EPSG:2100 (GGRS87 / Greek Grid, metres).
SOURCE_CRS = 2100
# Reproject output to EPSG:4326 (WGS 84 longitude/latitude), commonly used by GeoJSON.
OUTPUT_CRS = 4326

# Wikidata is a collaboratively maintained knowledge base with a SPARQL query service.
WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
# geoBoundaries API endpoint for open ADM2 administrative boundaries in Greece.
GEOBOUNDARIES_API = "https://www.geoboundaries.org/api/current/gbOpen/GRC/ADM2/"

USER_AGENT = "data-greece-natura-etl/1.0 (research)"
# HTTP request timeout in seconds.
HTTP_TIMEOUT = 300

# Geometry simplification tolerances, in metres (applied in EPSG:2100)
SITE_SIMPLIFY_M = 150
REGION_SIMPLIFY_M = 300
# Coordinates are snapped to ~1 m (1e-5 degrees) to keep the stored GeoJSON small
COORD_PRECISION = 1e-5

MIN_EXPECTED_SITES = 400

# geoBoundaries only provides transliterated Greek names; official Greek/English names per region.
REGION_NAMES: dict[str, dict[str, str]] = {
    "Agion Oros": {"el": "Άγιον Όρος", "en": "Mount Athos"},
    "Anatolikis Makedonias kai Thr*": {"el": "Ανατολική Μακεδονία και Θράκη", "en": "East Macedonia and Thrace"},
    "Attikis": {"el": "Αττική", "en": "Attica"},
    "Dytikis Elladas": {"el": "Δυτική Ελλάδα", "en": "Western Greece"},
    "Dytikis Makedonias": {"el": "Δυτική Μακεδονία", "en": "Western Macedonia"},
    "Ionion Nison": {"el": "Ιόνια Νησιά", "en": "Ionian Islands"},
    "Ipeiroy": {"el": "Ήπειρος", "en": "Epirus"},
    "Kentrikis Makedonias": {"el": "Κεντρική Μακεδονία", "en": "Central Macedonia"},
    "Kritis": {"el": "Κρήτη", "en": "Crete"},
    "Notioy Aigaioy": {"el": "Νότιο Αιγαίο", "en": "South Aegean"},
    "Peloponnisoy": {"el": "Πελοπόννησος", "en": "Peloponnese"},
    "Stereas Elladas": {"el": "Στερεά Ελλάδα", "en": "Central Greece"},
    "Thessalias": {"el": "Θεσσαλία", "en": "Thessaly"},
    "Voreioy Aigaioy": {"el": "Βόρειο Αιγαίο", "en": "North Aegean"},
}
