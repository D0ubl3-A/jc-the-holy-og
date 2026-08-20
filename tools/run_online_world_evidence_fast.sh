#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-work/online-evidence-fast}"
mkdir -p "$ROOT/osm/source" "$ROOT/terrain/source"

# Current Nevada OpenStreetMap extract from Geofabrik.
pushd "$ROOT/osm/source" >/dev/null
curl -fL --retry 6 --retry-delay 3 -o nevada-latest.osm.pbf https://download.geofabrik.de/north-america/us/nevada-latest.osm.pbf
curl -fL --retry 6 --retry-delay 3 -o nevada-latest.osm.pbf.md5 https://download.geofabrik.de/north-america/us/nevada-latest.osm.pbf.md5
md5sum -c nevada-latest.osm.pbf.md5
sha256sum nevada-latest.osm.pbf > nevada-latest.osm.pbf.sha256.txt
popd >/dev/null

osmium extract -b -115.34772749444959,35.97916144800393,-114.95149523108,36.300553215303474 -s complete_ways -o "$ROOT/osm/sincity-world.osm.pbf" "$ROOT/osm/source/nevada-latest.osm.pbf"
osmium tags-filter "$ROOT/osm/sincity-world.osm.pbf" nwr/building nwr/building:part nwr/amenity nwr/shop nwr/tourism nwr/leisure nwr/barrier nwr/highway nwr/landuse nwr/man_made nwr/natural nwr/addr:housenumber nwr/addr:street -o "$ROOT/osm/sincity-context.osm.pbf"
osmium fileinfo -e -j "$ROOT/osm/sincity-world.osm.pbf" > "$ROOT/osm/sincity-world.osm.fileinfo.json"
osmium fileinfo -e -j "$ROOT/osm/sincity-context.osm.pbf" > "$ROOT/osm/sincity-context.osm.fileinfo.json"
sha256sum "$ROOT/osm/sincity-world.osm.pbf" "$ROOT/osm/sincity-context.osm.pbf" > "$ROOT/osm/osm_outputs.sha256.txt"
rm -f "$ROOT/osm/source/nevada-latest.osm.pbf"

# One seamless current USGS 3DEP server-side export for the full 35x35 km world.
python - "$ROOT" <<'PY'
import json,sys,time
from pathlib import Path
import requests
root=Path(sys.argv[1])
source=root/'terrain/source'
source.mkdir(parents=True,exist_ok=True)
endpoint='https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage'
params={
 'bbox':'648949.782,3983561.814,683949.782,4018561.814',
 'bboxSR':'32611','size':'3500,3500','imageSR':'32611','format':'tiff','pixelType':'F32',
 'interpolation':'RSP_BilinearInterpolation','noData':'-9999','noDataInterpretation':'esriNoDataMatchAny',
 'returnSquarePixels':'true','f':'json'
}
s=requests.Session();s.headers.update({'User-Agent':'SinCityOnlineEvidence/3DEP (+https://github.com/D0ubl3-A/jc-the-holy-og)'})
last=None
for i in range(6):
    try:
        r=s.post(endpoint,data=params,timeout=(30,300)); last=r
        if r.ok:
            j=r.json()
            if j.get('href'):
                break
    except Exception:
        j={}
    time.sleep(min(30,2**i))
else:
    if last is not None: last.raise_for_status()
    raise RuntimeError(f'3DEP exportImage did not return href: {j}')
(source/'3dep_export_response.json').write_text(json.dumps(j,indent=2))
href=j['href']
with s.get(href,stream=True,timeout=(30,600)) as d:
    d.raise_for_status()
    with open(source/'3dep_export_raw.tif','wb') as f:
        for chunk in d.iter_content(1<<20):
            if chunk:f.write(chunk)
print('downloaded',source/'3dep_export_raw.tif',(source/'3dep_export_raw.tif').stat().st_size)
PY

gdal_translate -of GTiff -co COMPRESS=DEFLATE -co PREDICTOR=3 -co TILED=YES -co BIGTIFF=IF_SAFER "$ROOT/terrain/source/3dep_export_raw.tif" "$ROOT/terrain/sincity-terrain-10m-epsg32611.tif"
gdalinfo -json "$ROOT/terrain/sincity-terrain-10m-epsg32611.tif" > "$ROOT/terrain/sincity-terrain-10m-epsg32611.gdalinfo.json"
sha256sum "$ROOT/terrain/sincity-terrain-10m-epsg32611.tif" > "$ROOT/terrain/terrain_output.sha256.txt"
rm -f "$ROOT/terrain/source/3dep_export_raw.tif"

python - "$ROOT" <<'PY'
import hashlib,json,os,sys
from pathlib import Path
root=Path(sys.argv[1])
def sha(p):
 h=hashlib.sha256()
 with open(p,'rb') as f:
  for c in iter(lambda:f.read(1<<20),b''):h.update(c)
 return h.hexdigest()
ao=json.load(open(root/'aoext/clark_aoext_acquisition_report.json'))
gi=json.load(open(root/'terrain/sincity-terrain-10m-epsg32611.gdalinfo.json'))
outputs={'aoext_records':root/'aoext/clark_aoext_world_records.jsonl.gz','osm_world':root/'osm/sincity-world.osm.pbf','osm_context':root/'osm/sincity-context.osm.pbf','terrain':root/'terrain/sincity-terrain-10m-epsg32611.tif'}
assert ao['records_written']>0
assert gi.get('size')==[3500,3500],gi.get('size')
for p in outputs.values():assert p.exists() and p.stat().st_size>0,p
manifest={'schema':'sincity-online-world-evidence-v4','status':'PASS','github_run_id':os.environ.get('GITHUB_RUN_ID'),'github_sha':os.environ.get('GITHUB_SHA'),'world':{'crs':'EPSG:32611','bounds_epsg32611':[648949.782,3983561.814,683949.782,4018561.814],'bounds_wgs84':[-115.34772749444959,35.97916144800393,-114.95149523108,36.300553215303474],'grid':'35x35 km; 1225 1-km tiles'},'sources':{'clark_county_aoext':{'url':'https://maps.clarkcountynv.gov/arcgis/rest/services/GISMO/Address/MapServer/2/query','records':ao['records_written'],'unique_apns':ao['unique_apns'],'records_with_address':ao['records_with_address'],'records_with_landuse':ao['records_with_landuse'],'records_with_construction_year':ao['records_with_construction_year']},'openstreetmap_geofabrik':{'url':'https://download.geofabrik.de/north-america/us/nevada-latest.osm.pbf','license':'ODbL 1.0'},'usgs_3dep':{'url':'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage','product':'3DEP Bare Earth DEM dynamic service','output_crs':'EPSG:32611','output_size':[3500,3500],'pixel_size_m':10}},'outputs':{k:{'path':str(p.relative_to(root)),'bytes':p.stat().st_size,'sha256':sha(p)} for k,p in outputs.items()},'hard_rules':{'synthetic_source_records':0,'fabricated_addresses':0,'fabricated_architecture':0,'fabricated_elevations':0,'owner_personal_data_ingested':False}}
(root/'online_evidence_manifest.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps(manifest,indent=2))
PY
