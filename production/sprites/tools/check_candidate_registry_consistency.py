#!/usr/bin/env python3
"""Fail-closed 2,000-sprite registry/ledger consistency check. Not an art QA pass."""
import collections
import json
import sys
from pathlib import Path

def audit(manifest_path, ledger_path):
    m = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    l = json.loads(Path(ledger_path).read_text(encoding="utf-8"))
    assets = m.get("assets", [])
    counts = collections.Counter(x.get("status") for x in assets)
    errors = []
    ids = [x.get("id") for x in assets]
    if ids != [f"{i:04d}" for i in range(1, 2001)]:
        errors.append("IDs missing, repeated or out of order")
    if len(set(x.get("slug") for x in assets)) != 2000:
        errors.append("asset slugs not unique")
    if m.get("target") != 2000 or l.get("target") != 2000:
        errors.append("target not 2000")
    if set(counts) - {"planned", "generated_unverified", "verified"}:
        errors.append("invalid status")
    for field, status in (("verified_completed", "verified"), ("generated_unverified", "generated_unverified"), ("planned", "planned")):
        if m.get(field) != counts[status]:
            errors.append(f"manifest {field} mismatch")
    if l.get("verified_completed") != counts["verified"]:
        errors.append("ledger verified mismatch")
    if l.get("generated_unverified_archive_candidate_ids") != counts["generated_unverified"]:
        errors.append("ledger candidate mismatch")
    if l.get("planned_without_archived_candidate") != counts["planned"]:
        errors.append("ledger planned mismatch")
    if sum(counts.values()) != 2000:
        errors.append("status count != 2000")
    by_id = {x.get("id"): x for x in assets}
    for i in range(1721, 1737):
        ident = f"{i:04d}"
        x = by_id.get(ident, {})
        evidence = x.get("run90_candidate_registry_evidence", {})
        if x.get("category") != "effects" or x.get("status") != "generated_unverified":
            errors.append(f"{ident}: VFX candidate missing")
        if evidence.get("binary_in_repository") is not False or evidence.get("release_verified") is not False or not evidence.get("source_report"):
            errors.append(f"{ident}: VFX archive provenance missing")
    if any(x.get("status") == "verified" and not x.get("sha256") for x in assets):
        errors.append("verified asset missing SHA256")
    return {"passed": not errors, "errors": errors, "status_counts": dict(counts), "vfx_ids_checked": 16,
            "note": "Registry integrity only; Godot, image anatomy, native provenance and physical Android remain untested."}

if __name__ == "__main__":
    manifest = sys.argv[1] if len(sys.argv) > 1 else "production/sprites/manifest_0001-2000.json"
    ledger = sys.argv[2] if len(sys.argv) > 2 else "production/sprites/progress_ledger.json"
    result = audit(manifest, ledger)
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["passed"] else 1)
