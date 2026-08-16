import * as THREE from "three";

const KEY = "__JC_STATIC_GROUNDING_V2__";

if (!window[KEY]) {
  const state = window[KEY] = {
    installed: true,
    anchored: 0,
    corrected: 0,
    lastAudit: 0,
    report: []
  };

  const GROUND_Y = 0.02;
  const AUDIT_EVERY_FRAMES = 120;
  let frame = 0;

  function isStaticBuildingRoot(object) {
    if (!object || !object.isGroup || !object.children?.length) return false;
    if (object.userData?.dynamic || object.userData?.vehicle || object.userData?.actor) return false;

    const name = String(object.name || "").toUpperCase();
    const geoAnchored = !!object.userData?.geoAnchor;
    const namedLandmark = /MANDALAY|LUXOR|EXCALIBUR|NEW YORK|PARK MGM|MGM GRAND|ALLEGIANT|BELLAGIO|CAESARS|FLAMINGO|VENETIAN|SPHERE|WYNN|FONTAINEBLEAU|SAHARA|STRAT|CLOWN TOWN|ROYAL PALACE|THE WIN|THE PINE|THE PYRAMID|DOWNTOWN GATE/.test(name);
    const footprint = /FOOTPRINT|BUILDING|LANDMARK|RESORT|STADIUM/.test(name);
    return geoAnchored || namedLandmark || footprint;
  }

  function worldToParentLocalY(object, worldDeltaY) {
    const parent = object.parent;
    if (!parent) return worldDeltaY;
    parent.updateMatrixWorld(true);
    const parentScale = new THREE.Vector3();
    parent.getWorldScale(parentScale);
    const sy = Math.abs(parentScale.y) > 1e-6 ? parentScale.y : 1;
    return worldDeltaY / sy;
  }

  function groundAndLock(object) {
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return false;

    if (!object.userData.__jcStaticAnchor) {
      const deltaWorldY = GROUND_Y - box.min.y;
      if (Math.abs(deltaWorldY) > 0.001 && Math.abs(deltaWorldY) < 500) {
        object.position.y += worldToParentLocalY(object, deltaWorldY);
        object.updateMatrixWorld(true);
        state.corrected++;
      }

      object.userData.__jcStaticAnchor = {
        x: object.position.x,
        y: object.position.y,
        z: object.position.z,
        rx: object.rotation.x,
        ry: object.rotation.y,
        rz: object.rotation.z
      };
      object.userData.staticGrounded = true;
      state.anchored++;
      state.report.push({
        name: object.name || "unnamed-building",
        x: Math.round(object.position.x * 100) / 100,
        y: Math.round(object.position.y * 100) / 100,
        z: Math.round(object.position.z * 100) / 100
      });
      return true;
    }

    const a = object.userData.__jcStaticAnchor;
    const drift = Math.hypot(object.position.x - a.x, object.position.y - a.y, object.position.z - a.z);
    if (drift > 0.01) {
      object.position.set(a.x, a.y, a.z);
      object.rotation.set(a.rx, a.ry, a.rz);
      object.updateMatrixWorld(true);
      state.corrected++;
      return true;
    }
    return false;
  }

  function auditScene(scene, force = false) {
    if (!scene?.isScene) return;
    frame++;
    if (!force && frame % AUDIT_EVERY_FRAMES !== 0) return;

    scene.updateMatrixWorld(true);
    scene.traverse(object => {
      if (isStaticBuildingRoot(object)) groundAndLock(object);
    });

    state.lastAudit = performance.now();
    window.JC_STATIC_GROUNDING_REPORT = state.report.slice();
  }

  window.JC_STATIC_GROUNDING_CONTROL = {
    audit(scene) { auditScene(scene, true); return { ...state, report: state.report.slice() }; },
    status() { return { ...state, report: state.report.slice() }; },
    unlock(scene) {
      if (!scene?.isScene) return 0;
      let count = 0;
      scene.traverse(object => {
        if (object.userData?.__jcStaticAnchor) {
          delete object.userData.__jcStaticAnchor;
          delete object.userData.staticGrounded;
          count++;
        }
      });
      state.anchored = Math.max(0, state.anchored - count);
      return count;
    }
  };

  const previousRender = THREE.WebGLRenderer.prototype.render;
  if (!THREE.WebGLRenderer.prototype.__jcStaticGroundingPatch) {
    Object.defineProperty(THREE.WebGLRenderer.prototype, "__jcStaticGroundingPatch", { value: true });
    THREE.WebGLRenderer.prototype.render = function renderWithStaticGrounding(scene, camera) {
      auditScene(scene);
      return previousRender.call(this, scene, camera);
    };
  }
}
