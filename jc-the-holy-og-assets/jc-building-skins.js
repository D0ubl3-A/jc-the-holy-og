import * as THREE from "three";

/**
 * Eight actual, checked-in JC building-skin atlases. The source Library
 * building geometry does NOT contain one unique facade photograph per record.
 * Assign skins deterministically to every displayed source building instead
 * of implying parcel-specific textures that are not present in the archive.
 */
const atlases=[
  "./jc-the-holy-og-assets/swarm/buildings/facade-atlas-01.jpg",
  "./jc-the-holy-og-assets/swarm/buildings/facade-atlas-02.jpg",
  "./jc-the-holy-og-assets/swarm/buildings/facade-atlas-03.jpg",
  "./jc-the-holy-og-assets/swarm/buildings/facade-atlas-04.jpg",
  "./jc-the-holy-og-assets/swarm/buildings/facade-atlas-05.jpg",
  "./jc-the-holy-og-assets/swarm/buildings/facade-atlas-06.jpg",
  "./jc-the-holy-og-assets/textures/residential-wallpaper-atlas.jpg",
  "./jc-the-holy-og-assets/textures/strip-wallpaper-atlas.jpg",
];
const REV="jc-facades-sky-20261014-v1";
export function createJcBuildingSkins(lowSpec){
  const loader=new THREE.TextureLoader();
  const mats=[];
  let loaded=0,failed=0;
  const fallback=document.createElement("canvas");
  fallback.width=fallback.height=128;
  const ctx=fallback.getContext("2d",{alpha:false});
  ctx.fillStyle="#313b51";ctx.fillRect(0,0,128,128);
  for(let y=0;y<128;y+=16)for(let x=0;x<128;x+=16){
    ctx.fillStyle=(x+y*3)%48===0?"#fee0a0":"#61748d";
    ctx.fillRect(x+3,y+3,11,10);
  }
  const fallbackTexture=new THREE.CanvasTexture(fallback);
  fallbackTexture.colorSpace=THREE.SRGBColorSpace;
  for(const url of atlases){
    const mat=new THREE.MeshStandardMaterial({
      map:fallbackTexture,
      color:0xffffff,
      metalness:lowSpec?0.14:0.42,
      roughness:lowSpec?0.72:0.5,
      side:THREE.FrontSide
    });
    mats.push(mat);
    loader.load(url+"?rev="+REV,(tex)=>{
      tex.colorSpace=THREE.SRGBColorSpace;
      tex.anisotropy=lowSpec?1:2;
      tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
      mat.map=tex;mat.needsUpdate=true;
      loaded++;
    },undefined,(error)=>{
      failed++;
      console.warn("JC facade skin fell back to window atlas",url,error);
    });
  }
  function index(col,row,localIndex,height=0){
    // Stable facade art across ground↔sky transitions and across reloads.
    const raw=(col*17+row*31+localIndex*13+Math.trunc(height/130))>>>0;
    // Reserve dedicated residential wallpaper for low buildings, but keep
    // source map styles visibly diverse rather than rendering plain boxes.
    if(col<=20&&raw%13===0)return 7; // Strip-side casino facade skin.
    if(height<260&&raw%3===0)return 6; // Residential-specific wallpaper.
    return raw%6;
  }
  const api={
    materials:mats,index,atlasUrls:atlases,
    get loaded(){return loaded;},get failed(){return failed;},
    get total(){return atlases.length;}
  };
  window.JC_BUILDING_SKINS=api;
  return api;
}
