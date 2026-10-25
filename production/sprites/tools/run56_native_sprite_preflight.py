#!/usr/bin/env python3
"""Fail-closed technical PNG preflight. A passing result is NOT a verified sprite."""
import argparse, hashlib, json
from pathlib import Path
from PIL import Image

def preflight(manifest, asset_id, path):
    matches=[a for a in manifest["assets"] if a["id"]==asset_id]
    if len(matches)!=1: raise ValueError("missing/ambiguous asset ID")
    a=matches[0]; p=Path(path); issues=[]; frames=[]
    with Image.open(p) as img:
        img.load()
        w,h=img.size
        cols,rows=a["grid"]; cw,ch=a["cell_px"]; n=a["frames"]
        if [w,h]!=a["master_px"]: issues.append("native_dimensions_mismatch")
        if w>4096 or h>4096: issues.append("mobile_atlas_exceeds_4096")
        transparent=a["background"]=="transparent"
        if transparent and img.mode!="RGBA": issues.append("transparent_asset_must_be_RGBA")
        if img.mode=="RGBA" and [w,h]==a["master_px"]:
            alpha=img.getchannel("A")
            for i in range(n):
                x,y=i%cols,i//cols
                f=alpha.crop((x*cw,y*ch,(x+1)*cw,(y+1)*ch))
                ex=f.getextrema(); bbox=f.getbbox()
                margins=[bbox[0],bbox[1],cw-bbox[2],ch-bbox[3]] if bbox else None
                fi=[]
                if not bbox: fi.append("empty_frame")
                if transparent:
                    if ex!=(0,255):fi.append("alpha_extrema_not_0_255")
                    if not margins or min(margins)<48:fi.append("margin_below_48px")
                issues.extend("frame_%d:%s"%(i,x) for x in fi)
                frames.append({"index":i,"alpha_extrema":ex,"margins":margins,"issues":fi})
    return {"asset_id":asset_id,"slug":a["slug"],"path":str(p),
      "sha256":hashlib.sha256(p.read_bytes()).hexdigest(),
      "actual_px":[w,h],"expected_px":a["master_px"],"frames":frames,
      "rgba8_memory_mib":round(w*h*4/1048576,3),
      "technical_preflight_pass":not issues,"issues":issues,
      "accepted_as_verified":False,
      "still_required":["independent_render_provenance","human_anatomy_and_face_signoff",
        "camera_and_frame_consistency","actual_Godot4_import",
        "physical_Android_300s_p10_at_least_55fps"]}

if __name__=="__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument("manifest");ap.add_argument("asset_id");ap.add_argument("png")
    ap.add_argument("--out");args=ap.parse_args()
    result=preflight(json.loads(Path(args.manifest).read_text()),args.asset_id,args.png)
    payload=json.dumps(result,indent=2)+"\n"
    if args.out:Path(args.out).write_text(payload)
    print(payload)
    raise SystemExit(0 if result["technical_preflight_pass"] else 2)
