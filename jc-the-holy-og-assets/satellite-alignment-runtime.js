import * as THREE from "three";

const RUNTIME_KEY = "__JC_SATELLITE_ALIGNMENT_V1__";

if (!window[RUNTIME_KEY]) {
  const config = window.JC_SATELLITE_ALIGNMENT || {};
  const south = config.southStrip || {};
  const bbox = south.bbox4326 || [-115.1827, 36.0877, -115.1627, 36.1083];
  const centerLon = (bbox[0] + bbox[2]) * 0.5;
  const centerLat = (bbox[1] + bbox[3]) * 0.5;
  const centerZ = Number(south.gameCenter?.[1] ?? 3150);
  const centerX = Number(south.gameCenter?.[0] ?? 0);
  const metersPerLat = 111320;
  const metersPerLon = 111320 * Math.cos(centerLat * Math.PI / 180);
  const widthM = Math.abs(bbox[2] - bbox[0]) * metersPerLon;
  const heightM = Math.abs(bbox[3] - bbox[1]) * metersPerLat;
  const anchors = Array.isArray(window.JC_SOUTH_STRIP_GEO_ANCHORS)
    ? window.JC_SOUTH_STRIP_GEO_ANCHORS
    : [];

  const state = window[RUNTIME_KEY] = {
    installed: true,
    ready: false,
    imagery: "loading",
    visible: true,
    correctionsApplied: false,
    source: south.imageryService || "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
    bbox4326: bbox,
    report: []
  };

  const imageryUrl = `${state.source}/export?bbox=${bbox.join(",")}&bboxSR=4326&imageSR=4326&size=2048,2048&format=jpg&transparent=false&f=image`;

  function geoToLocal(lat, lon) {
    return {
      x: centerX + (Number(lon) - centerLon) * metersPerLon,
      z: centerZ + (centerLat - Number(lat)) * metersPerLat
    };
  }

  function makeLabelTexture(text) {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(4,8,12,.88)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#45edff";
    ctx.lineWidth = 8;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 58px Arial Narrow, Arial, sans-serif";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function addAnchorMarker(root, anchor) {
    const p = geoToLocal(anchor.lat, anchor.lon);
    const group = new THREE.Group();
    group.name = `SAT GEO ${anchor.name}`;
    group.position.set(p.x, 0.06, p.z);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(9, 14, 32),
      new THREE.MeshBasicMaterial({ color: 0x45edff, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);

    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd45a, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide })
    );
    dot.rotation.x = -Math.PI / 2;
    dot.position.y = 0.01;
    group.add(dot);

    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeLabelTexture(anchor.name), transparent: true, depthWrite: false, toneMapped: false }));
    label.position.set(0, 18, 0);
    label.scale.set(92, 15.3, 1);
    group.add(label);

    root.add(group);
    return p;
  }

  function correctExistingLandmarks(root) {
    if (state.correctionsApplied) return;
    for (const anchor of anchors) {
      const object = root.getObjectByName(anchor.name);
      if (!object) continue;
      const target = geoToLocal(anchor.lat, anchor.lon);
      const before = { x: object.position.x, z: object.position.z };
      const delta = Math.hypot(target.x - before.x, target.z - before.z);
      object.userData.preSatellitePosition = before;
      object.userData.geoAnchor = { lat: anchor.lat, lon: anchor.lon, evidence: anchor.evidence || "supported" };
      object.position.x = target.x;
      object.position.z = target.z;
      state.report.push({ name: anchor.name, before, after: target, movedMetersApprox: Math.round(delta * 10) / 10, evidence: anchor.evidence || "supported" });
    }
    state.correctionsApplied = true;
    window.JC_SATELLITE_ALIGNMENT_REPORT = state.report;
  }

  function ensureAttribution() {
    let chip = document.getElementById("jcSatelliteAttribution");
    if (chip) return chip;
    chip = document.createElement("div");
    chip.id = "jcSatelliteAttribution";
    chip.textContent = "SATELLITE CALIBRATION • V TO TOGGLE • Imagery: Esri, Vantor, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, © OpenStreetMap contributors, TomTom, Garmin, FAO, NOAA & GIS User Community";
    Object.assign(chip.style, {
      position: "fixed",
      left: "50%",
      bottom: "8px",
      transform: "translateX(-50%)",
      zIndex: "11",
      maxWidth: "92vw",
      padding: "5px 9px",
      background: "rgba(4,8,12,.78)",
      border: "1px solid rgba(69,237,255,.5)",
      color: "#bff8ff",
      font: "700 8px/1.25 Arial, sans-serif",
      letterSpacing: ".04em",
      textAlign: "center",
      pointerEvents: "none"
    });
    document.body.appendChild(chip);
    return chip;
  }

  function setVisible(visible) {
    state.visible = !!visible;
    if (state.root) state.root.visible = state.visible;
    const chip = document.getElementById("jcSatelliteAttribution");
    if (chip) chip.style.display = state.visible ? "block" : "none";
  }

  function buildCalibration(root) {
    if (state.ready || !root) return;
    const calibration = new THREE.Group();
    calibration.name = "JC SATELLITE SOUTH STRIP CALIBRATION V1";
    calibration.userData.referenceOnly = true;
    calibration.userData.geometryEvidence = south.geometryEvidence || "supported";
    calibration.userData.exactFootprintsPending = true;

    const geometry = new THREE.PlaneGeometry(widthM, heightM, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(geometry, material);
    plane.name = "ESRI WORLD IMAGERY SOUTH STRIP REFERENCE";
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(centerX, 0.006, centerZ);
    plane.renderOrder = -4;
    calibration.add(plane);

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      imageryUrl,
      texture => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        material.map = texture;
        material.color.setHex(0xffffff);
        material.needsUpdate = true;
        state.imagery = "loaded";
      },
      undefined,
      () => {
        state.imagery = "unavailable";
        material.color.setHex(0x19313a);
        material.opacity = 0.18;
        material.needsUpdate = true;
      }
    );

    for (const anchor of anchors) addAnchorMarker(calibration, anchor);
    root.add(calibration);
    state.root = calibration;
    state.ready = true;
    correctExistingLandmarks(root);
    ensureAttribution();
    setVisible(true);
  }

  window.JC_SATELLITE_ALIGNMENT_CONTROL = {
    toggle() { setVisible(!state.visible); return state.visible; },
    show() { setVisible(true); },
    hide() { setVisible(false); },
    status() { return { ...state, root: undefined }; }
  };

  addEventListener("keydown", event => {
    if (event.code === "KeyV" && !event.repeat) {
      window.JC_SATELLITE_ALIGNMENT_CONTROL.toggle();
    }
  });

  const previousRender = THREE.WebGLRenderer.prototype.render;
  if (!THREE.WebGLRenderer.prototype.__jcSatelliteAlignmentPatch) {
    Object.defineProperty(THREE.WebGLRenderer.prototype, "__jcSatelliteAlignmentPatch", { value: true });
    THREE.WebGLRenderer.prototype.render = function renderWithSatelliteAlignment(scene, camera) {
      if (scene?.isScene) {
        const stripRoot = scene.getObjectByName("JC FULL LAS VEGAS STRIP V2");
        if (stripRoot) buildCalibration(stripRoot);
      }
      return previousRender.call(this, scene, camera);
    };
  }
}
