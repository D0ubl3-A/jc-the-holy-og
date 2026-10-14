import * as THREE from "three";

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
const key=(col,row)=>"C"+String(col).padStart(2,"0")+"_R"+String(row).padStart(2,"0");
const metersPerGameUnit=10;
export async function installLibraryCity(worldRoot,player,lowSpec){
  let manifest;
  try{
    const res=await fetch(base+"manifest.json",{cache:"force-cache"});
    if(!res.ok)throw new Error("no published converted Library tile set (HTTP "+res.status+")");
    manifest=await res.json();
    if(manifest.schema!=="jc-library-city-v1"||manifest.tileCount!==595||
      manifest.buildingCount!==216807)throw new Error("incomplete or mismatched Library city manifest");
  }catch(error){
    window.JC_LIBRARY_CITY_STATUS={active:false,installed:false,reason:String(error.message||error)};
    return {active:false,update(){}};
  }
  const group=new THREE.Group();
  group.name="JC_LIBRARY_REAL_595_TILE_CITY";
  worldRoot.add(group);
  const geometry=new THREE.BoxGeometry(1,1,1);
  const material=new THREE.MeshStandardMaterial({
    color:0xc6c8d5,roughness:lowSpec?0.48:0.28,
    metalness:lowSpec?0.18:0.56
  });
  const dummy=new THREE.Object3D();
  const imageryLoader=new THREE.TextureLoader();
  const groundShape=new THREE.PlaneGeometry(100,100);
  groundShape.rotateX(-Math.PI/2);
  const color=new THREE.Color();
  const entries=new Map(manifest.tiles.map(t=>[key(t.c,t.r),t]));
  const visible=new Map(),inflight=new Set(),failedTiles=new Set();
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
      fidelity:"Source positions and AABB dimensions; simplified PBR building meshes"
    };
  };
  async function load(tile){
    const id=key(tile.c,tile.r);
    if(visible.has(id)||inflight.has(id)||failedTiles.has(id))return;
    inflight.add(id);updateStatus();
    try{
      const response=await fetch(base+tile.file,{cache:"force-cache"});
      if(!response.ok)throw new Error(id+" HTTP "+response.status);
      const data=await response.json();
      if(data.v!==1||data.col!==undefined&&data.col!==tile.c||
        data.row!==undefined&&data.row!==tile.r||data.n!==tile.n||
        !Array.isArray(data.q)||data.q.length!==data.n*5){
        throw new Error("invalid source-derived "+id);
      }
      // Each q record uses X,Z,Height,Width,Depth in 0.01 JC world units.
      const mesh=new THREE.InstancedMesh(geometry,material,data.n||1);
      mesh.count=data.n;
      mesh.name="LIBRARY_SOURCE_"+id;
      mesh.frustumCulled=false;
      mesh.castShadow=false;mesh.receiveShadow=false;
      for(let j=0;j<data.n;j++){
        const i=j*5;
        const h=Math.max(0.2,data.q[i+2]/100);
        const w=Math.max(0.2,data.q[i+3]/100);
        const d=Math.max(0.2,data.q[i+4]/100);
        const x=(tile.c-8)*100+data.q[i]/100;
        const z=-(tile.r-8)*100+data.q[i+1]/100;
        dummy.position.set(x,h/2,z);
        dummy.scale.set(w,h,d);
        dummy.rotation.set(0,0,0);
        dummy.updateMatrix();
        mesh.setMatrixAt(j,dummy.matrix);
        const tint=(j*37+tile.c*17+tile.r*11)%14;
        color.setHSL(tint===0?0.10:0.61,0.08+tint*0.016,0.18+(tint%6)*0.045);
        mesh.setColorAt(j,color);
      }
      mesh.instanceMatrix.needsUpdate=true;
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
      group.add(mesh);
      const record={mesh,count:data.n,ground:null,groundTexture:null};
      visible.set(id,record);
      // The user's same 595-tile ZIP contains NAIP imagery, pre-reduced to
      // 256px WebP at packaging time. Load only active tiles.
      imageryLoader.load(base+"imagery/"+id+".webp",function(texture){
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
    group.remove(item.mesh);
    item.mesh.dispose();
    if(item.ground){
      group.remove(item.ground);
      item.ground.material.dispose();
    }
    if(item.groundTexture)item.groundTexture.dispose();
    loadedBuildings-=item.count;
    visible.delete(id);
  }
  function update(force=false){
    const cell=playerAt(), cellId=key(cell.col,cell.row);
    if(!force&&lastCell===cellId)return;
    lastCell=cellId;
    const wanted=[];
    for(let dc=-radius;dc<=radius;dc++)for(let dr=-radius;dr<=radius;dr++){
      const record=entries.get(key(cell.col+dc,cell.row+dr));
      if(record?.n)wanted.push(record);
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
  const api={active:true,group,manifest,update,
    get loadedBuildings(){return loadedBuildings;},
    get visibleTiles(){return visible.size;},
    get failed(){return failed;}
  };
  update(true);
  window.JC_LIBRARY_CITY=api;
  return api;
}
