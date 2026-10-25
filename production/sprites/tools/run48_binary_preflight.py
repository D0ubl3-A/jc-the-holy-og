#!/usr/bin/env python3
"""Run 48 fail-closed PNG preflight. This does NOT verify Godot, anatomy or Android FPS."""
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image

def preflight(path, expected=(1024, 1536), margin=48):
    p = Path(path)
    out = {"path": str(p), "failures": [], "verified_game_ready": False}
    if not p.is_file():
        out["failures"].append("missing binary")
        return out
    out["sha256"] = hashlib.sha256(p.read_bytes()).hexdigest()
    try:
        with Image.open(p) as im:
            if im.format != "PNG":
                out["failures"].append("not PNG")
            if im.mode != "RGBA":
                out["failures"].append("not RGBA")
            if im.size != expected:
                out["failures"].append("wrong native dimensions")
            if im.mode == "RGBA":
                alpha = im.getchannel("A")
                lo, hi = alpha.getextrema()
                out["alpha_extrema"] = [lo, hi]
                if lo != 0 or hi != 255:
                    out["failures"].append("missing fully transparent or opaque pixels")
                bbox = alpha.point(lambda a: 255 if a >= 8 else 0).getbbox()
                if not bbox:
                    out["failures"].append("empty alpha silhouette")
                else:
                    l, t, r, b = bbox
                    out["margins"] = [l, t, im.width-r, im.height-b]
                    if min(out["margins"]) < margin:
                        out["failures"].append("unsafe transparent margins")
    except Exception as exc:
        out["failures"].append("invalid image: " + str(exc))
    out["note"] = "Even if all binary checks pass, separate independent-render, human anatomy, executed Godot import and measured Android FPS evidence is required."
    return out

if __name__ == "__main__":
    result = preflight(sys.argv[1])
    print(json.dumps(result, indent=2))
    sys.exit(1 if result["failures"] else 0)
