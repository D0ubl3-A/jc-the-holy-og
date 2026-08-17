#!/usr/bin/env python3
import json, math, pathlib, re, sys, time
from typing import Any

import requests
from pyproj import Transformer
from shapely.geometry import Polygon
from shapely.validation import make_valid

ROOT = pathlib.Path(__file__).resolve().parent
PLAN_PATH = ROOT / "capture_plan.json"
OUT = ROOT / "playable_3d"
OUT.mkdir(parents=True, exist_ok=True)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
DEFAULT_LEVEL_M = 3.2
BUILD_REVISION = "real-climbable-8-cell-v1"


def parse_length(value: Any):
    if value is None:
        return None
    s = str(value).strip().lower().replace(",", ".")
    try:
        return float(s)
    except Exception:
        pass
    m = re.match(r"^\s*(-?\d+(?:\.\d+)?)\s*(m|meter|meters)?\s*$", s)
    if m:
        return float(m.group(1))
    m = re.match(r"^\s*(-?\d+(?:\.\d+)?)\s*(ft|feet|')\s*$", s)
    if m:
        return float(m.group(1)) * 0.3048
    m = re.match(r'^\s*(\d+)\s*[\'’]\s*(\d+(?:\.\d+)?)?\s*[\"”]?\s*$', s)
    if m:
        return float(m.group(1)) * 0.3048 + float(m.group(2) or 0) * 0.0254
    return None


def parse_num(value: Any):
    if value is None:
        return None
    try:
        return float(str(value).split(";")[0].strip())
    except Exception:
        return None


def bbox_from_plan(plan):
    boxes = [c.get("wgs84_bbox") for c in plan["cells"] if c.get("wgs84_bbox")]
    if not boxes:
        raise RuntimeError("capture_plan has no wgs84_bbox values")
    west = min(b[0] for b in boxes)
    south = min(b[1] for b in boxes)
    east = max(b[2] for b in boxes)
    north = max(b[3] for b in boxes)
    return west, south, east, north


def query_osm(west, south, east, north):
    q = f'''[out:json][timeout:90];
(
  way["building"]({south},{west},{north},{east});
  way["highway"]({south},{west},{north},{east});
);
out tags geom;'''
    headers = {"User-Agent": "jc-las-vegas-real-city-chunk/1.0 (GitHub Actions production build)"}
    last = None
    for attempt in range(5):
        try:
            r = requests.post(OVERPASS_URL, data={"data": q}, headers=headers, timeout=120)
            r.raise_for_status()
            payload = r.json()
            if not isinstance(payload.get("elements"), list):
                raise RuntimeError("Overpass response has no elements array")
            return payload
        except Exception as exc:
            last = exc
            if attempt == 4:
                raise
            time.sleep(2 ** attempt)
    raise last


def infer_building_height(tags, area_m2):
    h = parse_length(tags.get("height"))
    min_h = parse_length(tags.get("min_height")) or 0.0
    roof_h = parse_length(tags.get("roof:height")) or 0.0
    levels = parse_num(tags.get("building:levels"))
    if h and h > min_h + 1:
        return round(h, 2), round(min_h, 2), "osm_height_tag", levels
    if levels and levels > 0:
        h = levels * DEFAULT_LEVEL_M + roof_h
        return round(max(h, DEFAULT_LEVEL_M), 2), round(min_h, 2), "derived_from_osm_levels", levels
    kind = str(tags.get("building", "yes"))
    if kind in {"hotel", "commercial", "office", "retail"}:
        base = 12.0
    elif kind in {"apartments", "residential"}:
        base = 9.6
    elif kind in {"garage", "garages", "shed", "carport"}:
        base = 3.2
    else:
        base = 6.4
    if area_m2 > 4000:
        base = max(base, 16.0)
    elif area_m2 > 1500:
        base = max(base, 12.0)
    elif area_m2 < 80:
        base = min(base, 4.0)
    return round(base, 2), round(min_h, 2), "estimated_missing_osm_height", None


def road_width(tags):
    tagged = parse_length(tags.get("width"))
    if tagged and tagged > 1:
        return round(tagged, 2), "osm_width_tag"
    lanes = parse_num(tags.get("lanes"))
    if lanes and lanes > 0:
        return round(max(3.0, lanes * 3.5), 2), "derived_from_osm_lanes"
    cls = str(tags.get("highway", "road"))
    defaults = {
        "motorway": 28, "motorway_link": 14, "trunk": 24, "trunk_link": 12,
        "primary": 20, "primary_link": 10, "secondary": 16, "secondary_link": 9,
        "tertiary": 12, "residential": 8, "service": 6, "living_street": 6,
        "pedestrian": 7, "footway": 2.2, "cycleway": 2.5, "path": 1.8,
    }
    return float(defaults.get(cls, 7)), "class_default_estimate"


def main():
    plan = json.loads(PLAN_PATH.read_text())
    if plan.get("mode") != "production_real_only" or plan.get("strict_no_synthetic") is not True:
        raise RuntimeError("Refusing to build playable chunk from non-production plan")
    west, south, east, north = bbox_from_plan(plan)
    source_crs = plan.get("source_crs", "EPSG:32611")
    origin = plan.get("world_origin", {}).get("projected")
    if not origin or len(origin) != 2:
        raise RuntimeError("capture_plan missing projected world origin")
    tx = Transformer.from_crs("EPSG:4326", source_crs, always_xy=True)

    raw = query_osm(west, south, east, north)
    (OUT / "overpass_source.json").write_text(json.dumps(raw))

    buildings = []
    roads = []
    skipped = {"open_building_ways": 0, "invalid_buildings": 0, "short_roads": 0}
    height_sources = {}
    width_sources = {}

    def world(lon, lat):
        x, y = tx.transform(float(lon), float(lat))
        return [round(x - origin[0], 3), round(y - origin[1], 3)]

    for el in raw.get("elements", []):
        tags = el.get("tags") or {}
        geom = el.get("geometry") or []
        if len(geom) < 2:
            continue
        pts = [world(p["lon"], p["lat"]) for p in geom]
        if "building" in tags:
            if len(pts) < 4 or math.hypot(pts[0][0]-pts[-1][0], pts[0][1]-pts[-1][1]) > 0.5:
                skipped["open_building_ways"] += 1
                continue
            try:
                poly = Polygon(pts)
                if not poly.is_valid:
                    poly = make_valid(poly)
                if poly.is_empty or poly.geom_type != "Polygon" or poly.area < 8:
                    skipped["invalid_buildings"] += 1
                    continue
                coords = [[round(x,3), round(y,3)] for x,y in poly.exterior.coords]
                area = float(poly.area)
            except Exception:
                skipped["invalid_buildings"] += 1
                continue
            height, min_height, source, levels = infer_building_height(tags, area)
            height_sources[source] = height_sources.get(source, 0) + 1
            buildings.append({
                "osm_id": el.get("id"), "footprint_xz": coords, "height_m": height,
                "min_height_m": min_height, "height_source": source, "levels": levels,
                "building": tags.get("building", "yes"), "name": tags.get("name"),
                "roof_shape": tags.get("roof:shape", "flat"),
                "roof_height_m": parse_length(tags.get("roof:height")) or 0.0,
                "material": tags.get("building:material"), "colour": tags.get("building:colour"),
                "area_m2": round(area, 2),
                "climb": {"roof_standable": True, "edge_grab": True, "wall_climb": height <= 45.0,
                          "mantle_height_m": 1.45, "ledge_spacing_m": DEFAULT_LEVEL_M if levels else None},
                "tags": {k: v for k, v in tags.items() if k in {"building", "name", "height", "min_height", "building:levels", "roof:shape", "roof:height", "building:material", "building:colour"}}
            })
        elif "highway" in tags:
            width, source = road_width(tags)
            width_sources[source] = width_sources.get(source, 0) + 1
            roads.append({"osm_id": el.get("id"), "centerline_xz": pts, "highway": tags.get("highway"),
                          "name": tags.get("name"), "width_m": width, "width_source": source,
                          "lanes": parse_num(tags.get("lanes")), "oneway": tags.get("oneway") in {"yes", "1", "true"},
                          "surface": tags.get("surface"), "bridge": tags.get("bridge") not in {None, "no"},
                          "tunnel": tags.get("tunnel") not in {None, "no"}})

    chunk = {
        "schema": "jc-real-climbable-city-chunk/1.0", "build_revision": BUILD_REVISION,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": {"geometry": "OpenStreetMap via Overpass API", "overpass_url": OVERPASS_URL,
                   "license": "ODbL 1.0", "attribution": "© OpenStreetMap contributors",
                   "imagery": "USGS/USDA NAIP tiles are a separate ground-texture layer"},
        "crs": source_crs, "axis": {"x": "east", "z": "north", "y": "up"},
        "world_origin_projected": origin, "coverage_wgs84": [west, south, east, north],
        "cell_count": plan.get("cell_count", len(plan.get("cells", []))),
        "buildings": buildings, "roads": roads,
        "accuracy_contract": {"building_footprints": "OSM geometry", "road_centerlines": "OSM geometry",
                              "height_osm_height_tag": "authoritative OSM tag when present",
                              "height_derived_from_osm_levels": "derived at 3.2 m per tagged level plus roof height",
                              "height_estimated_missing_osm_height": "visual/gameplay estimate; not claimed real",
                              "road_width": "OSM width tag, lane-derived width, or explicitly flagged class estimate"}
    }
    (OUT / "real_city_chunk.json").write_text(json.dumps(chunk, separators=(",", ":")))
    (OUT / "real_city_chunk.pretty.json").write_text(json.dumps(chunk, indent=2))
    (OUT / "real-city-chunk-data.js").write_text("window.JC_REAL_CITY_CHUNK=" + json.dumps(chunk, separators=(",", ":")) + ";\n")
    report = {"status": "PASS" if buildings and roads else "FAIL_EMPTY_GEOMETRY", "build_revision": BUILD_REVISION,
              "cells": chunk["cell_count"], "buildings": len(buildings), "roads": len(roads),
              "height_sources": height_sources, "road_width_sources": width_sources, "skipped": skipped,
              "coverage_wgs84": chunk["coverage_wgs84"], "real_footprints": len(buildings),
              "climbable_roofs": sum(1 for b in buildings if b["climb"]["roof_standable"]),
              "wall_climb_enabled": sum(1 for b in buildings if b["climb"]["wall_climb"])}
    (OUT / "real_city_chunk_report.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    return 0 if report["status"] == "PASS" else 2


if __name__ == "__main__":
    sys.exit(main())
