export class AIAssetRuntime {
  constructor({ manifestUrl = "./ai-asset-factory/runtime/asset-manifest.json", baseUrl = "." } = {}) {
    this.manifestUrl = manifestUrl;
    this.baseUrl = baseUrl;
    this.manifest = null;
    this.byId = new Map();
  }

  async load() {
    const res = await fetch(this.manifestUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`AI asset manifest failed: ${res.status}`);
    this.manifest = await res.json();
    this.byId.clear();
    for (const asset of this.manifest.assets || []) this.byId.set(asset.id, asset);
    return this.manifest;
  }

  get(id) { return this.byId.get(id) || null; }

  list(type) {
    return [...this.byId.values()].filter(a => !type || a.asset_type === type);
  }

  resolve(assetOrId) {
    const asset = typeof assetOrId === "string" ? this.get(assetOrId) : assetOrId;
    if (!asset) return null;
    const p = asset.runtime_path || asset.path;
    return p ? new URL(p, window.location.href).href : null;
  }

  preloadImage(assetOrId) {
    const url = this.resolve(assetOrId);
    if (!url) return Promise.reject(new Error("Asset has no runtime path"));
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  async preloadType(type) {
    return Promise.allSettled(this.list(type).map(a => this.preloadImage(a)));
  }

  getEnabledTargets() {
    return this.list().filter(a => a.apply?.enabled && a.apply?.target);
  }
}

export async function bootAIAssetRuntime(options) {
  const runtime = new AIAssetRuntime(options);
  await runtime.load();
  window.JC_AI_ASSETS = runtime;
  window.dispatchEvent(new CustomEvent("jc-ai-assets-ready", { detail: runtime }));
  return runtime;
}
