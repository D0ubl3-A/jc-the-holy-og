#!/usr/bin/env python3
"""Normalize the fifth JC route tag without changing IDs, slugs or asset status."""
import json
from pathlib import Path

P = Path(__file__).resolve().parents[1] / "manifest_0001-2000.json"
data = json.loads(P.read_text(encoding="utf-8"))
assets = data["assets"] if isinstance(data, dict) else data
assert len(assets) == 2000
assert [str(x["id"]).zfill(4) for x in assets] == [f"{i:04d}" for i in range(1, 2001)]
assert len({x["slug"] for x in assets}) == 2000
fixed = []
for item in assets:
    if item.get("route") == "New" and "New Devil" in item.get("title", ""):
        item["route"] = "New Devil"
        fixed.append(item["id"])
assert len(fixed) in (0, 40), f"Unexpected correction count: {len(fixed)}"
routes = {x.get("route") for x in assets if x.get("route")}
assert routes == {"Savior", "King", "Destroyer", "Liberator", "New Devil"}, routes
assert sum(x.get("status") == "verified" for x in assets) == 0, "Do not silently promote assets"
if fixed:
    P.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Five route labels validated. Corrected {len(fixed)} New Devil records.")
