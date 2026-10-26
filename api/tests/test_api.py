import json
import sqlite3
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "etl"))
from natura_etl.load import SCHEMA  # noqa: E402  (reuse the ETL schema as the contract)


def _poly(x):
    return json.dumps({"type": "Polygon", "coordinates": [[[x, 38], [x + 1, 38], [x + 1, 39], [x, 39], [x, 38]]]})


@pytest.fixture()
def client(tmp_path, monkeypatch):
    path = tmp_path / "t.db"
    con = sqlite3.connect(path)
    con.executescript(SCHEMA)
    rows = [("GR1", "SCI", "Alpha", 10.0, "R1", 22), ("GR2", "SPA", "Beta", 50.0, "R2", 24),
            ("GR3", "SCISPA", None, 5.0, "R1", 26)]
    for code, typ, name, area, region, x in rows:
        con.execute(
            "INSERT INTO sites (sitecode, sitetype, name_en, area_km2, region_primary, centroid_lon, centroid_lat,"
            " min_lon, min_lat, max_lon, max_lat, geom_simplified, geom_full) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (code, typ, name, area, region, x + .5, 38.5, x, 38, x + 1, 39, _poly(x), _poly(x)))
        con.execute("INSERT INTO site_regions VALUES (?,?,?)", (code, region, area))
    con.execute("INSERT INTO regions VALUES ('R1', 100, 15, 15, 2, ?)", (_poly(22),))
    con.execute("INSERT INTO stats VALUES ('network_km2', 65)")
    con.execute("INSERT INTO etl_runs (finished_at, source, n_sites, n_named, n_regions) VALUES ('now','s',3,2,1)")
    con.commit()
    con.close()
    monkeypatch.setenv("NATURA_DB_PATH", str(path))
    from app.main import app
    return TestClient(app)


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok", "sites": 3}


def test_list_filters_and_paging(client):
    r = client.get("/api/sites", params={"type": ["SCI", "SPA"], "sort": "area", "order": "desc"}).json()
    assert r["total"] == 2 and [s["sitecode"] for s in r["items"]] == ["GR2", "GR1"]
    assert client.get("/api/sites", params={"region": "R1"}).json()["total"] == 2
    assert client.get("/api/sites", params={"q": "beta"}).json()["total"] == 1
    assert client.get("/api/sites", params={"min_area": 8}).json()["total"] == 2
    assert len(client.get("/api/sites", params={"limit": 1}).json()["items"]) == 1


def test_bbox_filter(client):
    r = client.get("/api/sites", params={"bbox": "21.9,38,23.1,39"}).json()
    assert [s["sitecode"] for s in r["items"]] == ["GR1"]
    assert client.get("/api/sites", params={"bbox": "bad"}).status_code == 422


def test_geojson_route_not_shadowed(client):
    r = client.get("/api/sites/geojson", params={"type": "SPA"})
    body = r.json()
    assert body["type"] == "FeatureCollection" and len(body["features"]) == 1
    assert body["features"][0]["properties"]["sitecode"] == "GR2"


def test_site_detail(client):
    f = client.get("/api/sites/GR1").json()
    assert f["geometry"]["type"] == "Polygon" and f["properties"]["regions"][0]["region"] == "R1"
    assert client.get("/api/sites/GR1", params={"geometry": "none"}).json()["geometry"] is None
    assert client.get("/api/sites/NOPE").status_code == 404


def test_regions_and_stats(client):
    assert client.get("/api/regions").json()["features"][0]["properties"]["protected_pct"] == 15
    s = client.get("/api/stats").json()
    assert s["total_sites"] == 3 and s["by_type"]["SPA"]["count"] == 1 and s["last_etl_run"]["n_sites"] == 3


def test_missing_db_gives_503(tmp_path, monkeypatch):
    monkeypatch.setenv("NATURA_DB_PATH", str(tmp_path / "absent.db"))
    from app.main import app
    assert TestClient(app).get("/api/health").status_code == 503
