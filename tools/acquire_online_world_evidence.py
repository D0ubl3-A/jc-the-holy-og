#!/usr/bin/env python3
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import requests

WORLD_WGS84 = (-115.34772749444959, 35.97916144800393, -114.95149523108, 36.300553215303474)
WORLD_UTM = (648949.782, 3983561.814, 683949.782, 4018561.814)
AOEXT_QUERY = "https://maps.clarkcountynv.gov/arcgis/rest/services/GISMO/Address/MapServer/2/query"
AOEXT_FIELDS = [
    "SHAPE.fid", "PARCEL", "APN", "LANDUSE", "strno", "strfrac", "strdir",
    "strname", "strtype", "strunit", "subname", "TAXDIST", "STATELANDUSE",
    "City", "NBRHOOD", "LEGAL_DESCR3", "CONSTYR", "LANDACRES", "SECTNO",
    "TOWNSHIP", "RANGE"
]
UA = "SinCityOnlineEvidence/1.0 (+https://github.com/D0ubl3-A/jc-the-holy-og)"


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def normalize_apn(value):
    if value is None:
        return None
    s = re.sub(r"[^0-9A-Za-z]", "", str(value)).upper()
    return s or None


def full_address(p: dict) -> str | None:
    parts = [p.get("strno"), p.get("strfrac"), p.get("strdir"), p.get("strname"), p.get("strtype"), p.get("strunit")]
    s = " ".join(str(v).strip() for v in parts if v is not None and str(v).strip())
    return s or None


def post_json(session: requests.Session, data: dict, tries: int = 6) -> dict:
    last = None
    for i in range(tries):
        try:
            r = session.post(AOEXT_QUERY, data=data, timeout=(30, 240))
            last = r
            if r.ok:
                j = r.json()
                if "error" not in j:
                    return j
        except requests.RequestException:
            pass
        if i + 1 < tries:
            time.sleep(min(30, 2 ** i))
    if last is not None:
        last.raise_for_status()
    raise RuntimeError("Clark County AOEXT query failed after retries")


def acquire_aoext(outroot: Path) -> dict:
    outroot.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    session.headers.update({"User-Agent": UA})
    bbox = ",".join(map(str, WORLD_WGS84))

    ids_result = post_json(session, {
        "f": "json",
        "where": "1=1",
        "geometry": bbox,
        "geometryType": "esriGeometryEnvelope",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "returnIdsOnly": "true",
    })
    ids = sorted(set(int(v) for v in (ids_result.get("objectIds") or [])))
    if not ids:
        raise RuntimeError("Clark County AOEXT returned zero object IDs for the Sin City bounds")

    records_path = outroot / "clark_aoext_world_records.jsonl.gz"
    stats = Counter()
    unique_apns = set()
    with gzip.open(records_path, "wt", encoding="utf-8") as out:
        for start in range(0, len(ids), 750):
            chunk = ids[start:start + 750]
            j = post_json(session, {
                "f": "json",
                "objectIds": ",".join(map(str, chunk)),
                "outFields": ",".join(AOEXT_FIELDS),
                "returnGeometry": "false",
            })
            for feature in j.get("features", []):
                attrs = feature.get("attributes") or {}
                apn_norm = normalize_apn(attrs.get("APN") or attrs.get("PARCEL"))
                if apn_norm:
                    unique_apns.add(apn_norm)
                    stats["with_apn"] += 1
                addr = full_address(attrs)
                if addr:
                    stats["with_address"] += 1
                if attrs.get("LANDUSE") or attrs.get("STATELANDUSE"):
                    stats["with_landuse"] += 1
                if attrs.get("CONSTYR") not in (None, "", 0):
                    stats["with_construction_year"] += 1
                rec = {
                    "source": "Clark County GISMO AOEXT_V MapServer/2",
                    "source_state": "SOURCE-CONFIRMED",
                    "source_object_id": attrs.get("SHAPE.fid"),
                    "apn": attrs.get("APN"),
                    "parcel": attrs.get("PARCEL"),
                    "apn_norm": apn_norm,
                    "address": addr,
                    "street": {
                        "number": attrs.get("strno"),
                        "fraction": attrs.get("strfrac"),
                        "direction": attrs.get("strdir"),
                        "name": attrs.get("strname"),
                        "type": attrs.get("strtype"),
                        "unit": attrs.get("strunit"),
                    },
                    "subdivision": attrs.get("subname"),
                    "city": attrs.get("City"),
                    "landuse": attrs.get("LANDUSE"),
                    "state_landuse": attrs.get("STATELANDUSE"),
                    "construction_year": attrs.get("CONSTYR"),
                    "land_acres": attrs.get("LANDACRES"),
                    "tax_district": attrs.get("TAXDIST"),
                    "neighborhood": attrs.get("NBRHOOD"),
                    "legal_description": attrs.get("LEGAL_DESCR3"),
                    "section": attrs.get("SECTNO"),
                    "township": attrs.get("TOWNSHIP"),
                    "range": attrs.get("RANGE"),
                }
                out.write(json.dumps(rec, separators=(",", ":")) + "\n")
                stats["records"] += 1

    report = {
        "schema": "sincity-online-aoext-acquisition-v1",
        "generated_at": now(),
        "world_bounds_wgs84": list(WORLD_WGS84),
        "world_bounds_epsg32611": list(WORLD_UTM),
        "source": AOEXT_QUERY,
        "source_layer": "AOEXT_V",
        "source_fields": AOEXT_FIELDS,
        "privacy_filter": "OWNER, OWNER2, sale price/date and document-number fields intentionally excluded; not required for world reconstruction",
        "object_ids_returned": len(ids),
        "records_written": stats["records"],
        "unique_apns": len(unique_apns),
        "records_with_apn": stats["with_apn"],
        "records_with_address": stats["with_address"],
        "records_with_landuse": stats["with_landuse"],
        "records_with_construction_year": stats["with_construction_year"],
        "output": records_path.name,
        "output_sha256": sha256(records_path),
    }
    (outroot / "clark_aoext_acquisition_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", default="work/online-evidence/aoext")
    args = ap.parse_args()
    report = acquire_aoext(Path(args.output))
    if report["records_written"] <= 0:
        return 2
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
