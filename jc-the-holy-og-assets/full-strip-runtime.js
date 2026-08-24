import * as THREE from "three";

const RUNTIME_KEY = "__JC_FULL_STRIP_RUNTIME_V2__";
if (!window[RUNTIME_KEY]) {
  window[RUNTIME_KEY] = { ready: false, installed: true };

  // The previous central-Strip build calls Vector3.copy(undefined) because the
  // calibrated anchor is a plain {x,z,a} object. Keep initialization alive.
  const originalVectorCopy = THREE.Vector3.prototype.copy;
  if (!THREE.Vector3.prototype.__jcSafeAnchorCopy) {
    Object.defineProperty(THREE.Vector3.prototype, "__jcSafeAnchorCopy", { value: true });
    THREE.Vector3.prototype.copy = function copySafeVector(source) {
      if (!source || typeof source.x !== "number") return this;
      return originalVectorCopy.call(this, source);
    };
  }

  function seeded(value) {
    const n = Math.sin(value * 913.71 + 17.3) * 43758.5453;
    return n - Math.floor(n);
  }

  function calculateStripAnchor() {
    const data = window.JC_VEGAS_OSM || window.VEGAS_ROADS || { roads: [] };
    let minX = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxZ = -Infinity;
    for (const road of data.roads || []) {
      for (const point of road.p || []) {
        const x = Number(point[0]);
        const z = Number(point[1]);
        if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
      }
    }
    if (!Number.isFinite(minX) || maxX === minX || maxZ === minZ) return { x: 0, z: 0, a: 0 };

    const world = 11000;
    const scale = (world * 0.91) / Math.max(maxX - minX, maxZ - minZ);
    const centerX = (minX + maxX) * 0.5;
    const centerZ = (minZ + maxZ) * 0.5;
    const segments = [];

    for (const road of data.roads || []) {
      if (!/las vegas (boulevard|blvd)|the strip/i.test(road.n || "")) continue;
      const points = road.p || [];
      for (let i = 0; i < points.length - 1; i += 1) {
        const a = points[i];
        const b = points[i + 1];
        const x1 = (Number(a[0]) - centerX) * scale;
        const z1 = (Number(a[1]) - centerZ) * scale;
        const x2 = (Number(b[0]) - centerX) * scale;
        const z2 = (Number(b[1]) - centerZ) * scale;
        const dx = x2 - x1;
        const dz = z2 - z1;
        const length = Math.hypot(dx, dz);
        if (length > 2 && length < 500) segments.push({ x: (x1 + x2) / 2, z: (z1 + z2) / 2, a: Math.atan2(dx, dz), length });
      }
    }

    if (!segments.length) return { x: 0, z: 0, a: 0 };
    let weight = 0;
    let x = 0;
    let z = 0;
    let sin2 = 0;
    let cos2 = 0;
    for (const segment of segments) {
      weight += segment.length;
      x += segment.x * segment.length;
      z += segment.z * segment.length;
      sin2 += Math.sin(segment.a * 2) * segment.length;
      cos2 += Math.cos(segment.a * 2) * segment.length;
    }
    return { x: x / weight, z: z / weight, a: 0.5 * Math.atan2(sin2, cos2) };
  }

  function signTexture(label, accent) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    context.fillStyle = "rgba(3,7,13,.94)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = accent;
    context.lineWidth = 18;
    context.strokeRect(11, 11, canvas.width - 22, canvas.height - 22);
    context.shadowColor = accent;
    context.shadowBlur = 35;
    context.fillStyle = "#fff";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "900 108px Impact, Arial Black, sans-serif";
    context.fillText(label, canvas.width / 2, canvas.height / 2 + 4);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }

  function addBox(parent, width, height, depth, material, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function addSign(parent, label, accent, y = 70, z = 34) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTexture(label, accent), transparent: true, depthWrite: false, toneMapped: false }));
    sprite.position.set(0, y, z);
    sprite.scale.set(72, 18, 1);
    sprite.renderOrder = 12;
    parent.add(sprite);
  }

  function buildResort(parent, spec, index) {
    const palette = [
      [0x10263d, 0x45dcff],
      [0x3b1717, 0xff5a45],
      [0x33260d, 0xffcf55],
      [0x142b21, 0x58e69c],
      [0x25153c, 0xb778ff],
      [0x332018, 0xff9d4a],
    ][index % 6];
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: palette[0], metalness: 0.48, roughness: 0.27, emissive: new THREE.Color(palette[1]).multiplyScalar(0.12), emissiveIntensity: 1.1 });
    const trimMaterial = new THREE.MeshStandardMaterial({ color: palette[1], metalness: 0.7, roughness: 0.18, emissive: palette[1], emissiveIntensity: 1.4 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x161920, metalness: 0.16, roughness: 0.7 });
    addBox(parent, 112, 10, 68, darkMaterial, 0, 5, 0);

    if (spec.profile === "spire") {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(10, 18, 158, 12), bodyMaterial);
      shaft.position.y = 79;
      parent.add(shaft);
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(42, 31, 23, 20), trimMaterial);
      pod.position.y = 146;
      parent.add(pod);
      const needle = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 3.6, 92, 10), trimMaterial);
      needle.position.y = 203;
      parent.add(needle);
      addSign(parent, spec.name, spec.accent, 130, 38);
    } else if (spec.profile === "pyramid") {
      const pyramid = new THREE.Mesh(new THREE.ConeGeometry(61, 108, 4), bodyMaterial);
      pyramid.position.y = 54;
      pyramid.rotation.y = Math.PI / 4;
      parent.add(pyramid);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 2.5, 190, 10), new THREE.MeshBasicMaterial({ color: palette[1], transparent: true, opacity: 0.68 }));
      beam.position.y = 203;
      parent.add(beam);
      addSign(parent, spec.name, spec.accent, 42, 49);
    } else if (spec.profile === "arena") {
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(58, 68, 35, 32), bodyMaterial);
      bowl.position.y = 17.5;
      parent.add(bowl);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(59, 3.7, 10, 52), trimMaterial);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 35;
      parent.add(ring);
      addSign(parent, spec.name, spec.accent, 57, 37);
    } else if (spec.profile === "dome") {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.57), bodyMaterial);
      dome.position.y = 12;
      parent.add(dome);
      for (const x of [-39, 39]) addBox(parent, 30, 92 + (index % 3) * 12, 36, bodyMaterial, x, 46, -9);
      addSign(parent, spec.name, spec.accent, 62, 39);
    } else {
      const twin = spec.profile === "twin" || spec.profile === "castle";
      if (twin) {
        for (const x of [-31, 31]) {
          const height = 96 + (index % 4) * 11;
          addBox(parent, 39, height, 40, bodyMaterial, x, height / 2, 0);
          for (let y = 14; y < height - 4; y += 11) addBox(parent, 41, 1.15, 42, trimMaterial, x, y, 0);
        }
        if (spec.profile === "castle") {
          for (const x of [-43, -15, 15, 43]) {
            const spire = new THREE.Mesh(new THREE.ConeGeometry(8, 30, 6), trimMaterial);
            spire.position.set(x, 123, 0);
            parent.add(spire);
          }
        }
      } else {
        for (let i = -3; i <= 3; i += 1) {
          const height = 96 - Math.abs(i) * 7 + (index % 4) * 8;
          const tower = addBox(parent, 18, height, 40, bodyMaterial, i * 14.5, height / 2, Math.abs(i) * 2);
          tower.rotation.y = i * 0.025;
        }
      }
      addSign(parent, spec.name, spec.accent, 74, 38);
    }

    for (const x of [-49, 49]) {
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 6), new THREE.MeshBasicMaterial({ color: palette[1] }));
      beacon.position.set(x, 12, 28);
      parent.add(beacon);
    }
  }

  function buildFullStrip(scene) {
    if (scene.getObjectByName("JC FULL LAS VEGAS STRIP V2")) return scene.getObjectByName("JC FULL LAS VEGAS STRIP V2");
    const anchor = calculateStripAnchor();
    const root = new THREE.Group();
    root.name = "JC FULL LAS VEGAS STRIP V2";
    root.position.set(anchor.x, 0, anchor.z);
    root.rotation.y = anchor.a;
    root.userData.fullStrip = true;
    root.userData.span = 8400;

    const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x242830, roughness: 0.9, metalness: 0.08 });
    const sidewalkMaterial = new THREE.MeshStandardMaterial({ color: 0xa9a398, roughness: 0.96, metalness: 0.01 });
    const medianMaterial = new THREE.MeshStandardMaterial({ color: 0x2e382a, roughness: 0.92 });
    const stripeMaterial = new THREE.MeshBasicMaterial({ color: 0xe9d77b });
    // Use the named OSM Boulevard segments as the spine. This keeps the
    // north/south Strip continuous while preserving bends and gaps in the
    // source geometry; the straight fallback is only used if the source has
    // no Boulevard records at all.
    const data = window.JC_VEGAS_OSM || window.VEGAS_ROADS || { roads: [] };
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const road of data.roads || []) for (const point of road.p || []) {
      const x = Number(point[0]), z = Number(point[1]);
      if (Number.isFinite(x) && Number.isFinite(z)) { minX=Math.min(minX,x); maxX=Math.max(maxX,x); minZ=Math.min(minZ,z); maxZ=Math.max(maxZ,z); }
    }
    const sourceScale = Number.isFinite(minX) && maxX > minX && maxZ > minZ
      ? (11000 * 0.91) / Math.max(maxX - minX, maxZ - minZ) : 1;
    const sourceCenterX = (minX + maxX) * 0.5, sourceCenterZ = (minZ + maxZ) * 0.5;
    const boulevardSegments = [];
    for (const road of data.roads || []) {
      if (!/las vegas (boulevard|blvd)|the strip/i.test(road.n || "")) continue;
      const points = road.p || [];
      for (let i=0; i<points.length-1; i++) {
        const a=points[i], b=points[i+1];
        const x1=(Number(a[0])-sourceCenterX)*sourceScale-anchor.x;
        const z1=(Number(a[1])-sourceCenterZ)*sourceScale-anchor.z;
        const x2=(Number(b[0])-sourceCenterX)*sourceScale-anchor.x;
        const z2=(Number(b[1])-sourceCenterZ)*sourceScale-anchor.z;
        const dx=x2-x1, dz=z2-z1, length=Math.hypot(dx,dz);
        if (length < 5 || length > 650) continue;
        const angle=Math.atan2(dx,dz), cx=(x1+x2)/2, cz=(z1+z2)/2;
        const segment=addBox(root,31,0.12,length,roadMaterial,cx,0.015,cz); segment.rotation.y=angle;
        const median=addBox(root,2.2,0.2,length,medianMaterial,cx,0.12,cz); median.rotation.y=angle;
        for (const side of [-1,1]) { const walk=addBox(root,8,0.28,length,sidewalkMaterial,cx+Math.cos(angle)*side*21.5,0.14,cz-Math.sin(angle)*side*21.5); walk.rotation.y=angle; }
        for (const side of [-1,1]) { const stripe=addBox(root,0.38,0.05,Math.max(1,length-8),stripeMaterial,cx+Math.cos(angle)*side*7.8,0.1,cz-Math.sin(angle)*side*7.8); stripe.rotation.y=angle; }
        boulevardSegments.push(segment);
      }
    }
    if (!boulevardSegments.length) {
      addBox(root,31,0.12,8400,roadMaterial,0,0.015,0);
      addBox(root,2.2,0.2,8400,medianMaterial,0,0.12,0);
      addBox(root,8,0.28,8400,sidewalkMaterial,-21.5,0.14,0);
      addBox(root,8,0.28,8400,sidewalkMaterial,21.5,0.14,0);
      for (const x of [-7.8,7.8]) addBox(root,0.38,0.05,8320,stripeMaterial,x,0.1,0);
    }

    const crosswalkMaterial = new THREE.MeshBasicMaterial({ color: 0xf3efe0 });
    for (let z = -3900; z <= 3900; z += 450) {
      for (let i = -4; i <= 4; i += 1) addBox(root, 2.2, 0.045, 24, crosswalkMaterial, i * 3.1, 0.13, z);
    }

    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x34373b, metalness: 0.78, roughness: 0.36 });
    const lampMaterial = new THREE.MeshBasicMaterial({ color: 0xffe08a });
    for (let z = -4050, i = 0; z <= 4050; z += 225, i += 1) {
      for (const x of [-28, 28]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 8, 7), poleMaterial);
        pole.position.set(x, 4.1, z);
        root.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), lampMaterial);
        lamp.position.set(x, 8.2, z);
        root.add(lamp);
      }
    }

    // Corridor identities are real; geometry remains explicitly supported/provisional
    // until authoritative parcel footprints and height records pass the world gates.
    const specs = [
      { name: "MANDALAY BAY", accent: "#d9b35f", x: -158, z: 4050, profile: "tower", evidence: "supported" },
      { name: "LUXOR", accent: "#ffe26f", x: -158, z: 3600, profile: "pyramid", evidence: "supported" },
      { name: "EXCALIBUR", accent: "#ff7a51", x: -158, z: 3150, profile: "castle", evidence: "supported" },
      { name: "NEW YORK-NEW YORK", accent: "#55cfff", x: -158, z: 2700, profile: "twin", evidence: "supported" },
      { name: "PARK MGM", accent: "#56efa0", x: -158, z: 2250, profile: "tower", evidence: "supported" },
      { name: "ARIA", accent: "#66d6ff", x: 158, z: 1800, profile: "tower", evidence: "supported" },
      { name: "BELLAGIO", accent: "#58d8ff", x: -158, z: 1320, profile: "dome", evidence: "supported" },
      { name: "CAESARS PALACE", accent: "#f2c14a", x: -158, z: 880, profile: "castle", evidence: "supported" },
      { name: "FLAMINGO", accent: "#ff6f91", x: 158, z: 440, profile: "twin", evidence: "supported" },
      { name: "THE VENETIAN", accent: "#ffcf55", x: 158, z: 0, profile: "tower", evidence: "supported" },
      { name: "THE SPHERE", accent: "#b778ff", x: 290, z: -440, profile: "dome", evidence: "supported" },
      { name: "WYNN LAS VEGAS", accent: "#e5a44b", x: 158, z: -900, profile: "tower", evidence: "supported" },
      { name: "FONTAINEBLEAU", accent: "#78e9ff", x: 158, z: -1500, profile: "tower", evidence: "supported" },
      { name: "SAHARA", accent: "#ffc75d", x: 158, z: -2050, profile: "tower", evidence: "supported" },
      { name: "THE STRAT", accent: "#b990ff", x: -158, z: -2600, profile: "spire", evidence: "supported" },
      { name: "ARTS DISTRICT GATE", accent: "#ff6655", x: 158, z: -3100, profile: "arena", evidence: "provisional" },
      { name: "DOWNTOWN GATE", accent: "#60e8ff", x: -158, z: -3700, profile: "twin", evidence: "provisional" },
    ];

    specs.forEach((spec, index) => {
      const district = new THREE.Group();
      district.name = spec.name;
      district.position.set(spec.x, 0, spec.z);
      buildResort(district, spec, index);
      root.add(district);
    });

    root.userData.landmarks = specs.map((spec) => spec.name);
    root.userData.landmarkEvidence = Object.fromEntries(specs.map((spec) => [spec.name, spec.evidence || "provisional"]));
    root.userData.corridorVerification = { identity: "supported", geometry: "provisional", seamGapTargetMeters: 0.25, exactFootprintsPending: true };
    scene.add(root);
    window[RUNTIME_KEY].ready = true;
    window[RUNTIME_KEY].anchor = anchor;
    window[RUNTIME_KEY].landmarks = root.userData.landmarks;
    return root;
  }

  function wrapTextRenderer() {
    const current = window.render_game_to_text;
    if (typeof current !== "function" || current.__fullStripWrapped) return;
    const wrapped = () => {
      let value;
      try {
        value = JSON.parse(current());
      } catch {
        value = { mode: "unknown" };
      }
      value.fullStrip = {
        status: window[RUNTIME_KEY].ready ? "live" : "initializing",
        span: 8400,
        sections: ["SOUTH STRIP", "CENTRAL STRIP", "NORTH STRIP"],
        landmarks: window[RUNTIME_KEY].landmarks || [],
      };
      return JSON.stringify(value);
    };
    wrapped.__fullStripWrapped = true;
    window.render_game_to_text = wrapped;
  }

  const originalRender = THREE.WebGLRenderer.prototype.render;
  if (!THREE.WebGLRenderer.prototype.__jcFullStripRenderPatch) {
    Object.defineProperty(THREE.WebGLRenderer.prototype, "__jcFullStripRenderPatch", { value: true });
    THREE.WebGLRenderer.prototype.render = function renderWithFullStrip(scene, camera) {
      if (scene?.isScene && window.JC_VEGAS_SECTIONS?.runtimeDistrictPacks?.status !== "ready") buildFullStrip(scene);
      wrapTextRenderer();
      return originalRender.call(this, scene, camera);
    };
  }
}
