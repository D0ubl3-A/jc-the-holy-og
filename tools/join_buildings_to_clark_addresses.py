#!/usr/bin/env python3
from __future__ import annotations
import argparse,csv,gzip,hashlib,json,re,time
from collections import Counter,defaultdict
from datetime import datetime,timezone
from pathlib import Path
import requests
from shapely.geometry import shape,Point,box
from shapely.validation import make_valid

POINT_QUERY='https://maps.clarkcountynv.gov/arcgis/rest/services/Address/Layers/FeatureServer/0/query'
AOEXT_QUERY='https://maps.clarkcountynv.gov/arcgis/rest/services/GISMO/Address/FeatureServer/2/query'
WORLD_WGS=(-115.34772749444959,35.97916144800393,-114.95149523108,36.300553215303474)
WORLD_UTM=(648949.782,3983561.814,683949.782,4018561.814)
CRS='EPSG:32611'
POINT_FIELDS='ID,Number,Direction,Name,Type,SubdName,Status,ParentID,PostQualifier,Accela_ID,Parcel'
AOEXT_FIELDS='SHAPE.fid,PARCEL,APN,LANDUSE,strno,strfrac,strdir,strname,strtype,strunit,subname,STATELANDUSE,City,NBRHOOD,CONSTYR'
UA='SinCityAddressJoin/2.0 (+https://github.com/D0ubl3-A/jc-the-holy-og)'

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
def post_json(s,url,params,tries=5):
 last=None
 for i in range(tries):
  r=s.post(url,data=params,timeout=(30,180));last=r
  if r.ok:
   j=r.json()
   if 'error' not in j:return j
  if i+1<tries:time.sleep(2**i)
 if last is not None:last.raise_for_status()
 raise RuntimeError(f'ArcGIS query failed: {url}')
def addr_text(number,direction,name,stype,fraction=None,unit=None):
 n='' if number is None else str(number).strip()
 if fraction is not None and str(fraction).strip():n=(n+' '+str(fraction).strip()).strip()
 vals=[n,direction,name,stype]
 s=' '.join(str(v).strip() for v in vals if v is not None and str(v).strip())
 if unit is not None and str(unit).strip():s=(s+' UNIT '+str(unit).strip()).strip()
 return s or None

def bbox_ids(s,url):
 j=post_json(s,url,{'f':'json','where':'1=1','geometry':','.join(map(str,WORLD_WGS)),'geometryType':'esriGeometryEnvelope','inSR':'4326','spatialRel':'esriSpatialRelIntersects','returnIdsOnly':'true'})
 return sorted(set(map(int,j.get('objectIds') or [])))

def acquire_point_addresses(root:Path,s):
 ids=bbox_ids(s,POINT_QUERY)
 if not ids:raise RuntimeError('Clark County point-address query returned zero IDs')
 raw=root/'address_points_epsg32611.geojsonseq.gz';by_parcel=defaultdict(list);world=box(*WORLD_UTM);stats=Counter()
 with gzip.open(raw,'wt',encoding='utf-8') as out:
  for start in range(0,len(ids),1000):
   j=post_json(s,POINT_QUERY,{'f':'geojson','objectIds':','.join(map(str,ids[start:start+1000])),'outFields':POINT_FIELDS,'returnGeometry':'true','outSR':'32611','returnZ':'false','returnM':'false'})
   for ft in j.get('features',[]):
    try:g=clean_geom(shape(ft.get('geometry')))
    except:g=None
    if g is None or not isinstance(g,Point) or not world.covers(g):continue
    p=ft.get('properties') or {};apn=napn(p.get('Parcel'));a=addr_text(p.get('Number'),p.get('Direction'),p.get('Name'),p.get('Type'))
    rec={'source':'CLARK_ADDRESS_POINT','id':p.get('ID'),'parcel':p.get('Parcel'),'parcel_norm':apn,'address':a,'number':p.get('Number'),'direction':p.get('Direction'),'name':p.get('Name'),'type':p.get('Type'),'subdivision':p.get('SubdName'),'status':p.get('Status'),'parent_id':p.get('ParentID'),'post_qualifier':p.get('PostQualifier'),'accela_id':p.get('Accela_ID'),'x':round(g.x,3),'y':round(g.y,3),'geometry':g}
    if apn:by_parcel[apn].append(rec)
    out.write(json.dumps({'type':'Feature','geometry':{'type':'Point','coordinates':[g.x,g.y]},'properties':{k:v for k,v in rec.items() if k!='geometry'}},separators=(',',':'))+'\n')
    stats['loaded']+=1;stats['with_parcel']+=bool(apn);stats['with_street_address']+=bool(a)
 return raw,ids,by_parcel,stats

def acquire_aoext(root:Path,s):
 ids=bbox_ids(s,AOEXT_QUERY)
 if not ids:raise RuntimeError('Clark County AOEXT query returned zero IDs')
 raw=root/'aoext_address_records.jsonseq.gz';by_parcel=defaultdict(list);stats=Counter()
 with gzip.open(raw,'wt',encoding='utf-8') as out:
  for start in range(0,len(ids),1000):
   j=post_json(s,AOEXT_QUERY,{'f':'json','objectIds':','.join(map(str,ids[start:start+1000])),'outFields':AOEXT_FIELDS,'returnGeometry':'false'})
   for ft in j.get('features',[]):
    p=ft.get('attributes') or ft.get('properties') or {};apn=napn(p.get('APN') or p.get('PARCEL'));a=addr_text(p.get('strno'),p.get('strdir'),p.get('strname'),p.get('strtype'),p.get('strfrac'),p.get('strunit'))
    rec={'source':'CLARK_GISMO_AOEXT','id':p.get('SHAPE.fid') or p.get('OBJECTID'),'parcel':p.get('APN') or p.get('PARCEL'),'parcel_norm':apn,'address':a,'number':p.get('strno'),'fraction':p.get('strfrac'),'direction':p.get('strdir'),'name':p.get('strname'),'type':p.get('strtype'),'unit':p.get('strunit'),'subdivision':p.get('subname'),'city':p.get('City'),'landuse':p.get('LANDUSE'),'state_landuse':p.get('STATELANDUSE'),'neighborhood':p.get('NBRHOOD'),'construction_year':p.get('CONSTYR')}
    if apn:by_parcel[apn].append(rec)
    out.write(json.dumps(rec,separators=(',',':'))+'\n');stats['loaded']+=1;stats['with_parcel']+=bool(apn);stats['with_street_address']+=bool(a);stats['with_landuse']+=bool(p.get('LANDUSE') or p.get('STATELANDUSE'));stats['with_construction_year']+=bool(p.get('CONSTYR'))
 return raw,ids,by_parcel,stats

def first_pass_building_counts(registry:Path):
 c=Counter()
 with gzip.open(registry,'rt',encoding='utf-8') as f:
  for line in f:
   p=(json.loads(line).get('properties') or {});apn=napn((p.get('parcel') or {}).get('primary_parcel_id'))
   if apn:c[apn]+=1
 return c

def point_candidate(r,relation=None,distance=None):
 return {'source':r['source'],'source_id':r.get('id'),'address':r.get('address'),'number':r.get('number'),'direction':r.get('direction'),'street_name':r.get('name'),'street_type':r.get('type'),'parcel_id':r.get('parcel'),'status':r.get('status'),'x':r.get('x'),'y':r.get('y'),'relation':relation,'distance_m':None if distance is None else round(distance,3),'source_state':'SOURCE-CONFIRMED'}
def aoext_candidate(r):
 return {'source':r['source'],'source_id':r.get('id'),'address':r.get('address'),'number':r.get('number'),'fraction':r.get('fraction'),'direction':r.get('direction'),'street_name':r.get('name'),'street_type':r.get('type'),'unit':r.get('unit'),'parcel_id':r.get('parcel'),'city':r.get('city'),'subdivision':r.get('subdivision'),'landuse':r.get('landuse'),'state_landuse':r.get('state_landuse'),'neighborhood':r.get('neighborhood'),'construction_year':r.get('construction_year'),'relation':'APN_LINKED_PARCEL_SITE','source_state':'SOURCE-CONFIRMED'}
def distinct_aoext(rows):
 seen={};
 for r in rows:
  key=(r.get('address') or '',r.get('unit') or '',r.get('landuse') or '',r.get('state_landuse') or '')
  if key not in seen:seen[key]=r
 return list(seen.values())

def join(registry:Path,outroot:Path):
 outroot.mkdir(parents=True,exist_ok=True);source=outroot/'source';source.mkdir(parents=True,exist_ok=True);s=requests.Session();s.headers.update({'User-Agent':UA})
 point_raw,point_ids,points_by_apn,pstats=acquire_point_addresses(source,s)
 ao_raw,ao_ids,ao_by_apn,aostats=acquire_aoext(source,s)
 building_counts=first_pass_building_counts(registry)
 outreg=outroot/'building_registry_parcel_address_joined.geojsonseq.gz';amb=outroot/'address_ambiguities.csv.gz';stats=Counter()
 with gzip.open(registry,'rt',encoding='utf-8') as src,gzip.open(outreg,'wt',encoding='utf-8') as dst,gzip.open(amb,'wt',encoding='utf-8',newline='') as af:
  aw=csv.writer(af);aw.writerow(['building_id','reason','parcel_id','candidate_count','addresses'])
  for line in src:
   stats['buildings_processed']+=1;ft=json.loads(line);p=ft.get('properties') or {};bid=p.get('building_id') or ft.get('id');g=clean_geom(shape(ft['geometry']));pa=p.get('parcel') or {};papn=napn(pa.get('primary_parcel_id'))
   pcands=list(points_by_apn.get(papn,[])) if papn else [];inside=[r for r in pcands if g is not None and g.covers(r['geometry'])]
   ao=distinct_aoext(ao_by_apn.get(papn,[])) if papn else []
   addr_rec={'state':'UNKNOWN','scope':'UNKNOWN','exact_building_address':False,'primary':None,'candidates':[],'sources':['Clark County Address/Layers FeatureServer/0','Clark County GISMO/Address FeatureServer/2 AOEXT_V'],'source_record_state':'SOURCE-CONFIRMED','relation_state':'UNKNOWN'}
   if len(inside)==1 and inside[0].get('address'):
    r=inside[0];addr_rec.update({'state':'SOURCE-CONFIRMED','scope':'BUILDING_POINT','exact_building_address':True,'primary':point_candidate(r,'POINT_INSIDE_BUILDING',0.0),'relation_state':'SOURCE-CONFIRMED'});stats['exact_building_address']+=1
   elif len(inside)>1:
    addr_rec.update({'state':'AMBIGUOUS','scope':'BUILDING_POINT_MULTIPLE','candidates':[point_candidate(r,'POINT_INSIDE_BUILDING',0.0) for r in inside[:25]],'relation_state':'AMBIGUOUS'});stats['ambiguous']+=1;aw.writerow([bid,'MULTIPLE_ADDRESS_POINTS_INSIDE_BUILDING',pa.get('primary_parcel_id'),len(inside),'|'.join(str(r.get('address') or '') for r in inside[:10])])
   elif len(ao)==1 and ao[0].get('address'):
    r=ao[0];addr_rec.update({'state':'SOURCE-CONFIRMED','scope':'PARCEL_SITE','exact_building_address':False,'primary':aoext_candidate(r),'relation_state':'ESTIMATED' if building_counts[papn]>1 else 'SOURCE-CONFIRMED'});stats['parcel_site_address']+=1
   elif len(ao)>1:
    valid=[r for r in ao if r.get('address')]
    if len(valid)==1:
     r=valid[0];addr_rec.update({'state':'SOURCE-CONFIRMED','scope':'PARCEL_SITE','exact_building_address':False,'primary':aoext_candidate(r),'relation_state':'ESTIMATED' if building_counts[papn]>1 else 'SOURCE-CONFIRMED'});stats['parcel_site_address']+=1
    else:
     addr_rec.update({'state':'AMBIGUOUS','scope':'PARCEL_SITE_MULTIPLE','candidates':[aoext_candidate(r) for r in ao[:25]],'relation_state':'AMBIGUOUS'});stats['ambiguous']+=1;aw.writerow([bid,'MULTIPLE_AOEXT_ADDRESSES_ON_CONFIRMED_PARCEL',pa.get('primary_parcel_id'),len(ao),'|'.join(str(r.get('address') or '') for r in ao[:10])])
   elif len(pcands)==1 and pcands[0].get('address'):
    r=pcands[0];d=g.distance(r['geometry']) if g is not None else None;addr_rec.update({'state':'SOURCE-CONFIRMED','scope':'PARCEL_SITE','exact_building_address':False,'primary':point_candidate(r,'ONLY_ADDRESS_POINT_ON_CONFIRMED_PARCEL',d),'relation_state':'ESTIMATED' if building_counts[papn]>1 or (d is not None and d>0) else 'SOURCE-CONFIRMED'});stats['parcel_site_address']+=1
   elif pcands:
    ranked=sorted(((g.distance(r['geometry']),r) for r in pcands),key=lambda z:z[0]) if g is not None else []
    addr_rec.update({'state':'AMBIGUOUS','scope':'PARCEL_SITE_MULTIPLE','candidates':[point_candidate(r,'SAME_CONFIRMED_PARCEL',d) for d,r in ranked[:25]],'relation_state':'AMBIGUOUS'});stats['ambiguous']+=1;aw.writerow([bid,'MULTIPLE_ADDRESS_POINTS_ON_CONFIRMED_PARCEL',pa.get('primary_parcel_id'),len(pcands),'|'.join(str(r.get('address') or '') for r in pcands[:10])])
   else:stats['unknown']+=1
   p['address_resolution']=addr_rec
   if ao:
    # These source facts seed later identity/architecture gates; they are not promoted to final facts here.
    p['assessor_context_candidates']=[{'landuse':r.get('landuse'),'state_landuse':r.get('state_landuse'),'construction_year':r.get('construction_year'),'city':r.get('city'),'subdivision':r.get('subdivision'),'source':'CLARK_GISMO_AOEXT','state':'SOURCE-CONFIRMED'} for r in ao[:10]]
   if addr_rec['exact_building_address']:p['generation_status']='ADDRESS_POINT_RESOLVED_IDENTITY_ARCHITECTURE_UNRESOLVED'
   elif addr_rec['scope']=='PARCEL_SITE':p['generation_status']='PARCEL_SITE_ADDRESS_RESOLVED_BUILDING_ADDRESS_UNRESOLVED'
   ft['properties']=p;dst.write(json.dumps(ft,separators=(',',':'))+'\n')
 report={'schema':'sincity-building-address-join-validation-v2','generated_at':now(),'status':'PASS' if stats['buildings_processed'] else 'FAIL','canonical_crs':CRS,'sources':{'point_layer':POINT_QUERY,'aoext_layer':AOEXT_QUERY},'point_object_ids_returned':len(point_ids),'address_points_loaded':pstats['loaded'],'address_points_with_parcel':pstats['with_parcel'],'address_points_with_street_address':pstats['with_street_address'],'aoext_object_ids_returned':len(ao_ids),'aoext_records_loaded':aostats['loaded'],'aoext_records_with_parcel':aostats['with_parcel'],'aoext_records_with_street_address':aostats['with_street_address'],'aoext_records_with_landuse':aostats['with_landuse'],'aoext_records_with_construction_year':aostats['with_construction_year'],'buildings_processed':stats['buildings_processed'],'exact_building_addresses':stats['exact_building_address'],'parcel_site_addresses':stats['parcel_site_address'],'ambiguous_building_addresses':stats['ambiguous'],'unknown_building_addresses':stats['unknown'],'hard_rules':{'parcel_site_address_promoted_to_exact_building_address':0,'ambiguous_addresses_forced_to_primary':0,'invented_addresses':0,'aoext_landuse_promoted_to_final_identity':0,'aoext_construction_year_promoted_to_verified_architecture':0,'final_visual_generation_authorized':False},'evidence_policy':{'county_source_records':'SOURCE-CONFIRMED','single_point_inside_building':'SOURCE-CONFIRMED exact building address','aoext_apn_address':'SOURCE-CONFIRMED PARCEL_SITE address; exact building attribution false','multi_address_parcel':'AMBIGUOUS','unsupported':'UNKNOWN'},'identity_state':'PENDING','architecture_state':'PENDING','terrain_z_state':'PENDING','outputs':{'joined_registry':outreg.name,'joined_registry_sha256':sha256(outreg),'ambiguity_queue':amb.name,'ambiguity_queue_sha256':sha256(amb),'point_source_file':str(point_raw.relative_to(outroot)),'point_source_sha256':sha256(point_raw),'aoext_source_file':str(ao_raw.relative_to(outroot)),'aoext_source_sha256':sha256(ao_raw)}}
 (outroot/'validation_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');(outroot/'README.md').write_text(f"# Sin City Address Join v2\n\nStatus: **{report['status']}**\n\nExact building-point addresses: **{stats['exact_building_address']:,}**. Parcel/site addresses: **{stats['parcel_site_address']:,}**. Ambiguous: **{stats['ambiguous']:,}**. Unknown: **{stats['unknown']:,}**. Final visuals remain blocked.\n",encoding='utf-8')
 return 0 if report['status']=='PASS' else 2

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--registry',required=True);ap.add_argument('--output',default='work/address-join');a=ap.parse_args();return join(Path(a.registry),Path(a.output))
if __name__=='__main__':raise SystemExit(main())
