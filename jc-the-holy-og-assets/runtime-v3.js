import * as THREE from "three";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/meshopt_decoder.module.js";
import { QualityPipeline, configureSunShadow } from "./quality-v3.js";
import { createMaterials, setWorldWetness, loadTextureSafe, atlasTile, seeded } from "./materials-v3.js";
import { buildSectionZero } from "./section-zero-v3.js";

const $ = (id) => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const TAU = Math.PI * 2;
const WORLD = 11000;
const mount = $("game-root");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ca4b2);
scene.fog = new THREE.FogExp2(0x93a2a6, 0.00023);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.15, 10000);
const pipeline = new QualityPipeline({ scene, camera, mount, quality: "auto" });
const renderer = pipeline.renderer;
const quality = pipeline.settings;
const clock = new THREE.Clock();

const materials = createMaterials();
setWorldWetness(materials, 0.78);

const hemi = new THREE.HemisphereLight(0xd7ecff, 0x5d4933, 1.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe0aa, 4.6);
sun.position.set(-520, 620, 340);
configureSunShadow(sun, pipeline, pipeline.name === "ultra" ? 390 : 300);
scene.add(sun);
const ambient = new THREE.AmbientLight(0x8a7458, 0.18);
scene.add(ambient);

function buildSky() {
  const geo = new THREE.SphereGeometry(5400, 32, 18);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { top: { value: new THREE.Color(0x456983) }, horizon: { value: new THREE.Color(0xf0b56d) }, bottom: { value: new THREE.Color(0x8d7a70) }, night: { value: 0 } },
    vertexShader: `varying vec3 vPos;void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform vec3 top;uniform vec3 horizon;uniform vec3 bottom;uniform float night;varying vec3 vPos;void main(){float h=normalize(vPos).y;float a=smoothstep(-.1,.48,h);vec3 c=mix(horizon,top,a);c=mix(bottom,c,smoothstep(-.45,.02,h));vec3 n=mix(vec3(.012,.018,.045),vec3(.06,.08,.13),max(h,0.));c=mix(c,n,night);gl_FragColor=vec4(c,1.);}`,
  });
  const sky = new THREE.Mesh(geo, mat); scene.add(sky);
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(35, 18, 12), new THREE.MeshBasicMaterial({ color: 0xffdb8c, toneMapped: false }));
  sunDisc.position.set(-1600, 420, -2600); scene.add(sunDisc);
  return { sky, mat, sunDisc };
}
const sky = buildSky();

function buildStars() {
  const positions = [];
  for (let i = 0; i < 1100; i++) { const a = seeded(i + 1) * TAU, r = 1700 + seeded(i + 1000) * 2400; positions.push(Math.cos(a) * r, 520 + seeded(i + 2000) * 1900, Math.sin(a) * r); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xeaf2ff, size: 2.1, transparent: true, opacity: 0, depthWrite: false });
  const points = new THREE.Points(geo, mat); scene.add(points); return points;
}
const stars = buildStars();

const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, WORLD), new THREE.MeshStandardMaterial({ color: 0x6d6254, roughness: .96, metalness: .01 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -.18; ground.receiveShadow = true; scene.add(ground);

const gltf = new GLTFLoader(); gltf.setMeshoptDecoder(MeshoptDecoder);
const textureRoot = "./jc-the-holy-og-assets/";
const atlasRoot = textureRoot + "swarm/";
const assets = { character: null, vehicle: null, npc: null, magic: null, world: null, jc: null, devil: null, facade: [] };

async function loadAssets() {
  const entries = await Promise.all([
    loadTextureSafe(textureRoot + "character-atlas.png"),
    loadTextureSafe(textureRoot + "vehicle-atlas.png"),
    loadTextureSafe(atlasRoot + "npc-state-atlas.png"),
    loadTextureSafe(atlasRoot + "magic-vfx-atlas.png"),
    loadTextureSafe(atlasRoot + "world-material-atlas.png"),
    loadTextureSafe(atlasRoot + "jc-material-atlas.png"),
    loadTextureSafe(atlasRoot + "devil-material-atlas.png"),
  ]);
  [assets.character, assets.vehicle, assets.npc, assets.magic, assets.world, assets.jc, assets.devil] = entries;
  assets.facade = await Promise.all(Array.from({ length: 6 }, (_, i) => loadTextureSafe(`${atlasRoot}buildings/facade-atlas-${String(i + 1).padStart(2, "0")}.jpg`)));
}

const roadData = { roads: [], minX: 0, maxX: 1, minZ: 0, maxZ: 1, scale: 1, centerX: 0, centerZ: 0, anchor: { x: 0, z: 0, a: 0 } };
function roadWidth(type = "") { const t = type.replace(/_link$/, ""); return t === "motorway" ? 30 : t === "trunk" ? 27 : t === "primary" ? 23 : t === "secondary" ? 17 : t === "tertiary" ? 13 : 9; }
function roadPriority(type = "") { return /^(motorway|trunk|primary|secondary|tertiary|residential)(?:_link)?$/.test(type); }
function buildRoadData() {
  const data = window.JC_VEGAS_OSM || window.VEGAS_ROADS || { roads: [] };
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const r of data.roads || []) for (const p of r.p || []) { const x = Number(p[0]), z = Number(p[1]); if (!Number.isFinite(x) || !Number.isFinite(z)) continue; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
  if (!Number.isFinite(minX) || maxX === minX || maxZ === minZ) { minX = minZ = -1; maxX = maxZ = 1; }
  const scale = (WORLD * .91) / Math.max(maxX - minX, maxZ - minZ), centerX = (minX + maxX) * .5, centerZ = (minZ + maxZ) * .5;
  roadData.minX = minX; roadData.maxX = maxX; roadData.minZ = minZ; roadData.maxZ = maxZ; roadData.scale = scale; roadData.centerX = centerX; roadData.centerZ = centerZ;
  let id = 0;
  for (const r of data.roads || []) {
    if (!roadPriority(r.t || "")) continue;
    const pts = r.p || [], step = (r.t || "").startsWith("residential") ? 3 : (r.t || "").startsWith("tertiary") ? 2 : 1;
    for (let i = 0; i < pts.length - 1; i += step) {
      const a = pts[i], b = pts[Math.min(i + step, pts.length - 1)];
      const x1 = (Number(a[0]) - centerX) * scale, z1 = (Number(a[1]) - centerZ) * scale, x2 = (Number(b[0]) - centerX) * scale, z2 = (Number(b[1]) - centerZ) * scale;
      const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz); if (len < 3 || len > 360) continue;
      roadData.roads.push({ id: id++, x: (x1 + x2) * .5, z: (z1 + z2) * .5, x1, z1, x2, z2, len, a: Math.atan2(dx, dz), w: roadWidth(r.t), type: r.t || "", name: r.n || "" });
    }
  }
  let candidates = roadData.roads.filter(r => /las vegas (boulevard|blvd)|the strip/i.test(r.name));
  if (candidates.length < 4) candidates = roadData.roads.filter(r => r.type.replace(/_link$/, "") === "primary" && Math.abs(r.x) < 1000);
  if (candidates.length) {
    let weight = 0, x = 0, z = 0, s2 = 0, c2 = 0;
    for (const r of candidates) { const w = Math.max(1, r.len); weight += w; x += r.x * w; z += r.z * w; s2 += Math.sin(r.a * 2) * w; c2 += Math.cos(r.a * 2) * w; }
    roadData.anchor = { x: x / weight, z: z / weight, a: .5 * Math.atan2(s2, c2) };
  }
}

const farWorld = new THREE.Group(); farWorld.name = "Vegas streamed fallback world"; scene.add(farWorld);
const farBuildingBoxes = [];
function buildFarVegas() {
  const roads = roadData.roads;
  if (!roads.length) return;
  const roadGeo = new THREE.BoxGeometry(1, .08, 1);
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2f3033, roughness: .88, metalness: .03 });
  const roadMesh = new THREE.InstancedMesh(roadGeo, roadMat, roads.length); roadMesh.receiveShadow = true;
  const matrix = new THREE.Matrix4(), quat = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  roads.forEach((r, i) => { quat.setFromAxisAngle(up, r.a); matrix.compose(new THREE.Vector3(r.x, -.08, r.z), quat, new THREE.Vector3(r.w, 1, r.len + 1)); roadMesh.setMatrixAt(i, matrix); }); roadMesh.instanceMatrix.needsUpdate = true; farWorld.add(roadMesh);
  const lots = [];
  for (let i = 0; i < roads.length && lots.length < (pipeline.name === "mobile" ? 520 : 1250); i++) {
    const r = roads[i]; if (r.type.startsWith("motorway") || r.len < 15 || seeded(i + 1) < .47) continue;
    const nx = -Math.cos(r.a), nz = Math.sin(r.a);
    for (const side of [-1, 1]) {
      if (seeded(i * 3 + side * 17) < .32) continue;
      const offset = r.w * .5 + 17 + seeded(i + 20) * 30;
      const x = r.x + nx * offset * side, z = r.z + nz * offset * side;
      if (Math.hypot(x - roadData.anchor.x, z - roadData.anchor.z) < 280) continue;
      const centerBoost = 1 - clamp(Math.hypot(x, z) / 3300, 0, 1);
      lots.push({ x, z, a: r.a, w: 18 + seeded(i + 31) * 52, d: 18 + seeded(i + 37) * 48, h: 14 + seeded(i + 41) * 60 + centerBoost * centerBoost * (40 + seeded(i + 51) * 220), style: (seeded(i + 57) * 6) | 0 });
    }
  }
  const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let style = 0; style < 6; style++) {
    const arr = lots.filter(l => l.style === style), map = assets.facade[style] || (style % 2 ? materials.coolWindows : materials.warmWindows);
    if (map) { map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(1, 2.5); }
    const mat = new THREE.MeshStandardMaterial({ color: 0x59616a, map, roughness: .48, metalness: .18, emissive: 0x1c170e, emissiveMap: map || null, emissiveIntensity: .16 });
    const inst = new THREE.InstancedMesh(buildingGeo, mat, arr.length); inst.castShadow = false; inst.receiveShadow = true;
    arr.forEach((b, i) => { quat.setFromAxisAngle(up, b.a); matrix.compose(new THREE.Vector3(b.x, b.h * .5, b.z), quat, new THREE.Vector3(b.w, b.h, b.d)); inst.setMatrixAt(i, matrix); if (Math.hypot(b.x - roadData.anchor.x, b.z - roadData.anchor.z) < 900) farBuildingBoxes.push(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(b.x, b.h * .5, b.z), new THREE.Vector3(b.w, b.h, b.d))); });
    inst.instanceMatrix.needsUpdate = true; farWorld.add(inst);
  }
}

let cityLayer = null, stripLayer = null, cityLoadStarted = false, stripLoadStarted = false;
function prepareGlb(root, kind) {
  const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const span = Math.max(size.x, size.z, 1), target = kind === "city" ? WORLD * .9 : 4600, s = target / span;
  const rot = kind === "strip" ? (size.x > size.z ? Math.PI / 2 : 0) + roadData.anchor.a : 0;
  root.scale.setScalar(s); root.rotation.y = rot;
  const transformed = center.clone().multiplyScalar(s).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot), anchor = kind === "strip" ? roadData.anchor : { x: 0, z: 0 };
  root.position.set(anchor.x - transformed.x, -box.min.y * s - (kind === "strip" ? .7 : .65), anchor.z - transformed.z);
  root.name = kind === "city" ? "Las Vegas city background LOD" : "Las Vegas Strip streamed LOD";
  root.traverse(o => { if (!o.isMesh) return; o.castShadow = false; o.receiveShadow = true; o.frustumCulled = true; const mats = Array.isArray(o.material) ? o.material : [o.material]; for (const m of mats) { if (!m) continue; m.roughness = Math.max(.2, m.roughness ?? .65); m.metalness = Math.min(.75, m.metalness ?? .1); if (m.map) m.map.anisotropy = pipeline.name === "mobile" ? 2 : 8; m.envMapIntensity = 1.0; m.needsUpdate = true; } });
  scene.add(root); return root;
}
function loadVegasLayer(kind) {
  const started = kind === "city" ? cityLoadStarted : stripLoadStarted; if (started) return;
  if (kind === "city") cityLoadStarted = true; else stripLoadStarted = true;
  const file = kind === "city" ? "vegas-city-lod.glb" : "vegas-strip-lod.glb";
  gltf.load(`${textureRoot}models/${file}`, g => { if (kind === "city") cityLayer = prepareGlb(g.scene, kind); else stripLayer = prepareGlb(g.scene, kind); notice(kind === "city" ? "LAS VEGAS BACKGROUND STREAM ONLINE" : "HIGH DETAIL STRIP STREAM ONLINE"); }, undefined, () => { if (kind === "city") cityLoadStarted = false; else stripLoadStarted = false; });
}

const section = { zero: null };

function createWedgeGeometry(width, height, length, frontDrop = .35) {
  const w = width / 2, l = length / 2, y0 = 0, y1 = height;
  const vertices = new Float32Array([-w,y0,-l, w,y0,-l, w,y0,l, -w,y0,l, -w,y1,-l, w,y1,-l, w,y1-frontDrop,l, -w,y1-frontDrop,l]);
  const indices = [0,1,2,0,2,3,4,7,6,4,6,5,0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0];
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3)); geo.setIndex(indices); geo.computeVertexNormals(); return geo;
}

function makeHeroCharacter() {
  const root = new THREE.Group(); root.name = "JC Hero";
  const cloth = new THREE.MeshStandardMaterial({ color: 0x101113, roughness: .9 });
  const cloth2 = new THREE.MeshStandardMaterial({ color: 0x202126, roughness: .84 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xa66f50, roughness: .72 });
  const gold = materials.gold;
  const shoe = new THREE.MeshPhysicalMaterial({ color: 0xf4f0e7, roughness: .28, metalness: .08, clearcoat: .5, clearcoatRoughness: .18 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x23160f, roughness: .94 });
  const body = new THREE.Group(); root.add(body);
  const hips = new THREE.Group(); hips.position.y = 2.65; body.add(hips);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.86, 1.45, 8, 14), cloth); torso.position.y = 1.75; torso.scale.set(1.05, 1.0, .68); torso.castShadow = true; hips.add(torso);
  const hoodieHem = new THREE.Mesh(new THREE.CylinderGeometry(.88, .98, .55, 16), cloth); hoodieHem.position.y = 1.1; hoodieHem.scale.z = .72; hoodieHem.castShadow = true; hips.add(hoodieHem);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.55, 20, 14), skin); head.position.y = 3.72; head.castShadow = true; hips.add(head);
  const hood = new THREE.Mesh(new THREE.TorusGeometry(.64, .18, 10, 24, Math.PI * 1.15), cloth); hood.rotation.x = Math.PI / 2; hood.rotation.z = -.15; hood.position.set(0, 3.55, -.25); hips.add(hood);
  for (let i = 0; i < 18; i++) { const a = (i / 18 - .5) * 2.6, strand = new THREE.Mesh(new THREE.CapsuleGeometry(.035, 1.45 + seeded(i) * .65, 4, 6), hair); strand.position.set(Math.sin(a) * .48, 3.15 - seeded(i + 80) * .25, -.22 + Math.cos(a) * .35); strand.rotation.z = Math.sin(a) * .28; strand.rotation.x = .08 + seeded(i + 20) * .2; hips.add(strand); }
  const armPivots = [], legPivots = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(side * .92, 2.8, 0); hips.add(arm); armPivots.push(arm);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(.22, .92, 6, 8), cloth); upper.position.y = -.55; upper.castShadow = true; arm.add(upper);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(.22, 10, 8), skin); hand.position.y = -1.25; arm.add(hand);
    const leg = new THREE.Group(); leg.position.set(side * .38, 0, 0); hips.add(leg); legPivots.push(leg);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(.29, 1.18, 6, 10), cloth2); thigh.position.y = -1.0; thigh.castShadow = true; leg.add(thigh);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(.24, 1.1, 6, 10), cloth2); shin.position.y = -2.05; shin.castShadow = true; leg.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(.58, .35, 1.05), shoe); foot.position.set(0, -2.72, .22); foot.castShadow = true; leg.add(foot);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(.62, .08, .66), gold); stripe.position.set(0, -2.57, .36); leg.add(stripe);
  }
  const chainCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(.55, 1.1, .62), new THREE.Vector3(.72, .4, .68), new THREE.Vector3(.4, -.25, .6)]); const chain = new THREE.Mesh(new THREE.TubeGeometry(chainCurve, 16, .035, 6, false), gold); hips.add(chain);
  const backTex = assets.character ? atlasTile(assets.character, 0, 0) : null;
  const backCanvas = document.createElement("canvas"); backCanvas.width = 512; backCanvas.height = 512; const bc = backCanvas.getContext("2d"); bc.clearRect(0,0,512,512); bc.fillStyle = "#d9ad4b"; bc.textAlign = "center"; bc.font = "700 86px Georgia"; bc.fillText("HOLY",256,190); bc.fillText("SHIT",256,285); bc.font = "700 96px Georgia"; bc.fillText("†",256,395); const textTex = new THREE.CanvasTexture(backCanvas); textTex.colorSpace = THREE.SRGBColorSpace;
  const textOverlay = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.8), new THREE.MeshBasicMaterial({ map: textTex, transparent: true, toneMapped: false, depthWrite: false })); textOverlay.position.set(0, 1.9, -.72); textOverlay.rotation.y = Math.PI; hips.add(textOverlay);
  if (backTex) { const atlasPanel = new THREE.Mesh(new THREE.PlaneGeometry(1.58,1.82),new THREE.MeshBasicMaterial({map:backTex,transparent:true,toneMapped:false,opacity:.18,depthWrite:false}));atlasPanel.position.set(0,1.9,-.725);atlasPanel.rotation.y=Math.PI;hips.add(atlasPanel); }
  const shadowBlob = new THREE.Mesh(new THREE.CircleGeometry(1.2, 28), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .34, depthWrite: false })); shadowBlob.rotation.x = -Math.PI/2; shadowBlob.position.y = .025; root.add(shadowBlob);
  root.userData.anim = { hips, torso, head, armPivots, legPivots, stride: 0, shadowBlob };
  return root;
}

function animateHero(hero, dt, speed, flying, aiming = false) {
  const a = hero.userData.anim; if (!a) return;
  const moving = Math.abs(speed) > .08; a.stride += dt * (moving ? 7.5 + Math.abs(speed) * .18 : 2.1);
  const amp = flying ? .18 : moving ? .68 : .05, s = Math.sin(a.stride);
  a.legPivots[0].rotation.x = flying ? -.25 : s * amp; a.legPivots[1].rotation.x = flying ? -.25 : -s * amp;
  a.armPivots[0].rotation.x = aiming ? -1.08 : flying ? -1.0 : -s * amp * .65; a.armPivots[1].rotation.x = aiming ? -.78 : flying ? -1.0 : s * amp * .65;
  a.armPivots[0].rotation.z = flying ? .62 : .05; a.armPivots[1].rotation.z = flying ? -.62 : -.05;
  a.hips.position.y = 2.65 + (moving && !flying ? Math.abs(Math.sin(a.stride * 2)) * .06 : Math.sin(a.stride) * .015);
  a.torso.rotation.z = moving ? s * .018 : 0; a.head.rotation.y = aiming ? .15 : Math.sin(a.stride * .3) * .03;
  a.shadowBlob.visible = !flying;
}

function makeSportsCar({ evil = false, traffic = false, index = 0 } = {}) {
  const root = new THREE.Group(), chassis = new THREE.Group(); root.add(chassis); root.userData.wheels = [];
  const trafficColors=[0x1c2630,0xb2ada2,0x5f1212,0x121418,0x9b7a32];
  const paint = new THREE.MeshPhysicalMaterial({ color: evil ? 0x0b0707 : traffic ? trafficColors[index%trafficColors.length] : 0x08090b, metalness: .88, roughness: .14, clearcoat: 1, clearcoatRoughness: .055, envMapIntensity: 1.8 });
  const trim = new THREE.MeshPhysicalMaterial({ color: evil ? 0xb91d17 : 0xd5a43b, metalness: .96, roughness: .18, clearcoat: .5, envMapIntensity: 1.7, emissive: evil ? 0x3d0000 : 0x2f2205, emissiveIntensity: .28 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x15212a, roughness: .05, metalness: .1, transmission: .25, transparent: true, opacity: .78, clearcoat: 1, envMapIntensity: 1.8 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x070708, roughness: .88 }); const rim = materials.blackMetal;
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.25, .82, 8.1), paint); body.position.y = 1.05; body.castShadow = true; chassis.add(body);
  const lower = new THREE.Mesh(new THREE.BoxGeometry(4.4, .32, 7.3), trim); lower.position.y = .62; chassis.add(lower);
  const hood = new THREE.Mesh(createWedgeGeometry(4.05, .52, 2.9, .18), paint); hood.position.set(0,1.38,2.1); chassis.add(hood);
  const cabin = new THREE.Mesh(createWedgeGeometry(3.45,1.42,3.25,.55), glass); cabin.position.set(0,1.34,-.45); cabin.castShadow = true; chassis.add(cabin);
  const spoiler = new THREE.Group(); spoiler.position.set(0,1.95,-3.25); spoiler.add(new THREE.Mesh(new THREE.BoxGeometry(3.2,.12,.55),trim)); for(const x of[-1.15,1.15]){const s=new THREE.Mesh(new THREE.BoxGeometry(.12,.62,.15),trim);s.position.set(x,-.25,.05);spoiler.add(s)} chassis.add(spoiler);
  const tailMat = new THREE.MeshBasicMaterial({ color: evil ? 0xff2b16 : 0xff271d, toneMapped: false }); const tail = new THREE.Mesh(new THREE.BoxGeometry(3.55,.18,.08),tailMat); tail.position.set(0,1.22,-4.08); chassis.add(tail);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff4c8, toneMapped: false }); for(const x of[-1.35,1.35]) { const h = new THREE.Mesh(new THREE.BoxGeometry(.72,.18,.08),headMat); h.position.set(x,1.2,4.08); chassis.add(h); }
  const plateCanvas = document.createElement("canvas"); plateCanvas.width=256;plateCanvas.height=96;const pc=plateCanvas.getContext("2d");pc.fillStyle="#eae3cf";pc.fillRect(0,0,256,96);pc.fillStyle="#111";pc.font="700 48px Arial";pc.textAlign="center";pc.textBaseline="middle";pc.fillText(evil?"SIN-666":"JC-777",128,50);const plateTex=new THREE.CanvasTexture(plateCanvas);plateTex.colorSpace=THREE.SRGBColorSpace;const plate=new THREE.Mesh(new THREE.PlaneGeometry(1.25,.46),new THREE.MeshBasicMaterial({map:plateTex,toneMapped:false}));plate.position.set(0,.92,-4.14);plate.rotation.y=Math.PI;chassis.add(plate);
  if(assets.vehicle&&!traffic){const decal=atlasTile(assets.vehicle,evil?2:0,evil?2:3);if(decal){const d=new THREE.Mesh(new THREE.PlaneGeometry(2.6,.8),new THREE.MeshBasicMaterial({map:decal,transparent:true,toneMapped:false,opacity:.35,depthWrite:false}));d.position.set(0,1.48,-4.13);d.rotation.y=Math.PI;chassis.add(d)}}
  for (const x of [-2.05, 2.05]) for (const z of [-2.45, 2.45]) { const mount = new THREE.Group(), steer = new THREE.Group(), spin = new THREE.Group(); mount.position.set(x,.62,z); const tire = new THREE.Mesh(new THREE.CylinderGeometry(.69,.69,.42,18),rubber); tire.rotation.z=Math.PI/2; tire.castShadow=true; const rimMesh = new THREE.Mesh(new THREE.CylinderGeometry(.39,.39,.46,12),rim); rimMesh.rotation.z=Math.PI/2; spin.add(tire,rimMesh); steer.add(spin); mount.add(steer); chassis.add(mount); root.userData.wheels.push({ mount, steer, spin, front:z>0, radius:.69 }); }
  const underglow = new THREE.PointLight(evil?0xff2018:0xd5aa4b, evil?32:18, 22, 2); underglow.position.set(0,.35,-1); chassis.add(underglow); root.userData.underglow=underglow;
  root.userData.chassis=chassis; root.userData.paint=paint; root.userData.tail=tail; return root;
}
function animateCar(car, speed, steer, dt) { for (const w of car.userData.wheels || []) { w.spin.rotation.x -= speed * dt / w.radius; if (w.front) w.steer.rotation.y = lerp(w.steer.rotation.y, steer * .52, 1 - Math.exp(-12 * dt)); } }

const npcTileCache=new Map();
function npcTile(col,row){const key=`${col}:${row}`;if(npcTileCache.has(key))return npcTileCache.get(key);const t=assets.npc?atlasTile(assets.npc,col,row):null;npcTileCache.set(key,t);return t;}
function makeCitizen(index) {
  const root = new THREE.Group(); const tex = npcTile(index%4,3) || (assets.character ? atlasTile(assets.character,index%4,1) : null);
  const mat = new THREE.SpriteMaterial({ map: tex, color: tex ? 0xffffff : 0xa4a9b0, transparent: true, depthWrite: false, toneMapped: false });
  const sprite = new THREE.Sprite(mat); sprite.scale.set(2.7,5.4,1); sprite.position.y=2.7; root.add(sprite);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(.7,18),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.24,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.02;root.add(shadow);
  root.userData={index,sprite,mat,state:"normal",phase:seeded(index+77)*TAU,speed:1.6+seeded(index+91)*1.8,dir:index%2?1:-1,side:index%2?1:-1,progress:seeded(index+111),taken:false,saved:false}; return root;
}
function setCitizenState(c, state) { c.userData.state=state; const sprite=c.userData.sprite;if(assets.npc){const row=state==="lost"?2:state==="saved"?1:state==="taken"?0:3;sprite.material.map=npcTile(c.userData.index%4,row);sprite.material.needsUpdate=true}sprite.material.color.set(state==="lost"?0xff707d:state==="saved"?0xffe9a3:state==="taken"?0x3a1c24:0xffffff); }

function buildHeaven() {
  const root=new THREE.Group();root.name="Heaven Realm";root.position.y=920;root.visible=false;scene.add(root);const cloudMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.62,depthWrite:false});
  for(let i=0;i<34;i++){const c=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),cloudMat);const a=seeded(i+900)*TAU,r=80+seeded(i+920)*520;c.position.set(Math.cos(a)*r,(seeded(i+940)-.5)*110,Math.sin(a)*r);c.scale.set(40+seeded(i+960)*100,12+seeded(i+980)*24,35+seeded(i+1000)*90);root.add(c)}
  const pearl=new THREE.MeshStandardMaterial({color:0xfff8e7,roughness:.28,metalness:.08,emissive:0x625b3c,emissiveIntensity:.32});const gate=new THREE.Group();for(const x of[-30,30]){const c=new THREE.Mesh(new THREE.CylinderGeometry(4.2,5.2,64,18),pearl);c.position.set(x,32,0);gate.add(c)}const arch=new THREE.Mesh(new THREE.TorusGeometry(30,4.2,12,48,Math.PI),materials.gold);arch.position.y=64;arch.rotation.z=Math.PI;gate.add(arch);const path=new THREE.Mesh(new THREE.BoxGeometry(76,2,180),materials.polishedGold);path.position.set(0,0,90);gate.add(path);root.add(gate);const light=new THREE.PointLight(0xfff2b0,120,620,1.2);light.position.set(0,90,0);root.add(light);return root;
}
const heaven=buildHeaven();

const player = { hero:null, car:null, devilCar:null, object:null, inCar:false, flying:false, velocity:new THREE.Vector3(), heading:0, footAngle:0, speed:0, steer:0, health:100, grace:100, boost:0, mode:"jc", lastSafe:new THREE.Vector3(), spawn:new THREE.Vector3(), exteriorReturn:new THREE.Vector3(), insideInterior:false };
const interior={root:null,portal:null};
function buildInterior() { if(interior.root)return;const root=new THREE.Group();root.position.set(0,-900,0);root.visible=false;scene.add(root);interior.root=root;const wall=new THREE.MeshStandardMaterial({color:0x1b1a1a,roughness:.8}),floorMat=new THREE.MeshPhysicalMaterial({color:0x3d342a,roughness:.5,clearcoat:.3});const floor=new THREE.Mesh(new THREE.BoxGeometry(46,1,36),floorMat);floor.position.y=0;root.add(floor);const ceiling=new THREE.Mesh(new THREE.BoxGeometry(46,1,36),wall);ceiling.position.y=13;root.add(ceiling);for(const x of[-23,23]){const w=new THREE.Mesh(new THREE.BoxGeometry(1,13,36),wall);w.position.set(x,6.5,0);root.add(w)}const back=new THREE.Mesh(new THREE.BoxGeometry(46,13,1),wall);back.position.set(0,6.5,18);root.add(back);const exit=new THREE.Mesh(new THREE.BoxGeometry(6,8,.5),materials.gold);exit.position.set(0,4,-17.6);root.add(exit);const cross=new THREE.Group();const cv=new THREE.Mesh(new THREE.BoxGeometry(.35,4,.25),materials.gold);const ch=new THREE.Mesh(new THREE.BoxGeometry(2.5,.35,.25),materials.gold);ch.position.y=.8;cross.add(cv,ch);cross.position.set(0,8,17.4);root.add(cross);const light1=new THREE.PointLight(0xffd27e,55,55,2);light1.position.set(0,10,0);root.add(light1); }

const progression = loadProfile();
function loadProfile(){try{const saved=JSON.parse(localStorage.getItem("jcHolyOgProfileV3")||"{}");return{level:saved.level||1,xp:saved.xp||0,coins:saved.coins||2500,bestScore:saved.bestScore||0,totalSaved:saved.totalSaved||0}}catch{return{level:1,xp:0,coins:2500,bestScore:0,totalSaved:0}}}
function xpFloor(level){return Math.max(0,(level-1)*1000+(level-1)*(level-2)*125)}
function xpNext(level){return level*1000+level*(level-1)*125}
function saveProfile(){localStorage.setItem("jcHolyOgProfileV3",JSON.stringify(progression))}
function addProgress(xp,coins){progression.xp+=xp;progression.coins+=coins;while(progression.xp>=xpNext(progression.level))progression.level++;saveProfile();syncHUD()}

const game={playing:false,won:false,saved:0,taken:0,target:12,limit:6,score:0,worldTime:.705,manualTime:false,night:false,noticeTimer:0,shotCooldown:0,graceCooldown:0,corruption:1,fps:60,fpsAccum:0,fpsFrames:0,devPanel:false};
const keys={};const cameraState={yaw:Math.PI,pitch:.25,distance:9.5,targetDistance:9.5,shoulder:.75,dragging:false,pointerId:null,lastX:0,lastY:0};const projectiles=[],citizens=[],traffic=[],effects=[];let sectionZero=null;
function localToWorld(local){const v=local.clone();sectionZero.root.localToWorld(v);return v}function worldToSection(world){const v=world.clone();sectionZero.root.worldToLocal(v);return v}

function spawnWorld() { sectionZero=buildSectionZero({scene,materials,anchor:new THREE.Vector3(roadData.anchor.x,0,roadData.anchor.z),angle:roadData.anchor.a,quality:pipeline.name});section.zero=sectionZero;sectionZero.localLights.forEach((light,index)=>{light.visible=index<quality.maxLights});const spawn=localToWorld(new THREE.Vector3(-8,0,112));player.spawn.copy(spawn);player.lastSafe.copy(spawn);player.hero=makeHeroCharacter();player.hero.position.copy(spawn);player.hero.rotation.y=roadData.anchor.a+Math.PI;scene.add(player.hero);player.car=makeSportsCar();player.car.position.copy(localToWorld(new THREE.Vector3(-9,0,102)));player.car.rotation.y=roadData.anchor.a;scene.add(player.car);player.devilCar=makeSportsCar({evil:true});player.devilCar.position.copy(localToWorld(new THREE.Vector3(6,0,-248)));player.devilCar.rotation.y=roadData.anchor.a+Math.PI;scene.add(player.devilCar);player.object=player.hero;player.heading=roadData.anchor.a;player.footAngle=roadData.anchor.a;cameraState.yaw=roadData.anchor.a+Math.PI;buildInterior();spawnCitizens();spawnTraffic(); }
function spawnCitizens(){for(let i=0;i<quality.crowd;i++){const c=makeCitizen(i),side=i%2?1:-1,local=new THREE.Vector3(side*(22+seeded(i+200)*7),0,120-seeded(i+300)*380);c.position.copy(localToWorld(local));scene.add(c);citizens.push(c);if(i<Math.min(6,quality.crowd))setCitizenState(c,"lost")}}
function spawnTraffic(){for(let i=0;i<quality.traffic;i++){const car=makeSportsCar({traffic:true,index:i}),lane=i%2?5.3:-5.3,local=new THREE.Vector3(lane,0,130-seeded(i+500)*420);car.position.copy(localToWorld(local));car.rotation.y=roadData.anchor.a+(i%2?Math.PI:0);scene.add(car);traffic.push({car,lane,progress:local.z,dir:i%2?-1:1,speed:12+seeded(i+600)*13})}}
function updateTraffic(dt){for(const t of traffic){t.progress+=t.dir*t.speed*dt;if(t.progress>150)t.progress=-300;if(t.progress<-300)t.progress=150;t.car.position.copy(localToWorld(new THREE.Vector3(t.lane,0,t.progress)));t.car.rotation.y=roadData.anchor.a+(t.dir<0?Math.PI:0);animateCar(t.car,t.dir*t.speed,0,dt);t.car.visible=t.car.position.distanceTo(player.object.position)<quality.drawDistance*.45}}
function updateCitizens(dt){const core=localToWorld(new THREE.Vector3(72,0,-210));for(const c of citizens){if(!c.visible)continue;const u=c.userData;u.phase+=dt;const local=worldToSection(c.position);if(u.state==="normal"||u.state==="saved"){local.z+=u.dir*u.speed*dt;if(local.z>140){local.z=140;u.dir=-1}else if(local.z<-280){local.z=-280;u.dir=1}local.x=u.side*(22+Math.sin(u.phase*.4)*2.4);c.position.copy(localToWorld(local))}else if(u.state==="lost"){const dir=core.clone().sub(c.position);dir.y=0;if(dir.lengthSq()>1)dir.normalize();c.position.addScaledVector(dir,dt*3.7);if(c.position.distanceTo(core)<7){u.state="taken";u.taken=true;c.visible=false;game.taken++;game.score=Math.max(0,game.score-350);notice("A SOUL WAS TAKEN");if(game.taken>=game.limit)finish(false)}}c.userData.sprite.position.y=2.72+Math.sin(u.phase*3)*.08}}
function nearestLost(maxDistance=130){let best=null,bestScore=Infinity;const camDir=new THREE.Vector3();camera.getWorldDirection(camDir);for(const c of citizens){if(!c.visible||c.userData.state!=="lost")continue;const to=c.position.clone().sub(player.object.position),d=to.length();if(d>maxDistance)continue;to.normalize();const angle=1-camDir.dot(to),score=d+angle*90;if(angle<.72&&score<bestScore){best=c;bestScore=score}}return best}
function fireDivine(){if(!game.playing||game.shotCooldown>0||player.grace<1)return;game.shotCooldown=.18;player.grace=Math.max(0,player.grace-.8);const target=nearestLost(),start=player.object.position.clone().add(new THREE.Vector3(0,player.inCar?1.6:3.1,0)),dir=target?target.position.clone().add(new THREE.Vector3(0,2.4,0)).sub(start).normalize():camera.getWorldDirection(new THREE.Vector3()).normalize(),evil=player.mode==="satan";const mat=new THREE.MeshBasicMaterial({color:evil?0xff311e:0xfff0a2,toneMapped:false,transparent:true,opacity:.98}),orb=new THREE.Mesh(new THREE.SphereGeometry(evil?.28:.2,10,8),mat);orb.position.copy(start);scene.add(orb);const light=new THREE.PointLight(evil?0xff2716:0xffdd84,evil?24:15,18,2);orb.add(light);projectiles.push({mesh:orb,dir,target,speed:evil?88:145,life:3.5,type:evil?"inferno":"light"})}
function updateProjectiles(dt){for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];p.life-=dt;if(p.target&&p.target.visible&&p.target.userData.state==="lost"){const desired=p.target.position.clone().add(new THREE.Vector3(0,2.2,0)).sub(p.mesh.position).normalize();p.dir.lerp(desired,1-Math.exp(-8*dt)).normalize()}p.mesh.position.addScaledVector(p.dir,p.speed*dt);p.mesh.scale.setScalar(.85+Math.sin(performance.now()*.018)*.15);if(p.type==="light")for(const c of citizens)if(c.visible&&c.userData.state==="lost"&&c.position.distanceTo(p.mesh.position)<2.7){restoreSoul(c);p.life=0;break}if(p.life<=0){scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();projectiles.splice(i,1)}}}
function restoreSoul(c){if(c.userData.state!=="lost")return;c.userData.saved=true;setCitizenState(c,"saved");game.saved++;game.score+=650;progression.totalSaved++;addProgress(450,275);game.corruption=clamp(1-game.saved/game.target,0,1);sectionZero.setCorruption(game.corruption);notice("SOUL CLEANSED • +450 HOLY XP • +$275");if(game.saved>=game.target)finish(true)}
function graceWave(){if(player.flying||player.grace<30||game.graceCooldown>0)return;player.grace-=30;game.graceCooldown=1.25;const ring=new THREE.Mesh(new THREE.TorusGeometry(2,.18,10,64),new THREE.MeshBasicMaterial({color:0xbff7ff,transparent:true,opacity:.9,toneMapped:false}));ring.rotation.x=Math.PI/2;ring.position.copy(player.object.position).setY(.4);scene.add(ring);effects.push({mesh:ring,life:1,max:1,type:"ring"});for(const c of citizens)if(c.visible&&c.userData.state==="lost"&&c.position.distanceTo(player.object.position)<36)restoreSoul(c);notice("GRACE WAVE")}
function miracleDash(){if(player.grace<15)return;player.grace-=15;player.boost=1.1;if(!player.inCar){const f=new THREE.Vector3(Math.sin(player.footAngle),0,Math.cos(player.footAngle)),old=player.hero.position.clone();player.hero.position.addScaledVector(f,18);if(collides(player.hero.position,1.1))player.hero.position.copy(old)}notice("MIRACLE DASH")}
function updateEffects(dt){for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.life-=dt;if(e.type==="ring"){e.mesh.scale.multiplyScalar(1+dt*5);e.mesh.material.opacity=Math.max(0,e.life/e.max)}if(e.life<=0){scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();effects.splice(i,1)}}}
function collides(pos,radius){if(player.insideInterior)return Math.abs(pos.x)>20.5||Math.abs(pos.z)>15.5;if(sectionZero?.collisionAt(pos,radius))return true;for(const b of farBuildingBoxes)if(b.distanceToPoint(pos)<radius)return true;return false}
function recoverIfNeeded(){const p=player.object.position;if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.z)||p.y<-50||Math.abs(p.x)>WORLD*.6||Math.abs(p.z)>WORLD*.6){player.inCar=false;player.flying=false;player.hero.visible=true;player.hero.position.copy(player.lastSafe.lengthSq()?player.lastSafe:player.spawn);player.hero.position.y=0;player.object=player.hero;player.velocity.set(0,0,0);player.speed=0;notice("SPAWN RECOVERY • RETURNED TO SAFE GROUND")}}

function updatePlayer(dt){const fwd=(keys.KeyW?1:0)-(keys.KeyS?1:0),strafe=(keys.KeyD?1:0)-(keys.KeyA?1:0);if(player.inCar){const car=player.car,max=player.boost>0?76:54,acc=fwd>=0?32:24;player.speed+=fwd*acc*dt;const brake=keys.ShiftLeft||keys.ShiftRight;player.speed*=Math.pow(brake?.94:.985,dt*60);player.speed=clamp(player.speed,-18,max);const targetSteer=strafe*clamp(Math.abs(player.speed)/18,.22,1);player.steer=lerp(player.steer,targetSteer,1-Math.exp(-11*dt));player.heading+=player.steer*dt*1.18*(player.speed>=0?1:-1);const old=car.position.clone();car.position.x+=Math.sin(player.heading)*player.speed*dt;car.position.z+=Math.cos(player.heading)*player.speed*dt;if(collides(car.position,2.7)){car.position.copy(old);player.speed*=-.22;player.health=Math.max(0,player.health-3)}car.rotation.y=player.heading;animateCar(car,player.speed,player.steer,dt);player.boost=Math.max(0,player.boost-dt);player.object=car}else{const camForward=new THREE.Vector3(-Math.sin(cameraState.yaw),0,-Math.cos(cameraState.yaw)).normalize(),camRight=new THREE.Vector3(camForward.z,0,-camForward.x),desired=new THREE.Vector3().addScaledVector(camForward,fwd).addScaledVector(camRight,strafe);if(player.flying){if(desired.lengthSq()>.001){desired.normalize();const fs=(keys.ShiftLeft||keys.ShiftRight)?46:29,blend=1-Math.exp(-10*dt);player.velocity.x=lerp(player.velocity.x,desired.x*fs,blend);player.velocity.z=lerp(player.velocity.z,desired.z*fs,blend);player.footAngle=Math.atan2(desired.x,desired.z)}else{player.velocity.x*=Math.exp(-12*dt);player.velocity.z*=Math.exp(-12*dt)}const lift=(keys.Space?1:0)-((keys.ControlLeft||keys.ControlRight)?1:0);if(lift)player.velocity.y=lerp(player.velocity.y,lift*((keys.ShiftLeft||keys.ShiftRight)?65:38),1-Math.exp(-8*dt));else player.velocity.y*=Math.exp(-3*dt);const old=player.hero.position.clone();player.hero.position.addScaledVector(player.velocity,dt);player.hero.position.y=clamp(player.hero.position.y,2.5,1800);if(player.hero.position.y<7&&collides(player.hero.position,1.1)){player.hero.position.x=old.x;player.hero.position.z=old.z;player.velocity.x=player.velocity.z=0}player.hero.rotation.y=player.footAngle;animateHero(player.hero,dt,player.velocity.length(),true,false)}else if(desired.lengthSq()>.001){desired.normalize();const speed=(keys.ShiftLeft||keys.ShiftRight)?13.5:7.2;player.footAngle=Math.atan2(desired.x,desired.z);const old=player.hero.position.clone();player.hero.position.addScaledVector(desired,speed*dt);if(collides(player.hero.position,1.0))player.hero.position.copy(old);else player.lastSafe.copy(player.hero.position);player.hero.rotation.y=player.footAngle;animateHero(player.hero,dt,speed,false,game.shotCooldown>.05)}else animateHero(player.hero,dt,0,false,game.shotCooldown>.05);player.object=player.hero}recoverIfNeeded()}

function toggleVehicle(){if(player.insideInterior){exitInterior();return}if(player.inCar){player.inCar=false;player.hero.visible=true;player.hero.position.copy(player.car.position).add(new THREE.Vector3(Math.cos(player.heading)*3.8,0,-Math.sin(player.heading)*3.8));player.hero.rotation.y=player.heading;player.footAngle=player.heading;player.object=player.hero;player.speed=0;notice("ON FOOT");return}const portal=sectionZero.nearestPortal(player.hero.position,6.8);if(portal){enterInterior(portal.portal);return}if(player.hero.position.distanceTo(player.car.position)<7.5){player.flying=false;player.velocity.set(0,0,0);player.inCar=true;player.hero.visible=false;player.object=player.car;player.heading=player.car.rotation.y;notice("JC-777 • IGNITION")}else notice("MOVE CLOSER TO THE JC-777 OR A GOLD DOOR")}
function enterInterior(portal){player.exteriorReturn.copy(player.hero.position);player.insideInterior=true;player.flying=false;player.velocity.set(0,0,0);interior.portal=portal;interior.root.visible=true;player.hero.position.set(0,-899,4);player.hero.visible=true;player.object=player.hero;notice(`${portal.id} • E TO EXIT`)}
function exitInterior(){player.insideInterior=false;interior.root.visible=false;player.hero.position.copy(player.exteriorReturn);player.object=player.hero;interior.portal=null;notice("RETURNED TO LAS VEGAS")}
function toggleFlight(){if(player.inCar||player.insideInterior)return;player.flying=!player.flying;player.velocity.set(0,0,0);if(player.flying){player.hero.position.y=Math.max(2.5,player.hero.position.y);notice("DIVINE FLIGHT • SPACE ASCEND • CTRL DESCEND")}else{player.hero.position.y=0;notice("DIVINE LANDING")}}
function pray(){if(player.inCar)return;player.grace=clamp(player.grace+26,0,100);player.health=clamp(player.health+12,0,100);notice("PRAYER • GRACE RESTORED")}
function updateHeaven(dt){const altitude=!player.inCar?player.hero.position.y:0,blend=clamp((altitude-350)/580,0,1);heaven.visible=altitude>250;heaven.position.x=player.hero.position.x;heaven.position.z=player.hero.position.z;heaven.rotation.y+=dt*.008;if(blend>.02){scene.fog.density=lerp(game.night?.00038:.00023,.00006,blend);pipeline.setExposure(lerp(game.night?.76:1.02,1.18,blend))}if(altitude>900&&!heaven.userData.reached){heaven.userData.reached=true;player.health=100;player.grace=100;game.score+=2500;addProgress(1000,777);notice("HEAVEN REACHED • DIVINE POWER RESTORED")}if(altitude<500)heaven.userData.reached=false}
function updateDevil(dt){if(!player.devilCar)return;const targetLocal=worldToSection(player.object.position),local=worldToSection(player.devilCar.position);let desiredZ=targetLocal.z-28;if(game.corruption>.2)desiredZ=lerp(desiredZ,-205,game.corruption*.55);const dir=Math.sign(desiredZ-local.z)||1;local.z+=dir*18*dt;local.x=7.2;player.devilCar.position.copy(localToWorld(local));player.devilCar.rotation.y=roadData.anchor.a+(dir<0?Math.PI:0);animateCar(player.devilCar,dir*18,0,dt);player.devilCar.userData.underglow.intensity=18+Math.sin(performance.now()*.004)*8;if(player.devilCar.position.distanceTo(player.object.position)<8&&!player.flying){player.health=Math.max(0,player.health-dt*7);if(player.health<=0)finish(false)}}

function angleLerp(a,b,t){return a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t}
function updateCamera(dt){const target=player.object.position.clone().add(new THREE.Vector3(0,player.inCar?1.6:player.flying?3.2:3.0,0));if(!cameraState.dragging&&player.inCar)cameraState.yaw=angleLerp(cameraState.yaw,player.heading+Math.PI,1-Math.exp(-2.8*dt));cameraState.distance=lerp(cameraState.distance,cameraState.targetDistance,1-Math.exp(-8*dt));const cp=Math.cos(cameraState.pitch),sp=Math.sin(cameraState.pitch),sy=Math.sin(cameraState.yaw),cy=Math.cos(cameraState.yaw),back=new THREE.Vector3(sy*cp,sp,cy*cp).multiplyScalar(cameraState.distance),right=new THREE.Vector3(cy,0,-sy).multiplyScalar(player.inCar?0:cameraState.shoulder);let desired=target.clone().add(back).add(right);if(player.flying&&player.hero.position.y>350){const over=clamp((player.hero.position.y-350)/650,0,1);desired.y+=over*140;camera.fov=lerp(camera.fov,68,1-Math.exp(-4*dt))}else camera.fov=lerp(camera.fov,player.inCar?64:(keys.ShiftLeft?66:60),1-Math.exp(-5*dt));camera.updateProjectionMatrix();if(!player.insideInterior&&sectionZero){const rayDir=desired.clone().sub(target),dist=rayDir.length();rayDir.normalize();const ray=new THREE.Raycaster(target,rayDir,.25,dist),hits=ray.intersectObjects(sectionZero.colliders.map(c=>c.mesh),false);if(hits.length)desired=target.clone().addScaledVector(rayDir,Math.max(1.8,hits[0].distance-.5))}camera.position.lerp(desired,1-Math.exp(-10*dt));camera.lookAt(target)}

function updateTime(dt){if(!game.manualTime)game.worldTime=(game.worldTime+dt/360)%1;const night=game.worldTime<.2||game.worldTime>.80;if(night!==game.night)setNight(night);const angle=game.worldTime*TAU,height=Math.sin(angle),x=Math.cos(angle);sun.position.set(player.object.position.x+x*620,Math.max(28,height*820),player.object.position.z+Math.sin(angle*.71)*560);const golden=Math.max(0,1-Math.abs(game.worldTime-.72)/.18);sun.color.setRGB(1,.82+golden*.06,.60+golden*.12);sun.intensity=game.night?.18:3.5+golden*1.8;sky.sunDisc.visible=!game.night;sky.sunDisc.position.copy(player.object.position).add(new THREE.Vector3(x*-2400,Math.max(180,height*1500),-2100));pipeline.setWarmth(game.night?0:.025+golden*.04);if(!player.flying||player.hero.position.y<350)pipeline.setExposure(game.night?.76:1.00+golden*.08)}
function setNight(value){game.night=value;stars.material.opacity=value?.92:0;sky.mat.uniforms.night.value=value?1:0;hemi.intensity=value?.45:1.55;ambient.intensity=value?.28:.18;pipeline.setBloom(value?.40:.28,value?.67:.75);for(const l of sectionZero?.localLights||[]){if(l.userData.originalIntensity===undefined)l.userData.originalIntensity=l.intensity;l.intensity=l.userData.originalIntensity*(value?1.45:.72)}farWorld.traverse(o=>{if(o.isMesh&&o.material?.emissiveMap)o.material.emissiveIntensity=value?.78:.16});scene.fog.color.set(value?0x101522:0x93a2a6);scene.fog.density=value?.00032:.00023;notice(value?"LAS VEGAS NIGHT • NEON LIVE":"GOLDEN HOUR • FULL VISIBILITY")}

function updatePrompt(){if(!game.playing)return;let text="",show=false;if(player.insideInterior){text="E : Exit Building";show=true}else if(!player.inCar){const p=sectionZero.nearestPortal(player.hero.position,7);if(p){text=`E : Enter ${p.portal.id}`;show=true}else if(player.hero.position.distanceTo(player.car.position)<8){text="E : Enter JC-777";show=true}else if(nearestLost(22)){text="CLICK : Cleanse Soul";show=true}}else{text="E : Exit JC-777";show=true}$("prompt").textContent=text;$("prompt").style.opacity=show?1:0}
function syncHUD(){const floor=xpFloor(progression.level),next=xpNext(progression.level),pct=clamp((progression.xp-floor)/Math.max(1,next-floor),0,1);$("level").textContent=progression.level;$("xp").textContent=progression.xp.toLocaleString("en-US");$("coins").textContent=progression.coins.toLocaleString("en-US");$("repFill").style.width=(pct*100).toFixed(1)+"%";$("repValue").textContent=`${(progression.xp-floor).toLocaleString("en-US")} / ${(next-floor).toLocaleString("en-US")}`;$("quality").textContent=pipeline.name.toUpperCase();$("fps").textContent=Math.round(game.fps);$("objective").textContent=game.won?"Grace District cleansed":`Cleanse the demons near Grace Chapel • ${game.saved}/${game.target}`;$("district").textContent=player.insideInterior?(interior.portal?.id||"INTERIOR"):(player.flying&&player.hero.position.y>350?"HEAVEN OVERLOOK":"GRACE DISTRICT")}

const mapCanvas=$("minimap"),mapCtx=mapCanvas.getContext("2d");let mapBase=null;function mapPoint(world){if(!sectionZero)return{x:220,y:220};const p=worldToSection(world);return{x:220+p.x*.72,y:220-p.z*.72}}
function buildMapBase(){const c=document.createElement("canvas");c.width=c.height=440;const x=c.getContext("2d");x.fillStyle="#07090d";x.fillRect(0,0,440,440);x.strokeStyle="rgba(217,174,77,.34)";x.lineWidth=24;x.beginPath();x.moveTo(220,0);x.lineTo(220,440);x.stroke();x.strokeStyle="rgba(230,230,225,.22)";x.lineWidth=1;for(let i=0;i<8;i++){x.beginPath();x.moveTo(0,55*i);x.lineTo(440,55*i);x.stroke()}x.fillStyle="#d7aa45";x.font="700 11px Georgia";x.fillText("GRACE",45,140);x.fillText("BANK",315,205);x.fillStyle="#e84232";x.fillText("TEMPTATION",290,330);mapBase=c}
function drawMap(){if(!mapBase)return;mapCtx.clearRect(0,0,440,440);mapCtx.drawImage(mapBase,0,0);for(const c of citizens){if(!c.visible)continue;const p=mapPoint(c.position);mapCtx.fillStyle=c.userData.state==="lost"?"#ff5b58":c.userData.state==="saved"?"#ffe390":"#9ca3aa";mapCtx.beginPath();mapCtx.arc(p.x,p.y,c.userData.state==="lost"?4:2.4,0,TAU);mapCtx.fill()}for(const [obj,color,r] of[[player.car,"#e5b855",4],[player.devilCar,"#ff3826",4.5],[player.object,"#fff0a6",5.5]]){if(!obj)continue;const p=mapPoint(obj.position);mapCtx.fillStyle=color;mapCtx.beginPath();mapCtx.arc(p.x,p.y,r,0,TAU);mapCtx.fill()}const p=mapPoint(localToWorld(new THREE.Vector3(72,0,-210)));mapCtx.strokeStyle="rgba(255,40,28,.85)";mapCtx.lineWidth=2;mapCtx.beginPath();mapCtx.arc(p.x,p.y,8+game.corruption*12,0,TAU);mapCtx.stroke()}
function notice(text){$("notice").textContent=text;$("notice").style.opacity=1;game.noticeTimer=2.4}
function finish(win){if(!game.playing)return;game.playing=false;game.won=win;progression.bestScore=Math.max(progression.bestScore,game.score);saveProfile();$("endTitle").textContent=win?"CITY REDEEMED":"SOULS TAKEN";$("endCopy").textContent=win?`Grace District is clean. Score ${game.score.toLocaleString("en-US")}. The production-quality district remains fully explorable on the next run.`:`The corruption breached the district. ${game.taken} souls were taken. Return to Grace Chapel and push the darkness back.`;$("end").classList.remove("hidden")}
function resetGame(){game.saved=0;game.taken=0;game.score=0;game.corruption=1;game.won=false;player.health=100;player.grace=100;player.speed=0;player.velocity.set(0,0,0);player.inCar=false;player.flying=false;player.insideInterior=false;if(interior.root)interior.root.visible=false;player.hero.visible=true;player.hero.position.copy(player.spawn);player.hero.rotation.y=roadData.anchor.a+Math.PI;player.car.position.copy(localToWorld(new THREE.Vector3(-9,0,102)));player.car.rotation.y=roadData.anchor.a;player.devilCar.position.copy(localToWorld(new THREE.Vector3(6,0,-248)));for(let i=0;i<citizens.length;i++){const c=citizens[i];c.visible=true;c.userData.taken=false;c.userData.saved=false;const side=i%2?1:-1;c.position.copy(localToWorld(new THREE.Vector3(side*(22+seeded(i+200)*7),0,120-seeded(i+300)*380)));setCitizenState(c,i<Math.min(6,citizens.length)?"lost":"normal")}player.object=player.hero;sectionZero.setCorruption(1);$("end").classList.add("hidden");game.playing=true;syncHUD();notice("MAIN MISSION • CLEANSE THE DEMONS NEAR GRACE CHAPEL")}
function startGame(){resetGame();$("menu").classList.add("hidden");$("hud").style.display="block";loadVegasLayer("strip")}
function updateFPS(dt){game.fpsAccum+=dt;game.fpsFrames++;if(game.fpsAccum>=.5){game.fps=game.fpsFrames/game.fpsAccum;game.fpsAccum=0;game.fpsFrames=0;$("fps").textContent=Math.round(game.fps);pipeline.autoTune(game.fps,dt)}if(game.devPanel)$("devPanel").textContent=JSON.stringify(JSON.parse(window.render_game_to_text()),null,2)}
function frame(ms){requestAnimationFrame(frame);const dt=Math.min(.033,clock.getDelta()),time=ms*.001;if(game.playing){game.noticeTimer-=dt;if(game.noticeTimer<=0)$("notice").style.opacity=0;game.shotCooldown=Math.max(0,game.shotCooldown-dt);game.graceCooldown=Math.max(0,game.graceCooldown-dt);player.grace=clamp(player.grace+dt*1.15,0,100);updateTime(dt);updatePlayer(dt);updateHeaven(dt);updateTraffic(dt);updateCitizens(dt);updateDevil(dt);updateProjectiles(dt);updateEffects(dt);sectionZero.update(dt,time);updateCamera(dt);updatePrompt();syncHUD();drawMap();if(stripLayer)stripLayer.visible=player.flying||player.object.position.distanceTo(new THREE.Vector3(roadData.anchor.x,0,roadData.anchor.z))<3200}updateFPS(dt);pipeline.render()}

function installControls(){addEventListener("keydown",e=>{keys[e.code]=true;if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();if(e.repeat)return;if(e.code==="KeyE")toggleVehicle();if(e.code==="KeyQ")miracleDash();if(e.code==="KeyF")toggleFlight();if(e.code==="KeyP")pray();if(e.code==="Space"&&!player.flying)graceWave();if(e.code==="KeyT"){game.manualTime=true;game.worldTime=game.night?.56:.91;setNight(!game.night)}if(e.code==="KeyM")$("minimapWrap").classList.toggle("expanded");if(e.code==="Backquote"){game.devPanel=!game.devPanel;$("devPanel").style.display=game.devPanel?"block":"none"}if(e.code==="KeyG"){player.mode=player.mode==="jc"?"satan":"jc";notice(player.mode==="jc"?"JC MODE • DIVINE LIGHT":"SATAN MODE • INFERNO ROUNDS")}});addEventListener("keyup",e=>keys[e.code]=false);const canvas=renderer.domElement;canvas.addEventListener("contextmenu",e=>e.preventDefault());canvas.addEventListener("pointerdown",e=>{if(!game.playing)return;if(e.button===0&&e.pointerType!=="touch")fireDivine();if(e.button===2||e.pointerType==="touch"){cameraState.dragging=true;cameraState.pointerId=e.pointerId;cameraState.lastX=e.clientX;cameraState.lastY=e.clientY;canvas.setPointerCapture?.(e.pointerId)}});canvas.addEventListener("pointermove",e=>{if(!cameraState.dragging||e.pointerId!==cameraState.pointerId)return;const dx=e.clientX-cameraState.lastX,dy=e.clientY-cameraState.lastY;cameraState.lastX=e.clientX;cameraState.lastY=e.clientY;cameraState.yaw-=dx*.0052;cameraState.pitch=clamp(cameraState.pitch+dy*.004,-.18,.95)});for(const ev of["pointerup","pointercancel","pointerleave"])canvas.addEventListener(ev,e=>{if(e.pointerId===cameraState.pointerId){cameraState.dragging=false;cameraState.pointerId=null}});canvas.addEventListener("wheel",e=>{cameraState.targetDistance=clamp(cameraState.targetDistance+Math.sign(e.deltaY)*.8,5.5,17)},{passive:true});$("mFire").addEventListener("pointerdown",e=>{e.preventDefault();fireDivine()});$("mInteract").addEventListener("pointerdown",e=>{e.preventDefault();toggleVehicle()});$("mGrace").addEventListener("pointerdown",e=>{e.preventDefault();graceWave()});$("mFly").addEventListener("pointerdown",e=>{e.preventDefault();toggleFlight()});installMobileStick()}
function installMobileStick(){const stick=$("stick"),nub=$("nub");let pid=null;function apply(e){const r=stick.getBoundingClientRect(),x=clamp(e.clientX-r.left,0,r.width),y=clamp(e.clientY-r.top,0,r.height),dx=x-r.width/2,dy=y-r.height/2,len=Math.hypot(dx,dy),max=r.width*.32,s=len>max?max/len:1,nx=dx*s/max,ny=dy*s/max;nub.style.transform=`translate(${dx*s}px,${dy*s}px)`;keys.KeyW=ny<-.25;keys.KeyS=ny>.25;keys.KeyA=nx<-.25;keys.KeyD=nx>.25}stick.addEventListener("pointerdown",e=>{pid=e.pointerId;stick.setPointerCapture?.(pid);apply(e)});stick.addEventListener("pointermove",e=>{if(e.pointerId===pid)apply(e)});for(const ev of["pointerup","pointercancel"])stick.addEventListener(ev,e=>{if(e.pointerId!==pid)return;pid=null;nub.style.transform="";keys.KeyW=keys.KeyS=keys.KeyA=keys.KeyD=false})}

addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();pipeline.resize(innerWidth,innerHeight)});$("start").addEventListener("click",startGame);$("restart").addEventListener("click",resetGame);
window.render_game_to_text=()=>JSON.stringify({version:"3.0.0-visual-overhaul",mode:game.playing?"playing":$("menu").classList.contains("hidden")?"loading":"menu",renderer:{engine:"Three.js WebGL",quality:pipeline.name,pixelRatio:Number(renderer.getPixelRatio().toFixed(2)),fps:Math.round(game.fps),postProcessing:true,bloom:pipeline.bloomPass.enabled,aces:true,wetRoads:true,shadowMap:quality.shadow},world:{district:"Grace District",sectionZero:true,osmRoadSegments:roadData.roads.length,farBuildings:farBuildingBoxes.length,cityLod:!!cityLayer,stripLod:!!stripLayer,time:Number(game.worldTime.toFixed(3)),night:game.night,corruption:Number(game.corruption.toFixed(2)),heavenVisible:heaven.visible},player:{inCar:player.inCar,flying:player.flying,insideInterior:player.insideInterior,health:Math.round(player.health),grace:Math.round(player.grace),x:Math.round(player.object?.position.x||0),y:Math.round(player.object?.position.y||0),z:Math.round(player.object?.position.z||0),mode:player.mode},mission:{saved:game.saved,target:game.target,taken:game.taken,limit:game.limit,score:game.score},progression:{level:progression.level,xp:progression.xp,coins:progression.coins,bestScore:progression.bestScore},controls:"WASD move/drive; mouse orbit/aim; click Divine Light; E interact; Shift sprint/brake; Q dash; F fly; Space Grace/ascend; Ctrl descend; T time; M map; P prayer"});
async function boot(){try{await loadAssets();buildRoadData();buildFarVegas();spawnWorld();buildMapBase();installControls();updateCamera(1);syncHUD();setNight(false);$("boot").classList.add("hidden");$("menu").classList.remove("hidden");(window.requestIdleCallback||((fn)=>setTimeout(fn,450)))(()=>loadVegasLayer("city"));requestAnimationFrame(frame)}catch(error){console.error(error);$("boot").innerHTML=`<div class="boot-mark"><div class="boot-logo">JC</div><div class="boot-sub">Runtime failed to initialize</div><pre style="max-width:80vw;white-space:pre-wrap;color:#ffad9f">${String(error?.stack||error)}</pre></div>`}}
boot();
