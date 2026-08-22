import * as THREE from "three";
import { mergeGeometries } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/utils/BufferGeometryUtils.js";

const KEY = "__JC_REAL_VEGAS_DISTRICTS_V1__";
const INDEX_URL = "./jc-the-holy-og-assets/generated/districts/index.js";
const WORLD = 11000;
const CANONICAL = { minE:648949.782, minN:3983561.814, maxE:683949.782, maxN:4018561.814 };

if (!window[KEY]) {
  const mobile = matchMedia("(pointer:coarse)").matches;
  const state = window[KEY] = {
    installed:true, ready:false, active:false, activeDistrict:null,
    loadedDistricts:[], builtTiles:0, visibleTiles:0, sourceBuildingCount:0,
    evidence:"SOURCE_CONFIRMED_FOOTPRINTS", heightEvidence:"MIXED_SOURCE_ESTIMATED_AND_RUNTIME_VISUAL_ESTIMATE",
    error:null,
  };

  function loadScript(src, marker) {
    return new Promise((resolve,reject)=>{
      const existing=document.querySelector(`script[data-${marker}]`);
      if(existing){
        if(existing.dataset.loaded==="1") return resolve();
        existing.addEventListener("load",resolve,{once:true});
        existing.addEventListener("error",()=>reject(new Error(`failed ${src}`)),{once:true});
        return;
      }
      const s=document.createElement("script");s.src=src;s.async=true;s.dataset[marker]="1";
      s.onload=()=>{s.dataset.loaded="1";resolve()};s.onerror=()=>reject(new Error(`failed ${src}`));document.head.appendChild(s);
    });
  }

  function roadContract() {
    const data=window.JC_VEGAS_OSM||window.VEGAS_ROADS||{roads:[]};
    let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity,count=0;
    for(const road of data.roads||[])for(const p of road.p||[]){const x=Number(p[0]),z=Number(p[1]);if(!Number.isFinite(x)||!Number.isFinite(z))continue;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);count++}
    if(!count||!Number.isFinite(minX)||maxX<=minX||maxZ<=minZ)return null;
    const scale=(WORLD*.91)/Math.max(maxX-minX,maxZ-minZ);
    return {minX,minZ,maxX,maxZ,scale,cx:(minX+maxX)/2,cz:(minZ+maxZ)/2,projected:minX>100000&&maxX<1000000&&minZ>1000000&&maxZ<5000000};
  }

  function transformer(c) {
    const w=CANONICAL.maxE-CANONICAL.minE,h=CANONICAL.maxN-CANONICAL.minN;
    state.transformMode=c.projected?"direct-utm":"canonical-normalized";
    return (e,n)=>{
      const sx=c.projected?e:c.minX+((e-CANONICAL.minE)/w)*(c.maxX-c.minX);
      const sz=c.projected?n:c.minZ+((n-CANONICAL.minN)/h)*(c.maxZ-c.minZ);
      return {x:(sx-c.cx)*c.scale,z:(sz-c.cz)*c.scale};
    };
  }

  const mats=[];
  function materials() {
    if(mats.length)return mats;
    const defs=[
      {color:0x8d969b,roughness:.5,metalness:.18},
      {color:0xb0a68f,roughness:.78,metalness:.04},
      {color:0x4d5960,roughness:.38,metalness:.28},
    ];
    const loader=new THREE.TextureLoader();
    defs.forEach((d,i)=>{
      const m=new THREE.MeshStandardMaterial(d);mats.push(m);
      loader.load(`./jc-the-holy-og-assets/swarm/buildings/facade-atlas-0${i+1}.jpg`,t=>{t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(.5,.5);t.anisotropy=mobile?1:2;m.map=t;m.needsUpdate=true},undefined,()=>{});
    });
    return mats;
  }

  function tileCenter(tileId,toGame){
    const m=/Tile_LV_X(\d+)_Y(\d+)/.exec(tileId||"");if(!m)return null;
    const x=Number(m[1]),y=Number(m[2]);return toGame(CANONICAL.minE+(x+.5)*1000,CANONICAL.minN+(y+.5)*1000);
  }

  function prepareDistrict(meta,pack,toGame,c) {
    const tiles=new Map();
    for(const b of pack.buildings||[]){const id=b.t||"UNKNOWN";if(!tiles.has(id))tiles.set(id,{id,rows:[],group:null,built:false,center:tileCenter(id,toGame)});tiles.get(id).rows.push(b)}
    const b=meta.bbox_utm;const center=toGame((b[0]+b[2])/2,(b[1]+b[3])/2);
    const d={meta,pack,tiles,center,root:new THREE.Group(),loaded:true};
    d.root.name=`REAL VEGAS DISTRICT ${meta.id}`;d.root.visible=false;d.root.userData={sourceGrounded:true,district:meta.id,buildingCount:pack.buildings?.length||0};
    state.scene.add(d.root);state.districts.set(meta.id,d);state.loadedDistricts=[...state.districts.keys()];state.sourceBuildingCount=[...state.districts.values()].reduce((s,x)=>s+(x.pack.buildings?.length||0),0);
    return d;
  }

  function loadDistrict(meta) {
    if(state.districts.has(meta.id)||state.loading.has(meta.id))return;
    state.loading.add(meta.id);
    loadScript(meta.file,`jcDistrict${meta.id.replace(/[^a-z0-9]/gi,"")}`).then(()=>{
      const pack=window.JC_REAL_DISTRICT_PACKS?.[meta.id];if(!pack)throw new Error(`district ${meta.id} loaded without pack`);
      prepareDistrict(meta,pack,state.toGame,state.contract);
    }).catch(e=>{state.errors[meta.id]=String(e.message||e)}).finally(()=>state.loading.delete(meta.id));
  }

  function ringGeometry(ring,pack,toGame,heightM) {
    if(!Array.isArray(ring)||ring.length<3)return null;
    const origin=pack.origin_utm,unit=Number(pack.unit_m||.1),points=[];
    for(const q of ring){const p=toGame(origin[0]+q[0]*unit,origin[1]+q[1]*unit);points.push(p)}
    const cx=points.reduce((s,p)=>s+p.x,0)/points.length,cz=points.reduce((s,p)=>s+p.z,0)/points.length;
    const shape=new THREE.Shape();points.forEach((p,i)=>{const x=p.x-cx,y=-(p.z-cz);i?shape.lineTo(x,y):shape.moveTo(x,y)});shape.closePath();
    try{const g=new THREE.ExtrudeGeometry(shape,{depth:heightM,bevelEnabled:false,steps:1,curveSegments:1});g.rotateX(-Math.PI/2);g.translate(cx,.02,cz);return g}catch{return null}
  }

  function buildTile(d,tile) {
    if(tile.built)return;tile.built=true;
    const yScale=Math.max(.24,Math.min(.42,state.contract.scale)),byMat=[[],[],[]];let count=0,sourceHeight=0,runtimeHeight=0;
    const rows=tile.rows;
    for(const b of rows){
      const source=Number.isFinite(Number(b.h))&&Number(b.h)>0;let h=source?Number(b.h):Math.min(14,Math.max(5.5,5+Math.sqrt(Math.max(1,Number(b.a)||1))*.18));h*=yScale;
      const matIndex=source?0:(Number(b.a||0)>900?2:1);if(source)sourceHeight++;else runtimeHeight++;
      for(const ring of b.r||[]){const g=ringGeometry(ring,d.pack,state.toGame,h);if(g){byMat[matIndex].push(g);count++}}
    }
    const group=new THREE.Group();group.name=`REAL ${d.meta.id} ${tile.id}`;group.visible=false;group.userData={sourceGrounded:true,buildingRecords:rows.length,polygonParts:count,sourceHeight,runtimeVisualHeight:runtimeHeight};
    const materialSet=materials();
    for(let i=0;i<byMat.length;i++)if(byMat[i].length){let merged=null;try{merged=mergeGeometries(byMat[i],false)}catch{}if(merged){const mesh=new THREE.Mesh(merged,materialSet[i]);mesh.castShadow=false;mesh.receiveShadow=true;mesh.userData={realBuildingFootprints:true,heightClass:i===0?"SOURCE_ESTIMATED":"RUNTIME_VISUAL_ESTIMATE"};group.add(mesh);for(const g of byMat[i])g.dispose()}else{for(const g of byMat[i]){const mesh=new THREE.Mesh(g,materialSet[i]);mesh.receiveShadow=true;group.add(mesh)}}}
    d.root.add(group);tile.group=group;state.builtTiles++;
  }

  function setProceduralSuppressed(on) {
    const fallback=state.scene?.getObjectByName("Generated city fallback");if(fallback)fallback.visible=!on;
    const renamed=state.scene?.getObjectByName("Renamed Strip Landmark Districts");if(renamed)renamed.visible=!(on&&state.activeDistrict==="strip");
  }

  let tick=0;
  function update(camera) {
    if(!state.ready||!camera)return;tick++;if(tick%(mobile?10:6)!==0)return;
    const metas=state.index.districts.map(m=>{const b=m.bbox_utm,c=state.toGame((b[0]+b[2])/2,(b[1]+b[3])/2),d2=(camera.position.x-c.x)**2+(camera.position.z-c.z)**2;return{m,c,d2}}).sort((a,b)=>a.d2-b.d2);
    const nearest=metas[0];const loadRadius=mobile?1900:2600;if(nearest&&nearest.d2<loadRadius*loadRadius)loadDistrict(nearest.m);
    const activeRadius=mobile?1300:1800;const d=nearest&&nearest.d2<activeRadius*activeRadius?state.districts.get(nearest.m.id):null;
    for(const x of state.districts.values())x.root.visible=x===d;
    state.active=!!d;state.activeDistrict=d?.meta.id||null;state.visibleTiles=0;
    if(!d){setProceduralSuppressed(false);return}
    const ranked=[];for(const tile of d.tiles.values()){const c=tile.center||d.center;ranked.push({tile,d2:(camera.position.x-c.x)**2+(camera.position.z-c.z)**2})}ranked.sort((a,b)=>a.d2-b.d2);
    const maxTiles=mobile?4:10;const tileRadius=mobile?720:1150;let builds=0;
    for(let i=0;i<ranked.length;i++){
      const on=i<maxTiles&&ranked[i].d2<tileRadius*tileRadius;const tile=ranked[i].tile;
      if(on&&!tile.built&&builds<(mobile?1:2)){buildTile(d,tile);builds++}
      if(tile.group)tile.group.visible=on;if(on&&tile.group)state.visibleTiles++;
    }
    setProceduralSuppressed(true);
    const stream=document.getElementById("streamStatus");if(stream)stream.innerHTML=`REAL ${d.meta.label.toUpperCase()}: ${state.visibleTiles} TILES<br>${d.meta.selected_buildings.toLocaleString()} VERIFIED FOOTPRINTS`;
    window.JC_REAL_VEGAS_DISTRICT_STATUS={active:true,district:d.meta.id,visibleTiles:state.visibleTiles,builtTiles:state.builtTiles,loadedDistricts:state.loadedDistricts};
  }

  loadScript(INDEX_URL,"jcRealDistrictIndex").then(()=>{
    const index=window.JC_REAL_DISTRICT_INDEX;if(!index?.districts?.length)throw new Error("district index missing or empty");
    const c=roadContract();if(!c)throw new Error("main Vegas road coordinate contract unavailable");
    state.contract=c;state.toGame=transformer(c);state.index=index;state.districts=new Map();state.loading=new Set();state.errors={};state.ready=true;
    const previous=THREE.WebGLRenderer.prototype.render;
    if(!THREE.WebGLRenderer.prototype.__jcRealVegasDistrictsV1){Object.defineProperty(THREE.WebGLRenderer.prototype,"__jcRealVegasDistrictsV1",{value:true});THREE.WebGLRenderer.prototype.render=function(scene,camera){if(!state.scene)state.scene=scene;update(camera);return previous.call(this,scene,camera)}}
  }).catch(e=>{state.error=String(e.message||e);window.JC_REAL_VEGAS_DISTRICT_STATUS={active:false,error:state.error}});
}
