import * as THREE from "three";

/**
 * JC unified city: reflective architectural finish.
 * A small shared city-scene cubemap supplies actual scene reflections, while
 * two authored UV textures distinguish mirrored windows from opaque façades.
 * This does NOT run a dedicated mirror camera on each building.
 */
export function createCityMirrorFinish(scene,renderer,lowSpec){
  const facade=document.createElement("canvas");
  facade.width=256;facade.height=256;
  const fc=facade.getContext("2d",{alpha:false});
  fc.fillStyle="#222d3b";fc.fillRect(0,0,256,256);
  const properties=document.createElement("canvas");
  properties.width=256;properties.height=256;
  const pc=properties.getContext("2d",{alpha:false});
  // R unused; green = roughness, blue = metalness for standard PBR maps.
  pc.fillStyle="rgb(0,210,45)";pc.fillRect(0,0,256,256);
  for(let y=0;y<256;y+=32){
    for(let x=0;x<256;x+=32){
      const lit=((x/32)*7+(y/32)*11)%9===0;
      fc.fillStyle=lit?"#b2c7d9":"#182b40";
      fc.fillRect(x+3,y+3,26,25);
      fc.fillStyle="rgba(97,173,213,.4)";fc.fillRect(x+4,y+4,22,2);
      fc.fillStyle="#707880";fc.fillRect(x+1,y+28,30,2);
      pc.fillStyle="rgb(0,27,245)";pc.fillRect(x+3,y+3,26,25);
      pc.fillStyle="rgb(0,174,124)";pc.fillRect(x+1,y+28,30,2);
    }
  }
  const facadeMap=new THREE.CanvasTexture(facade);
  facadeMap.colorSpace=THREE.SRGBColorSpace;
  const glassProperties=new THREE.CanvasTexture(properties);
  glassProperties.colorSpace=THREE.NoColorSpace;
  for(const t of [facadeMap,glassProperties]){
    t.wrapS=t.wrapT=THREE.RepeatWrapping;
    t.repeat.set(5,5);
    t.anisotropy=lowSpec?1:2;
  }
  const worldScale=new THREE.Vector3(),boundsSize=new THREE.Vector3();
  const rewritten=new WeakMap();
  let applied=0,skipped=0,captures=0,probing=false;
  const rt=new THREE.WebGLCubeRenderTarget(lowSpec?64:128,{
    generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter,
    colorSpace:THREE.SRGBColorSpace
  });
  rt.texture.mapping=THREE.CubeReflectionMapping;
  const probe=new THREE.CubeCamera(0.5,4000,rt);
  const excluded=/road|ground|terrain|asphalt|pavement|lane|sidewalk|grass|water|sky|collision|curb|foundation/i;

  function applyGroup(root){
    if(!root)return 0;
    root.updateMatrixWorld(true);
    let changed=0;
    root.traverse(o=>{
      if(!o.isMesh||!o.geometry)return;
      const label=[o.name,o.parent?.name,o.material?.name].join(" ");
      if(excluded.test(label)){skipped++;return;}
      const geometry=o.geometry;
      if(!geometry.boundingBox)geometry.computeBoundingBox();
      if(!geometry.boundingBox)return;
      geometry.boundingBox.getSize(boundsSize);
      o.getWorldScale(worldScale);
      const height=Math.abs(boundsSize.y*worldScale.y);
      const width=Math.abs(boundsSize.x*worldScale.x),depth=Math.abs(boundsSize.z*worldScale.z);
      // Skip flat earth/roofs, roads, and micro-detail. High vertical geometry
      // is a façade, spire, building body, or other architectural surface.
      if(height<1.8||Math.max(width,depth)<0.5){skipped++;return;}
      const materials=Array.isArray(o.material)?o.material:[o.material];
      const prepared=materials.map(original=>{
        if(!original||!original.isMeshStandardMaterial)return original;
        if(rewritten.has(original))return rewritten.get(original);
        const m=original.clone();
        const hasUv=!!geometry.attributes.uv;
        if(!m.map&&hasUv)m.map=facadeMap;
        // Don't replace original building photo textures. Provide real
        // environment reflection + glossy window roughness/metalness textures.
        m.metalness=lowSpec?0.20:0.9; // Avoid black metal glass when cube reflections are disabled on phones.
        m.roughness=lowSpec?0.48:0.28;
        m.envMapIntensity=lowSpec?0.5:1.9;
        if(hasUv){
          m.roughnessMap=glassProperties;
          m.metalnessMap=glassProperties;
        }else{
          m.roughness=lowSpec?0.46:0.11;
          m.metalness=lowSpec?0.2:0.78;
        }
        m.needsUpdate=true;
        rewritten.set(original,m);
        return m;
      });
      o.material=Array.isArray(o.material)?prepared:prepared[0];
      changed++;
    });
    applied+=changed;
    return changed;
  }
  let lastCapture=0,lastPosition=null;
  function capture(player,force=false){
    if(probing||!player||!scene||!renderer||!player.pos)return false;
    const now=performance.now();
    if(!force){
      if(lowSpec)return false; // Skip GPU cube capture entirely on iPhone.
      if(now-lastCapture<20000)return false;
      if(lastPosition&&lastPosition.distanceTo(player.pos)<450)return false;
    }
    probing=true;
    const oldEnvironment=scene.environment;
    const playerMesh=player.root;
    const oldPlayerVisible=playerMesh?.visible;
    try{
      if(playerMesh)playerMesh.visible=false;
      // Avoid recursively reflecting the previous cubemap into itself.
      scene.environment=null;
      probe.position.copy(player.pos).add(new THREE.Vector3(0,12,0));
      probe.update(renderer,scene);
      scene.environment=rt.texture;
      captures++;lastCapture=now;lastPosition=player.pos.clone();
      return true;
    }catch(e){
      console.warn("JC reflection probe unavailable",e);
      scene.environment=oldEnvironment;
      return false;
    }finally{
      if(playerMesh)playerMesh.visible=oldPlayerVisible;
      probing=false;
    }
  }
  const api={
    applyGroup,capture,
    get reflectiveMeshes(){return applied;},
    get excludedMeshes(){return skipped;},
    get reflectionCaptures(){return captures;},
    reflectionTexture:rt.texture,
    sharedFacadeTexture:facadeMap,
    sharedGlassProperties:glassProperties,
    mode:"CITY-SCENE MIRROR GLASS · UV PBR + CUBEMAP"
  };
  window.JC_MIRROR_FINISH=api;
  return api;
}
