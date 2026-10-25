#!/usr/bin/env python3
"""Run58 fail-closed PNG mechanical preflight. Not proof of anatomy, provenance, Godot import or Android performance."""
import sys,json,hashlib
from pathlib import Path
from PIL import Image

def audit(path):
    p=Path(path)
    with Image.open(p) as im:
        size=im.size
        mode=im.mode
        alpha=im.convert("RGBA").getchannel("A")
        extrema=alpha.getextrema()
        bbox=alpha.getbbox()
        margins=[bbox[0],bbox[1],size[0]-bbox[2],size[1]-bbox[3]] if bbox else [0,0,0,0]
        checks={"size":size==(1024,1536),"rgba":mode=="RGBA","true_alpha":extrema[0]==0,"opaque_core":extrema[1]==255,"safe_margin":bool(bbox and min(margins)>=48)}
    return {"file":str(p),"sha256":hashlib.sha256(p.read_bytes()).hexdigest(),"size":size,"mode":mode,"alpha_extrema":extrema,"margins":margins,"checks":checks,"mechanical_pass":all(checks.values()),"release_verified":False}

if __name__=="__main__":
    results=[audit(p) for p in sys.argv[1:]]
    print(json.dumps(results,indent=2))
    sys.exit(0 if results and all(r["mechanical_pass"] for r in results) else 1)
