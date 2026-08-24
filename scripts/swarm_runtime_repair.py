#!/usr/bin/env python3
"""Deterministic JC runtime repair swarm.

Only repairs defects directly evidenced in the current playable runtime. The
script is repeat-safe: an already-applied repair verifies cleanly instead of
failing merely because the old text is gone.
"""
from __future__ import annotations

import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
FULL_STRIP = ROOT / "jc-the-holy-og-assets" / "full-strip-runtime.js"
TRUTH = ROOT / "world" / "swarm-runtime-truth.json"


def replace_or_verify(text: str, old: str, new: str, label: str) -> tuple[str, dict]:
    old_count = text.count(old)
    new_count = text.count(new)
    if old_count == 1:
        return text.replace(old, new, 1), {"id": label, "status": "PATCHED", "matches": 1}
    if old_count == 0 and new_count >= 1:
        return text, {"id": label, "status": "ALREADY_PATCHED", "matches": new_count}
    raise RuntimeError(f"{label}: old={old_count}, new={new_count}; refusing ambiguous repair")


def git_sha() -> str:
    return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()


patches: list[dict] = []

# Agent 1 — full Strip runtime syntax / fallback control.
full = FULL_STRIP.read_text(encoding="utf-8")
for old, new, label in [
    (
        'root.userData.landmarks = specs.map((spec) => spec.name);\\n    root.userData.landmarkEvidence',
        'root.userData.landmarks = specs.map((spec) => spec.name);\n    root.userData.landmarkEvidence',
        "full-strip-literal-newline-1",
    ),
    (
        'Object.fromEntries(specs.map((spec) => [spec.name, spec.evidence || "provisional"]));\\n    root.userData.corridorVerification',
        'Object.fromEntries(specs.map((spec) => [spec.name, spec.evidence || "provisional"]));\n    root.userData.corridorVerification',
        "full-strip-literal-newline-2",
    ),
    (
        'if (scene?.isScene) buildFullStrip(scene);',
        'if (scene?.isScene && window.JC_VEGAS_SECTIONS?.runtimeDistrictPacks?.status !== "ready") buildFullStrip(scene);',
        "disable-provisional-strip-overlay-when-real-packs-ready",
    ),
]:
    full, result = replace_or_verify(full, old, new, label)
    patches.append(result)
FULL_STRIP.write_text(full, encoding="utf-8")

# Agent 2 — main playable module integration.
index = INDEX.read_text(encoding="utf-8")
for old, new, label in [
    (
        'gltfLoader.load("./jc-the-holy-og-assets/models/vegas-city-lod.glb",g=>{cityLayer=prepareGlb(g.scene,"city");proceduralCity.visible=true;',
        'gltfLoader.load("./jc-the-holy-og-assets/models/vegas-city-lod.glb",g=>{cityLayer=prepareGlb(g.scene,"city");proceduralCity.visible=false;',
        "hide-procedural-city-after-real-city-load",
    ),
    (
        'function buildRenamedLandmarks(parent){if(!stripAnchor)return;',
        'function buildRenamedLandmarks(parent){if(!stripAnchor||window.JC_VEGAS_SECTIONS?.runtimeDistrictPacks?.status==="ready")return;',
        "disable-renamed-landmark-fallback-with-real-packs",
    ),
    (
        'root.position.copy(stripAnchor.position);root.rotation.y=stripAnchor.angle||0;',
        'root.position.set(stripAnchor.x,0,stripAnchor.z);root.rotation.y=stripAnchor.a||0;',
        "repair-fallback-strip-anchor-shape",
    ),
    (
        'if(assetAtlases.legacyCharacter){for(let i=0;i<8;i++)mats.push(new THREE.SpriteMaterial({map:tile(assetAtlases.legacyCharacter,i%4,(i/4)|0),transparent:true,depthWrite:false,toneMapped:false}));return mats}',
        'if(assetAtlases.devil){for(let i=0;i<8;i++)mats.push(new THREE.SpriteMaterial({map:tile(assetAtlases.devil,i%4,(i/4)|0),transparent:true,depthWrite:false,toneMapped:false}));return mats}',
        "stop-satan-from-using-jc-legacy-atlas",
    ),
    (
        'if(e.code==="Space")graceWave();',
        'if(e.code==="Space"&&!flying)graceWave();',
        "flight-space-no-longer-triggers-grace-wave",
    ),
]:
    index, result = replace_or_verify(index, old, new, label)
    patches.append(result)

old_devil = 'function updateDevil(dt){const target=citizens.find(c=>c.state==="normal"&&c.mesh.visible);const aim=(target?target.mesh.position:playerObject.position).clone().sub(devil.position).setY(0);let devilSpeed=0,devilSteer=0;if(aim.length()>18){aim.normalize();const targetHeading=Math.atan2(aim.x,aim.z),delta=Math.atan2(Math.sin(targetHeading-devil.rotation.y),Math.cos(targetHeading-devil.rotation.y));devilSteer=clamp(delta*1.7,-1,1);devil.position.addScaledVector(aim,dt*32);devil.rotation.y=targetHeading;devilSpeed=32}updateVehicleWheels(devil,devilSpeed,devilSteer,dt);devilShot-=dt;if(devilShot<=0){devilShot=2.4;if(target&&target.mesh.position.distanceTo(devil.position)<220){fire("soul",devil.position,target.mesh.position);projectiles[projectiles.length-1].target=target}else fire("havoc",devil.position,playerObject.position)}}'
new_devil = 'function updateDevil(dt){const target=citizens.find(c=>c.state==="normal"&&c.mesh.visible);const aim=(target?target.mesh.position:devil.position).clone().sub(devil.position).setY(0);let devilSpeed=0,devilSteer=0;if(target&&aim.length()>18){aim.normalize();const targetHeading=Math.atan2(aim.x,aim.z),delta=Math.atan2(Math.sin(targetHeading-devil.rotation.y),Math.cos(targetHeading-devil.rotation.y));devilSteer=clamp(delta*1.7,-1,1);devil.position.addScaledVector(aim,dt*32);devil.rotation.y=targetHeading;devilSpeed=32}updateVehicleWheels(devil,devilSpeed,devilSteer,dt);devilShot-=dt;if(devilShot<=0){devilShot=2.4;const nearDevil=playerObject.position.distanceTo(devil.position)<95,protectingTarget=target&&playerObject.position.distanceTo(target.mesh.position)<75,jcInterfering=nearDevil||protectingTarget;if(target&&target.mesh.position.distanceTo(devil.position)<220){fire("soul",devil.position,target.mesh.position);projectiles[projectiles.length-1].target=target}else if(jcInterfering&&playerObject.position.distanceTo(devil.position)<240)fire("havoc",devil.position,playerObject.position)}}'
index, result = replace_or_verify(index, old_devil, new_devil, "devil-prioritizes-population-until-jc-interferes")
patches.append(result)

# Hard loader blocker: index.html is an inline ES module. Duplicate top-level
# function declarations are a SyntaxError in modules. Keep exactly one traffic
# vehicle factory.
traffic_pattern = re.compile(r'\n  function makeTrafficVehicle\(index\)\{.*?return g\}\n', re.S)
traffic_matches = list(traffic_pattern.finditer(index))
if len(traffic_matches) == 2:
    first = traffic_matches[0]
    index = index[: first.start()] + "\n" + index[first.end() :]
    patches.append({"id": "deduplicate-makeTrafficVehicle-es-module-declaration", "status": "PATCHED", "matches": 2})
elif len(traffic_matches) == 1:
    patches.append({"id": "deduplicate-makeTrafficVehicle-es-module-declaration", "status": "ALREADY_PATCHED", "matches": 1})
else:
    raise RuntimeError(f"traffic factory declaration count is {len(traffic_matches)}; expected 1 or 2")

INDEX.write_text(index, encoding="utf-8")

# Agent 0 — machine-readable truth. PASS here never means production deployed.
production_gates = json.loads((ROOT / "world" / "production-gates.json").read_text(encoding="utf-8"))
section_status = json.loads((ROOT / "world" / "section-status.json").read_text(encoding="utf-8"))
truth = {
    "schema": "jc-swarm-runtime-truth-v1",
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "source_commit_before_repair": git_sha(),
    "swarm_run": "runtime-truth-2026-08-24-wave-2",
    "status": "REPAIR_APPLIED_PENDING_RUNTIME_QA",
    "production_record": {
        "record_file": "DEPLOYED_RELEASE.md",
        "recorded_sites_version": 67,
        "deployment_sync_verified": False,
        "note": "GitHub repair does not claim a Sites deployment occurred.",
    },
    "world_gate_status": production_gates.get("status"),
    "current_section": section_status.get("current_section"),
    "current_section_state": section_status.get("section_state"),
    "patches": patches,
    "acceptance_rule": "Exists -> loads -> visible -> positioned -> interactive -> performant -> verified in production",
}
TRUTH.write_text(json.dumps(truth, indent=2) + "\n", encoding="utf-8")
print(json.dumps(truth, indent=2))
