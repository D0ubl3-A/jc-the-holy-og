import * as THREE from "three";

const RUNTIME_KEY = "__JC_REAL_VEGAS_DETAIL_V1__";
const CHUNK_URL = "./jc-the-holy-og-assets/generated/real-city-chunk-data.js";
const WORLD = 11000;
const CANONICAL = {
  minE: 648949.782,
  minN: 3983561.814,
  maxE: 683949.782,
  maxN: 4018561.814,
};

if (!window[RUNTIME_KEY]) {
  const mobile = matchMedia("(pointer:coarse)").matches;
  const state = (window[RUNTIME_KEY] = {
    installed: true,
    ready: false,
    active: false,
    source: "OpenStreetMap real footprints/roads; EPSG:32611",
    geometryEvidence: "SOURCE_CONFIRMED",
    verticalEvidence: "MIXED_OSM_AND_ESTIMATED_HEIGHTS_GROUND_Z_PENDING",
    buildingCount: 0,
    roadCount: 0,
    barrierCount: 0,
    cellCount: 0,
    visibleCells: 0,
    transformMode: "pending",
    error: null,
  });

  function loadChunk() {
    if (window.JC_REAL_CITY_CHUNK) return Promise.resolve(window.JC_REAL_CITY_CHUNK);
    return new Promise((resolve, reject) => {
      let script = document.querySelector(`script[src$="generated/real-city-chunk-data.js"]`);
      if (script) {
        const timer = setInterval(() => {
          if (window.JC_REAL_CITY_CHUNK) {
            clearInterval(timer);
            resolve(window.JC_REAL_CITY_CHUNK);
          }
        }, 20);
        setTimeout(() => {
          clearInterval(timer);
          if (!window.JC_REAL_CITY_CHUNK) reject(new Error("real city chunk load timeout"));
        }, 6000);
        return;
      }
      script = document.createElement("script");
      script.src = CHUNK_URL;
      script.async = true;
      script.dataset.jcRealCityChunk = "1";
      script.onload = () => window.JC_REAL_CITY_CHUNK
        ? resolve(window.JC_REAL_CITY_CHUNK)
        : reject(new Error("real city chunk script loaded without data"));
      script.onerror = () => reject(new Error("real city chunk script failed to load"));
      document.head.appendChild(script);
    });
  }

  function mainRoadContract() {
    const data = window.JC_VEGAS_OSM || window.VEGAS_ROADS || { roads: [] };
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    let pointCount = 0;
    for (const road of data.roads || []) {
      for (const point of road.p || []) {
        const x = Number(point[0]), z = Number(point[1]);
        if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
        pointCount += 1;
      }
    }
    if (!pointCount || !Number.isFinite(minX) || maxX <= minX || maxZ <= minZ) return null;
    const span = Math.max(maxX - minX, maxZ - minZ);
    const scale = (WORLD * 0.91) / span;
    const centerX = (minX + maxX) * 0.5;
    const centerZ = (minZ + maxZ) * 0.5;
    const looksProjected = minX > 100000 && maxX < 1000000 && minZ > 1000000 && maxZ < 5000000;
    return { minX, minZ, maxX, maxZ, scale, centerX, centerZ, looksProjected };
  }

  function buildTransform(contract) {
    const widthE = CANONICAL.maxE - CANONICAL.minE;
    const heightN = CANONICAL.maxN - CANONICAL.minN;
    state.transformMode = contract.looksProjected ? "direct-utm-to-main-world" : "canonical-normalized-to-main-road-bounds";
    return (easting, northing) => {
      let sx, sz;
      if (contract.looksProjected) {
        sx = easting;
        sz = northing;
      } else {
        sx = contract.minX + ((easting - CANONICAL.minE) / widthE) * (contract.maxX - contract.minX);
        sz = contract.minZ + ((northing - CANONICAL.minN) / heightN) * (contract.maxZ - contract.minZ);
      }
      return {
        x: (sx - contract.centerX) * contract.scale,
        z: (sz - contract.centerZ) * contract.scale,
      };
    };
  }

  function makeMaterialSet() {
    const mats = [
      new THREE.MeshStandardMaterial({ color: 0xa9a59c, roughness: 0.72, metalness: 0.08 }),
      new THREE.MeshStandardMaterial({ color: 0x6f7e86, roughness: 0.46, metalness: 0.24 }),
      new THREE.MeshStandardMaterial({ color: 0xb29a75, roughness: 0.82, metalness: 0.04 }),
      new THREE.MeshStandardMaterial({ color: 0x3f4b52, roughness: 0.38, metalness: 0.32 }),
    ];
    const textureFiles = ["facade-atlas-01.jpg", "facade-atlas-02.jpg", "facade-atlas-03.jpg", "facade-atlas-04.jpg"];
    const loader = new THREE.TextureLoader();
    textureFiles.forEach((file, i) => {
      loader.load(`./jc-the-holy-og-assets/swarm/buildings/${file}`, texture => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(0.5, 0.5);
        texture.anisotropy = mobile ? 1 : 2;
        mats[i].map = texture;
        mats[i].needsUpdate = true;
      }, undefined, () => {});
    });
    return mats;
  }

  function buildingMaterialIndex(building) {
    const t = String(building.building_type || "").toLowerCase();
    if (/hotel|casino|commercial|retail/.test(t)) return 1;
    if (/industrial|warehouse/.test(t)) return 3;
    if (/apart|residential|house/.test(t)) return 2;
    return Math.abs(Number(building.osm_way_id || 0)) % 4;
  }

  function ensureCell(cells, id) {
    const key = id || "unassigned";
    if (!cells.has(key)) {
      const group = new THREE.Group();
      group.name = `REAL VEGAS CELL ${key}`;
      group.userData = { cellId: key, samples: [], realGeometry: true };
      cells.set(key, group);
    }
    return cells.get(key);
  }

  function addBuilding(group, building, toGame, origin, yScale, materials) {
    if (!Array.isArray(building.footprint) || building.footprint.length < 3) return false;
    const center = toGame(origin[0] + Number(building.position?.[0] || 0), origin[1] + Number(building.position?.[2] || 0));
    const shape = new THREE.Shape();
    let started = false;
    for (const point of building.footprint) {
      const p = toGame(origin[0] + Number(point[0]), origin[1] + Number(point[1]));
      const rx = p.x - center.x;
      const ry = -(p.z - center.z);
      if (!started) { shape.moveTo(rx, ry); started = true; }
      else shape.lineTo(rx, ry);
    }
    shape.closePath();
    const height = Math.max(1.8, Number(building.height_m || 8) * yScale);
    const minHeight = Math.max(0, Number(building.min_height_m || 0) * yScale);
    let geometry;
    try {
      geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 1, steps: 1 });
    } catch {
      return false;
    }
    geometry.rotateX(-Math.PI / 2);
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, materials[buildingMaterialIndex(building)]);
    mesh.position.set(center.x, 0.025 + minHeight, center.z);
    mesh.castShadow = !mobile && building.height_source === "osm_height_tag";
    mesh.receiveShadow = true;
    mesh.userData = {
      realVegasBuilding: true,
      osmWayId: building.osm_way_id,
      source: building.source,
      geometryEvidence: building.geometry_evidence || "verified",
      heightSource: building.height_source,
      verticalEvidence: building.terrain_elevation_evidence || "pending_runtime_ground_probe",
      climbable: building.climbable !== false,
      rooftopWalkable: building.rooftop_walkable !== false,
    };
    group.add(mesh);
    group.userData.samples.push(center);
    return true;
  }

  function addRoadsByCell(cells, roads, toGame, origin, yScale) {
    const byCell = new Map();
    for (const road of roads || []) {
      const points = road.points || [];
      for (let i = 0; i < points.length - 1; i += 1) {
        const a = toGame(origin[0] + Number(points[i][0]), origin[1] + Number(points[i][2]));
        const b = toGame(origin[0] + Number(points[i + 1][0]), origin[1] + Number(points[i + 1][2]));
        const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
        if (len < 0.25) continue;
        const seg = {
          x: (a.x + b.x) * 0.5,
          z: (a.z + b.z) * 0.5,
          len,
          angle: Math.atan2(dx, dz),
          width: Math.max(1.5, Number(road.width_m || 8) * yScale),
          evidence: road.width_source || "unknown",
        };
        const key = road.cell_id || "unassigned";
        if (!byCell.has(key)) byCell.set(key, []);
        byCell.get(key).push(seg);
      }
    }
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x23272c, roughness: 0.96, metalness: 0.03 });
    const laneMat = new THREE.MeshBasicMaterial({ color: 0xd8cfaa, transparent: true, opacity: 0.68 });
    const q = new THREE.Quaternion();
    const m = new THREE.Matrix4();
    const up = new THREE.Vector3(0, 1, 0);
    for (const [cellId, segments] of byCell) {
      const group = ensureCell(cells, cellId);
      const mesh = new THREE.InstancedMesh(geo, mat, segments.length);
      mesh.receiveShadow = true;
      let evidenceLaneCount = 0;
      for (let i = 0; i < segments.length; i += 1) {
        const s = segments[i];
        q.setFromAxisAngle(up, s.angle);
        m.compose(new THREE.Vector3(s.x, 0.01, s.z), q, new THREE.Vector3(s.width, 0.08, s.len + 0.2));
        mesh.setMatrixAt(i, m);
        if (/lane/i.test(s.evidence)) evidenceLaneCount += 1;
        group.userData.samples.push({ x: s.x, z: s.z });
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.userData = { sourceGroundedRoads: true, widthEvidenceSegments: evidenceLaneCount };
      group.add(mesh);
      const marked = segments.filter((s, i) => /lane/i.test(s.evidence) && i % 2 === 0);
      if (marked.length) {
        const lines = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 0.025, 1), laneMat, marked.length);
        for (let i = 0; i < marked.length; i += 1) {
          const s = marked[i];
          q.setFromAxisAngle(up, s.angle);
          m.compose(new THREE.Vector3(s.x, 0.07, s.z), q, new THREE.Vector3(1, 1, s.len * 0.62));
          lines.setMatrixAt(i, m);
        }
        lines.instanceMatrix.needsUpdate = true;
        group.add(lines);
      }
    }
  }

  function addBarriersByCell(cells, barriers, toGame, origin, yScale) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x7a746a, roughness: 0.92, metalness: 0.08 });
    for (const barrier of barriers || []) {
      const points = barrier.points || [];
      const group = ensureCell(cells, barrier.cell_id || "unassigned");
      for (let i = 0; i < points.length - 1; i += 1) {
        const a = toGame(origin[0] + Number(points[i][0]), origin[1] + Number(points[i][2]));
        const b = toGame(origin[0] + Number(points[i + 1][0]), origin[1] + Number(points[i + 1][2]));
        const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
        if (len < 0.15) continue;
        const h = Math.max(0.35, Number(barrier.height_m || 1.2) * yScale);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, h, len), mat);
        mesh.position.set((a.x + b.x) * 0.5, h * 0.5, (a.z + b.z) * 0.5);
        mesh.rotation.y = Math.atan2(dx, dz);
        mesh.userData = { realBarrier: true, source: barrier.source, climbable: barrier.climbable !== false };
        group.add(mesh);
      }
    }
  }

  function finalizeCellCenters(cells) {
    for (const group of cells.values()) {
      const samples = group.userData.samples || [];
      if (!samples.length) { group.userData.center = { x: 0, z: 0 }; continue; }
      let x = 0, z = 0;
      for (const p of samples) { x += p.x; z += p.z; }
      group.userData.center = { x: x / samples.length, z: z / samples.length };
      delete group.userData.samples;
    }
  }

  function build(scene, chunk) {
    if (state.ready || !scene?.isScene) return;
    const contract = mainRoadContract();
    if (!contract) return;
    const toGame = buildTransform(contract);
    const origin = chunk.world_origin_projected || [667304.010678067, 4004396.773228888];
    const yScale = Math.max(0.24, Math.min(0.42, contract.scale));
    const root = new THREE.Group();
    root.name = "REAL DOWNTOWN LAS VEGAS DETAIL V1";
    root.userData = {
      realVegasDetail: true,
      source: "OpenStreetMap source-grounded geometry",
      crs: chunk.crs || "EPSG:32611",
      axisContract: chunk.axis_contract,
      geometryEvidence: "verified",
      heightEvidence: "mixed verified/derived/estimated",
      terrainZ: "runtime-ground-probe-pending",
    };
    const cells = new Map();
    const materials = makeMaterialSet();
    let builtBuildings = 0;
    for (const building of chunk.buildings || []) {
      const group = ensureCell(cells, building.cell_id || "unassigned");
      if (addBuilding(group, building, toGame, origin, yScale, materials)) builtBuildings += 1;
    }
    addRoadsByCell(cells, chunk.roads || [], toGame, origin, yScale);
    addBarriersByCell(cells, chunk.barriers || [], toGame, origin, yScale);
    finalizeCellCenters(cells);
    for (const group of cells.values()) root.add(group);
    scene.add(root);
    state.root = root;
    state.cells = cells;
    state.scene = scene;
    state.ready = true;
    state.buildingCount = builtBuildings;
    state.roadCount = (chunk.roads || []).length;
    state.barrierCount = (chunk.barriers || []).length;
    state.cellCount = cells.size;
    state.yScale = yScale;
    state.contract = { scale: contract.scale, looksProjected: contract.looksProjected };
    window.JC_REAL_VEGAS_DETAIL_STATUS = state;
  }

  let frameCounter = 0;
  function update(scene, camera) {
    if (!state.ready || !state.cells || !camera) return;
    frameCounter += 1;
    if (frameCounter % (mobile ? 12 : 8) !== 0) return;
    const ranked = [];
    for (const group of state.cells.values()) {
      const c = group.userData.center || { x: 0, z: 0 };
      ranked.push({ group, d2: (camera.position.x - c.x) ** 2 + (camera.position.z - c.z) ** 2 });
    }
    ranked.sort((a, b) => a.d2 - b.d2);
    const maxCells = mobile ? 5 : 12;
    const maxDistance = mobile ? 620 : 1050;
    let visible = 0;
    for (let i = 0; i < ranked.length; i += 1) {
      const on = i < maxCells && ranked[i].d2 <= maxDistance * maxDistance;
      ranked[i].group.visible = on;
      if (on) visible += 1;
    }
    state.visibleCells = visible;
    state.active = visible > 0;
    const fallback = scene.getObjectByName("Generated city fallback");
    if (fallback) fallback.visible = !state.active;
    const stream = document.getElementById("streamStatus");
    if (stream && state.active) {
      stream.innerHTML = `REAL DOWNTOWN: ${visible}/${state.cellCount} CELLS<br>${state.buildingCount} REAL FOOTPRINTS • ${state.roadCount} OSM ROADS`;
    }
  }

  loadChunk().then(chunk => {
    state.chunkLoaded = true;
    const previousRender = THREE.WebGLRenderer.prototype.render;
    if (!THREE.WebGLRenderer.prototype.__jcRealVegasDetailV1) {
      Object.defineProperty(THREE.WebGLRenderer.prototype, "__jcRealVegasDetailV1", { value: true });
      THREE.WebGLRenderer.prototype.render = function renderWithRealVegasDetail(scene, camera) {
        if (!state.ready) build(scene, chunk);
        if (state.ready) update(scene, camera);
        return previousRender.call(this, scene, camera);
      };
    }
  }).catch(error => {
    state.error = String(error?.message || error);
    window.JC_REAL_VEGAS_DETAIL_STATUS = state;
  });
}
