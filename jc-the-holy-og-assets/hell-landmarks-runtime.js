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
  sourceMapPreserved: true, geoRegistration: "PROVISIONAL", collisionReady: false,
  models: [], failures: []
};
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
  const base=[-7,-66];
  const levels=[[0,32],[28,20],[69,11.5],[113,5.8],[161,1.4]];
  const corners=[[-1,-1],[-1,1],[1,-1],[1,1]];
  const point=([sx,sz],y,r)=>[base[0]+sx*r,y,base[1]+sz*r];
  for(let k=0;k<levels.length-1;k++){
    const [y0,r0]=levels[k], [y1,r1]=levels[k+1];
    for(const c of corners)beam(g,"metal",point(c,y0,r0),point(c,y1,r1),k===0?3.4:2.1);
    const n=detail===0?4:2;
    for(let j=0;j<n;j++){
      const a=j/n,b=(j+1)/n;
      const za=y0+a*(y1-y0),zb=y0+b*(y1-y0);
      const ra=r0+a*(r1-r0),rb=r0+b*(r1-r0);
      for(let c=0;c<4;c++){
        const p=corners[c],q=corners[(c+1)%4];
        beam(g,"gold",point(p,za,ra),point(q,zb,rb),.8);
        if(detail===0)beam(g,"metal",point(q,za,ra),point(p,zb,rb),.7);
      }
    }
  }
  for(const [y,r] of [[26,21],[70,13],[114,6]])for(let i=0;i<4;i++)
    beam(g,"gold",point(corners[i],y,r),point(corners[(i+1)%4],y,r),2.2);
  beam(g,"ember",[-7,161,-66],[-7,198,-66],1.3);
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
function makeLod(kind) {
  const lod=new THREE.LOD();
  for(const [level,distance] of [[0,0],[1,280]]){
    const obj=kind==="stadium"?stadium(level):paris(level);
    lod.addLevel(obj,distance);
  }
  lod.name=kind==="stadium"?"JC HERO HELL STADIUM":"JC HERO HELL PARIS";
  lod.scale.setScalar(.1); // Canonical game TILE_SCALE: source meters -> game space.
  lod.userData={jcLandmark:true,version:2,coordinates:"PROVISIONAL",lod:true,nonDestructive:true};
  return lod;
}
function placement(kind,map) {
  if(mode==="preview"){
    const anchor=map.stripSpawn || new THREE.Vector3(0,0,0);
    return kind==="stadium"
      ?new THREE.Vector3(anchor.x+85,0,anchor.z-65)
      :new THREE.Vector3(anchor.x-35,0,anchor.z-65);
  }
  // Derived from approximate WGS84 landmark centers and canonical UTM 1000 m grid.
  // Requires alignment to the actual tile source before asserting exact placement.
  return kind==="stadium"
    ?new THREE.Vector3(663.24,0,-1500.30)
    :new THREE.Vector3(755.02,0,-1256.65);
}
let collisions=[],t=0;
function install(map){
  if(status.installed || !map?.mapGroup?.parent)return;
  const scene=map.mapGroup.parent;
  for(const kind of ["stadium","paris"]){
    const lod=makeLod(kind);
    lod.position.copy(placement(kind,map));
    scene.add(lod);lod.updateMatrixWorld(true);
    status.models.push({name:lod.name,x:lod.position.x,z:lod.position.z});
    const [w,h,d]=kind==="stadium"?[28,5,22]:[31,8,14];
    const c=new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(lod.position.x,h/2,lod.position.z),
      new THREE.Vector3(w,h,d));
    c.userData={tileKey:"JC_HERO_"+kind,destroyed:false,damage:0,heroLandmark:true};
    collisions.push(c);
  }
  status.installed=true;status.collisionReady=true;
  status.collisionBoxesNear=(pos)=>collisions.filter(b=>pos&&b.distanceToPoint(pos)<80);
  let frame=0;
  function tick(){
    if(!status.installed)return;
    frame++;
    if(frame%10===0){
      const p=map.player?.pos || map.player?.position;
      for(const obj of scene.children)if(obj.isLOD&&obj.userData.jcLandmark&&p)
        obj.update({position:p}); // LOD expects a camera-like {position}; visibility only.
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
if(enabled){
  const timer=setInterval(()=>{
    try{if(window.JC_GLB_MAP?.mapGroup){clearInterval(timer);install(window.JC_GLB_MAP);}}
    catch(err){clearInterval(timer);status.failures.push(String(err));}
  },500);
  setTimeout(()=>clearInterval(timer),45000);
}
export {status};
