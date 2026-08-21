import * as THREE from "three";

const RUNTIME_KEY = "__JC_NATURAL_MOTION_RUNTIME_V1__";

if (!window[RUNTIME_KEY]) {
  const state = window[RUNTIME_KEY] = {
    installed: true,
    ready: false,
    jc: null,
    flightSprite: null,
    rig: null,
    inputs: new Set(),
    remappedHeld: new Map(),
    touchHeld: new Map(),
    gunDrawn: false,
    weaponBlend: 0,
    fightTimer: 0,
    recoilTimer: 0,
    landTimer: 0,
    verticalVelocity: 0,
    runPhase: 0,
    climbPhase: 0,
    previousY: 0,
    previousPosition: new THREE.Vector3(),
    previousMode: "car",
    lastTime: performance.now(),
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const damp = (current, target, lambda, dt) => THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));

  function gearMode() {
    const value = document.getElementById("gear")?.textContent?.trim();
    if (value === "FLY") return "fly";
    if (value === "F") return "foot";
    return "car";
  }

  function keyForCode(code) {
    if (code === "KeyA") return "a";
    if (code === "KeyD") return "d";
    if (code === "Space") return " ";
    return code.replace(/^Key/, "").toLowerCase();
  }

  const forwardedEvents = new WeakSet();
  function dispatchForwarded(type, code, sourceEvent = null) {
    const forwarded = new KeyboardEvent(type, {
      code,
      key: keyForCode(code),
      bubbles: true,
      cancelable: true,
      repeat: Boolean(sourceEvent?.repeat),
      shiftKey: Boolean(sourceEvent?.shiftKey),
      ctrlKey: Boolean(sourceEvent?.ctrlKey),
      altKey: Boolean(sourceEvent?.altKey),
      metaKey: Boolean(sourceEvent?.metaKey),
    });
    forwardedEvents.add(forwarded);
    window.dispatchEvent(forwarded);
  }

  function beginJump() {
    if (gearMode() !== "foot" || !state.jc) return;
    if (state.jc.position.y > 0.08 || state.verticalVelocity > 0.2) return;
    state.verticalVelocity = 11.8;
    state.landTimer = 0;
  }

  function beginFight() {
    if (gearMode() === "car") return;
    state.fightTimer = 0.48;
  }

  function toggleGun() {
    if (gearMode() === "car") return;
    state.gunDrawn = !state.gunDrawn;
  }

  function handleKeyDown(event) {
    if (forwardedEvents.has(event)) return;
    state.inputs.add(event.code);
    const mode = gearMode();

    if ((event.code === "KeyA" || event.code === "KeyD") && mode === "car") {
      event.preventDefault();
      event.stopImmediatePropagation();
      const mapped = event.code === "KeyA" ? "KeyD" : "KeyA";
      if (!state.remappedHeld.has(event.code)) {
        state.remappedHeld.set(event.code, mapped);
        dispatchForwarded("keydown", mapped, event);
      }
      return;
    }

    if (event.code === "Space" && mode === "foot") {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) beginJump();
      return;
    }

    if (event.code === "KeyR" && !event.repeat) beginFight();
    if (event.code === "KeyG" && !event.repeat) toggleGun();
  }

  function handleKeyUp(event) {
    if (forwardedEvents.has(event)) return;
    state.inputs.delete(event.code);
    const mapped = state.remappedHeld.get(event.code);
    if (mapped) {
      event.preventDefault();
      event.stopImmediatePropagation();
      dispatchForwarded("keyup", mapped, event);
      state.remappedHeld.delete(event.code);
    }
  }

  window.addEventListener("keydown", handleKeyDown, true);
  window.addEventListener("keyup", handleKeyUp, true);
  window.addEventListener("blur", () => {
    state.inputs.clear();
    for (const mapped of state.remappedHeld.values()) dispatchForwarded("keyup", mapped);
    state.remappedHeld.clear();
    for (const held of state.touchHeld.values()) dispatchForwarded("keyup", held.mapped);
    state.touchHeld.clear();
  });

  function isSteerButton(target) {
    return target?.closest?.(".pad .left,.pad .right") || null;
  }

  document.addEventListener("pointerdown", (event) => {
    const button = isSteerButton(event.target);
    if (button) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const physical = button.classList.contains("left") ? "KeyA" : "KeyD";
      const mapped = gearMode() === "car" ? (physical === "KeyA" ? "KeyD" : "KeyA") : physical;
      state.inputs.add(physical);
      state.touchHeld.set(event.pointerId, { mapped, physical });
      dispatchForwarded("keydown", mapped);
      return;
    }

    if (event.target?.tagName === "CANVAS" && state.gunDrawn && gearMode() !== "car") {
      state.recoilTimer = 0.16;
    }
  }, true);

  const releaseTouchSteer = (event) => {
    const held = state.touchHeld.get(event.pointerId);
    if (!held) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    state.touchHeld.delete(event.pointerId);
    state.inputs.delete(held.physical);
    dispatchForwarded("keyup", held.mapped);
  };
  document.addEventListener("pointerup", releaseTouchSteer, true);
  document.addEventListener("pointercancel", releaseTouchSteer, true);

  function findJc(scene) {
    let best = null;
    scene.traverse((object) => {
      if (best || !object.isGroup) return;
      let capsuleCount = 0;
      let haloCount = 0;
      for (const child of object.children) {
        if (!child.isMesh) continue;
        if (child.geometry?.type === "CapsuleGeometry") capsuleCount += 1;
        if (child.geometry?.type === "TorusGeometry" && child.position.y > 5) haloCount += 1;
      }
      if (capsuleCount >= 3 && haloCount >= 1) best = object;
    });
    return best;
  }

  function findFlightSprite(scene) {
    return scene.children.find((object) => object.isSprite && Math.abs(object.scale.x - 7.2) < 0.35 && Math.abs(object.scale.y - 9) < 0.5) || null;
  }

  function makeArm(side, clothMaterial, skinMaterial) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 1.08, 4.05, 0);

    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.82, 4, 8), clothMaterial);
    upper.position.y = -0.59;
    upper.castShadow = true;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -1.12;
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.20, 0.72, 4, 8), skinMaterial);
    forearm.position.y = -0.51;
    forearm.castShadow = true;
    elbow.add(forearm);

    const hand = new THREE.Group();
    hand.position.y = -1.02;
    elbow.add(hand);
    const handMesh = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skinMaterial);
    hand.add(handMesh);

    return { shoulder, elbow, hand };
  }

  function makePistol() {
    const root = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x121417, metalness: 0.82, roughness: 0.2 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xd6aa39, metalness: 0.9, roughness: 0.18, emissive: 0x3b2700, emissiveIntensity: 0.4 });
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.94, 0.28), dark);
    slide.position.y = -0.44;
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.28, 10), gold);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, -0.9, 0.02);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.46, 0.30), dark);
    grip.position.set(0, -0.1, 0.20);
    grip.rotation.x = -0.28;
    root.add(slide, muzzle, grip);
    root.scale.setScalar(0.92);
    root.visible = false;
    return root;
  }

  function buildRig(jc) {
    const directMeshes = jc.children.filter((child) => child.isMesh);
    const torso = directMeshes.find((mesh) => mesh.geometry?.type === "CapsuleGeometry" && mesh.position.y > 2.5);
    const head = directMeshes.find((mesh) => mesh.geometry?.type === "SphereGeometry" && mesh.position.y > 4.7);
    const chest = directMeshes.find((mesh) => mesh.geometry?.type === "PlaneGeometry");
    const legs = directMeshes
      .filter((mesh) => mesh.geometry?.type === "CapsuleGeometry" && mesh.position.y < 2.2)
      .sort((a, b) => a.position.x - b.position.x);

    if (!torso || !head || legs.length < 2) return null;

    const clothMaterial = torso.material;
    const skinMaterial = head.material;
    const leftArm = makeArm(-1, clothMaterial, skinMaterial);
    const rightArm = makeArm(1, clothMaterial, skinMaterial);
    jc.add(leftArm.shoulder, rightArm.shoulder);

    const legPivots = [];
    legs.slice(0, 2).forEach((leg) => {
      const pivot = new THREE.Group();
      const x = leg.position.x;
      pivot.position.set(x, 2.08, 0);
      jc.remove(leg);
      jc.add(pivot);
      pivot.add(leg);
      leg.position.set(0, -0.93, 0);
      legPivots.push(pivot);
    });

    const pistol = makePistol();
    rightArm.hand.add(pistol);
    pistol.position.set(0, -0.12, 0.02);

    const rig = {
      torso,
      head,
      chest,
      leftLeg: legPivots[0],
      rightLeg: legPivots[1],
      leftArm,
      rightArm,
      pistol,
      base: {
        torsoY: torso.position.y,
        headY: head.position.y,
        chestY: chest?.position.y ?? 3.5,
      },
    };
    jc.userData.naturalMotionRig = rig;
    return rig;
  }

  function setJointRotation(joint, x, y, z, dt, speed = 14) {
    if (!joint) return;
    joint.rotation.x = damp(joint.rotation.x, x, speed, dt);
    joint.rotation.y = damp(joint.rotation.y, y, speed, dt);
    joint.rotation.z = damp(joint.rotation.z, z, speed, dt);
  }

  function applyPose(mode, velocity, dt, now) {
    const rig = state.rig;
    const jc = state.jc;
    if (!rig || !jc) return;

    const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
    const airborne = mode === "foot" && jc.position.y > 0.09;
    const climbing = mode === "foot" && state.inputs.has("KeyX");
    const ascending = velocity.y > 1.1;
    const falling = (mode === "foot" && airborne && velocity.y < -0.8) || (mode === "fly" && velocity.y < -3.2);
    const running = mode === "foot" && !airborne && horizontalSpeed > 3.4;
    const fighting = state.fightTimer > 0;
    const armed = state.weaponBlend > 0.12;

    const pose = {
      torsoX: 0, torsoY: 0, torsoZ: 0,
      leftLegX: 0, rightLegX: 0, leftLegZ: 0, rightLegZ: 0,
      leftShoulderX: 0, rightShoulderX: 0, leftShoulderY: 0, rightShoulderY: 0,
      leftShoulderZ: -0.08, rightShoulderZ: 0.08,
      leftElbowX: 0, rightElbowX: 0, leftElbowZ: 0, rightElbowZ: 0,
      rootPitch: 0, headX: 0,
    };

    if (mode === "fly") {
      const fast = clamp(horizontalSpeed / 46, 0, 1);
      pose.rootPitch = falling ? 0.16 : -0.18 * fast;
      pose.torsoX = falling ? 0.25 : -0.28 * fast;
      pose.leftShoulderX = falling ? -0.35 : -1.18 - fast * 0.18;
      pose.rightShoulderX = falling ? -0.35 : -1.18 - fast * 0.18;
      pose.leftShoulderZ = falling ? -0.92 : -0.24;
      pose.rightShoulderZ = falling ? 0.92 : 0.24;
      pose.leftLegX = falling ? -0.18 : 0.26 + fast * 0.14;
      pose.rightLegX = falling ? 0.12 : 0.18 + fast * 0.10;
      pose.headX = falling ? -0.18 : 0.12 * fast;
    } else if (climbing) {
      state.climbPhase += dt * 7.4;
      const swing = Math.sin(state.climbPhase);
      pose.torsoX = -0.16;
      pose.leftShoulderX = -2.55 + swing * 0.52;
      pose.rightShoulderX = -2.55 - swing * 0.52;
      pose.leftElbowX = -0.42;
      pose.rightElbowX = -0.42;
      pose.leftLegX = 0.72 - swing * 0.48;
      pose.rightLegX = 0.72 + swing * 0.48;
      pose.leftLegZ = -0.12;
      pose.rightLegZ = 0.12;
      pose.headX = -0.12;
    } else if (airborne && ascending) {
      pose.torsoX = -0.08;
      pose.leftShoulderX = -1.0;
      pose.rightShoulderX = -0.72;
      pose.leftShoulderZ = -0.34;
      pose.rightShoulderZ = 0.26;
      pose.leftLegX = -0.72;
      pose.rightLegX = 0.48;
      pose.leftLegZ = -0.10;
      pose.rightLegZ = 0.08;
    } else if (falling) {
      pose.torsoX = 0.16;
      pose.leftShoulderX = -0.28;
      pose.rightShoulderX = -0.28;
      pose.leftShoulderZ = -0.95;
      pose.rightShoulderZ = 0.95;
      pose.leftElbowX = -0.30;
      pose.rightElbowX = -0.30;
      pose.leftLegX = 0.28;
      pose.rightLegX = -0.18;
      pose.leftLegZ = -0.20;
      pose.rightLegZ = 0.20;
      pose.headX = -0.12;
    } else if (state.landTimer > 0) {
      const amount = clamp(state.landTimer / 0.28, 0, 1);
      pose.torsoX = 0.38 * amount;
      pose.torsoY = -0.46 * amount;
      pose.leftLegX = 0.62 * amount;
      pose.rightLegX = 0.62 * amount;
      pose.leftShoulderX = -0.34 * amount;
      pose.rightShoulderX = -0.34 * amount;
    } else if (running) {
      state.runPhase += dt * (6.4 + clamp(horizontalSpeed * 0.18, 0, 6.5));
      const stride = Math.sin(state.runPhase);
      const bob = Math.abs(Math.sin(state.runPhase * 2));
      pose.torsoX = -0.12;
      pose.torsoY = bob * 0.07;
      pose.leftLegX = stride * 0.74;
      pose.rightLegX = -stride * 0.74;
      pose.leftShoulderX = -stride * 0.62;
      pose.rightShoulderX = stride * 0.62;
      pose.leftElbowX = -0.20 - Math.max(0, stride) * 0.24;
      pose.rightElbowX = -0.20 - Math.max(0, -stride) * 0.24;
      pose.headX = 0.04;
    } else {
      const breathe = Math.sin(now * 0.0022) * 0.025;
      pose.torsoY = breathe;
      pose.leftShoulderZ = -0.08 - breathe * 0.3;
      pose.rightShoulderZ = 0.08 + breathe * 0.3;
    }

    if (fighting && mode !== "fly") {
      const progress = 1 - clamp(state.fightTimer / 0.48, 0, 1);
      const strike = Math.sin(progress * Math.PI);
      const rightPunch = progress < 0.5;
      pose.torsoY += 0.03;
      pose.torsoZ = (rightPunch ? -1 : 1) * 0.16 * strike;
      if (rightPunch) {
        pose.rightShoulderX = -1.50 * strike;
        pose.rightShoulderY = -0.24 * strike;
        pose.rightElbowX = -0.18;
        pose.leftShoulderX = -0.48;
        pose.leftElbowX = -0.72;
      } else {
        pose.leftShoulderX = -1.50 * strike;
        pose.leftShoulderY = 0.24 * strike;
        pose.leftElbowX = -0.18;
        pose.rightShoulderX = -0.48;
        pose.rightElbowX = -0.72;
      }
    } else if (armed) {
      const aim = state.weaponBlend;
      const recoil = clamp(state.recoilTimer / 0.16, 0, 1);
      pose.torsoX = THREE.MathUtils.lerp(pose.torsoX, -0.05, aim);
      pose.torsoZ = THREE.MathUtils.lerp(pose.torsoZ, -0.12, aim);
      pose.rightShoulderX = THREE.MathUtils.lerp(pose.rightShoulderX, -1.46 + recoil * 0.18, aim);
      pose.rightShoulderY = THREE.MathUtils.lerp(pose.rightShoulderY, -0.08, aim);
      pose.rightElbowX = THREE.MathUtils.lerp(pose.rightElbowX, -0.20, aim);
      pose.leftShoulderX = THREE.MathUtils.lerp(pose.leftShoulderX, -1.18, aim);
      pose.leftShoulderY = THREE.MathUtils.lerp(pose.leftShoulderY, 0.24, aim);
      pose.leftElbowX = THREE.MathUtils.lerp(pose.leftElbowX, -0.52, aim);
      pose.leftShoulderZ = THREE.MathUtils.lerp(pose.leftShoulderZ, -0.20, aim);
      pose.rightShoulderZ = THREE.MathUtils.lerp(pose.rightShoulderZ, 0.10, aim);
    }

    jc.rotation.x = damp(jc.rotation.x, pose.rootPitch, 10, dt);
    rig.torso.rotation.x = damp(rig.torso.rotation.x, pose.torsoX, 15, dt);
    rig.torso.rotation.z = damp(rig.torso.rotation.z, pose.torsoZ, 15, dt);
    rig.torso.position.y = damp(rig.torso.position.y, rig.base.torsoY + pose.torsoY, 18, dt);
    rig.head.rotation.x = damp(rig.head.rotation.x, pose.headX, 13, dt);
    rig.head.position.y = damp(rig.head.position.y, rig.base.headY + pose.torsoY * 0.65, 18, dt);
    if (rig.chest) rig.chest.position.y = damp(rig.chest.position.y, rig.base.chestY + pose.torsoY * 0.78, 18, dt);

    setJointRotation(rig.leftLeg, pose.leftLegX, 0, pose.leftLegZ, dt);
    setJointRotation(rig.rightLeg, pose.rightLegX, 0, pose.rightLegZ, dt);
    setJointRotation(rig.leftArm.shoulder, pose.leftShoulderX, pose.leftShoulderY, pose.leftShoulderZ, dt);
    setJointRotation(rig.rightArm.shoulder, pose.rightShoulderX, pose.rightShoulderY, pose.rightShoulderZ, dt);
    setJointRotation(rig.leftArm.elbow, pose.leftElbowX, 0, pose.leftElbowZ, dt);
    setJointRotation(rig.rightArm.elbow, pose.rightElbowX, 0, pose.rightElbowZ, dt);

    rig.pistol.visible = state.weaponBlend > 0.08;
    rig.pistol.rotation.x = damp(rig.pistol.rotation.x, armed ? 0.03 : -0.45, 14, dt);
  }

  function updateCharacter(scene, dt, now) {
    if (!state.jc) {
      state.jc = findJc(scene);
      if (state.jc) {
        state.rig = buildRig(state.jc);
        state.previousPosition.copy(state.jc.position);
        state.previousY = state.jc.position.y;
        state.ready = Boolean(state.rig);
      }
    }
    if (!state.flightSprite) state.flightSprite = findFlightSprite(scene);
    if (!state.jc || !state.rig) return;

    const mode = gearMode();
    const jc = state.jc;

    if (mode === "fly") {
      jc.visible = true;
      if (state.flightSprite) state.flightSprite.visible = false;
      state.verticalVelocity = 0;
    }

    if (mode === "foot") {
      const climbing = state.inputs.has("KeyX");
      if (climbing) {
        state.verticalVelocity = 0;
        jc.position.y = clamp(jc.position.y + 5.2 * dt, 0, 26);
      } else if (jc.position.y > 0.001 || state.verticalVelocity !== 0) {
        state.verticalVelocity -= 29.5 * dt;
        jc.position.y += state.verticalVelocity * dt;
        if (jc.position.y <= 0) {
          if (state.previousY > 0.18 || state.verticalVelocity < -4) state.landTimer = 0.28;
          jc.position.y = 0;
          state.verticalVelocity = 0;
        }
      }
    } else if (mode === "car") {
      jc.rotation.x = damp(jc.rotation.x, 0, 12, dt);
    }

    state.weaponBlend = damp(state.weaponBlend, state.gunDrawn && mode !== "car" ? 1 : 0, 9.5, dt);
    state.fightTimer = Math.max(0, state.fightTimer - dt);
    state.recoilTimer = Math.max(0, state.recoilTimer - dt);
    state.landTimer = Math.max(0, state.landTimer - dt);

    const velocity = jc.position.clone().sub(state.previousPosition).multiplyScalar(1 / Math.max(dt, 0.001));
    if (mode === "foot" && state.verticalVelocity !== 0) velocity.y = state.verticalVelocity;
    applyPose(mode, velocity, dt, now);

    state.previousPosition.copy(jc.position);
    state.previousY = jc.position.y;
    state.previousMode = mode;
  }

  const rendererProto = THREE.WebGLRenderer.prototype;
  if (!rendererProto.__jcNaturalMotionPatched) {
    const originalRender = rendererProto.render;
    Object.defineProperty(rendererProto, "__jcNaturalMotionPatched", { value: true });
    rendererProto.render = function renderWithNaturalMotion(scene, camera) {
      const now = performance.now();
      const dt = clamp((now - state.lastTime) / 1000, 0.001, 0.05);
      state.lastTime = now;
      updateCharacter(scene, dt, now);
      return originalRender.call(this, scene, camera);
    };
  }

  function installHudHints() {
    const help = document.querySelector(".help");
    if (help) {
      help.innerHTML = "DRIVE W/S • STEER A/D • SHIFT HANDBRAKE<br>ON FOOT: SPACE JUMP • X CLIMB • R FIGHT • G DRAW • F FLY<br>E ENTER/EXIT • CLICK FIRE • Q DASH • T TIME • M MAP";
    }
    const menuGrid = document.querySelector(".menu-grid");
    if (menuGrid && !menuGrid.querySelector("[data-natural-motion-help]")) {
      const extra = document.createElement("span");
      extra.dataset.naturalMotionHelp = "true";
      extra.textContent = "On foot: Space jump • X climb • R fight • G draw";
      menuGrid.appendChild(extra);
    }
  }

  function installMobileActions() {
    if (document.getElementById("motionActions")) return;
    const mobile = document.getElementById("mobile");
    if (!mobile) return;

    const style = document.createElement("style");
    style.textContent = `
      #motionActions{position:absolute;right:18px;bottom:145px;display:grid;grid-template-columns:56px 56px;gap:5px;pointer-events:auto}
      #motionActions button{height:38px;padding:0;clip-path:none;border-radius:7px;background:rgba(15,18,24,.8);border:1px solid rgba(255,255,255,.25);color:#fff;font:900 10px Impact;letter-spacing:.05em;touch-action:none}
      #motionActions .gun{border-color:rgba(255,212,90,.7);color:#ffe98f}
      @media(min-width:761px) and (pointer:fine){#motionActions{display:none}}
    `;
    document.head.appendChild(style);

    const box = document.createElement("div");
    box.id = "motionActions";
    box.innerHTML = '<button data-motion="jump">JUMP</button><button data-motion="fight">FIGHT</button><button class="gun" data-motion="gun">GUN</button><button data-motion="climb">CLIMB</button>';
    mobile.appendChild(box);

    box.querySelector('[data-motion="jump"]').addEventListener("pointerdown", (event) => { event.preventDefault(); beginJump(); });
    box.querySelector('[data-motion="fight"]').addEventListener("pointerdown", (event) => { event.preventDefault(); beginFight(); });
    box.querySelector('[data-motion="gun"]').addEventListener("pointerdown", (event) => { event.preventDefault(); toggleGun(); });
    const climb = box.querySelector('[data-motion="climb"]');
    climb.addEventListener("pointerdown", (event) => { event.preventDefault(); state.inputs.add("KeyX"); });
    ["pointerup", "pointercancel", "pointerleave"].forEach((type) => climb.addEventListener(type, () => state.inputs.delete("KeyX")));
  }

  installHudHints();
  installMobileActions();
}
