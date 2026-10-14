import * as THREE from "three";

/**
 * Small, instanced Las Vegas neighborhood details.
 * Approximate regional visual archetypes, NOT exact recorded property features.
 * The original JC footprint data determines house positions and dimensions.
 *
 * There are no per-house lights, shadows or textures to overload mobile Safari.
 * Each active terrain cell owns just a few reusable InstancedMesh draw calls.
 */
const residential=/residential|suburban|tract|villa|historic/;
const concrete=new THREE.MeshStandardMaterial({color:0x99928a,roughness:0.96,metalness:0});
const desert=new THREE.MeshStandardMaterial({color:0x988873,roughness:1});
const porchMat=new THREE.MeshStandardMaterial({color:0xc4b6a3,roughness:.9});
const green=new THREE.MeshStandardMaterial({color:0x657e59,roughness:1});
const sage=new THREE.MeshStandardMaterial({color:0x84927a,roughness:1});
const trunkMat=new THREE.MeshStandardMaterial({color:0x655044,roughness:1});
const waterMat=new THREE.MeshStandardMaterial({
  color:0x327b94,emissive:0x062b3e,emissiveIntensity:0.15,
  metalness:0.13,roughness:0.25,transparent:true,opacity:.89
});
const solarMat=new THREE.MeshStandardMaterial({
  color:0x132635,metalness:0.35,roughness:0.3
});
const gBox=new THREE.BoxGeometry(1,1,1);
const gCactus=new THREE.ConeGeometry(1,1,5);
const gCrown=new THREE.DodecahedronGeometry(1,0);
const gTrunk=new THREE.CylinderGeometry(0.17,0.25,1,5);
const shapes={
  driveway:[gBox,concrete],gravel:[gBox,desert],
  porch:[gBox,porchMat],hedge:[gBox,green],
  water:[gBox,waterMat],solar:[gBox,solarMat],
  cactus:[gCactus,sage],trunk:[gTrunk,trunkMat],
  crown:[gCrown,green]
};
function hash(n){const x=Math.sin(n*127.1+37.43)*43758.5453;return x-Math.floor(x);}
const zoneDetails={
  "desert-tract":"xeriscape",
  "suburban":"dry-yard",
  "mature-residential":"tree",
  "planned-residential":"xeriscape",
  "modern-residential":"solar",
  "historic":"porch",
  "hillside-villa":"pool",
  "resort-villa":"pool"
};
export function attachJcNeighborhoodStreetscape(parent,homes,skins,{lowSpec=false}={}){
  const groups=new Map();
  const limit=lowSpec?115:225;
  let decorated=0;
  const add=(key,x,y,z,w,h,d,angle=0)=>{
    const g=groups.get(key)||[];
    if(g.length>limit*2)return;
    g.push({x,y,z,w,h,d,angle});
    groups.set(key,g);
  };
  for(let i=0;i<homes.length;i++){
    const home=homes[i];
    const region=skins.zones[Math.floor(home.style/skins.stylesPerNeighborhood)];
    if(!region||!residential.test(region.kind))continue;
    if(home.h<.32||home.h>2.8||home.w<.65||home.d<.65||home.w>9||home.d>9)continue;
    if(decorated>=limit)break;
    // Keep memory constant regardless of 500+ source records in one cell.
    const odds=hash(Math.round(home.x*7+home.z*5)+i*13);
    if(lowSpec&&odds>.54)continue;
    const v=(Math.floor(home.x*3+home.z*7)%4+4)%4;
    const alongZ=v<2,sign=v%2===0?1:-1;
    const front=alongZ?home.z+sign*home.d*.5:home.x+sign*home.w*.5;
    const kind=zoneDetails[region.kind]||"xeriscape";
    const garageWidth=Math.min(1.15,home.w*.46);
    if(kind!=="pool"||odds<.75){
      // Simple concrete driveway and entry landing; angled toward a plausible
      // adjacent parcel side rather than pretending to know recorded garages.
      if(alongZ)add("driveway",home.x+home.w*.18,.014,front+sign*.30,
        garageWidth,.02,.64);
      else add("driveway",front+sign*.30,.014,home.z+home.d*.18,.64,.02,garageWidth);
    }
    if(kind==="porch"||kind==="dry-yard"||kind==="tree"){
      if(alongZ)add("porch",home.x-home.w*.19,.045,front+sign*.08,
        home.w*.30,.045,.19);
      else add("porch",front+sign*.08,.045,home.z-home.d*.19,.19,.045,home.d*.30);
    }
    const sideX=home.x-home.w*.40;
    const sideZ=home.z-home.d*.38;
    if(kind==="xeriscape"||kind==="dry-yard"){
      add("gravel",sideX,.012,sideZ,Math.max(.3,home.w*.28),.017,
        Math.max(.3,home.d*.20));
      if(odds<.65){
        const h=.24+hash(i*5+home.x)*.24;
        add("cactus",sideX,.12+h*.5,sideZ, .12,h,.12);
      }
    }else if(kind==="tree"||kind==="porch"){
      const tx=home.x-home.w*.45-.30,tz=home.z-home.d*.43-.28;
      const h=.5+hash(home.x*13+i)*.36;
      add("trunk",tx,h*.44,tz,.09,h*.88,.09);
      add("crown",tx,h*.94,tz,.36,.36,.36);
      if(odds<.5)add("hedge",home.x+home.w*.40,.08,
        home.z-home.d*.37,.15,.15,.52);
    }else if(kind==="pool"&&home.w>=1.55&&home.d>=1.55&&odds<.40){
      // Upscale-villa blue splash and deck, but no assumption of an actual pool.
      add("water",home.x+home.w*.23,.023,home.z+home.d*.30,
        Math.min(home.w*.46,1.4),.013,Math.min(home.d*.32,.88));
      add("porch",home.x+home.w*.23,.015,home.z+home.d*.30,
        Math.min(home.w*.54,1.65),.011,Math.min(home.d*.40,1.07));
    }
    if((kind==="solar"||region.kind==="planned-residential"||
      region.kind==="hillside-villa")&&odds<.34&&home.w>.96&&home.d>.96){
      // Selected roofs get inset PV-looking panels, not reflective mirror glass.
      add("solar",home.x,home.h+.016,home.z,
        Math.min(.6,home.w*.46),.012,Math.min(.38,home.d*.31));
    }
    decorated++;
  }
  const scene=new THREE.Group();
  scene.name="JC_REGIONAL_HOUSE_STREETSCAPE";
  const dummy=new THREE.Object3D();
  let objects=0;
  for(const [type,items] of groups){
    if(!items.length)continue;
    const [geom,mat]=shapes[type];
    const mesh=new THREE.InstancedMesh(geom,mat,items.length);
    mesh.name="JC_STREETSCAPE_"+type;
    mesh.frustumCulled=false;
    mesh.castShadow=false;mesh.receiveShadow=false;
    for(let i=0;i<items.length;i++){
      const o=items[i];
      dummy.position.set(o.x,o.y,o.z);
      dummy.rotation.set(0,o.angle,0);
      dummy.scale.set(o.w,o.h,o.d);
      dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate=true;
    scene.add(mesh);
    objects+=items.length;
  }
  parent.add(scene);
  window.JC_STREETSCAPE_STATUS={decorated,objects,drawCalls:scene.children.length,
    source:"stylized local Las Vegas regional landscaping; locations source-derived"};
  return {group:scene,decorated,objects,dispose(){
    parent.remove(scene);
    scene.traverse(child=>{if(child.isInstancedMesh)child.dispose()});
  }};
}
