#!/usr/bin/env python3
from __future__ import annotations
import argparse,csv,gzip,hashlib,json,math,time
from collections import Counter
from datetime import datetime,timezone
from pathlib import Path
import requests
from shapely.geometry import shape,mapping,box
from shapely.strtree import STRtree
from shapely.validation import make_valid

PARCEL_QUERY='https://maps.clarkcountynv.gov/arcgis/rest/services/GISMO/AssessorMap/FeatureServer/1/query'
WORLD_WGS=(-115.34772749444959,35.97916144800393,-114.95149523108,36.300553215303474)
WORLD_UTM=(648949.782,3983561.814,683949.782,4018561.814)
CRS='EPSG:32611'
OUT_FIELDS='OID,APN,CALC_ACRES,ASSR_ACRES,Label_Class,PARCELTYPE,TAX_DIST'
UA='SinCityParcelJoin/1.0 (+https://github.com/D0ubl3-A/jc-the-holy-og)'

def now(): return datetime.now(timezone.utc).isoformat()
def sha256(p):
 h=hashlib.sha256()
 with open(p,'rb') as f:
  for c in iter(lambda:f.read(1<<20),b''): h.update(c)
 return h.hexdigest()
def clean_geom(g):
 if g is None or g.is_empty:return None
 if not g.is_valid:
  try:g=make_valid(g)
  except:return None
 if g.is_empty:return None
 return g

def get_json(s,params,tries=5):
 for i in range(tries):
  r=s.get(PARCEL_QUERY,params=params,timeout=(30,180))
  if r.ok:
   j=r.json()
   if 'error' not in j:return j
  if i+1<tries:time.sleep(2**i)
 r.raise_for_status();return r.json()

def acquire_parcels(root:Path):
 root.mkdir(parents=True,exist_ok=True)
 s=requests.Session();s.headers.update({'User-Agent':UA})
 ids=get_json(s,{
  'f':'json','where':'1=1','geometry':','.join(map(str,WORLD_WGS)),
  'geometryType':'esriGeometryEnvelope','inSR':'4326','spatialRel':'esriSpatialRelIntersects',
  'returnIdsOnly':'true'
 }).get('objectIds') or []
 ids=sorted(set(map(int,ids)))
 if not ids:raise RuntimeError('Clark County parcel query returned zero object IDs')
 raw=root/'parcels_epsg32611.geojsonseq.gz'
 feats=[];properties=[];oids=[]
 with gzip.open(raw,'wt',encoding='utf-8') as out:
  for start in range(0,len(ids),1000):
   chunk=ids[start:start+1000]
   j=get_json(s,{
    'f':'geojson','objectIds':','.join(map(str,chunk)),'outFields':OUT_FIELDS,
    'returnGeometry':'true','outSR':'32611','returnZ':'false','returnM':'false'
   })
   for ft in j.get('features',[]):
    try:g=clean_geom(shape(ft.get('geometry')))
    except:g=None
    if g is None or not g.intersects(box(*WORLD_UTM)):continue
    p=ft.get('properties') or {}
    oid=p.get('OID') or p.get('OBJECTID') or p.get('ObjectId')
    rec={'type':'Feature','geometry':mapping(g),'properties':p}
    out.write(json.dumps(rec,separators=(',',':'))+'\n')
    feats.append(g);properties.append(p);oids.append(oid)
 return raw,feats,properties,oids,len(ids)

def join(registry:Path,outroot:Path):
 outroot.mkdir(parents=True,exist_ok=True)
 parcel_file,parcels,pprops,poids,ids_returned=acquire_parcels(outroot/'source')
 tree=STRtree(parcels)
 outreg=outroot/'building_registry_parcel_joined.geojsonseq.gz'
 amb=outroot/'parcel_join_ambiguities.csv.gz'
 stats=Counter();apn_counts=Counter()
 with gzip.open(registry,'rt',encoding='utf-8') as src,gzip.open(outreg,'wt',encoding='utf-8') as dst,gzip.open(amb,'wt',encoding='utf-8',newline='') as af:
  aw=csv.writer(af);aw.writerow(['building_id','reason','candidate_count','candidate_apns','top_overlap_pct'])
  for line in src:
   stats['buildings_processed']+=1
   ft=json.loads(line);g=clean_geom(shape(ft['geometry']));pr=ft.get('properties') or {};bid=pr.get('building_id') or ft.get('id')
   cand_idx=list(tree.query(g,predicate='intersects')) if g is not None else []
   overlaps=[]
   for idx in cand_idx:
    pg=parcels[int(idx)]
    try:a=g.intersection(pg).area
    except:a=0.0
    if a<=0.01:continue
    pp=pprops[int(idx)];apn=pp.get('APN');pct=a/g.area if g.area else 0.0
    overlaps.append({'idx':int(idx),'oid':poids[int(idx)],'apn':apn,'overlap_area_m2':round(a,3),'overlap_pct':round(pct,6),'calc_acres':pp.get('CALC_ACRES'),'assr_acres':pp.get('ASSR_ACRES'),'label_class':pp.get('Label_Class'),'parcel_type':pp.get('PARCELTYPE'),'tax_dist':pp.get('TAX_DIST')})
   overlaps.sort(key=lambda x:(x['overlap_area_m2'],x['overlap_pct']),reverse=True)
   primary=None;method='NO_MATCH';confidence=0.0;state='UNKNOWN'
   if overlaps:
    rp=g.representative_point();containing=[]
    for o in overlaps:
     try:
      if parcels[o['idx']].covers(rp):containing.append(o)
     except:pass
    top=overlaps[0];second=overlaps[1] if len(overlaps)>1 else None
    if len(containing)==1 and containing[0]['overlap_pct']>=0.50:
     primary=containing[0];method='REPRESENTATIVE_POINT_AND_OVERLAP';confidence=min(0.99,0.80+0.19*primary['overlap_pct']);state='SOURCE_CONFIRMED'
    elif top['overlap_pct']>=0.90 and (second is None or top['overlap_area_m2']>=2*second['overlap_area_m2']):
     primary=top;method='DOMINANT_AREA_OVERLAP';confidence=min(0.98,0.75+0.23*top['overlap_pct']);state='SOURCE_CONFIRMED'
    elif len(overlaps)==1 and top['overlap_pct']>=0.25:
     primary=top;method='SINGLE_INTERSECTION';confidence=min(0.90,0.55+0.35*top['overlap_pct']);state='SOURCE_CONFIRMED'
    else:
     method='AMBIGUOUS_MULTI_PARCEL';state='AMBIGUOUS';stats['ambiguous']+=1
     aw.writerow([bid,method,len(overlaps),'|'.join(str(o.get('apn') or '') for o in overlaps[:8]),top['overlap_pct']])
   if primary:
    stats['joined']+=1
    if primary.get('apn'):apn_counts[str(primary['apn'])]+=1
   else:
    stats['unjoined']+=1
    if not overlaps:stats['no_intersection']+=1
   pr['parcel']={
    'primary_parcel_id': primary.get('apn') if primary else None,
    'primary_parcel_oid': primary.get('oid') if primary else None,
    'state':state,'join_method':method,'confidence':round(confidence,4),
    'intersecting_parcels':[{k:v for k,v in o.items() if k!='idx'} for o in overlaps],
    'source':'Clark County GISMO AssessorMap Parcels FeatureServer/1',
    'source_crs':'service native; requested output EPSG:32611'
   }
   pr['generation_status']='PARCEL_JOINED_IDENTITY_ARCHITECTURE_UNRESOLVED' if primary else 'FOOTPRINT_RESOLVED_PARCEL_UNRESOLVED'
   ft['properties']=pr;dst.write(json.dumps(ft,separators=(',',':'))+'\n')
 report={
  'schema':'sincity-building-parcel-join-validation-v1','generated_at':now(),'status':'PASS' if stats['joined']>0 else 'FAIL',
  'canonical_crs':CRS,'world_bounds':list(WORLD_UTM),'parcel_source':PARCEL_QUERY,
  'parcel_object_ids_returned':ids_returned,'parcel_polygons_loaded':len(parcels),
  'buildings_processed':stats['buildings_processed'],'buildings_joined':stats['joined'],'buildings_unjoined':stats['unjoined'],
  'ambiguous_buildings':stats['ambiguous'],'no_intersection':stats['no_intersection'],
  'unique_primary_apns':len(apn_counts),'multi_building_parcels':sum(1 for v in apn_counts.values() if v>1),
  'hard_rules':{'parcels_used_as_building_geometry':0,'invented_apns':0,'ambiguous_crossings_forced_to_primary':0,'final_visual_generation_authorized':False},
  'row_control_state':'PENDING_SEPARATE_ROW_CONTROL_LAYER','address_state':'PENDING','identity_state':'PENDING','architecture_state':'PENDING',
  'outputs':{'joined_registry':outreg.name,'joined_registry_sha256':sha256(outreg),'ambiguity_queue':amb.name,'ambiguity_queue_sha256':sha256(amb),'parcel_source_file':str(parcel_file.relative_to(outroot)),'parcel_source_sha256':sha256(parcel_file)}
 }
 (outroot/'validation_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
 (outroot/'README.md').write_text(f"# Sin City Parcel Join\n\nStatus: **{report['status']}**\n\nBuildings joined: **{stats['joined']:,} / {stats['buildings_processed']:,}**. Ambiguous: **{stats['ambiguous']:,}**. No parcel intersection: **{stats['no_intersection']:,}**. Final visuals remain blocked.\n",encoding='utf-8')
 return 0 if report['status']=='PASS' else 2

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--registry',required=True);ap.add_argument('--output',default='work/parcel-join');a=ap.parse_args();return join(Path(a.registry),Path(a.output))
if __name__=='__main__':raise SystemExit(main())
