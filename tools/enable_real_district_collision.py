#!/usr/bin/env python3
from pathlib import Path

index=Path('index.html')
s=index.read_text(encoding='utf-8')
old='function collideBuildings(pos,r){if(insideInterior)return false;for(const b of buildingBoxes){const dx=pos.x-b.x,dz=pos.z-b.z,c=Math.cos(b.a),s=Math.sin(b.a),lx=dx*c-dz*s,lz=dx*s+dz*c;if(Math.abs(lx)<b.w*.5+r&&Math.abs(lz)<b.d*.5+r)return true}return false}'
new='function collideBuildings(pos,r){if(insideInterior)return false;const realCollision=window.JC_REAL_VEGAS_COLLISION;if(realCollision?.active?.())return !!realCollision.collides(pos,r);for(const b of buildingBoxes){const dx=pos.x-b.x,dz=pos.z-b.z,c=Math.cos(b.a),s=Math.sin(b.a),lx=dx*c-dz*s,lz=dx*s+dz*c;if(Math.abs(lx)<b.w*.5+r&&Math.abs(lz)<b.d*.5+r)return true}return false}'
if new not in s:
    if old not in s: raise SystemExit('legacy collideBuildings signature not found')
    s=s.replace(old,new,1)
portal_old='function nearestPortal(){let best=null,bd=1e9;for(const p of buildingPortals){const dx=jesus.position.x-p.x,dz=jesus.position.z-p.z,d=dx*dx+dz*dz;if(d<bd){bd=d;best=p}}return{portal:best,distance:Math.sqrt(bd)}}'
portal_new='function nearestPortal(){if(window.JC_REAL_VEGAS_COLLISION?.active?.())return{portal:null,distance:Infinity};let best=null,bd=1e9;for(const p of buildingPortals){const dx=jesus.position.x-p.x,dz=jesus.position.z-p.z,d=dx*dx+dz*dz;if(d<bd){bd=d;best=p}}return{portal:best,distance:Math.sqrt(bd)}}'
if portal_new not in s:
    if portal_old not in s: raise SystemExit('legacy nearestPortal signature not found')
    s=s.replace(portal_old,portal_new,1)
index.write_text(s,encoding='utf-8')

sections=Path('jc-the-holy-og-assets/vegas-sections.js')
t=sections.read_text(encoding='utf-8')
if 'real-vegas-collision-runtime.js' not in t:
    anchor="document.write('<script type=\"module\" src=\"./jc-the-holy-og-assets/real-vegas-district-runtime.js\"><\\/script>');"
    if anchor not in t: raise SystemExit('district runtime anchor not found')
    t=t.replace(anchor,anchor+"\ndocument.write('<script type=\"module\" src=\"./jc-the-holy-og-assets/real-vegas-collision-runtime.js\"><\\/script>');",1)
if 'version:10' in t:t=t.replace('version:10','version:11',1)
sections.write_text(t,encoding='utf-8')
print('real district collision enabled')
