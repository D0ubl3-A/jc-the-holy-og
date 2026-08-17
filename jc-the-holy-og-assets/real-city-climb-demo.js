import * as THREE from "three";

const mount = document.getElementById("game");
const statusEl = document.getElementById("status");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fa7b4);
scene.fog = new THREE.FogExp2(0x9aa8aa, 0.00105);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 2500);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
mount.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xd6ecff, 0x5b4b39, 2.1));
const sun = new THREE.DirectionalLight(0xffe7bd, 4.0);
sun.position.set(-300, 500, 240);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -350; sun.shadow.camera.right = 350; sun.shadow.camera.top = 350; sun.shadow.camera.bottom = -350;
scene.add(sun);

const groundMat = new THREE.MeshStandardMaterial({ color: 0x8b806f, roughness: 1 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1000), groundMat);
ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.03, 165); ground.receiveShadow = true; scene.add(ground);

const roadMat = new THREE.MeshStandardMaterial({ color: 0x292c30, roughness: .86 });
const lineMat = new THREE.MeshBasicMaterial({ color: 0xd7c36a });
const roofMat = new THREE.MeshStandardMaterial({ color: 0x565b60, roughness: .77, metalness: .08 });
const taggedHeightMat = new THREE.MeshStandardMaterial({ color: 0x627584, roughness: .53, metalness: .18 });
const levelHeightMat = new THREE.MeshStandardMaterial({ color: 0x706b61, roughness: .68, metalness: .08 });
const estimatedHeightMat = new THREE.MeshStandardMaterial({ color: 0x77736b, roughness: .78, metalness: .04 });

const keys = {};
const buildings = [];
const roadMeshes = [];
let city = null;

function pointInPoly(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], zi = pts[i][1], xj = pts[j][0], zj = pts[j][1];
    const hit = ((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / ((zj - zi) || 1e-9) + xi);
    if (hit) inside = !inside;
  }
  return inside;
}

function pointSegDistance(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const d2 = dx*dx + dz*dz || 1;
  const t = THREE.MathUtils.clamp(((px-ax)*dx + (pz-az)*dz)/d2, 0, 1);
  const x = ax + dx*t, z = az + dz*t;
  return { d: Math.hypot(px-x, pz-z), x, z, nx: -(bz-az)/Math.sqrt(d2), nz: (bx-ax)/Math.sqrt(d2) };
}

function nearestBuildingEdge(x, z, maxD = 1.6) {
  let best = null;
  for (const b of buildings) {
    if (!b.data.climb?.wall_climb) continue;
    const pts = b.data.footprint_xz;
    for (let i = 0; i < pts.length - 1; i++) {
      const q = pointSegDistance(x, z, pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1]);
      if (q.d <= maxD && (!best || q.d < best.d)) best = { ...q, building: b };
    }
  }
  return best;
}

function supportHeight(x, z, y) {
  let h = 0, on = null;
  for (const b of buildings) {
    const top = b.data.height_m;
    if (pointInPoly(x, z, b.data.footprint_xz) && y >= top - 1.2) {
      if (top > h && top <= y + 2.2) { h = top; on = b; }
    }
  }
  return { h, building: on };
}

function blockedAt(x, z, feetY) {
  for (const b of buildings) {
    if (pointInPoly(x, z, b.data.footprint_xz) && feetY < b.data.height_m - 0.15) return b;
  }
  return null;
}

function makeBuilding(b) {
  const pts = b.footprint_xz;
  if (!pts || pts.length < 4) return null;
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], -pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) shape.lineTo(pts[i][0], -pts[i][1]);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: b.height_m, bevelEnabled: false, curveSegments: 1 });
  geo.rotateX(-Math.PI / 2);
  const mat = b.height_source === "osm_height_tag" ? taggedHeightMat : b.height_source === "derived_from_osm_levels" ? levelHeightMat : estimatedHeightMat;
  const mesh = new THREE.Mesh(geo, [mat, roofMat]);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.userData.osm = b;
  scene.add(mesh);
  return { data: b, mesh };
}

function makeRoad(r) {
  const pts = r.centerline_xz || [];
  const width = Math.max(1.4, r.width_m || 6);
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1,z1] = pts[i], [x2,z2] = pts[i+1];
    const dx=x2-x1,dz=z2-z1,len=Math.hypot(dx,dz); if(len<.3) continue;
    const m = new THREE.Mesh(new THREE.BoxGeometry(width,.08,len+.3), roadMat);
    m.position.set((x1+x2)/2,.015,(z1+z2)/2);
    m.rotation.y = Math.atan2(dx,dz); m.receiveShadow=true; scene.add(m); roadMeshes.push(m);
    if ((r.highway === "primary" || r.highway === "secondary") && len > 10) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(.18,.025,len*.72), lineMat);
      stripe.position.set(m.position.x,.075,m.position.z); stripe.rotation.y=m.rotation.y; scene.add(stripe);
    }
  }
}

const player = {
  root: new THREE.Group(), pos: new THREE.Vector3(0, 1.05, 0), vel: new THREE.Vector3(), radius: .48,
  height: 1.85, grounded: false, climbing: false, climbTarget: null, yaw: Math.PI, speed: 0
};
const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf0eee7, roughness: .7 });
const goldMat = new THREE.MeshStandardMaterial({ color: 0xd9aa3c, metalness: .7, roughness: .25 });
const body = new THREE.Mesh(new THREE.CapsuleGeometry(.43,.95,6,10), bodyMat); body.position.y=.95; body.castShadow=true; player.root.add(body);
const head = new THREE.Mesh(new THREE.SphereGeometry(.34,14,10), new THREE.MeshStandardMaterial({color:0x9d6b50,roughness:.8})); head.position.y=1.84; player.root.add(head);
const halo = new THREE.Mesh(new THREE.TorusGeometry(.45,.045,8,24),goldMat); halo.position.y=2.38; halo.rotation.x=Math.PI/2; player.root.add(halo);
scene.add(player.root);

let camYaw = Math.PI, camPitch = .33, camDist = 8.2, dragging=false, lx=0, ly=0;
renderer.domElement.addEventListener("pointerdown", e=>{dragging=true;lx=e.clientX;ly=e.clientY;renderer.domElement.setPointerCapture?.(e.pointerId)});
renderer.domElement.addEventListener("pointermove", e=>{if(!dragging)return;camYaw-=(e.clientX-lx)*.005;camPitch=THREE.MathUtils.clamp(camPitch+(e.clientY-ly)*.004,-.1,.9);lx=e.clientX;ly=e.clientY});
renderer.domElement.addEventListener("pointerup",()=>dragging=false);
renderer.domElement.addEventListener("wheel",e=>camDist=THREE.MathUtils.clamp(camDist+Math.sign(e.deltaY)*.8,4.5,15),{passive:true});
addEventListener("keydown",e=>{keys[e.code]=true;if(e.code==="Space")e.preventDefault()}); addEventListener("keyup",e=>keys[e.code]=false);

function updatePlayer(dt) {
  const forward = new THREE.Vector3(-Math.sin(camYaw),0,-Math.cos(camYaw));
  const right = new THREE.Vector3(forward.z,0,-forward.x);
  const move = new THREE.Vector3();
  move.addScaledVector(forward,(keys.KeyW?1:0)-(keys.KeyS?1:0));
  move.addScaledVector(right,(keys.KeyD?1:0)-(keys.KeyA?1:0));
  const edge = nearestBuildingEdge(player.pos.x,player.pos.z,1.45);
  const wantsClimb = !!keys.KeyE && edge && player.pos.y < edge.building.data.height_m + .3;
  if (wantsClimb) {
    player.climbing=true; player.climbTarget=edge; player.vel.set(0,5.8,0);
    const push=.58; player.pos.x = THREE.MathUtils.lerp(player.pos.x,edge.x+edge.nx*push,Math.min(1,dt*8)); player.pos.z = THREE.MathUtils.lerp(player.pos.z,edge.z+edge.nz*push,Math.min(1,dt*8));
    if (player.pos.y >= edge.building.data.height_m - .15) {
      player.pos.y=edge.building.data.height_m+.02; player.climbing=false; player.vel.set(0,0,0);
      const cx=edge.building.data.footprint_xz.reduce((s,p)=>s+p[0],0)/edge.building.data.footprint_xz.length;
      const cz=edge.building.data.footprint_xz.reduce((s,p)=>s+p[1],0)/edge.building.data.footprint_xz.length;
      const toward=new THREE.Vector3(cx-player.pos.x,0,cz-player.pos.z).normalize(); player.pos.addScaledVector(toward,1.0);
    }
  } else {
    player.climbing=false;
    if(move.lengthSq()>.001){move.normalize();const sp=keys.ShiftLeft?11:6.3;const nx=player.pos.x+move.x*sp*dt,nz=player.pos.z+move.z*sp*dt;const wall=blockedAt(nx,nz,player.pos.y);if(!wall){player.pos.x=nx;player.pos.z=nz}player.yaw=Math.atan2(move.x,move.z);player.speed=sp}else player.speed=0;
    if(keys.Space&&player.grounded){player.vel.y=8.3;player.grounded=false;keys.Space=false}
    player.vel.y-=21*dt; player.pos.y+=player.vel.y*dt;
    const s=supportHeight(player.pos.x,player.pos.z,player.pos.y);
    if(player.vel.y<=0 && player.pos.y<=s.h+.08){player.pos.y=s.h;player.vel.y=0;player.grounded=true}else player.grounded=false;
    if(player.pos.y<0){player.pos.y=0;player.vel.y=0;player.grounded=true}
    if(player.vel.y<0){
      const near=nearestBuildingEdge(player.pos.x,player.pos.z,1.05);
      if(near && near.building.data.climb?.edge_grab && Math.abs(player.pos.y-near.building.data.height_m)<.65){player.pos.y=near.building.data.height_m;player.vel.y=0;player.grounded=true;}
    }
  }
  player.root.position.copy(player.pos); player.root.rotation.y=player.yaw;
  const nearName=edge?.building?.data?.name || (edge ? `OSM building ${edge.building.data.osm_id}` : null);
  const hs=edge?.building?.data?.height_source;
  statusEl.textContent = `${player.climbing?"CLIMBING":"Y="+player.pos.y.toFixed(1)+"m"} • ${nearName?`near ${nearName}`:"free roam"}${hs?` • height: ${hs}`:""}`;
}

function updateCamera(dt){
  const target=player.pos.clone().add(new THREE.Vector3(0,1.25,0)); const cp=Math.cos(camPitch),sp=Math.sin(camPitch);
  const desired=target.clone().add(new THREE.Vector3(Math.sin(camYaw)*cp*camDist,sp*camDist+1.2,Math.cos(camYaw)*cp*camDist));
  camera.position.lerp(desired,1-Math.exp(-10*dt));camera.lookAt(target);
}

async function boot(){
  const r=await fetch("./jc-the-holy-og-assets/generated/real_city_chunk.json",{cache:"no-store"});
  if(!r.ok) throw new Error(`real_city_chunk.json HTTP ${r.status}`);
  city=await r.json();
  for(const road of city.roads) makeRoad(road);
  for(const b of city.buildings){const built=makeBuilding(b);if(built)buildings.push(built)}
  player.pos.set(0,0,0); player.root.position.copy(player.pos);
  statusEl.textContent=`${buildings.length} real footprints • ${city.roads.length} road ways • ready to climb`;
  window.JC_REAL_CLIMB_TEST={city,buildings,player};
  requestAnimationFrame(frame);
}

const clock=new THREE.Clock();
function frame(){requestAnimationFrame(frame);const dt=Math.min(.033,clock.getDelta());updatePlayer(dt);updateCamera(dt);renderer.render(scene,camera)}
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
boot().catch(err=>{console.error(err);statusEl.textContent="LOAD ERROR: "+err.message});
