import * as THREE from "three";
import { EffectComposer } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/environments/RoomEnvironment.js";

const CINEMATIC_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    sharpen: { value: 0.11 },
    vignette: { value: 0.16 },
    saturation: { value: 1.08 },
    contrast: { value: 1.055 },
    warmth: { value: 0.035 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float sharpen;
    uniform float vignette;
    uniform float saturation;
    uniform float contrast;
    uniform float warmth;
    varying vec2 vUv;
    vec3 sat(vec3 c,float s){float l=dot(c,vec3(.2126,.7152,.0722));return mix(vec3(l),c,s);}
    void main(){
      vec2 px=1.0/max(resolution,vec2(1.0));
      vec3 c=texture2D(tDiffuse,vUv).rgb;
      vec3 n=texture2D(tDiffuse,vUv+vec2(0.0,px.y)).rgb;
      vec3 s=texture2D(tDiffuse,vUv-vec2(0.0,px.y)).rgb;
      vec3 e=texture2D(tDiffuse,vUv+vec2(px.x,0.0)).rgb;
      vec3 w=texture2D(tDiffuse,vUv-vec2(px.x,0.0)).rgb;
      c += (c*4.0-n-s-e-w)*sharpen;
      c=(c-.5)*contrast+.5;
      c=sat(c,saturation);
      c.r+=warmth*.65; c.g+=warmth*.22; c.b-=warmth*.32;
      vec2 q=vUv-.5; float vig=smoothstep(.82,.18,dot(q,q)*1.82);
      c*=mix(1.0,vig,vignette);
      gl_FragColor=vec4(max(c,0.0),1.0);
    }
  `,
};

export const QUALITY_PRESETS = {
  mobile: { pixelRatio: 1.0, shadow: 1024, bloom: false, bloomStrength: 0.18, bloomRadius: 0.28, bloomThreshold: 0.82, maxLights: 12, crowd: 14, traffic: 8, foliage: 0.45, drawDistance: 2200 },
  medium: { pixelRatio: 1.25, shadow: 1024, bloom: true, bloomStrength: 0.22, bloomRadius: 0.32, bloomThreshold: 0.80, maxLights: 20, crowd: 22, traffic: 12, foliage: 0.65, drawDistance: 3200 },
  high: { pixelRatio: 1.65, shadow: 2048, bloom: true, bloomStrength: 0.29, bloomRadius: 0.36, bloomThreshold: 0.76, maxLights: 30, crowd: 34, traffic: 18, foliage: 0.85, drawDistance: 4500 },
  ultra: { pixelRatio: 2.0, shadow: 4096, bloom: true, bloomStrength: 0.34, bloomRadius: 0.40, bloomThreshold: 0.73, maxLights: 42, crowd: 48, traffic: 26, foliage: 1.0, drawDistance: 6200 },
};

function deviceTier() {
  const coarse = matchMedia("(pointer:coarse)").matches;
  const memory = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 8;
  if (coarse || memory <= 4 || cores <= 4) return "mobile";
  if (memory >= 12 && cores >= 10 && devicePixelRatio <= 2.25) return "ultra";
  if (memory >= 8 && cores >= 6) return "high";
  return "medium";
}

export class QualityPipeline {
  constructor({ scene, camera, mount, quality = "auto" }) {
    this.scene = scene;
    this.camera = camera;
    this.mount = mount;
    this.name = quality === "auto" ? deviceTier() : (QUALITY_PRESETS[quality] ? quality : "high");
    this.settings = QUALITY_PRESETS[this.name];
    this.renderer = new THREE.WebGLRenderer({ antialias: this.name !== "mobile", powerPreference: "high-performance", alpha: false, stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.03;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x91a9b7, 1);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.settings.pixelRatio));
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.renderer.domElement.id = "game-canvas";
    this.mount.appendChild(this.renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    try {
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environmentIntensity = 0.72;
    } finally {
      pmrem.dispose();
    }

    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), this.settings.bloomStrength, this.settings.bloomRadius, this.settings.bloomThreshold);
    this.bloomPass.enabled = this.settings.bloom;
    this.composer.addPass(this.bloomPass);

    this.cinematicPass = new ShaderPass(CINEMATIC_SHADER);
    this.cinematicPass.uniforms.resolution.value.set(innerWidth * this.renderer.getPixelRatio(), innerHeight * this.renderer.getPixelRatio());
    if (this.name === "mobile") {
      this.cinematicPass.uniforms.sharpen.value = 0.06;
      this.cinematicPass.uniforms.vignette.value = 0.11;
    }
    this.composer.addPass(this.cinematicPass);
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    this.gpuFrame = 0;
    this.lastAutoTune = performance.now();
    this.lowFpsSeconds = 0;
    this.highFpsSeconds = 0;
  }

  setExposure(value) { this.renderer.toneMappingExposure = value; }
  setWarmth(value) { this.cinematicPass.uniforms.warmth.value = value; }
  setBloom(strength, threshold = this.settings.bloomThreshold) {
    this.bloomPass.strength = strength;
    this.bloomPass.threshold = threshold;
  }

  resize(width = innerWidth, height = innerHeight) {
    const ratio = Math.min(devicePixelRatio, this.settings.pixelRatio);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.cinematicPass.uniforms.resolution.value.set(width * ratio, height * ratio);
  }

  render() { this.composer.render(); }

  autoTune(fps, dt) {
    if (this.name === "mobile") return;
    if (fps < 42) this.lowFpsSeconds += dt; else this.lowFpsSeconds = Math.max(0, this.lowFpsSeconds - dt * 2);
    if (fps > 58) this.highFpsSeconds += dt; else this.highFpsSeconds = Math.max(0, this.highFpsSeconds - dt);
    const now = performance.now();
    if (now - this.lastAutoTune < 2500) return;
    this.lastAutoTune = now;
    if (this.lowFpsSeconds > 3.2) {
      const current = this.renderer.getPixelRatio();
      const next = Math.max(1, current - 0.15);
      if (next < current - 0.01) {
        this.renderer.setPixelRatio(next);
        this.composer.setPixelRatio(next);
        this.cinematicPass.uniforms.resolution.value.set(innerWidth * next, innerHeight * next);
      }
      this.lowFpsSeconds = 0;
    } else if (this.highFpsSeconds > 8) {
      const target = Math.min(devicePixelRatio, this.settings.pixelRatio);
      const current = this.renderer.getPixelRatio();
      const next = Math.min(target, current + 0.1);
      if (next > current + 0.01) {
        this.renderer.setPixelRatio(next);
        this.composer.setPixelRatio(next);
        this.cinematicPass.uniforms.resolution.value.set(innerWidth * next, innerHeight * next);
      }
      this.highFpsSeconds = 0;
    }
  }
}

export function configureSunShadow(sun, pipeline, distance = 260) {
  const size = pipeline.settings.shadow;
  sun.castShadow = true;
  sun.shadow.mapSize.set(size, size);
  sun.shadow.bias = -0.00018;
  sun.shadow.normalBias = 0.035;
  sun.shadow.camera.left = -distance;
  sun.shadow.camera.right = distance;
  sun.shadow.camera.top = distance;
  sun.shadow.camera.bottom = -distance;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 1800;
}
