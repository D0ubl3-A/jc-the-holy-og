#!/usr/bin/env python3
"""Fail-closed release gate for one independently generated JC sprite."""
import argparse, hashlib, json, sys
from PIL import Image

p = argparse.ArgumentParser()
p.add_argument("png")
p.add_argument("evidence_json")
args = p.parse_args()
with Image.open(args.png) as im:
    im.load()
    size = im.size
    rgba = im.mode == "RGBA"
    alpha = im.getchannel("A") if rgba else None
    bbox = alpha.getbbox() if alpha else None
    real_alpha = bool(alpha and alpha.getextrema()[0] < 255 and alpha.getextrema()[1] > 0)
    margins = [bbox[0], bbox[1], size[0] - bbox[2], size[1] - bbox[3]] if bbox else [0, 0, 0, 0]
with open(args.evidence_json) as f:
    e = json.load(f)
checks = {
    "native_1024x1536": size == (1024, 1536),
    "rgba": rgba,
    "true_alpha": real_alpha,
    "48px_margin": min(margins) >= 48,
    "independent_source": e.get("source_type") == "independent_native_generation",
    "not_upscaled": e.get("source_native_pixels") == [1024, 1536] and not e.get("upscaled", True),
    "identity_manual": e.get("manual_identity_approved") is True,
    "anatomy_manual": e.get("manual_anatomy_approved") is True,
    "pose_manual": e.get("manual_pose_approved") is True,
    "godot_runtime": e.get("godot_runtime_pass") is True,
    "physical_mobile": e.get("physical_mobile_pass") is True,
}
if "expected_sha256" in e:
    checks["hash_match"] = hashlib.sha256(open(args.png, "rb").read()).hexdigest() == e["expected_sha256"]
passed = all(checks.values())
print(json.dumps({"checks": checks, "verified": passed, "dimensions": size, "alpha_margins": margins}, indent=2))
sys.exit(0 if passed else 2)
