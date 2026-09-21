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
  velocity:new THREE.Vector3()
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

const keys={};
let camYaw=Math.PI,camPitch=0.28,camDist=14,drag=false,lx=0,ly=0;
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
  camYaw-=dx*0.0026;
  camPitch=THREE.MathUtils.clamp(camPitch+dy*0.0023,-0.7,0.9);
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
function updatePlayer(dt){
  updateSolar(dt);
  if(updateHyper(dt)){player.root.position.copy(player.pos);return;}
  const forward=new THREE.Vector3(-Math.sin(camYaw),0,-Math.cos(camYaw));
  const right=new THREE.Vector3(forward.z,0,-forward.x);
  const move=new THREE.Vector3()
    .addScaledVector(forward,(keys.KeyW?1:0)-(keys.KeyS?1:0))
    .addScaledVector(right,(keys.KeyD?1:0)-(keys.KeyA?1:0));
  const boost=keys.ShiftLeft?2.2:1;
  const speed=(player.flying?42:26)*boost;
  if(move.lengthSq()){
    move.normalize();
    player.pos.addScaledVector(move,speed*dt);
    player.yaw=Math.atan2(move.x,move.z);
  }
  if(player.flying){
    const verticalInput=(keys.Space?1:0)-((keys.KeyC||keys.ControlLeft)?1:0);
    let verticalSpeed=70;
    if(player.pos.y>500)verticalSpeed=220;
    if(player.pos.y>2500)verticalSpeed=850;
    if(player.pos.y>15000)verticalSpeed=2600;
    if(player.pos.y>50000)verticalSpeed=5200;
    if(keys.ShiftLeft)verticalSpeed*=2.4;
    player.pos.y+=verticalInput*verticalSpeed*dt;
    player.pos.y=THREE.MathUtils.clamp(player.pos.y,3,MAX_ALTITUDE);
  }else{
    player.pos.y=3;
  }
  const viewYaw=Math.atan2(camera.position.x-player.pos.x,camera.position.z-player.pos.z);
  const rel=Math.atan2(Math.sin(player.yaw-viewYaw),Math.cos(player.yaw-viewYaw));
  let frame=Math.abs(rel)>2.35?1:Math.abs(rel)<0.78?0:rel>0?2:3;
  jcAtlas.offset.x=frame*0.25;
  jcAtlas.offset.y=0.5;
  flightRing.material.opacity=THREE.MathUtils.lerp(flightRing.material.opacity,player.flying?0.72:0.08,0.12);
  flightRing.rotation.z+=player.flying?0.05:0.01;
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
  if(y>=SPACE_ALTITUDE){
    flightStateEl.textContent="SPACE FLIGHT · "+Math.round(y/1000)+" KM";
    flightStateEl.style.color="#ffffff";
  }else if(y>=12000){
    flightStateEl.textContent="UPPER ATMOSPHERE · "+Math.round(y/1000)+" KM";
    flightStateEl.style.color="#9fd8ff";
  }else if(player.flying){
    flightStateEl.textContent="FLIGHT ON · "+Math.round(y)+" M";
    flightStateEl.style.color="#ffd45a";
  }
}

function updateCamera(dt){
  const target=player.pos.clone().add(new THREE.Vector3(0,2,0));
  const d=hyper.active?22:camDist;
  const desired=target.clone().add(new THREE.Vector3(
    Math.sin(camYaw)*Math.cos(camPitch)*d,
    Math.sin(camPitch)*d+2,
    Math.cos(camYaw)*Math.cos(camPitch)*d
  ));
  camera.position.lerp(desired,1-Math.exp(-8*dt));
  camera.fov=THREE.MathUtils.lerp(camera.fov,hyper.active?86:62,0.12);
  camera.updateProjectionMatrix();
  camera.lookAt(target);
}
function updateHud(){
  const cell=currentCellName();
  locationEl.textContent=cell+" · JC REAL GLB MAP";
  progressEl.textContent=loadedTiles.size+" loaded / "+manifest.length+" uploaded GLBs";
  const alt=player.pos.y>=1000?(player.pos.y/1000).toFixed(player.pos.y>=10000?0:1)+" km":Math.round(player.pos.y)+" m";
  statusEl.textContent=(streamBusy?"STREAMING ":"READY ")+loadedTiles.size+" tiles · "+loadingTiles.size+" loading · "+failedTiles.size+" failed · ALT "+alt;
  const d=destinations[destinationIndex];
  if(d)destinationEl.textContent="TARGET: "+d.name+" · "+Math.hypot(player.pos.x-d.x,player.pos.z-d.z).toFixed(0)+"m";
}
async function boot(){
  if(creditEl)creditEl.textContent="JC Map • streaming C##_R## GLB tiles from the GitHub repository";
  await loadManifest();
  rebuildDestinations();
  await streamTiles(true);
  toggleFlight();
  toggleFlight();
  updateHud();
  window.JC_GLB_MAP={
    manifest:manifest,
    loadedTiles:loadedTiles,
    mapGroup:mapGroup,
    player:player,
    tileWorldSize:TILE_WORLD_SIZE,
    tileScale:TILE_SCALE,
    origin:{col:ORIGIN_COL,row:ORIGIN_ROW},
    manifestVersion:manifestVersion,
    streamTiles:streamTiles,
    maxAltitude:MAX_ALTITUDE,
    spaceAltitude:SPACE_ALTITUDE
  };
  requestAnimationFrame(frame);
}
let streamClock=0;
const clock=new THREE.Clock();
function frame(){
  requestAnimationFrame(frame);
  const dt=Math.min(0.033,clock.getDelta());
  updatePlayer(dt);
  updateAtmosphere();
  updateCamera(dt);
  streamClock+=dt;
  if(streamClock>0.7){streamClock=0;streamTiles(false);}
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
