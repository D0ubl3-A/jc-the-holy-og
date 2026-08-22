#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
import rasterio
from rasterio.enums import Resampling

BOUNDS=[648949.782,3983561.814,683949.782,4018561.814]

def sha256(path):
 h=hashlib.sha256()
 with open(path,'rb') as f:
  for c in iter(lambda:f.read(1<<20),b''):h.update(c)
 return h.hexdigest()

def now():return datetime.now(timezone.utc).isoformat()

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--source',required=True);ap.add_argument('--output',default='jc-the-holy-og-assets/generated/terrain-relief.js');ap.add_argument('--size',type=int,default=176);a=ap.parse_args()
 src=Path(a.source);out=Path(a.output);out.parent.mkdir(parents=True,exist_ok=True)
 with rasterio.open(src) as ds:
  arr=ds.read(1,out_shape=(a.size,a.size),resampling=Resampling.bilinear,masked=True).astype('float64')
  vals=arr.compressed()
  if vals.size<100:raise SystemExit('terrain has too few finite samples')
  filled=np.asarray(arr.filled(np.nan))
  baseline=float(np.nanpercentile(filled,35));minv=float(np.nanmin(filled));maxv=float(np.nanmax(filled));median=float(np.nanmedian(filled))
  q=np.where(np.isfinite(filled),np.rint(filled*10),-32768).astype(np.int32).ravel().tolist()
 meta={'schema':'jc-real-terrain-relief-v1','generated_at':now(),'crs':'EPSG:32611','bounds_epsg32611':BOUNDS,'width':a.size,'height':a.size,'source_sha256':sha256(src),'source_pixel_size_m':10,'sample_grid':'bilinear downsample for runtime relief','height_encoding':'decimeters absolute elevation; -32768 nodata','min_elevation_m':round(minv,3),'max_elevation_m':round(maxv,3),'median_elevation_m':round(median,3),'gameplay_safe_baseline_m':round(baseline,3),'urban_flatten_radius_m':11000,'urban_blend_end_m':14500,'source':'USGS 3DEP Bare Earth DEM'}
 js='window.JC_REAL_TERRAIN_RELIEF='+json.dumps({'meta':meta,'heights_dm':q},separators=(',',':'))+';\n'
 out.write_text(js,encoding='utf-8')
 manifest=out.with_suffix('.manifest.json');manifest.write_text(json.dumps({**meta,'runtime_file':out.name,'runtime_bytes':out.stat().st_size,'runtime_sha256':sha256(out)},indent=2),encoding='utf-8')
 print(json.dumps({**meta,'runtime_bytes':out.stat().st_size,'runtime_sha256':sha256(out)},indent=2))
if __name__=='__main__':main()
