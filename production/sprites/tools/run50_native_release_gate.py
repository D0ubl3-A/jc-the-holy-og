#!/usr/bin/env python3
"""Conservative native sprite gate: a PNG can never pass without signed runtime evidence."""
import argparse, hashlib, json, sys
from pathlib import Path
from PIL import Image

REQUIRED = [
    "original_independent_render", "face_reference_approved",
    "anatomy_weapons_approved", "camera_orientation_approved",
    "animation_frame_consistency_approved", "distinct_semantics_approved",
    "sha256_unique_across_manifest", "godot4_import_executed",
    "physical_android_5min_p10_ge55fps"
]

def audit(png, evidence=None):
    p = Path(png)
    out = {"path": str(p), "checks": {}, "failures": []}
    if not p.is_file():
        out["failures"].append("file_missing")
        return out
    im = Image.open(p); im.load()
    out["size"] = list(im.size)
    out["mode"] = im.mode
    out["sha256"] = hashlib.sha256(p.read_bytes()).hexdigest()
    out["checks"]["native_1024x1536"] = im.size == (1024,1536)
    out["checks"]["rgba"] = im.mode == "RGBA"
    if im.mode == "RGBA":
        a = im.getchannel("A")
        mn,mx = a.getextrema()
        out["alpha_extrema"] = [mn,mx]
        out["checks"]["true_transparency"] = mn == 0 and mx > 0
        bbox = a.getbbox()
        out["alpha_bbox"] = bbox
        if bbox:
            margins = [bbox[0],bbox[1],im.width-bbox[2],im.height-bbox[3]]
            out["margins_px"] = margins
            out["checks"]["margin_48px"] = min(margins) >= 48
    for k,v in out["checks"].items():
        if not v: out["failures"].append(k)
    e = json.loads(Path(evidence).read_text()) if evidence else {}
    out["evidence"] = {k:e.get(k) is True for k in REQUIRED}
    for k,v in out["evidence"].items():
        if not v: out["failures"].append("missing_evidence:"+k)
    out["verified"] = not out["failures"]
    return out

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("png")
    ap.add_argument("--evidence-json")
    args = ap.parse_args()
    result = audit(args.png,args.evidence_json)
    print(json.dumps(result,indent=2))
    sys.exit(0 if result["verified"] else 1)
