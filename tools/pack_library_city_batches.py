#!/usr/bin/env python3
"""Convert the checked-in 11-part JC Library ZIP into 60 real-game payloads.

The GitHub Pages build has already verified and extracted 595 source tile JSON
files and 595 compressed NAIP textures. This packs exactly ten actual tile
records per network payload, retaining zero-building cells for their imagery.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def main(root: Path) -> None:
    manifest_path = root / "manifest.json"
    if not manifest_path.is_file():
        raise RuntimeError(f"Extracted library manifest not found: {manifest_path}")
    manifest = json.loads(manifest_path.read_text())
    tiles = manifest.get("tiles", [])
    assert manifest.get("schema") == "jc-library-city-v1"
    assert manifest.get("tileCount") == 595
    assert manifest.get("buildingCount") == 216807
    assert len(tiles) == 595

    out = root / "batches"
    out.mkdir(parents=True, exist_ok=True)
    for stale in out.glob("B[0-9][0-9][0-9].json"):
        stale.unlink()

    batches = []
    total_buildings = 0
    count = 0
    for offset in range(0, len(tiles), 10):
        group = tiles[offset:offset + 10]
        seq = offset // 10 + 1
        name = f"B{seq:03d}.json"
        records = []
        for t in group:
            col, row = int(t["c"]), int(t["r"])
            tile_path = root / t["file"]
            image_path = root / "imagery" / f"C{col:02d}_R{row:02d}.webp"
            assert tile_path.is_file(), tile_path
            assert image_path.is_file() and image_path.stat().st_size > 0, image_path
            data = json.loads(tile_path.read_text())
            assert (int(data["col"]), int(data["row"])) == (col, row)
            assert data["v"] == 1 and data["n"] == t["n"]
            assert len(data["q"]) == data["n"] * 5
            records.append(data)
            t["batch"] = "batches/" + name
            total_buildings += data["n"]
            count += 1

        payload = {"schema": "jc-library-10-tiles-v1", "batch": seq, "tiles": records}
        blob = (json.dumps(payload, separators=(",", ":")) + "\n").encode()
        (out / name).write_bytes(blob)
        batches.append({
            "file": "batches/" + name,
            "tileCount": len(records),
            "buildingCount": sum(r["n"] for r in records),
            "sha256": hashlib.sha256(blob).hexdigest(),
            "bytes": len(blob),
        })

    assert len(batches) == 60, len(batches)
    assert all(b["tileCount"] == 10 for b in batches[:-1])
    assert batches[-1]["tileCount"] == 5
    assert count == 595 and total_buildings == 216807

    manifest["batchSchema"] = "jc-library-10-tiles-v1"
    manifest["batchSize"] = 10
    manifest["batchCount"] = len(batches)
    manifest["batches"] = batches
    manifest_path.write_text(json.dumps(manifest, separators=(",", ":")) + "\n")

    # Validate the serialized deployment output, not just in-memory counts.
    check = json.loads(manifest_path.read_text())
    tile_keys = set()
    for item in check["batches"]:
        body = (root / item["file"]).read_bytes()
        assert hashlib.sha256(body).hexdigest() == item["sha256"]
        data = json.loads(body)
        assert data["schema"] == "jc-library-10-tiles-v1"
        assert len(data["tiles"]) == item["tileCount"]
        tile_keys.update((t["col"], t["row"]) for t in data["tiles"])
    assert len(tile_keys) == 595
    print(
        "PASS: 60 live game batches (59 x 10, 1 x 5); "
        "595 tiles, 216807 buildings, 595 terrain images; "
        f"{sum(item['bytes'] for item in batches)} JSON bytes"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default="_site/jc-the-holy-og-assets/library-city")
    args = parser.parse_args()
    main(Path(args.root))
