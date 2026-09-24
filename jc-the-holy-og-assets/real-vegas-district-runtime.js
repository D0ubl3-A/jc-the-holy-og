import * as THREE from "three";
import { mergeGeometries } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/utils/BufferGeometryUtils.js";

const KEY = "__JC_REAL_VEGAS_DISTRICTS_V1__";
const INDEX_URL = "./jc-the-holy-og-assets/generated/districts/index.js";
const WORLD = 3500;
const CANONICAL = { minE:648949.782, minN:3983561.814, maxE:683949.782, maxN:4018561.814 };
const TILE_SOURCE_SIZE=1000;
const TILE_SCALE=0.1;
const ORIGIN_COL=8;
const ORIGIN_ROW=8;

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
    // Exact shared C##_R## contract used by the GLB streamer.
    return {
      minX:CANONICAL.minE,
      minZ:CANONICAL.minN,
      maxX:CANONICAL.maxE,
      maxZ:CANONICAL.maxN,
      scale:TILE_SCALE,
      projected:true
    };
  }

  function transformer(c) {
    state.transformMode="canonical-glb-grid";
    const originE=CANONICAL.minE+ORIGIN_COL*TILE_SOURCE_SIZE;
    const originN=CANONICAL.minN+ORIGIN_ROW*TILE_SOURCE_SIZE;
    return (e,n)=>({
      x:(e-originE)*TILE_SCALE,
      z:-(n-originN)*TILE_SCALE
    });
  }

  const mats=[];
  function materials() {
    if(mats.length)return mats;
    const defs=[
      {name:"residential",color:0xbca68e,roughness:.82,metalness:.02,url:"./jc-the-holy-og-assets/textures/residential-wallpaper-atlas.jpg"},
      {name:"commercial",color:0x929aa0,roughness:.56,metalness:.12,url:"./jc-the-holy-og-assets/swarm/buildings/facade-atlas-02.jpg"},
      {name:"industrial",color:0x667077,roughness:.66,metalness:.22,url:"./jc-the-holy-og-assets/swarm/buildings/facade-atlas-03.jpg"},
      {name:"casino",color:0x3b1617,roughness:.40,metalness:.18,url:"./jc-the-holy-og-assets/textures/strip-wallpaper-atlas.jpg",emissive:0x5a120d}
    ];
    const loader=new THREE.TextureLoader();
    defs.forEach((d)=>{
      const m=new THREE.MeshStandardMaterial({
        color:d.color,roughness:d.roughness,metalness:d.metalness,
        emissive:d.emissive||0x000000,emissiveIntensity:d.emissive?0.55:0
      });
      m.userData={jcLandUse:d.name};
      mats.push(m);
      loader.load(d.url,t=>{
        t.colorSpace=THREE.SRGBColorSpace;
        t.wrapS=t.wrapT=THREE.RepeatWrapping;
        t.repeat.set(.5,.5);
        t.anisotropy=mobile?1:2;
        m.map=t;m.needsUpdate=true;
      },undefined,()=>{});
    });
    return mats;
  }

  function materialClassForBuilding(d,b,heightM){
    const area=Math.max(1,Number(b.a)||1);
    // Large/tall Strip footprints are the only procedural buildings eligible
    // for the full casino treatment.
    if(d.meta.id==="strip"&&(heightM>=18||area>=1100))return 3;
    // Typical low-rise small footprints are homes: stucco/stone/tile family.
    if(heightM<=12&&area<=750)return 0;
    // Broad low footprints read as warehouses/service/industrial.
    if(heightM<=16&&area>=2200)return 2;
    return 1;
  }

  function tileCenter(tileId,toGame){
    const m=/Tile_LV_X(\d+)_Y(\d+)/.exec(tileId||"");if(!m)return null;
    const x=Number(m[1]),y=Number(m[2]);return toGame(CANONICAL.minE+(x+.5)*1000,CANONICAL.minN+(y+.5)*1000);
  }

  function glbKeyForDistrictTile(tileId){
    const m=/Tile_LV_X(\d+)_Y(\d+)/.exec(tileId||"");
    if(!m)return null;
    return "C"+String(Number(m[1])).padStart(2,"0")+"_R"+String(Number(m[2])).padStart(2,"0");
  }
  function hasAuthoritativeGlb(tileId){
    const key=glbKeyForDistrictTile(tileId);
    const loaded=window.JC_GLB_MAP?.loadedTiles;
    return !!(key&&loaded&&typeof loaded.has==="function"&&loaded.has(key));
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
    const yScale=1.0,byMat=[[],[],[],[]];let count=0,sourceHeight=0,runtimeHeight=0;
    const rows=tile.rows;
    for(const b of rows){
      const source=Number.isFinite(Number(b.h))&&Number(b.h)>0;
      const sourceH=source?Number(b.h):Math.min(14,Math.max(5.5,5+Math.sqrt(Math.max(1,Number(b.a)||1))*.18));
      const h=sourceH*yScale;
      const matIndex=materialClassForBuilding(d,b,sourceH);
      if(source)sourceHeight++;else runtimeHeight++;
      for(const ring of b.r||[]){const g=ringGeometry(ring,d.pack,state.toGame,h);if(g){byMat[matIndex].push(g);count++}}
    }
    const group=new THREE.Group();group.name=`REAL ${d.meta.id} ${tile.id}`;group.visible=false;group.userData={sourceGrounded:true,buildingRecords:rows.length,polygonParts:count,sourceHeight,runtimeVisualHeight:runtimeHeight};
    const materialSet=materials();
    for(let i=0;i<byMat.length;i++)if(byMat[i].length){let merged=null;try{merged=mergeGeometries(byMat[i],false)}catch{}if(merged){const mesh=new THREE.Mesh(merged,materialSet[i]);mesh.castShadow=false;mesh.receiveShadow=true;mesh.userData={realBuildingFootprints:true,landUse:["residential","commercial","industrial","casino"][i]||"commercial"};group.add(mesh);for(const g of byMat[i])g.dispose()}else{for(const g of byMat[i]){const mesh=new THREE.Mesh(g,materialSet[i]);mesh.receiveShadow=true;group.add(mesh)}}}
    d.root.add(group);tile.group=group;state.builtTiles++;
  }

  function setProceduralSuppressed(on) {
    const fallback=state.scene?.getObjectByName("Generated city fallback"),realCity=state.scene?.getObjectByName("Las Vegas city LOD");if(fallback)fallback.visible=on?false:!realCity;
    const renamed=state.scene?.getObjectByName("Renamed Strip Landmark Districts");if(renamed)renamed.visible=!(on&&state.activeDistrict==="strip");
  }

  const buildQueue=[];
  const queuedBuilds=new Set();
  let buildPumpActive=false;
  let updateQueued=false;
  let nextUpdateAt=0;

  function enqueueTileBuild(district,tile) {
    if(!district||!tile||tile.built)return;
    const key=district.meta.id+":"+tile.id;
    if(queuedBuilds.has(key))return;
    queuedBuilds.add(key);
    buildQueue.push({district,tile,key});
    pumpBuildQueue();
  }

  function pumpBuildQueue() {
    if(buildPumpActive||!buildQueue.length)return;
    buildPumpActive=true;
    const run=()=>{
      const job=buildQueue.shift();
      try{
        if(job&&!job.tile.built&&job.district.root.visible)buildTile(job.district,job.tile);
      }catch(e){
        state.errors=state.errors||{};
        if(job)state.errors[job.key]=String(e?.message||e);
      }finally{
        if(job)queuedBuilds.delete(job.key);
        buildPumpActive=false;
        if(buildQueue.length)pumpBuildQueue();
      }
    };
    if("requestIdleCallback" in window)requestIdleCallback(run,{timeout:120});
    else setTimeout(run,16);
  }

  function update(camera) {
    if(!state.ready||!camera)return;

    let nearest=null;
    for(const m of state.index.districts){
      const b=m.bbox_utm;
      const c=state.toGame((b[0]+b[2])/2,(b[1]+b[3])/2);
      const d2=(camera.position.x-c.x)**2+(camera.position.z-c.z)**2;
      if(!nearest||d2<nearest.d2)nearest={m,c,d2};
    }

    const loadRadius=mobile?1700:2400;
    if(nearest&&nearest.d2<loadRadius*loadRadius)loadDistrict(nearest.m);

    const activeRadius=mobile?1150:1650;
    const active=nearest&&nearest.d2<activeRadius*activeRadius?state.districts.get(nearest.m.id):null;
    for(const x of state.districts.values())x.root.visible=x===active;
    state.active=!!active;
    state.activeDistrict=active?.meta.id||null;
    state.visibleTiles=0;

    if(!active){
      setProceduralSuppressed(false);
      window.JC_REAL_VEGAS_DISTRICT_STATUS={active:false,district:null,visibleTiles:0,builtTiles:state.builtTiles,loadedDistricts:state.loadedDistricts};
      return;
    }

    const tileRadius=mobile?560:900;
    const tileRadius2=tileRadius*tileRadius;
    const ranked=[];
    for(const tile of active.tiles.values()){
      const c=tile.center||active.center;
      const d2=(camera.position.x-c.x)**2+(camera.position.z-c.z)**2;
      if(d2<tileRadius2)ranked.push({tile,d2});
      else if(tile.group)tile.group.visible=false;
    }
    ranked.sort((a,b)=>a.d2-b.d2);

    const maxTiles=mobile?3:6;
    for(let i=0;i<ranked.length;i++){
      const tile=ranked[i].tile;
      const on=i<maxTiles&&!hasAuthoritativeGlb(tile.id);
      if(on&&!tile.built)enqueueTileBuild(active,tile);
      if(tile.group)tile.group.visible=on;
      if(on&&tile.group)state.visibleTiles++;
    }

    setProceduralSuppressed(true);
    const stream=document.getElementById("streamStatus");
    if(stream)stream.innerHTML=`REAL ${active.meta.label.toUpperCase()}: ${state.visibleTiles} TILES<br>${active.meta.selected_buildings.toLocaleString()} VERIFIED FOOTPRINTS`;
    window.JC_REAL_VEGAS_DISTRICT_STATUS={active:true,district:active.meta.id,visibleTiles:state.visibleTiles,builtTiles:state.builtTiles,loadedDistricts:state.loadedDistricts};
  }

  function scheduleUpdate(camera){
    const now=performance.now();
    if(updateQueued||now<nextUpdateAt)return;
    nextUpdateAt=now+(mobile?320:220);
    updateQueued=true;
    const run=()=>{
      updateQueued=false;
      update(camera);
    };
    if("requestIdleCallback" in window)requestIdleCallback(run,{timeout:80});
    else setTimeout(run,0);
  }

  loadScript(INDEX_URL,"jcRealDistrictIndex").then(()=>{
    const index=window.JC_REAL_DISTRICT_INDEX;if(!index?.districts?.length)throw new Error("district index missing or empty");
    const c=roadContract();
    state.contract=c;state.toGame=transformer(c);state.index=index;state.districts=new Map();state.loading=new Set();state.errors={};state.ready=true;
    const previous=THREE.WebGLRenderer.prototype.render;
    if(!THREE.WebGLRenderer.prototype.__jcRealVegasDistrictsV1){Object.defineProperty(THREE.WebGLRenderer.prototype,"__jcRealVegasDistrictsV1",{value:true});THREE.WebGLRenderer.prototype.render=function(scene,camera){if(!state.scene)state.scene=scene;scheduleUpdate(camera);return previous.call(this,scene,camera)}}
  }).catch(e=>{state.error=String(e.message||e);window.JC_REAL_VEGAS_DISTRICT_STATUS={active:false,error:state.error}});
}
