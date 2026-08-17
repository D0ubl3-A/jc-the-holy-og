#!/usr/bin/env python3
import json
import pathlib
import time

from pyproj import Transformer
from shapely.geometry import LineString, Point, Polygon, box
from shapely.validation import make_valid

import build_real_climbable_chunk as base

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "legacy_playable_3d"
OUT.mkdir(parents=True, exist_ok=True)

CRS = "EPSG:26911"
GRID_ORIGIN_X = 632576.0
GRID_ORIGIN_Y = 3965696.0
CELL_SIZE = 256.0
ROWS = range(126, 130)
COLS = range(123, 127)
# Same WGS84 anchor used by the newer real-city chunk, transformed into NAD83 / UTM 11N.
# Keeping one shared origin prevents separately built sectors from overlapping at local (0,0).
WORLD_ORIGIN_WGS84 = [-115.1398, 36.1699]
WORLD_ORIGIN = [667304.0470097195, 4004396.3146858704]


def cell_id(row, col):
    return f"r{row:04d}_c{col:04d}"


def legacy_alias(row, col):
    return f"r{row-126:04d}_c{col-123:04d}"


def projected_cell(row, col):
    x0 = GRID_ORIGIN_X + col * CELL_SIZE
    y0 = GRID_ORIGIN_Y + row * CELL_SIZE
    return box(x0, y0, x0 + CELL_SIZE, y0 + CELL_SIZE)


def local_point(x, y):
    return [round(x - WORLD_ORIGIN[0], 3), round(y - WORLD_ORIGIN[1], 3)]


def candidate_cells(geom):
    out = []
    for row in ROWS:
        for col in COLS:
            if geom.intersects(projected_cell(row, col)):
                out.append(cell_id(row, col))
    return out


def owner_cell(point):
    for row in ROWS:
        for col in COLS:
            if projected_cell(row, col).covers(point):
                return cell_id(row, col)
    return None


def main():
    tx_to_wgs84 = Transformer.from_crs(CRS, "EPSG:4326", always_xy=True)
    tx_from_wgs84 = Transformer.from_crs("EPSG:4326", CRS, always_xy=True)

    # Verify the documented shared WGS84 origin still transforms to the stored projected anchor.
    ox, oy = tx_from_wgs84.transform(*WORLD_ORIGIN_WGS84)
    if abs(ox - WORLD_ORIGIN[0]) > 0.05 or abs(oy - WORLD_ORIGIN[1]) > 0.05:
        raise SystemExit("Shared world-origin transform drifted; refusing misaligned legacy build")

    cells = []
    union = None
    for row in ROWS:
        for col in COLS:
            poly = projected_cell(row, col)
            union = poly if union is None else union.union(poly)
            minx, miny, maxx, maxy = poly.bounds
            west, south = tx_to_wgs84.transform(minx, miny)
            east, north = tx_to_wgs84.transform(maxx, maxy)
            cells.append({
                "cell_id": cell_id(row, col),
                "legacy_prototype_id": legacy_alias(row, col),
                "row": row,
                "column": col,
                "projected_bbox": [minx, miny, maxx, maxy],
                "wgs84_bbox": [west, south, east, north],
                "world_offset_xz": [round(minx - WORLD_ORIGIN[0], 3), round(miny - WORLD_ORIGIN[1], 3)],
            })

    minx, miny, maxx, maxy = union.bounds
    pad = 8.0
    west, south = tx_to_wgs84.transform(minx - pad, miny - pad)
    east, north = tx_to_wgs84.transform(maxx + pad, maxy + pad)
    raw = base.query_osm(west, south, east, north)
    (OUT / "overpass_source.json").write_text(json.dumps(raw))

    buildings, roads, barriers, gates = [], [], [], []
    stats = {
        "invalid_buildings": 0,
        "outside_geometry": 0,
        "height_sources": {},
        "road_width_sources": {},
        "barrier_height_sources": {},
    }

    def project_geom(el):
        pts = []
        for p in el.get("geometry") or []:
            x, y = tx_from_wgs84.transform(float(p["lon"]), float(p["lat"]))
            pts.append((x, y))
        return pts

    for el in raw.get("elements", []):
        tags = el.get("tags") or {}
        if el.get("type") == "node" and tags.get("barrier") in {"gate", "lift_gate", "swing_gate"}:
            if "lon" not in el or "lat" not in el:
                continue
            x, y = tx_from_wgs84.transform(float(el["lon"]), float(el["lat"]))
            pt = Point(x, y)
            cid = owner_cell(pt)
            if not cid:
                continue
            gates.append({
                "osm_id": el.get("id"),
                "cell_id": cid,
                "position_xz": local_point(x, y),
                "barrier": tags.get("barrier"),
                "access": tags.get("access"),
                "locked": tags.get("locked"),
                "gameplay": {"passable": base.access_open(tags), "dynamic_gate": True, "blocks_when_locked": True},
            })
            continue

        pts = project_geom(el)
        if len(pts) < 2:
            continue

        if "building" in tags:
            if len(pts) < 4 or Point(pts[0]).distance(Point(pts[-1])) > 0.5:
                stats["invalid_buildings"] += 1
                continue
            poly = Polygon(pts)
            if not poly.is_valid:
                poly = make_valid(poly)
            if poly.is_empty or poly.geom_type != "Polygon" or poly.area < 8 or not poly.intersects(union):
                stats["invalid_buildings"] += 1
                continue
            centroid = poly.centroid
            cid = owner_cell(centroid)
            if not cid:
                matches = candidate_cells(poly)
                cid = matches[0] if matches else None
            if not cid:
                stats["outside_geometry"] += 1
                continue
            h, min_h, hs, levels = base.infer_building_height(tags, float(poly.area))
            stats["height_sources"][hs] = stats["height_sources"].get(hs, 0) + 1
            buildings.append({
                "osm_id": el.get("id"),
                "cell_id": cid,
                "intersects_cell_ids": candidate_cells(poly),
                "footprint_xz": [local_point(x, y) for x, y in poly.exterior.coords],
                "height_m": h,
                "min_height_m": min_h,
                "height_source": hs,
                "levels": levels,
                "building": tags.get("building", "yes"),
                "name": tags.get("name"),
                "roof_shape": tags.get("roof:shape", "flat"),
                "roof_height_m": base.parse_length(tags.get("roof:height")) or 0.0,
                "area_m2": round(float(poly.area), 2),
                "climb": {
                    "roof_standable": True,
                    "edge_grab": True,
                    "wall_climb": h <= 45.0,
                    "mantle_height_m": 1.45,
                    "ledge_spacing_m": base.DEFAULT_LEVEL_M if levels else None,
                },
            })
        elif "highway" in tags:
            line = LineString(pts)
            if not line.intersects(union):
                continue
            width, ws = base.road_width(tags)
            stats["road_width_sources"][ws] = stats["road_width_sources"].get(ws, 0) + 1
            roads.append({
                "osm_id": el.get("id"),
                "cell_ids": candidate_cells(line),
                "centerline_xz": [local_point(x, y) for x, y in pts],
                "highway": tags.get("highway"),
                "name": tags.get("name"),
                "width_m": width,
                "width_source": ws,
                "lanes": base.parse_num(tags.get("lanes")),
                "oneway": tags.get("oneway") in {"yes", "1", "true"},
                "surface": tags.get("surface"),
            })
        elif tags.get("barrier") in {"fence", "wall", "retaining_wall", "hedge"}:
            line = LineString(pts)
            if not line.intersects(union):
                continue
            h, hs = base.barrier_height(tags)
            stats["barrier_height_sources"][hs] = stats["barrier_height_sources"].get(hs, 0) + 1
            vaultable = h <= base.VAULT_MAX_M and tags.get("barrier") != "hedge"
            climbable = h <= base.CLIMB_BARRIER_MAX_M and tags.get("barrier") != "hedge"
            barriers.append({
                "osm_id": el.get("id"),
                "cell_ids": candidate_cells(line),
                "line_xz": [local_point(x, y) for x, y in pts],
                "barrier": tags.get("barrier"),
                "height_m": h,
                "height_source": hs,
                "fence_type": tags.get("fence_type"),
                "material": tags.get("material"),
                "gameplay": {
                    "blocks_player": True,
                    "vaultable": vaultable,
                    "hoppable": vaultable,
                    "climbable": climbable,
                    "vault_max_height_m": base.VAULT_MAX_M,
                    "requires_jump_input": True,
                },
            })

    per_cell = {}
    for c in cells:
        cid = c["cell_id"]
        per_cell[cid] = {
            "building_ids": [b["osm_id"] for b in buildings if b["cell_id"] == cid],
            "road_ids": [r["osm_id"] for r in roads if cid in r["cell_ids"]],
            "barrier_ids": [b["osm_id"] for b in barriers if cid in b["cell_ids"]],
            "gate_ids": [g["osm_id"] for g in gates if g["cell_id"] == cid],
        }

    dataset = {
        "schema": "jc-legacy-real-city-prototype/1.0",
        "build_revision": "legacy-16-real-climbable-barriers-v2-shared-origin",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": {
            "geometry": "OpenStreetMap via Overpass API",
            "license": "ODbL 1.0",
            "attribution": "© OpenStreetMap contributors",
        },
        "grid": {
            "projected_crs": CRS,
            "grid_origin_projected": [GRID_ORIGIN_X, GRID_ORIGIN_Y],
            "cell_size_m": CELL_SIZE,
            "world_origin_wgs84": WORLD_ORIGIN_WGS84,
            "world_origin_projected": WORLD_ORIGIN,
            "rows": [126, 129],
            "columns": [123, 126],
            "cell_count": 16,
        },
        "cells": cells,
        "cell_index": per_cell,
        "buildings": buildings,
        "roads": roads,
        "barriers": barriers,
        "gates": gates,
        "accuracy_contract": {
            "legacy_ids": "preserved exactly; r0000_c0000..r0003_c0003 remain aliases for r0126_c0123..r0129_c0126",
            "xy_geometry": "OSM geometry transformed into EPSG:26911 and expressed relative to the shared game-world WGS84 origin",
            "building_height": "OSM height when tagged, level-derived when tagged, otherwise explicitly estimated",
            "barrier_traversal": "mapped barriers <=1.65m are hoppable; <=2.40m are climbable; taller mapped barriers block",
        },
    }

    report = {
        "status": "PASS" if buildings and roads else "FAIL_EMPTY_GEOMETRY",
        "cells": 16,
        "buildings": len(buildings),
        "roads": len(roads),
        "barriers": len(barriers),
        "gates": len(gates),
        "hoppable_barriers": sum(1 for b in barriers if b["gameplay"]["hoppable"]),
        "climbable_barriers": sum(1 for b in barriers if b["gameplay"]["climbable"]),
        "standable_roofs": len(buildings),
        "wall_climb_buildings": sum(1 for b in buildings if b["climb"]["wall_climb"]),
        "world_origin_wgs84": WORLD_ORIGIN_WGS84,
        "world_origin_projected": WORLD_ORIGIN,
        **stats,
    }

    (OUT / "legacy_prototype_real_city.json").write_text(json.dumps(dataset, separators=(",", ":")))
    (OUT / "legacy_prototype_real_city.pretty.json").write_text(json.dumps(dataset, indent=2))
    (OUT / "legacy_prototype_real_city_report.json").write_text(json.dumps(report, indent=2))
    (OUT / "legacy-prototype-real-city-data.js").write_text("window.JC_LEGACY_REAL_CITY=" + json.dumps(dataset, separators=(",", ":")) + ";\n")
    print(json.dumps(report, indent=2))
    return 0 if report["status"] == "PASS" else 2


if __name__ == "__main__":
    raise SystemExit(main())
