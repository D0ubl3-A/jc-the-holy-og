#!/usr/bin/env python3
"""Run 47 fail-closed release gate. Requires Pillow. No prompts/composites count."""
import hashlib, json, sys
from pathlib import Path
from PIL import Image

def check(asset, binary_dir, evidence_dir, seen):
    id_, slug = asset["id"], asset["slug"]
    p = Path(binary_dir) / f"{id_}_{slug}_NATIVE_UNVERIFIED.png"
    issues = []
    if not p.is_file():
        return ["native master missing"]
    digest = hashlib.sha256(p.read_bytes()).hexdigest()
    if digest in seen: issues.append("duplicate SHA256")
    seen.add(digest)
    try:
        with Image.open(p) as im:
            if im.format != "PNG" or im.mode != "RGBA":
                issues.append("not PNG RGBA8")
            if list(im.size) != asset["master_px"]:
                issues.append("incorrect native dimensions")
            if im.mode == "RGBA":
                a = im.getchannel("A")
                if a.getextrema() != (0,255):
                    issues.append("alpha extrema not (0,255)")
                box = a.point(lambda x: 255 if x >= 8 else 0).getbbox()
                if not box:
                    issues.append("empty silhouette")
                elif min(box[0], box[1], im.width-box[2], im.height-box[3]) < 48:
                    issues.append("less than 48px silhouette margin")
    except Exception as e:
        issues.append(f"unreadable PNG: {e}")
    evfile = Path(evidence_dir) / f"{id_}.json"
    if not evfile.is_file():
        return issues + ["release evidence missing"]
    try: ev = json.loads(evfile.read_text())
    except Exception: return issues + ["invalid release evidence JSON"]
    if ev.get("file_sha256") != digest: issues.append("SHA256 evidence mismatch")
    if ev.get("render_source") != "independent_native" or ev.get("composite_derived", True):
        issues.append("not independently rendered native master")
    human = ev.get("human_visual_review", {})
    for key in ("reviewer","anatomy_pass","identity_pass","pose_pass","limbs_weapons_uncropped","edge_matting_pass"):
        if not human.get(key): issues.append(f"visual signoff missing: {key}")
    godot = ev.get("godot4_import", {})
    if not (godot.get("passed") is True and godot.get("version") and godot.get("build_url")):
        issues.append("executed Godot 4 import evidence missing")
    android = ev.get("android_benchmark", {})
    if not (android.get("device") and android.get("duration_seconds",0)>=300 and android.get("p10_fps",0)>=55 and android.get("measurement_file_sha256")):
        issues.append("measured physical Android 5-min P10 >=55 FPS evidence missing")
    return issues

def main():
    manifest = json.loads(Path(sys.argv[1]).read_text())
    assets = manifest["assets"]
    assert [a["id"] for a in assets] == [f"{i:04d}" for i in range(1,2001)]
    assert len({a["slug"] for a in assets}) == 2000
    seen, failures = set(), {}
    for asset in assets:
        issues = check(asset, sys.argv[2], sys.argv[3], seen)
        if issues: failures[asset["id"]] = issues
    print(json.dumps({"verified":2000-len(failures),"target":2000,"failures":failures}, indent=2))
    return int(bool(failures))

if __name__ == "__main__":
    sys.exit(main())
