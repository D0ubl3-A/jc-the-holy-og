import * as THREE from "three";

export function seeded(value) {
  const x = Math.sin(value * 913.71 + 17.3) * 43758.5453;
  return x - Math.floor(x);
}

export function makeNoiseTexture(size = 512, seed = 1, mode = "asphalt") {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const n1 = seeded(seed + x * 0.071 + y * 0.119);
      const n2 = seeded(seed * 3.7 + Math.floor(x / 6) * 2.1 + Math.floor(y / 6) * 5.3);
      let r, g, b;
      if (mode === "asphalt") {
        const v = 34 + Math.floor(n1 * 22 + n2 * 9);
        r = v; g = v + 1; b = v + 3;
      } else if (mode === "stone") {
        const v = 150 + Math.floor(n1 * 42);
        r = v + 10; g = v + 5; b = v - 2;
      } else if (mode === "concrete") {
        const v = 132 + Math.floor(n1 * 34);
        r = g = b = v;
      } else {
        const v = Math.floor(n1 * 255); r = g = b = v;
      }
      image.data[i] = r; image.data[i + 1] = g; image.data[i + 2] = b; image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  if (mode === "asphalt") {
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#08090a";
    for (let i = 0; i < 28; i++) {
      const sx = seeded(seed + i * 7) * size, sy = seeded(seed + i * 11) * size;
      ctx.beginPath(); ctx.moveTo(sx, sy);
      for (let p = 1; p < 5; p++) ctx.lineTo(sx + (seeded(i * 19 + p) - .5) * 120 * p, sy + p * 24);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

export function makeWindowTexture({ width = 1024, height = 1024, gold = true, seed = 1 } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0a1117"; ctx.fillRect(0, 0, width, height);
  const cols = 12, rows = 22, gap = 8;
  const cw = width / cols, rh = height / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = seeded(seed + y * 29 + x * 13) > 0.42;
      ctx.fillStyle = lit ? (gold ? `rgba(255,${190 + Math.floor(seeded(seed+x+y)*50)},110,.94)` : "rgba(130,210,255,.88)") : "rgba(12,23,30,.96)";
      ctx.fillRect(x * cw + gap, y * rh + gap, cw - gap * 2, rh - gap * 2);
      ctx.fillStyle = "rgba(255,255,255,.12)";
      ctx.fillRect(x * cw + gap + 2, y * rh + gap + 2, Math.max(1, (cw - gap * 2) * .12), rh - gap * 2 - 4);
    }
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

export function makeSignTexture(text, { accent = "#d9ad50", bg = "rgba(5,7,10,.94)", width = 1024, height = 320, subtitle = "" } = {}) {
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
  const grad = ctx.createLinearGradient(0, 0, width, 0); grad.addColorStop(0, "rgba(255,255,255,0)"); grad.addColorStop(.5, accent); grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad; ctx.fillRect(40, 18, width - 80, 3); ctx.fillRect(40, height - 21, width - 80, 3);
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.shadowColor = accent; ctx.shadowBlur = 24;
  ctx.fillStyle = "#f8efda"; ctx.font = `700 ${Math.min(118, Math.floor(width / Math.max(7, text.length) * 1.18))}px Georgia`;
  ctx.fillText(text, width / 2, subtitle ? height * .44 : height * .52, width * .9);
  if (subtitle) { ctx.shadowBlur = 12; ctx.fillStyle = accent; ctx.font = "700 44px Inter,Arial"; ctx.fillText(subtitle, width / 2, height * .73, width * .82); }
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export function createMaterials() {
  const asphaltMap = makeNoiseTexture(512, 5, "asphalt"); asphaltMap.repeat.set(18, 90);
  const stoneMap = makeNoiseTexture(512, 17, "stone"); stoneMap.repeat.set(4, 4);
  const concreteMap = makeNoiseTexture(512, 23, "concrete"); concreteMap.repeat.set(5, 5);
  const warmWindows = makeWindowTexture({ gold: true, seed: 4 });
  const coolWindows = makeWindowTexture({ gold: false, seed: 10 });

  return {
    asphaltMap, stoneMap, concreteMap, warmWindows, coolWindows,
    asphalt: new THREE.MeshPhysicalMaterial({ color: 0x303236, map: asphaltMap, roughness: .34, metalness: .03, clearcoat: .72, clearcoatRoughness: .24, envMapIntensity: 1.0 }),
    sidewalk: new THREE.MeshStandardMaterial({ color: 0xb2aa9f, map: concreteMap, roughness: .87, metalness: .01 }),
    stone: new THREE.MeshStandardMaterial({ color: 0xc7baa7, map: stoneMap, roughness: .76, metalness: .02 }),
    darkStone: new THREE.MeshStandardMaterial({ color: 0x34302d, map: stoneMap, roughness: .76, metalness: .04 }),
    gold: new THREE.MeshPhysicalMaterial({ color: 0xd6a33f, metalness: .92, roughness: .2, clearcoat: .35, clearcoatRoughness: .16, envMapIntensity: 1.7 }),
    polishedGold: new THREE.MeshPhysicalMaterial({ color: 0xf0c55d, metalness: .98, roughness: .13, clearcoat: .65, clearcoatRoughness: .1, envMapIntensity: 2.0 }),
    blackMetal: new THREE.MeshPhysicalMaterial({ color: 0x090b0e, metalness: .82, roughness: .19, clearcoat: 1, clearcoatRoughness: .08, envMapIntensity: 1.45 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x718d9d, metalness: .05, roughness: .08, transmission: .18, transparent: true, opacity: .72, envMapIntensity: 1.6 }),
    warmGlass: new THREE.MeshPhysicalMaterial({ color: 0x8d7150, metalness: .12, roughness: .12, transmission: .1, transparent: true, opacity: .82, envMapIntensity: 1.4, emissive: 0x5e3512, emissiveIntensity: .14 }),
    grass: new THREE.MeshStandardMaterial({ color: 0x263c25, roughness: .9 }),
    foliage: new THREE.MeshStandardMaterial({ color: 0x24482b, roughness: .88, side: THREE.DoubleSide }),
    water: new THREE.MeshPhysicalMaterial({ color: 0x5b9baa, roughness: .08, metalness: .03, transmission: .2, transparent: true, opacity: .72, clearcoat: 1, clearcoatRoughness: .04, envMapIntensity: 1.7 }),
    redCorruption: new THREE.MeshStandardMaterial({ color: 0x250506, roughness: .42, metalness: .18, emissive: 0x9b0c09, emissiveIntensity: 2.0 }),
    char: new THREE.MeshStandardMaterial({ color: 0x121315, roughness: .88 }),
    lane: new THREE.MeshStandardMaterial({ color: 0xdbc96c, roughness: .58, emissive: 0x362b09, emissiveIntensity: .18 }),
    whiteLane: new THREE.MeshStandardMaterial({ color: 0xe7e5de, roughness: .62 }),
  };
}

export function setWorldWetness(materials, wetness) {
  const w = THREE.MathUtils.clamp(wetness, 0, 1);
  materials.asphalt.roughness = THREE.MathUtils.lerp(.82, .22, w);
  materials.asphalt.clearcoat = THREE.MathUtils.lerp(.05, .9, w);
  materials.asphalt.clearcoatRoughness = THREE.MathUtils.lerp(.5, .12, w);
  materials.sidewalk.roughness = THREE.MathUtils.lerp(.92, .54, w);
  materials.sidewalk.envMapIntensity = THREE.MathUtils.lerp(.3, 1.0, w);
}

export function loadTextureSafe(url, { srgb = true, repeat = null } = {}) {
  return new Promise((resolve) => {
    new THREE.TextureLoader().load(url, (texture) => {
      if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      if (repeat) { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(repeat[0], repeat[1]); }
      resolve(texture);
    }, undefined, () => resolve(null));
  });
}

export function atlasTile(texture, col, row, cols = 4, rows = 4) {
  if (!texture) return null;
  const t = texture.clone();
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  const inset = 1 / Math.max(texture.image?.width || 1024, 1024);
  t.repeat.set(1 / cols - inset * 2, 1 / rows - inset * 2);
  t.offset.set(col / cols + inset, row / rows + inset);
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}
