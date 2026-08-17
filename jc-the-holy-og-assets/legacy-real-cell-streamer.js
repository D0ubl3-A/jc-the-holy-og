const DEFAULT_URL = "./jc-the-holy-og-assets/generated/legacy-real/legacy_prototype_real_city.json";

function keyId(v){ return String(v); }

export class JCLegacyRealCellStreamer {
  constructor({ url = DEFAULT_URL, preloadRadius = 1 } = {}) {
    this.url = url;
    this.preloadRadius = preloadRadius;
    this.data = null;
    this.cells = new Map();
    this.aliasToPermanent = new Map();
    this.features = {
      buildings: new Map(),
      roads: new Map(),
      barriers: new Map(),
      gates: new Map(),
    };
    this.loaded = new Set();
  }

  async init() {
    const res = await fetch(this.url, { cache: "no-store" });
    if (!res.ok) throw new Error(`legacy real city HTTP ${res.status}`);
    this.data = await res.json();
    if (this.data?.grid?.projected_crs !== "EPSG:26911") {
      throw new Error("legacy real grid CRS mismatch");
    }
    for (const c of this.data.cells || []) {
      this.cells.set(c.cell_id, c);
      if (c.legacy_prototype_id) this.aliasToPermanent.set(c.legacy_prototype_id, c.cell_id);
    }
    for (const b of this.data.buildings || []) this.features.buildings.set(keyId(b.osm_id), b);
    for (const r of this.data.roads || []) this.features.roads.set(keyId(r.osm_id), r);
    for (const b of this.data.barriers || []) this.features.barriers.set(keyId(b.osm_id), b);
    for (const g of this.data.gates || []) this.features.gates.set(keyId(g.osm_id), g);
    return this;
  }

  resolveCellId(id) {
    if (this.cells.has(id)) return id;
    return this.aliasToPermanent.get(id) || null;
  }

  cellForWorldXZ(x, z) {
    if (!this.data) return null;
    const [ox, oy] = this.data.grid.world_origin_projected;
    const [gx, gy] = this.data.grid.grid_origin_projected;
    const s = this.data.grid.cell_size_m;
    const px = x + ox;
    const py = z + oy;
    const col = Math.floor((px - gx) / s);
    const row = Math.floor((py - gy) / s);
    const id = `r${String(row).padStart(4,"0")}_c${String(col).padStart(4,"0")}`;
    return this.cells.has(id) ? id : null;
  }

  neighborhood(cellId, radius = this.preloadRadius) {
    const id = this.resolveCellId(cellId);
    const c = id && this.cells.get(id);
    if (!c) return [];
    const out = [];
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        const nid = `r${String(c.row + dr).padStart(4,"0")}_c${String(c.column + dc).padStart(4,"0")}`;
        if (this.cells.has(nid)) out.push(nid);
      }
    }
    return out;
  }

  getCell(cellId) {
    const id = this.resolveCellId(cellId);
    if (!id) return null;
    const c = this.cells.get(id);
    const ix = this.data.cell_index?.[id] || {};
    const pick = (map, ids = []) => ids.map(v => map.get(keyId(v))).filter(Boolean);
    return {
      ...c,
      cell_id: id,
      buildings: pick(this.features.buildings, ix.building_ids),
      roads: pick(this.features.roads, ix.road_ids),
      barriers: pick(this.features.barriers, ix.barrier_ids),
      gates: pick(this.features.gates, ix.gate_ids),
    };
  }

  loadCell(cellId) {
    const cell = this.getCell(cellId);
    if (!cell) return null;
    this.loaded.add(cell.cell_id);
    return cell;
  }

  unloadCell(cellId) {
    const id = this.resolveCellId(cellId);
    if (id) this.loaded.delete(id);
  }

  updateAroundWorldXZ(x, z, radius = this.preloadRadius) {
    const center = this.cellForWorldXZ(x, z);
    if (!center) return { center: null, load: [], unload: [...this.loaded] };
    const wanted = new Set(this.neighborhood(center, radius));
    const load = [...wanted].filter(id => !this.loaded.has(id));
    const unload = [...this.loaded].filter(id => !wanted.has(id));
    load.forEach(id => this.loaded.add(id));
    unload.forEach(id => this.loaded.delete(id));
    return { center, load, unload };
  }
}

export default JCLegacyRealCellStreamer;
