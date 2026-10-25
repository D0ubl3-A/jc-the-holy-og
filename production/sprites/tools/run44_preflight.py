#!/usr/bin/env python3
"""Independent sprite PNG preflight. This cannot verify visual identity or mobile FPS."""
import argparse, hashlib, json, sys
from pathlib import Path
from PIL import Image

def check_png(path, expected=(1024, 1536), transparent=True, margin=48, independent=False):
    path = Path(path)
    errors = []
    if not path.is_file():
        return {"file": str(path), "passed": False, "errors": ["missing binary"]}
    with Image.open(path) as im:
        im.load()
        if im.format != "PNG":
            errors.append("not PNG")
        if im.size != tuple(expected):
            errors.append(f"dimensions {im.size} != {tuple(expected)}")
        if transparent:
            if im.mode != "RGBA":
                errors.append("not RGBA")
            else:
                alpha = im.getchannel("A")
                bbox = alpha.getbbox()
                if alpha.getextrema() != (0, 255):
                    errors.append("alpha lacks fully transparent and fully opaque pixels")
                if not bbox:
                    errors.append("empty silhouette")
                elif min(bbox[0], bbox[1], im.width-bbox[2], im.height-bbox[3]) < margin:
                    errors.append(f"alpha touches {margin}px safety margin")
        else:
            if im.mode not in ("RGB", "RGBA"):
                errors.append("unsupported mode")
            elif im.mode == "RGBA" and im.getchannel("A").getextrema() != (255, 255):
                errors.append("expected opaque alpha")
    if not independent:
        errors.append("independent-native-render provenance not established")
    return {"file": str(path), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "passed": not errors, "errors": errors}

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("png")
    p.add_argument("--width", type=int, default=1024)
    p.add_argument("--height", type=int, default=1536)
    p.add_argument("--margin", type=int, default=48)
    p.add_argument("--opaque", action="store_true")
    p.add_argument("--independent-native-provenance-confirmed", action="store_true")
    a = p.parse_args()
    result = check_png(a.png, (a.width, a.height), not a.opaque,
                       a.margin, a.independent_native_provenance_confirmed)
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["passed"] else 1)
