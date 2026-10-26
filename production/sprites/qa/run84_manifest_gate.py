"""Run84 static manifest gate. Does NOT certify anatomy or engine/mobile performance."""
import json
from pathlib import Path
p=Path(__file__).resolve().parents[1]/"manifest_0001-2000.json"
assets=json.loads(p.read_text(encoding="utf-8"))
assert isinstance(assets,list) and len(assets)==2000
ids=[str(a["id"]).zfill(4) for a in assets]
assert ids==[f"{i:04d}" for i in range(1,2001)]
assert len(set(ids))==2000
assert len({a["category"] for a in assets})==12
# Prior string-valued release_verified flags are not authoritative release evidence.
print("PASS: 2000 ordered unique IDs, 12 categories. This is NOT sprite release verification.")
