#!/usr/bin/env python3
from __future__ import annotations
import argparse,csv,gzip,hashlib,json,math,shutil
from collections import OrderedDict,Counter
from datetime import datetime,timezone
from pathlib import Path
import requests
from pyproj import Transformer
from shapely.geometry import box,mapping,shape,Polygon,MultiPolygon,GeometryCollection
from shapely.ops import transform as shp_transform,unary_union
from shapely.validation import make_valid
CRS='EPSG:32611'; SOURCE_CRS='EPSG:4326'; RELEASE='2026-07-24'
DATASET_LINKS='https://bfppub.blob.core.windows.net/$web/2026-07-24/dataset-links.csv'
LOCATION='UnitedStates'; QUADKEYS=('023013011','023013013','023013100','023013102')
MIN_X,MIN_Y,MAX_X,MAX_Y=648949.782,3983561.814,683949.782,4018561.814
WGS_BBOX=(-115.34772749444959,35.97916144800393,-114.95149523108,36.300553215303474)
GRID=35; TILE=1000.0; WORLD_UTM=box(MIN_X,MIN_Y,MAX_X,MAX_Y); WORLD_WGS=box(*WGS_BBOX)
TX=Transformer.from_crs(SOURCE_CRS,CRS,always_xy=True)
UA='SinCityBuildingRegistry/3.0 (+https://github.com/D0ubl3-A/jc-the-holy-og)'
def now(): return datetime.now(timezone.utc).isoformat()
def shafile(p):
 h=hashlib.sha256()
 with Path(p).open('rb') as f:
  for c in iter(lambda:f.read(1<<20),b''): h.update(c)
 return h.hexdigest()
def shatext(s): return hashlib.sha256(s.encode()).hexdigest()
def tid(x,y): return f'Tile_LV_X{x:03d}_Y{y:03d}'
def owner(pt):
 x=min(GRID-1,max(0,int(math.floor((pt.x-MIN_X)/TILE)))); y=min(GRID-1,max(0,int(math.floor((pt.y-MIN_Y)/TILE))))
 return tid(x,y)
def tiles_for(g):
 a,b,c,d=g.bounds; x0=max(0,min(34,int((a-MIN_X)//TILE))); x1=max(0,min(34,int((c-MIN_X)//TILE))); y0=max(0,min(34,int((b-MIN_Y)//TILE))); y1=max(0,min(34,int((d-MIN_Y)//TILE)))
 out=[]
 for y in range(y0,y1+1):
  for x in range(x0,x1+1):
   if g.intersects(box(MIN_X+x*TILE,MIN_Y+y*TILE,MIN_X+(x+1)*TILE,MIN_Y+(y+1)*TILE)): out.append(tid(x,y))
 return out
def poly(g):
 if g is None or g.is_empty:return None
 if isinstance(g,(Polygon,MultiPolygon)):return g
 if isinstance(g,GeometryCollection):
  p=[x for x in g.geoms if isinstance(x,(Polygon,MultiPolygon)) and not x.is_empty]
  return unary_union(p) if p else None
 return None
def number(v):
 try:f=float(v)
 except:return None
 return None if f<0 else f
class Writers:
 def __init__(self,root,n=64): self.root=Path(root);self.root.mkdir(parents=True,exist_ok=True);self.n=n;self.h=OrderedDict()
 def write(self,k,s):
  if k in self.h: h=self.h.pop(k);self.h[k]=h
  else:
   if len(self.h)>=self.n:_,z=self.h.popitem(last=False);z.close()
   h=gzip.open(self.root/f'{k}.geojsonseq.gz','at',encoding='utf-8');self.h[k]=h
  h.write(s)
 def close(self):
  for h in self.h.values():h.close()
  self.h.clear()
def download(s,url,out):
 out=Path(out);out.parent.mkdir(parents=True,exist_ok=True);tmp=Path(str(out)+'.part')
 with s.get(url,stream=True,timeout=(30,300)) as r:
  r.raise_for_status()
  with tmp.open('wb') as f:
   for c in r.iter_content(1<<20):
    if c:f.write(c)
 tmp.replace(out)
def links(s,raw):
 p=Path(raw)/'dataset-links.csv';download(s,DATASET_LINKS,p);found={}
 with p.open(encoding='utf-8-sig',newline='') as f:
  for r in csv.DictReader(f):
   q=str(r.get('QuadKey','')).strip()
   if r.get('Location')==LOCATION and q in QUADKEYS:found[q]=r
 miss=sorted(set(QUADKEYS)-set(found))
 if miss:raise RuntimeError(f'missing quadkeys {miss}')
 return p,[found[q] for q in QUADKEYS]
def process(path,q,url,master,iw,tw,seen,st,preview,part_sha):
 with gzip.open(path,'rt',encoding='utf-8') as f:
  for ln,line in enumerate(f,1):
   st['source_lines']+=1
   try: ft=json.loads(line); gw=shape(ft.get('geometry'))
   except: st['parse_rejected']+=1;continue
   if gw.is_empty or not gw.intersects(WORLD_WGS):st['outside_world']+=1;continue
   state='SOURCE_CONFIRMED'
   if not gw.is_valid:
    try:gw=poly(make_valid(gw))
    except:gw=None
    if gw is None or gw.is_empty:st['invalid_rejected']+=1;continue
    state='REPAIRED_SOURCE_GEOMETRY';st['repaired']+=1
   gw=poly(gw.intersection(WORLD_WGS))
   if gw is None or gw.is_empty:continue
   try:gu=poly(shp_transform(TX.transform,gw).intersection(WORLD_UTM))
   except:st['transform_rejected']+=1;continue
   if gu is None or gu.is_empty or gu.area<=1:st['tiny_rejected']+=1;continue
   if not gu.is_valid:
    try:gu=poly(make_valid(gu))
    except:gu=None
    if gu is None or gu.is_empty:st['utm_invalid_rejected']+=1;continue
    state='REPAIRED_SOURCE_GEOMETRY';st['repaired']+=1
   bh=hashlib.sha256((f'MSGLBF|{RELEASE}|'+gu.wkb_hex).encode('ascii')).hexdigest()[:32];bid='SC-BLDG-MS-'+bh
   if bid in seen:st['exact_duplicate_dropped']+=1;continue
   seen.add(bid);p=ft.get('properties') or {};rp=gu.representative_point();ce=gu.centroid;o=owner(rp);ints=tiles_for(gu);h=number(p.get('height'));conf=number(p.get('confidence'))
   pr={'building_id':bid,'source':'MICROSOFT_GLOBAL_ML_BUILDING_FOOTPRINTS','source_release':RELEASE,'source_location':LOCATION,'source_quadkey':q,'source_partition_sha256':part_sha,'source_line_number':ln,'source_url_sha256':shatext(url),'source_crs':SOURCE_CRS,'production_crs':CRS,'owner_section_id':o,'intersecting_section_ids':ints,'centroid_x':round(ce.x,3),'centroid_y':round(ce.y,3),'representative_x':round(rp.x,3),'representative_y':round(rp.y,3),'footprint_area_m2':round(gu.area,3),'height_m':h,'height_state':'SOURCE_CONFIRMED' if h is not None else 'UNKNOWN','source_detection_confidence':conf,'stories':None,'stories_state':'UNKNOWN','parcel_id':None,'parcel_state':'UNKNOWN','address':None,'address_state':'UNKNOWN','building_class':None,'identity_state':'UNKNOWN','architecture_state':'UNKNOWN','geometry_state':state,'evidence_state':'SOURCE_CONFIRMED','generation_status':'FOOTPRINT_RESOLVED_ARCHITECTURE_UNRESOLVED'}
   of={'type':'Feature','id':bid,'properties':pr,'geometry':mapping(gu)};s=json.dumps(of,separators=(',',':'))+'\n';master.write(s);tw.write(o,s);iw.writerow([bid,o,'|'.join(ints),q,pr['centroid_x'],pr['centroid_y'],pr['footprint_area_m2'],'' if h is None else h,'' if conf is None else conf,state]);st['accepted']+=1;st['tile::'+o]+=1
   if h is not None:st['height_present']+=1
   if conf is not None:st['confidence_present']+=1
   if len(preview)<500:preview.append({'type':'Feature','id':bid,'properties':pr,'geometry':mapping(gw)})
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--output',default='work/building-registry');a=ap.parse_args();root=Path(a.output).resolve();raw=root/'raw';out=root/'output';tiles=out/'tiles'
 if root.exists():shutil.rmtree(root)
 raw.mkdir(parents=True);out.mkdir(parents=True);s=requests.Session();s.headers.update({'User-Agent':UA});lp,rows=links(s,raw);receipts=[]
 for r in rows:
  q=str(r['QuadKey']);p=raw/f'{q}.csv.gz';download(s,r['Url'],p);receipts.append({'source':'MICROSOFT_GLOBAL_ML_BUILDING_FOOTPRINTS','release':RELEASE,'location':LOCATION,'quadkey':q,'url_sha256':shatext(r['Url']),'declared_size':r.get('Size'),'upload_date':r.get('UploadDate'),'downloaded_bytes':p.stat().st_size,'sha256':shafile(p)})
 masterp=out/'building_registry_epsg32611.geojsonseq.gz';idxp=out/'building_registry_index.csv.gz';st=Counter();preview=[];seen=set();tw=Writers(tiles)
 with gzip.open(masterp,'wt',encoding='utf-8') as master,gzip.open(idxp,'wt',encoding='utf-8',newline='') as idx:
  iw=csv.writer(idx);iw.writerow(['building_id','owner_section_id','intersecting_section_ids','source_quadkey','centroid_x','centroid_y','footprint_area_m2','height_m','source_detection_confidence','geometry_state'])
  for r,rc in zip(rows,receipts):process(raw/f"{r['QuadKey']}.csv.gz",str(r['QuadKey']),r['Url'],master,iw,tw,seen,st,preview,rc['sha256'])
 tw.close();tc={k[6:]:v for k,v in st.items() if k.startswith('tile::')};prev=out/'building_registry_preview_wgs84.geojson';prev.write_text(json.dumps({'type':'FeatureCollection','features':preview},separators=(',',':')))
 sm={'schema':'sincity-building-footprint-source-manifest-v1','generated_at':now(),'source_dataset':'Microsoft GlobalMLBuildingFootprints','source_release':RELEASE,'license':'CDLA-Permissive-2.0','dataset_links_url_sha256':shatext(DATASET_LINKS),'dataset_links_sha256':shafile(lp),'required_quadkeys':list(QUADKEYS),'receipts':receipts};(out/'source_manifest.json').write_text(json.dumps(sm,indent=2));(out/'tile_counts.json').write_text(json.dumps(tc,indent=2,sort_keys=True))
 n=st['accepted'];vr={'schema':'sincity-building-registry-validation-v1','generated_at':now(),'status':'PASS_FOOTPRINT_REGISTRY_BUILT' if n else 'FAIL_EMPTY_REGISTRY','canonical_world':{'crs':CRS,'bounds':[MIN_X,MIN_Y,MAX_X,MAX_Y],'wgs84_bbox':list(WGS_BBOX),'grid':[35,35],'tile_size_m':1000,'tile_count':1225},'building_count':n,'tiles_with_buildings':len(tc),'empty_tiles':1225-len(tc),'stats':{k:v for k,v in st.items() if not k.startswith('tile::')},'hard_rules':{'synthetic_footprints_created':0,'parcels_promoted_to_buildings':0,'unknown_story_counts_filled':0,'unknown_addresses_filled':0,'final_visual_generation_authorized':False},'outputs':{'registry':'output/'+masterp.name,'registry_sha256':shafile(masterp),'index':'output/'+idxp.name,'index_sha256':shafile(idxp),'preview':'output/'+prev.name,'source_manifest':'output/source_manifest.json','tiles_dir':'output/tiles'}};(out/'validation_report.json').write_text(json.dumps(vr,indent=2));(root/'README.md').write_text(f'# Sin City Building Registry\n\nStatus: **{vr["status"]}**\n\nBuildings accepted: **{n:,}**\n\nCanonical CRS: `{CRS}`. Synthetic footprints: **0**. Final visual generation remains blocked pending parcel/identity/architecture/context gates.\n')
 checks=[]
 for p in sorted(out.rglob('*')):
  if p.is_file():checks.append(f'{shafile(p)}  {p.relative_to(root).as_posix()}')
 (root/'SHA256SUMS.txt').write_text('\n'.join(checks)+'\n');print(json.dumps(vr,indent=2));return 0 if n else 2
if __name__=='__main__':raise SystemExit(main())
