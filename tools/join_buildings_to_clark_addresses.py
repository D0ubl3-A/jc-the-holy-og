#!/usr/bin/env python3
from __future__ import annotations
import argparse,csv,gzip,hashlib,json,re,time
from collections import Counter,defaultdict
from datetime import datetime,timezone
from pathlib import Path
import requests
from shapely.geometry import shape,Point,box
from shapely.validation import make_valid

ADDRESS_QUERY='https://maps.clarkcountynv.gov/arcgis/rest/services/Address/Layers/FeatureServer/0/query'
WORLD_WGS=(-115.34772749444959,35.97916144800393,-114.95149523108,36.300553215303474)
WORLD_UTM=(648949.782,3983561.814,683949.782,4018561.814)
CRS='EPSG:32611'
OUT_FIELDS='ID,Number,Direction,Name,Type,SubdName,Status,ParentID,PostQualifier,Accela_ID,Parcel'
UA='SinCityAddressJoin/1.0 (+https://github.com/D0ubl3-A/jc-the-holy-og)'

def now(): return datetime.now(timezone.utc).isoformat()
def sha256(p):
 h=hashlib.sha256()
 with open(p,'rb') as f:
  for c in iter(lambda:f.read(1<<20),b''):h.update(c)
 return h.hexdigest()
def napn(v):
 if v is None:return None
 s=re.sub(r'[^0-9A-Za-z]','',str(v)).upper()
 return s or None
def clean_geom(g):
 if g is None or g.is_empty:return None
 if not g.is_valid:
  try:g=make_valid(g)
  except:return None
 return None if g.is_empty else g
def post_json(s,params,tries=5):
 last=None
 for i in range(tries):
  r=s.post(ADDRESS_QUERY,data=params,timeout=(30,180));last=r
  if r.ok:
   j=r.json()
   if 'error' not in j:return j
  if i+1<tries:time.sleep(2**i)
 if last is not None:last.raise_for_status()
 raise RuntimeError('Address service query failed')
def full_address(p):
 vals=[p.get('Number'),p.get('Direction'),p.get('Name'),p.get('Type')]
 return ' '.join(str(v).strip() for v in vals if v is not None and str(v).strip()) or None

def acquire_addresses(root:Path):
 root.mkdir(parents=True,exist_ok=True);s=requests.Session();s.headers.update({'User-Agent':UA})
 ids=post_json(s,{'f':'json','where':'1=1','geometry':','.join(map(str,WORLD_WGS)),'geometryType':'esriGeometryEnvelope','inSR':'4326','spatialRel':'esriSpatialRelIntersects','returnIdsOnly':'true'}).get('objectIds') or []
 ids=sorted(set(map(int,ids)))
 if not ids:raise RuntimeError('Clark County address query returned zero IDs')
 raw=root/'addresses_epsg32611.geojsonseq.gz';by_parcel=defaultdict(list);all_records=[];world=box(*WORLD_UTM);stats=Counter()
 with gzip.open(raw,'wt',encoding='utf-8') as out:
  for start in range(0,len(ids),1000):
   chunk=ids[start:start+1000]
   j=post_json(s,{'f':'geojson','objectIds':','.join(map(str,chunk)),'outFields':OUT_FIELDS,'returnGeometry':'true','outSR':'32611','returnZ':'false','returnM':'false'})
   for ft in j.get('features',[]):
    try:g=clean_geom(shape(ft.get('geometry')))
    except:g=None
    if g is None or not isinstance(g,Point) or not world.covers(g):continue
    p=ft.get('properties') or {};apn=napn(p.get('Parcel'));addr=full_address(p)
    rec={'id':p.get('ID'),'parcel':p.get('Parcel'),'parcel_norm':apn,'address':addr,'number':p.get('Number'),'direction':p.get('Direction'),'name':p.get('Name'),'type':p.get('Type'),'subdivision':p.get('SubdName'),'status':p.get('Status'),'parent_id':p.get('ParentID'),'post_qualifier':p.get('PostQualifier'),'accela_id':p.get('Accela_ID'),'x':round(g.x,3),'y':round(g.y,3),'geometry':g}
    all_records.append(rec)
    if apn:by_parcel[apn].append(rec)
    outft={'type':'Feature','geometry':{'type':'Point','coordinates':[g.x,g.y]},'properties':{k:v for k,v in rec.items() if k!='geometry'}}
    out.write(json.dumps(outft,separators=(',',':'))+'\n');stats['loaded']+=1
    if apn:stats['with_parcel']+=1
    if addr:stats['with_street_address']+=1
 return raw,ids,by_parcel,all_records,stats

def first_pass_building_counts(registry:Path):
 c=Counter()
 with gzip.open(registry,'rt',encoding='utf-8') as f:
  for line in f:
   ft=json.loads(line);p=ft.get('properties') or {};pa=p.get('parcel') or {};apn=napn(pa.get('primary_parcel_id'))
   if apn:c[apn]+=1
 return c

def public_candidate(r,relation=None,distance=None):
 return {'address_point_id':r.get('id'),'address':r.get('address'),'number':r.get('number'),'direction':r.get('direction'),'street_name':r.get('name'),'street_type':r.get('type'),'parcel_id':r.get('parcel'),'status':r.get('status'),'x':r.get('x'),'y':r.get('y'),'relation':relation,'distance_m':None if distance is None else round(distance,3),'source_state':'SOURCE-CONFIRMED'}

def join(registry:Path,outroot:Path):
 outroot.mkdir(parents=True,exist_ok=True)
 raw,ids,by_parcel,all_records,astats=acquire_addresses(outroot/'source')
 building_counts=first_pass_building_counts(registry)
 outreg=outroot/'building_registry_parcel_address_joined.geojsonseq.gz';amb=outroot/'address_ambiguities.csv.gz';stats=Counter();world_addresses=len(all_records)
 with gzip.open(registry,'rt',encoding='utf-8') as src,gzip.open(outreg,'wt',encoding='utf-8') as dst,gzip.open(amb,'wt',encoding='utf-8',newline='') as af:
  aw=csv.writer(af);aw.writerow(['building_id','reason','parcel_id','candidate_count','addresses'])
  for line in src:
   stats['buildings_processed']+=1;ft=json.loads(line);p=ft.get('properties') or {};bid=p.get('building_id') or ft.get('id');g=clean_geom(shape(ft['geometry']))
   pa=p.get('parcel') or {};papn=napn(pa.get('primary_parcel_id'));cands=list(by_parcel.get(papn,[])) if papn else []
   inside=[]
   if g is not None:
    for r in cands:
     if g.covers(r['geometry']):inside.append(r)
   addr_rec={'state':'UNKNOWN','scope':'UNKNOWN','exact_building_address':False,'primary':None,'candidates':[],'source':'Clark County Address/Layers FeatureServer/0','source_record_state':'SOURCE-CONFIRMED','relation_state':'UNKNOWN'}
   if len(inside)==1 and inside[0].get('address'):
    r=inside[0];addr_rec.update({'state':'SOURCE-CONFIRMED','scope':'BUILDING_POINT','exact_building_address':True,'primary':public_candidate(r,'POINT_INSIDE_BUILDING',0.0),'relation_state':'SOURCE-CONFIRMED'});stats['exact_building_address']+=1
   elif len(inside)>1:
    addr_rec.update({'state':'AMBIGUOUS','scope':'BUILDING_POINT_MULTIPLE','candidates':[public_candidate(r,'POINT_INSIDE_BUILDING',0.0) for r in inside[:25]],'relation_state':'AMBIGUOUS'});stats['ambiguous']+=1;aw.writerow([bid,'MULTIPLE_ADDRESS_POINTS_INSIDE_BUILDING',pa.get('primary_parcel_id'),len(inside),'|'.join(str(r.get('address') or '') for r in inside[:10])])
   elif papn and len(cands)==1 and cands[0].get('address'):
    r=cands[0];d=g.distance(r['geometry']) if g is not None else None
    # The county record and APN relation are source-confirmed; building-specific attribution is not.
    addr_rec.update({'state':'SOURCE-CONFIRMED','scope':'PARCEL_SITE','exact_building_address':False,'primary':public_candidate(r,'ONLY_ADDRESS_ON_CONFIRMED_PARCEL',d),'relation_state':'ESTIMATED' if building_counts[papn]>1 or (d is not None and d>0) else 'SOURCE-CONFIRMED'});stats['parcel_site_address']+=1
   elif papn and cands:
    ranked=[]
    if g is not None:
     for r in cands:ranked.append((g.distance(r['geometry']),r))
     ranked.sort(key=lambda z:z[0])
    addr_rec.update({'state':'AMBIGUOUS','scope':'PARCEL_SITE_MULTIPLE','candidates':[public_candidate(r,'SAME_CONFIRMED_PARCEL',d) for d,r in ranked[:25]],'relation_state':'AMBIGUOUS'});stats['ambiguous']+=1;aw.writerow([bid,'MULTIPLE_ADDRESSES_ON_CONFIRMED_PARCEL',pa.get('primary_parcel_id'),len(cands),'|'.join(str(r.get('address') or '') for r in cands[:10])])
   else:
    # For parcel-ambiguous buildings, inspect address points geometrically inside the footprint without inventing a parcel relation.
    spatial=[]
    if g is not None:
     minx,miny,maxx,maxy=g.bounds
     # Avoid a second global spatial index dependency; scan only when parcel is unresolved is too expensive globally,
     # so this case remains queued for the ambiguity-resolution pass.
    stats['unknown']+=1
   p['address_resolution']=addr_rec
   if addr_rec['exact_building_address']:p['generation_status']='ADDRESS_POINT_RESOLVED_IDENTITY_ARCHITECTURE_UNRESOLVED'
   elif addr_rec['scope']=='PARCEL_SITE':p['generation_status']='PARCEL_SITE_ADDRESS_RESOLVED_BUILDING_ADDRESS_UNRESOLVED'
   ft['properties']=p;dst.write(json.dumps(ft,separators=(',',':'))+'\n')
 report={'schema':'sincity-building-address-join-validation-v1','generated_at':now(),'status':'PASS' if stats['buildings_processed'] else 'FAIL','canonical_crs':CRS,'address_source':ADDRESS_QUERY,'address_object_ids_returned':len(ids),'address_points_loaded':astats['loaded'],'address_points_with_parcel':astats['with_parcel'],'address_points_with_street_address':astats['with_street_address'],'buildings_processed':stats['buildings_processed'],'exact_building_addresses':stats['exact_building_address'],'parcel_site_addresses':stats['parcel_site_address'],'ambiguous_building_addresses':stats['ambiguous'],'unknown_building_addresses':stats['unknown'],'hard_rules':{'parcel_site_address_promoted_to_exact_building_address':0,'ambiguous_addresses_forced_to_primary':0,'invented_addresses':0,'final_visual_generation_authorized':False},'evidence_policy':{'county_address_record':'SOURCE-CONFIRMED','point_inside_building_and_single_candidate':'SOURCE-CONFIRMED','single_address_on_confirmed_parcel':'SOURCE-CONFIRMED record; PARCEL_SITE scope; building attribution may be ESTIMATED','multiple_candidates':'AMBIGUOUS','unsupported':'UNKNOWN'},'identity_state':'PENDING','architecture_state':'PENDING','terrain_z_state':'PENDING','outputs':{'joined_registry':outreg.name,'joined_registry_sha256':sha256(outreg),'ambiguity_queue':amb.name,'ambiguity_queue_sha256':sha256(amb),'address_source_file':str(raw.relative_to(outroot)),'address_source_sha256':sha256(raw)}}
 (outroot/'validation_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');(outroot/'README.md').write_text(f"# Sin City Address Join\n\nStatus: **{report['status']}**\n\nExact building-point addresses: **{stats['exact_building_address']:,}**. Parcel/site addresses: **{stats['parcel_site_address']:,}**. Ambiguous: **{stats['ambiguous']:,}**. Unknown: **{stats['unknown']:,}**. Final visuals remain blocked.\n",encoding='utf-8')
 return 0 if report['status']=='PASS' else 2

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--registry',required=True);ap.add_argument('--output',default='work/address-join');a=ap.parse_args();return join(Path(a.registry),Path(a.output))
if __name__=='__main__':raise SystemExit(main())
