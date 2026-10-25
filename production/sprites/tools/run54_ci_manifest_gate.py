#!/usr/bin/env python3
"""Fail closed: prevent unverified sprite art from being marked verified."""
import collections, hashlib, json, re, sys
from PIL import Image
from pathlib import Path
CATS={'jc_route_transformations':120,'locomotion_combat_flying':380,'humans':280,'angels':190,'demons':300,'bosses':100,'vehicles':150,'las_vegas_locations':200,'effects':160,'ui':70,'five_endings':50}
ROUTES={None,'Savior','King','Destroyer','Liberator','New Devil'}
FLAGS=['independent_native_render','canonical_identity_approved','anatomy_and_weapons_approved','camera_orientation_approved','frame_consistency_approved','godot4_import_passed','physical_android_benchmark_passed']
def check(d):
 a=d['assets']; e=[]; c=collections.Counter(x['category'] for x in a);s=collections.Counter(x['status'] for x in a)
 if len(a)!=2000 or [x['id'] for x in a]!=[f'{i:04d}' for i in range(1,2001)]:e.append('IDs not exactly 0001-2000')
 if len({x['slug'] for x in a})!=2000:e.append('duplicate slugs')
 if c!=CATS or d['category_targets']!=CATS:e.append('category totals mismatch')
 if d.get('target')!=2000 or d.get('verified')!=s['verified'] or d.get('candidate_unverified')!=s['generated_unverified'] or d.get('planned')!=s['planned']:e.append('aggregate mismatch')
 seen_verified_hashes=set()
 for x in a:
  i=x['id'];g=x['grid'];cell=x['cell_px'];m=x['master_px']
  if x['route'] not in ROUTES:e.append(i+': bad route')
  if m!=[g[0]*cell[0],g[1]*cell[1]] or not 1<=x['frames']<=g[0]*g[1]:e.append(i+': bad atlas geometry')
  if x['status'] not in ('planned','generated_unverified','verified'):e.append(i+': bad status')
  if x['status']=='verified':
   v=x.get('release_evidence',{})
   if any(v.get(k) is not True for k in FLAGS):e.append(i+': missing release approvals')
   if not v.get('independent_render_source_id') or not v.get('sha256') or not v.get('native_png_path'):e.append(i+': missing provenance or binary')
   if v.get('android_10th_percentile_fps',0)<55 or v.get('android_test_duration_seconds',0)<300:e.append(i+': no valid Android benchmark')
   path=Path(v.get('native_png_path',''))
   if path.is_absolute() or '..' in path.parts or not path.is_file():e.append(i+': native binary absent');continue
   raw=path.read_bytes();digest=hashlib.sha256(raw).hexdigest()
   if digest!=v.get('sha256') or digest in seen_verified_hashes:e.append(i+': hash mismatch/duplicate')
   seen_verified_hashes.add(digest)
   try:
    with Image.open(path) as img:
     img.load()
     if list(img.size)!=m or img.mode!='RGBA':e.append(i+': not native RGBA dimensions')
     if x['background']=='transparent':
      alpha=img.getchannel('A');bounds=alpha.getbbox();ex=alpha.getextrema()
      if not bounds or ex!=(0,255) or min(bounds[0],bounds[1],img.width-bounds[2],img.height-bounds[3])<48:e.append(i+': alpha/margins failed')
   except Exception as err:e.append(i+': unreadable PNG '+str(err))
 return e,s
if __name__=='__main__':
 d=json.loads(Path(sys.argv[1] if len(sys.argv)>1 else 'production/sprites/manifest_0001-2000.json').read_text())
 errors,statuses=check(d)
 print(json.dumps({'pass':not errors,'errors':errors[:100],'asset_count':len(d['assets']),'statuses':dict(statuses),'verified':statuses['verified']},indent=2))
 sys.exit(bool(errors))
