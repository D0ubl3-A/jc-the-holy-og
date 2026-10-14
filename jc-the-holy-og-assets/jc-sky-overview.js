import * as THREE from "three";
import { attachNeighborhoodHouses, houseBodyHeight } from "./jc-neighborhood-houses.js?rev=jc-houses-roads-v1";

/**
 * Persistently renders the *entire* 595-tile Library geographic area from sky.
 * A 1632x3360 WebP mosaics every one of the 595 aerial source images.
 * Neighborhood-specific facade and roof material groups render LOD representatives
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
    sourceTiles:595,atlasSkins:skins.atlasUrls.length,skinsLoaded:skins.loaded,
    neighborhoods:skins.neighborhoods,neighborhoodMaterials:skins.total,
    terrainPx:"1632 × 3360",bounds:worldBounds
  });
  function update(y,force=false){
    // Continuous ground at every altitude. Earlier 140m cutoff caused the
    // blank gray surface in front of JC when flying near the ground.
    const terrainShow=ready;
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
        data.skins!==skins.total||data.neighborhoods!==skins.neighborhoods||
        !Array.isArray(data.q)||
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
      const counts=new Map();
      for(let i=5;i<data.q.length;i+=6){
        const skin=data.q[i];
        if(!Number.isInteger(skin)||skin<0||skin>=skins.total)
          throw Error("Invalid neighborhood skin in aerial overview");
        counts.set(skin,(counts.get(skin)||0)+1);
      }
      const geometry=skins.geometry;
      const meshes=new Map();
      for(const [style,count] of counts){
        const mesh=new THREE.InstancedMesh(geometry,skins.materials[style],count);
        mesh.count=count;
        mesh.frustumCulled=false;
        mesh.castShadow=false;mesh.receiveShadow=false;
        mesh.name="JC_NEIGHBORHOOD_SKY_BUILDINGS_"+style;
        skyBuildings.add(mesh);
        meshes.set(style,{mesh,used:0});
      }
      const dummy=new THREE.Object3D(),homes=[];
      for(let i=0;i<data.q.length;i+=6){
        const x=data.q[i]/100,z=data.q[i+1]/100;
        const h=Math.max(0.40,data.q[i+2]/100);
        const w=Math.max(0.30,data.q[i+3]/100);
        const d=Math.max(0.30,data.q[i+4]/100);
        const skin=data.q[i+5];
        const rec={x,z,h,w,d,style:skin};
        homes.push(rec);
        const bodyH=houseBodyHeight(rec,skins);
        dummy.position.set(x,bodyH/2,z);
        dummy.scale.set(w,bodyH,d);
        dummy.updateMatrix();
        const slot=meshes.get(skin);
        slot.mesh.setMatrixAt(slot.used++,dummy.matrix);
      }
      for(const {mesh} of meshes.values())mesh.instanceMatrix.needsUpdate=true;
      attachNeighborhoodHouses(skyBuildings,homes,skins,{sky:true,lowSpec});
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
