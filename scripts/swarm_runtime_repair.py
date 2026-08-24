#!/usr/bin/env python3
"""Deterministic first-pass repair for JC runtime integration.

This script intentionally fixes only defects that are directly evidenced in the
current playable runtime. It does not generate new art or silently mark world
sections complete.
"""
from __future__ import annotations

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
FULL_STRIP = ROOT / "jc-the-holy-og-assets" / "full-strip-runtime.js"
TRUTH = ROOT / "world" / "swarm-runtime-truth.json"


def replace_required(text: str, old: str, new: str, label: str) -> tuple[str, dict]:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1), {"id": label, "status": "PATCHED", "matches": count}


def git_sha() -> str:
    return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()


patches: list[dict] = []

# Agent 1: fix the full-strip module so it parses, and stop provisional fake
# resort geometry from overlaying the source-grounded district runtime.
full = FULL_STRIP.read_text(encoding="utf-8")
full, result = replace_required(
    full,
    'root.userData.landmarks = specs.map((spec) => spec.name);\\n    root.userData.landmarkEvidence',
    'root.userData.landmarks = specs.map((spec) => spec.name);\n    root.userData.landmarkEvidence',
    "full-strip-literal-newline-1",
)
patches.append(result)
full, result = replace_required(
    full,
    'Object.fromEntries(specs.map((spec) => [spec.name, spec.evidence || "provisional"]));\\n    root.userData.corridorVerification',
    'Object.fromEntries(specs.map((spec) => [spec.name, spec.evidence || "provisional"]));\n    root.userData.corridorVerification',
    "full-strip-literal-newline-2",
)
patches.append(result)
full, result = replace_required(
    full,
    'if (scene?.isScene) buildFullStrip(scene);',
    'if (scene?.isScene && window.JC_VEGAS_SECTIONS?.runtimeDistrictPacks?.status !== "ready") buildFullStrip(scene);',
    "disable-provisional-strip-overlay-when-real-packs-ready",
)
patches.append(result)
FULL_STRIP.write_text(full, encoding="utf-8")

# Agent 2: correct runtime integration defects in the main playable module.
index = INDEX.read_text(encoding="utf-8")
index, result = replace_required(
    index,
    'gltfLoader.load("./jc-the-holy-og-assets/models/vegas-city-lod.glb",g=>{cityLayer=prepareGlb(g.scene,"city");proceduralCity.visible=true;',
    'gltfLoader.load("./jc-the-holy-og-assets/models/vegas-city-lod.glb",g=>{cityLayer=prepareGlb(g.scene,"city");proceduralCity.visible=false;',
    "hide-procedural-city-after-real-city-load",
)
patches.append(result)
index, result = replace_required(
    index,
    'function buildRenamedLandmarks(parent){if(!stripAnchor)return;',
    'function buildRenamedLandmarks(parent){if(!stripAnchor||window.JC_VEGAS_SECTIONS?.runtimeDistrictPacks?.status==="ready")return;',
    "disable-renamed-landmark-fallback-with-real-packs",
)
patches.append(result)
index, result = replace_required(
    index,
    'if(assetAtlases.legacyCharacter){for(let i=0;i<8;i++)mats.push(new THREE.SpriteMaterial({map:tile(assetAtlases.legacyCharacter,i%4,(i/4)|0),transparent:true,depthWrite:false,toneMapped:false}));return mats}',
    'if(assetAtlases.devil){for(let i=0;i<8;i++)mats.push(new THREE.SpriteMaterial({map:tile(assetAtlases.devil,i%4,(i/4)|0),transparent:true,depthWrite:false,toneMapped:false}));return mats}',
    "stop-satan-from-using-jc-legacy-atlas",
)
patches.append(result)
index, result = replace_required(
    index,
    'if(e.code==="Space")graceWave();',
    'if(e.code==="Space"&&!flying)graceWave();',
    "flight-space-no-longer-triggers-grace-wave",
)
patches.append(result)

old_devil = 'function updateDevil(dt){const target=citizens.find(c=>c.state==="normal"&&c.mesh.visible);const aim=(target?target.mesh.position:playerObject.position).clone().sub(devil.position).setY(0);let devilSpeed=0,devilSteer=0;if(aim.length()>18){aim.normalize();const targetHeading=Math.atan2(aim.x,aim.z),delta=Math.atan2(Math.sin(targetHeading-devil.rotation.y),Math.cos(targetHeading-devil.rotation.y));devilSteer=clamp(delta*1.7,-1,1);devil.position.addScaledVector(aim,dt*32);devil.rotation.y=targetHeading;devilSpeed=32}updateVehicleWheels(devil,devilSpeed,devilSteer,dt);devilShot-=dt;if(devilShot<=0){devilShot=2.4;if(target&&target.mesh.position.distanceTo(devil.position)<220){fire("soul",devil.position,target.mesh.position);projectiles[projectiles.length-1].target=target}else fire("havoc",devil.position,playerObject.position)}}'
new_devil = 'function updateDevil(dt){const target=citizens.find(c=>c.state==="normal"&&c.mesh.visible);const aim=(target?target.mesh.position:devil.position).clone().sub(devil.position).setY(0);let devilSpeed=0,devilSteer=0;if(target&&aim.length()>18){aim.normalize();const targetHeading=Math.atan2(aim.x,aim.z),delta=Math.atan2(Math.sin(targetHeading-devil.rotation.y),Math.cos(targetHeading-devil.rotation.y));devilSteer=clamp(delta*1.7,-1,1);devil.position.addScaledVector(aim,dt*32);devil.rotation.y=targetHeading;devilSpeed=32}updateVehicleWheels(devil,devilSpeed,devilSteer,dt);devilShot-=dt;if(devilShot<=0){devilShot=2.4;const nearDevil=playerObject.position.distanceTo(devil.position)<95,protectingTarget=target&&playerObject.position.distanceTo(target.mesh.position)<75,jcInterfering=nearDevil||protectingTarget;if(target&&target.mesh.position.distanceTo(devil.position)<220){fire("soul",devil.position,target.mesh.position);projectiles[projectiles.length-1].target=target}else if(jcInterfering&&playerObject.position.distanceTo(devil.position)<240)fire("havoc",devil.position,playerObject.position)}}'
index, result = replace_required(index, old_devil, new_devil, "devil-prioritizes-population-until-jc-interferes")
patches.append(result)
INDEX.write_text(index, encoding="utf-8")

# Agent 0: write machine-readable runtime truth. A PASS here means this repair
# script completed, not that every Vegas district is finished.
production_gates = json.loads((ROOT / "world" / "production-gates.json").read_text(encoding="utf-8"))
section_status = json.loads((ROOT / "world" / "section-status.json").read_text(encoding="utf-8"))
truth = {
    "schema": "jc-swarm-runtime-truth-v1",
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "source_commit_before_repair": git_sha(),
    "swarm_run": "runtime-truth-2026-08-24",
    "status": "REPAIR_APPLIED_PENDING_QA",
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
