#!/usr/bin/env python3
"""Validate JC sprite manifest; NEVER certify art anatomy or device performance."""
import json,collections,re,sys,hashlib
from PIL import Image
from pathlib import Path
p=Path(sys.argv[1] if len(sys.argv)>1 else "production/sprites/manifest_0001-2000.json")
m=json.loads(p.read_text(encoding="utf-8"))
a=m["assets"]; errors=[]
ids=[x.get("id") for x in a]
if ids!=[f"{i:04d}" for i in range(1,2001)]: errors.append("IDs not exactly 0001-2000 in order")
if len(set(ids))!=2000: errors.append("duplicate IDs")
if m.get("target",m.get("target_distinct_verified_assets"))!=2000: errors.append("target not 2000")
categories=collections.Counter(x.get("category") for x in a)
if categories!=collections.Counter(m["category_targets"]): errors.append("category allocation mismatch")
statuses=collections.Counter(x.get("status") for x in a)
for k,field in (("verified","verified_completed"),("generated_unverified","generated_unverified"),("planned","planned")):
 if statuses[k]!=m.get(field): errors.append(field+" inconsistent with asset records")
if sum(statuses.values())!=2000: errors.append("statuses not exhaustive")
for x in a:
 if x.get("status")!="verified": continue
 id=x["id"]
 if x.get("visual_qa") not in ("approved","pass"): errors.append(id+": visual anatomy not approved")
 if x.get("godot4_import_qa") not in ("pass","passed"): errors.append(id+": Godot import not proven")
 if x.get("mobile_performance_qa") not in ("pass","passed"): errors.append(id+": device benchmark not proven")
 if not re.fullmatch(r"[0-9a-f]{64}",str(x.get("sha256",""))): errors.append(id+": no valid hash")
 if not (p.parent / x.get("file_path","")).is_file(): errors.append(id+": verified binary absent")

# Verified status requires actual evidence, not text printed in a reference board.
verified_hashes = {}
for x in a:
 if x.get("status") != "verified": continue
 ident = x["id"]
 if x.get("native_resolution_qa") not in ("pass", "passed"): errors.append(ident+": native source not approved")
 if int(x.get("frames", 1)) > 1 and x.get("frame_consistency_qa") not in ("pass", "passed"):
  errors.append(ident+": animation frame continuity not approved")
 ev = x.get("qa_evidence") or {}
 for key in ("visual_review", "native_source", "godot_import_log", "mobile_device_log"):
  rel = ev.get(key)
  if not isinstance(rel,str) or not rel or Path(rel).is_absolute() or ".." in Path(rel).parts or not (p.parent/rel).is_file():
   errors.append(ident+": missing repository QA evidence "+key)
 rel = x.get("file_path","")
 if not isinstance(rel,str) or not rel.lower().endswith(".png") or Path(rel).is_absolute() or ".." in Path(rel).parts:
  errors.append(ident+": unsafe or missing PNG path"); continue
 fn = p.parent/rel
 if not fn.is_file(): continue
 raw = fn.read_bytes()
 digest = hashlib.sha256(raw).hexdigest()
 if digest != x.get("sha256"): errors.append(ident+": actual PNG SHA-256 mismatch")
 if digest in verified_hashes: errors.append(ident+": duplicate PNG bytes with "+verified_hashes[digest])
 verified_hashes[digest] = ident
 try:
  with Image.open(fn) as im:
   if im.format != "PNG": errors.append(ident+": binary is not PNG")
   w,h = im.size
   if x.get("pixel_size") != [w,h]: errors.append(ident+": pixel_size metadata mismatch")
   if min(w,h)<256 or max(w,h)>4096: errors.append(ident+": invalid master dimensions")
   if x.get("background")=="transparent":
    alpha=im.convert("RGBA").getchannel("A")
    lo,hi=alpha.getextrema()
    if lo!=0 or hi!=255: errors.append(ident+": invalid alpha range")
    box=alpha.getbbox()
    if box is None: errors.append(ident+": empty transparent image")
    else:
     l,t,r,b=box; margin=max(2,round(min(w,h)*.02))
     if min(l,t,w-r,h-b)<margin: errors.append(ident+": insufficient silhouette padding / possible cutoff")
 except Exception as e: errors.append(ident+": PNG decode failed: "+str(e))

print(json.dumps({"ok":not errors,"verified":statuses["verified"],"unverified":statuses["generated_unverified"],"planned":statuses["planned"],"categories":dict(categories),"errors":errors},indent=2))
sys.exit(1 if errors else 0)
