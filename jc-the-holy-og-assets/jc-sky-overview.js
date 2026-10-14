import * as THREE from "three";

/**
 * Persistently renders the *entire* 595-tile Library geographic area from sky.
 * A single 1088x2240 WebP mosaics every one of the 595 aerial source images.
 * Eight instanced facade-skin groups render source-aligned LOD representatives
 * from all 216807 building records (not 216807 full meshes on mobile).
 */
const rootPath="./jc-the-holy-og-assets/library-city/";
const REV="jc-city-sky-v1-20261014";

export function createJcSkyOverview(parent,skins,lowSpec){
  const root=new THREE.Group();
  root.name="JC_COMPLETE_AERIAL_595_CITY_MAP";
  root.visible=false;
  parent.add(root);
  const skyBuildings=new THREE.Group();
  skyBuildings.name="JC_ALL_BUILDINGS_SKINNED_SKY_LOD";
  root.add(skyBuildings);
  let terrain=null,ready=false,failed=null,loading=null,rendered=0,sourceCount=0;
  const worldBounds={colMin:18,colMax:34,rowMin:0,rowMax:34,x:1850,z:-950,width:1700,depth:3500};
  const summary=()=>({
    ready,failed:failed?String(failed.message||failed):null,
    skyActive:root.visible,terrainActive:!!terrain?.visible,
    skinnedBuildingsVisible:skyBuildings.visible&&root.visible?rendered:0,
    skinnedSamples:rendered,sourceBuildings:sourceCount,
    sourceTiles:595,atlasSkins:skins.total,skinsLoaded:skins.loaded,
    terrainPx:"1088 × 2240",bounds:worldBounds
  });
  function update(y,force=false){
    const terrainShow=ready&&(force||y>=140);
    root.visible=terrainShow;
    skyBuildings.visible=ready&&(force||y>=260);
    if(terrain)terrain.visible=terrainShow;
    window.JC_SKY_CITY_STATUS=summary();
    return skyBuildings.visible&&root.visible;
  }
  async function load(){
    if(loading)return loading;
    loading=(async()=>{
      const source=await fetch(rootPath+"sky/overview.json?rev="+REV,{cache:"no-store"});
      if(!source.ok)throw Error("JC sky overview absent HTTP "+source.status);
      const data=await source.json();
      if(data.schema!=="jc-library-sky-lod-v1"||
        data.sourceTileCount!==595||data.sourceBuildingCount!==216807||
        data.skins!==8||!Array.isArray(data.q)||
        data.q.length!==data.sampleBuildingCount*6||
        data.sampleBuildingCount>14875||
        !data.sampleBuildingCount)throw Error("JC aerial source overview failed integrity validation");
      const tex=await new THREE.TextureLoader().loadAsync(rootPath+"sky/terrain.webp?rev="+REV);
      tex.colorSpace=THREE.SRGBColorSpace;
      tex.anisotropy=lowSpec?1:2;
      tex.minFilter=THREE.LinearMipmapLinearFilter;
      tex.magFilter=THREE.LinearFilter;
      const ground=new THREE.Mesh(
        new THREE.PlaneGeometry(worldBounds.width,worldBounds.depth),
        new THREE.MeshBasicMaterial({
          map:tex,color:0xffffff,side:THREE.DoubleSide,
          toneMapped:false,depthWrite:true
        })
      );
      ground.name="JC_595_SOURCE_AERIAL_TILE_MOSAIC";
      ground.rotation.x=-Math.PI/2;
      ground.position.set(worldBounds.x,-0.26,worldBounds.z);
      ground.frustumCulled=false;
      ground.visible=false;
      terrain=ground;
      root.add(ground);
      const counts=Array(8).fill(0);
      for(let i=5;i<data.q.length;i+=6){
        const skin=data.q[i];
        if(!Number.isInteger(skin)||skin<0||skin>7)throw Error("Invalid facade skin in aerial overview");
        counts[skin]++;
      }
      const geometry=new THREE.BoxGeometry(1,1,1);
      const meshes=skins.materials.map((mat,index)=>{
        const mesh=new THREE.InstancedMesh(geometry,mat,Math.max(1,counts[index]));
        mesh.count=counts[index];
        mesh.frustumCulled=false;
        mesh.castShadow=false;mesh.receiveShadow=false;
        mesh.name="JC_SKINNED_SKY_BUILDINGS_"+index;
        skyBuildings.add(mesh);
        return mesh;
      });
      const used=Array(8).fill(0),dummy=new THREE.Object3D();
      for(let i=0;i<data.q.length;i+=6){
        const x=data.q[i]/100,z=data.q[i+1]/100;
        const h=Math.max(0.40,data.q[i+2]/100);
        const w=Math.max(0.30,data.q[i+3]/100);
        const d=Math.max(0.30,data.q[i+4]/100);
        const skin=data.q[i+5];
        dummy.position.set(x,h/2,z);
        dummy.scale.set(w,h,d);
        dummy.updateMatrix();
        meshes[skin].setMatrixAt(used[skin]++,dummy.matrix);
      }
      for(const mesh of meshes)mesh.instanceMatrix.needsUpdate=true;
      rendered=data.sampleBuildingCount;
      sourceCount=data.sourceBuildingCount;
      ready=true;
      update(0,false);
      return summary();
    })().catch(error=>{
      failed=error;window.JC_SKY_CITY_STATUS=summary();
      console.warn("JC full aerial city overview unavailable",error);
      return summary();
    });
    return loading;
  }
  window.JC_SKY_CITY={root,update,load,status:summary,worldBounds};
  window.JC_SKY_CITY_STATUS=summary();
  return {root,update,load,status:summary,worldBounds,
    get ready(){return ready;},get rendered(){return rendered;}
  };
}
