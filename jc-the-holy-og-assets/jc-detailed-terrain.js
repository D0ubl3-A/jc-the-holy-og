import * as THREE from "three";

/**
 * Stream detailed 256px source aerial tiles over the always-on 595 tile mosaic.
 * Near ground can be crisp across the horizon without decoding 216807 meshes.
 * Tiles are geographic and retain the exact Cxx_Ryy placement contract.
 */
const BASE="./jc-the-holy-og-assets/library-city/imagery/";
const REV="jc-city-terrain-continuity-v1-20261014";
const idFor=(col,row)=>"C"+String(col).padStart(2,"0")+"_R"+String(row).padStart(2,"0");

export function createJcDetailedTerrain(root,tiles,player,lowSpec){
  const tileSet=new Set(tiles.map(t=>idFor(t.c,t.r)));
  const layer=new THREE.Group();
  layer.name="JC_CONTINUOUS_DETAILED_AERIAL_TILES";
  root.add(layer);
  const geometry=new THREE.PlaneGeometry(100,100);
  geometry.rotateX(-Math.PI/2);
  const loader=new THREE.TextureLoader();
  const active=new Map();
  const fetching=new Set(), failed=new Set(),queue=[];
  const radius=lowSpec?4:6;
  const concurrency=lowSpec?3:5;
  let lastCell="",loaded=0;
  let requests=0,errors=0;

  function unload(id){
    const entry=active.get(id);
    if(!entry)return;
    layer.remove(entry.mesh);
    entry.mesh.material.dispose();
    entry.texture.dispose();
    active.delete(id);
  }
  function summary(){
    return {
      sourceTiles:tileSet.size,
      terrainRadius:radius,
      terrainVisible:active.size,
      terrainLoading:fetching.size,
      terrainQueued:queue.length,
      imageLoads:loaded,
      errors,
      source:"Library 595 actual NAIP aerial tiles, 256px each"
    };
  }
  function pump(){
    while(fetching.size<concurrency&&queue.length){
      const item=queue.shift(), id=item.id;
      if(active.has(id)||fetching.has(id)||failed.has(id))continue;
      fetching.add(id);requests++;
      loader.load(BASE+id+".webp?rev="+REV,tex=>{
        fetching.delete(id);
        if(!tileSet.has(id)||!wanted.has(id)){tex.dispose();pump();return;}
        tex.colorSpace=THREE.SRGBColorSpace;
        tex.anisotropy=1;
        tex.minFilter=THREE.LinearMipmapLinearFilter;
        tex.magFilter=THREE.LinearFilter;
        const material=new THREE.MeshBasicMaterial({
          map:tex,color:0xffffff,
          side:THREE.DoubleSide,toneMapped:false,depthWrite:true
        });
        const mesh=new THREE.Mesh(geometry,material);
        mesh.name="JC_HIGH_RES_AERIAL_"+id;
        mesh.position.set((item.col-8)*100+50,-0.055,-(item.row-8)*100-50);
        mesh.frustumCulled=true;
        mesh.renderOrder=1;
        layer.add(mesh);
        active.set(id,{mesh,texture:tex});
        loaded++;
        pump();
      },undefined,error=>{
        fetching.delete(id);failed.add(id);errors++;
        console.warn("JC detailed satellite tile missing",id,error);
        pump();
      });
    }
    window.JC_TERRAIN_CONTINUITY=summary();
  }
  let wanted=new Set();
  function update(force=false){
    const col=8+Math.floor(player.pos.x/100),row=8+Math.floor(-player.pos.z/100);
    const cell=idFor(col,row);
    if(!force&&cell===lastCell)return;
    lastCell=cell;
    const next=[];
    for(let dc=-radius;dc<=radius;dc++)for(let dr=-radius;dr<=radius;dr++){
      const x=col+dc,z=row+dr,id=idFor(x,z);
      if(!tileSet.has(id))continue;
      const dist=dc*dc+dr*dr;
      // Prefer flight direction slightly, but do not block center ground.
      const vx=player.velocity?.x||0,vz=player.velocity?.z||0;
      const forward= vx*dc-vz*dr;
      next.push({id,col:x,row:z,dist:dist-Math.min(4,forward/500)});
    }
    next.sort((a,b)=>a.dist-b.dist);
    wanted=new Set(next.map(t=>t.id));
    for(const id of [...active.keys()])if(!wanted.has(id))unload(id);
    queue.length=0;
    for(const item of next)if(!active.has(item.id)&&!fetching.has(item.id)&&!failed.has(item.id))queue.push(item);
    pump();
  }
  const api={layer,update,status:summary,get visible(){return active.size;},get loading(){return fetching.size;}};
  window.JC_TERRAIN_CONTINUITY=summary();
  update(true);
  return api;
}
