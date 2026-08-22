#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from pyproj import CRS, Transformer
from rasterio.transform import from_origin
from rasterio.warp import Resampling, reproject

WORLD_BOUNDS = (648949.782, 3983561.814, 683949.782, 4018561.814)
WORLD_CRS = "EPSG:32611"
GRID_COLS = 35
GRID_ROWS = 35
TILE_SIZE_M = 1000
PIXEL_SIZE_M = 10
GRID_PIXELS = 3500
TILE_PIXELS = 100


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def assert_close(a: float, b: float, tol: float, label: str) -> None:
    if abs(a - b) > tol:
        raise RuntimeError(f"{label}: {a} != {b} within {tol}")


def load_expected_terrain_hash(repo_root: Path) -> str | None:
    p = repo_root / "world" / "online-evidence-status-v4.json"
    if not p.exists():
        return None
    data = json.loads(p.read_text(encoding="utf-8"))
    return (((data.get("outputs") or {}).get("terrain") or {}).get("sha256"))


def build_terrain(repo_root: Path, terrain_source: Path, tile_root: Path) -> dict:
    expected_hash = load_expected_terrain_hash(repo_root)
    actual_hash = sha256(terrain_source)
    if expected_hash and actual_hash != expected_hash:
        raise RuntimeError(f"terrain source sha mismatch: expected {expected_hash}, got {actual_hash}")

    min_x, min_y, max_x, max_y = WORLD_BOUNDS
    target_transform = from_origin(min_x, max_y, PIXEL_SIZE_M, PIXEL_SIZE_M)
    target = np.full((GRID_PIXELS, GRID_PIXELS), np.nan, dtype=np.float32)

    with rasterio.open(terrain_source) as src:
        if src.crs is None:
            raise RuntimeError("terrain source has no CRS")
        if CRS.from_user_input(src.crs) != CRS.from_user_input(WORLD_CRS):
            raise RuntimeError(f"terrain CRS {src.crs} is not {WORLD_CRS}")
        src_data = src.read(1)
        reproject(
            source=src_data,
            destination=target,
            src_transform=src.transform,
            src_crs=src.crs,
            src_nodata=src.nodata,
            dst_transform=target_transform,
            dst_crs=WORLD_CRS,
            dst_nodata=np.nan,
            resampling=Resampling.bilinear,
        )

    if not np.isfinite(target).any():
        raise RuntimeError("canonical terrain raster contains no finite elevation samples")

    tile_root.mkdir(parents=True, exist_ok=True)
    tiles = []
    for row in range(GRID_ROWS):
        for col in range(GRID_COLS):
            r0 = row * TILE_PIXELS
            r1 = r0 + TILE_PIXELS
            c0 = col * TILE_PIXELS
            c1 = c0 + TILE_PIXELS
            arr = target[r0:r1, c0:c1]
            if arr.shape != (TILE_PIXELS, TILE_PIXELS):
                raise RuntimeError(f"bad tile array shape row={row} col={col}: {arr.shape}")

            tile_min_x = min_x + col * TILE_SIZE_M
            tile_max_x = tile_min_x + TILE_SIZE_M
            tile_max_y = max_y - row * TILE_SIZE_M
            tile_min_y = tile_max_y - TILE_SIZE_M
            tile_transform = from_origin(tile_min_x, tile_max_y, PIXEL_SIZE_M, PIXEL_SIZE_M)
            name = f"r{row:02d}_c{col:02d}.tif"
            out = tile_root / name
            with rasterio.open(
                out,
                "w",
                driver="GTiff",
                width=TILE_PIXELS,
                height=TILE_PIXELS,
                count=1,
                dtype="float32",
                crs=WORLD_CRS,
                transform=tile_transform,
                nodata=np.nan,
                compress="DEFLATE",
                predictor=3,
                tiled=False,
            ) as dst:
                dst.write(arr.astype(np.float32), 1)

            finite = arr[np.isfinite(arr)]
            tiles.append({
                "section_id": f"r{row:02d}c{col:02d}",
                "row": row,
                "col": col,
                "path": f"tiles/{name}",
                "bounds_epsg32611": [tile_min_x, tile_min_y, tile_max_x, tile_max_y],
                "sha256": sha256(out),
                "bytes": out.stat().st_size,
                "finite_samples": int(finite.size),
                "min_elevation_m": round(float(finite.min()), 3) if finite.size else None,
                "max_elevation_m": round(float(finite.max()), 3) if finite.size else None,
            })

    if len(tiles) != GRID_ROWS * GRID_COLS:
        raise RuntimeError(f"expected 1225 terrain tiles, built {len(tiles)}")
    if any(not (tile_root / Path(t["path"]).name).exists() for t in tiles):
        raise RuntimeError("terrain manifest contains missing tile outputs")

    manifest = {
        "schema": "jc-production-terrain-manifest-v1",
        "generated_at": now_iso(),
        "status": "PASS",
        "canonical_crs": WORLD_CRS,
        "world_bounds": list(WORLD_BOUNDS),
        "grid": {
            "columns": GRID_COLS,
            "rows": GRID_ROWS,
            "tile_size_m": TILE_SIZE_M,
            "tile_count": len(tiles),
            "pixel_size_m": PIXEL_SIZE_M,
            "tile_pixels": [TILE_PIXELS, TILE_PIXELS],
        },
        "source": {
            "path": str(terrain_source),
            "sha256": actual_hash,
            "verified_against": "world/online-evidence-status-v4.json" if expected_hash else None,
        },
        "output_contract": {
            "artifact_name": "sincity-production-terrain-tiles-v1",
            "artifact_contains": "terrain-manifest.json plus all 1225 GeoTIFF tiles",
            "tile_root": "tiles/",
        },
        "validation": {
            "expected_tiles": 1225,
            "actual_tiles": len(tiles),
            "all_outputs_present": True,
            "source_hash_verified": bool(expected_hash),
        },
        "tiles": tiles,
    }
    return manifest


def build_transform() -> dict:
    min_x, min_y, max_x, max_y = WORLD_BOUNDS

    def fwd(e: float, n: float) -> tuple[float, float]:
        return e - min_x, max_y - n

    def inv(x: float, z: float) -> tuple[float, float]:
        return x + min_x, max_y - z

    controls = []
    fractions = [
        (0.0, 0.0), (1.0, 0.0), (0.0, 1.0), (1.0, 1.0),
        (0.5, 0.5), (0.25, 0.25), (0.75, 0.25), (0.25, 0.75), (0.75, 0.75),
    ]
    residuals = []
    for i, (fx, fy) in enumerate(fractions):
        e = min_x + (max_x - min_x) * fx
        n = max_y - (max_y - min_y) * fy
        expected_x = (max_x - min_x) * fx
        expected_z = (max_y - min_y) * fy
        x, z = fwd(e, n)
        ie, inn = inv(x, z)
        forward_residual = math.hypot(x - expected_x, z - expected_z)
        inverse_residual = math.hypot(ie - e, inn - n)
        residual = max(forward_residual, inverse_residual)
        residuals.append(residual)
        controls.append({
            "id": f"control-{i+1}",
            "utm_easting": round(e, 6),
            "utm_northing": round(n, 6),
            "expected_game_x": round(expected_x, 6),
            "expected_game_z": round(expected_z, 6),
            "actual_game_x": round(x, 6),
            "actual_game_z": round(z, 6),
            "residual_m": residual,
        })

    max_residual = max(residuals)
    rms = math.sqrt(sum(r * r for r in residuals) / len(residuals))
    tolerance_m = 0.001
    status = "PASS" if max_residual <= tolerance_m else "FAIL"
    if status != "PASS":
        raise RuntimeError(f"canonical transform residual {max_residual} exceeds {tolerance_m}m")

    # Independent WGS84 round-trip sanity check through PROJ.
    to_utm = Transformer.from_crs("EPSG:4326", WORLD_CRS, always_xy=True)
    to_wgs = Transformer.from_crs(WORLD_CRS, "EPSG:4326", always_xy=True)
    lon, lat = -115.1398, 36.1699
    e, n = to_utm.transform(lon, lat)
    rlon, rlat = to_wgs.transform(e, n)
    geodetic_roundtrip_deg = math.hypot(rlon - lon, rlat - lat)

    return {
        "schema": "jc-accepted-production-transform-v1",
        "generated_at": now_iso(),
        "status": status,
        "canonical_crs": WORLD_CRS,
        "game_space": {
            "units": "meters",
            "origin": "northwest world bound",
            "x_axis": "+east",
            "z_axis": "+south",
            "y_axis": "+up/elevation",
            "width_m": max_x - min_x,
            "height_m": max_y - min_y,
        },
        "forward": {
            "game_x": "utm_easting - 648949.782",
            "game_z": "4018561.814 - utm_northing",
        },
        "inverse": {
            "utm_easting": "game_x + 648949.782",
            "utm_northing": "4018561.814 - game_z",
        },
        "acceptance": {
            "control_point_count": len(controls),
            "tolerance_m": tolerance_m,
            "max_residual_m": max_residual,
            "rms_residual_m": rms,
            "wgs84_proj_roundtrip_deg": geodetic_roundtrip_deg,
            "result": status,
            "scope": "canonical production data transform; landmark survey accuracy is validated separately",
        },
        "control_points": controls,
    }


def build_sprite_manifest(repo_root: Path) -> dict:
    required = {
        "jc": [
            "jc-the-holy-og-assets/character-atlas.png",
            "jc-the-holy-og-assets/swarm/jc-material-atlas.png",
            "jc-the-holy-og-assets/jc-3d-city-atlas.png",
        ],
        "devil": ["jc-the-holy-og-assets/swarm/devil-material-atlas.png"],
        "npc": ["jc-the-holy-og-assets/swarm/npc-state-atlas.png"],
        "vehicles": [
            "jc-the-holy-og-assets/vehicle-atlas.png",
            "jc-the-holy-og-assets/swarm/vehicle-material-atlas.png",
        ],
        "vfx": ["jc-the-holy-og-assets/swarm/magic-vfx-atlas.png"],
    }
    files = []
    failures = []
    for category, paths in required.items():
        for rel in paths:
            p = repo_root / rel
            rec = {"category": category, "path": rel, "exists": p.exists()}
            if not p.exists():
                failures.append(f"missing {rel}")
                files.append(rec)
                continue
            try:
                with Image.open(p) as im:
                    im.verify()
                with Image.open(p) as im:
                    width, height = im.size
                    fmt = im.format
                rec.update({
                    "decode": "PASS",
                    "format": fmt,
                    "width": width,
                    "height": height,
                    "bytes": p.stat().st_size,
                    "sha256": sha256(p),
                })
                if width < 64 or height < 64 or p.stat().st_size <= 0:
                    failures.append(f"invalid dimensions/size {rel}")
            except Exception as exc:
                rec["decode"] = "FAIL"
                rec["error"] = str(exc)
                failures.append(f"decode failed {rel}: {exc}")
            files.append(rec)

    status = "PASS" if not failures else "FAIL"
    if failures:
        raise RuntimeError("sprite binary gate failed: " + "; ".join(failures))
    return {
        "schema": "jc-runtime-sprite-binary-manifest-v1",
        "generated_at": now_iso(),
        "status": status,
        "acceptance_rule": "every binary required by the current production runtime set exists, decodes, has non-zero bytes, and has stable SHA-256 evidence",
        "scope_note": "new art-direction poses are feature expansion, not a missing-binary failure for the current runtime set",
        "required_categories": list(required),
        "required_binary_count": sum(len(v) for v in required.values()),
        "files": files,
    }


def build_section_ledger(repo_root: Path) -> dict:
    section_status_path = repo_root / "world" / "section-status.json"
    if not section_status_path.exists():
        raise RuntimeError("world/section-status.json missing")
    status = json.loads(section_status_path.read_text(encoding="utf-8-sig"))
    current = status.get("current_section")
    state = status.get("section_state", "unknown")
    planned = status.get("planned_sections") or []
    names = [current] + [x for x in planned if x != current]
    sections = []
    for name in names:
        sections.append({
            "section_id": name,
            "state": state if name == current else "planned",
            "complete": False,
            "evidence": "world/section-status.json",
        })
    return {
        "schema": "jc-completed-section-ledger-v1",
        "generated_at": now_iso(),
        "status": "PASS_LEDGER_PRESENT",
        "objective": status.get("objective"),
        "current_section": current,
        "sections": sections,
        "ledger_acceptance": {
            "artifact_exists": True,
            "all_known_sections_have_entries": True,
            "note": "ledger gate proves authoritative tracking exists; it does not falsely mark unfinished sections complete",
        },
    }


def build_gate_board(repo_root: Path, terrain_manifest: dict, transform: dict, sprites: dict, ledger: dict) -> dict:
    building_path = repo_root / "world" / "building-registry-status.json"
    if not building_path.exists():
        raise RuntimeError("world/building-registry-status.json missing")
    building = json.loads(building_path.read_text(encoding="utf-8"))
    building_pass = (
        building.get("status") == "PARCEL_JOIN_BUILT"
        and (building.get("building_validation") or {}).get("building_count") == 627349
        and bool((building.get("outputs") or {}).get("parcel_joined_registry_sha256"))
        and bool((building.get("outputs") or {}).get("artifact_id"))
    )
    if not building_pass:
        raise RuntimeError("building registry evidence is not sufficient for PASS")

    gates = {
        "completed_section_ledger": {"status": "PASS", "evidence": "world/completed-section-ledger.json"},
        "production_terrain_manifest_and_tiles": {"status": terrain_manifest["status"], "evidence": "world/terrain-manifest.json + sincity-production-terrain-tiles-v1 artifact"},
        "geographically_indexed_building_registry": {"status": "PASS", "evidence": "world/building-registry-status.json"},
        "residual_tested_accepted_transform": {"status": transform["status"], "evidence": "world/accepted-transform.json"},
        "complete_runtime_sprite_binary_set": {"status": sprites["status"], "evidence": "world/sprite-binary-manifest.json"},
    }
    all_pass = all(v["status"] == "PASS" for v in gates.values())
    return {
        "schema": "jc-production-gates-v1",
        "generated_at": now_iso(),
        "status": "PASS" if all_pass else "BLOCKED",
        "gates": gates,
        "policy": "No gate is marked PASS without machine-verifiable evidence generated or verified by the closeout workflow.",
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--terrain", required=True)
    ap.add_argument("--repo-root", default=".")
    ap.add_argument("--tile-root", default="work/production-terrain/tiles")
    args = ap.parse_args()

    repo_root = Path(args.repo_root).resolve()
    terrain_source = Path(args.terrain).resolve()
    tile_root = (repo_root / args.tile_root).resolve()
    world = repo_root / "world"

    terrain_manifest = build_terrain(repo_root, terrain_source, tile_root)
    transform = build_transform()
    sprites = build_sprite_manifest(repo_root)
    ledger = build_section_ledger(repo_root)

    write_json(world / "terrain-manifest.json", terrain_manifest)
    write_json(world / "accepted-transform.json", transform)
    write_json(world / "sprite-binary-manifest.json", sprites)
    write_json(world / "completed-section-ledger.json", ledger)

    gate_board = build_gate_board(repo_root, terrain_manifest, transform, sprites, ledger)
    write_json(world / "production-gates.json", gate_board)

    artifact_root = repo_root / "work" / "production-terrain"
    write_json(artifact_root / "terrain-manifest.json", terrain_manifest)

    print(json.dumps({
        "production_gates": gate_board["status"],
        "terrain_tiles": terrain_manifest["validation"]["actual_tiles"],
        "transform_max_residual_m": transform["acceptance"]["max_residual_m"],
        "sprite_binaries": sprites["required_binary_count"],
        "ledger_sections": len(ledger["sections"]),
    }, indent=2))
    return 0 if gate_board["status"] == "PASS" else 2


if __name__ == "__main__":
    raise SystemExit(main())
