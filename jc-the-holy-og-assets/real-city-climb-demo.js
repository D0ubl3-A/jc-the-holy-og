import * as THREE from "three";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js";

const mount=document.getElementById("game");
const statusEl=document.getElementById("status");
const progressEl=document.getElementById("progress");
const locationEl=document.getElementById("location");
const flightStateEl=document.getElementById("flightState");
const solarFillEl=document.getElementById("solarFill");
const solarTextEl=document.getElementById("solarText");
const destinationEl=document.getElementById("destination");
const hyperFxEl=document.getElementById("hyperFx");
const missionEl=document.getElementById("mission");
const creditEl=document.getElementById("credit");

const lowSpec=matchMedia("(pointer:coarse)").matches||(navigator.hardwareConcurrency||4)<=4||("deviceMemory" in navigator&&(navigator.deviceMemory||4)<=4);
const scene=new THREE.Scene();
const SKY_GROUND=new THREE.Color(0x101722),SKY_SPACE=new THREE.Color(0x000003);
scene.background=SKY_GROUND.clone();
scene.fog=new THREE.FogExp2(0x17202b,0.00055);
const MAX_ALTITUDE=120000;
const SPACE_ALTITUDE=100000;
const ATMOSPHERE_FADE_START=2500;
const MACH_1=343;
const FLIGHT_SPEEDS={
  street:95,
  city:170,
  regional:320,
  supersonic:700,
  hypersonic:2200,
  upperAtmosphere:6000,
  space:12000
};
const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,0.1,300000);
const renderer=new THREE.WebGLRenderer({antialias:!lowSpec,powerPreference:lowSpec?"low-power":"high-performance"});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio,lowSpec?1:1.4));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.08;
mount.appendChild(renderer.domElement);

const hemi=new THREE.HemisphereLight(0xb9d7ff,0x2e241d,2.4);
scene.add(hemi);
const moon=new THREE.DirectionalLight(0xffe9c5,3.2);
moon.position.set(-500,900,350);
scene.add(moon);
const fill=new THREE.DirectionalLight(0x738dff,1.35);
fill.position.set(600,300,-500);
scene.add(fill);

const starGeo=new THREE.BufferGeometry();
const starCount=lowSpec?700:1800;
const starPositions=new Float32Array(starCount*3);
for(let i=0;i<starCount;i++){
  const r=140000+Math.random()*90000;
  const theta=Math.random()*Math.PI*2;
  const phi=Math.acos(THREE.MathUtils.randFloatSpread(2));
  starPositions[i*3]=Math.sin(phi)*Math.cos(theta)*r;
  starPositions[i*3+1]=Math.abs(Math.cos(phi))*r+20000;
  starPositions[i*3+2]=Math.sin(phi)*Math.sin(theta)*r;
}
starGeo.setAttribute("position",new THREE.BufferAttribute(starPositions,3));
const starMat=new THREE.PointsMaterial({color:0xffffff,size:lowSpec?180:110,sizeAttenuation:true,transparent:true,opacity:0,depthWrite:false});
const stars=new THREE.Points(starGeo,starMat);
scene.add(stars);

const spaceSun=new THREE.Mesh(
  new THREE.SphereGeometry(2600,24,16),
  new THREE.MeshBasicMaterial({color:0xfff1bd})
);
spaceSun.position.set(-90000,70000,-120000);
spaceSun.visible=false;
scene.add(spaceSun);

const holeGround=new THREE.Mesh(
  new THREE.PlaneGeometry(20000,20000),
  new THREE.MeshStandardMaterial({color:0x17191d,roughness:1,metalness:0})
);
holeGround.rotation.x=-Math.PI/2;
holeGround.position.y=-1.5;
scene.add(holeGround);

const TILE_SOURCE_SIZE=1000;
const TILE_SCALE=0.1;
const TILE_WORLD_SIZE=TILE_SOURCE_SIZE*TILE_SCALE;
const ORIGIN_COL=8;
const ORIGIN_ROW=8;
const MAP_Y_OFFSET=-20.5;
const LOAD_RADIUS=lowSpec?1:2;
const KEEP_RADIUS=lowSpec?2:4;
const MAX_CONCURRENT=lowSpec?2:4;

const gltfLoader=new GLTFLoader();
const mapGroup=new THREE.Group();
mapGroup.name="JC_GLB_TILE_MAP";
scene.add(mapGroup);

const worldLodGroup=new THREE.Group();
worldLodGroup.name="JC_WORLD_LOW_DETAIL";
scene.add(worldLodGroup);
let worldLodRoot=null;
let worldLodReady=false;
let worldLodBounds=null;
const FULL_DETAIL_ALTITUDE=900;
const MIXED_DETAIL_ALTITUDE=6000;
const LOW_DETAIL_ONLY_ALTITUDE=14000;

const roadTileGroup=new THREE.Group();
roadTileGroup.name="JC_ROAD_TILE_LAYER";
scene.add(roadTileGroup);
const majorRoadGroup=new THREE.Group();
majorRoadGroup.name="JC_MAJOR_ROAD_OVERVIEW";
scene.add(majorRoadGroup);

let roadManifest=[];
let roadManifestByKey=new Map();
const loadedRoadTiles=new Map();
const loadingRoadTiles=new Set();
let roadRuntimeReady=false;
let majorRoadReady=false;

const roadMats={
  highway:new THREE.MeshBasicMaterial({color:0x2f3438,side:THREE.DoubleSide}),
  arterial:new THREE.MeshBasicMaterial({color:0x303438,side:THREE.DoubleSide}),
  local:new THREE.MeshBasicMaterial({color:0x25282b,side:THREE.DoubleSide}),
  majorOverview:new THREE.MeshBasicMaterial({color:0x59616a,transparent:true,opacity:0.78,side:THREE.DoubleSide,depthWrite:false})
};
function roadMaterialFor(highway){
  if(/motorway|trunk/.test(highway||""))return roadMats.highway;
  if(/primary|secondary|tertiary/.test(highway||""))return roadMats.arterial;
  return roadMats.local;
}
function roadQuadGeometry(roads,worldSpace){
  const byType={highway:[],arterial:[],local:[]};
  for(const road of roads||[]){
    const pts=road.p||[];
    const h=road.h||"";
    const bucket=/motorway|trunk/.test(h)?"highway":/primary|secondary|tertiary/.test(h)?"arterial":"local";
    const width=Math.max(0.28,Number(road.w)||0.55);
    for(let i=0;i<pts.length-1;i++){
      const a=pts[i],b=pts[i+1];
      const ax=Number(a[0]),az=Number(a[1]),bx=Number(b[0]),bz=Number(b[1]);
      const dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);
      if(!Number.isFinite(len)||len<0.01)continue;
      const nx=-dz/len*width*0.5,nz=dx/len*width*0.5;
      const y=MAP_Y_OFFSET+0.18;
      byType[bucket].push(
        ax+nx,y,az+nz, ax-nx,y,az-nz, bx-nx,y,bz-nz,
        ax+nx,y,az+nz, bx-nx,y,bz-nz, bx+nx,y,bz+nz
      );
    }
  }
  return byType;
}
function makeRoadMeshes(roads,materials,worldSpace){
  const buckets=roadQuadGeometry(roads,worldSpace);
  const group=new THREE.Group();
  for(const [type,verts] of Object.entries(buckets)){
    if(!verts.length)continue;
    const g=new THREE.BufferGeometry();
    g.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
    g.computeBoundingSphere();
    const m=new THREE.Mesh(g,materials[type]||roadMats.local);
    m.frustumCulled=true;
    m.renderOrder=2;
    group.add(m);
  }
  return group;
}
async function loadRoadRuntime(){
  try{
    const res=await fetch("./jc-map/roads/manifest.json?ts="+Date.now(),{cache:"no-store"});
    if(!res.ok)throw new Error("road manifest HTTP "+res.status);
    const data=await res.json();
    roadManifest=data.tiles||[];
    roadManifestByKey=new Map(roadManifest.map(function(t){return [tileKey(t.col,t.row),t]}));
    roadRuntimeReady=roadManifest.length>0;
  }catch(err){
    console.warn("Road tile manifest unavailable",err);
    roadRuntimeReady=false;
  }

  try{
    const res=await fetch("./jc-map/roads/major-roads.json?ts="+Date.now(),{cache:"no-store"});
    if(!res.ok)throw new Error("major roads HTTP "+res.status);
    const data=await res.json();
    const roads=(data.roads||[]).map(function(r){
      return {...r,w:Math.max(0.18,(Number(r.w)||0.6)*0.55)};
    });
    const mats={highway:roadMats.majorOverview,arterial:roadMats.majorOverview,local:roadMats.majorOverview};
    const mesh=makeRoadMeshes(roads,mats,true);
    mesh.name="CITYWIDE_MAJOR_ROADS";
    majorRoadGroup.add(mesh);
    majorRoadReady=true;
  }catch(err){
    console.warn("Major road overview unavailable",err);
    majorRoadReady=false;
  }
}
async function loadRoadTile(rec){
  const key=tileKey(rec.col,rec.row);
  if(loadedRoadTiles.has(key)||loadingRoadTiles.has(key))return;
  loadingRoadTiles.add(key);
  try{
    const res=await fetch("./jc-map/roads/"+rec.file.replace(/^\.\//,""),{cache:"force-cache"});
    if(!res.ok)throw new Error(key+" road HTTP "+res.status);
    const data=await res.json();
    const root=makeRoadMeshes(data.roads||[],roadMats,false);
    root.name="ROADS_"+key;
    root.position.copy(tileWorldPosition(rec.col,rec.row));
    roadTileGroup.add(root);
    loadedRoadTiles.set(key,{root:root,rec:rec,count:(data.roads||[]).length});
  }catch(err){
    console.warn("Road tile failed",key,err);
  }finally{
    loadingRoadTiles.delete(key);
  }
}
function unloadRoadTile(key,item){
  roadTileGroup.remove(item.root);
  item.root.traverse(function(o){
    if(o.geometry&&o.geometry.dispose)o.geometry.dispose();
  });
  loadedRoadTiles.delete(key);
}
async function streamRoadTiles(force){
  if(!roadRuntimeReady||player.pos.y>=LOW_DETAIL_ONLY_ALTITUDE)return;
  const cell=worldCell(player.pos.x,player.pos.z);
  const radius=player.pos.y<MIXED_DETAIL_ALTITUDE?LOAD_RADIUS+1:LOAD_RADIUS;
  const wanted=roadManifest
    .filter(function(t){return Math.abs(t.col-cell.col)<=radius&&Math.abs(t.row-cell.row)<=radius;})
    .sort(function(a,b){
      return (Math.abs(a.col-cell.col)+Math.abs(a.row-cell.row))-(Math.abs(b.col-cell.col)+Math.abs(b.row-cell.row));
    });
  for(let i=0;i<wanted.length;i+=MAX_CONCURRENT){
    await Promise.all(wanted.slice(i,i+MAX_CONCURRENT).map(loadRoadTile));
  }
  const keep=radius+2;
  for(const [key,item] of Array.from(loadedRoadTiles.entries())){
    if(Math.abs(item.rec.col-cell.col)>keep||Math.abs(item.rec.row-cell.row)>keep)unloadRoadTile(key,item);
  }
}
function updateRoadLod(){
  const y=player.pos.y;
  roadTileGroup.visible=y<LOW_DETAIL_ONLY_ALTITUDE;
  majorRoadGroup.visible=majorRoadReady&&y>=FULL_DETAIL_ALTITUDE;
  const overviewOpacity=y>=LOW_DETAIL_ONLY_ALTITUDE?0.95:
    THREE.MathUtils.lerp(0.2,0.82,THREE.MathUtils.smoothstep(y,FULL_DETAIL_ALTITUDE,LOW_DETAIL_ONLY_ALTITUDE));
  roadMats.majorOverview.opacity=overviewOpacity;
}


let manifest=[];
let manifestByKey=new Map();
const loadedTiles=new Map();
const loadingTiles=new Set();
const failedTiles=new Set();
let streamBusy=false;
let lastStreamCell="";
let manifestVersion="";

function tileKey(col,row){
  return "C"+String(col).padStart(2,"0")+"_R"+String(row).padStart(2,"0");
}
function tileWorldPosition(col,row){
  return new THREE.Vector3((col-ORIGIN_COL)*TILE_WORLD_SIZE,MAP_Y_OFFSET,-(row-ORIGIN_ROW)*TILE_WORLD_SIZE);
}
function worldCell(x,z){
  return {
    col:ORIGIN_COL+Math.floor(x/TILE_WORLD_SIZE),
    row:ORIGIN_ROW+Math.floor(-z/TILE_WORLD_SIZE)
  };
}
function disposeTile(root){
  root.traverse(function(o){
    if(!o.isMesh)return;
    if(o.geometry)o.geometry.dispose();
    const mats=Array.isArray(o.material)?o.material:[o.material];
    mats.forEach(function(m){
      if(!m)return;
      ["map","normalMap","roughnessMap","metalnessMap","emissiveMap","aoMap","alphaMap"].forEach(function(k){
        if(m[k]&&m[k].dispose)m[k].dispose();
      });
      if(m.dispose)m.dispose();
    });
  });
}
async function loadManifest(){
  const res=await fetch("./jc-map/tile-manifest.json?ts="+Date.now(),{cache:"no-store"});
  if(!res.ok)throw new Error("tile-manifest.json HTTP "+res.status);
  const data=await res.json();
  manifest=(data.tiles||[]).filter(function(t){return Number.isFinite(t.col)&&Number.isFinite(t.row)&&t.url});
  manifestByKey=new Map(manifest.map(function(t){return [tileKey(t.col,t.row),t]}));
  manifestVersion=data.generatedAt||String(manifest.length);
  if(!manifest.length)throw new Error("No C##_R## GLB tiles found in manifest");
  return data;
}
async function loadWorldLod(){
  try{
    const gltf=await gltfLoader.loadAsync("./jc-the-holy-og-assets/models/vegas-city-lod.glb");
    const root=gltf.scene;
    root.name="VEGAS_CITY_GLOBAL_LOD";

    root.traverse(function(o){
      if(!o.isMesh)return;
      o.castShadow=false;
      o.receiveShadow=false;
      o.frustumCulled=true;

      const source=Array.isArray(o.material)?o.material:[o.material];
      const simple=source.map(function(m){
        return new THREE.MeshBasicMaterial({
          map:m&&m.map?m.map:null,
          color:m&&m.color?m.color.clone():new THREE.Color(0x777777),
          transparent:true,
          opacity:0.9,
          depthWrite:true
        });
      });
      o.material=Array.isArray(o.material)?simple:simple[0];
    });

    const box=new THREE.Box3().setFromObject(root);
    const size=new THREE.Vector3(),center=new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    let minCol=Infinity,maxCol=-Infinity,minRow=Infinity,maxRow=-Infinity;
    for(const t of manifest){
      minCol=Math.min(minCol,t.col); maxCol=Math.max(maxCol,t.col);
      minRow=Math.min(minRow,t.row); maxRow=Math.max(maxRow,t.row);
    }

    const targetW=(maxCol-minCol+1)*TILE_WORLD_SIZE;
    const targetD=(maxRow-minRow+1)*TILE_WORLD_SIZE;
    const sx=targetW/Math.max(1,size.x);
    const sz=targetD/Math.max(1,size.z);
    const scale=Math.min(sx,sz);

    root.scale.setScalar(scale);
    root.updateMatrixWorld(true);

    const scaledBox=new THREE.Box3().setFromObject(root);
    const scaledCenter=new THREE.Vector3();
    scaledBox.getCenter(scaledCenter);

    const left=tileWorldPosition(minCol,minRow);
    const right=tileWorldPosition(maxCol,maxRow);
    const targetCenterX=(left.x+right.x+TILE_WORLD_SIZE)/2;
    const targetCenterZ=(left.z+right.z-TILE_WORLD_SIZE)/2;

    root.position.x+=targetCenterX-scaledCenter.x;
    root.position.z+=targetCenterZ-scaledCenter.z;
    root.position.y+=MAP_Y_OFFSET-scaledBox.min.y;

    worldLodGroup.add(root);
    worldLodRoot=root;
    worldLodBounds={minCol,maxCol,minRow,maxRow,targetW,targetD};
    worldLodReady=true;
    updateWorldLod();
  }catch(err){
    console.warn("Global city LOD unavailable",err);
  }
}
function setLodOpacity(value){
  if(!worldLodRoot)return;
  worldLodRoot.traverse(function(o){
    if(!o.isMesh)return;
    const mats=Array.isArray(o.material)?o.material:[o.material];
    mats.forEach(function(m){
      if(!m)return;
      m.transparent=value<1;
      m.opacity=value;
      m.depthWrite=value>0.55;
    });
  });
}
function updateWorldLod(){
  if(!worldLodReady)return;
  const y=player.pos.y;

  if(y<FULL_DETAIL_ALTITUDE){
    worldLodGroup.visible=false;
    mapGroup.visible=true;
    return;
  }

  worldLodGroup.visible=true;

  if(y<MIXED_DETAIL_ALTITUDE){
    mapGroup.visible=true;
    const t=THREE.MathUtils.smoothstep(y,FULL_DETAIL_ALTITUDE,MIXED_DETAIL_ALTITUDE);
    setLodOpacity(0.35+0.65*t);
  }else if(y<LOW_DETAIL_ONLY_ALTITUDE){
    mapGroup.visible=true;
    setLodOpacity(1);
  }else{
    mapGroup.visible=false;
    setLodOpacity(1);
  }
}

async function loadOneTile(rec){
  const key=tileKey(rec.col,rec.row);
  if(loadedTiles.has(key)||loadingTiles.has(key)||failedTiles.has(key))return;
  loadingTiles.add(key);
  try{
    const version=rec.sha?("?v="+rec.sha.slice(0,10)):"";
    const gltf=await gltfLoader.loadAsync(rec.url+version);
    const root=gltf.scene;
    root.name=key;
    root.scale.setScalar(TILE_SCALE);
    root.position.copy(tileWorldPosition(rec.col,rec.row));
    root.traverse(function(o){
      if(!o.isMesh)return;
      o.castShadow=false;
      o.receiveShadow=true;
      o.frustumCulled=true;
      const mats=Array.isArray(o.material)?o.material:[o.material];
      mats.forEach(function(m){
        if(m&&m.map)m.map.colorSpace=THREE.SRGBColorSpace;
      });
    });
    mapGroup.add(root);
    loadedTiles.set(key,{root:root,rec:rec});
  }catch(err){
    console.error("GLB tile load failed",key,err);
    failedTiles.add(key);
  }finally{
    loadingTiles.delete(key);
  }
}
async function streamTiles(force){
  if(player.pos.y>=LOW_DETAIL_ONLY_ALTITUDE)return;
  if(streamBusy)return;
  const cell=worldCell(player.pos.x,player.pos.z);
  const cellKey=tileKey(cell.col,cell.row);
  if(!force&&cellKey===lastStreamCell)return;
  lastStreamCell=cellKey;
  streamBusy=true;
  try{
    const wanted=manifest
      .filter(function(t){return Math.abs(t.col-cell.col)<=LOAD_RADIUS&&Math.abs(t.row-cell.row)<=LOAD_RADIUS;})
      .sort(function(a,b){
        return (Math.abs(a.col-cell.col)+Math.abs(a.row-cell.row))-(Math.abs(b.col-cell.col)+Math.abs(b.row-cell.row));
      });
    for(let i=0;i<wanted.length;i+=MAX_CONCURRENT){
      await Promise.all(wanted.slice(i,i+MAX_CONCURRENT).map(loadOneTile));
    }
    for(const entry of Array.from(loadedTiles.entries())){
      const key=entry[0],item=entry[1];
      if(Math.abs(item.rec.col-cell.col)>KEEP_RADIUS||Math.abs(item.rec.row-cell.row)>KEEP_RADIUS){
        mapGroup.remove(item.root);
        disposeTile(item.root);
        loadedTiles.delete(key);
      }
    }
  }finally{
    streamBusy=false;
    updateHud();
  }
}

const player={
  root:new THREE.Group(),
  pos:new THREE.Vector3(50,4,-50),
  flying:true,
  yaw:Math.PI,
  velocity:new THREE.Vector3(),
  speed:0,
  mach:0,
  flightMode:"FLIGHT"
};
const jcAtlas=new THREE.TextureLoader().load("./jc-the-holy-og-assets/character-atlas.png");
jcAtlas.colorSpace=THREE.SRGBColorSpace;
jcAtlas.wrapS=jcAtlas.wrapT=THREE.RepeatWrapping;
jcAtlas.repeat.set(0.25,0.5);
jcAtlas.offset.set(0,0.5);
const jcMaterial=new THREE.SpriteMaterial({map:jcAtlas,transparent:true,depthWrite:false,alphaTest:0.08,toneMapped:false});
const jcSprite=new THREE.Sprite(jcMaterial);
jcSprite.center.set(0.5,0);
jcSprite.scale.set(4.2,4.2,1);
player.root.add(jcSprite);
const glow=new THREE.PointLight(0xffd45a,5,30,2);
glow.position.y=2.4;
player.root.add(glow);
const flightRing=new THREE.Mesh(
  new THREE.RingGeometry(1.0,1.35,32),
  new THREE.MeshBasicMaterial({color:0x7de6ff,transparent:true,opacity:0.72,side:THREE.DoubleSide,depthWrite:false})
);
flightRing.rotation.x=-Math.PI/2;
flightRing.position.y=0.12;
player.root.add(flightRing);
scene.add(player.root);

// --- JC vs Satan power runtime ------------------------------------------------
const satanRoot=new THREE.Group();
satanRoot.name="SATAN";
const satanTex=new THREE.TextureLoader().load("./jc-the-holy-og-assets/swarm/devil-material-atlas.png");
satanTex.colorSpace=THREE.SRGBColorSpace;
const satanMat=new THREE.SpriteMaterial({map:satanTex,transparent:true,depthWrite:false,toneMapped:false});
const satanSprite=new THREE.Sprite(satanMat);
satanSprite.center.set(0.5,0);
satanSprite.scale.set(6.2,6.2,1);
satanRoot.add(satanSprite);
const satanGlow=new THREE.PointLight(0xff2200,8,45,2);
satanGlow.position.y=2.6;
satanRoot.add(satanGlow);
satanRoot.position.copy(player.pos).add(new THREE.Vector3(14,0,10));
scene.add(satanRoot);

const powerState={
  controller:"JC",
  divine:100,
  infernal:100,
  divineShield:0,
  secondComing:0,
  hellOnEarth:0,
  cooldowns:{}
};
const powerFx=[];
const powerHud=document.createElement("div");
powerHud.id="powerHud";
powerHud.style.cssText="position:fixed;right:14px;top:14px;z-index:7;min-width:240px;padding:10px 12px;background:rgba(5,5,9,.82);border-right:3px solid #ffd45a;font:12px/1.45 Arial,sans-serif;color:white;pointer-events:none";
document.body.appendChild(powerHud);

function powerOrigin(){
  return player.pos.clone().add(new THREE.Vector3(0,2.2,0));
}
function addFx(obj,life,update){
  scene.add(obj);
  powerFx.push({obj:obj,life:life,maxLife:life,update:update});
  return obj;
}
function disposeFx(obj){
  scene.remove(obj);
  obj.traverse?.(function(o){
    if(o.geometry&&o.geometry.dispose)o.geometry.dispose();
    const mats=Array.isArray(o.material)?o.material:[o.material];
    mats.forEach(function(m){if(m&&m.dispose)m.dispose();});
  });
}
function radialRing(color,radius,life,y){
  const g=new THREE.RingGeometry(Math.max(0.5,radius*0.82),radius,72);
  const m=new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:0.95,side:THREE.DoubleSide,depthWrite:false});
  const ring=new THREE.Mesh(g,m);
  ring.rotation.x=-Math.PI/2;
  ring.position.copy(powerOrigin());
  ring.position.y=(y??player.pos.y)+0.4;
  ring.scale.setScalar(0.08);
  return addFx(ring,life,function(f,dt){
    const t=1-f.life/f.maxLife;
    f.obj.scale.setScalar(0.08+t*5.5);
    f.obj.material.opacity=(1-t)*0.9;
  });
}
function verticalBeam(color,height,life){
  const g=new THREE.CylinderGeometry(2.4,5.5,height,24,1,true);
  const m=new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:0.78,side:THREE.DoubleSide,depthWrite:false});
  const beam=new THREE.Mesh(g,m);
  beam.position.copy(powerOrigin());
  beam.position.y+=height/2-2;
  return addFx(beam,life,function(f){
    const t=1-f.life/f.maxLife;
    f.obj.material.opacity=(1-t)*0.78;
    f.obj.scale.x=f.obj.scale.z=1+t*1.8;
  });
}
function orbBurst(color,count,radius,life,center){
  const group=new THREE.Group();
  const geom=new THREE.SphereGeometry(0.45,8,6);
  const mat=new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:0.95});
  for(let i=0;i<count;i++){
    const m=new THREE.Mesh(geom,mat.clone());
    const a=Math.random()*Math.PI*2;
    const r=Math.random()*radius;
    m.position.set(Math.cos(a)*r,Math.random()*8,Math.sin(a)*r);
    m.userData.v=new THREE.Vector3((Math.random()-.5)*18,8+Math.random()*25,(Math.random()-.5)*18);
    group.add(m);
  }
  group.position.copy(center||powerOrigin());
  return addFx(group,life,function(f,dt){
    const t=1-f.life/f.maxLife;
    f.obj.children.forEach(function(m){
      m.position.addScaledVector(m.userData.v,dt);
      m.userData.v.y-=16*dt;
      m.material.opacity=1-t;
    });
  });
}
function canUse(key,cost,meter){
  if((powerState.cooldowns[key]||0)>0)return false;
  if(powerState[meter]<cost)return false;
  powerState[meter]-=cost;
  powerState.cooldowns[key]=0.8;
  return true;
}
function holyShockwave(){
  if(!canUse("jc1",18,"divine"))return;
  radialRing(0xffe783,7,0.9);
  orbBurst(0xfff3b0,18,4,0.8,powerOrigin());
  const delta=satanRoot.position.clone().sub(player.pos);
  if(delta.length()<80)satanRoot.position.add(delta.normalize().multiplyScalar(20));
}
function divineShield(){
  if(!canUse("jc2",25,"divine"))return;
  powerState.divineShield=7;
  const g=new THREE.SphereGeometry(5.2,24,18);
  const m=new THREE.MeshBasicMaterial({color:0xffe58a,transparent:true,opacity:0.24,wireframe:false,side:THREE.DoubleSide,depthWrite:false});
  const shield=new THREE.Mesh(g,m);
  shield.position.copy(powerOrigin());
  addFx(shield,7,function(f){
    f.obj.position.copy(powerOrigin());
    f.obj.material.opacity=0.16+Math.sin(performance.now()*0.01)*0.08;
  });
}
function judgmentBeam(){
  if(!canUse("jc3",32,"divine"))return;
  verticalBeam(0xfff0a8,220,1.5);
  radialRing(0xffffff,12,1.2);
}
function secondComing(){
  if(!canUse("jc4",100,"divine"))return;
  powerState.secondComing=12;
  radialRing(0xffe26f,24,2.2);
  verticalBeam(0xfff6c8,420,3);
  orbBurst(0xffffff,80,35,3,powerOrigin());
}
function hellfireStorm(){
  if(!canUse("sat1",18,"infernal"))return;
  radialRing(0xff3b12,9,1.1);
  orbBurst(0xff2b00,42,16,2.4,powerOrigin().add(new THREE.Vector3(0,16,0)));
}
function realityTear(){
  if(!canUse("sat2",28,"infernal"))return;
  const g=new THREE.TorusGeometry(6,1.25,18,56);
  const m=new THREE.MeshBasicMaterial({color:0x9c28ff,transparent:true,opacity:0.9,side:THREE.DoubleSide,depthWrite:false});
  const portal=new THREE.Mesh(g,m);
  portal.position.copy(powerOrigin()).add(new THREE.Vector3(0,5,-12));
  portal.rotation.y=Math.PI/2;
  addFx(portal,4,function(f,dt){
    f.obj.rotation.z+=dt*3.5;
    f.obj.scale.multiplyScalar(1+dt*0.08);
    f.obj.material.opacity=Math.max(0,f.life/f.maxLife);
  });
}
function fearWave(){
  if(!canUse("sat3",22,"infernal"))return;
  radialRing(0x7c00ff,13,1.5);
  orbBurst(0x5b00b8,24,8,1.2,powerOrigin());
}
function hellOnEarth(){
  if(!canUse("sat4",100,"infernal"))return;
  powerState.hellOnEarth=12;
  radialRing(0xff2200,28,2.4);
  verticalBeam(0xff2600,340,2.6);
  orbBurst(0xff3b00,95,45,4,powerOrigin().add(new THREE.Vector3(0,20,0)));
}
function usePower(slot){
  if(powerState.controller==="JC"){
    if(slot===1)holyShockwave();
    if(slot===2)divineShield();
    if(slot===3)judgmentBeam();
    if(slot===4)secondComing();
  }else{
    if(slot===1)hellfireStorm();
    if(slot===2)realityTear();
    if(slot===3)fearWave();
    if(slot===4)hellOnEarth();
  }
}
function togglePowerController(){
  powerState.controller=powerState.controller==="JC"?"SATAN":"JC";
  const satanActive=powerState.controller==="SATAN";
  player.root.visible=!satanActive;
  satanRoot.visible=satanActive;
  if(satanActive)satanRoot.position.copy(player.pos);
  else player.root.position.copy(player.pos);
}
function updatePowers(dt){
  powerState.divine=Math.min(100,powerState.divine+6*dt);
  powerState.infernal=Math.min(100,powerState.infernal+6*dt);
  powerState.divineShield=Math.max(0,powerState.divineShield-dt);
  powerState.secondComing=Math.max(0,powerState.secondComing-dt);
  powerState.hellOnEarth=Math.max(0,powerState.hellOnEarth-dt);
  Object.keys(powerState.cooldowns).forEach(function(k){powerState.cooldowns[k]=Math.max(0,powerState.cooldowns[k]-dt);});

  for(let i=powerFx.length-1;i>=0;i--){
    const f=powerFx[i];
    f.life-=dt;
    if(f.update)f.update(f,dt);
    if(f.life<=0){
      disposeFx(f.obj);
      powerFx.splice(i,1);
    }
  }

  if(powerState.secondComing>0){
    scene.background.lerp(new THREE.Color(0x3b4868),0.07);
    hemi.intensity=Math.max(hemi.intensity,4.5);
    glow.intensity=Math.max(glow.intensity,14);
  }
  if(powerState.hellOnEarth>0){
    scene.background.lerp(new THREE.Color(0x390400),0.09);
    satanGlow.intensity=14;
  }else satanGlow.intensity=8;

  if(powerState.controller==="SATAN"){
    satanRoot.position.copy(player.pos);
    satanRoot.visible=true;
    player.root.visible=false;
  }else{
    player.root.visible=true;
    satanRoot.visible=false;
  }

  const meter=powerState.controller==="JC"?powerState.divine:powerState.infernal;
  const names=powerState.controller==="JC"
    ?["1 HOLY SHOCKWAVE","2 DIVINE SHIELD","3 JUDGMENT BEAM","4 SECOND COMING"]
    :["1 HELLFIRE STORM","2 REALITY TEAR","3 FEAR WAVE","4 HELL ON EARTH"];
  powerHud.innerHTML="<b style='color:"+(powerState.controller==="JC"?"#ffe58a":"#ff4b32")+"'>"+powerState.controller+"</b> · POWER "+Math.round(meter)+"%<br>"+names.join("<br>")+"<br><span style='opacity:.75'>T = switch JC / Satan</span>";
}
function syncControlledAvatar(){
  if(powerState.controller==="SATAN")satanRoot.position.copy(player.pos);
}
// -----------------------------------------------------------------------------

const keys={};
let camYaw=Math.PI,camPitch=0.28,targetYaw=Math.PI,targetPitch=0.28,camDist=14,drag=false,lx=0,ly=0;
let solarCharge=100,solarHolding=false;
let destinationIndex=-1;
let destinations=[];
const hyper={active:false,t:0,duration:1.5,start:new THREE.Vector3(),end:new THREE.Vector3(),name:""};

function currentCellName(){
  const c=worldCell(player.pos.x,player.pos.z);
  return tileKey(c.col,c.row);
}
function rebuildDestinations(){
  destinations=manifest.map(function(t){
    const p=tileWorldPosition(t.col,t.row);
    return {name:tileKey(t.col,t.row),x:p.x+TILE_WORLD_SIZE*0.5,y:24,z:p.z-TILE_WORLD_SIZE*0.5};
  }).sort(function(a,b){
    return Math.hypot(player.pos.x-a.x,player.pos.z-a.z)-Math.hypot(player.pos.x-b.x,player.pos.z-b.z);
  });
  if(destinations.length)destinationIndex=0;
}
function selectDestination(step){
  if(!destinations.length)return null;
  destinationIndex=(destinationIndex+(step||1)+destinations.length)%destinations.length;
  const d=destinations[destinationIndex];
  destinationEl.textContent="TARGET: "+d.name+" · "+Math.hypot(player.pos.x-d.x,player.pos.z-d.z).toFixed(0)+"m";
  return d;
}
function beginHyperspeed(){
  const d=destinations[destinationIndex]||selectDestination(1);
  if(!d)return;
  if(solarCharge<25){statusEl.textContent="HYPERSPEED NEEDS 25% SOLAR";return;}
  solarCharge-=25;
  hyper.active=true;
  hyper.t=0;
  hyper.start.copy(player.pos);
  hyper.end.set(d.x,d.y,d.z);
  hyper.name=d.name;
}
function toggleFlight(){
  player.flying=!player.flying;
  if(!player.flying)player.pos.y=Math.max(3,player.pos.y);
  flightStateEl.textContent=player.flying?"FLIGHT ON · REAL GLB MAP":"GROUND MODE";
  flightStateEl.style.color=player.flying?"#ffd45a":"#7de6ff";
}
function applyLook(dx,dy){
  const speedFactor=THREE.MathUtils.clamp(1-(player.speed/18000)*0.55,0.42,1);
  targetYaw-=dx*0.0026*speedFactor;
  targetPitch=THREE.MathUtils.clamp(targetPitch+dy*0.0023*speedFactor,-1.05,1.05);
}
function updateLook(dt){
  const response=1-Math.exp(-12*dt);
  camYaw=THREE.MathUtils.lerp(camYaw,targetYaw,response);
  camPitch=THREE.MathUtils.lerp(camPitch,targetPitch,response);
}

renderer.domElement.addEventListener("contextmenu",function(e){e.preventDefault();});
renderer.domElement.addEventListener("pointerdown",function(e){
  if(e.button===2){e.preventDefault();beginHyperspeed();return;}
  drag=true;lx=e.clientX;ly=e.clientY;
  if(e.button===0)solarHolding=true;
});
addEventListener("pointermove",function(e){
  if(!drag)return;
  applyLook(e.clientX-lx,e.clientY-ly);
  lx=e.clientX;ly=e.clientY;
});
addEventListener("pointerup",function(e){drag=false;if(e.button===0)solarHolding=false;});
addEventListener("keydown",function(e){
  keys[e.code]=true;
  if(e.code==="KeyF"&&!e.repeat)toggleFlight();
  if(e.code==="KeyQ"&&!e.repeat)selectDestination(1);
  if(e.code==="KeyH"&&!e.repeat)beginHyperspeed();
  if(e.code==="KeyT"&&!e.repeat)togglePowerController();
  if(e.code==="Digit1"&&!e.repeat)usePower(1);
  if(e.code==="Digit2"&&!e.repeat)usePower(2);
  if(e.code==="Digit3"&&!e.repeat)usePower(3);
  if(e.code==="Digit4"&&!e.repeat)usePower(4);
  if(e.code==="Space")e.preventDefault();
});
addEventListener("keyup",function(e){keys[e.code]=false;});
addEventListener("blur",function(){drag=false;solarHolding=false;Object.keys(keys).forEach(function(k){keys[k]=false;});});

document.querySelectorAll("[data-key]").forEach(function(button){
  const code=button.dataset.key;
  const on=function(e){e.preventDefault();keys[code]=true;};
  const off=function(e){e.preventDefault();keys[code]=false;};
  button.addEventListener("pointerdown",on);
  button.addEventListener("pointerup",off);
  button.addEventListener("pointercancel",off);
  button.addEventListener("pointerleave",off);
});
document.querySelector("[data-flight-toggle]")?.addEventListener("pointerdown",function(e){e.preventDefault();toggleFlight();});
document.querySelector("[data-solar-charge]")?.addEventListener("pointerdown",function(e){e.preventDefault();solarHolding=true;});
["pointerup","pointercancel","pointerleave"].forEach(function(ev){
  document.querySelector("[data-solar-charge]")?.addEventListener(ev,function(e){e.preventDefault();solarHolding=false;});
});
document.querySelector("[data-target-cycle]")?.addEventListener("pointerdown",function(e){e.preventDefault();selectDestination(1);});
document.querySelector("[data-hyper-launch]")?.addEventListener("pointerdown",function(e){e.preventDefault();beginHyperspeed();});

function updateSolar(dt){
  if((solarHolding||keys.KeyR)&&!hyper.active)solarCharge=Math.min(100,solarCharge+30*dt);
  solarFillEl.style.width=solarCharge+"%";
  solarTextEl.textContent=Math.round(solarCharge)+"%";
  glow.intensity=4+solarCharge*0.04;
}
function updateHyper(dt){
  if(!hyper.active)return false;
  hyper.t+=dt;
  const t=Math.min(1,hyper.t/hyper.duration);
  const e=t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
  player.pos.lerpVectors(hyper.start,hyper.end,e);
  hyperFxEl.style.opacity=String(Math.sin(Math.PI*t)*0.9);
  hyperFxEl.style.transform="scale("+(0.65+t*1.35)+") rotate("+(t*24)+"deg)";
  if(t>=1){
    hyper.active=false;
    hyperFxEl.style.opacity="0";
    streamTiles(true);
    selectDestination(1);
  }
  return true;
}
function flightTargetSpeed(){
  const y=player.pos.y;
  let base=FLIGHT_SPEEDS.street;
  if(y>=300)base=FLIGHT_SPEEDS.city;
  if(y>=1500)base=FLIGHT_SPEEDS.regional;
  if(y>=5000)base=FLIGHT_SPEEDS.supersonic;
  if(y>=12000)base=FLIGHT_SPEEDS.hypersonic;
  if(y>=35000)base=FLIGHT_SPEEDS.upperAtmosphere;
  if(y>=SPACE_ALTITUDE)base=FLIGHT_SPEEDS.space;

  if(keys.AltLeft||keys.AltRight)base*=0.28;
  if(keys.ShiftLeft||keys.ShiftRight){
    if(y<1500)base*=2.4;
    else if(y<12000)base*=2.0;
    else if(y<SPACE_ALTITUDE)base*=1.55;
    else base*=1.5;
  }
  return base;
}
function classifyFlight(){
  player.speed=player.velocity.length();
  player.mach=player.speed/MACH_1;
  if(keys.Space&&(keys.ShiftLeft||keys.ShiftRight))player.flightMode="ROCKET ASCENT";
  else if(player.pos.y>=SPACE_ALTITUDE)player.flightMode="SPACE";
  else if(player.mach>=5)player.flightMode="HYPERSONIC";
  else if(player.mach>=1)player.flightMode="SUPERSONIC";
  else if(keys.AltLeft||keys.AltRight)player.flightMode="PRECISION";
  else player.flightMode="FLIGHT";
}
function updatePlayer(dt){
  updateSolar(dt);
  if(updateHyper(dt)){
    player.velocity.set(0,0,0);
    classifyFlight();
    player.root.position.copy(player.pos);
    return;
  }

  if(player.flying){
    const forward3=new THREE.Vector3(
      -Math.sin(camYaw)*Math.cos(camPitch),
      -Math.sin(camPitch),
      -Math.cos(camYaw)*Math.cos(camPitch)
    ).normalize();
    const right=new THREE.Vector3(Math.cos(camYaw),0,-Math.sin(camYaw)).normalize();
    const up=new THREE.Vector3(0,1,0);

    const throttle=(keys.KeyW?1:0)-(keys.KeyS?1:0);
    const strafe=(keys.KeyD?1:0)-(keys.KeyA?1:0);
    const rising=!!keys.Space;
    const descending=!!(keys.KeyC||keys.ControlLeft||keys.ControlRight);

    const input=new THREE.Vector3()
      .addScaledVector(forward3,throttle)
      .addScaledVector(right,strafe);

    const targetSpeed=flightTargetSpeed();
    const desired=new THREE.Vector3();
    if(input.lengthSq()>0.0001){
      input.normalize();
      desired.copy(input).multiplyScalar(targetSpeed);
      const accelRate=(keys.ShiftLeft||keys.ShiftRight)?2.6:4.8;
      player.velocity.lerp(desired,1-Math.exp(-accelRate*dt));
      player.yaw=THREE.MathUtils.lerp(
        player.yaw,
        Math.atan2(player.velocity.x,player.velocity.z),
        1-Math.exp(-8*dt)
      );
    }else{
      const coast=player.pos.y>=SPACE_ALTITUDE?0.22:0.9;
      player.velocity.multiplyScalar(Math.exp(-coast*dt));
    }

    if(keys.KeyX){
      player.velocity.multiplyScalar(Math.exp(-10*dt));
    }

    player.pos.addScaledVector(player.velocity,dt);

    // Dedicated vertical thrusters: fast rise is independent of horizontal inertia.
    if(rising||descending){
      const boosted=!!(keys.ShiftLeft||keys.ShiftRight);
      let riseSpeed=220;
      let descendSpeed=180;

      if(boosted){
        riseSpeed=1200;          // 0-2 km: rocket launch
        if(player.pos.y>=2000) riseSpeed=3200;
        if(player.pos.y>=12000) riseSpeed=7000;
        if(player.pos.y>=35000) riseSpeed=12000;
        if(player.pos.y>=80000) riseSpeed=18000;

        descendSpeed=900;
        if(player.pos.y>=12000) descendSpeed=2800;
        if(player.pos.y>=50000) descendSpeed=6500;
      }

      if(rising) player.pos.y+=riseSpeed*dt;
      if(descending) player.pos.y-=descendSpeed*dt;

      // Kill opposing vertical drift so climb/descent controls feel immediate.
      if(rising&&player.velocity.y<0) player.velocity.y*=0.2;
      if(descending&&player.velocity.y>0) player.velocity.y*=0.2;
    }

    player.pos.y=THREE.MathUtils.clamp(player.pos.y,3,MAX_ALTITUDE);

    if(player.pos.y<=3&&player.velocity.y<0)player.velocity.y=0;
  }else{
    const forward=new THREE.Vector3(-Math.sin(camYaw),0,-Math.cos(camYaw));
    const right=new THREE.Vector3(forward.z,0,-forward.x);
    const move=new THREE.Vector3()
      .addScaledVector(forward,(keys.KeyW?1:0)-(keys.KeyS?1:0))
      .addScaledVector(right,(keys.KeyD?1:0)-(keys.KeyA?1:0));
    if(move.lengthSq()){
      move.normalize();
      player.pos.addScaledVector(move,(keys.ShiftLeft?42:26)*dt);
      player.yaw=Math.atan2(move.x,move.z);
    }
    player.velocity.set(0,0,0);
    player.pos.y=3;
  }

  classifyFlight();

  const viewYaw=Math.atan2(camera.position.x-player.pos.x,camera.position.z-player.pos.z);
  const rel=Math.atan2(Math.sin(player.yaw-viewYaw),Math.cos(player.yaw-viewYaw));
  let frame=Math.abs(rel)>2.35?1:Math.abs(rel)<0.78?0:rel>0?2:3;
  jcAtlas.offset.x=frame*0.25;
  jcAtlas.offset.y=0.5;

  const speedFx=THREE.MathUtils.clamp(player.mach/10,0,1);
  flightRing.material.opacity=THREE.MathUtils.lerp(
    flightRing.material.opacity,
    player.flying?0.72+speedFx*0.25:0.08,
    0.12
  );
  flightRing.scale.setScalar(1+speedFx*1.8);
  flightRing.rotation.z+=player.flying?0.05+speedFx*0.18:0.01;
  glow.intensity=4+solarCharge*0.04+speedFx*7;
  player.root.position.copy(player.pos);
}
function updateAtmosphere(){
  const y=player.pos.y;
  const t=THREE.MathUtils.smoothstep(y,ATMOSPHERE_FADE_START,SPACE_ALTITUDE);
  scene.background.copy(SKY_GROUND).lerp(SKY_SPACE,t);
  scene.fog.density=0.00055*(1-t);
  starMat.opacity=THREE.MathUtils.smoothstep(y,6000,45000);
  spaceSun.visible=y>12000;
  hemi.intensity=THREE.MathUtils.lerp(2.4,0.15,t);
  moon.intensity=THREE.MathUtils.lerp(3.2,1.25,t);
  fill.intensity=THREE.MathUtils.lerp(1.35,0.25,t);
  holeGround.visible=y<35000;
  if(player.flying){
    const alt=y>=1000?(y/1000).toFixed(y>=10000?0:1)+" KM":Math.round(y)+" M";
    const mach=player.mach>=0.1?" · MACH "+player.mach.toFixed(player.mach>=10?0:1):"";
    flightStateEl.textContent=player.flightMode+" · "+alt+mach;
    flightStateEl.style.color=
      player.flightMode==="SPACE"?"#ffffff":
      player.flightMode==="HYPERSONIC"?"#ffdf77":
      player.flightMode==="SUPERSONIC"?"#8de8ff":
      player.flightMode==="PRECISION"?"#b7ffcf":"#ffd45a";
  }
}

function updateCamera(dt){
  const target=player.pos.clone().add(new THREE.Vector3(0,2,0));
  const speedFx=THREE.MathUtils.clamp(player.mach/12,0,1);
  const d=hyper.active?24:camDist+speedFx*18;
  const desired=target.clone().add(new THREE.Vector3(
    Math.sin(camYaw)*Math.cos(camPitch)*d,
    Math.sin(camPitch)*d+2,
    Math.cos(camYaw)*Math.cos(camPitch)*d
  ));
  camera.position.lerp(desired,1-Math.exp(-(hyper.active?10:7)*dt));
  const targetFov=hyper.active?94:62+speedFx*26;
  camera.fov=THREE.MathUtils.lerp(camera.fov,targetFov,1-Math.exp(-5*dt));
  camera.updateProjectionMatrix();
  camera.lookAt(target);
}
function updateHud(){
  const cell=currentCellName();
  locationEl.textContent=cell+" · JC REAL GLB MAP";
  progressEl.textContent=loadedTiles.size+" loaded / "+manifest.length+" uploaded GLBs";
  const alt=player.pos.y>=1000?(player.pos.y/1000).toFixed(player.pos.y>=10000?0:1)+" km":Math.round(player.pos.y)+" m";
  const speed=player.speed>=1000?(player.speed/1000).toFixed(1)+" km/s":Math.round(player.speed)+" m/s";
  const mach=player.mach>=0.1?" · M"+player.mach.toFixed(player.mach>=10?0:1):"";
  const detail=player.pos.y< FULL_DETAIL_ALTITUDE?"FULL DETAIL":
    player.pos.y<LOW_DETAIL_ONLY_ALTITUDE?"MIXED LOD":"CITY LOD";
  const roadSegs=Array.from(loadedRoadTiles.values()).reduce(function(n,t){return n+(t.count||0)},0);
  const roadText=roadRuntimeReady?(" · ROADS "+roadSegs+(majorRoadReady?" + CITY LOD":"")):" · ROADS BUILDING";
  statusEl.textContent=player.flightMode+" · "+speed+mach+" · ALT "+alt+" · "+detail+" · "+loadedTiles.size+"/"+manifest.length+" nearby GLBs"+roadText;
  const d=destinations[destinationIndex];
  if(d)destinationEl.textContent="TARGET: "+d.name+" · "+Math.hypot(player.pos.x-d.x,player.pos.z-d.z).toFixed(0)+"m";
}
async function boot(){
  if(creditEl)creditEl.textContent="JC Map • streaming C##_R## GLB tiles from the GitHub repository";
  await loadManifest();
  rebuildDestinations();
  loadWorldLod();
  await loadRoadRuntime();
  await Promise.all([streamTiles(true),streamRoadTiles(true)]);
  toggleFlight();
  toggleFlight();
  updateHud();
  window.JC_GLB_MAP={
    manifest:manifest,
    loadedTiles:loadedTiles,
    mapGroup:mapGroup,
    worldLodGroup:worldLodGroup,
    roadTileGroup:roadTileGroup,
    majorRoadGroup:majorRoadGroup,
    player:player,
    tileWorldSize:TILE_WORLD_SIZE,
    tileScale:TILE_SCALE,
    origin:{col:ORIGIN_COL,row:ORIGIN_ROW},
    manifestVersion:manifestVersion,
    streamTiles:streamTiles,
    maxAltitude:MAX_ALTITUDE,
    spaceAltitude:SPACE_ALTITUDE,
    get speed(){return player.speed},
    get mach(){return player.mach},
    get flightMode(){return player.flightMode},
    get worldLodReady(){return worldLodReady},
    get worldLodBounds(){return worldLodBounds},
    get roadRuntimeReady(){return roadRuntimeReady},
    get majorRoadReady(){return majorRoadReady},
    loadedRoadTiles:loadedRoadTiles,
    powers:powerState,
    usePower:usePower,
    togglePowerController:togglePowerController
  };
  requestAnimationFrame(frame);
}
let streamClock=0;
const clock=new THREE.Clock();
function frame(){
  requestAnimationFrame(frame);
  const dt=Math.min(0.033,clock.getDelta());
  updateLook(dt);
  updatePlayer(dt);
  syncControlledAvatar();
  updatePowers(dt);
  updateWorldLod();
  updateRoadLod();
  updateAtmosphere();
  updateCamera(dt);
  streamClock+=dt;
  if(streamClock>0.7){
    streamClock=0;
    streamTiles(false);
    streamRoadTiles(false);
  }
  updateHud();
  renderer.render(scene,camera);
}
addEventListener("resize",function(){
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});
boot().catch(function(e){
  console.error(e);
  statusEl.textContent="GLB MAP LOAD ERROR: "+e.message;
});
