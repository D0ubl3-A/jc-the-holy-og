#!/usr/bin/env python3
"""Fail-closed 2,000-sprite manifest audit; does not replace visual/mobile review."""
import argparse, collections, hashlib, json, re, sys
from pathlib import Path

TARGET=2000
CATEGORIES={"jc_route_transformations":120,"locomotion_combat_flying":380,"humans":280,"angels":190,"demons":300,"bosses":100,"vehicles":150,"las_vegas_locations":200,"effects":160,"ui":70,"five_endings":50}
VISUAL=("anatomy","no_cutoff_limbs","frame_consistency","canonical_identity","correct_camera")
VALID={"planned","generated_unverified","verified"}

def digest(path):
    h=hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda:f.read(1048576),b""): h.update(block)
    return h.hexdigest()

def safe_path(root,name):
    if not isinstance(name,str) or not name or Path(name).is_absolute(): raise ValueError("invalid relative path")
    p=(root/name).resolve()
    if not p.is_relative_to(root.resolve()): raise ValueError("path escapes repository")
    return p

def audit(manifest_path,ledger_path=None,repo_root=None):
    manifest_path=Path(manifest_path)
    root=Path(repo_root or ".").resolve()
    m=json.loads(manifest_path.read_text(encoding="utf-8"))
    a=m.get("assets",[])
    errors=[]
    counts=collections.Counter(x.get("status") for x in a)
    cats=collections.Counter(x.get("category") for x in a)
    if len(a)!=TARGET or [x.get("id") for x in a]!=[f"{i:04d}" for i in range(1,TARGET+1)]:
        errors.append("IDs must be ordered 0001-2000, unique and without gaps")
    if m.get("target",m.get("target_distinct_verified_assets"))!=TARGET: errors.append("target must be 2000")
    if m.get("category_targets")!=CATEGORIES or dict(cats)!=CATEGORIES: errors.append("category allocation mismatch")
    if set(counts)-VALID: errors.append("invalid statuses")
    for field,status in (("verified_completed","verified"),("generated_unverified","generated_unverified"),("planned","planned")):
        if m.get(field)!=counts[status]: errors.append(f"{field} differs from asset statuses")
    paths=[x.get("file_path") for x in a if x.get("file_path")]
    hashes=[x.get("sha256") for x in a if x.get("sha256")]
    if len(paths)!=len(set(paths)): errors.append("duplicate asset file paths")
    if len(hashes)!=len(set(hashes)): errors.append("duplicate asset SHA-256 hashes")
    if any(not re.fullmatch("[0-9a-f]{64}",h) for h in hashes): errors.append("invalid SHA-256")
    archive_hashes=[x.get("run29_archived_candidate_audit",{}).get("sha256_archived_binary") for x in a]
    archive_hashes=[h for h in archive_hashes if h]
    if len(archive_hashes)!=len(set(archive_hashes)): errors.append("duplicate archived candidate SHA-256 hashes")
    if any(not re.fullmatch("[0-9a-f]{64}",h) for h in archive_hashes): errors.append("invalid archived candidate SHA-256")
    if ledger_path:
        ledger=json.loads(Path(ledger_path).read_text(encoding="utf-8"))
        if ledger.get("verified_completed")!=counts["verified"] or ledger.get("target")!=TARGET:
            errors.append("ledger count/target disagrees with manifest")
    for x in a:
        if x.get("status")!="verified": continue
        ident=x["id"]
        try: png=safe_path(root,x.get("file_path"))
        except ValueError as exc: errors.append(f"{ident}: {exc}"); continue
        if not png.is_file(): errors.append(f"{ident}: verified without committed PNG"); continue
        if digest(png)!=x.get("sha256"): errors.append(f"{ident}: binary hash mismatch")
        try:
            from PIL import Image
            with Image.open(png) as im:
                im.load()
                if im.format!="PNG" or im.mode!="RGBA" or im.size!=(1024,1536):
                    errors.append(f"{ident}: native PNG must be 1024x1536 RGBA")
                if str(x.get("background","")).startswith("transparent"):
                    alpha=im.getchannel("A")
                    bbox=alpha.getbbox()
                    if alpha.getextrema()[0]==255 or not bbox or min(bbox[0],bbox[1],im.width-bbox[2],im.height-bbox[3])<48:
                        errors.append(f"{ident}: transparency or 48px safety margin failed")
        except Exception as exc: errors.append(f"{ident}: PNG check failed: {exc}")
        e=x.get("release_evidence")
        if not isinstance(e,dict): errors.append(f"{ident}: missing release_evidence"); continue
        if e.get("provenance")!="independent_native_render" or e.get("source_native_px")!=[1024,1536]:
            errors.append(f"{ident}: independent native render evidence missing")
        v=e.get("visual_qa",{})
        if not isinstance(v,dict) or any(v.get(k)!="pass" for k in VISUAL) or not e.get("visual_reviewer") or not e.get("visual_review_utc"):
            errors.append(f"{ident}: visual QA/reviewer incomplete")
        for key in ("godot4_import","physical_mobile"):
            t=e.get(key,{})
            if not isinstance(t,dict) or t.get("status")!="pass":
                errors.append(f"{ident}: {key} not passed"); continue
            if key=="physical_mobile" and (not t.get("device") or not t.get("tested_utc") or not isinstance(t.get("p10_fps"),(int,float)) or t["p10_fps"]<55):
                errors.append(f"{ident}: physical device/55fps p10 evidence missing")
            try:
                log=safe_path(root,t.get("log_path"))
                if not log.is_file() or digest(log)!=t.get("log_sha256"): errors.append(f"{ident}: {key} log/hash missing")
            except ValueError: errors.append(f"{ident}: invalid {key} log path")
    return {"schema":"jc-sprite-integrity-v2","target":TARGET,"manifest_assets":len(a),"status_counts":dict(counts),"verified_completed":counts["verified"],"category_counts":dict(cats),"errors":errors,"passed":not errors,"limitations":["Anatomy, frame identity and physical mobile evidence require human review.","Composite sheets and prompts are never counted as sprites."]}

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--manifest",default="production/sprites/manifest_0001-2000.json")
    p.add_argument("--ledger",default="production/sprites/progress_ledger.json")
    p.add_argument("--repo-root",default=".")
    p.add_argument("--json-report")
    args=p.parse_args()
    r=audit(args.manifest,args.ledger,args.repo_root)
    if args.json_report:
        out=Path(args.json_report);out.parent.mkdir(parents=True,exist_ok=True)
        out.write_text(json.dumps(r,indent=2)+"\n")
    print(json.dumps(r,indent=2))
    sys.exit(0 if r["passed"] else 1)
