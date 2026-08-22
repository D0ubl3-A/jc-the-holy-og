#!/usr/bin/env python3
from __future__ import annotations
import argparse, gzip, hashlib, json, math
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from pyproj import Transformer
from shapely.geometry import shape, Polygon, MultiPolygon

TX = Transformer.from_crs('EPSG:4326','EPSG:32611',always_xy=True)
DISTRICTS = {
  'strip': {'label':'Las Vegas Strip','bbox_wgs84':[-115.200,36.075,-115.145,36.165],'limit':8000},
  'downtown': {'label':'Downtown + Fremont','bbox_wgs84':[-115.175,36.155,-115.105,36.205],'limit':6500},
  'paradise-east': {'label':'Paradise East','bbox_wgs84':[-115.165,36.085,-115.095,36.175],'limit':6500},
  'henderson': {'label':'Henderson / Green Valley','bbox_wgs84':[-115.125,35.980,-114.990,36.095],'limit':8500},
  'west-vegas': {'label':'West Las Vegas','bbox_wgs84':[-115.320,36.075,-115.185,36.190],'limit':7000},
  'north-vegas': {'label':'North Las Vegas','bbox_wgs84':[-115.230,36.180,-115.035,36.300],'limit':7000},
}

def now(): return datetime.now(timezone.utc).isoformat()
def sha256(path):
  h=hashlib.sha256()
  with open(path,'rb') as f:
    for c in iter(lambda:f.read(1<<20),b''):h.update(c)
  return h.hexdigest()

def utm_bbox(w):
  minlon,minlat,maxlon,maxlat=w
  pts=[TX.transform(minlon,minlat),TX.transform(minlon,maxlat),TX.transform(maxlon,minlat),TX.transform(maxlon,maxlat)]
  xs=[p[0] for p in pts];ys=[p[1] for p in pts]
  return [min(xs),min(ys),max(xs),max(ys)]

def rings_for_geometry(geom, origin):
  g=shape(geom)
  if g.is_empty:return []
  try:g=g.simplify(0.35,preserve_topology=True)
  except:pass
  polys=[]
  if isinstance(g,Polygon):polys=[g]
  elif isinstance(g,MultiPolygon):polys=list(g.geoms)
  else:return []
  out=[];ox,oy=origin
  for p in polys:
    coords=list(p.exterior.coords)
    if len(coords)<4:continue
    ring=[]
    for x,y in coords[:-1]: ring.append([int(round((x-ox)*10)),int(round((y-oy)*10))])
    if len(ring)>=3:out.append(ring)
  return out

def score_record(pr, district_center):
  area=float(pr.get('footprint_area_m2') or 0)
  h=pr.get('height_m')
  height_bonus=300000 if h is not None else 0
  cx=float(pr.get('centroid_x') or 0);cy=float(pr.get('centroid_y') or 0)
  dist=math.hypot(cx-district_center[0],cy-district_center[1])
  return height_bonus + min(area,20000)*20 - dist*0.18

def main():
  ap=argparse.ArgumentParser()
  ap.add_argument('--registry',required=True)
  ap.add_argument('--output',default='jc-the-holy-og-assets/generated/districts')
  a=ap.parse_args(); registry=Path(a.registry); out=Path(a.output); out.mkdir(parents=True,exist_ok=True)
  specs={}
  for key,s in DISTRICTS.items():
    b=utm_bbox(s['bbox_wgs84']);specs[key]={**s,'bbox_utm':b,'center':[(b[0]+b[2])/2,(b[1]+b[3])/2]}
  candidates=defaultdict(list);scanned=0
  with gzip.open(registry,'rt',encoding='utf-8') as f:
    for line in f:
      scanned+=1
      ft=json.loads(line);pr=ft.get('properties') or {}
      cx=float(pr.get('centroid_x') or 0);cy=float(pr.get('centroid_y') or 0)
      for key,s in specs.items():
        b=s['bbox_utm']
        if b[0]<=cx<=b[2] and b[1]<=cy<=b[3]: candidates[key].append((score_record(pr,s['center']),ft))
  manifest={'schema':'jc-real-vegas-runtime-district-packs-v1','generated_at':now(),'source_registry':str(registry),'source_registry_sha256':sha256(registry),'source_records_scanned':scanned,'crs':'EPSG:32611','coordinate_encoding':'decimeters relative to district origin','districts':{}}
  index_rows=[]
  for key,s in specs.items():
    rows=sorted(candidates[key],key=lambda x:x[0],reverse=True)[:s['limit']]
    b=s['bbox_utm'];origin=[math.floor(b[0]),math.floor(b[1])]
    buildings=[];tiles=defaultdict(int);with_height=0;repaired=0;parts=0
    for _,ft in rows:
      pr=ft.get('properties') or {};rings=rings_for_geometry(ft.get('geometry'),origin)
      if not rings:continue
      h=pr.get('height_m')
      if h is not None:with_height+=1
      if pr.get('geometry_state')=='REPAIRED_SOURCE_GEOMETRY':repaired+=1
      tile=pr.get('owner_section_id') or 'UNKNOWN';tiles[tile]+=1;parts+=len(rings)
      buildings.append({'id':pr.get('building_id'),'t':tile,'h':None if h is None else round(float(h),2),'hs':pr.get('height_state') or 'UNKNOWN','a':round(float(pr.get('footprint_area_m2') or 0),1),'g':pr.get('geometry_state') or 'SOURCE_CONFIRMED','r':rings})
    pack={'schema':'jc-real-vegas-district-pack-v1','id':key,'label':s['label'],'crs':'EPSG:32611','origin_utm':origin,'unit_m':0.1,'bbox_wgs84':s['bbox_wgs84'],'bbox_utm':[round(v,3) for v in b],'source':'Microsoft Global ML Building Footprints 2026-07-24 via verified Sin City registry','buildings':buildings}
    js=f"window.JC_REAL_DISTRICT_PACKS=window.JC_REAL_DISTRICT_PACKS||{{}};window.JC_REAL_DISTRICT_PACKS[{json.dumps(key)}]={json.dumps(pack,separators=(',',':'))};\n"
    path=out/f'{key}.js';path.write_text(js,encoding='utf-8')
    rec={'label':s['label'],'file':f'./jc-the-holy-og-assets/generated/districts/{key}.js','bbox_wgs84':s['bbox_wgs84'],'bbox_utm':[round(v,3) for v in b],'origin_utm':origin,'selected_buildings':len(buildings),'source_candidates':len(candidates[key]),'buildings_with_source_height':with_height,'repaired_source_geometry':repaired,'polygon_parts':parts,'tile_count':len(tiles),'bytes':path.stat().st_size,'sha256':sha256(path)}
    manifest['districts'][key]=rec;index_rows.append({'id':key,**{k:rec[k] for k in ('label','file','bbox_wgs84','bbox_utm','origin_utm','selected_buildings','bytes','sha256')}})
  idx=f"window.JC_REAL_DISTRICT_INDEX={json.dumps({'schema':'jc-real-vegas-district-index-v1','crs':'EPSG:32611','districts':index_rows},separators=(',',':'))};\n"
  (out/'index.js').write_text(idx,encoding='utf-8')
  manifest['index_sha256']=sha256(out/'index.js')
  (out/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
  print(json.dumps(manifest,indent=2))

if __name__=='__main__':main()
