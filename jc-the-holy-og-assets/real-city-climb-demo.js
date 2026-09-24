import * as THREE from "three";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js";
import { JC_CHARACTER_ATLAS_DATA_URL } from "./jc-character-atlas-v2-data.js";

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
const healthFillEl=document.getElementById("healthFill");
const healthTextEl=document.getElementById("healthText");
const divineFillEl=document.getElementById("divineFill");
const divineTextEl=document.getElementById("divineText");
const controllerLabelEl=document.getElementById("controllerLabel");
const abilityStatusEl=document.getElementById("abilityStatus");
const hudSpeedEl=document.getElementById("hudSpeed");
const hudAltitudeEl=document.getElementById("hudAltitude");
const hudFpsEl=document.getElementById("hudFps");
const hudRoadsEl=document.getElementById("hudRoads");
const radarArrowEl=document.getElementById("radarArrow");

const lowSpec=matchMedia("(pointer:coarse)").matches||(navigator.hardwareConcurrency||4)<=4||("deviceMemory" in navigator&&(navigator.deviceMemory||4)<=4);
const scene=new THREE.Scene();
const SKY_GROUND=new THREE.Color(0x101722),SKY_SPACE=new THREE.Color(0x000003);
scene.background=SKY_GROUND.clone();
scene.fog=new THREE.FogExp2(0x17202b,0.00018);
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
const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,0.1,120000);
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:lowSpec?"default":"high-performance",alpha:false,stencil:false,preserveDrawingBuffer:false});
renderer.setSize(innerWidth,innerHeight);
const MAX_RENDER_PIXEL_RATIO=lowSpec?0.75:1.0;
let dynamicPixelRatio=Math.min(devicePixelRatio,MAX_RENDER_PIXEL_RATIO);
renderer.setPixelRatio(dynamicPixelRatio);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.08;
mount.appendChild(renderer.domElement);
let webglContextLost=false;
renderer.domElement.addEventListener("webglcontextlost",function(event){
  event.preventDefault();
  webglContextLost=true;
  if(statusEl)statusEl.textContent="GPU CONTEXT PAUSED · restoring graphics…";
});
renderer.domElement.addEventListener("webglcontextrestored",function(){
  webglContextLost=false;
  if(statusEl)statusEl.textContent="GRAPHICS RESTORED · resuming mission";
});

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
const SATELLITE_FOOTPRINT_AUDIT={
  enabled:true,
  source:"City of Las Vegas Building Footprints GIS",
  service:"https://mapdata.lasvegasnevada.gov/clvgis/rest/services/DevelopmentServices/BuildingFootprints/MapServer",
  exactTileModelBinding:true,
  runtimeCounts:{tiles:0,models:0,wallpapered:0,residential:0}
};
window.JC_SATELLITE_FOOTPRINT_AUDIT=SATELLITE_FOOTPRINT_AUDIT;

const ORIGIN_COL=8;
const ORIGIN_ROW=8;
const TILE_GROUND_Y=0;
const ROAD_SURFACE_Y=0.10;
const MAP_Y_OFFSET=TILE_GROUND_Y;
const LOAD_RADIUS=lowSpec?1:2;
const KEEP_RADIUS=lowSpec?2:4;
const MAX_CONCURRENT=lowSpec?2:4;
const FULL_MAP_MODE=true;
const DATA_BUFFERING=true;
const FULL_MAP_BATCH=lowSpec?1:2;
const RAW_PREFETCH_CONCURRENCY=2;
const INITIAL_BUFFER_RADIUS=1;
const ACTIVE_TILE_RADIUS=lowSpec?2:4;
const FAST_ACTIVE_TILE_RADIUS=lowSpec?3:6;
const ACTIVE_LOOKAHEAD_TILES=lowSpec?4:8;
const DECODE_KEEP_EXTRA=1;
const VISIBILITY_UPDATE_INTERVAL=0.16;
const MASS_TILE_THRESHOLD=512;
const MASS_PREFETCH_EXTRA_RADIUS=2;
const MASS_PREFETCH_BATCH=2;
const STREAM_LOOKAHEAD_SECONDS=lowSpec?3.5:7.0;
const MAX_LOOKAHEAD_TILES=lowSpec?10:24;
const HIGH_SPEED_STREAM_THRESHOLD=260;
const VERY_HIGH_SPEED_STREAM_THRESHOLD=900;
const PLAYER_RADIUS=0.38;
const PLAYER_HEIGHT=1.85;
const GRAVITY=38;
const GROUND_Y=ROAD_SURFACE_Y+0.04;
const COLLISION_TILE_RADIUS=1;
const MAX_COLLIDERS_PER_TILE=lowSpec?120:240;


const gltfLoader=new GLTFLoader();

const STRIP_WALLPAPER_FALLBACK_URL="./jc-the-holy-og-assets/textures/strip-wallpaper-atlas.jpg";
const RESIDENTIAL_WALLPAPER_FALLBACK_URL="./jc-the-holy-og-assets/textures/residential-wallpaper-atlas.jpg";
const STRIP_MIN_COL=15;
const STRIP_MAX_COL=16;
const STRIP_MIN_ROW=12;
const STRIP_MAX_ROW=15;
const MAX_WALLPAPER_BUILDINGS_PER_TILE=lowSpec?48:160;
const wallpaperTextureLoader=new THREE.TextureLoader();
let stripWallpaperAtlas=null;
let residentialWallpaperAtlas=null;
let wallpaperAssetsReady=false;
const wallpaperMaterials={facade:[],roof:[],side:[]};

function loadWallpaperTexture(url){
  return new Promise(function(resolve,reject){
    wallpaperTextureLoader.load(url,function(tex){
      tex.colorSpace=THREE.SRGBColorSpace;
      tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;
      tex.minFilter=THREE.LinearMipmapLinearFilter;
      tex.magFilter=THREE.LinearFilter;
      tex.needsUpdate=true;
      resolve(tex);
    },undefined,reject);
  });
}
function factoryRuntimePath(id,fallback){
  const asset=getAIAsset(id);
  if(!asset||!asset.apply||asset.apply.enabled===false)return fallback;
  return asset.runtime_path||fallback;
}
async function initializeFactoryWallpapers(){
  const stripUrl=factoryRuntimePath("hell-vegas-strip-wallpaper-v1",STRIP_WALLPAPER_FALLBACK_URL);
  const residentialUrl=factoryRuntimePath("vegas-residential-wallpaper-v1",RESIDENTIAL_WALLPAPER_FALLBACK_URL);
  try{
    const textures=await Promise.all([
      loadWallpaperTexture(stripUrl),
      loadWallpaperTexture(residentialUrl)
    ]);
    stripWallpaperAtlas=textures[0];
    residentialWallpaperAtlas=textures[1];
    wallpaperAssetsReady=true;
  }catch(err){
    console.warn("Factory wallpaper load failed; using fallback textures",err);
    const textures=await Promise.all([
      loadWallpaperTexture(STRIP_WALLPAPER_FALLBACK_URL),
      loadWallpaperTexture(RESIDENTIAL_WALLPAPER_FALLBACK_URL)
    ]);
    stripWallpaperAtlas=textures[0];
    residentialWallpaperAtlas=textures[1];
    wallpaperAssetsReady=true;
  }
}
let wallpaperShellCount=0;

function atlasSliceTexture(index,kind){
  const tex=stripWallpaperAtlas.clone();
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;
  tex.minFilter=THREE.LinearMipmapLinearFilter;
  tex.magFilter=THREE.LinearFilter;

  // Atlas layout: 6 facade panels on the first row, matching roof panels below.
  tex.repeat.x=1/6;
  tex.offset.x=index/6;
  if(kind==="facade"){
    tex.repeat.y=0.335;
    tex.offset.y=0.665;
  }else if(kind==="roof"){
    tex.repeat.y=0.225;
    tex.offset.y=0.405;
  }else{
    tex.repeat.y=0.335;
    tex.offset.y=0.665;
  }
  tex.needsUpdate=true;
  return tex;
}
function wallpaperMaterial(index,kind){
  const cache=wallpaperMaterials[kind];
  if(cache[index])return cache[index];
  const map=atlasSliceTexture(index,kind);
  const palette=[0x261018,0x171b35,0x3b1a12,0x132b2a,0x25133b,0x35220f];
  const mat=new THREE.MeshStandardMaterial({
    map:map,
    color:palette[index%palette.length],
    emissive:new THREE.Color(palette[index%palette.length]).multiplyScalar(0.22),
    emissiveIntensity:0.9,
    roughness:0.42,
    metalness:0.16,
    side:THREE.DoubleSide,
    depthWrite:true
  });
  cache[index]=mat;
  return mat;
}
const wallpaperBottomMaterial=new THREE.MeshBasicMaterial({
  transparent:true,
  opacity:0,
  depthWrite:false,
  colorWrite:false
});
function isStripWallpaperTile(rec){
  return rec.col>=STRIP_MIN_COL&&rec.col<=STRIP_MAX_COL&&
    rec.row>=STRIP_MIN_ROW&&rec.row<=STRIP_MAX_ROW;
}
const LANDMARK_WALLPAPER_RULES=[
  {name:"LUXOR",col:15,row:14,profile:0},
  {name:"END OF HIM",aliases:["MGM GRAND"],col:16,row:14,profile:1},
  {name:"BEAZLEBUBIO",aliases:["BELLAGIO"],col:15,row:13,profile:2},
  {name:"SATAN'S PLACE",aliases:["CAESARS PALACE"],col:15,row:13,profile:3},
  {name:"PSALMS",aliases:["PALMS"],col:14,row:13,profile:4},
  {name:"ALLEGIANT STADIUM",col:14,row:15,profile:5}
];
function isLandmarkWallpaperTile(rec){
  return LANDMARK_WALLPAPER_RULES.some(function(rule){
    return rule.col===rec.col&&rule.row===rec.row;
  });
}
function shouldUseStripWallpaper(rec){
  // Heavy casino/infernal facade art is restricted to the real Strip core and
  // explicitly registered landmark tiles. Residential/ordinary city tiles keep
  // their own materials instead of inheriting casino wallpaper.
  return isStripWallpaperTile(rec)||isLandmarkWallpaperTile(rec);
}
function landmarkWallpaperRule(rec,o){
  const n=((o&&o.name)||"").toUpperCase();
  return LANDMARK_WALLPAPER_RULES.find(function(rule){
    if(rule.col!==rec.col||rule.row!==rec.row)return false;
    return n.includes(rule.name)||((rule.aliases||[]).some(function(a){return n.includes(a);}));
  })||null;
}
function isWallpaperGroundMesh(o,size,box){
  const objectName=((o&&o.name)||"").toLowerCase();
  const materialNames=(Array.isArray(o&&o.material)?o.material:[o&&o.material])
    .filter(Boolean)
    .map(function(m){return (m.name||"").toLowerCase();})
    .join(" ");
  const label=objectName+" "+materialNames;

  // Explicit semantic exclusions for common exported terrain/road names.
  if(/(^|[_\\-\\s])(ground|terrain|land|road|street|asphalt|pavement|sidewalk|parking|lot|base|plane|surface|floor)([_\\-\\s]|$)/.test(label))return true;

  const footprint=size.x*size.z;
  const widest=Math.max(size.x,size.z);
  const narrowest=Math.min(size.x,size.z);
  const aspect=widest/Math.max(0.01,narrowest);

  // Ground chunks can be much smaller than an entire 1000 m source tile. Reject
  // low, broad slabs and long flat strips before they can receive facade shells.
  if(size.y<=4.5&&footprint>=220&&widest>=24)return true;
  if(size.y<=6&&footprint>=650&&widest>=34)return true;
  if(size.y<=8&&aspect>=5.5&&widest>=28)return true;

  // Anything hugging the shared tile ground plane with a broad footprint is terrain.
  if(box&&box.min.y<=TILE_GROUND_Y+0.35&&size.y<=5.5&&footprint>=150)return true;
  return false;
}
function stableModelHash(value){
  let h=2166136261;
  for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}
  return h>>>0;
}
function wallpaperProfileIndex(rec,center,slot,name){
  const n=(name||"").toUpperCase();
  for(const rule of LANDMARK_WALLPAPER_RULES){
    if(rule.col===rec.col&&rule.row===rec.row&&(n.includes(rule.name)||(rule.aliases||[]).some(function(a){return n.includes(a);})) )return rule.profile;
  }
  // Every remaining model gets a deterministic profile from its exact tile,
  // source model name and quantized footprint. It will never reshuffle between loads.
  const identity=tileKey(rec.col,rec.row)+"|"+n+"|"+
    Math.round(center.x*4)+"|"+Math.round(center.z*4)+"|"+slot;
  return stableModelHash(identity)%6;
}
function buildStripWallpaper(root,rec){
  if(!wallpaperAssetsReady||!stripWallpaperAtlas)return null;
  if(!shouldUseStripWallpaper(rec))return null;

  root.updateMatrixWorld(true);
  const candidates=[];
  root.traverse(function(o){
    if(!o.isMesh||!o.visible)return;
    const box=new THREE.Box3().setFromObject(o);
    if(box.isEmpty())return;
    const size=new THREE.Vector3(),center=new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Wallpaper buildings only. Ground/terrain/roads must never receive facade art.
    // Residential-scale structures are handled by the dedicated instanced house pass.
    if(size.y<2.2||size.x<2.0||size.z<2.0)return;
    if(isWallpaperGroundMesh(o,size,box))return;
    if(size.x>240&&size.z>240&&size.y<8)return;
    if(residentialClass(size))return;
    const volume=size.x*size.y*size.z;
    if(volume<28)return;
    candidates.push({box:box,size:size,center:center,volume:volume,name:o.name||"",source:o});
  });

  candidates.sort(function(a,b){return b.volume-a.volume;});
  const chosen=[];
  for(const c of candidates){
    if(chosen.length>=MAX_WALLPAPER_BUILDINGS_PER_TILE)break;
    let nested=false;
    for(const keep of chosen){
      if(keep.box.containsBox(c.box)){nested=true;break;}
      const dx=Math.abs(keep.center.x-c.center.x);
      const dz=Math.abs(keep.center.z-c.center.z);
      if(dx<Math.min(keep.size.x,c.size.x)*0.18&&dz<Math.min(keep.size.z,c.size.z)*0.18){
        nested=true;break;
      }
    }
    if(!nested)chosen.push(c);
  }

  if(!chosen.length)return null;
  const group=new THREE.Group();
  group.name="CITY_BUILDING_WALLPAPER_"+tileKey(rec.col,rec.row);

  chosen.forEach(function(c,slot){
    const idx=wallpaperProfileIndex(rec,c.center,slot,c.name);
    const facade=wallpaperMaterial(idx,"facade");
    const side=wallpaperMaterial(idx,"side");
    const roof=wallpaperMaterial(idx,"roof");

    // Slight expansion turns the generated art into a true outer cover while
    // leaving the original GLB and its collision shell untouched underneath.
    const pad=0.10;
    const geom=new THREE.BoxGeometry(
      Math.max(0.5,c.size.x+pad),
      Math.max(0.5,c.size.y+pad),
      Math.max(0.5,c.size.z+pad)
    );
    const mats=[side,side,roof,wallpaperBottomMaterial,facade,facade];
    const shell=new THREE.Mesh(geom,mats);
    shell.position.copy(c.center);
    shell.renderOrder=5;
    shell.frustumCulled=true;
    shell.userData.wallpaperProfile=idx;
    shell.userData.wallpaper=true;
    shell.userData.sourceTile=tileKey(rec.col,rec.row);
    shell.userData.sourceModel=c.name||"unnamed";
    shell.userData.landmarkRule=landmarkWallpaperRule(rec,c.source)?.name||null;
    // Building-mounted FX anchors: destruction/holy/demonic sprite layers attach to the
    // exact visual shell rather than floating independently of the source structure.
    const fxAnchor=new THREE.Group();
    fxAnchor.name="BUILDING_FX_ANCHOR_"+slot;
    fxAnchor.position.copy(c.center);
    fxAnchor.userData.sourceTile=tileKey(rec.col,rec.row);
    fxAnchor.userData.sourceModel=c.name||"unnamed";
    group.add(fxAnchor);
    shell.userData.fxAnchor=fxAnchor;
    group.add(shell);
    SATELLITE_FOOTPRINT_AUDIT.runtimeCounts.wallpapered++;
  });

  mapGroup.add(group);
  wallpaperShellCount+=group.children.length;
  return group;
}
function disposeWallpaperGroup(group){
  if(!group)return;
  wallpaperShellCount=Math.max(0,wallpaperShellCount-group.children.length);
  mapGroup.remove(group);
  group.traverse(function(o){
    if(o.geometry&&o.geometry.dispose)o.geometry.dispose();
  });
}

const residentialMaterials={single:[],town:[],apartment:[],roof:[]};
const residentialUnitBox=new THREE.BoxGeometry(1,1,1);
let residentialWallpaperCount=0;

function residentialAtlasSlice(kind,index){
  const tex=residentialWallpaperAtlas.clone();
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;
  tex.minFilter=THREE.LinearMipmapLinearFilter;
  tex.magFilter=THREE.LinearFilter;

  if(kind==="single"){
    tex.repeat.set(1/8,0.265);
    tex.offset.set((index%8)/8,0.715);
  }else if(kind==="town"){
    tex.repeat.set(1/4,0.205);
    tex.offset.set((index%4)/4,0.505);
  }else if(kind==="apartment"){
    tex.repeat.set(0.3125,0.205);
    tex.offset.set((index%2)*0.3125,0.300);
  }else{
    tex.repeat.set(1/8,0.155);
    tex.offset.set((index%8)/8,0.145);
  }
  tex.needsUpdate=true;
  return tex;
}
function residentialMaterial(kind,index){
  const cache=residentialMaterials[kind];
  if(cache[index])return cache[index];
  const tex=residentialAtlasSlice(kind,index);
  const residentialPalette=[0xc3aa8b,0xa9917c,0xd0c0a5,0x9f846d,0xb6a48d,0x8e7868,0xc8b397,0x776a61];
  const mat=new THREE.MeshStandardMaterial({
    map:tex,
    color:residentialPalette[index%residentialPalette.length],
    roughness:0.72,
    metalness:0.03,
    side:THREE.DoubleSide,
    depthWrite:true
  });
  cache[index]=mat;
  return mat;
}
function residentialClass(size){
  const footprint=size.x*size.z;
  const widest=Math.max(size.x,size.z);
  const narrowest=Math.min(size.x,size.z);

  // Residential-scale structure filters. These intentionally exclude terrain,
  // tiny props, huge casinos and towers.
  if(size.y<2.2||size.y>24)return null;
  if(narrowest<2.4||widest>58)return null;
  if(footprint<16||footprint>2300)return null;

  if(size.y<=9.5&&widest<=28&&footprint<=520)return "single";
  if(size.y<=14.5&&widest<=44&&footprint<=1200)return "town";
  return "apartment";
}
function residentialVariant(rec,center,kind){
  const count=kind==="single"?8:kind==="town"?4:2;
  const identity=tileKey(rec.col,rec.row)+"|"+kind+"|"+Math.round(center.x*4)+"|"+Math.round(center.z*4);
  return stableModelHash(identity)%count;
}
function buildResidentialWallpaper(root,rec){
  if(!wallpaperAssetsReady||!residentialWallpaperAtlas)return null;
  root.updateMatrixWorld(true);
  const byKey=new Map();

  root.traverse(function(o){
    if(!o.isMesh||!o.visible)return;
    const box=new THREE.Box3().setFromObject(o);
    if(box.isEmpty())return;
    const size=new THREE.Vector3(),center=new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    if(isWallpaperGroundMesh(o,size,box))return;
    const kind=residentialClass(size);
    if(!kind)return;

    // Collapse duplicate/nested component meshes that describe the same house.
    const key=[
      Math.round(center.x*2),
      Math.round(center.z*2),
      Math.round(size.x),
      Math.round(size.z)
    ].join(":");
    const volume=size.x*size.y*size.z;
    const old=byKey.get(key);
    if(!old||volume>old.volume)byKey.set(key,{box,size,center,kind,volume});
  });

  const homes=Array.from(byKey.values());
  if(!homes.length)return null;

  const buckets=new Map();
  homes.forEach(function(h){
    const variant=residentialVariant(rec,h.center,h.kind);
    const key=h.kind+":"+variant;
    if(!buckets.has(key))buckets.set(key,{kind:h.kind,variant:variant,items:[]});
    buckets.get(key).items.push(h);
  });

  const group=new THREE.Group();
  group.name="RESIDENTIAL_WALLPAPER_"+tileKey(rec.col,rec.row);
  const dummy=new THREE.Object3D();

  for(const bucket of buckets.values()){
    const facade=residentialMaterial(bucket.kind,bucket.variant);
    const roof=residentialMaterial("roof",bucket.variant%8);
    const mats=[facade,facade,roof,wallpaperBottomMaterial,facade,facade];
    const mesh=new THREE.InstancedMesh(residentialUnitBox,mats,bucket.items.length);
    mesh.name="HOMES_"+bucket.kind.toUpperCase()+"_"+bucket.variant;
    mesh.userData.sourceTile=tileKey(rec.col,rec.row);
    mesh.userData.wallpaperClass=bucket.kind;
    mesh.userData.wallpaperVariant=bucket.variant;
    mesh.renderOrder=4;
    mesh.frustumCulled=true;

    bucket.items.forEach(function(h,i){
      const pad=0.06;
      dummy.position.copy(h.center);
      dummy.rotation.set(0,0,0);
      dummy.scale.set(
        Math.max(0.5,h.size.x+pad),
        Math.max(0.5,h.size.y+pad),
        Math.max(0.5,h.size.z+pad)
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(i,dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate=true;
    group.add(mesh);
    SATELLITE_FOOTPRINT_AUDIT.runtimeCounts.residential+=bucket.matrices.length;
  }

  mapGroup.add(group);
  residentialWallpaperCount+=homes.length;
  group.userData.homeCount=homes.length;
  return group;
}
function disposeResidentialWallpaperGroup(group){
  if(!group)return;
  residentialWallpaperCount=Math.max(0,residentialWallpaperCount-(group.userData.homeCount||0));
  mapGroup.remove(group);
}

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
  highway:new THREE.MeshBasicMaterial({color:0x26282b,side:THREE.DoubleSide}),
  arterial:new THREE.MeshBasicMaterial({color:0x2b2d30,side:THREE.DoubleSide}),
  local:new THREE.MeshBasicMaterial({color:0x303236,side:THREE.DoubleSide}),
  lane:new THREE.MeshBasicMaterial({color:0xf1ead5,side:THREE.DoubleSide,depthWrite:false}),
  center:new THREE.MeshBasicMaterial({color:0xe2b84f,side:THREE.DoubleSide,depthWrite:false}),
  edge:new THREE.MeshBasicMaterial({color:0xcfcfc8,side:THREE.DoubleSide,depthWrite:false}),
  sidewalk:new THREE.MeshBasicMaterial({color:0xb9b5ad,side:THREE.DoubleSide}),
  curb:new THREE.MeshBasicMaterial({color:0xd0ccc3,side:THREE.DoubleSide}),
  access:new THREE.MeshBasicMaterial({color:0x4b4c4d,side:THREE.DoubleSide}),
  crosswalk:new THREE.MeshBasicMaterial({color:0xf3f0e6,side:THREE.DoubleSide,depthWrite:false}),
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
      const y=ROAD_SURFACE_Y;
      byType[bucket].push(
        ax+nx,y,az+nz, ax-nx,y,az-nz, bx-nx,y,bz-nz,
        ax+nx,y,az+nz, bx-nx,y,bz-nz, bx+nx,y,bz+nz
      );
    }
  }
  return byType;
}
function stripeQuad(out,ax,az,bx,bz,width,y,offset){
  const dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);
  if(!Number.isFinite(len)||len<0.01)return;
  const sx=-dz/len,sz=dx/len;
  const cx1=ax+sx*offset,cz1=az+sz*offset;
  const cx2=bx+sx*offset,cz2=bz+sz*offset;
  const nx=sx*width*0.5,nz=sz*width*0.5;
  out.push(
    cx1+nx,y,cz1+nz, cx1-nx,y,cz1-nz, cx2-nx,y,cz2-nz,
    cx1+nx,y,cz1+nz, cx2-nx,y,cz2-nz, cx2+nx,y,cz2+nz
  );
}
function makeRoadMeshes(roads,materials,worldSpace){
  const buckets=roadQuadGeometry(roads,worldSpace);
  const group=new THREE.Group();

  // Full asphalt surface for every road class.
  for(const [type,verts] of Object.entries(buckets)){
    if(!verts.length)continue;
    const g=new THREE.BufferGeometry();
    g.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
    g.computeBoundingSphere();
    const m=new THREE.Mesh(g,materials[type]||roadMats.local);
    m.frustumCulled=true;
    m.renderOrder=2;
    m.userData.jcRoadSurface=true;
    m.userData.jcRoadSurfaceOffset=0.08;
    group.add(m);
  }

  // Detailed mode: road markings plus GIS/OSM-informed pedestrian/access layers.
  // Sidewalks are generated only for road classes where a walk edge is plausible.
  // Driveway/access aprons are restricted to mapped OSM service roads; we do not
  // invent parcel driveways where the source data does not identify an access way.
  if(!worldSpace){
    const centerVerts=[],laneVerts=[],edgeVerts=[];
    const sidewalkVerts=[],curbVerts=[],accessVerts=[],crosswalkVerts=[];
    const junctions=new Map();
    const y=ROAD_SURFACE_Y+0.025;

    function junctionKey(x,z){
      return Math.round(x*20)+"|"+Math.round(z*20);
    }
    function addJunctionIncident(x,z,dx,dz,width,highway){
      const len=Math.hypot(dx,dz);
      if(len<0.01)return;
      const key=junctionKey(x,z);
      let node=junctions.get(key);
      if(!node){
        node={x:x,z:z,incidents:[]};
        junctions.set(key,node);
      }
      node.incidents.push({dx:dx/len,dz:dz/len,width:width,highway:highway||""});
    }

    for(const road of roads||[]){
      const pts=road.p||[];
      const h=road.h||"";
      const roadWidth=Math.max(0.28,Number(road.w)||0.55);
      const major=/motorway|trunk|primary|secondary|tertiary/.test(h);
      const highway=/motorway|trunk/.test(h);
      const mappedAccess=/^service$|service/.test(h);
      const pedestrianStreet=/primary|secondary|tertiary|residential|unclassified|living_street/.test(h)&&
        !/motorway|trunk|service|track|path|footway|cycleway/.test(h);

      for(let i=0;i<pts.length-1;i++){
        const a=pts[i],b=pts[i+1];
        const ax=Number(a[0]),az=Number(a[1]),bx=Number(b[0]),bz=Number(b[1]);
        if(![ax,az,bx,bz].every(Number.isFinite))continue;
        const dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);
        if(len<0.01)continue;

        if(roadWidth>=0.65){
          stripeQuad(centerVerts,ax,az,bx,bz,major?0.026:0.018,y,0);
        }

        if(highway&&roadWidth>=1.0){
          stripeQuad(edgeVerts,ax,az,bx,bz,0.018,y, roadWidth*0.5-0.07);
          stripeQuad(edgeVerts,ax,az,bx,bz,0.018,y,-roadWidth*0.5+0.07);
        }else if(major&&roadWidth>=1.0){
          stripeQuad(laneVerts,ax,az,bx,bz,0.014,y, roadWidth*0.25);
          stripeQuad(laneVerts,ax,az,bx,bz,0.014,y,-roadWidth*0.25);
        }

        if(pedestrianStreet){
          const walkWidth=major?0.24:0.18;
          const curbGap=0.045;
          const walkOffset=roadWidth*0.5+curbGap+walkWidth*0.5;
          stripeQuad(sidewalkVerts,ax,az,bx,bz,walkWidth,y+0.008, walkOffset);
          stripeQuad(sidewalkVerts,ax,az,bx,bz,walkWidth,y+0.008,-walkOffset);
          stripeQuad(curbVerts,ax,az,bx,bz,0.028,y+0.012, roadWidth*0.5+0.014);
          stripeQuad(curbVerts,ax,az,bx,bz,0.028,y+0.012,-roadWidth*0.5-0.014);

          addJunctionIncident(ax,az, dx,dz,roadWidth,h);
          addJunctionIncident(bx,bz,-dx,-dz,roadWidth,h);
        }

        if(mappedAccess){
          // OSM service roads represent mapped driveway, alley, parking-lot and
          // property-access connections. A slightly wider apron makes those real
          // access paths readable without fabricating unmapped driveways.
          stripeQuad(accessVerts,ax,az,bx,bz,roadWidth+0.12,y+0.004,0);
        }
      }
    }

    // Intersection-derived zebra crossings. These are intentionally inferred from
    // the connected road graph rather than claimed as authoritative crossing data.
    for(const node of junctions.values()){
      if(node.incidents.length<3)continue;
      const unique=[];
      for(const inc of node.incidents){
        if(unique.some(function(other){return Math.abs(inc.dx*other.dx+inc.dz*other.dz)>0.94;}))continue;
        unique.push(inc);
      }
      for(const inc of unique.slice(0,4)){
        const shift=Math.max(0.22,inc.width*0.72);
        const cx=node.x+inc.dx*shift,cz=node.z+inc.dz*shift;
        const nx=-inc.dz,nz=inc.dx;
        const half=inc.width*0.5+0.05;
        for(let stripe=-2;stripe<=2;stripe++){
          const along=stripe*0.065;
          const sx=cx+inc.dx*along,sz=cz+inc.dz*along;
          const ax=sx+nx*half,az=sz+nz*half;
          const bx=sx-nx*half,bz=sz-nz*half;
          stripeQuad(crosswalkVerts,ax,az,bx,bz,0.028,y+0.016,0);
        }
      }
    }

    const addBatch=function(verts,mat,order,kind,offset){
      if(!verts.length)return;
      const g=new THREE.BufferGeometry();
      g.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
      g.computeBoundingSphere();
      const m=new THREE.Mesh(g,mat);
      m.frustumCulled=true;
      m.renderOrder=order;
      m.userData.jcRoadSurface=true;
      m.userData.jcStreetFeature=kind||"road-detail";
      m.userData.jcRoadSurfaceOffset=offset==null?(order>=4?0.12:0.08):offset;
      group.add(m);
    };
    addBatch(centerVerts,roadMats.center,4,"center-line",0.12);
    addBatch(laneVerts,roadMats.lane,4,"lane-line",0.12);
    addBatch(edgeVerts,roadMats.edge,4,"edge-line",0.12);
    addBatch(sidewalkVerts,roadMats.sidewalk,3,"sidewalk",0.105);
    addBatch(curbVerts,roadMats.curb,4,"curb",0.115);
    addBatch(accessVerts,roadMats.access,3,"mapped-service-access",0.095);
    addBatch(crosswalkVerts,roadMats.crosswalk,5,"inferred-crosswalk",0.125);

    group.userData.streetFeatureCounts={
      sidewalks:Math.floor(sidewalkVerts.length/18),
      curbs:Math.floor(curbVerts.length/18),
      mappedServiceAccess:Math.floor(accessVerts.length/18),
      inferredCrosswalkStripes:Math.floor(crosswalkVerts.length/18)
    };
  }

  return group;
}

const roadSurfaceRaycaster=new THREE.Raycaster();
const roadSurfaceDown=new THREE.Vector3(0,-1,0);
const roadSurfaceProbe=new THREE.Vector3();

function collectTileGroundMeshes(tileItem){
  if(Array.isArray(tileItem?.groundSurfaceMeshes))return tileItem.groundSurfaceMeshes;
  const ground=[];
  if(!tileItem?.root)return ground;
  tileItem.root.updateMatrixWorld(true);
  tileItem.root.traverse(function(o){
    if(!o.isMesh||!o.geometry)return;
    const box=new THREE.Box3().setFromObject(o);
    if(box.isEmpty())return;
    const size=new THREE.Vector3();
    box.getSize(size);
    if(isWallpaperGroundMesh(o,size,box))ground.push(o);
  });
  if(ground.length)return ground;

  // Last-resort fallback for source GLBs with anonymous mesh names: only accept
  // low, broad geometry near the tile base so building roofs can never become roads.
  tileItem.root.traverse(function(o){
    if(!o.isMesh||!o.geometry)return;
    const box=new THREE.Box3().setFromObject(o);
    if(box.isEmpty())return;
    const size=new THREE.Vector3();
    box.getSize(size);
    const footprint=size.x*size.z;
    if(box.min.y<=TILE_GROUND_Y+0.75&&size.y<=8&&footprint>=120)ground.push(o);
  });
  tileItem.groundSurfaceMeshes=ground;
  return ground;
}

const actorSurfaceRaycaster=new THREE.Raycaster();
const actorSurfaceDown=new THREE.Vector3(0,-1,0);
const actorSurfaceOrigin=new THREE.Vector3();

function samplePlayableSurfaceY(x,z){
  const cell=worldCell(x,z);
  const key=tileKey(cell.col,cell.row);
  const roadItem=loadedRoadTiles.get(key);

  if(roadItem?.root){
    if(!Array.isArray(roadItem.actorSurfaceMeshes)){
      roadItem.actorSurfaceMeshes=[];
      roadItem.root.traverse(function(o){
        if(o.isMesh&&o.geometry&&o.userData?.jcRoadSurface&&o.renderOrder===2){
          roadItem.actorSurfaceMeshes.push(o);
        }
      });
    }
    roadItem.root.updateMatrixWorld(true);
    actorSurfaceOrigin.set(x,5000,z);
    actorSurfaceRaycaster.set(actorSurfaceOrigin,actorSurfaceDown);
    actorSurfaceRaycaster.near=0;
    actorSurfaceRaycaster.far=10000;
    const roadHits=actorSurfaceRaycaster.intersectObjects(roadItem.actorSurfaceMeshes,false);
    if(roadHits.length&&Number.isFinite(roadHits[0].point.y))return roadHits[0].point.y;
  }

  const tileItem=loadedTiles.get(key);
  if(tileItem?.root){
    const groundMeshes=collectTileGroundMeshes(tileItem);
    if(groundMeshes.length){
      tileItem.root.updateMatrixWorld(true);
      actorSurfaceOrigin.set(x,5000,z);
      actorSurfaceRaycaster.set(actorSurfaceOrigin,actorSurfaceDown);
      actorSurfaceRaycaster.near=0;
      actorSurfaceRaycaster.far=10000;
      const groundHits=actorSurfaceRaycaster.intersectObjects(groundMeshes,false);
      if(groundHits.length&&Number.isFinite(groundHits[0].point.y))return groundHits[0].point.y;
    }
  }

  return GROUND_Y;
}

function conformRoadTileToGlb(key){
  const roadItem=loadedRoadTiles.get(key);
  const tileItem=loadedTiles.get(key);
  if(!roadItem?.root||!tileItem?.root)return false;

  const groundMeshes=collectTileGroundMeshes(tileItem);
  if(!groundMeshes.length){
    roadItem.surfaceConform={status:"NO_GROUND_MESH",hits:0,total:0};
    return false;
  }

  tileItem.root.updateMatrixWorld(true);
  roadItem.root.updateMatrixWorld(true);
  const tileBox=new THREE.Box3().setFromObject(tileItem.root);
  const probeY=(Number.isFinite(tileBox.max.y)?tileBox.max.y:TILE_GROUND_Y)+30;
  const probeFar=Math.max(80,probeY-(Number.isFinite(tileBox.min.y)?tileBox.min.y:TILE_GROUND_Y)+60);
  const cache=new Map();
  let hits=0,total=0;

  roadItem.root.traverse(function(o){
    const position=o.isMesh&&o.geometry?.attributes?.position;
    if(!position||!o.userData?.jcRoadSurface)return;
    const offset=Number(o.userData.jcRoadSurfaceOffset)||0.08;

    for(let i=0;i<position.count;i++){
      const lx=position.getX(i),lz=position.getZ(i);
      if(!Number.isFinite(lx)||!Number.isFinite(lz))continue;
      const cacheKey=Math.round(lx*50)+"|"+Math.round(lz*50);
      let surfaceY;
      if(cache.has(cacheKey)){
        surfaceY=cache.get(cacheKey);
      }else{
        roadSurfaceProbe.set(roadItem.root.position.x+lx,probeY,roadItem.root.position.z+lz);
        roadSurfaceRaycaster.set(roadSurfaceProbe,roadSurfaceDown);
        roadSurfaceRaycaster.near=0;
        roadSurfaceRaycaster.far=probeFar;
        const intersections=roadSurfaceRaycaster.intersectObjects(groundMeshes,false);
        surfaceY=intersections.length?intersections[0].point.y:null;
        cache.set(cacheKey,surfaceY);
      }
      total++;
      if(surfaceY===null)continue;
      position.setY(i,(surfaceY-roadItem.root.position.y)+offset);
      hits++;
    }

    if(hits){
      position.needsUpdate=true;
      o.geometry.computeBoundingBox();
      o.geometry.computeBoundingSphere();
    }
  });

  const coverage=total?hits/total:0;
  roadItem.surfaceConform={status:hits?"CONFORMED":"NO_HITS",hits,total,coverage};
  roadItem.root.userData.surfaceConform=roadItem.surfaceConform;
  return hits>0;
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
    const item={root:root,rec:rec,count:(data.roads||[]).length};
    loadedRoadTiles.set(key,item);
    conformRoadTileToGlb(key);
    freezeStaticRoot(root);
    if(DATA_BUFFERING)item.root.visible=recordWithinActiveWindow(rec,activeRenderCells());
    bufferState.roadsLoaded=loadedRoadTiles.size;
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
async function preloadAllRoadTiles(){
  if(!roadRuntimeReady)return;
  if(massTileMode){
    await prefetchRollingWindow();
    return;
  }
  const playableKeys=new Set(manifest.map(function(t){return tileKey(t.col,t.row);}));
  const wanted=roadManifest.filter(function(t){
    return playableKeys.has(tileKey(t.col,t.row));
  });
  bufferState.roadsTotal=wanted.length;

  for(let i=0;i<wanted.length;i+=RAW_PREFETCH_CONCURRENCY){
    await Promise.all(wanted.slice(i,i+RAW_PREFETCH_CONCURRENCY).map(prefetchRawRoad));
    bufferState.roadsLoaded=rawBufferedRoads.size;
    updateHud();
    await yieldToBrowser();
  }
}
async function streamRoadTiles(force){
  if(FULL_MAP_MODE){
    if(force&&loadedRoadTiles.size===0)await preloadInitialRoadTiles();
    return;
  }
  if(!roadRuntimeReady||player.pos.y>=LOW_DETAIL_ONLY_ALTITUDE)return;
  const plan=streamPlan();
  const radius=player.pos.y<MIXED_DETAIL_ALTITUDE?LOAD_RADIUS+1:LOAD_RADIUS;
  let wanted=roadManifest
    .filter(function(t){return tileNearStreamCorridor(t,plan,radius);})
    .sort(function(a,b){return streamPriority(a,plan)-streamPriority(b,plan);});

  for(let i=0;i<wanted.length;i+=MAX_CONCURRENT){
    await Promise.all(wanted.slice(i,i+MAX_CONCURRENT).map(loadRoadTile));
  }

  const keep=radius+3;
  for(const [key,item] of Array.from(loadedRoadTiles.entries())){
    if(!tileNearStreamCorridor(item.rec,plan,keep))unloadRoadTile(key,item);
  }
}
function updateRoadLod(){
  const y=player.pos.y;
  roadTileGroup.visible=FULL_MAP_MODE||y<LOW_DETAIL_ONLY_ALTITUDE;
  majorRoadGroup.visible=majorRoadReady&&(DATA_BUFFERING||y>=FULL_DETAIL_ALTITUDE);
  const overviewOpacity=y>=LOW_DETAIL_ONLY_ALTITUDE?0.95:
    THREE.MathUtils.lerp(0.2,0.82,THREE.MathUtils.smoothstep(y,FULL_DETAIL_ALTITUDE,LOW_DETAIL_ONLY_ALTITUDE));
  roadMats.majorOverview.opacity=overviewOpacity;
}


let manifest=[];
let manifestByKey=new Map();
const loadedTiles=new Map();
const loadingTiles=new Set();
const failedTiles=new Set();
const tileColliders=new Map();
let streamBusy=false;
let lastStreamCell="";
let manifestVersion="";
let aiAssetManifest=null;
let aiAssetById=new Map();
const bufferState={
  active:false,
  complete:false,
  total:0,
  loaded:0,
  roadsTotal:0,
  roadsLoaded:0
};
let visibilityClock=0;
let perfClock=0;
let perfFrames=0;
let fpsEstimate=60;
const rawBufferedTiles=new Set();
const rawBufferedRoads=new Set();
let activeDecodeBusy=false;
let massTileMode=false;
let rollingPrefetchBusy=false;

function tileKey(col,row){
  return "C"+String(col).padStart(2,"0")+"_R"+String(row).padStart(2,"0");
}
function tileWorldPosition(col,row){
  return new THREE.Vector3((col-ORIGIN_COL)*TILE_WORLD_SIZE,TILE_GROUND_Y,-(row-ORIGIN_ROW)*TILE_WORLD_SIZE);
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
  massTileMode=manifest.length>=MASS_TILE_THRESHOLD;
  manifestVersion=data.generatedAt||String(manifest.length);
  if(!manifest.length)throw new Error("No C##_R## GLB tiles found in manifest");
  return data;
}
async function loadAIAssetFactoryManifest(){
  try{
    const res=await fetch("./ai-asset-factory/runtime/asset-manifest.json?ts="+Date.now(),{cache:"no-store"});
    if(!res.ok)throw new Error("asset-manifest HTTP "+res.status);
    const data=await res.json();
    aiAssetManifest=data;
    aiAssetById=new Map((data.assets||[]).map(function(asset){return [asset.id,asset];}));
    return data;
  }catch(err){
    console.warn("AI Asset Factory manifest unavailable",err);
    aiAssetManifest={version:0,assets:[]};
    aiAssetById=new Map();
    return aiAssetManifest;
  }
}
function getAIAsset(id){
  return aiAssetById.get(id)||null;
}
function listAIAssets(type){
  const assets=(aiAssetManifest&&aiAssetManifest.assets)||[];
  return type?assets.filter(function(a){return a.asset_type===type;}):assets.slice();
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
    root.position.y+=TILE_GROUND_Y-scaledBox.min.y;

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

  const fastFallback=player.speed>=HIGH_SPEED_STREAM_THRESHOLD||loadingTiles.size>0;

  if(FULL_MAP_MODE&&DATA_BUFFERING){
    mapGroup.visible=true;
    worldLodGroup.visible=worldLodReady;
    if(worldLodReady){
      const opacity=player.pos.y<600?0.20:
        THREE.MathUtils.lerp(0.24,0.78,THREE.MathUtils.smoothstep(player.pos.y,600,LOW_DETAIL_ONLY_ALTITUDE));
      setLodOpacity(opacity);
    }
    return;
  }

  if(FULL_MAP_MODE){
    mapGroup.visible=true;
    worldLodGroup.visible=false;
    return;
  }

  if(y<FULL_DETAIL_ALTITUDE&&!fastFallback){
    worldLodGroup.visible=false;
    mapGroup.visible=true;
    return;
  }

  worldLodGroup.visible=true;
  if(y<FULL_DETAIL_ALTITUDE&&fastFallback){
    mapGroup.visible=true;
    setLodOpacity(player.speed>=VERY_HIGH_SPEED_STREAM_THRESHOLD?0.82:0.48);
    return;
  }

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

function buildTileColliders(root,rec){
  root.updateMatrixWorld(true);
  const candidates=[];
  root.traverse(function(o){
    if(!o.isMesh||!o.visible)return;
    const box=new THREE.Box3().setFromObject(o);
    if(box.isEmpty())return;
    const size=new THREE.Vector3();
    box.getSize(size);
    if(![size.x,size.y,size.z].every(Number.isFinite))return;

    // Ignore terrain skins, decals, poles, and tiny detail. Keep structural volumes.
    if(size.y<1.25)return;
    if(size.x<0.7||size.z<0.7)return;
    if(size.x>240&&size.z>240&&size.y<8)return;

    const volume=size.x*size.y*size.z;
    candidates.push({box:box.clone(),volume:volume});
  });

  candidates.sort(function(a,b){return b.volume-a.volume;});
  const boxes=candidates.slice(0,MAX_COLLIDERS_PER_TILE).map(function(x){
    const box=x.box;
    box.userData={tileKey:tileKey(rec.col,rec.row),destroyed:false,damage:0};
    return box;
  });
  tileColliders.set(tileKey(rec.col,rec.row),{rec:rec,boxes:boxes});
  return boxes.length;
}
function nearbyCollisionBoxes(){
  if(player.pos.y>=LOW_DETAIL_ONLY_ALTITUDE)return [];
  const cell=worldCell(player.pos.x,player.pos.z);
  const out=[];
  for(let dc=-COLLISION_TILE_RADIUS;dc<=COLLISION_TILE_RADIUS;dc++){
    for(let dr=-COLLISION_TILE_RADIUS;dr<=COLLISION_TILE_RADIUS;dr++){
      const item=tileColliders.get(tileKey(cell.col+dc,cell.row+dr));
      if(!item)continue;
      for(const box of item.boxes)out.push(box);
    }
  }
  return out;
}
function horizontalOverlap(x,z,box,pad){
  if(box.userData&&box.userData.destroyed)return false;
  return x>=box.min.x-pad&&x<=box.max.x+pad&&z>=box.min.z-pad&&z<=box.max.z+pad;
}
function verticalBodyOverlap(y,box){
  const eps=0.06;
  return y<box.max.y-eps&&(y+PLAYER_HEIGHT)>box.min.y+eps;
}
const BREAKTHROUGH_SPEED=72;
let lastBreakthroughFx=0;
function canBreakThroughBuilding(){
  return player.flying&&player.speed>=BREAKTHROUGH_SPEED;
}
const breakthroughScars=[];
const obliteratedStructures=[];
function buildingShellsForBox(box){
  const matches=[];
  for(const item of loadedTiles.values()){
    if(!item.wallpaperGroup)continue;
    item.wallpaperGroup.traverse(function(o){
      if(!o.isMesh||!o.userData?.wallpaper)return;
      const wb=new THREE.Box3().setFromObject(o);
      if(wb.intersectsBox(box))matches.push(o);
    });
  }
  return matches;
}
function obliterateStructure(box,impact,strength){
  if(!box||box.userData?.destroyed)return;
  box.userData=box.userData||{};
  box.userData.damage=(box.userData.damage||0)+Math.max(.35,strength+.35);
  if(box.userData.damage<1.05)return;
  box.userData.destroyed=true;
  const affectedShells=buildingShellsForBox(box);
  for(const shell of affectedShells){
    shell.userData.preObliterationVisible=shell.visible;
    shell.visible=false;
  }
  box.userData.affectedShells=affectedShells;
  const size=new THREE.Vector3(),center=new THREE.Vector3();
  box.getSize(size); box.getCenter(center);
  const marker=new THREE.Group();
  marker.name="OBLITERATED_STRUCTURE";
  marker.userData.sourceBox=box;
  scene.add(marker);
  const count=Math.min(lowSpec?18:42,Math.max(12,Math.round((size.x+size.y+size.z)*.18)));
  for(let i=0;i<count;i++){
    const shard=new THREE.Mesh(
      new THREE.BoxGeometry(.25+Math.random()*1.2,.18+Math.random()*1.4,.25+Math.random()*1.2),
      new THREE.MeshStandardMaterial({color:Math.random()>.45?0x332a2b:0x6a5144,roughness:.85})
    );
    shard.position.set(
      center.x+(Math.random()-.5)*Math.min(size.x,12),
      THREE.MathUtils.clamp(impact.y+(Math.random()-.5)*5,box.min.y+.2,box.max.y),
      center.z+(Math.random()-.5)*Math.min(size.z,12)
    );
    marker.add(shard);
    const away=shard.position.clone().sub(impact).normalize().multiplyScalar(8+Math.random()*18+strength*24);
    transientFx.push({obj:shard,life:1.2+Math.random()*1.4,maxLife:2.6,v:away});
  }
  const smoke=new THREE.Mesh(new THREE.SphereGeometry(2.5+strength*4,10,7),new THREE.MeshBasicMaterial({color:0x211b1c,transparent:true,opacity:.55,depthWrite:false}));
  smoke.position.copy(impact); marker.add(smoke);
  addPowerFx(smoke,1.8,function(f,dt){f.obj.scale.multiplyScalar(1+dt*1.6);f.obj.position.y+=dt*4;if(f.obj.material)f.obj.material.opacity=Math.max(0,.55*f.life/f.maxLife);});
  obliteratedStructures.push({box:box,marker:marker});
  cityState.chaos=Math.min(100,cityState.chaos+1.5);
}

function addBreakthroughScar(box,axis,impact,strength){
  if(!box||breakthroughScars.length>=180)return;
  const radius=0.72+strength*0.72;
  const ring=new THREE.Mesh(
    new THREE.RingGeometry(radius*0.62,radius,18),
    new THREE.MeshBasicMaterial({color:0x120a08,transparent:true,opacity:0.9,side:THREE.DoubleSide,depthWrite:false})
  );
  ring.position.copy(impact);
  if(axis==="x"){
    ring.rotation.y=Math.PI/2;
    ring.position.x=player.velocity.x>=0?box.min.x-0.025:box.max.x+0.025;
  }else{
    ring.position.z=player.velocity.z>=0?box.min.z-0.025:box.max.z+0.025;
  }
  scene.add(ring);
  breakthroughScars.push(ring);
}
// --- Living Sin City morality / soul simulation --------------------------------
const cityState={corruption:35,redemption:15,chaos:20,restoration:10};
function ensureSoulState(npc){
  npc.userData=npc.userData||{};
  const u=npc.userData;
  if(!u.soulState)u.soulState="FREE";
  if(!u.worship)u.worship="NONE";
  if(!u.influence)u.influence="NONE";
  if(!u.possession)u.possession="NONE";
  if(u.influenceStrength==null)u.influenceStrength=0;
  return u;
}
function setNpcInfluence(npc,source,strength){
  const u=ensureSoulState(npc);
  u.influence=source;
  u.influenceStrength=THREE.MathUtils.clamp(strength,0,100);
  u.influencedBy=source;
}
function possessNpc(npc,source){
  const u=ensureSoulState(npc);
  u.possession=source;
  u.aiBeforePossession=u.aiIntent||"normal";
  u.aiIntent=source==="SATAN"?"possessed_infernal":"protected_holy";
  if(source==="SATAN")cityState.corruption=Math.min(100,cityState.corruption+1.5);
}
function setNpcWorship(npc,target){
  const u=ensureSoulState(npc);
  u.worship=target; // persistent allegiance; deliberately separate from influence/possession
}
function takeSoul(npc){
  const u=ensureSoulState(npc);
  u.soulState="TAKEN";
  u.soulTakenBy="SATAN";
  u.aiIntent="soul_taken";
  cityState.corruption=Math.min(100,cityState.corruption+2);
  cityState.chaos=Math.min(100,cityState.chaos+1);
}
function expelDemonSpirit(npc){
  if(!npc||!npc.position)return;
  const u=ensureSoulState(npc);
  if(u.possession!=="SATAN"&&u.soulState!=="TAKEN")return;
  const spirit=new THREE.Mesh(
    new THREE.SphereGeometry(0.45,8,6),
    new THREE.MeshBasicMaterial({color:0x050007,transparent:true,opacity:.88})
  );
  spirit.scale.set(.75,1.8,.75);
  spirit.position.copy(npc.position).add(new THREE.Vector3(0,1.3,0));
  scene.add(spirit);
  addPowerFx(spirit,1.35,function(f,dt){
    f.obj.position.y+=dt*5.5;
    f.obj.scale.multiplyScalar(1+dt*1.3);
    if(f.obj.material)f.obj.material.opacity=Math.max(0,f.life/f.maxLife);
  });
  orbBurst(0xfff0a0,30,7,1.1,npc.position.clone().add(new THREE.Vector3(0,1,0)));
  u.possession="NONE";
  u.soulState="FREE";
  u.soulTakenBy=null;
  u.aiIntent=u.aiBeforePossession||"normal";
  u.fear=Math.max(0,(u.fear||20)-55);
  u.hostile=false;
  cityState.redemption=Math.min(100,cityState.redemption+2);
  cityState.corruption=Math.max(0,cityState.corruption-2);
}
function divineLightHit(npc){
  if(!npc)return;
  expelDemonSpirit(npc);
  const u=ensureSoulState(npc);
  u.influence="HOLY";
  u.influenceStrength=Math.max(u.influenceStrength||0,55);
  u.courage=Math.min(100,(u.courage||50)+25);
}
function soulTakerHit(npc){
  if(!npc)return;
  takeSoul(npc);
  possessNpc(npc,"SATAN");
}
function updateLivingSinCity(dt){
  soulWeaponCooldown=Math.max(0,soulWeaponCooldown-dt);
  const corruptionPressure=Math.max(0,cityState.corruption-cityState.redemption);
  cityState.chaos=THREE.MathUtils.clamp(cityState.chaos+(corruptionPressure*.002-cityState.restoration*.0015)*dt,0,100);
  for(const npc of influenceNpcs){
    if(!npc)continue;
    const u=ensureSoulState(npc);
    if(u.influenceStrength>0)u.influenceStrength=Math.max(0,u.influenceStrength-dt*1.25);
    if(u.influenceStrength===0&&u.possession==="NONE")u.influence="NONE";
  }
}
window.JC_SOUL_SYSTEM={register:function(npc){registerInfluenceNpc(npc);ensureSoulState(npc);return npc;},influence:setNpcInfluence,possess:possessNpc,worship:setNpcWorship,soulTakerHit:soulTakerHit,divineLightHit:divineLightHit,redeem:expelDemonSpirit,city:cityState};
const soulWeaponRay=new THREE.Raycaster();
let soulWeaponCooldown=0;
function soulWeaponTarget(){
  soulWeaponRay.set(camera.position,viewForward());
  const meshes=[];
  for(const npc of influenceNpcs){
    if(!npc)continue;
    if(npc.isObject3D)npc.traverse(function(o){if(o.isMesh){o.userData.soulNpcRoot=npc;meshes.push(o);}});
  }
  const hits=soulWeaponRay.intersectObjects(meshes,false);
  if(!hits.length)return null;
  return hits[0].object.userData.soulNpcRoot||null;
}
function fireSoulWeapon(){
  if(soulWeaponCooldown>0)return;
  soulWeaponCooldown=powerState.controller==="JC"?.12:.28;
  const origin=powerOrigin();
  const dir=viewForward();
  const target=soulWeaponTarget();
  const end=target?.position?target.position.clone().add(new THREE.Vector3(0,1,0)):origin.clone().addScaledVector(dir,85);
  const color=powerState.controller==="JC"?0xffe879:0x6a00a8;
  const length=origin.distanceTo(end);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,length,6),new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:.95}));
  beam.position.copy(origin).lerp(end,.5);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.clone().sub(origin).normalize());
  scene.add(beam);
  addPowerFx(beam,.13,function(f){if(f.obj.material)f.obj.material.opacity=Math.max(0,f.life/f.maxLife);});
  orbBurst(color,8,2,.35,origin);
  if(target){
    if(powerState.controller==="JC")divineLightHit(target);
    else soulTakerHit(target);
  }
}
window.JC_FIRE_SOUL_WEAPON=fireSoulWeapon;
window.JC_BUILDING_FX={
  attach:function(shell,effect){
    if(!shell||!shell.userData||!shell.userData.fxAnchor||!effect)return false;
    shell.userData.fxAnchor.add(effect);
    effect.position.set(0,0,0);
    return true;
  },
  anchors:function(){
    const out=[];
    mapGroup.traverse(function(o){if(o.name&&o.name.indexOf("BUILDING_FX_ANCHOR_")===0)out.push(o);});
    return out;
  }
};

const influenceNpcs=[];
function registerInfluenceNpc(npc){
  if(npc&&!influenceNpcs.includes(npc))influenceNpcs.push(npc);
  if(npc)ensureSoulState(npc);
  return npc;
}
function influenceNearbyNpcs(){
  const controller=powerState.controller;
  const origin=player.pos;
  let affected=0;
  for(const npc of influenceNpcs){
    if(!npc||!npc.position)continue;
    const d=npc.position.distanceTo(origin);
    if(d>55)continue;
    npc.userData=npc.userData||{};
    const falloff=1-THREE.MathUtils.clamp(d/55,0,1);
    if(controller==="JC"){
      setNpcInfluence(npc,"JC",Math.round(falloff*100));
      npc.userData.courage=Math.min(100,(npc.userData.courage||50)+35*falloff);
      npc.userData.fear=Math.max(0,(npc.userData.fear||20)-45*falloff);
      npc.userData.hostile=false;
      npc.userData.aiIntent="protect_help_reconcile";
    }else{
      setNpcInfluence(npc,"SATAN",Math.round(falloff*100));
      npc.userData.fear=Math.min(100,(npc.userData.fear||20)+55*falloff);
      npc.userData.courage=Math.max(0,(npc.userData.courage||50)-30*falloff);
      npc.userData.aiIntent="fear_temptation_chaos";
    }
    npc.userData.influencedBy=controller;
    affected++;
  }
  powerState.lastAbility=controller+" INFLUENCE · "+affected+" NPC";
  const color=controller==="JC"?0xfff2a8:0x8b20ff;
  radialRingAt(powerOrigin(),color,28,1.4);
  orbBurst(color,36,14,1.5,powerOrigin());
  shakePower(0.12);
}
window.JC_REGISTER_AI_NPC=registerInfluenceNpc;
function restoreHolyDamage(){
  if(powerState.controller!=="JC")return;
  for(const scar of breakthroughScars){
    if(scar&&scar.parent)scar.parent.remove(scar);
    if(scar?.geometry)scar.geometry.dispose();
    if(scar?.material)scar.material.dispose();
  }
  breakthroughScars.length=0;
  for(const damaged of obliteratedStructures){
    if(damaged.box&&damaged.box.userData){
      damaged.box.userData.destroyed=false;
      damaged.box.userData.damage=0;
      for(const shell of (damaged.box.userData.affectedShells||[])){
        if(shell) shell.visible=shell.userData.preObliterationVisible!==false;
      }
      damaged.box.userData.affectedShells=[];
    }
    if(damaged.marker&&damaged.marker.parent)damaged.marker.parent.remove(damaged.marker);
  }
  obliteratedStructures.length=0;
  cityState.restoration=Math.min(100,cityState.restoration+8);
  cityState.chaos=Math.max(0,cityState.chaos-8);
  powerState.health=100;
  powerState.divine=100;
  powerState.resurrectionReady=true;
  powerState.lastAbility="HOLY RESTORATION";
  const center=powerOrigin();
  radialRingAt(center,0xffffff,18,1.35);
  radialRingAt(center,0xffe783,11,0.9);
  orbBurst(0xffffff,72,22,2.1,center);
  verticalBeamAt(center,0xfff4c2,34,1.5);
  flashPower("#fff8d6",0.72);
  shakePower(0.28);
}
function breakthroughImpact(box,axis){
  const now=performance.now();
  if(now-lastBreakthroughFx<70)return;
  lastBreakthroughFx=now;
  const impact=player.pos.clone().add(new THREE.Vector3(0,PLAYER_HEIGHT*0.55,0));
  const strength=THREE.MathUtils.clamp((player.speed-BREAKTHROUGH_SPEED)/260,0,1);
  addBreakthroughScar(box,axis,impact,strength);
  obliterateStructure(box,impact,strength);
  radialRingAt(impact,0xffd75e,3.5+strength*8,0.35+strength*0.35);
  orbBurst(0xffb45a,10+Math.round(strength*18),2.5+strength*5,0.45+strength*0.3,impact);
  shakePower(0.18+strength*0.5);
  if(box){
    const debrisCount=6+Math.round(strength*10);
    for(let i=0;i<debrisCount;i++){
      const g=new THREE.BoxGeometry(0.12+Math.random()*0.32,0.12+Math.random()*0.32,0.08+Math.random()*0.25);
      const m=new THREE.MeshBasicMaterial({color:Math.random()>0.5?0x8b6b55:0x55515a});
      const shard=new THREE.Mesh(g,m);
      shard.position.copy(impact);
      scene.add(shard);
      const outward=new THREE.Vector3((Math.random()-.5)*2,Math.random()*1.5,(Math.random()-.5)*2).normalize();
      if(axis==="x")outward.x+=Math.sign(player.velocity.x||1)*1.6;
      if(axis==="z")outward.z+=Math.sign(player.velocity.z||1)*1.6;
      transientFx.push({obj:shard,life:0.45+Math.random()*0.55,maxLife:1,v:outward.multiplyScalar(6+strength*14)});
    }
  }
}
function movePlayerSolid(delta){
  const boxes=nearbyCollisionBoxes();
  if(!boxes.length){
    player.pos.add(delta);
    const surfaceY=samplePlayableSurfaceY(player.pos.x,player.pos.z);
    if(player.pos.y<=surfaceY+0.04){
      player.pos.y=surfaceY+0.04;
      if(player.velocity.y<0)player.velocity.y=0;
      player.grounded=true;
    }else player.grounded=false;
    return;
  }

  const p=player.pos;
  player.grounded=false;

  // X sweep/slide.
  if(delta.x!==0){
    let target=p.x+delta.x;
    for(const box of boxes){
      if(!verticalBodyOverlap(p.y,box))continue;
      if(p.z<box.min.z-PLAYER_RADIUS||p.z>box.max.z+PLAYER_RADIUS)continue;
      const min=box.min.x-PLAYER_RADIUS,max=box.max.x+PLAYER_RADIUS;
      if(delta.x>0&&p.x<=min&&target>min){if(canBreakThroughBuilding()){breakthroughImpact(box,"x");continue;}target=Math.min(target,min);}
      else if(delta.x<0&&p.x>=max&&target<max){if(canBreakThroughBuilding()){breakthroughImpact(box,"x");continue;}target=Math.max(target,max);}
      else if(target>min&&target<max){
        target=Math.abs(target-min)<Math.abs(max-target)?min:max;
      }
    }
    p.x=target;
  }

  // Z sweep/slide.
  if(delta.z!==0){
    let target=p.z+delta.z;
    for(const box of boxes){
      if(!verticalBodyOverlap(p.y,box))continue;
      if(p.x<box.min.x-PLAYER_RADIUS||p.x>box.max.x+PLAYER_RADIUS)continue;
      const min=box.min.z-PLAYER_RADIUS,max=box.max.z+PLAYER_RADIUS;
      if(delta.z>0&&p.z<=min&&target>min){if(canBreakThroughBuilding()){breakthroughImpact(box,"z");continue;}target=Math.min(target,min);}
      else if(delta.z<0&&p.z>=max&&target<max){if(canBreakThroughBuilding()){breakthroughImpact(box,"z");continue;}target=Math.max(target,max);}
      else if(target>min&&target<max){
        target=Math.abs(target-min)<Math.abs(max-target)?min:max;
      }
    }
    p.z=target;
  }

  // Vertical sweep: land on roofs/floors and stop against undersides.
  let targetY=p.y+delta.y;
  for(const box of boxes){
    if(!horizontalOverlap(p.x,p.z,box,PLAYER_RADIUS*0.72))continue;
    const top=box.max.y;
    const bottom=box.min.y;

    if(delta.y<=0&&p.y>=top-0.04&&targetY<top){
      targetY=Math.max(targetY,top);
      player.velocity.y=0;
      player.grounded=true;
    }else if(delta.y>0&&(p.y+PLAYER_HEIGHT)<=bottom+0.04&&(targetY+PLAYER_HEIGHT)>bottom){
      targetY=Math.min(targetY,bottom-PLAYER_HEIGHT);
      player.velocity.y=0;
    }
  }

  const surfaceY=samplePlayableSurfaceY(p.x,p.z)+0.04;
  if(targetY<=surfaceY){
    targetY=surfaceY;
    if(player.velocity.y<0)player.velocity.y=0;
    player.grounded=true;
  }
  p.y=targetY;
}
function collisionCount(){
  let n=0;
  for(const item of tileColliders.values())n+=item.boxes.length;
  return n;
}

function activeRenderCells(){
  const current=worldCell(player.pos.x,player.pos.z);
  const speed=Math.hypot(player.velocity.x,player.velocity.z);
  const radius=speed>=HIGH_SPEED_STREAM_THRESHOLD?FAST_ACTIVE_TILE_RADIUS:ACTIVE_TILE_RADIUS;
  const dir=new THREE.Vector2(player.velocity.x,player.velocity.z);
  if(dir.lengthSq()<0.0001)dir.set(-Math.sin(camYaw),-Math.cos(camYaw));
  else dir.normalize();

  const cells=[current];
  const ahead=speed>=HIGH_SPEED_STREAM_THRESHOLD?ACTIVE_LOOKAHEAD_TILES:1;
  for(let i=1;i<=ahead;i++){
    cells.push(worldCell(
      player.pos.x+dir.x*i*TILE_WORLD_SIZE,
      player.pos.z+dir.y*i*TILE_WORLD_SIZE
    ));
  }
  return {cells:cells,radius:radius};
}
function recordWithinActiveWindow(rec,info){
  for(const c of info.cells){
    if(Math.abs(rec.col-c.col)<=info.radius&&Math.abs(rec.row-c.row)<=info.radius)return true;
  }
  return false;
}
function recordsInWindow(index,info,extraRadius){
  const radius=info.radius+(extraRadius||0);
  const out=[];
  const seen=new Set();
  for(const c of info.cells){
    for(let dc=-radius;dc<=radius;dc++){
      for(let dr=-radius;dr<=radius;dr++){
        const key=tileKey(c.col+dc,c.row+dr);
        if(seen.has(key))continue;
        seen.add(key);
        const rec=index.get(key);
        if(rec)out.push(rec);
      }
    }
  }
  return out;
}
function recordsAroundCell(index,cell,radius){
  return recordsInWindow(index,{cells:[cell],radius:radius||0},0);
}
function setTileVisualState(item,visible){
  if(!item)return;
  item.root.visible=visible;
  if(item.wallpaperGroup)item.wallpaperGroup.visible=visible;
  if(item.residentialGroup)item.residentialGroup.visible=visible;
}
function updateBufferedVisibility(force){
  if(!DATA_BUFFERING)return;
  const info=activeRenderCells();
  for(const item of loadedTiles.values()){
    setTileVisualState(item,recordWithinActiveWindow(item.rec,info));
  }
  for(const item of loadedRoadTiles.values()){
    item.root.visible=recordWithinActiveWindow(item.rec,info);
  }
}
function freezeStaticRoot(root){
  root.updateMatrixWorld(true);
  root.traverse(function(o){
    if(o===root)return;
    if(o.matrixAutoUpdate){
      o.updateMatrix();
      o.matrixAutoUpdate=false;
    }
  });
  root.updateMatrix();
  root.matrixAutoUpdate=false;
}
function updateAdaptiveResolution(dt){
  perfClock+=dt;
  perfFrames++;
  if(perfClock<1)return;
  fpsEstimate=perfFrames/perfClock;
  perfClock=0;
  perfFrames=0;

  let target=dynamicPixelRatio;
  if(fpsEstimate<28)target=Math.max(0.50,dynamicPixelRatio-0.16);
  else if(fpsEstimate<42)target=Math.max(0.58,dynamicPixelRatio-0.10);
  else if(fpsEstimate>57)target=Math.min(Math.min(devicePixelRatio,MAX_RENDER_PIXEL_RATIO),dynamicPixelRatio+0.04);

  if(Math.abs(target-dynamicPixelRatio)>=0.045){
    dynamicPixelRatio=target;
    renderer.setPixelRatio(dynamicPixelRatio);
    renderer.setSize(innerWidth,innerHeight,false);
  }
}
function yieldToBrowser(){
  return new Promise(function(resolve){
    if("requestIdleCallback" in window)requestIdleCallback(function(){resolve();},{timeout:35});
    else setTimeout(resolve,0);
  });
}

async function prefetchRawTile(rec){
  const key=tileKey(rec.col,rec.row);
  if(rawBufferedTiles.has(key)||loadedTiles.has(key))return;
  try{
    const version=rec.sha?("?v="+rec.sha.slice(0,10)):"";
    const res=await fetch(rec.url+version,{cache:"force-cache",priority:"low"});
    if(res.ok)await res.arrayBuffer();
    rawBufferedTiles.add(key);
  }catch(err){
    console.warn("GLB prefetch skipped",key,err);
  }
}
async function prefetchRawRoad(rec){
  const key=tileKey(rec.col,rec.row);
  if(rawBufferedRoads.has(key)||loadedRoadTiles.has(key))return;
  try{
    const res=await fetch("./jc-map/roads/"+rec.file.replace(/^\.\//,""),{cache:"force-cache",priority:"low"});
    if(res.ok)await res.arrayBuffer();
    rawBufferedRoads.add(key);
  }catch(err){
    console.warn("Road prefetch skipped",key,err);
  }
}
async function prefetchRollingWindow(){
  if(!massTileMode||rollingPrefetchBusy)return;
  rollingPrefetchBusy=true;
  try{
    const info=activeRenderCells();
    const tiles=recordsInWindow(manifestByKey,info,MASS_PREFETCH_EXTRA_RADIUS)
      .filter(function(rec){
        const key=tileKey(rec.col,rec.row);
        return !rawBufferedTiles.has(key)&&!loadedTiles.has(key);
      });
    const roads=recordsInWindow(roadManifestByKey,info,MASS_PREFETCH_EXTRA_RADIUS)
      .filter(function(rec){
        const key=tileKey(rec.col,rec.row);
        return !rawBufferedRoads.has(key)&&!loadedRoadTiles.has(key);
      });

    let ti=0,ri=0;
    while(ti<tiles.length||ri<roads.length){
      const jobs=[];
      while(ti<tiles.length&&jobs.length<MASS_PREFETCH_BATCH)jobs.push(prefetchRawTile(tiles[ti++]));
      while(ri<roads.length&&jobs.length<MASS_PREFETCH_BATCH)jobs.push(prefetchRawRoad(roads[ri++]));
      if(jobs.length)await Promise.all(jobs);
      await yieldToBrowser();
      if(fpsEstimate<32)break;
    }
  }finally{
    rollingPrefetchBusy=false;
  }
}
function expandedActiveInfo(extra){
  const info=activeRenderCells();
  return {cells:info.cells,radius:info.radius+(extra||0)};
}
function pruneDecodedScene(){
  const keep=expandedActiveInfo(DECODE_KEEP_EXTRA);

  for(const [key,item] of Array.from(loadedTiles.entries())){
    if(recordWithinActiveWindow(item.rec,keep))continue;
    if(item.wallpaperGroup)disposeWallpaperGroup(item.wallpaperGroup);
    if(item.residentialGroup)disposeResidentialWallpaperGroup(item.residentialGroup);
    mapGroup.remove(item.root);
    disposeTile(item.root);
    loadedTiles.delete(key);
    tileColliders.delete(key);
  }

  for(const [key,item] of Array.from(loadedRoadTiles.entries())){
    if(recordWithinActiveWindow(item.rec,keep))continue;
    unloadRoadTile(key,item);
  }
}
async function ensureActiveWindowDecoded(){
  if(activeDecodeBusy)return;
  activeDecodeBusy=true;
  try{
    const info=activeRenderCells();
    const plan=streamPlan();
    const tileWanted=recordsInWindow(manifestByKey,info,0)
      .filter(function(rec){return !loadedTiles.has(tileKey(rec.col,rec.row));})
      .sort(function(a,b){return streamPriority(a,plan)-streamPriority(b,plan);});

    // Decode in tiny batches and re-check player position between batches.
    for(let i=0;i<tileWanted.length;i+=2){
      const currentInfo=activeRenderCells();
      const batch=tileWanted.slice(i,i+2).filter(function(rec){
        return recordWithinActiveWindow(rec,currentInfo);
      });
      if(batch.length)await Promise.all(batch.map(loadOneTile));
      await yieldToBrowser();
      if(fpsEstimate<26)break;
    }

    const roadWanted=recordsInWindow(roadManifestByKey,info,0)
      .filter(function(rec){return !loadedRoadTiles.has(tileKey(rec.col,rec.row));});

    for(let i=0;i<roadWanted.length;i+=2){
      const currentInfo=activeRenderCells();
      const batch=roadWanted.slice(i,i+2).filter(function(rec){
        return recordWithinActiveWindow(rec,currentInfo);
      });
      if(batch.length)await Promise.all(batch.map(loadRoadTile));
      await yieldToBrowser();
      if(fpsEstimate<26)break;
    }

    pruneDecodedScene();
    updateBufferedVisibility(true);
  }finally{
    activeDecodeBusy=false;
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

    // Static world tile: preserve the exported horizontal orientation, but anchor
    // its actual lowest geometry point to the common ground plane.
    root.position.set(0,0,0);
    root.updateMatrixWorld(true);
    const localBounds=new THREE.Box3().setFromObject(root);
    const baseY=Number.isFinite(localBounds.min.y)?localBounds.min.y:0;
    const tilePos=tileWorldPosition(rec.col,rec.row);
    root.position.set(tilePos.x,TILE_GROUND_Y-baseY,tilePos.z);
    root.userData.staticWorldTile=true;
    root.userData.gravityAnchored=true;
    root.userData.groundY=TILE_GROUND_Y;
    root.userData.sourceBaseY=baseY;

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
    root.updateMatrixWorld(true);

    // Final anchor verification: no streamed tile is allowed to float above or
    // sink below the shared ground plane because of source-export Y offsets.
    const groundedBounds=new THREE.Box3().setFromObject(root);
    if(Number.isFinite(groundedBounds.min.y)){
      const correction=TILE_GROUND_Y-groundedBounds.min.y;
      if(Math.abs(correction)>0.002){
        root.position.y+=correction;
        root.updateMatrixWorld(true);
      }
    }

    mapGroup.add(root);
    const wallpaperGroup=buildStripWallpaper(root,rec);
    const residentialGroup=buildResidentialWallpaper(root,rec);
    const colliderCount=buildTileColliders(root,rec);
    const item={
      root:root,
      rec:rec,
      colliderCount:colliderCount,
      wallpaperGroup:wallpaperGroup,
      residentialGroup:residentialGroup
    };
    loadedTiles.set(key,item);
    conformRoadTileToGlb(key);
    SATELLITE_FOOTPRINT_AUDIT.runtimeCounts.tiles=loadedTiles.size;
    SATELLITE_FOOTPRINT_AUDIT.runtimeCounts.models+=colliderCount;
    freezeStaticRoot(root);
    if(wallpaperGroup)freezeStaticRoot(wallpaperGroup);
    if(residentialGroup)freezeStaticRoot(residentialGroup);
    if(DATA_BUFFERING)setTileVisualState(item,recordWithinActiveWindow(rec,activeRenderCells()));
    bufferState.loaded=loadedTiles.size;
  }catch(err){
    console.error("GLB tile load failed",key,err);
    failedTiles.add(key);
  }finally{
    loadingTiles.delete(key);
  }
}
function streamPlan(){
  const current=worldCell(player.pos.x,player.pos.z);
  const speed=Math.hypot(player.velocity.x,player.velocity.z);
  const dir=new THREE.Vector2(player.velocity.x,player.velocity.z);
  if(dir.lengthSq()<0.0001){
    dir.set(-Math.sin(camYaw),-Math.cos(camYaw));
  }else dir.normalize();

  const speedTiles=speed/TILE_WORLD_SIZE;
  const aheadTiles=THREE.MathUtils.clamp(
    Math.ceil(speedTiles*STREAM_LOOKAHEAD_SECONDS),
    0,
    MAX_LOOKAHEAD_TILES
  );

  const cells=[];
  const seen=new Set();
  function addCell(col,row,step){
    const k=tileKey(col,row);
    if(seen.has(k))return;
    seen.add(k);
    cells.push({col:col,row:row,step:step,key:k});
  }

  addCell(current.col,current.row,0);

  // Sample a corridor in the actual direction of travel, not only the destination tile.
  for(let i=1;i<=aheadTiles;i++){
    const wx=player.pos.x+dir.x*i*TILE_WORLD_SIZE;
    const wz=player.pos.z+dir.y*i*TILE_WORLD_SIZE;
    const c=worldCell(wx,wz);
    addCell(c.col,c.row,i);

    // At high speed preload side neighbors too, so turns do not expose empty space.
    if(speed>=HIGH_SPEED_STREAM_THRESHOLD){
      const lateral=i>=3?1:0;
      for(let j=-lateral;j<=lateral;j++){
        if(j===0)continue;
        addCell(c.col+j,c.row,i+0.15);
        addCell(c.col,c.row+j,i+0.15);
      }
    }
  }

  return {current:current,cells:cells,aheadTiles:aheadTiles,speed:speed};
}
function tileNearStreamCorridor(rec,plan,radius){
  for(const c of plan.cells){
    if(Math.abs(rec.col-c.col)<=radius&&Math.abs(rec.row-c.row)<=radius)return true;
  }
  return false;
}
function streamPriority(rec,plan){
  let bestDistance=Infinity;
  let bestStep=0;

  // Match this tile to the closest point in the predicted flight corridor.
  // Then deliberately give FARTHER AHEAD corridor steps higher priority.
  for(const c of plan.cells){
    const distance=Math.abs(rec.col-c.col)+Math.abs(rec.row-c.row);
    if(distance<bestDistance||(distance===bestDistance&&c.step>bestStep)){
      bestDistance=distance;
      bestStep=c.step;
    }
  }

  // Negative step means sorting ascending loads the horizon first,
  // then progressively fills the world backward toward JC.
  return (-bestStep*100)+bestDistance;
}

function initialTileRecords(){
  const spawnCell=worldCell(STRIP_SPAWN.x,STRIP_SPAWN.z);
  return recordsAroundCell(manifestByKey,spawnCell,INITIAL_BUFFER_RADIUS);
}
async function preloadInitialTiles(){
  const wanted=initialTileRecords();
  for(let i=0;i<wanted.length;i+=FULL_MAP_BATCH){
    await Promise.all(wanted.slice(i,i+FULL_MAP_BATCH).map(loadOneTile));
    updateHud();
    await yieldToBrowser();
  }
}
async function preloadInitialRoadTiles(){
  if(!roadRuntimeReady)return;
  const spawnCell=worldCell(STRIP_SPAWN.x,STRIP_SPAWN.z);
  const wanted=recordsAroundCell(roadManifestByKey,spawnCell,INITIAL_BUFFER_RADIUS);
  for(let i=0;i<wanted.length;i+=FULL_MAP_BATCH){
    await Promise.all(wanted.slice(i,i+FULL_MAP_BATCH).map(loadRoadTile));
    updateHud();
    await yieldToBrowser();
  }
}
async function bufferRemainingMap(){
  if(bufferState.active||bufferState.complete)return;
  bufferState.active=true;
  bufferState.total=manifest.length;

  if(massTileMode){
    try{
      // Massive maps use rolling cache only. Never flood the network by
      // prefetching thousands of files that may never be visited.
      await prefetchRollingWindow();
      bufferState.complete=true;
      return;
    }finally{
      bufferState.active=false;
      updateHud();
    }
  }

  try{
    const spawnCell=worldCell(STRIP_SPAWN.x,STRIP_SPAWN.z);
    const remaining=manifest
      .filter(function(t){return !loadedTiles.has(tileKey(t.col,t.row));})
      .sort(function(a,b){
        const da=Math.abs(a.col-spawnCell.col)+Math.abs(a.row-spawnCell.row);
        const db=Math.abs(b.col-spawnCell.col)+Math.abs(b.row-spawnCell.row);
        return da-db;
      });

    for(let i=0;i<remaining.length;i+=RAW_PREFETCH_CONCURRENCY){
      await Promise.all(remaining.slice(i,i+RAW_PREFETCH_CONCURRENCY).map(prefetchRawTile));
      bufferState.loaded=rawBufferedTiles.size+loadedTiles.size;
      updateHud();
      await yieldToBrowser();
    }

    await preloadAllRoadTiles();
    bufferState.complete=true;
  }finally{
    bufferState.active=false;
    updateHud();
  }
}

async function streamTiles(force){
  if(FULL_MAP_MODE){
    if(force&&loadedTiles.size===0)await preloadInitialTiles();
    return;
  }
  if(player.pos.y>=LOW_DETAIL_ONLY_ALTITUDE)return;
  if(streamBusy)return;

  const plan=streamPlan();
  const end=plan.cells[plan.cells.length-1]||plan.current;
  const speedTier=plan.speed>=VERY_HIGH_SPEED_STREAM_THRESHOLD?"V":plan.speed>=HIGH_SPEED_STREAM_THRESHOLD?"H":"N";
  const streamKey=tileKey(plan.current.col,plan.current.row)+"->"+tileKey(end.col,end.row)+":"+speedTier;

  if(!force&&streamKey===lastStreamCell)return;
  lastStreamCell=streamKey;
  streamBusy=true;

  try{
    const dynamicRadius=plan.speed>=VERY_HIGH_SPEED_STREAM_THRESHOLD?Math.max(1,LOAD_RADIUS-1):LOAD_RADIUS;
    let wanted=manifest
      .filter(function(t){return tileNearStreamCorridor(t,plan,dynamicRadius);})
      .sort(function(a,b){return streamPriority(a,plan)-streamPriority(b,plan);});

    for(let i=0;i<wanted.length;i+=MAX_CONCURRENT){
      await Promise.all(wanted.slice(i,i+MAX_CONCURRENT).map(loadOneTile));
    }

    const keepRadius=KEEP_RADIUS+(plan.speed>=HIGH_SPEED_STREAM_THRESHOLD?2:0);
    for(const entry of Array.from(loadedTiles.entries())){
      const key=entry[0],item=entry[1];
      if(!tileNearStreamCorridor(item.rec,plan,keepRadius)){
        if(item.wallpaperGroup)disposeWallpaperGroup(item.wallpaperGroup);
        if(item.residentialGroup)disposeResidentialWallpaperGroup(item.residentialGroup);
        mapGroup.remove(item.root);
        disposeTile(item.root);
        loadedTiles.delete(key);
        tileColliders.delete(key);
      }
    }
  }finally{
    streamBusy=false;
    updateHud();
  }
}

const STRIP_SPAWN=new THREE.Vector3(1250,4,-850);
const SPAWN_TILE="C20_R16";
const player={
  root:new THREE.Group(),
  pos:STRIP_SPAWN.clone(),
  flying:true,
  yaw:Math.PI,
  velocity:new THREE.Vector3(),
  speed:0,
  mach:0,
  flightMode:"FLIGHT",
  grounded:false
};
const jcAtlas=new THREE.TextureLoader().load(JC_CHARACTER_ATLAS_DATA_URL);
jcAtlas.colorSpace=THREE.SRGBColorSpace;
jcAtlas.wrapS=jcAtlas.wrapT=THREE.RepeatWrapping;
jcAtlas.repeat.set(0.25,1);
jcAtlas.offset.set(0,0);
const jcMaterial=new THREE.SpriteMaterial({map:jcAtlas,transparent:true,depthWrite:false,alphaTest:0.08,toneMapped:false});
const jcSprite=new THREE.Sprite(jcMaterial);
jcSprite.center.set(0.5,0);
jcSprite.scale.set(0.88,2.25,1);
player.root.add(jcSprite);
const footShadow=new THREE.Mesh(
  new THREE.CircleGeometry(0.48,20),
  new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.34,depthWrite:false})
);
footShadow.rotation.x=-Math.PI/2;
footShadow.position.y=0.018;
footShadow.renderOrder=1;
player.root.add(footShadow);
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
satanSprite.scale.set(2.4,2.4,1);
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
  health:100,
  maxHealth:100,
  satanHealth:500,
  divineShield:0,
  secondComing:0,
  hellOnEarth:0,
  timeGrace:0,
  resurrectionReady:true,
  combo:0,
  comboTimer:0,
  cameraShake:0,
  lastAbility:"",
  cooldowns:{}
};
const powerFx=[];
const powerHud=document.createElement("div");
powerHud.id="powerHud";
powerHud.style.cssText="position:fixed;right:18px;top:18px;z-index:7;width:min(310px,38vw);padding:12px 14px;background:linear-gradient(135deg,rgba(7,8,11,.94),rgba(18,15,12,.82));border:1px solid rgba(231,190,94,.42);border-right:4px solid #d8ad4b;border-radius:5px;box-shadow:0 12px 36px rgba(0,0,0,.42),inset 0 0 24px rgba(255,205,90,.035);font:700 11px/1.45 Arial,sans-serif;color:#f7f1df;letter-spacing:.035em;pointer-events:none;text-transform:uppercase";
document.body.appendChild(powerHud);

const powerFlash=document.createElement("div");
powerFlash.style.cssText="position:fixed;inset:0;z-index:6;pointer-events:none;opacity:0;background:#fff;mix-blend-mode:screen";
document.body.appendChild(powerFlash);

function powerOrigin(){
  return player.pos.clone().add(new THREE.Vector3(0,1.2,0));
}
function viewForward(){
  return new THREE.Vector3(
    -Math.sin(camYaw)*Math.cos(camPitch),
    -Math.sin(camPitch),
    -Math.cos(camYaw)*Math.cos(camPitch)
  ).normalize();
}
function forwardPoint(distance){
  return powerOrigin().addScaledVector(viewForward(),distance);
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
function flashPower(color,amount){
  powerFlash.style.background=color;
  powerFlash.style.opacity=String(amount);
  setTimeout(function(){powerFlash.style.opacity="0";},70);
}
function shakePower(amount){
  powerState.cameraShake=Math.max(powerState.cameraShake,amount);
}
function radialRingAt(center,color,radius,life){
  const g=new THREE.RingGeometry(Math.max(0.5,radius*0.82),radius,72);
  const m=new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:0.95,side:THREE.DoubleSide,depthWrite:false});
  const ring=new THREE.Mesh(g,m);
  ring.rotation.x=-Math.PI/2;
  ring.position.copy(center);
  ring.scale.setScalar(0.08);
  return addFx(ring,life,function(f){
    const t=1-f.life/f.maxLife;
    f.obj.scale.setScalar(0.08+t*5.5);
    f.obj.material.opacity=(1-t)*0.9;
  });
}
function radialRing(color,radius,life,y){
  const c=powerOrigin();
  c.y=(y??player.pos.y)+0.2;
  return radialRingAt(c,color,radius,life);
}
function verticalBeamAt(center,color,height,life){
  const g=new THREE.CylinderGeometry(1.8,4.8,height,24,1,true);
  const m=new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:0.78,side:THREE.DoubleSide,depthWrite:false});
  const beam=new THREE.Mesh(g,m);
  beam.position.copy(center);
  beam.position.y+=height/2;
  return addFx(beam,life,function(f){
    const t=1-f.life/f.maxLife;
    f.obj.material.opacity=(1-t)*0.78;
    f.obj.scale.x=f.obj.scale.z=1+t*1.8;
  });
}
function verticalBeam(color,height,life){
  return verticalBeamAt(powerOrigin(),color,height,life);
}
function orbBurst(color,count,radius,life,center){
  const group=new THREE.Group();
  const geom=new THREE.SphereGeometry(0.35,8,6);
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
function lightningStrike(center,color,life){
  const group=new THREE.Group();
  group.position.copy(center);
  for(let bolt=0;bolt<5;bolt++){
    const points=[];
    const top=180+Math.random()*100;
    for(let i=0;i<=12;i++){
      const t=i/12;
      points.push(new THREE.Vector3(
        (Math.random()-.5)*8*(1-t),
        top*(1-t),
        (Math.random()-.5)*8*(1-t)
      ));
    }
    const g=new THREE.BufferGeometry().setFromPoints(points);
    const m=new THREE.LineBasicMaterial({color:color,transparent:true,opacity:0.95});
    group.add(new THREE.Line(g,m));
  }
  return addFx(group,life,function(f){
    const t=1-f.life/f.maxLife;
    f.obj.children.forEach(function(line){line.material.opacity=1-t;});
  });
}
function holyAura(duration){
  const g=new THREE.SphereGeometry(2.4,18,12);
  const m=new THREE.MeshBasicMaterial({color:0xffe88a,transparent:true,opacity:0.16,side:THREE.DoubleSide,depthWrite:false});
  const aura=new THREE.Mesh(g,m);
  aura.position.copy(powerOrigin());
  return addFx(aura,duration,function(f){
    f.obj.position.copy(powerOrigin());
    const pulse=1+Math.sin(performance.now()*0.012)*0.12;
    f.obj.scale.setScalar(pulse);
    f.obj.material.opacity=0.11+Math.sin(performance.now()*0.02)*0.05;
  });
}
function comboScale(){
  return 1+Math.min(10,powerState.combo)*0.08;
}
function registerJCAbility(name){
  powerState.lastAbility=name;
  powerState.combo=Math.min(10,powerState.combo+1);
  powerState.comboTimer=4;
}
function canUse(key,cost,meter,cooldown){
  if((powerState.cooldowns[key]||0)>0)return false;
  const free=powerState.controller==="JC"&&powerState.secondComing>0;
  if(!free&&powerState[meter]<cost)return false;
  if(!free)powerState[meter]-=cost;
  powerState.cooldowns[key]=cooldown??0.8;
  return true;
}
function damageSatan(amount,knockback,origin){
  powerState.satanHealth=Math.max(0,powerState.satanHealth-amount*comboScale());
  const from=origin||player.pos;
  const delta=satanRoot.position.clone().sub(from);
  if(delta.lengthSq()<0.001)delta.set(0,0,-1);
  satanRoot.position.add(delta.normalize().multiplyScalar(knockback||0));
}
function takeDivineDamage(amount){
  if(powerState.controller!=="JC")return;
  if(powerState.divineShield>0)amount*=0.12;
  if(powerState.secondComing>0)amount*=0.25;
  powerState.health-=amount;
  shakePower(Math.min(2.5,amount*0.04));
  flashPower("#ff3344",0.18);
  if(powerState.health<=0){
    if(powerState.resurrectionReady){
      powerState.resurrectionReady=false;
      powerState.health=100;
      powerState.divine=100;
      powerState.divineShield=5;
      player.pos.y=Math.max(player.pos.y,18);
      player.velocity.set(0,140,0);
      radialRing(0xffffff,18,1.7);
      verticalBeam(0xfff5c7,260,2.2);
      orbBurst(0xffffff,55,24,2.4,powerOrigin());
      flashPower("#ffffff",0.75);
      shakePower(3.5);
    }else{
      powerState.health=1;
    }
  }
}
function holyShockwave(){
  if(!canUse("jc1",14,"divine",0.45))return;
  registerJCAbility("HOLY SHOCKWAVE");
  const scale=comboScale();
  radialRing(0xffe783,8*scale,0.85);
  orbBurst(0xfff3b0,22,5*scale,0.75,powerOrigin());
  damageSatan(22,18*scale);
  shakePower(0.75*scale);
}
function divineShield(){
  if(!canUse("jc2",20,"divine",2.4))return;
  registerJCAbility("DIVINE SHIELD");
  powerState.divineShield=8;
  holyAura(8);
  const g=new THREE.SphereGeometry(3.6,24,18);
  const m=new THREE.MeshBasicMaterial({color:0xffe58a,transparent:true,opacity:0.22,side:THREE.DoubleSide,depthWrite:false});
  const shield=new THREE.Mesh(g,m);
  shield.position.copy(powerOrigin());
  addFx(shield,8,function(f){
    f.obj.position.copy(powerOrigin());
    f.obj.material.opacity=0.14+Math.sin(performance.now()*0.01)*0.08;
  });
}
function judgmentBeam(){
  if(!canUse("jc3",26,"divine",1.5))return;
  registerJCAbility("JUDGMENT BEAM");
  const target=forwardPoint(130);
  target.y=Math.max(0,target.y);
  verticalBeamAt(target,0xfff0a8,280,1.35);
  lightningStrike(target,0xffffff,0.75);
  radialRingAt(target.clone().setY(target.y+0.15),0xffffff,11*comboScale(),1.05);
  orbBurst(0xfff7ca,26,9,1.1,target);
  const d=satanRoot.position.distanceTo(target);
  if(d<55)damageSatan(45,14,target);
  shakePower(1.4);
  flashPower("#fff6cb",0.28);
}
function secondComing(){
  if(!canUse("jc4",100,"divine",20))return;
  registerJCAbility("SECOND COMING");
  powerState.secondComing=15;
  powerState.divineShield=15;
  powerState.health=100;
  powerState.divine=100;
  powerState.resurrectionReady=true;
  radialRing(0xffe26f,30,2.3);
  verticalBeam(0xfff6c8,520,3.2);
  orbBurst(0xffffff,110,45,3.3,powerOrigin());
  lightningStrike(powerOrigin(),0xfff9d8,2.2);
  damageSatan(120,45);
  shakePower(3);
  flashPower("#ffffff",0.7);
}
function divineDash(){
  if(!canUse("jc5",12,"divine",0.5))return;
  registerJCAbility("DIVINE DASH");
  const dir=viewForward();
  player.velocity.addScaledVector(dir,1300);
  player.pos.addScaledVector(dir,24);
  orbBurst(0x9fe8ff,20,3.5,0.6,powerOrigin());
  radialRing(0x9fe8ff,4.5,0.45);
  shakePower(0.4);
}
function heavenSlam(){
  if(!canUse("jc6",24,"divine",2.2))return;
  registerJCAbility("HEAVEN SLAM");
  const impact=player.pos.clone();
  impact.y=0.25;
  player.velocity.set(0,0,0);
  player.pos.y=3;
  radialRingAt(impact,0xffd75e,18*comboScale(),1.4);
  radialRingAt(impact,0xffffff,10*comboScale(),0.8);
  verticalBeamAt(impact,0xffed9b,180,1.5);
  orbBurst(0xffc83d,48,18,1.8,impact);
  if(satanRoot.position.distanceTo(impact)<85)damageSatan(65,35,impact);
  shakePower(2.8);
  flashPower("#ffe9a3",0.35);
}
function timeGrace(){
  if(!canUse("jc7",28,"divine",9))return;
  registerJCAbility("TIME GRACE");
  powerState.timeGrace=7;
  powerState.divineShield=Math.max(powerState.divineShield,4);
  holyAura(7);
  radialRing(0xb7e8ff,13,1.2);
  flashPower("#dff7ff",0.2);
}
function miracleHeal(){
  if(!canUse("jc8",30,"divine",10))return;
  registerJCAbility("MIRACLE HEAL");
  powerState.health=100;
  powerState.divine=Math.min(100,powerState.divine+25);
  powerState.divineShield=Math.max(powerState.divineShield,2.5);
  radialRing(0xb8ffbf,16,1.5);
  verticalBeam(0xdffff0,150,1.8);
  orbBurst(0xb8ffcf,42,13,1.8,powerOrigin());
  flashPower("#dffff0",0.3);
}
function hellfireStorm(){
  if(!canUse("sat1",18,"infernal",0.8))return;
  radialRing(0xff3b12,9,1.1);
  orbBurst(0xff2b00,42,16,2.4,powerOrigin().add(new THREE.Vector3(0,16,0)));
  takeDivineDamage(18);
}
function realityTear(){
  if(!canUse("sat2",28,"infernal",1.8))return;
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
  takeDivineDamage(24);
}
function fearWave(){
  if(!canUse("sat3",22,"infernal",1.1))return;
  radialRing(0x7c00ff,13,1.5);
  orbBurst(0x5b00b8,24,8,1.2,powerOrigin());
  takeDivineDamage(14);
}
function hellOnEarth(){
  if(!canUse("sat4",100,"infernal",20))return;
  powerState.hellOnEarth=12;
  radialRing(0xff2200,28,2.4);
  verticalBeam(0xff2600,340,2.6);
  orbBurst(0xff3b00,95,45,4,powerOrigin().add(new THREE.Vector3(0,20,0)));
  takeDivineDamage(35);
}
function usePower(slot){
  if(powerState.controller==="JC"){
    if(slot===1)holyShockwave();
    if(slot===2)divineShield();
    if(slot===3)judgmentBeam();
    if(slot===4)secondComing();
    if(slot===5)divineDash();
    if(slot===6)heavenSlam();
    if(slot===7)timeGrace();
    if(slot===8)miracleHeal();
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
  updateLivingSinCity(dt);
  const regen=powerState.secondComing>0?35:(powerState.timeGrace>0?15:7);
  powerState.divine=Math.min(100,powerState.divine+regen*dt);
  powerState.infernal=Math.min(100,powerState.infernal+6*dt);
  powerState.divineShield=Math.max(0,powerState.divineShield-dt);
  powerState.secondComing=Math.max(0,powerState.secondComing-dt);
  powerState.hellOnEarth=Math.max(0,powerState.hellOnEarth-dt);
  powerState.timeGrace=Math.max(0,powerState.timeGrace-dt);
  powerState.comboTimer=Math.max(0,powerState.comboTimer-dt);
  powerState.cameraShake=Math.max(0,powerState.cameraShake-dt*2.4);
  if(powerState.comboTimer<=0)powerState.combo=Math.max(0,powerState.combo-dt*2.2);
  Object.keys(powerState.cooldowns).forEach(function(k){powerState.cooldowns[k]=Math.max(0,powerState.cooldowns[k]-dt);});

  if(powerState.timeGrace>0&&powerState.controller==="JC"){
    player.velocity.multiplyScalar(1+0.55*dt);
  }

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
    scene.background.lerp(new THREE.Color(0x4b5576),0.09);
    hemi.intensity=Math.max(hemi.intensity,5.2);
    glow.intensity=Math.max(glow.intensity,18);
    flightRing.scale.setScalar(Math.max(flightRing.scale.x,2.2));
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
    ?["1 SHOCKWAVE","2 DIVINE SHIELD","3 JUDGMENT BEAM","4 SECOND COMING","5 DIVINE DASH","6 HEAVEN SLAM","7 TIME GRACE","8 MIRACLE HEAL"]
    :["1 HELLFIRE STORM","2 REALITY TEAR","3 FEAR WAVE","4 HELL ON EARTH"];
  const health=powerState.controller==="JC"?" · HP "+Math.round(powerState.health):" · SATAN HP "+Math.round(powerState.satanHealth);
  const combo=powerState.controller==="JC"&&powerState.combo>0?" · COMBO x"+powerState.combo.toFixed(1):"";
  const rez=powerState.controller==="JC"?" · RESURRECTION "+(powerState.resurrectionReady?"READY":"USED"):"";
  powerHud.innerHTML="<div style='display:flex;justify-content:space-between;align-items:center;gap:10px'><b style='font-size:16px;color:"+(powerState.controller==="JC"?"#f0c65d":"#ff604b")+"'>"+powerState.controller+"</b><span>POWER "+Math.round(meter)+"%</span></div><div style='margin-top:7px;opacity:.82'>"+names.join(" · ")+"</div><div style='margin-top:7px;color:#d9c89f'>"+(powerState.lastAbility||"READY")+" "+combo+" "+rez+"</div>";
  if(healthFillEl)healthFillEl.style.width=THREE.MathUtils.clamp(powerState.health/powerState.maxHealth*100,0,100)+"%";
  if(healthTextEl)healthTextEl.textContent=Math.round(powerState.health)+" / "+Math.round(powerState.maxHealth);
  if(divineFillEl)divineFillEl.style.width=Math.round(meter)+"%";
  if(divineTextEl)divineTextEl.textContent=Math.round(meter)+"%";
  if(controllerLabelEl)controllerLabelEl.textContent=powerState.controller;
  if(abilityStatusEl)abilityStatusEl.textContent=powerState.lastAbility||"READY";
}
function syncControlledAvatar(){
  if(powerState.controller==="SATAN")satanRoot.position.copy(player.pos);
}
// -----------------------------------------------------------------------------


const abilityWheel=document.createElement("div");
abilityWheel.id="abilityWheel";
abilityWheel.style.cssText="position:fixed;inset:0;z-index:30;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.28);backdrop-filter:blur(2px);";
abilityWheel.innerHTML="<div id='abilityWheelRing' style='position:relative;width:360px;height:360px;border-radius:50%;border:2px solid rgba(255,226,111,.7);background:radial-gradient(circle,rgba(10,10,16,.92) 0 28%,rgba(10,10,16,.72) 29% 62%,rgba(255,215,80,.10) 63% 100%);box-shadow:0 0 55px rgba(255,210,70,.22)'></div>";
document.body.appendChild(abilityWheel);
const abilityWheelRing=abilityWheel.querySelector("#abilityWheelRing");
let abilityWheelOpen=false,abilityWheelIndex=0;
function wheelAbilities(){
  return powerState.controller==="JC"?[
    ["HOLY SHOCKWAVE",holyShockwave],["DIVINE SHIELD",divineShield],["JUDGMENT BEAM",judgmentBeam],["SECOND COMING",secondComing],
    ["DIVINE DASH",divineDash],["HEAVEN SLAM",heavenSlam],["TIME GRACE",timeGrace],["MIRACLE HEAL",miracleHeal]
  ]:[
    ["HELLFIRE STORM",hellfireStorm],["SOUL WEAPON",fireSoulWeapon],["INFLUENCE",influenceNearbyNpcs],["POSSESSION",function(){powerState.lastAbility="POSSESSION SELECT";}],
    ["SOUL TAKER",fireSoulWeapon],["CORRUPTION",function(){cityState.corruption=Math.min(100,cityState.corruption+4);powerState.lastAbility="CITY CORRUPTION";}],
    ["CHAOS",function(){cityState.chaos=Math.min(100,cityState.chaos+5);powerState.lastAbility="CHAOS";}],["SWITCH",togglePowerController]
  ];
}
function renderAbilityWheel(){
  const a=wheelAbilities();
  abilityWheelRing.innerHTML="";
  a.forEach(function(item,i){
    const ang=(Math.PI*2*i/a.length)-Math.PI/2;
    const b=document.createElement("div");
    b.textContent=item[0];
    b.style.cssText="position:absolute;width:112px;text-align:center;padding:8px 5px;border-radius:9px;font:bold 11px Arial;color:"+(i===abilityWheelIndex?"#111":"white")+";background:"+(i===abilityWheelIndex?"#ffe477":"rgba(18,18,26,.9)")+";border:1px solid rgba(255,229,130,.65);transform:translate(-50%,-50%);left:"+(180+Math.cos(ang)*132)+"px;top:"+(180+Math.sin(ang)*132)+"px;";
    abilityWheelRing.appendChild(b);
  });
  const mid=document.createElement("div");
  mid.textContent=(powerState.controller==="JC"?"DIVINE":"INFERNAL")+"\nABILITIES";
  mid.style.cssText="white-space:pre;text-align:center;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:bold 13px Arial;color:#ffe477;";
  abilityWheelRing.appendChild(mid);
}
function setAbilityWheel(open){
  abilityWheelOpen=open;
  abilityWheel.style.display=open?"flex":"none";
  if(open)renderAbilityWheel();
}
function selectWheelFromPointer(e){
  const r=abilityWheelRing.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  let ang=Math.atan2(e.clientY-cy,e.clientX-cx)+Math.PI/2;if(ang<0)ang+=Math.PI*2;
  abilityWheelIndex=Math.round(ang/(Math.PI*2)*wheelAbilities().length)%wheelAbilities().length;
  renderAbilityWheel();
}
abilityWheel.addEventListener("pointermove",selectWheelFromPointer);

const keys={};
let camYaw=Math.PI,camPitch=0.24,targetYaw=Math.PI,targetPitch=0.24,camDist=9.5,drag=false,lx=0,ly=0;
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
  if(!player.flying){
    player.pos.y=Math.max(GROUND_Y,player.pos.y);
    player.velocity.set(0,0,0);
  }
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
  if(e.code==="KeyY"&&!e.repeat)restoreHolyDamage();
  if(e.code==="KeyI"&&!e.repeat)influenceNearbyNpcs();
  if(e.code==="KeyG"&&!e.repeat)fireSoulWeapon();
  if(e.code==="KeyE"&&!e.repeat){abilityWheelIndex=0;setAbilityWheel(true);}
  if(e.code==="Digit1"&&!e.repeat)usePower(1);
  if(e.code==="Digit2"&&!e.repeat)usePower(2);
  if(e.code==="Digit3"&&!e.repeat)usePower(3);
  if(e.code==="Digit4"&&!e.repeat)usePower(4);
  if(e.code==="Digit5"&&!e.repeat)usePower(5);
  if(e.code==="Digit6"&&!e.repeat)usePower(6);
  if(e.code==="Digit7"&&!e.repeat)usePower(7);
  if(e.code==="Digit8"&&!e.repeat)usePower(8);
  if(e.code==="Space")e.preventDefault();
});
addEventListener("keyup",function(e){
  keys[e.code]=false;
  if(e.code==="KeyE"&&abilityWheelOpen){
    const chosen=wheelAbilities()[abilityWheelIndex];
    setAbilityWheel(false);
    if(chosen&&chosen[1])chosen[1]();
  }
});
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
document.querySelectorAll("[data-power]").forEach(function(button){
  button.addEventListener("pointerdown",function(e){
    e.preventDefault();
    const slot=Number(button.dataset.power);
    if(Number.isFinite(slot))usePower(slot);
  });
});

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

    const motion=player.velocity.clone().multiplyScalar(dt);

    // Dedicated vertical thrusters: fast rise is independent of horizontal inertia.
    if(rising||descending){
      const boosted=!!(keys.ShiftLeft||keys.ShiftRight);
      let riseSpeed=220;
      let descendSpeed=180;

      if(boosted){
        riseSpeed=1200;
        if(player.pos.y>=2000) riseSpeed=3200;
        if(player.pos.y>=12000) riseSpeed=7000;
        if(player.pos.y>=35000) riseSpeed=12000;
        if(player.pos.y>=80000) riseSpeed=18000;

        descendSpeed=900;
        if(player.pos.y>=12000) descendSpeed=2800;
        if(player.pos.y>=50000) descendSpeed=6500;
      }

      if(rising)motion.y+=riseSpeed*dt;
      if(descending)motion.y-=descendSpeed*dt;
      if(rising&&player.velocity.y<0)player.velocity.y*=0.2;
      if(descending&&player.velocity.y>0)player.velocity.y*=0.2;
    }

    movePlayerSolid(motion);
    player.pos.y=THREE.MathUtils.clamp(player.pos.y,GROUND_Y,MAX_ALTITUDE);
  }else{
    const forward=new THREE.Vector3(-Math.sin(camYaw),0,-Math.cos(camYaw));
    const right=new THREE.Vector3(forward.z,0,-forward.x);
    const move=new THREE.Vector3()
      .addScaledVector(forward,(keys.KeyW?1:0)-(keys.KeyS?1:0))
      .addScaledVector(right,(keys.KeyD?1:0)-(keys.KeyA?1:0));

    const speed=keys.ShiftLeft?18:10;
    const delta=new THREE.Vector3();
    if(move.lengthSq()){
      move.normalize();
      delta.addScaledVector(move,speed*dt);
      player.yaw=Math.atan2(move.x,move.z);
    }

    player.velocity.x=0;
    player.velocity.z=0;
    player.velocity.y-=GRAVITY*dt;
    player.velocity.y=Math.max(player.velocity.y,-65);
    delta.y=player.velocity.y*dt;

    movePlayerSolid(delta);
  }

  classifyFlight();

  const viewYaw=Math.atan2(camera.position.x-player.pos.x,camera.position.z-player.pos.z);
  const rel=Math.atan2(Math.sin(player.yaw-viewYaw),Math.cos(player.yaw-viewYaw));
  let frame=Math.abs(rel)>2.35?1:Math.abs(rel)<0.78?0:rel>0?2:3;
  jcAtlas.offset.x=frame*0.25;
  jcAtlas.offset.y=0;

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
  const target=player.pos.clone().add(new THREE.Vector3(0,1.55,0));
  const speedFx=THREE.MathUtils.clamp(player.mach/12,0,1);
  const d=hyper.active?24:camDist+speedFx*18;
  const desired=target.clone().add(new THREE.Vector3(
    Math.sin(camYaw)*Math.cos(camPitch)*d,
    Math.sin(camPitch)*d+2,
    Math.cos(camYaw)*Math.cos(camPitch)*d
  ));
  if(powerState.cameraShake>0){
    const s=powerState.cameraShake;
    desired.x+=(Math.random()-.5)*s;
    desired.y+=(Math.random()-.5)*s;
    desired.z+=(Math.random()-.5)*s;
  }
  camera.position.lerp(desired,1-Math.exp(-(hyper.active?10:7)*dt));
  const powerFov=powerState.secondComing>0?8:(powerState.timeGrace>0?5:0);
  const targetFov=(hyper.active?94:54+speedFx*30)+powerFov;
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
  const solidText=" · SOLID "+collisionCount()+(player.grounded?" · GROUNDED":"")+" · TILES FLAT · ROADS TOP · STRIP "+wallpaperShellCount+" · HOMES "+residentialWallpaperCount;
  const plan=streamPlan();
  const bufferText=DATA_BUFFERING?
    (" · CACHE "+(rawBufferedTiles.size+loadedTiles.size)+"/"+Math.max(bufferState.total,manifest.length)+(bufferState.complete?" READY":"")):"";
  const aheadText=FULL_MAP_MODE?(" · BUFFERED MAP"+bufferText):(plan.aheadTiles>0?" · HORIZON→JC "+plan.aheadTiles+" TILES":"");
  const factoryCount=(aiAssetManifest&&aiAssetManifest.assets?aiAssetManifest.assets.length:0);
  statusEl.textContent=player.flightMode+" · "+speed+mach+" · ALT "+alt+" · "+detail+" · "+loadedTiles.size+"/"+manifest.length+" GLBs"+(massTileMode?" · MASS TILE MODE":"")+aheadText+roadText+solidText+" · FACTORY "+factoryCount+" · "+Math.round(fpsEstimate)+" FPS · "+dynamicPixelRatio.toFixed(2)+"x";
  if(hudSpeedEl)hudSpeedEl.textContent=speed+mach;
  if(hudAltitudeEl)hudAltitudeEl.textContent=alt;
  if(hudFpsEl)hudFpsEl.textContent=Math.round(fpsEstimate)+" FPS";
  if(hudRoadsEl)hudRoadsEl.textContent=roadSegs.toLocaleString()+" ROAD SEG";
  if(radarArrowEl)radarArrowEl.style.transform="translate(-50%,-50%) rotate("+THREE.MathUtils.radToDeg(-player.yaw)+"deg)";
  const d=destinations[destinationIndex];
  if(d)destinationEl.textContent="TARGET: "+d.name+" · "+Math.hypot(player.pos.x-d.x,player.pos.z-d.z).toFixed(0)+"m";
}
async function boot(){
  player.pos.copy(STRIP_SPAWN);
  player.velocity.set(0,0,0);
  player.yaw=Math.PI;
  if(locationEl)locationEl.textContent="NEW TILE ZONE · "+SPAWN_TILE;
  if(creditEl)creditEl.textContent="JC Map • START: "+SPAWN_TILE+" • new 163-tile zone";
  await Promise.all([loadManifest(),loadAIAssetFactoryManifest()]);
  await initializeFactoryWallpapers();
  rebuildDestinations();
  await loadWorldLod();
  await loadRoadRuntime();
  bufferState.total=manifest.length;
  if(progressEl)progressEl.textContent="BUFFERING NEW 163-TILE START AREA…";
  await Promise.all([streamTiles(true),streamRoadTiles(true)]);
  updateBufferedVisibility(true);
  if(progressEl)progressEl.textContent="STRIP READY · background map buffering active";
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
    stripSpawn:STRIP_SPAWN.clone(),
    fullMapMode:FULL_MAP_MODE,
    dataBuffering:DATA_BUFFERING,
    get massTileMode(){return massTileMode},
    massTileThreshold:MASS_TILE_THRESHOLD,
    bufferState:bufferState,
    rawBufferedTiles:rawBufferedTiles,
    rawBufferedRoads:rawBufferedRoads,
    updateBufferedVisibility:updateBufferedVisibility,
    ensureActiveWindowDecoded:ensureActiveWindowDecoded,
    pruneDecodedScene:pruneDecodedScene,
    tileWorldSize:TILE_WORLD_SIZE,
    tileScale:TILE_SCALE,
    tileGroundY:TILE_GROUND_Y,
    roadSurfaceY:ROAD_SURFACE_Y,
    conformRoadTileToGlb:conformRoadTileToGlb,
    wallpaperAtlas:stripWallpaperAtlas,
    residentialWallpaperAtlas:residentialWallpaperAtlas,
    get wallpaperShellCount(){return wallpaperShellCount},
    get residentialWallpaperCount(){return residentialWallpaperCount},
    rebuildWallpaper:function(){
      for(const item of loadedTiles.values()){
        if(item.wallpaperGroup)disposeWallpaperGroup(item.wallpaperGroup);
        if(item.residentialGroup)disposeResidentialWallpaperGroup(item.residentialGroup);
        item.wallpaperGroup=buildStripWallpaper(item.root,item.rec);
        item.residentialGroup=buildResidentialWallpaper(item.root,item.rec);
      }
    },
    origin:{col:ORIGIN_COL,row:ORIGIN_ROW},
    manifestVersion:manifestVersion,
    aiAssetManifest:aiAssetManifest,
    aiAssetById:aiAssetById,
    get wallpaperAssetsReady(){return wallpaperAssetsReady},
    getAIAsset:getAIAsset,
    listAIAssets:listAIAssets,
    reloadAIAssetManifest:loadAIAssetFactoryManifest,
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
    tileColliders:tileColliders,
    movePlayerSolid:movePlayerSolid,
    samplePlayableSurfaceY:samplePlayableSurfaceY,
    get surfaceY(){return samplePlayableSurfaceY(player.pos.x,player.pos.z)},
    get collisionCount(){return collisionCount()},
    powers:powerState,
    usePower:usePower,
    takeDivineDamage:takeDivineDamage,
    togglePowerController:togglePowerController
  };
  if(window.JC_BOOT_OK)window.JC_BOOT_OK();
  requestAnimationFrame(frame);
  if(DATA_BUFFERING)bufferRemainingMap();
}
let streamClock=0;
const clock=new THREE.Clock();
function frame(){
  requestAnimationFrame(frame);
  if(webglContextLost)return;
  const dt=Math.min(0.033,clock.getDelta());
  updateLook(dt);
  updatePlayer(dt);
  syncControlledAvatar();
  updatePowers(dt);
  updateWorldLod();
  updateRoadLod();
  updateAtmosphere();
  updateCamera(dt);
  if(!FULL_MAP_MODE){
    streamClock+=dt;
    const streamInterval=player.speed>=VERY_HIGH_SPEED_STREAM_THRESHOLD?0.12:
      player.speed>=HIGH_SPEED_STREAM_THRESHOLD?0.22:0.55;
    if(streamClock>streamInterval){
      streamClock=0;
      streamTiles(false);
      streamRoadTiles(false);
    }
  }
  visibilityClock+=dt;
  if(DATA_BUFFERING&&visibilityClock>=VISIBILITY_UPDATE_INTERVAL){
    visibilityClock=0;
    updateBufferedVisibility(false);
    ensureActiveWindowDecoded();
    if(massTileMode)prefetchRollingWindow();
  }
  updateAdaptiveResolution(dt);
  if(!frame._hudClock)frame._hudClock=0;
  frame._hudClock+=dt;
  if(frame._hudClock>=0.20){
    frame._hudClock=0;
    updateHud();
  }
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
  if(window.JC_BOOT_FAIL)window.JC_BOOT_FAIL(e);
});
