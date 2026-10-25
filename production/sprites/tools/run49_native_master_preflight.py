#!/usr/bin/env python3
"""Fail-closed JC PNG preflight. Does NOT certify native provenance, anatomy, Godot or mobile."""
from pathlib import Path
from PIL import Image
import hashlib, json, sys
import numpy as np

def inspect(path):
    p = Path(path)
    im = Image.open(p)
    rgba = np.asarray(im.convert("RGBA"))
    alpha = rgba[:, :, 3]
    ys, xs = np.where(alpha >= 8)
    margins = [
        int(xs.min()) if len(xs) else -1,
        int(rgba.shape[1] - 1 - xs.max()) if len(xs) else -1,
        int(ys.min()) if len(ys) else -1,
        int(rgba.shape[0] - 1 - ys.max()) if len(ys) else -1,
    ]
    structural = (im.size == (1024, 1536) and im.mode == "RGBA"
                  and int(alpha.min()) == 0 and int(alpha.max()) >= 250
                  and all(v >= 48 for v in margins))
    return {
        "path": str(p),
        "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
        "dimensions": list(im.size),
        "source_mode": im.mode,
        "alpha_min": int(alpha.min()),
        "alpha_max": int(alpha.max()),
        "alpha_margins_lrtb": margins,
        "structural_pass": structural,
        "independent_native_provenance_approved": False,
        "oct23_face_identity_approved": False,
        "anatomy_and_camera_approved": False,
        "godot4_import_executed": False,
        "physical_android_p10_verified": False,
        "fully_verified": False,
    }

if __name__ == "__main__":
    results = [inspect(path) for path in sys.argv[1:]]
    hashes = [r["sha256"] for r in results]
    duplicate_hashes = len(hashes) != len(set(hashes))
    print(json.dumps({"results": results, "duplicate_hashes": duplicate_hashes}, indent=2))
    sys.exit(0 if results and not duplicate_hashes and all(r["structural_pass"] for r in results) else 1)
