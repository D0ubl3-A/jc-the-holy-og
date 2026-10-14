import * as THREE from "three";

/**
 * Actual OpenStreetMap-derived Las Vegas road polylines checked into jc-map.
 * Paint mapped local roads as asphalt, with width-aware lanes, curbs and
 * sidewalks; no synthetic road geometry or guessed intersection connections.
 * Streams 3x3 / 5x5 cells only; the full aerial NAIP mosaic already includes
 * distant road imagery at high altitude.
 */
const BASE="./jc-map/roads/";
const REV="jc-paved-streetscape-20261014-v2";
const tileKey=(c,r)=>"C"+String(c).padStart(2,"0")+"_R"+String(r).padStart(2,"0");

export async function createJcPavedRoads(worldRoot,player,lowSpec){
  const root=new THREE.Group();
  root.name="JC_REAL_OSM_PAVED_STREETS";
  worldRoot.add(root);
  let manifest;
  try{
    const response=await fetch(BASE+"manifest.json?rev="+REV,{cache:"no-store"});
    if(!response.ok)throw Error("road manifest HTTP "+response.status);
    manifest=await response.json();
    if(manifest.version!==1||manifest.origin?.col!==8||
      manifest.origin?.row!==8||!Array.isArray(manifest.tiles)||!manifest.tiles.length)
      throw Error("invalid geographic paving manifest");
  }catch(err){
    root.visible=false;
    const status={ready:false,reason:String(err?.message||err)};
    window.JC_PAVED_ROADS_STATUS=status;
    return {ready:false,root,update(){},status:()=>status};
  }
  const entries=new Map(manifest.tiles.map(t=>[tileKey(t.col,t.row),t]));
  const radius=lowSpec?1:2, limit=lowSpec?2:4;
  const asphaltCanvas=document.createElement("canvas");
  asphaltCanvas.width=asphaltCanvas.height=128;
  const ctx=asphaltCanvas.getContext("2d",{alpha:false});
  ctx.fillStyle="#404146";ctx.fillRect(0,0,128,128);
  // Tiny deterministic specks and patchwork add asphalt grain without extra GPU textures.
  for(let i=0;i<1400;i++){
    const x=(i*47+Math.floor(i/19)*73)%128;
    const y=(i*31+Math.floor(i/7)*53)%128;
    ctx.fillStyle=i%3===0?"#525256":i%3===1?"#34373c":"#49494a";
    ctx.fillRect(x,y,i%4===0?2:1,i%5===0?2:1);
  }
  const asphaltTex=new THREE.CanvasTexture(asphaltCanvas);
  asphaltTex.colorSpace=THREE.SRGBColorSpace;
  asphaltTex.wrapS=asphaltTex.wrapT=THREE.RepeatWrapping;
  asphaltTex.anisotropy=1;
  const mats={
    motorway:new THREE.MeshStandardMaterial({map:asphaltTex,color:0xdddddd,roughness:0.96,metalness:0,side:THREE.DoubleSide}),
    arterial:new THREE.MeshStandardMaterial({map:asphaltTex,color:0xbcbcbc,roughness:0.96,metalness:0,side:THREE.DoubleSide}),
    residential:new THREE.MeshStandardMaterial({map:asphaltTex,color:0xa3a3a3,roughness:0.99,metalness:0,side:THREE.DoubleSide}),
    service:new THREE.MeshStandardMaterial({map:asphaltTex,color:0x888888,roughness:1,metalness:0,side:THREE.DoubleSide}),
    sidewalk:new THREE.MeshStandardMaterial({color:0xb5ad9f,roughness:0.94,metalness:0,side:THREE.DoubleSide}),
    curb:new THREE.MeshStandardMaterial({color:0x88847e,roughness:0.96,metalness:0,side:THREE.DoubleSide}),
    median:new THREE.MeshStandardMaterial({color:0x8b806c,roughness:1,metalness:0,side:THREE.DoubleSide}),
    white:new THREE.MeshBasicMaterial({color:0xe7e7db,side:THREE.DoubleSide}),
    yellow:new THREE.MeshBasicMaterial({color:0xf5cc47,side:THREE.DoubleSide})
  };
  const poleGeom=new THREE.CylinderGeometry(.033,.046,1,5);
  const lampGeom=new THREE.BoxGeometry(.16,.055,.14);
  const lampPoleMat=new THREE.MeshStandardMaterial({color:0x6b747c,metalness:.28,roughness:.7});
  const lampHeadMat=new THREE.MeshStandardMaterial({
    color:0xffe5ac,emissive:0xeab86b,emissiveIntensity:1.35,
    roughness:.48,metalness:.15
  });
  const cells=new Map(),pending=new Set(),failed=new Set();
  let loadedSegments=0,loadedLamps=0,loadedCrossings=0,lastCell="",loadedTiles=0,errors=0;
  const classify=h=>/motorway|trunk/.test(h)?"motorway":
    /primary|secondary|tertiary/.test(h)?"arterial":
    /residential|living_street|unclassified/.test(h)?"residential":"service";
  function pushQuad(arr,ax,az,bx,bz,halfWidth,y,shift=0,clipStart=0,clipEnd=1){
    let dx=bx-ax,dz=bz-az;
    const len=Math.hypot(dx,dz);
    if(len<0.06)return;
    const nx=-dz/len,nz=dx/len;
    const sx=ax+dx*clipStart+nx*shift,sz=az+dz*clipStart+nz*shift;
    const ex=ax+dx*clipEnd+nx*shift,ez=az+dz*clipEnd+nz*shift;
    const left=[sx+nx*halfWidth,y,sz+nz*halfWidth];
    const right=[sx-nx*halfWidth,y,sz-nz*halfWidth];
    const tailLeft=[ex+nx*halfWidth,y,ez+nz*halfWidth];
    const tailRight=[ex-nx*halfWidth,y,ez-nz*halfWidth];
    arr.push(...left,...right,...tailLeft,...right,...tailRight,...tailLeft);
  }
  function buildTile(data,rec){
    const buckets={
      motorway:[],arterial:[],residential:[],service:[],
      sidewalk:[],curb:[],median:[],white:[],yellow:[]
    };
    const lamps=[];
    const lampLimit=lowSpec?17:32;
    const roadEnds=new Map();
    // Two or more OSM ways may meet at a recorded shared junction.
    // Decorations appear only at actual matching nodes, not at guessed
    // intersections inferred from crossing aerial pixels.
    const endpointKey=(x,z)=>Math.round(x*20)+":"+Math.round(z*20);
    for(const road of data.roads||[]){
      const p=road.p;
      if(!Array.isArray(p)||p.length<2)continue;
      if(!/primary|secondary|tertiary|residential|unclassified/i.test(road.h||""))continue;
      for(const endpoint of [p[0],p[p.length-1]]){
        if(!Array.isArray(endpoint))continue;
        const key=endpointKey(endpoint[0],endpoint[1]);
        roadEnds.set(key,(roadEnds.get(key)||0)+1);
      }
    }
    const paintedCrossings=new Set();
    let paved=0;
    for(const road of data.roads||[]){
      const pts=road.p,kind=classify(road.h||"");
      // Cycle paths and footpaths are not vehicle streets.
      if(!Array.isArray(pts)||pts.length<2||road.t==="yes"||
        /cycleway|footway|pedestrian|path|steps|bridleway/.test(road.h||""))continue;
      const width=Math.max(.26,Math.min(3.8,Number(road.w)||.5));
      // Tile local planar geometry uses the same +/- world coordinate
      // orientation as the published source road registry.
      for(let j=1;j<pts.length;j++){
        const a=pts[j-1],b=pts[j];
        if(!Array.isArray(a)||!Array.isArray(b))continue;
        const ax=Number(a[0]),az=Number(a[1]),bx=Number(b[0]),bz=Number(b[1]);
        if(![ax,az,bx,bz].every(Number.isFinite))continue;
        const len=Math.hypot(bx-ax,bz-az);
        if(len<.06)continue;
        paved++;
        const height=road.b==="yes"?.25:.086;
        pushQuad(buckets[kind],ax,az,bx,bz,width*.5,height);
        const major=kind==="motorway"||kind==="arterial";
        if(kind!=="service"&&kind!=="motorway"){
          const sw=kind==="residential"?.16:.22;
          const sideY=height+.014;
          pushQuad(buckets.sidewalk,ax,az,bx,bz,sw,sideY,width*.5+.22);
          pushQuad(buckets.sidewalk,ax,az,bx,bz,sw,sideY,-width*.5-.22);
          // Concrete curb and dark gutter separate road and footpath.
          pushQuad(buckets.curb,ax,az,bx,bz,.031,height+.025,width*.5+.035);
          pushQuad(buckets.curb,ax,az,bx,bz,.031,height+.025,-width*.5-.035);
        }
        if(kind==="arterial"&&width>=1.7&&road.o!=="yes"){
          pushQuad(buckets.median,ax,az,bx,bz,.087,height+.006);
        }
        if(major&&width>=.9){
          const stripe=buckets[road.o==="yes"?"white":"yellow"];
          // Distinct broken center lane markings; bounds are derived from
          // existing OSM geometry, not invented centerline paths.
          const stripeWidth=Math.max(.009,Math.min(.025,width*.014));
          for(let start=0;start<len;start+=1.8){
            const stop=Math.min(len,start+.92);
            if(stop-start>.1)pushQuad(stripe,ax,az,bx,bz,stripeWidth,height+.019,0,start/len,stop/len);
          }
          pushQuad(buckets.white,ax,az,bx,bz,.014,height+.014,width*.5-.09);
          pushQuad(buckets.white,ax,az,bx,bz,.014,height+.014,-width*.5+.09);
        }else if(kind==="residential"&&width>=.6){
          // Residential streets have restrained edge delineation.
          pushQuad(buckets.white,ax,az,bx,bz,.012,height+.014,width*.5-.08);
        }
        // Pedestrian crossings are *procedural* visual design near road
        // nodes confirmed by multiple mapped road endpoints. Not official
        // marked crossings or traffic-control claims for these real streets.
        if(kind==="arterial"&&len>=.56){
          const end=j===1?[ax,az]:j===pts.length-1?[bx,bz]:null;
          if(end&&paintedCrossings.size<(lowSpec?5:12)){
            const key=endpointKey(end[0],end[1]);
            if((roadEnds.get(key)||0)>=3&&!paintedCrossings.has(key)){
              paintedCrossings.add(key);
              const dir=j===1?.38:.62;
              const centerX=ax+(bx-ax)*dir,centerZ=az+(bz-az)*dir;
              const normalX=-(bz-az)/len,normalZ=(bx-ax)/len;
              const beamX=normalX*width*.85,beamZ=normalZ*width*.85;
              for(let k=-3;k<=3;k++){
                const sx=centerX+(bx-ax)/len*k*.09;
                const sz=centerZ+(bz-az)/len*k*.09;
                pushQuad(buckets.white,sx-beamX*.5,sz-beamZ*.5,
                  sx+beamX*.5,sz+beamZ*.5,.018,height+.028);
              }
            }
          }
        }
        if((kind==="arterial"||kind==="residential")&&len>=7&&lamps.length<lampLimit){
          const nx=-(bz-az)/len,nz=(bx-ax)/len;
          const interval=kind==="arterial"?9:13;
          const amount=Math.min(3,Math.floor(len/interval));
          for(let k=0;k<amount&&lamps.length<lampLimit;k++){
            const t=(k+.5)/amount,side=(k%2===0?1:-1);
            lamps.push({
              x:ax+(bx-ax)*t+nx*side*(width*.5+.55),
              z:az+(bz-az)*t+nz*side*(width*.5+.55),
              h:kind==="arterial"?.67:.43
            });
          }
        }
      }
    }
    const tileRoot=new THREE.Group();tileRoot.name="JC_PAVED_"+tileKey(rec.col,rec.row);
    tileRoot.position.set((rec.col-8)*100,0,-(rec.row-8)*100);
    for(const [kind,arr] of Object.entries(buckets)){
      if(!arr.length)continue;
      const vertex=new Float32Array(arr);
      const geo=new THREE.BufferGeometry();
      geo.setAttribute("position",new THREE.BufferAttribute(vertex,3));
      // PBR needs UVs for asphalt grain, mapped in tile-local coordinates.
      const uvs=new Float32Array((vertex.length/3)*2);
      for(let i=0,j=0;i<vertex.length;i+=3,j+=2){
        uvs[j]=vertex[i]*.65;uvs[j+1]=vertex[i+2]*.65;
      }
      geo.setAttribute("uv",new THREE.BufferAttribute(uvs,2));
      geo.computeVertexNormals();
      const mesh=new THREE.Mesh(geo,mats[kind]);
      mesh.name="PAVED_"+kind;
      mesh.frustumCulled=true;
      mesh.renderOrder=kind==="white"||kind==="yellow"?12:kind==="sidewalk"?11:10;
      tileRoot.add(mesh);
    }
    if(lamps.length){
      const poles=new THREE.InstancedMesh(poleGeom,lampPoleMat,lamps.length);
      const glow=new THREE.InstancedMesh(lampGeom,lampHeadMat,lamps.length);
      poles.name="JC_PAVED_LAMP_POLES";
      glow.name="JC_WARM_ROADSIDE_LIGHT_FIXTURES";
      poles.frustumCulled=false;glow.frustumCulled=false;
      poles.castShadow=false;glow.castShadow=false;
      const dummy=new THREE.Object3D();
      for(let i=0;i<lamps.length;i++){
        const o=lamps[i];
        dummy.rotation.set(0,0,0);
        dummy.position.set(o.x,o.h*.5,o.z);
        dummy.scale.set(1,o.h,1);
        dummy.updateMatrix();poles.setMatrixAt(i,dummy.matrix);
        dummy.position.set(o.x,o.h+.03,o.z);
        dummy.scale.set(1,1,1);
        dummy.updateMatrix();glow.setMatrixAt(i,dummy.matrix);
      }
      poles.instanceMatrix.needsUpdate=true;
      glow.instanceMatrix.needsUpdate=true;
      tileRoot.add(poles,glow);
    }
    return {root:tileRoot,segments:paved,lamps:lamps.length,crossings:paintedCrossings.size};
  }
  function unload(id){
    const item=cells.get(id);if(!item)return;
    root.remove(item.root);
    item.root.traverse(node=>{if(node.geometry)node.geometry.dispose()});
    loadedSegments-=item.segments;loadedLamps-=item.lamps;
    loadedCrossings-=item.crossings;loadedTiles--;
    cells.delete(id);
  }
  let wanted=new Set(),requests=[],running=0;
  function summary(){
    return {ready:true,loadedTiles,loadedSegments,loadedLamps,loadedCrossings,
      loading:running,queued:requests.length,
      errors,sourceRoadTiles:entries.size,nearbyRadius:radius,
      surface:"Mapped road asphalt with curbs, crossings, medians, sidewalks and warm light fixtures"};
  }
  function pump(){
    while(running<limit&&requests.length){
      const rec=requests.shift(),id=tileKey(rec.col,rec.row);
      if(!wanted.has(id)||cells.has(id)||pending.has(id)||failed.has(id))continue;
      pending.add(id);running++;
      fetch(BASE+rec.file.replace(/^\.\//,"")+"?rev="+REV,{cache:"force-cache"})
      .then(res=>{if(!res.ok)throw Error("road tile HTTP "+res.status);return res.json()})
      .then(data=>{
        if(data.col!==rec.col||data.row!==rec.row||!Array.isArray(data.roads)||
          data.roads.length!==rec.count)throw Error("mismatched paved tile "+id);
        if(!wanted.has(id))return;
        const tile=buildTile(data,rec);
        root.add(tile.root);
        cells.set(id,tile);loadedTiles++;loadedSegments+=tile.segments;
        loadedLamps+=tile.lamps;loadedCrossings+=tile.crossings;
      }).catch(err=>{
        failed.add(id);errors++;
        console.warn("JC real mapped road tile unavailable",id,err);
      }).finally(()=>{
        running--;pending.delete(id);
        window.JC_PAVED_ROADS_STATUS=summary();
        pump();
      });
    }
  }
  function update(force=false){
    // On the full sky map, the existing aerial image is the road overview.
    // No additional 3D street pavement needs to be loaded 5 km below JC.
    const hide=Boolean(window.JC_FORCE_SKY_MAP)||player.pos.y>=260;
    root.visible=!hide;
    if(hide){
      if(cells.size)for(const id of [...cells.keys()])unload(id);
      requests.length=0;wanted.clear();lastCell="";
      window.JC_PAVED_ROADS_STATUS=summary();
      return;
    }
    const col=8+Math.floor(player.pos.x/100),row=8+Math.floor(-player.pos.z/100);
    const cell=tileKey(col,row);
    if(!force&&cell===lastCell)return;
    lastCell=cell;
    const queue=[];
    for(let dc=-radius;dc<=radius;dc++)for(let dr=-radius;dr<=radius;dr++){
      const t=entries.get(tileKey(col+dc,row+dr));
      if(t)queue.push({t,dist:dc*dc+dr*dr});
    }
    queue.sort((a,b)=>a.dist-b.dist);
    wanted=new Set(queue.map(item=>tileKey(item.t.col,item.t.row)));
    for(const id of [...cells.keys()])if(!wanted.has(id))unload(id);
    requests=queue.map(item=>item.t).filter(t=>{
      const id=tileKey(t.col,t.row);
      return !cells.has(id)&&!pending.has(id)&&!failed.has(id);
    });
    pump();
    window.JC_PAVED_ROADS_STATUS=summary();
  }
  const api={ready:true,root,update,status:summary,
    get loadedSegments(){return loadedSegments;},
    get visibleTiles(){return loadedTiles;}};
  window.JC_PAVED_ROADS=api;
  update(true);
  return api;
}
