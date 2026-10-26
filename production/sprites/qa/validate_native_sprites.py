#!/usr/bin/env python3
"""Technical sprite QA only. Never declares anatomy, identity or mobile FPS verified."""
import argparse, hashlib, json
from pathlib import Path
from PIL import Image

def check(path):
    with Image.open(path) as im:
        mode, size = im.mode, im.size
        rgba = im.convert("RGBA")
    bbox = rgba.getchannel("A").getbbox()
    if bbox:
        l,t,r,b = bbox
        margins = [l,t,rgba.width-r,rgba.height-b]
    else:
        margins = [0,0,0,0]
    corners = [(0,0),(rgba.width-1,0),(0,rgba.height-1),(rgba.width-1,rgba.height-1)]
    return {
        "filename":path.name,
        "sha256":hashlib.sha256(path.read_bytes()).hexdigest(),
        "dimensions":list(size),
        "native_size_pass":size==(1024,1536),
        "rgba_pass":mode=="RGBA",
        "nonempty_alpha":bbox is not None and bbox!=(0,0,rgba.width,rgba.height),
        "margin_64px_pass":min(margins)>=64,
        "transparent_corners_pass":all(rgba.getpixel(c)[3]==0 for c in corners),
        "margins":margins,
        "human_anatomy_signoff":"PENDING",
        "canonical_identity_signoff":"PENDING",
        "independent_render_provenance":"PENDING",
        "godot4_runtime":"NOT_TESTED",
        "physical_android_15min":"NOT_TESTED",
        "release_verified":False
    }

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("asset_dir",type=Path)
    p.add_argument("--output",type=Path,required=True)
    a=p.parse_args()
    records=[check(f) for f in sorted(a.asset_dir.glob("*.png"))]
    hashes=[r["sha256"] for r in records]
    out={"files_checked":len(records),"exact_duplicate_hashes":len(hashes)-len(set(hashes)),
         "release_verified":0,"records":records,
         "warning":"Passing pixel QA never implies release verification."}
    a.output.parent.mkdir(parents=True,exist_ok=True)
    a.output.write_text(json.dumps(out,indent=2))
    print(json.dumps({"files_checked":len(records),"duplicates":out["exact_duplicate_hashes"],"verified":0}))
