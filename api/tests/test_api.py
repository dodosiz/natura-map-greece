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
    con.execute("INSERT INTO regions (name, name_el, name_en, area_km2, protected_km2, protected_pct, n_sites, geometry) "
                "VALUES ('R1', 'Περιφέρεια 1', 'Region 1', 100, 15, 15, 2, ?)", (_poly(22),))
    con.execute("INSERT INTO stats VALUES ('network_km2', 65)")
    con.execute("INSERT INTO etl_runs (finished_at, source, n_sites, n_named, n_regions) VALUES ('now','s',3,2,1)")
    con.commit()
    con.close()
    monkeypatch.setenv("NATURA_DB_PATH", str(path))
    from app.main import app
    return TestClient(app)


def test_sites_geojson(client):
    body = client.get("/api/sites/geojson").json()
    assert body["type"] == "FeatureCollection" and len(body["features"]) == 3
    f = next(x for x in body["features"] if x["id"] == "GR2")
    assert f["geometry"]["type"] == "Polygon"
    assert f["properties"]["sitetype"] == "SPA" and "geom_simplified" not in f["properties"]


def test_removed_endpoints_are_gone(client):
    assert client.get("/api/health").status_code == 404
    assert client.get("/api/sites").status_code == 404
    assert client.get("/api/sites/GR1").status_code == 404


def test_regions_and_stats(client):
    assert client.get("/api/regions").json()["features"][0]["properties"]["protected_pct"] == 15
    s = client.get("/api/stats").json()
    assert s["total_sites"] == 3 and s["by_type"]["SPA"]["count"] == 1 and s["last_etl_run"]["n_sites"] == 3


def test_legal_pages_serve_frontend_entrypoint(client, tmp_path, monkeypatch):
    from app import main

    frontend = tmp_path / "static"
    frontend.mkdir()
    (frontend / "index.html").write_text("<html>legal app</html>", encoding="utf-8")
    monkeypatch.setattr(main, "frontend_dir", frontend)

    for path in ("/privacy", "/imprint"):
        response = client.get(path)
        assert response.status_code == 200
        assert response.text == "<html>legal app</html>"


def test_missing_db_gives_503(tmp_path, monkeypatch):
    monkeypatch.setenv("NATURA_DB_PATH", str(tmp_path / "absent.db"))
    from app.main import app
    assert TestClient(app).get("/api/stats").status_code == 503
