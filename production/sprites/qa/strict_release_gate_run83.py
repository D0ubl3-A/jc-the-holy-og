#!/usr/bin/env python3
"""JC sprite technical gate. PNG checks never establish anatomy, provenance or Android performance."""
import argparse, json, hashlib
from pathlib import Path
from PIL import Image

REQUIRED_SIGNOFFS = [
    "independent_native_provenance", "anatomy_and_no_cutoffs",
    "face_identity", "weapon_continuity", "godot4_runtime_import",
    "android_15min_p10_fps_ge55"
]

def evaluate(path: Path, signoff: dict):
    with Image.open(path) as im:
        mode, (w, h) = im.mode, im.size
        alpha = im.getchannel("A") if mode == "RGBA" else None
        bbox = alpha.getbbox() if alpha else None
        if bbox:
            l, t, r, b = bbox
            margin = min(l, t, w-r, h-b)
            corners_clear = all(alpha.getpixel(pt) == 0 for pt in
                                [(0,0),(w-1,0),(0,h-1),(w-1,h-1)])
        else:
            margin, corners_clear = 0, False
    technical = {
        "native_1024x1536": (w, h) == (1024, 1536),
        "rgba": mode == "RGBA",
        "transparent_margin_64": margin >= 64,
        "transparent_corners": corners_clear
    }
    manual = {k: signoff.get(k) is True for k in REQUIRED_SIGNOFFS}
    return {
        "file": path.name,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "technical": technical,
        "manual_engine_device": manual,
        "release_verified": all(technical.values()) and all(manual.values())
    }

def main():
    p = argparse.ArgumentParser()
    p.add_argument("directory", type=Path)
    p.add_argument("--signoffs", type=Path)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    signoffs = json.loads(args.signoffs.read_text()) if args.signoffs else {}
    records = [evaluate(f, signoffs.get(f.name[:4], {}))
               for f in sorted(args.directory.glob("*.png"))]
    hashes = [r["sha256"] for r in records]
    if len(set(hashes)) != len(hashes):
        for r in records:
            r["release_verified"] = False
            r["duplicate_binary_warning"] = True
    result = {
        "checked": len(records),
        "release_verified": sum(r["release_verified"] for r in records),
        "records": records,
        "warning": "Never infer manual/engine/device signoffs from PNG metadata."
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"checked": result["checked"],
                      "verified": result["release_verified"]}))

if __name__ == "__main__":
    main()
