import * as THREE from "three";
import { makeSignTexture, seeded } from "./materials-v3.js";

function shadow(mesh, cast = true, receive = true) { mesh.castShadow = cast; mesh.receiveShadow = receive; return mesh; }
function box(w, h, d, mat, x = 0, y = 0, z = 0) { const m = shadow(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)); m.position.set(x, y, z); return m; }
function cyl(rt, rb, h, seg, mat, x = 0, y = 0, z = 0) { const m = shadow(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat)); m.position.set(x, y, z); return m; }
function plane(w, h, mat, x = 0, y = 0, z = 0, ry = 0) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; return m; }
function addCollider(list, mesh, tag = "solid") { mesh.userData.collider = tag; list.push(mesh); return mesh; }

function signPlane(text, subtitle, width, height, accent = "#d7aa45") {
  const texture = makeSignTexture(text, { subtitle, accent });
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.renderOrder = 6;
  return mesh;
}

function createCross(material, scale = 1) {
  const g = new THREE.Group();
  const v = box(.42 * scale, 4.8 * scale, .35 * scale, material, 0, 0, 0);
  const h = box(2.8 * scale, .42 * scale, .35 * scale, material, 0, .85 * scale, 0);
  g.add(v, h); return g;
}

function buildGraceChapel(parent, materials, colliders, portals, localLights) {
  const g = new THREE.Group(); g.name = "Grace Chapel"; g.position.set(-58, 0, 36); g.rotation.y = .035; parent.add(g);
  const stone = materials.stone, dark = materials.darkStone, gold = materials.polishedGold;
  addCollider(colliders, box(44, 16, 28, stone, 0, 8, 0));
  g.add(colliders[colliders.length - 1]);
  const naveRoof = new THREE.Mesh(new THREE.ConeGeometry(18.2, 10, 4), dark); naveRoof.position.set(0, 19.2, 0); naveRoof.rotation.y = Math.PI / 4; shadow(naveRoof); g.add(naveRoof);
  const tower = addCollider(colliders, box(12, 26, 12, stone, 0, 13, -9)); g.add(tower);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(6.5, 14, 4), dark); spire.position.set(0, 33, -9); spire.rotation.y = Math.PI / 4; shadow(spire); g.add(spire);
  const cross = createCross(gold, 1.12); cross.position.set(0, 43, -9); g.add(cross);
  const crossLight = new THREE.PointLight(0xffd56b, 58, 72, 1.8); crossLight.position.set(0, 42, -6); g.add(crossLight); localLights.push(crossLight);
  const door = box(6.4, 9.2, .55, materials.warmGlass, 0, 4.6, 14.25); g.add(door);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(3.35, .55, 10, 32, Math.PI), gold); arch.position.set(0, 9.2, 14.18); arch.rotation.z = Math.PI; g.add(arch);
  for (const x of [-13, -6.5, 6.5, 13]) {
    const window = plane(4.2, 8.2, new THREE.MeshBasicMaterial({ color: 0xffd980, transparent: true, opacity: .82, toneMapped: false }), x, 8.2, 14.22, 0); g.add(window);
    const light = new THREE.PointLight(0xffb957, 13, 24, 2); light.position.set(x, 7.5, 15.5); g.add(light); localLights.push(light);
  }
  for (let i = 0; i < 7; i++) { const step = box(17 + i * 1.6, .42, 2.0, materials.stone, 0, .21 + i * .03, 17.2 + i * 1.85); g.add(step); }
  const sign = signPlane("GRACE CHAPEL", "ALL WELCOME", 22, 7.2, "#d8a844"); sign.position.set(-18, 8, 18); sign.rotation.y = .15; g.add(sign);
  portals.push({ id: "GRACE CHAPEL", type: "chapel", object: door, localPosition: new THREE.Vector3(0, 0, 17), parent: g });
  return g;
}

function buildHeavenlyBank(parent, materials, colliders, portals, localLights) {
  const g = new THREE.Group(); g.name = "Heavenly Bank"; g.position.set(63, 0, -38); g.rotation.y = -.025; parent.add(g);
  const base = addCollider(colliders, box(54, 15, 30, materials.stone, 0, 7.5, 0)); g.add(base);
  const roof = box(58, 2.3, 34, materials.darkStone, 0, 16.1, 0); g.add(roof);
  const pediment = new THREE.Mesh(new THREE.ConeGeometry(18, 9, 3), materials.stone); pediment.position.set(0, 21.4, 15.5); pediment.rotation.z = Math.PI / 2; pediment.rotation.y = -Math.PI / 2; shadow(pediment); g.add(pediment);
  for (let x = -21; x <= 21; x += 7) { const c = cyl(1.15, 1.4, 13, 16, materials.stone, x, 7.2, 16.2); g.add(c); }
  const door = box(6, 8.2, .5, materials.warmGlass, 0, 4.1, 16.4); g.add(door);
  const sign = signPlane("HEAVENLY BANK", "FAITH • CREDIT • REDEMPTION", 31, 7.5, "#e0b75e"); sign.position.set(0, 20, 17.2); g.add(sign);
  const light = new THREE.PointLight(0xffd780, 45, 58, 2); light.position.set(0, 12, 19); g.add(light); localLights.push(light);
  portals.push({ id: "HEAVENLY BANK", type: "bank", object: door, localPosition: new THREE.Vector3(0, 0, 19), parent: g });
  return g;
}

function buildTemptation(parent, materials, colliders, portals, localLights, corruptionParts) {
  const g = new THREE.Group(); g.name = "Temptation Nightclub"; g.position.set(66, 0, -150); parent.add(g);
  const shellMat = new THREE.MeshPhysicalMaterial({ color: 0x10090a, roughness: .34, metalness: .55, clearcoat: .55, clearcoatRoughness: .18, envMapIntensity: 1.2 });
  const shell = addCollider(colliders, box(55, 22, 34, shellMat, 0, 11, 0)); g.add(shell);
  const facade = box(50, 14, .65, new THREE.MeshStandardMaterial({ color: 0x120405, emissive: 0x6f0808, emissiveIntensity: 1.4, roughness: .42 }), 0, 10, 17.2); g.add(facade); corruptionParts.emissive.push(facade.material);
  const door = box(7, 9, .55, new THREE.MeshStandardMaterial({ color: 0x160305, emissive: 0xb00c08, emissiveIntensity: 2.2, metalness: .45, roughness: .25 }), 0, 4.5, 17.55); g.add(door); corruptionParts.emissive.push(door.material);
  const sign = signPlane("TEMPTATION", "NIGHTCLUB", 33, 8.8, "#ff2f24"); sign.position.set(0, 22, 18.2); g.add(sign);
  for (const x of [-18, -9, 9, 18]) { const red = new THREE.PointLight(0xff1d16, 22, 33, 2); red.position.set(x, 8, 21); g.add(red); localLights.push(red); corruptionParts.lights.push(red); }
  portals.push({ id: "TEMPTATION", type: "club", object: door, localPosition: new THREE.Vector3(0, 0, 20), parent: g });
  return g;
}

function buildLuxuryResort(parent, materials, colliders, localLights) {
  const g = new THREE.Group(); g.name = "JC Redemption Resort"; g.position.set(10, 0, -92); parent.add(g);
  const facade = new THREE.MeshPhysicalMaterial({ color: 0x2a3135, roughness: .22, metalness: .5, clearcoat: .42, clearcoatRoughness: .2, envMapIntensity: 1.3 });
  const glass = materials.glass;
  for (let i = -3; i <= 3; i++) {
    const h = 61 - Math.abs(i) * 4;
    const tower = addCollider(colliders, box(12.8, h, 24, i % 2 ? glass : facade, i * 11.4, h / 2, Math.abs(i) * 1.8)); g.add(tower);
    for (let y = 8; y < h - 3; y += 6.2) { const ledge = box(13.5, .45, 25.2, materials.gold, i * 11.4, y, Math.abs(i) * 1.8); g.add(ledge); }
  }
  const crown = signPlane("JC", "REPENT • REDEEM • REIGN", 20, 10, "#e6bd63"); crown.position.set(0, 53, 14.5); g.add(crown);
  const warm = new THREE.PointLight(0xffc56e, 34, 60, 2); warm.position.set(0, 14, 18); g.add(warm); localLights.push(warm);
  return g;
}

function buildFountain(parent, materials, localLights, animated) {
  const g = new THREE.Group(); g.name = "Redemption Fountain"; g.position.set(24, 0, -18); parent.add(g);
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(13, 14.2, 1.2, 48), materials.stone); basin.position.y = .6; shadow(basin); g.add(basin);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(12.1, 12.1, .22, 48), materials.water); water.position.y = 1.18; g.add(water); animated.water.push(water);
  const center = cyl(2.2, 2.8, 2.4, 24, materials.gold, 0, 1.8, 0); g.add(center);
  const jets = [];
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, r = 8.5;
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(.06, .12, 4 + (i % 3), 6), new THREE.MeshBasicMaterial({ color: 0xd9f5ff, transparent: true, opacity: .72 }));
    jet.position.set(Math.cos(a) * r, 3.1, Math.sin(a) * r); jet.rotation.z = Math.cos(a) * .18; jet.rotation.x = Math.sin(a) * .18; g.add(jet); jets.push(jet);
  }
  animated.jets.push(...jets);
  const glow = new THREE.PointLight(0x9ddfff, 20, 35, 2); glow.position.y = 3; g.add(glow); localLights.push(glow);
  return g;
}

function buildPalm(parent, materials, x, z, scale = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(scale); parent.add(g);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.38, .64, 8.5, 9), new THREE.MeshStandardMaterial({ color: 0x69513a, roughness: .95 })); trunk.position.y = 4.25; shadow(trunk); g.add(trunk);
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.quadraticCurveTo(2.3, .7, 5.4, 0); shape.quadraticCurveTo(2.7, -.7, 0, 0);
    const leaf = new THREE.Mesh(new THREE.ShapeGeometry(shape, 8), materials.foliage); leaf.rotation.x = -Math.PI / 2 + .22; leaf.rotation.z = a; leaf.position.y = 8.5; leaf.castShadow = true; g.add(leaf);
  }
  return g;
}

function buildStreetLight(parent, materials, localLights, x, z, side = 1, active = true) {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  const pole = cyl(.16, .22, 7.8, 8, materials.blackMetal, 0, 3.9, 0); g.add(pole);
  const arm = box(2.2, .16, .16, materials.blackMetal, side * .9, 7.65, 0); g.add(arm);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffdc88, toneMapped: false });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.28, 10, 8), bulbMat); bulb.position.set(side * 1.9, 7.45, 0); g.add(bulb);
  if (active) { const light = new THREE.PointLight(0xffd989, 8, 24, 2); light.position.copy(bulb.position); g.add(light); localLights.push(light); }
  return g;
}

function buildCorruption(parent, materials, localLights, corruptionParts) {
  const root = new THREE.Group(); root.name = "Demonic Corruption"; root.position.set(72, 0, -210); parent.add(root); corruptionParts.root = root;
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(6.5, 2), materials.redCorruption); core.position.y = 13; core.scale.set(.7, 2.2, .7); shadow(core); root.add(core); corruptionParts.core = core; corruptionParts.emissive.push(materials.redCorruption);
  const hornMat = new THREE.MeshStandardMaterial({ color: 0x0d0505, roughness: .82, emissive: 0x350000, emissiveIntensity: .7 });
  for (const side of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(1.4, 10, 9), hornMat); horn.position.set(side * 4.3, 24, 0); horn.rotation.z = side * -.42; root.add(horn);
  }
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2 + seeded(i + 4) * .24;
    const len = 15 + seeded(i + 40) * 30;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 8 + seeded(i) * 9, 0),
      new THREE.Vector3(Math.cos(a) * len * .3, 7 + seeded(i + 10) * 13, Math.sin(a) * len * .3),
      new THREE.Vector3(Math.cos(a) * len * .72, 2 + seeded(i + 20) * 11, Math.sin(a) * len * .72),
      new THREE.Vector3(Math.cos(a) * len, .3, Math.sin(a) * len),
    ]);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, .32 + seeded(i + 80) * .42, 6, false), materials.redCorruption); mesh.userData.phase = seeded(i + 90) * Math.PI * 2; shadow(mesh); root.add(mesh); corruptionParts.tendrils.push(mesh);
  }
  const glow = new THREE.PointLight(0xff160d, 120, 120, 1.6); glow.position.set(0, 14, 0); root.add(glow); localLights.push(glow); corruptionParts.lights.push(glow);
  const ashGeo = new THREE.BufferGeometry(); const points = [];
  for (let i = 0; i < 260; i++) { const a = seeded(i + 200) * Math.PI * 2, r = seeded(i + 400) * 38; points.push(Math.cos(a) * r, 2 + seeded(i + 600) * 35, Math.sin(a) * r); }
  ashGeo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  const ash = new THREE.Points(ashGeo, new THREE.PointsMaterial({ color: 0xff3a20, size: .34, transparent: true, opacity: .75, depthWrite: false, blending: THREE.AdditiveBlending })); root.add(ash); corruptionParts.ash = ash;
  const sign = signPlane("SIN CITY", "SURRENDER SOULS", 34, 9, "#ff2f24"); sign.position.set(23, 25, -3); sign.rotation.y = -.4; root.add(sign);
  return root;
}

function buildBoulevard(root, materials) {
  const road = box(34, .18, 520, materials.asphalt, 0, .02, -82); road.receiveShadow = true; root.add(road);
  for (const x of [-8.3, 8.3]) { const stripe = box(.32, .035, 500, materials.lane, x, .14, -82); stripe.receiveShadow = true; root.add(stripe); }
  const center = box(.6, .06, 510, materials.whiteLane, 0, .16, -82); root.add(center);
  for (const side of [-1, 1]) {
    const walk = box(12, .34, 520, materials.sidewalk, side * 23, .13, -82); walk.receiveShadow = true; root.add(walk);
    const curb = box(1.2, .46, 520, materials.stone, side * 17.5, .23, -82); root.add(curb);
  }
  for (let z = 145; z >= -300; z -= 45) for (let i = -4; i <= 4; i++) { const stripe = box(1.8, .03, 8, materials.whiteLane, i * 2.4, .19, z); root.add(stripe); }
}

export function buildSectionZero({ scene, materials, anchor = new THREE.Vector3(), angle = 0, quality = "high" }) {
  const root = new THREE.Group(); root.name = "SECTION ZERO — GRACE DISTRICT"; root.position.copy(anchor); root.rotation.y = angle; scene.add(root);
  const colliders = [], portals = [], localLights = [], animated = { water: [], jets: [] };
  const corruptionParts = { root: null, core: null, tendrils: [], lights: [], emissive: [], ash: null };

  buildBoulevard(root, materials);
  buildGraceChapel(root, materials, colliders, portals, localLights);
  buildHeavenlyBank(root, materials, colliders, portals, localLights);
  buildTemptation(root, materials, colliders, portals, localLights, corruptionParts);
  buildLuxuryResort(root, materials, colliders, localLights);
  buildFountain(root, materials, localLights, animated);
  buildCorruption(root, materials, localLights, corruptionParts);

  const palmCount = quality === "mobile" ? 14 : quality === "medium" ? 20 : 28;
  for (let i = 0; i < palmCount; i++) {
    const z = 130 - i * (430 / Math.max(1, palmCount - 1)) + (seeded(i + 9) - .5) * 12;
    const side = i % 2 ? 1 : -1;
    buildPalm(root, materials, side * (32 + seeded(i + 40) * 7), z, .72 + seeded(i + 60) * .38);
  }
  const lampStep = quality === "mobile" ? 62 : 42;
  for (let z = 145, i = 0; z >= -300; z -= lampStep, i++) for (const side of [-1, 1]) buildStreetLight(root, materials, localLights, side * 29.5, z, -side, i % 2 === 0 || quality !== "mobile");

  for (let i = 0; i < 22; i++) {
    const side = i % 2 ? 1 : -1, z = 110 - i * 18;
    const planter = box(4.4, .9, 2.5, materials.darkStone, side * 31.5, .45, z); root.add(planter);
    const shrub = new THREE.Mesh(new THREE.SphereGeometry(1.35, 10, 7), materials.foliage); shrub.scale.set(1.5, .8, .9); shrub.position.set(side * 31.5, 1.55, z); shrub.castShadow = true; root.add(shrub);
  }

  root.updateMatrixWorld(true);
  for (const p of portals) { p.worldPosition = p.localPosition.clone(); p.parent.localToWorld(p.worldPosition); }
  const worldColliders = colliders.map((mesh) => { mesh.updateWorldMatrix(true, false); return { mesh, box: new THREE.Box3().setFromObject(mesh), tag: mesh.userData.collider || "solid" }; });

  let corruption = 1;
  function setCorruption(value) {
    corruption = THREE.MathUtils.clamp(value, 0, 1);
    const ease = corruption * corruption * (3 - 2 * corruption);
    if (corruptionParts.root) corruptionParts.root.visible = corruption > .015;
    for (const t of corruptionParts.tendrils) t.scale.setScalar(.2 + ease * .8);
    for (const l of corruptionParts.lights) l.intensity = l.userData.baseIntensity ? l.userData.baseIntensity * ease : 22 + 98 * ease;
    for (const m of corruptionParts.emissive) if ("emissiveIntensity" in m) m.emissiveIntensity = .2 + ease * 2.1;
    if (corruptionParts.ash) corruptionParts.ash.material.opacity = .08 + ease * .72;
  }
  for (const l of corruptionParts.lights) l.userData.baseIntensity = l.intensity;
  setCorruption(1);

  function update(dt, time) {
    const pulse = .84 + Math.sin(time * 3.2) * .16;
    if (corruptionParts.core) { corruptionParts.core.rotation.y += dt * .35; corruptionParts.core.scale.y = (2.1 + pulse * .18) * (.35 + corruption * .65); }
    corruptionParts.tendrils.forEach((t, i) => { t.rotation.y = Math.sin(time * .55 + t.userData.phase) * .07; t.rotation.z = Math.cos(time * .43 + i) * .025; });
    if (corruptionParts.ash) { corruptionParts.ash.rotation.y += dt * .08; corruptionParts.ash.position.y = Math.sin(time * .4) * 1.2; }
    animated.jets.forEach((j, i) => { j.scale.y = .72 + Math.sin(time * 2.2 + i * .7) * .22; j.material.opacity = .5 + Math.sin(time * 1.8 + i) * .15; });
    animated.water.forEach((w) => { w.rotation.y += dt * .018; });
  }

  function collisionAt(position, radius = 1.0) {
    const probe = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(position.x, 2.2, position.z), new THREE.Vector3(radius * 2, 4.4, radius * 2));
    for (const c of worldColliders) if (probe.intersectsBox(c.box)) return c;
    return null;
  }

  function nearestPortal(position, maxDistance = 7) {
    let best = null, bestD = maxDistance;
    for (const p of portals) { const d = position.distanceTo(p.worldPosition); if (d < bestD) { bestD = d; best = p; } }
    return best ? { portal: best, distance: bestD } : null;
  }

  return { root, colliders: worldColliders, portals, localLights, corruptionParts, setCorruption, get corruption() { return corruption; }, update, collisionAt, nearestPortal };
}
