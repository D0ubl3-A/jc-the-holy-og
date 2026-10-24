#!/usr/bin/env python3
"""Validate JC sprite manifest; NEVER certify art anatomy or device performance."""
import json,collections,re,sys
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
print(json.dumps({"ok":not errors,"verified":statuses["verified"],"unverified":statuses["generated_unverified"],"planned":statuses["planned"],"categories":dict(categories),"errors":errors},indent=2))
sys.exit(1 if errors else 0)
