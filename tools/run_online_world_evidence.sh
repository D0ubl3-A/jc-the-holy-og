#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-work/online-evidence}"
mkdir -p "$ROOT/osm/source" "$ROOT/terrain/source"

# Current Nevada OSM from Geofabrik, then exact Sin City crop.
pushd "$ROOT/osm/source" >/dev/null
curl -fL --retry 6 --retry-delay 5 -o nevada-latest.osm.pbf https://download.geofabrik.de/north-america/us/nevada-latest.osm.pbf
curl -fL --retry 6 --retry-delay 5 -o nevada-latest.osm.pbf.md5 https://download.geofabrik.de/north-america/us/nevada-latest.osm.pbf.md5
md5sum -c nevada-latest.osm.pbf.md5
sha256sum nevada-latest.osm.pbf > nevada-latest.osm.pbf.sha256.txt
popd >/dev/null

osmium extract \
  -b -115.34772749444959,35.97916144800393,-114.95149523108,36.300553215303474 \
  -s complete_ways \
  -o "$ROOT/osm/sincity-world.osm.pbf" \
  "$ROOT/osm/source/nevada-latest.osm.pbf"

osmium tags-filter "$ROOT/osm/sincity-world.osm.pbf" \
  nwr/building nwr/building:part nwr/amenity nwr/shop nwr/tourism \
  nwr/leisure nwr/barrier nwr/highway nwr/landuse nwr/man_made \
  nwr/natural nwr/addr:housenumber nwr/addr:street \
  -o "$ROOT/osm/sincity-context.osm.pbf"

osmium fileinfo -e -j "$ROOT/osm/sincity-world.osm.pbf" > "$ROOT/osm/sincity-world.osm.fileinfo.json"
osmium fileinfo -e -j "$ROOT/osm/sincity-context.osm.pbf" > "$ROOT/osm/sincity-context.osm.fileinfo.json"
sha256sum "$ROOT/osm/sincity-world.osm.pbf" "$ROOT/osm/sincity-context.osm.pbf" > "$ROOT/osm/osm_outputs.sha256.txt"
rm -f "$ROOT/osm/source/nevada-latest.osm.pbf"

# Current USGS 3DEP 1/3 arc-second tiles covering the exact world.
pushd "$ROOT/terrain/source" >/dev/null
: > source_urls.txt
: > source_tiles.sha256.txt
for tile in n36w116 n36w115 n37w116 n37w115; do
  url="https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/13/TIFF/current/${tile}/USGS_13_${tile}.tif"
  echo "$url" >> source_urls.txt
  curl -fL --retry 6 --retry-delay 5 -o "USGS_13_${tile}.tif" "$url"
  sha256sum "USGS_13_${tile}.tif" >> source_tiles.sha256.txt
done
gdalbuildvrt usgs_13_source.vrt USGS_13_*.tif
popd >/dev/null

gdalwarp \
  -overwrite \
  -t_srs EPSG:32611 \
  -te_srs EPSG:32611 \
  -te 648949.782 3983561.814 683949.782 4018561.814 \
  -ts 3500 3500 \
  -r bilinear \
  -dstnodata -9999 \
  -co COMPRESS=DEFLATE \
  -co PREDICTOR=3 \
  -co TILED=YES \
  -co BIGTIFF=IF_SAFER \
  "$ROOT/terrain/source/usgs_13_source.vrt" \
  "$ROOT/terrain/sincity-terrain-10m-epsg32611.tif"

gdalinfo -json "$ROOT/terrain/sincity-terrain-10m-epsg32611.tif" > "$ROOT/terrain/sincity-terrain-10m-epsg32611.gdalinfo.json"
sha256sum "$ROOT/terrain/sincity-terrain-10m-epsg32611.tif" > "$ROOT/terrain/terrain_output.sha256.txt"
rm -f "$ROOT"/terrain/source/USGS_13_*.tif "$ROOT/terrain/source/usgs_13_source.vrt"

# Hard validation + provenance manifest.
python - "$ROOT" <<'PY'
import hashlib,json,os,sys
from pathlib import Path
root=Path(sys.argv[1])
def sha(p):
    h=hashlib.sha256()
    with open(p,'rb') as f:
        for c in iter(lambda:f.read(1<<20),b''): h.update(c)
    return h.hexdigest()
ao=json.load(open(root/'aoext/clark_aoext_acquisition_report.json'))
gi=json.load(open(root/'terrain/sincity-terrain-10m-epsg32611.gdalinfo.json'))
outputs={
    'aoext_records':root/'aoext/clark_aoext_world_records.jsonl.gz',
    'osm_world':root/'osm/sincity-world.osm.pbf',
    'osm_context':root/'osm/sincity-context.osm.pbf',
    'terrain':root/'terrain/sincity-terrain-10m-epsg32611.tif',
}
assert ao['records_written']>0, ao
assert gi.get('size')==[3500,3500], gi.get('size')
for p in outputs.values(): assert p.exists() and p.stat().st_size>0, p
manifest={
    'schema':'sincity-online-world-evidence-v3',
    'status':'PASS',
    'github_run_id':os.environ.get('GITHUB_RUN_ID'),
    'github_sha':os.environ.get('GITHUB_SHA'),
    'world':{
        'crs':'EPSG:32611',
        'bounds_epsg32611':[648949.782,3983561.814,683949.782,4018561.814],
        'bounds_wgs84':[-115.34772749444959,35.97916144800393,-114.95149523108,36.300553215303474],
        'grid':'35x35 km; 1225 1-km tiles'
    },
    'sources':{
        'clark_county_aoext':{
            'url':'https://maps.clarkcountynv.gov/arcgis/rest/services/GISMO/Address/MapServer/2/query',
            'records':ao['records_written'],
            'unique_apns':ao['unique_apns'],
            'records_with_address':ao['records_with_address'],
            'records_with_landuse':ao['records_with_landuse'],
            'records_with_construction_year':ao['records_with_construction_year']
        },
        'openstreetmap_geofabrik':{
            'url':'https://download.geofabrik.de/north-america/us/nevada-latest.osm.pbf',
            'license':'ODbL 1.0'
        },
        'usgs_3dep':{
            'url_root':'https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/13/TIFF/current/',
            'tiles':['n36w116','n36w115','n37w116','n37w115'],
            'product':'1/3 arc-second DEM',
            'license':'Public Domain',
            'output_crs':'EPSG:32611',
            'output_size':[3500,3500],
            'pixel_size_m':10
        }
    },
    'outputs':{k:{'path':str(p.relative_to(root)),'bytes':p.stat().st_size,'sha256':sha(p)} for k,p in outputs.items()},
    'hard_rules':{
        'synthetic_source_records':0,
        'fabricated_addresses':0,
        'fabricated_architecture':0,
        'fabricated_elevations':0,
        'owner_personal_data_ingested':False
    }
}
(root/'online_evidence_manifest.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps(manifest,indent=2))
PY
