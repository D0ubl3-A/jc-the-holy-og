import * as THREE from "three";

/**
 * 25 geographic Las Vegas/Henderson style zones, THREE material groups shared
 * between gameplay and the 595-tile city-wide sky LOD. Neighborhood anchors
 * are approximate art-direction zones, NOT surveyed polygon/parcel boundaries.
 *
 * We use eight real checked-in facade wallpaper atlases and procedural roof
 * materials (tile/asphalt/metal/HVAC/solar) shared by *all* InstancedMeshes.
 * Source buildings retain their original footprint positions and dimensions.
 */
const atlases=[
  "./jc-the-holy-og-assets/swarm/buildings/facade-atlas-01.jpg",
  "./jc-the-holy-og-assets/swarm/buildings/facade-atlas-02.jpg",
  "./jc-the-holy-og-assets/swarm/buildings/facade-atlas-03.jpg",
  "./jc-the-holy-og-assets/swarm/buildings/facade-atlas-04.jpg",
  "./jc-the-holy-og-assets/swarm/buildings/facade-atlas-05.jpg",
  "./jc-the-holy-og-assets/swarm/buildings/facade-atlas-06.jpg",
  "./jc-the-holy-og-assets/textures/residential-wallpaper-atlas.jpg",
  "./jc-the-holy-og-assets/textures/strip-wallpaper-atlas.jpg"
];
const REV="jc-neighborhood-realistic-skins-v1";
const VARIANTS=3;
const palettes={
  warm:"#d8c6a8",sand:"#cab796",ochre:"#d0a879",stucco:"#c1b7a8",
  cream:"#ded4bd",sage:"#bac3b1",buff:"#d2bc97",steel:"#9faab1"
};
const roofColors={
  "resort":"#464a50","commercial":"#797870","roadside-commercial":"#847e6c",
  "industrial":"#78828a","urban":"#756d67","historic":"#a46f56",
  "desert-tract":"#b69b80","suburban":"#a58e79",
  "mature-residential":"#8c8572","planned-residential":"#ac927e",
  "modern-residential":"#626973","hillside-villa":"#b66c49",
  "resort-villa":"#b66a49"
};
const RESIDENTIAL=/residential|suburban|tract|villa|historic/;
function roofMap(kind,color,index){
  const canvas=document.createElement("canvas");canvas.width=canvas.height=128;
  const ctx=canvas.getContext("2d",{alpha:false});
  ctx.fillStyle=color;ctx.fillRect(0,0,128,128);
  const metal=/industrial|commercial|resort|urban/.test(kind);
  const tile=/hillside|villa|planned/.test(kind);
  const modern=/modern/.test(kind);
  if(tile){
    for(let y=0;y<128;y+=10){
      ctx.strokeStyle=(y/10)%2===0?"#dcc2a0":"#885945";
      ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(128,y);ctx.stroke();
      for(let x=(y%20)*3-12;x<128;x+=18){
        ctx.strokeStyle="#7e513db0";
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+4,y+10);ctx.stroke();
      }
    }
  }else if(metal){
    ctx.fillStyle="#ffffff15";for(let x=0;x<128;x+=13)ctx.fillRect(x,0,2,128);
    ctx.strokeStyle="#222f38aa";for(let y=0;y<128;y+=24){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(128,y);ctx.stroke();}
    // rooftop HVAC boxes and safe light grey service panel silhouettes
    for(let k=0;k<5;k++){
      const x=12+(k*41+index*13)%95,y=10+(k*31+index*7)%94;
      ctx.fillStyle="#333c43";ctx.fillRect(x+2,y+2,17,13);
      ctx.fillStyle="#acb5b9";ctx.fillRect(x,y,15,11);
      ctx.fillStyle="#49545a";ctx.fillRect(x+4,y+2,7,7);
    }
  }else{
    for(let y=0;y<128;y+=11){
      ctx.fillStyle=y%22===0?"#ffffff16":"#20201d14";
      ctx.fillRect(0,y,128,2);
    }
    for(let x=0;x<128;x+=37){
      ctx.fillStyle="#37352f44";ctx.fillRect(x,0,2,128);
    }
  }
  if(modern||index%4===0){
    for(let k=0;k<2;k++){
      const x=14+k*57,y=21+(index*13)%35;
      ctx.fillStyle="#151c28";ctx.fillRect(x,y,43,25);
      ctx.strokeStyle="#729caa";ctx.lineWidth=1;
      for(let c=1;c<4;c++){ctx.beginPath();ctx.moveTo(x+c*10,y);ctx.lineTo(x+c*10,y+25);ctx.stroke();}
    }
  }
  const tex=new THREE.CanvasTexture(canvas);
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.anisotropy=1;
  return tex;
}
function nearest(zones,x,z){
  let selected=0,best=Infinity;
  for(let i=0;i<zones.length;i++){
    const a=zones[i],dx=x-a.x,dz=z-a.z,dist=dx*dx+dz*dz;
    if(dist<best){best=dist;selected=i;}
  }
  return selected;
}
function kindAtlases(zone){
  const base=zone.atlas;
  if(zone.kind==="industrial")return [5,3,2];
  if(zone.kind==="resort"||zone.kind==="resort-villa")return [7,4,1];
  if(zone.kind==="historic")return [1,0,3];
  if(zone.kind==="modern-residential")return [4,3,6];
  if(zone.kind==="commercial"||zone.kind==="roadside-commercial")return [2,3,4];
  return [base,0,4];
}
export function createJcBuildingSkins(lowSpec,config){
  if(config?.schema!=="jc-neighborhood-skin-zones-v1"||
    config.stylesPerNeighborhood!==VARIANTS||
    !Array.isArray(config.zones)||config.zones.length<20||
    config.zones.some(z=>!Number.isFinite(z.x)||!Number.isFinite(z.z)||
      !roofColors[z.kind]||!palettes[z.palette]))
    throw new Error("JC neighborhood skin geography missing or invalid");
  const zones=config.zones,loader=new THREE.TextureLoader();
  const mats=[],facadeMapById=[],facadeRefs=Array.from({length:8},()=>[]);
  let loaded=0,failed=0;
  const fallback=document.createElement("canvas");
  fallback.width=fallback.height=128;
  const fc=fallback.getContext("2d",{alpha:false});
  fc.fillStyle="#343a43";fc.fillRect(0,0,128,128);
  for(let y=0;y<128;y+=16)for(let x=0;x<128;x+=16){
    fc.fillStyle=(x+y*3)%48===0?"#f8d9ac":"#657483";
    fc.fillRect(x+3,y+3,11,10);
  }
  const fallbackMap=new THREE.CanvasTexture(fallback);
  fallbackMap.colorSpace=THREE.SRGBColorSpace;
  facadeMapById.fill(fallbackMap,0,8);
  const bottom=new THREE.MeshStandardMaterial({color:0x655b50,roughness:1});
  for(let n=0;n<zones.length;n++){
    const zone=zones[n],wallIds=kindAtlases(zone);
    const topTexture=roofMap(zone.kind,roofColors[zone.kind],n);
    const roof=new THREE.MeshStandardMaterial({
      map:topTexture,roughness:lowSpec?0.92:0.82,metalness:zone.kind==="industrial"?0.30:0.04
    });
    for(let v=0;v<VARIANTS;v++){
      const tint=new THREE.Color(palettes[zone.palette]);
      const factor=[1,0.91,0.99][v];
      tint.multiplyScalar(factor);
      const idx=wallIds[v];
      const wall=new THREE.MeshStandardMaterial({
        map:facadeMapById[idx],color:tint,
        roughness:lowSpec?0.83:0.68,
        metalness=/resort|commercial|industrial|urban/.test(zone.kind)?0.25:0.07
      });
      facadeRefs[idx].push(wall);
      mats.push([wall,wall,roof,bottom,wall,wall]);
    }
  }
  for(let i=0;i<atlases.length;i++){
    loader.load(atlases[i]+"?rev="+REV,tex=>{
      tex.colorSpace=THREE.SRGBColorSpace;
      tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
      tex.anisotropy=lowSpec?1:2;
      facadeMapById[i]=tex;
      for(const material of facadeRefs[i]){material.map=tex;material.needsUpdate=true;}
      loaded++;
    },undefined,error=>{
      failed++;
      console.warn("JC neighborhood facade using safe atlas substitute",atlases[i],error);
    });
  }
  function neighborhood(worldX,worldZ){
    return nearest(zones,worldX,worldZ);
  }
  function index(col,row,localIndex,height=0,worldX=(col-8)*100+50,
    worldZ=-(row-8)*100-50,width=0){
    const z=neighborhood(worldX,worldZ);
    const variant=(localIndex+Math.floor(height/300)+
      Math.floor(width/500)+col*3+row)%VARIANTS;
    return z*VARIANTS+variant;
  }
  const api={
    materials:mats,index,neighborhood,atlasUrls:atlases,
    zones,profileCount:VARIANTS,stylesPerNeighborhood:VARIANTS,
    get loaded(){return loaded;},get failed(){return failed;},
    get total(){return mats.length;},get neighborhoods(){return zones.length;}
  };
  window.JC_BUILDING_SKINS=api;
  return api;
}
