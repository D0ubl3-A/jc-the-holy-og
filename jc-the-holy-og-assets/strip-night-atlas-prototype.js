// JC Strip Night: isolated 200-frame atlas proof of concept.
// 4 x 2048px pages, 8x8 cells, 256px per cell. No external images.
export async function installStripNightPrototype(THREE, game, options = {}) {
  const { scene, player } = game;
  if (!scene || !player) throw new Error('JC scene/player required');
  const group = new THREE.Group();
  group.name = 'strip-night-atlas-prototype';
  const pages = [];
  const materials = [];
  const pageSize = 2048, cell = 256, cols = 8, frameCount = 200, fps = 20;
  let disposed = false;
  const yieldToBrowser = () => new Promise(resolve => setTimeout(resolve, 0));
  for (let page = 0; page < 4; page++) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = pageSize;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Canvas 2D unavailable');
    for (let slot = 0; slot < 64; slot++) {
      const frame = page * 64 + slot;
      if (frame >= frameCount) break;
      const x = (slot % cols) * cell, y = Math.floor(slot / cols) * cell;
      ctx.fillStyle = '#090b19';
      ctx.fillRect(x, y, cell, cell);
      const glow = .5 + .5 * Math.sin(frame * Math.PI * 2 / frameCount);
      ctx.fillStyle = `rgb(${Math.round(15 + glow * 35)},8,${Math.round(55 + glow * 95)})`;
      ctx.fillRect(x + 8, y + 8, 240, 240);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 52px Arial';
      ctx.shadowColor = '#00edff';
      ctx.shadowBlur = 12 + glow * 35;
      ctx.fillStyle = '#a5fbff';
      ctx.fillText('SIN CITY', x + 128, y + 104);
      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = '#ffe17b';
      ctx.fillText('JC THE HOLY OG', x + 128, y + 158);
      ctx.shadowBlur = 0;
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    pages.push(texture);
    await yieldToBrowser();
    if (disposed) return;
  }
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 12),
    new THREE.MeshBasicMaterial({ map: pages[0], toneMapped: false, side: THREE.DoubleSide })
  );
  sign.name = 'strip-night-animated-sign';
  sign.position.set(0, 19, -90);
  group.add(sign);
  materials.push(sign.material);
  // A 3D building anchors the sign in world space, rather than screen space.
  const facade = new THREE.Mesh(
    new THREE.BoxGeometry(30, 35, 6),
    new THREE.MeshLambertMaterial({ color: 0x17182d })
  );
  facade.position.set(0, 17.5, -94);
  group.add(facade);
  materials.push(facade.material);
  scene.add(group);
  let lastFrame = -1, lastPage = -1;
  const started = performance.now();
  function update(now = performance.now()) {
    if (disposed) return;
    const frame = Math.floor((now - started) / 1000 * fps) % frameCount;
    if (frame === lastFrame) return;
    lastFrame = frame;
    const page = Math.floor(frame / 64);
    const slot = frame % 64;
    if (page !== lastPage) {
      sign.material.map = pages[page];
      sign.material.needsUpdate = true;
      lastPage = page;
    }
    // Three.js textures have a bottom-left UV origin; atlas rows are top-down.
    const col = slot % cols, row = Math.floor(slot / cols);
    const tex = pages[page];
    tex.repeat.set(1 / cols, 1 / cols);
    tex.offset.set(col / cols, 1 - (row + 1) / cols);
    // Each page is shared only by this sign in the prototype.
  }
  function dispose() {
    disposed = true;
    scene.remove(group);
    group.traverse(obj => obj.geometry?.dispose?.());
    materials.forEach(m => m.dispose());
    pages.forEach(t => t.dispose());
  }
  return { update, dispose, group, frameCount, pages: pages.length };
}
