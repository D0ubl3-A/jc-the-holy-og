/**
 * JC Sin City: Hell Stadium + Hell Paris, non-destructive hero landmark pass.
 * Three.js procedural runtime matches the supplied standalone GLB asset pack concept.
 * Preview: ?hellLandmarks=preview | Geo hypothesis: ?hellLandmarks=geo.
 * Geo hypothesis is NOT survey-verified. Never overwrite original Vegas GLB geometry.
 */
import * as THREE from "three";
const params = new URLSearchParams(location.search);
const mode = params.get("hellLandmarks");
const enabled = mode === "preview" || mode === "geo";
const status = window.JC_HELL_LANDMARKS = {
  installed: false, mode: mode || "off", geometry: "PROCEDURAL_HERO_OVERLAY",
  sourceMapPreserved: true, geoRegistration: "SOURCE_COORDINATE_DERIVED_PROVISIONAL", collisionReady: false,
  sourceTileAlignment: "NOT_VISUALLY_REVIEWED",
  headingAlignment: "NOT_VERIFIED",
  assetLoadStatus: enabled ? "WAITING_FOR_MAP" : "DISABLED",
  models: [], failures: []
};
// The game map uses the shared 1 km tile grid and local origin. Stadium position
// comes from its matched source footprint; Paris uses separate hotel and tower points.
const GRID = {
  minE:648949.782,minN:3983561.814,tileSize:1000,scale:.1,originCol:8,originRow:8
};
const GEO_ANCHORS = {
  stadium:{
    lat:36.09074,lon:-115.18333,easting:663538.571,northing:3995540.928,
    source:"https://www.openstreetmap.org/way/691478555",
    footprintId:"SC-BLDG-MS-630b9732e73f9a2838d9d0dc2314ce0b",
    footprintTile:"Tile_LV_X014_Y011",footprintAreaM2:51803.2,
    footprintBoundsM:{width:268.1,depth:326.4,centerEasting:663560.45,centerNorthing:3995531.1}
  },
  paris:{
    lat:36.11222,lon:-115.17067,easting:664647.877,northing:3997944.826,
    source:"https://www.openstreetmap.org/way/33974140",
    sourceTile:"Tile_LV_X015_Y014",
    tower:{
      lat:36.11243,lon:-115.17211,easting:664517.819,northing:3997965.683,
      source:"https://mapcarta.com/28405842"
    }
  }
};
function modelAnchor(kind){
  const anchor=GEO_ANCHORS[kind];
  if(kind==="stadium")return {
    easting:anchor.footprintBoundsM.centerEasting,
    northing:anchor.footprintBoundsM.centerNorthing
  };
  return {easting:anchor.easting,northing:anchor.northing};
}
function projectCoordinates(easting,northing,map=window.JC_GLB_MAP){
  const scale=map?.tileScale||GRID.scale;
  const tileWorldSize=map?.tileWorldSize||GRID.tileSize*scale;
  const originCol=map?.origin?.col??GRID.originCol;
  const originRow=map?.origin?.row??GRID.originRow;
  const originE=GRID.minE+originCol*GRID.tileSize;
  const originN=GRID.minN+originRow*GRID.tileSize;
  const x=(easting-originE)*scale;
  const z=-(northing-originN)*scale;
  const col=originCol+Math.floor(x/tileWorldSize);
  const row=originRow+Math.floor(-z/tileWorldSize);
  return {x,z,col,row,tileKey:"C"+String(col).padStart(2,"0")+"_R"+String(row).padStart(2,"0")};
}
function anchorEvidence(kind,map=window.JC_GLB_MAP){
  const anchor=GEO_ANCHORS[kind];
  const point=modelAnchor(kind);
  const world=projectCoordinates(point.easting,point.northing,map);
  const result={
    kind,
    source:anchor.source,
    lat:anchor.lat,
    lon:anchor.lon,
    crs:"EPSG:32611",
    projected:{easting:point.easting,northing:point.northing},
    projectedRole:kind==="stadium"?"SOURCE_FOOTPRINT_CENTER":"HOTEL_ANCHOR",
    world,
    heading:"UNVERIFIED_ZERO_ROTATION"
  };
  if(kind==="stadium"){
    const venueWorld=projectCoordinates(anchor.easting,anchor.northing,map);
    result.footprint={
      id:anchor.footprintId,
      sourceTile:anchor.footprintTile,
      widthM:anchor.footprintBoundsM.width,
      depthM:anchor.footprintBoundsM.depth,
      centerEasting:point.easting,
      centerNorthing:point.northing,
      venueOffsetM:Math.hypot(point.easting-anchor.easting,point.northing-anchor.northing)
    };
    result.venueWorld=venueWorld;
  }
  if(kind==="paris"){
    result.tower={
      source:anchor.tower.source,
      lat:anchor.tower.lat,
      lon:anchor.tower.lon,
      projected:{easting:anchor.tower.easting,northing:anchor.tower.northing},
      world:projectCoordinates(anchor.tower.easting,anchor.tower.northing,map)
    };
  }
  const sourceTile=kind==="stadium"?anchor.footprintTile:anchor.sourceTile;
  const loaded=Boolean(map?.loadedTiles?.has?.(world.tileKey));
  const inManifest=Boolean(map?.manifest?.some?.(rec=>
    "C"+String(rec.col).padStart(2,"0")+"_R"+String(rec.row).padStart(2,"0")===world.tileKey
  ));
  const districtState=window.__JC_REAL_VEGAS_DISTRICTS_V1__;
  const district=districtState?.districts?.get?.("strip");
  const districtTile=district?.tiles?.get?.(sourceTile);
  result.sourceTile=sourceTile;
  result.sourceTileState=!map?"MAP_NOT_READY":map.gtaVegasMode?"NOT_RENDERED_IN_GTA_MODE":
    districtTile?.group?.visible&&district.root?.visible&&districtState.worldRoot?.visible!==false?"STRIP_FOOTPRINT_TILE_VISIBLE":
    districtTile?.built?"STRIP_FOOTPRINT_TILE_READY":districtTile?"STRIP_FOOTPRINT_TILE_NOT_BUILT":
    loaded?"LOADED":inManifest?"IN_MANIFEST_NOT_LOADED":
    districtState?.disabledForPerformance?"DISTRICT_FOOTPRINTS_DISABLED":
    districtState?.ready?"WAITING_FOR_STRIP_FOOTPRINT_TILE":"NOT_IN_MANIFEST";
  if(districtState?.errors?.strip||districtState?.error)result.sourceTileError=String(districtState.errors?.strip||districtState.error);
  return result;
}
const materials = {
  glass:new THREE.MeshStandardMaterial({color:0x162638,metalness:.64,roughness:.22}),
  roof:new THREE.MeshStandardMaterial({color:0x181e29,metalness:.55,roughness:.40}),
  slate:new THREE.MeshStandardMaterial({color:0x2c3142,metalness:.3,roughness:.49}),
  stone:new THREE.MeshStandardMaterial({color:0xb59b86,metalness:.14,roughness:.62}),
  metal:new THREE.MeshStandardMaterial({color:0x797e87,metalness:.8,roughness:.26}),
  gold:new THREE.MeshStandardMaterial({color:0xcbaa74,metalness:.82,roughness:.2}),
  ember:new THREE.MeshStandardMaterial({color:0xff4428,emissive:0xe32919,emissiveIntensity:1.6,roughness:.5}),
  cyan:new THREE.MeshStandardMaterial({color:0x64dfff,emissive:0x1188dd,emissiveIntensity:1.45}),
  violet:new THREE.MeshStandardMaterial({color:0xce83ff,emissive:0x7122ce,emissiveIntensity:1.3}),
  window:new THREE.MeshStandardMaterial({color:0xffde9c,emissive:0xe6a547,emissiveIntensity:.65})
};
function box(parent,mat,x,y,z,w,h,d) {
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),materials[mat]);
  m.position.set(x,y,z);parent.add(m);return m;
}
function beam(parent,mat,a,b,width=1.2) {
  const v=new THREE.Vector3(...a),w=new THREE.Vector3(...b),d=w.clone().sub(v);
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,d.length(),width),materials[mat]);
  mesh.position.copy(v).add(w).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
  parent.add(mesh);return mesh;
}
function ellipseLine(g,material,rx,rz,y,n=64,width=.7) {
  for(let i=0;i<n;i++){
    const t=i*2*Math.PI/n,q=(i+1)*2*Math.PI/n;
    beam(g,material,[rx*Math.cos(t),y,rz*Math.sin(t)],
      [rx*Math.cos(q),y,rz*Math.sin(q)],width);
  }
}
function stadium(detail) {
  const g=new THREE.Group();g.name="JC HELL STADIUM";
  const shell=new THREE.Mesh(new THREE.CylinderGeometry(1,1,36,detail===0?80:32,1,false),materials.glass);
  shell.scale.set(143,1,107);shell.position.y=18;g.add(shell);
  const roof=new THREE.Mesh(new THREE.SphereGeometry(1,detail===0?64:24,12,0,Math.PI*2,0,Math.PI/2),materials.roof);
  roof.scale.set(141,16,105);roof.position.y=40;g.add(roof);
  const lip=new THREE.Mesh(new THREE.CylinderGeometry(1,1,4,detail===0?80:32),materials.slate);
  lip.scale.set(145,1,109);lip.position.y=39;g.add(lip);
  for(const y of [9,31,42])ellipseLine(g,y===31?"cyan":y===42?"ember":"metal",146,110,y,detail===0?88:32,y===42?1.2:.8);
  const n=detail===0?96:28;
  for(let i=0;i<n;i++){
    const t=i*2*Math.PI/n;
    beam(g,"metal",[144*Math.cos(t),2,108*Math.sin(t)],
      [144*Math.cos(t),37,108*Math.sin(t)],.85);
  }
  for(const t of [0,Math.PI/2,Math.PI,3*Math.PI/2]){
    const x=147*Math.cos(t),z=112*Math.sin(t);
    box(g,"glass",x,10,z,22,20,7);
    beam(g,"ember",[x-13,0,z],[x-13,24,z],1.7);
    beam(g,"ember",[x+13,0,z],[x+13,24,z],1.7);
    beam(g,"gold",[x-14,23,z],[x+14,23,z],1.6);
  }
  if(detail===0){
    for(let i=0;i<30;i++){
      const a=2*Math.PI*i/30;
      beam(g,"metal",[102*Math.cos(a),53,76*Math.sin(a)],
        [142*Math.cos(a),42,106*Math.sin(a)],.55);
    }
    for(let i=0;i<10;i++){
      const t=2*Math.PI*i/10;
      beam(g,"ember",[135*Math.cos(t),44,101*Math.sin(t)],
        [135*Math.cos(t),50+(i%3)*3,101*Math.sin(t)],1.4);
    }
  }
  return g;
}
function paris(detail) {
  const g=new THREE.Group();g.name="JC HELL PARIS";
  for(const [cx,w,cz,d,h] of [[-95,120,31,86,69],[90,125,31,86,71],[0,70,48,60,80]]){
    box(g,"stone",cx,h/2,cz,w,h,d);
    box(g,"slate",cx,h+7,cz,w+5,14,d+5);
    box(g,"gold",cx,h+15,cz,w+3,1.4,d+3);
    if(detail===0)for(let x=cx-w/2+7;x<cx+w/2-2;x+=11){
      box(g,"gold",x,h/2,cz-d/2-.6,.75,h,1);
    }
    for(let x=cx-w/2+7;x<cx+w/2-3;x+=detail===0?9:18){
      for(let y=11;y<h-5;y+=detail===0?13:22){
        box(g,((Math.floor(x+y)%5)===0)?"cyan":"window",x,y,cz-d/2-.9,3,4,.45);
      }
    }
  }
  // Four-leg Paris replica, with real open-air bracing rather than a cone silhouette.
  const towerAnchor=GEO_ANCHORS.paris.tower;
  const hotelAnchor=GEO_ANCHORS.paris;
  const tower=new THREE.Group();
  tower.name="JC HELL PARIS EIFFEL TOWER";
  tower.position.set(towerAnchor.easting-hotelAnchor.easting,0,-(towerAnchor.northing-hotelAnchor.northing));
  g.add(tower);
  const base=[0,0];
  const levels=[[0,32],[28,20],[69,11.5],[113,5.8],[161,1.4]];
  const corners=[[-1,-1],[-1,1],[1,1],[1,-1]];
  const point=([sx,sz],y,r)=>[base[0]+sx*r,y,base[1]+sz*r];
  for(let k=0;k<levels.length-1;k++){
    const [y0,r0]=levels[k], [y1,r1]=levels[k+1];
    for(const c of corners)beam(tower,"metal",point(c,y0,r0),point(c,y1,r1),k===0?3.4:2.1);
    const n=detail===0?4:2;
    for(let j=0;j<n;j++){
      const a=j/n,b=(j+1)/n;
      const za=y0+a*(y1-y0),zb=y0+b*(y1-y0);
      const ra=r0+a*(r1-r0),rb=r0+b*(r1-r0);
      for(let c=0;c<4;c++){
        const p=corners[c],q=corners[(c+1)%4];
        beam(tower,"gold",point(p,za,ra),point(q,zb,rb),.8);
        if(detail===0)beam(tower,"metal",point(q,za,ra),point(p,zb,rb),.7);
      }
    }
  }
  for(const [y,r] of [[26,21],[70,13],[114,6]])for(let i=0;i<4;i++)
    beam(tower,"gold",point(corners[i],y,r),point(corners[(i+1)%4],y,r),2.2);
  beam(tower,"ember",[0,161,0],[0,198,0],1.3);
  for(const [x,z] of [[-149,-13],[-149,75],[149,-13],[149,75]]){
    box(g,"gold",x,83,z,8,24,8);beam(g,"violet",[x,95,z],[x,112,z],1.6);
  }
  // Blue-violet illuminated Paris balloon, not generic red inferno.
  const n=detail===0?24:12;
  for(let i=0;i<n;i++){
    const a=2*Math.PI*i/n,c=2*Math.PI*(i+1)/n;
    for(const [y,r] of [[54,21],[72,22],[90,13]])
      beam(g,i%2?"cyan":"violet",[130+r*Math.cos(a),y,-45+r*Math.sin(a)],
        [130+r*Math.cos(c),y,-45+r*Math.sin(c)],1.1);
    beam(g,i%2?"cyan":"violet",[130+20*Math.cos(a),55,-45+20*Math.sin(a)],
      [130+15*Math.cos(a),90,-45+15*Math.sin(a)],.8);
  }
  box(g,"gold",130,44,-45,11,10,11);
  return g;
}
function makeLod(kind,scale=GRID.scale) {
  const lod=new THREE.LOD();
  let sourceBounds=null;
  for(const [level,distance] of [[0,0],[1,280]]){
    const obj=kind==="stadium"?stadium(level):paris(level);
    if(kind==="stadium"){
      obj.updateMatrixWorld(true);
      const bounds=new THREE.Box3().setFromObject(obj);
      const size=bounds.getSize(new THREE.Vector3());
      const footprint=GEO_ANCHORS.stadium.footprintBoundsM;
      obj.scale.set(footprint.width/size.x,1,footprint.depth/size.z);
      sourceBounds={widthM:size.x,depthM:size.z};
    }
    lod.addLevel(obj,distance);
  }
  lod.name=kind==="stadium"?"JC HERO HELL STADIUM":"JC HERO HELL PARIS";
  lod.scale.setScalar(scale); // Source meters -> game space, shared with anchor/collision projection.
  lod.userData={jcLandmark:true,version:3,coordinates:"PROVISIONAL",lod:true,nonDestructive:true,sourceBounds};
  return lod;
}
function placement(kind,map) {
  if(mode==="preview"){
    const anchor=map.stripSpawn || new THREE.Vector3(0,0,0);
    return kind==="stadium"
      ?new THREE.Vector3(anchor.x+85,0,anchor.z-65)
      :new THREE.Vector3(anchor.x-35,0,anchor.z-65);
  }
  const anchor=modelAnchor(kind);
  const position=projectCoordinates(anchor.easting,anchor.northing,map);
  return new THREE.Vector3(position.x,0,position.z);
}
function focusPosition(kind,map=window.JC_GLB_MAP){
  if(!GEO_ANCHORS[kind])return null;
  const target=projectCoordinates(modelAnchor(kind).easting,modelAnchor(kind).northing,map);
  const scale=map?.tileScale||GRID.scale;
  const offsetM=kind==="stadium"?GEO_ANCHORS.stadium.footprintBoundsM.depth/2+100:300;
  // The initial camera faces south (+z), so approach from the north.
  return new THREE.Vector3(target.x,(map?.roadSurfaceY??0.1)+0.04,target.z-offsetM*scale);
}
let collisions=[];
function install(map){
  if(status.installed || !map?.mapGroup?.parent)return;
  const scene=map.mapGroup.parent;
  for(const kind of ["stadium","paris"]){
    const lod=makeLod(kind,map.tileScale||GRID.scale);
    lod.position.copy(placement(kind,map));
    if(mode==="geo")lod.rotation.y=GEO_ANCHORS[kind].rotationY||0;
    scene.add(lod);lod.updateMatrixWorld(true);
    const anchor=anchorEvidence(kind,map);
    const [w,h,d]=kind==="stadium"
      ?[anchor.footprint.widthM*(map.tileScale||GRID.scale),5,anchor.footprint.depthM*(map.tileScale||GRID.scale)]
      :[31,8,14];
    const boxCenter=new THREE.Vector3(lod.position.x,h/2,lod.position.z);
    const c=new THREE.Box3().setFromCenterAndSize(
      boxCenter,
      new THREE.Vector3(w,h,d));
    c.userData={tileKey:"JC_HERO_"+kind,destroyed:false,damage:0,heroLandmark:true,indestructible:true};
    collisions.push(c);
    status.models.push({
      kind,
      name:lod.name,
      anchor,
      targetWorld:anchor.world,
      renderedWorld:{x:lod.position.x,z:lod.position.z},
      headingStatus:"UNVERIFIED_ZERO_ROTATION",
      sourceTileAlignment:"NOT_VISUALLY_REVIEWED",
      assetLoadStatus:"PROCEDURAL_LODS_BUILT",
      sourceBoundsM:lod.userData.sourceBounds
    });
  }
  status.assetLoadStatus="PROCEDURAL_LODS_BUILT";
  status.installed=true;status.collisionReady=true;
  status.collisionBoxesNear=(pos)=>collisions.filter(b=>pos&&b.distanceToPoint(pos)<80);
  refreshQaPanel();
  // THREE.LOD updates automatically from renderer camera with autoUpdate=true.

}
function evidenceSnapshot(){
  const map=window.JC_GLB_MAP;
  const landmarks=["stadium","paris"].map(kind=>{
    const current=status.models.find(item=>item.kind===kind)||{};
    const anchor=anchorEvidence(kind,map);
    return {
      ...current,
      anchor,
      targetWorld:anchor.world,
      sourceTileState:anchor.sourceTileState
    };
  });
  return {
    schema:"jc-hell-landmark-qa-v1",
    capturedAt:new Date().toISOString(),
    mode,
    geometry:status.geometry,
    assetLoadStatus:status.assetLoadStatus,
    geoRegistration:status.geoRegistration,
    sourceTileAlignment:status.sourceTileAlignment,
    headingAlignment:status.headingAlignment,
    sourceMapPreserved:status.sourceMapPreserved,
    collisionReady:status.collisionReady,
    mapMode:map?.gtaVegasMode?"GTA_VEGAS_GPS":map?"SOURCE_TILE_STREAM":"MAP_NOT_READY",
    activeDistrict:window.__JC_REAL_VEGAS_DISTRICTS_V1__?.activeDistrict||null,
    landmarks,
    failures:status.failures.slice()
  };
}
status.getEvidence=evidenceSnapshot;
status.focusPosition=focusPosition;
function setQaUrl(nextMode,focus=null,sourceMode=null){
  const next=new URL(location.href);
  if(nextMode==="off")next.searchParams.delete("hellLandmarks");
  else next.searchParams.set("hellLandmarks",nextMode);
  if(focus)next.searchParams.set("landmarkFocus",focus);
  else next.searchParams.delete("landmarkFocus");
  if(sourceMode)next.searchParams.set("mode",sourceMode);
  if(focus){
    next.searchParams.delete("city");
    next.searchParams.delete("view");
    next.searchParams.delete("districtFallback");
  }
  location.href=next.toString();
}
function refreshQaPanel(){
  const panel=document.getElementById("jcHellQaPanel");
  const launch=document.getElementById("jcHellQaLaunch");
  if(launch){
    launch.textContent=enabled?"LANDMARK QA PANEL":"OPEN LANDMARK QA";
    launch.setAttribute("aria-expanded",String(Boolean(panel&&!panel.hidden)));
  }
  if(!panel)return;
  if(!enabled){panel.hidden=true;return;}
  const summary=document.getElementById("jcHellQaSummary");
  const cards=document.getElementById("jcHellQaLandmarks");
  const copyButton=document.getElementById("jcHellQaCopy");
  const map=window.JC_GLB_MAP;
  if(summary)summary.textContent=status.installed
    ?(mode==="geo"?"GEO ANCHORS · VISUAL REVIEW REQUIRED":"PREVIEW · LOCAL DISPLAY")+" · "+(map?.gtaVegasMode?"GTA GPS MAP":"SOURCE TILE MAP")
    :status.assetLoadStatus==="BUILD_FAILED"||status.assetLoadStatus==="MAP_ROOT_TIMEOUT"
      ?"LANDMARKS UNAVAILABLE · "+status.assetLoadStatus
      :"WAITING FOR MAP ROOT · "+status.assetLoadStatus;
  if(cards){
    cards.replaceChildren();
    for(const kind of ["stadium","paris"]){
      const anchor=anchorEvidence(kind,map);
      const model=status.models.find(item=>item.kind===kind);
      const article=document.createElement("article");
      article.className="jc-hell-qa-card";
      const heading=document.createElement("strong");
      heading.textContent=kind==="stadium"?"HELL STADIUM":"HELL PARIS";
      const detail=document.createElement("p");
      const position=model?.renderedWorld||anchor.world;
      const anchorLabel=kind==="stadium"?"FOOTPRINT CENTER":"HOTEL ANCHOR";
      detail.textContent=anchorLabel+" · "+anchor.world.tileKey+
        " · TARGET X "+anchor.world.x.toFixed(2)+" / Z "+anchor.world.z.toFixed(2)+
        " · DISPLAY X "+position.x.toFixed(2)+" / Z "+position.z.toFixed(2)+
        " · SOURCE "+anchor.sourceTileState+
        (kind==="stadium"?" · "+anchor.footprint.venueOffsetM.toFixed(1)+" M FROM VENUE POINT":" · TOWER "+anchor.tower.world.tileKey);
      const headingState=document.createElement("small");
      headingState.textContent="HEADING UNVERIFIED · VISUAL ALIGNMENT PENDING";
      article.append(heading,detail,headingState);
      cards.append(article);
    }
  }
  if(copyButton)copyButton.disabled=false;
}
const qaLaunch=document.getElementById("jcHellQaLaunch");
const qaPanel=document.getElementById("jcHellQaPanel");
if(qaPanel)qaPanel.hidden=!enabled;
qaLaunch?.addEventListener("click",()=>{
  if(!enabled){setQaUrl("preview");return;}
  if(qaPanel)qaPanel.hidden=!qaPanel.hidden;
  refreshQaPanel();
});
document.getElementById("jcHellQaClose")?.addEventListener("click",()=>{
  if(qaPanel)qaPanel.hidden=true;
  if(qaLaunch)qaLaunch.setAttribute("aria-expanded","false");
});
document.querySelectorAll("[data-hell-qa-mode]").forEach(button=>{
  button.addEventListener("click",()=>setQaUrl(button.dataset.hellQaMode));
});
document.querySelectorAll("[data-hell-qa-focus]").forEach(button=>{
  button.addEventListener("click",()=>setQaUrl("geo",button.dataset.hellQaFocus,"stream"));
});
document.getElementById("jcHellQaCopy")?.addEventListener("click",async()=>{
  const data=JSON.stringify(evidenceSnapshot(),null,2);
  const button=document.getElementById("jcHellQaCopy");
  try{
    await navigator.clipboard.writeText(data);
    if(button)button.textContent="QA JSON COPIED";
  }catch{
    const blob=new Blob([data],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");
    link.href=url;link.download="jc-hell-landmark-qa.json";link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    if(button)button.textContent="QA JSON DOWNLOADED";
  }
});
refreshQaPanel();
if(enabled){
  const timer=setInterval(()=>{
    try{
      if(window.JC_GLB_MAP?.mapGroup?.parent){install(window.JC_GLB_MAP);if(status.installed)clearInterval(timer);}
      else refreshQaPanel();
    }
    catch(err){
      clearInterval(timer);
      status.assetLoadStatus="BUILD_FAILED";
      status.failures.push(String(err));
      refreshQaPanel();
    }
  },500);
  setTimeout(()=>{
    clearInterval(timer);
    if(!status.installed&&status.assetLoadStatus!=="BUILD_FAILED"){
      status.assetLoadStatus="MAP_ROOT_TIMEOUT";
      status.failures.push("JC_GLB_MAP was not ready within 45 seconds");
      refreshQaPanel();
    }
  },45000);
  setInterval(()=>{if(status.installed)refreshQaPanel();},1200);
}
export {status};
