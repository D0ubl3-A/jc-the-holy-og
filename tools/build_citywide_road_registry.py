#!/usr/bin/env python3
"""Build an evidence-gated Las Vegas road registry from OpenStreetMap/Overpass.

Authoritative boundary:
- OSM way geometry/tags are source-grounded and retained with OSM IDs.
- No road is invented, snapped, widened, lane-completed, or inferred here.
- Missing lane/width/speed/oneway values remain UNKNOWN.
- Output is split deterministically by the canonical 1 km EPSG:32611 grid.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

import requests
from pyproj import Transformer
from shapely.geometry import LineString, box, mapping

OSM_LICENSE = "ODbL-1.0"
OSM_ATTRIBUTION = "© OpenStreetMap contributors"
DEFAULT_OVERPASS_URL = "https://overpass-api.de/api/interpreter"


def load_world_contract(path: Path) -> Dict[str, Any]:
    d = json.loads(path.read_text())
    if d.get("crs") != "EPSG:32611":
        raise ValueError("canonical world CRS must be EPSG:32611")
    grid = d.get("grid", {})
    bounds = d.get("bounds_utm", {})
    required = ("columns", "rows", "sections", "tile_size_m")
    if not all(k in grid for k in required):
        raise ValueError("canonical grid is incomplete")
    if not all(k in bounds for k in ("min_x", "min_y", "max_x", "max_y")):
        raise ValueError("canonical bounds are incomplete")
    return d


def world_bbox_wgs84(contract: Dict[str, Any]) -> Tuple[float, float, float, float]:
    b = contract["bounds_utm"]
    inv = Transformer.from_crs("EPSG:32611", "EPSG:4326", always_xy=True)
    corners = [
        inv.transform(b["min_x"], b["min_y"]),
        inv.transform(b["min_x"], b["max_y"]),
        inv.transform(b["max_x"], b["min_y"]),
        inv.transform(b["max_x"], b["max_y"]),
    ]
    lons = [c[0] for c in corners]
    lats = [c[1] for c in corners]
    return min(lons), min(lats), max(lons), max(lats)


def overpass_query(bbox: Tuple[float, float, float, float]) -> str:
    min_lon, min_lat, max_lon, max_lat = bbox
    # Overpass bbox order: south,west,north,east
    return f"""[out:json][timeout:180];
way[\"highway\"]({min_lat:.8f},{min_lon:.8f},{max_lat:.8f},{max_lon:.8f});
out body geom;
"""


def fetch_overpass(url: str, query: str, timeout: int = 240) -> Dict[str, Any]:
    r = requests.post(url, data={"data": query}, timeout=timeout, headers={"User-Agent": "jc-city-sprite-factory-road-registry/1.0"})
    r.raise_for_status()
    return r.json()


def parse_osm_timestamp(payload: Dict[str, Any]) -> str:
    ts = payload.get("osm3s", {}).get("timestamp_osm_base")
    if not ts:
        raise ValueError("Overpass payload lacks osm3s.timestamp_osm_base; exact source version is required")
    return str(ts)


def iter_road_ways(payload: Dict[str, Any]) -> Iterable[Dict[str, Any]]:
    for e in payload.get("elements", []):
        if e.get("type") != "way" or "highway" not in e.get("tags", {}):
            continue
        geom = e.get("geometry") or []
        if len(geom) < 2:
            continue
        yield e


def tile_id(row: int, col: int) -> str:
    return f"r{row:02d}_c{col:02d}"


def candidate_tiles(bounds: Tuple[float, float, float, float], contract: Dict[str, Any]) -> Iterable[Tuple[int, int, Any]]:
    minx, miny, maxx, maxy = bounds
    b = contract["bounds_utm"]
    g = contract["grid"]
    size = float(g["tile_size_m"])
    c0 = max(0, int(math.floor((minx - b["min_x"]) / size)))
    c1 = min(int(g["columns"]) - 1, int(math.floor((maxx - b["min_x"]) / size)))
    r0 = max(0, int(math.floor((miny - b["min_y"]) / size)))
    r1 = min(int(g["rows"]) - 1, int(math.floor((maxy - b["min_y"]) / size)))
    for row in range(r0, r1 + 1):
        for col in range(c0, c1 + 1):
            x0 = b["min_x"] + col * size
            y0 = b["min_y"] + row * size
            yield row, col, box(x0, y0, x0 + size, y0 + size)


def normalize_unknown(tags: Dict[str, Any], key: str) -> Any:
    value = tags.get(key)
    return value if value not in (None, "") else None


def build_features(payload: Dict[str, Any], contract: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
    fwd = Transformer.from_crs("EPSG:4326", "EPSG:32611", always_xy=True)
    world = box(contract["bounds_utm"]["min_x"], contract["bounds_utm"]["min_y"], contract["bounds_utm"]["max_x"], contract["bounds_utm"]["max_y"])
    features: List[Dict[str, Any]] = []
    ways_seen = 0
    ways_clipped = 0
    for way in iter_road_ways(payload):
        ways_seen += 1
        coords = [fwd.transform(float(p["lon"]), float(p["lat"])) for p in way["geometry"]]
        line = LineString(coords)
        clipped = line.intersection(world)
        if clipped.is_empty:
            continue
        ways_clipped += 1
        parts = list(clipped.geoms) if clipped.geom_type == "MultiLineString" else [clipped]
        tags = way.get("tags", {})
        per_tile_counter: Dict[str, int] = {}
        for part in parts:
            for row, col, tile_poly in candidate_tiles(part.bounds, contract):
                seg = part.intersection(tile_poly)
                if seg.is_empty:
                    continue
                segs = list(seg.geoms) if seg.geom_type == "MultiLineString" else [seg]
                for s in segs:
                    if s.geom_type != "LineString" or len(s.coords) < 2 or s.length <= 0.01:
                        continue
                    tid = tile_id(row, col)
                    idx = per_tile_counter.get(tid, 0)
                    per_tile_counter[tid] = idx + 1
                    rid = f"osm-way-{way['id']}:{tid}:{idx}"
                    props = {
                        "road_id": rid,
                        "osm_way_id": int(way["id"]),
                        "tile_id": tid,
                        "highway": tags.get("highway"),
                        "name": normalize_unknown(tags, "name"),
                        "ref": normalize_unknown(tags, "ref"),
                        "lanes": normalize_unknown(tags, "lanes"),
                        "width": normalize_unknown(tags, "width"),
                        "maxspeed": normalize_unknown(tags, "maxspeed"),
                        "oneway": normalize_unknown(tags, "oneway"),
                        "bridge": normalize_unknown(tags, "bridge"),
                        "tunnel": normalize_unknown(tags, "tunnel"),
                        "layer": normalize_unknown(tags, "layer"),
                        "surface": normalize_unknown(tags, "surface"),
                        "geometry_authority": "SOURCE-CONFIRMED_OSM",
                        "inferred_geometry": False,
                    }
                    features.append({"type": "Feature", "id": rid, "properties": props, "geometry": mapping(s)})
    features.sort(key=lambda f: f["id"])
    return features, {"osm_ways_seen": ways_seen, "osm_ways_intersecting_world": ways_clipped}


def sha256_json(data: Any) -> str:
    raw = json.dumps(data, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()


def validate_features(features: List[Dict[str, Any]], contract: Dict[str, Any]) -> Dict[str, Any]:
    ids = [f["id"] for f in features]
    duplicate_ids = len(ids) - len(set(ids))
    bad_geometry = 0
    bad_tile_ids = 0
    unknown_lane_count = 0
    valid_tiles = {tile_id(r, c) for r in range(contract["grid"]["rows"]) for c in range(contract["grid"]["columns"])}
    for f in features:
        if f["geometry"]["type"] != "LineString" or len(f["geometry"]["coordinates"]) < 2:
            bad_geometry += 1
        if f["properties"]["tile_id"] not in valid_tiles:
            bad_tile_ids += 1
        if f["properties"]["lanes"] is None:
            unknown_lane_count += 1
        if f["properties"].get("inferred_geometry") is not False:
            bad_geometry += 1
    status = "PASS_ROAD_REGISTRY_BUILT" if features and not duplicate_ids and not bad_geometry and not bad_tile_ids else "FAIL"
    return {
        "status": status,
        "road_segment_count": len(features),
        "duplicate_road_ids": duplicate_ids,
        "bad_geometry_count": bad_geometry,
        "bad_tile_ids": bad_tile_ids,
        "unknown_lane_count": unknown_lane_count,
        "hard_rules": {
            "synthetic_roads_created": 0,
            "unknown_lane_counts_filled": 0,
            "geometry_snapped_or_inferred": 0,
            "final_visual_generation_authorized": False,
        },
    }


def write_outputs(out_dir: Path, contract: Dict[str, Any], payload: Dict[str, Any], source_url: str) -> Dict[str, Any]:
    out_dir.mkdir(parents=True, exist_ok=True)
    source_version = parse_osm_timestamp(payload)
    features, stats = build_features(payload, contract)
    fc = {
        "type": "FeatureCollection",
        "name": "JC Sin City source-grounded road registry",
        "crs": {"type": "name", "properties": {"name": "EPSG:32611"}},
        "features": features,
    }
    validation = validate_features(features, contract)
    registry_path = out_dir / "road_registry.geojson"
    registry_path.write_text(json.dumps(fc, separators=(",", ":")))
    registry_sha = hashlib.sha256(registry_path.read_bytes()).hexdigest()
    report = {
        **validation,
        **stats,
        "canonical_world": {"crs": "EPSG:32611", "tile_count": contract["grid"]["sections"]},
        "source": {
            "dataset": "OpenStreetMap",
            "service": "Overpass API",
            "service_url": source_url,
            "source_version": source_version,
            "license": OSM_LICENSE,
            "attribution": OSM_ATTRIBUTION,
            "commercial_use": "PERMITTED_WITH_ODBL_OBLIGATIONS",
            "redistribution": "PERMITTED_WITH_ODBL_OBLIGATIONS",
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
        },
        "evidence_policy": {
            "centerline_geometry": "SOURCE-CONFIRMED",
            "road_tags": "SOURCE-CONFIRMED_WHEN_PRESENT",
            "lanes_width_speed": "UNKNOWN_WHEN_ABSENT",
            "lane_level_geometry": "NOT_CLAIMED",
            "right_of_way": "NOT_CLAIMED",
            "elevation_z": "NOT_JOINED",
        },
        "outputs": {"road_registry_sha256": registry_sha},
    }
    (out_dir / "validation_report.json").write_text(json.dumps(report, indent=2))
    sums = f"{registry_sha}  road_registry.geojson\n{hashlib.sha256((out_dir/'validation_report.json').read_bytes()).hexdigest()}  validation_report.json\n"
    (out_dir / "SHA256SUMS.txt").write_text(sums)
    return report


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--contract", type=Path, default=Path("world/canonical-world-contract.json"))
    ap.add_argument("--output", type=Path, default=Path("work/road-registry/output"))
    ap.add_argument("--input-overpass-json", type=Path)
    ap.add_argument("--overpass-url", default=DEFAULT_OVERPASS_URL)
    args = ap.parse_args()
    contract = load_world_contract(args.contract)
    if args.input_overpass_json:
        payload = json.loads(args.input_overpass_json.read_text())
        source_url = "OFFLINE_FIXTURE"
    else:
        bbox = world_bbox_wgs84(contract)
        payload = fetch_overpass(args.overpass_url, overpass_query(bbox))
        source_url = args.overpass_url
    report = write_outputs(args.output, contract, payload, source_url)
    print(json.dumps(report, indent=2))
    if report["status"] != "PASS_ROAD_REGISTRY_BUILT":
        raise SystemExit(2)


if __name__ == "__main__":
    main()
