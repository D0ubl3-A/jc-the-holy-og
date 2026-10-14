import * as THREE from "three";
import { createJcBuildingSkins } from "./jc-building-skins.js?rev=jc-houses-roads-v1";
import { createJcSkyOverview } from "./jc-sky-overview.js?rev=jc-houses-roads-v1";
import { createJcDetailedTerrain } from "./jc-detailed-terrain.js";
import { attachNeighborhoodHouses, houseBodyHeight } from "./jc-neighborhood-houses.js?rev=jc-houses-roads-v1";

/**
 * Optimized renderer for Las_Vegas_Editable_City_Part_2.zip.
 * The ZIP's 595 GLBs describe 216,807 NGA14 source building records.
 * Their exact local positions / bounding sizes are extracted offline to
 * library-city/tiles/*.json; not fabricated procedural placements.
 *
 * One draw call per active cell and selective terrain/collision streaming make
 * the city usable on phones without attempting a 262 MB unified GLB decode.
 * Requires a separate upload of the converted tiles asset folder.
 */
const base="./jc-the-holy-og-assets/library-city/";
const assetRev="jc-city-batches-20261014-v3";
const key=(col,row)=>"C"+String(col).padStart(2,"0")+"_R"+String(row).padStart(2,"0");
export async function installLibraryCity(worldRoot,player,lowSpec){
  let manifest;
  try{
    const res=await fetch(base+"manifest.json?rev="+assetRev,{cache:"no-store"});
    if(!res.ok)throw new Error("no published converted Library tile set (HTTP "+res.status+")");
    manifest=await res.json();
    if(manifest.schema!=="jc-library-city-v1"||manifest.tileCount!==595||
      manifest.buildingCount!==216807||manifest.batchSize!==10||
      manifest.batchCount!==60||!Array.isArray(manifest.batches)||
      manifest.batches.length!==60||manifest.tiles.some(t=>!t.batch))
      throw new Error("10-tile Library city batch manifest is absent or incomplete");
  }catch(error){
    window.JC_LIBRARY_CITY_STATUS={active:false,installed:false,reason:String(error.message||error),assetRev};
    console.warn("JC real city not ready; retry is available",error);
    return {active:false,update(){}};
  }
  // One canonical geographic style contract powers both detailed street
  // buildings and sky LOD. No neighborhood geometry is inferred from names.
  let neighborhoodConfig;
  try{
    const request=await fetch("./jc-map/neighborhood-skins.json?rev=jc-neighborhoods-v1",{cache:"no-store"});
    if(!request.ok)throw Error("neighborhood config HTTP "+request.status);
    neighborhoodConfig=await request.json();
    if(neighborhoodConfig?.schema!=="jc-neighborhood-skin-zones-v1")
      throw Error("invalid neighborhood style geography");
  }catch(error){
    console.warn("JC neighborhood style contract unavailable",error);
    window.JC_LIBRARY_CITY_STATUS={active:false,installed:false,reason:String(error?.message||error)};
    return {active:false,update(){}};
  }
  const group=new THREE.Group();
  group.name="JC_LIBRARY_REAL_595_TILE_CITY";
  worldRoot.add(group);
  const skins=createJcBuildingSkins(lowSpec,neighborhoodConfig);
  const geometry=skins.geometry;
  const sky=createJcSkyOverview(worldRoot,skins,lowSpec);
  const terrainDetail=createJcDetailedTerrain(worldRoot,manifest.tiles,player,lowSpec);
  // Sky terrain and silhouettes are prebuilt and small; do not block boot.
  void sky.load();
  const dummy=new THREE.Object3D();
  const imageryLoader=new THREE.TextureLoader();
  const groundShape=new THREE.PlaneGeometry(100,100);
  groundShape.rotateX(-Math.PI/2);
  const entries=new Map(manifest.tiles.map(t=>[key(t.c,t.r),t]));
  const visible=new Map(),inflight=new Set(),failedTiles=new Set();
  const loadedBatches=new Map(),downloadingBatches=new Map();
  let batchesDownloaded=0;
  const playerAt=()=>({
    col:8+Math.floor(player.pos.x/100),
    row:8+Math.floor(-player.pos.z/100)
  });
  let lastCell="",loadedBuildings=0,failed=0;
  const radius=lowSpec?1:2;
  const updateStatus=()=>{
    window.JC_LIBRARY_CITY_STATUS={
      active:true,installed:true,tileCount:595,
      sourceBuildings:216807,
      visibleTiles:visible.size,visibleBuildings:loadedBuildings,
      loading:inflight.size,failed,source:"Las_Vegas_Editable_City_Part_2.zip",
      batchSize:10,batchCount:60,
      batchesDownloaded, batchesCached:loadedBatches.size,
      activeTileIds:[...visible.keys()],
      skinsLoaded:skins.loaded,skinAtlasCount:skins.atlasUrls.length,
      neighborhoodCount:skins.neighborhoods,
      neighborhoodName:skins.zones[skins.neighborhood(player.pos.x,player.pos.z)]?.name,
      sky:sky.status(),
      terrainDetail:terrainDetail.status(),
      fidelity:"Source geometry proxy dimensions; original eight JC facade/wallpaper atlases on visible buildings"
    };
  };
  // A single HTTP request carries ten real source tile records. Rendering
  // remains localized: decode only the 3x3 tiles near JC on iPhone.
  async function tileFromTenPack(tile){
    const path=tile.batch,id=key(tile.c,tile.r);
    let pack=loadedBatches.get(path);
    if(!pack){
      let task=downloadingBatches.get(path);
      if(!task){
        task=(async()=>{
          const response=await fetch(base+path+"?rev="+assetRev,{cache:"no-store"});
          if(!response.ok)throw new Error("city ten-pack "+path+" HTTP "+response.status);
          const payload=await response.json();
          if(payload.schema!=="jc-library-10-tiles-v1"||
            !Array.isArray(payload.tiles)||!payload.tiles.length||
            payload.tiles.length>10)throw new Error("invalid ten-tile batch "+path);
          const decoded=new Map();
          for(const t of payload.tiles){
            if(t.v!==1||!Number.isInteger(t.col)||!Number.isInteger(t.row)||
              !Number.isInteger(t.n)||t.n<0||!Array.isArray(t.q)||
              t.q.length!==t.n*5)throw new Error("damaged batch "+path);
            decoded.set(key(t.col,t.row),t);
          }
          // Bound decoded cache independently of GPU meshes; a phone keeps
          // four ten-tile packs, not the 216K-building city in memory.
          loadedBatches.delete(path);loadedBatches.set(path,decoded);
          while(loadedBatches.size>(lowSpec?4:8)){
            loadedBatches.delete(loadedBatches.keys().next().value);
          }
          batchesDownloaded++;
          updateStatus();
          return decoded;
        })().finally(()=>downloadingBatches.delete(path));
        downloadingBatches.set(path,task);
      }
      pack=await task;
    }else{
      loadedBatches.delete(path);loadedBatches.set(path,pack);
    }
    const data=pack.get(id);
    if(!data||data.n!==tile.n)throw new Error("source city "+id+" missing in "+path);
    return data;
  }

  async function load(tile){
    const id=key(tile.c,tile.r);
    if(visible.has(id)||inflight.has(id)||failedTiles.has(id))return;
    inflight.add(id);updateStatus();
    try{
      const data=await tileFromTenPack(tile);
      if(data.v!==1||data.col!==undefined&&data.col!==tile.c||
        data.row!==undefined&&data.row!==tile.r||data.n!==tile.n||
        !Array.isArray(data.q)||data.q.length!==data.n*5){
        throw new Error("invalid source-derived "+id);
      }
      // Each q record uses X,Z,Height,Width,Depth in 0.01 JC world units.
      const counts=new Map(),groups=new Map();
      const styleFor=(j)=>{
        const i=j*5;
        const wx=(tile.c-8)*100+data.q[i]/100;
        const wz=-(tile.r-8)*100+data.q[i+1]/100;
        return skins.index(tile.c,tile.r,j,data.q[i+2],wx,wz,data.q[i+3]);
      };
      for(let j=0;j<data.n;j++){
        const style=styleFor(j);
        counts.set(style,(counts.get(style)||0)+1);
      }
      for(const [style,count] of counts){
        const instance=new THREE.InstancedMesh(geometry,skins.materials[style],count);
        instance.count=count;
        instance.name="JC_NEIGHBORHOOD_SKIN_"+style+"_"+id;
        instance.frustumCulled=false;
        instance.castShadow=false;instance.receiveShadow=false;
        groups.set(style,{mesh:instance,used:0});
      }
      const houseRecords=[];
      for(let j=0;j<data.n;j++){
        const i=j*5;
        const h=Math.max(0.2,data.q[i+2]/100);
        const w=Math.max(0.2,data.q[i+3]/100);
        const d=Math.max(0.2,data.q[i+4]/100);
        const x=(tile.c-8)*100+data.q[i]/100;
        const z=-(tile.r-8)*100+data.q[i+1]/100;
        const skin=styleFor(j);
        const home={x,z,h,w,d,style:skin};
        houseRecords.push(home);
        const bodyH=houseBodyHeight(home,skins);
        dummy.position.set(x,bodyH/2,z);
        dummy.scale.set(w,bodyH,d);
        dummy.rotation.set(0,0,0);
        dummy.updateMatrix();
        const slot=groups.get(skin);
        slot.mesh.setMatrixAt(slot.used++,dummy.matrix);
      }
      const meshes=[];
      for(const {mesh} of groups.values()){
        mesh.instanceMatrix.needsUpdate=true;
        group.add(mesh);
        meshes.push(mesh);
      }
      const houseDetails=attachNeighborhoodHouses(group,houseRecords,skins,{lowSpec});
      const record={meshes,houseDetails,count:data.n,ground:null,groundTexture:null};
      visible.set(id,record);
      // The user's same 595-tile ZIP contains NAIP imagery, pre-reduced to
      // 256px WebP at packaging time. Load only active tiles.
      imageryLoader.load(base+"imagery/"+id+".webp?rev="+assetRev,function(texture){
        if(visible.get(id)!==record){texture.dispose();return;}
        texture.colorSpace=THREE.SRGBColorSpace;
        texture.anisotropy=1;
        const tileMat=new THREE.MeshBasicMaterial({map:texture,color:0x989898,side:THREE.DoubleSide});
        const ground=new THREE.Mesh(groundShape,tileMat);
        ground.name="ARCHIVE_SOURCE_IMAGERY_"+id;
        ground.position.set((tile.c-8)*100+50,-0.13,-(tile.r-8)*100-50);
        ground.frustumCulled=true;
        group.add(ground);
        record.ground=ground;
        record.groundTexture=texture;
      },undefined,function(err){console.warn("JC terrain imagery unavailable",id,err);});

      loadedBuildings+=data.n;
      updateStatus();
    }catch(err){
      failed++;failedTiles.add(id);console.warn("JC Library city source tile unavailable",id,err);
    }finally{inflight.delete(id);updateStatus();queueMicrotask(()=>update(true));}
  }
  function unload(id){
    const item=visible.get(id);
    if(!item)return;
    for(const mesh of item.meshes){group.remove(mesh);mesh.dispose();}
    item.houseDetails?.dispose();
    if(item.ground){
      group.remove(item.ground);
      item.ground.material.dispose();
    }
    if(item.groundTexture)item.groundTexture.dispose();
    loadedBuildings-=item.count;
    visible.delete(id);
  }
  function update(force=false){
    const altitude=player.pos.y;
    const skyMode=sky.update(altitude,window.JC_FORCE_SKY_MAP===true);
    terrainDetail.update(force);
    group.visible=!skyMode;
    if(skyMode){
      // Camera-wide LOD substitutes for the old individual nearby instanced meshes.
      // Release them once in sky view to avoid double drawing on iPhones.
      if(visible.size)for(const id of [...visible.keys()])unload(id);
      lastCell="";
      updateStatus();
      return;
    }
    const cell=playerAt(), cellId=key(cell.col,cell.row);
    if(!force&&lastCell===cellId)return;
    lastCell=cellId;
    const wanted=[];
    for(let dc=-radius;dc<=radius;dc++)for(let dr=-radius;dr<=radius;dr++){
      const record=entries.get(key(cell.col+dc,cell.row+dr));
      if(record)wanted.push(record); // Include zero-building terrain-only cells.
    }
    for(const id of [...visible.keys()]){
      const parts=/C(\d+)_R(\d+)/.exec(id);
      const distance=Math.max(Math.abs(Number(parts[1])-cell.col),Math.abs(Number(parts[2])-cell.row));
      if(distance>radius+1)unload(id);
    }
    wanted.sort((a,b)=>
      (a.c-cell.col)**2+(a.r-cell.row)**2-
      ((b.c-cell.col)**2+(b.r-cell.row)**2));
    // Allow only a few network requests at once; all source geometry stays one world.
    let delayed=0;
    for(const tile of wanted){
      const id=key(tile.c,tile.r);
      if(visible.has(id)||inflight.has(id)||failedTiles.has(id))continue;
      if(delayed++>= (lowSpec?3:5))break;
      void load(tile);
    }
    updateStatus();
  }
  const api={active:true,group,manifest,update,sky,skins,terrainDetail,
    get loadedBuildings(){return loadedBuildings;},
    get visibleTiles(){return visible.size;},
    get batchesDownloaded(){return batchesDownloaded;},
    get batchCount(){return 60;},
    get failed(){return failed;},
    get activeTileIds(){return [...visible.keys()];}
  };
  update(true);
  window.JC_LIBRARY_CITY=api;
  return api;
}
