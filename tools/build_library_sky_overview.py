#!/usr/bin/env python3
"""Generate a single camera-visible 595-tile aerial scene for JC on mobile.

All 595 *source* aerial photos participate in the mosaic. All 216807 source
building records are analyzed. A representative from each populated 20m cell
supplies a lower-detail skyline; not a replacement for individual near meshes.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

COL_MIN, COL_MAX = 18, 34
ROW_MIN, ROW_MAX = 0, 34
TILE_PIXELS = 64
SAMPLES_ACROSS = 5

def main(root: Path):
    manifest = json.loads((root / "manifest.json").read_text())
    assert manifest["schema"] == "jc-library-city-v1"
    assert manifest["tileCount"] == 595 and manifest["buildingCount"] == 216807
    assert len(manifest["tiles"]) == 595
    out = root / "sky"
    out.mkdir(parents=True, exist_ok=True)
    width = (COL_MAX - COL_MIN + 1) * TILE_PIXELS
    height = (ROW_MAX - ROW_MIN + 1) * TILE_PIXELS
    atlas = Image.new("RGB", (width, height), (24, 27, 34))

    source_count = 0
    samples = []
    occupied = set()
    for tile in manifest["tiles"]:
        c, r = int(tile["c"]), int(tile["r"])
        assert COL_MIN <= c <= COL_MAX and ROW_MIN <= r <= ROW_MAX
        occupied.add((c, r))
        src = root / "imagery" / f"C{c:02d}_R{r:02d}.webp"
        with Image.open(src) as original:
            image = original.convert("RGB").resize(
                (TILE_PIXELS, TILE_PIXELS), Image.Resampling.LANCZOS
            )
        # -PI/2 terrain planes: +v moves toward -worldZ. R00 has greatest +Z,
        # therefore its image is pasted into the *bottom* row of the atlas.
        x = (c - COL_MIN) * TILE_PIXELS
        y = (ROW_MAX - r) * TILE_PIXELS
        atlas.paste(image, (x, y))
        t = json.loads((root / tile["file"]).read_text())
        assert t["col"] == c and t["row"] == r
        assert t["v"] == 1 and t["n"] == tile["n"]
        assert len(t["q"]) == t["n"] * 5
        source_count += t["n"]
        picks = {}
        q = t["q"]
        for i in range(t["n"]):
            j = i * 5
            x_local, z_local, h, w, d = q[j:j+5]
            bx = max(0, min(SAMPLES_ACROSS - 1, int(x_local // 2000)))
            bz = max(0, min(SAMPLES_ACROSS - 1, int(-z_local // 2000)))
            name = (bx, bz)
            # Represent the most visually significant building in each square.
            score = max(1, h) * max(1, w + d)
            if name not in picks or score > picks[name][0]:
                picks[name] = (score, (i, x_local, z_local, h, w, d))
        for _, (_, (index, xl, zl, h, w, d)) in sorted(picks.items()):
            if h <= 0 or w <= 0 or d <= 0:
                continue
            # Store quantized WORLD coords in 1/100 game unit, from source.
            wx = (c - 8) * 10000 + xl
            wz = -(r - 8) * 10000 + zl
            raw = c * 17 + r * 31 + index * 13 + h // 130
            style = (7 if c <= 20 and raw % 17 == 0
                     else 6 if h < 260 and raw % 5 == 0
                     else raw % 6)
            samples.extend((wx, wz, max(40, h), max(30, w), max(30, d), style))
    assert len(occupied) == 595, "Source 595-tile coverage is incomplete"
    assert source_count == 216807, source_count

    aerial_path = out / "terrain.webp"
    atlas.save(aerial_path, "WEBP", quality=78, method=5)
    with Image.open(aerial_path) as check:
        assert check.size == (width, height)
    del atlas

    sky = {
        "schema": "jc-library-sky-lod-v1",
        "sourceTileCount": 595,
        "sourceBuildingCount": 216807,
        "sampleBuildingCount": len(samples) // 6,
        "tileCols": [COL_MIN, COL_MAX],
        "tileRows": [ROW_MIN, ROW_MAX],
        "terrain": "sky/terrain.webp",
        "atlasPixels": [width, height],
        "sourceTilePixels": TILE_PIXELS,
        "skins": 8,
        "q": samples,
    }
    output = out / "overview.json"
    output.write_text(json.dumps(sky, separators=(",", ":")) + "\n")
    assert len(samples) % 6 == 0
    assert 0 < sky["sampleBuildingCount"] <= 595 * 25
    manifest["sky"] = {
        "schema": sky["schema"], "file": "sky/overview.json",
        "terrain": sky["terrain"], "sourceTileCount": 595,
        "sampleBuildingCount": sky["sampleBuildingCount"],
        "sourceBuildingCount": 216807,
        "terrainSha256": hashlib.sha256(aerial_path.read_bytes()).hexdigest()
    }
    (root / "manifest.json").write_text(json.dumps(manifest,separators=(",", ":"))+"\n")
    print("PASS JC SKY: 595 actual aerial tiles mapped into",width,"x",height,
          "WebP;",source_count,"source buildings ->",
          sky["sampleBuildingCount"],"sky-LOD buildings;",
          aerial_path.stat().st_size,"terrain bytes")

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--root", default="_site/jc-the-holy-og-assets/library-city")
    args = p.parse_args()
    main(Path(args.root))
