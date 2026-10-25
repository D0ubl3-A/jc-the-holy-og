#!/usr/bin/env python3
"""Run59 fail-closed native sprite preflight. Does NOT set manifest verified status."""
import json, hashlib, argparse, collections
from pathlib import Path
from PIL import Image

def check_manifest(data):
    a=data["assets"]
    errors=[]
    if len(a)!=2000 or [x["id"] for x in a]!=[f"{i:04d}" for i in range(1,2001)]:
        errors.append("IDs not 0001–2000")
    if len({x["slug"] for x in a})!=len(a):
        errors.append("duplicate slug")
    if dict(collections.Counter(x["category"] for x in a))!=data["category_targets"]:
        errors.append("category mismatch")
    expected={"Savior":130,"King":130,"Destroyer":130,"Liberator":130,"New Devil":130}
    if dict(collections.Counter(x["route"] for x in a if x.get("route")))!=expected:
        errors.append("route mismatch")
    if sum(x["status"]=="verified" for x in a)!=data["verified"]:
        errors.append("verified count mismatch")
    return errors

def audit(path):
    out={"path":str(path),"errors":[]}
    if not path.is_file():
        out["errors"].append("missing");return out
    out["sha256"]=hashlib.sha256(path.read_bytes()).hexdigest()
    with Image.open(path) as im:
        if im.format!="PNG" or im.mode!="RGBA" or im.size!=(1024,1536):
            out["errors"].append("wrong format, mode or dimensions")
        if im.mode=="RGBA":
            alpha=im.getchannel("A");hist=alpha.histogram()
            if not hist[0] or not hist[255]:
                out["errors"].append("no transparent background or opaque core")
            box=alpha.point(lambda x:255 if x>=16 else 0).getbbox()
            if not box:
                out["errors"].append("empty subject")
            elif min(box[0],box[1],im.width-box[2],im.height-box[3])<48:
                out["errors"].append("cutoff / <48px margin")
    out["mechanical_pass"]=not out["errors"]
    return out

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("manifest")
    p.add_argument("asset_dir")
    p.add_argument("--out",default="run59_native_preflight.json")
    args=p.parse_args()
    data=json.loads(Path(args.manifest).read_text())
    errors=check_manifest(data)
    results=[audit(Path(args.asset_dir)/f'{a["id"]}_{a["slug"]}_MASTER.png') for a in data["assets"][:12]]
    hashes=[r.get("sha256") for r in results if r.get("sha256")]
    if len(hashes)!=len(set(hashes)):errors.append("duplicate hashes")
    ok=not errors and all(r["mechanical_pass"] for r in results)
    Path(args.out).write_text(json.dumps({"manifest_errors":errors,"batch":results,"mechanical_pass":ok,"verified":data["verified"],"WARNING":"Mechanical pass does NOT establish provenance, anatomy, identity, Godot import or Android performance; NEVER auto-promote."},indent=2)+"\n")
    print("PASS" if ok else "FAIL",args.out)
    raise SystemExit(0 if ok else 1)
