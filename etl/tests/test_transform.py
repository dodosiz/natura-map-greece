import pytest
from shapely.geometry import box, mapping

from natura_etl import transform


def _binding(code, item, en=None, el=None):
    b = {"code": {"value": code}, "item": {"value": f"http://www.wikidata.org/entity/{item}"}}
    if en:
        b["en"] = {"value": en}
    if el:
        b["el"] = {"value": el}
    return b


def test_parse_names_prefers_labelled_lowest_qid():
    names = transform.parse_names([
        _binding("GR1", "Q9"),
        _binding("GR1", "Q50", en="B"),
        _binding("GR1", "Q20", en="A"),
        _binding("GR2", "Q1", el="Χ"),
    ])
    assert names["GR1"]["wikidata"] == "Q20" and names["GR1"]["ambiguous"]
    assert names["GR2"]["name_el"] == "Χ" and not names["GR2"]["ambiguous"]


def _raw(code, geom, sitetype="SCI"):
    return {"features": [{"properties": {"sitecode": code, "sitetype": sitetype, "objectid": 1},
                          "geometry": mapping(geom)}]}


def test_build_sites_area_and_region():
    # 10 km x 10 km square in Greek Grid coordinates
    site = box(500000, 4200000, 510000, 4210000)
    region = box(495000, 4195000, 505000, 4215000)  # covers the left half of the site
    sites, geoms, links = transform.build_sites(_raw("GR1", site), {}, [("R", region)])
    rec = sites[0]
    assert rec["area_km2"] == pytest.approx(100)
    assert rec["land_share_pct"] == pytest.approx(50)
    assert rec["region_primary"] == "R"
    assert links[0]["overlap_km2"] == pytest.approx(50)
    assert 19 < rec["centroid_lon"] < 30 and 34 < rec["centroid_lat"] < 42


def test_build_regions_coverage():
    site = box(500000, 4200000, 510000, 4210000)
    region = box(500000, 4200000, 520000, 4210000)
    sites, geoms, links = transform.build_sites(_raw("GR1", site), {}, [("R", region)])
    rows, stats = transform.build_regions([("R", region)], geoms, links)
    assert rows[0]["protected_pct"] == pytest.approx(50)
    assert stats["network_land_pct"] == pytest.approx(50)
    assert rows[0]["name_en"] == "R" and rows[0]["name_el"] == "R"  # untranslated falls back to source name

    rows, _ = transform.build_regions([("Kritis", region)], geoms, links)
    assert (rows[0]["name_el"], rows[0]["name_en"]) == ("Κρήτη", "Crete")

def test_validate_rejects_small_download():
    with pytest.raises(transform.ValidationError):
        transform.validate([])
