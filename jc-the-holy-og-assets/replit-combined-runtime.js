import * as THREE from "three";

const STATE_KEY = "__JC_REPLIT_COMBINED_RUNTIME_V1__";
const state = window[STATE_KEY] || (window[STATE_KEY] = {
  installed: true,
  donorRuntime: "pending",
  partners: null,
  brandingApplied: false,
  mode: window.JC_LOW_SPEC ? "low-spec" : "enhanced"
});

async function loadPartners() {
  try {
    const response = await fetch("./world/city-partners.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`city partners HTTP ${response.status}`);
    state.partners = await response.json();
    window.JC_CITY_PARTNERS = state.partners;
    return state.partners;
  } catch (error) {
    console.warn("JC City Partners registry unavailable", error);
    return null;
  }
}

function labelTexture(text, sponsored = false) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(3,7,13,.96)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = sponsored ? "#7de6ff" : "#ffd45a";
  ctx.lineWidth = 16;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 86px Arial Black, Arial, sans-serif";
  ctx.fillText(String(text || "JC LOCATION").slice(0, 25), canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function partnerLabelTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 150;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(0,0,0,.9)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#7de6ff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "800 52px Arial, sans-serif";
  ctx.fillText("OFFICIAL JC CITY PARTNER", canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addReplacementSign(group, placement) {
  const sponsored = Boolean(placement?.sponsor?.authorized && placement?.sponsor?.display_name);
  const displayName = sponsored ? placement.sponsor.display_name : placement.default_brand;

  const sign = new THREE.Sprite(new THREE.SpriteMaterial({
    map: labelTexture(displayName, sponsored),
    transparent: true,
    depthWrite: false,
    toneMapped: false
  }));
  sign.name = "JC AUTHORIZED LOCATION SIGN";
  sign.position.set(0, 78, 42);
  sign.scale.set(78, 19.5, 1);
  sign.renderOrder = 30;
  group.add(sign);

  if (sponsored) {
    const disclosure = new THREE.Sprite(new THREE.SpriteMaterial({
      map: partnerLabelTexture(),
      transparent: true,
      depthWrite: false,
      toneMapped: false
    }));
    disclosure.name = "JC SPONSOR DISCLOSURE";
    disclosure.position.set(0, 65, 42.5);
    disclosure.scale.set(62, 9, 1);
    disclosure.renderOrder = 31;
    group.add(disclosure);
  }

  group.userData.jcPlacementId = placement.id;
  group.userData.jcBrandMode = sponsored ? "authorized_sponsor" : "fictional_default";
  group.userData.jcDisplayName = displayName;
  group.name = displayName;
}

function applyFictionalBranding(scene) {
  const root = scene?.getObjectByName?.("JC FULL LAS VEGAS STRIP V2");
  const placements = state.partners?.placements || [];
  if (!root || !placements.length) return false;

  const landmarkGroups = root.children.filter(child => child?.isGroup);
  let changed = false;
  landmarkGroups.slice(0, placements.length).forEach((group, index) => {
    if (group.userData?.jcBrandingApplied) return;

    // The donor/full-strip runtime may contain reference branding. Never show it
    // to players by default. Hide its sign sprites and replace them with the
    // fictional or explicitly authorized JC City Partners identity.
    group.traverse(object => {
      if (object.isSprite) object.visible = false;
    });

    const placement = placements[index];
    addReplacementSign(group, placement);
    group.userData.jcBrandingApplied = true;
    changed = true;
  });

  if (changed) {
    state.brandingApplied = true;
    root.userData.cityPartners = {
      program: state.partners.program_name,
      defaultMode: state.partners.policy.default_mode,
      placementsApplied: Math.min(landmarkGroups.length, placements.length)
    };
  }
  return changed;
}

function hookRenderer() {
  if (THREE.WebGLRenderer.prototype.__jcReplitBridgeRenderPatch) return;
  const originalRender = THREE.WebGLRenderer.prototype.render;
  Object.defineProperty(THREE.WebGLRenderer.prototype, "__jcReplitBridgeRenderPatch", { value: true });
  THREE.WebGLRenderer.prototype.render = function jcCombinedRender(scene, camera) {
    if (!state.brandingApplied) applyFictionalBranding(scene);
    return originalRender.call(this, scene, camera);
  };
}

async function installEnhancedDonorRuntime() {
  if (window.JC_LOW_SPEC) {
    state.donorRuntime = "deferred_low_spec";
    return;
  }
  try {
    // Load only after the low-spec playable shell is already alive. This keeps
    // the current reliability-first boot behavior while progressively adding
    // the existing full-Strip donor/current-repo runtime.
    await import("./full-strip-runtime.js");
    state.donorRuntime = "full_strip_loaded";
  } catch (error) {
    state.donorRuntime = "failed_safe";
    console.warn("JC enhanced Strip runtime stayed disabled", error);
  }
}

window.JC_REFRESH_CITY_PARTNERS = async () => {
  state.brandingApplied = false;
  await loadPartners();
  return state.partners;
};

hookRenderer();
await loadPartners();

const schedule = window.requestIdleCallback
  ? callback => window.requestIdleCallback(callback, { timeout: 1800 })
  : callback => setTimeout(callback, 900);

schedule(() => installEnhancedDonorRuntime());
