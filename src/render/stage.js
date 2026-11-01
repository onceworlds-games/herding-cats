// The renderer, the light and the camera: a miniature cutaway apartment seen through a long lens from the south-east,
// late sun pouring in through the back windows, then bloom, a tilt-shift blur, a warm grade and a vignette.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export const YAW = Math.PI / 4; // the camera sits south-east of the room, looking north-west
export const PITCH = (52 * Math.PI) / 180;
export const FOV = 30;
// the sun: low in the north-west, so it comes in through the back windows and lays bright patches toward the camera
export const SUN_DIR = new THREE.Vector3(0.62, -0.5, 0.6).normalize(); // the way the light travels

const FinishShader = {
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uTilt: { value: 1 },
    uFocus: { value: 0.52 },
    uVignette: { value: 0.32 },
    uWarm: { value: 1 },
    uTime: { value: 0 },
    uFlash: { value: 0 },
    uSat: { value: 1.08 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uTilt, uFocus, uVignette, uWarm, uTime, uFlash, uSat;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      // tilt-shift: sharp across the middle band, softer toward the top and bottom
      float d = abs(uv.y - uFocus);
      float blur = uTilt * smoothstep(0.22, 0.5, d) * 2.4;
      vec4 c = texture2D(tDiffuse, uv);
      if (blur > 0.05) {
        vec2 px = blur / uRes;
        vec4 acc = c;
        float wsum = 1.0;
        for (int i = 0; i < 12; i++) {
          float a = float(i) * 2.39996;
          float r = sqrt(float(i) + 0.5) / 3.5;
          vec2 o = vec2(cos(a), sin(a)) * r * px * 2.2;
          acc += texture2D(tDiffuse, uv + o);
          wsum += 1.0;
        }
        c = acc / wsum;
      }
      vec3 col = c.rgb;
      // warm grade: lift the shadows toward plum, warm the highlights, a touch more saturation
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSat);
      col += vec3(0.022, 0.006, 0.018) * (1.0 - smoothstep(0.0, 0.35, l)) * uWarm;
      col *= mix(vec3(1.0), vec3(1.045, 1.0, 0.94), smoothstep(0.35, 1.0, l) * uWarm);
      // vignette
      vec2 q = uv - 0.5;
      q.x *= uRes.x / uRes.y;
      col *= 1.0 - uVignette * smoothstep(0.35, 1.05, length(q));
      // grain
      col += (hash(uv * uRes + uTime * 61.0) - 0.5) * 0.012;
      col = mix(col, vec3(1.0, 0.97, 0.9), uFlash);
      gl_FragColor = vec4(col, c.a);
    }`,
};

export function createStage(canvas, { poster = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: !!poster, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const backdrop = new THREE.Color('#2a1c19');
  scene.background = backdrop;

  // fill: warm sky bounce from above, the room's own colour from below
  const hemi = new THREE.HemisphereLight('#ffe9cf', '#6b4a3a', 1.25);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight('#ffdcc0', 0.25);
  scene.add(ambient);
  // the sun: strong, warm, shadowed by the walls and an invisible ceiling, so it only lands through the windows
  const sun = new THREE.DirectionalLight('#ffcf8f', 5.2);
  sun.castShadow = true;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 4;
  sun.shadow.blurSamples = 12;
  scene.add(sun, sun.target);
  // a soft key from the camera's side (no shadows): gives cats and people their shape in the shade
  const key = new THREE.DirectionalLight('#fff0e0', 0.95);
  scene.add(key, key.target);

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 200);
  const dir = new THREE.Vector3(Math.cos(PITCH) * Math.sin(YAW), Math.sin(PITCH), Math.cos(PITCH) * Math.cos(YAW));

  const st = {
    renderer, scene, camera, sun, hemi, key, ambient, backdrop,
    w: 1, h: 1, dpr: 1, quality: 'medium',
    target: new THREE.Vector3(), span: 14, // world units across the short side, at the target
    goalTarget: new THREE.Vector3(), goalSpan: 14,
    trauma: 0, shakeT: 0, reducedMotion: false, punchK: 0, flash: 0, time: 0,
    bounds: { w: 16, d: 14 },
    composer: null, finish: null, bloom: null,
  };

  const tmp = new THREE.Vector3();

  function buildComposer() {
    if (st.composer) { st.composer.dispose(); st.composer = null; }
    if (st.quality === 'low') return;
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: st.quality === 'high' ? 4 : 0 });
    const c = new EffectComposer(renderer, rt);
    c.addPass(new RenderPass(scene, camera));
    st.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.55, 0.92);
    c.addPass(st.bloom);
    st.finish = new ShaderPass(FinishShader);
    st.finish.uniforms.uTilt.value = st.quality === 'high' ? 1 : 0;
    c.addPass(st.finish);
    c.addPass(new OutputPass());
    st.composer = c;
  }

  st.setQuality = (q, pixelRatio) => {
    st.quality = q;
    st.dpr = pixelRatio;
    renderer.setPixelRatio(pixelRatio);
    const size = q === 'high' ? 2048 : q === 'medium' ? 1024 : 0;
    renderer.shadowMap.enabled = size > 0;
    sun.castShadow = size > 0;
    renderer.shadowMap.type = q === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    if (size) {
      sun.shadow.mapSize.set(size, size);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    applyLight();
    buildComposer();
    st.resize(st.w, st.h);
  };

  // indoors the sun only lands through the windows, so it can be strong; outdoors it lands everywhere
  function applyLight() {
    const shadows = sun.castShadow;
    if (st.outdoor) {
      sun.intensity = shadows ? 3.4 : 2.0;
      hemi.intensity = 1.15;
      key.intensity = 0.55;
    } else {
      // without shadows the sun would light the whole room: keep it gentle then
      sun.intensity = shadows ? 10 : 1.1;
      hemi.intensity = shadows ? 1.0 : 1.45;
      key.intensity = shadows ? 0.8 : 0.95;
    }
  }
  st.outdoor = false;
  st.setOutdoor = (on) => { st.outdoor = !!on; applyLight(); };

  st.resize = (w, h) => {
    st.w = Math.max(1, w);
    st.h = Math.max(1, h);
    renderer.setSize(st.w, st.h, false);
    if (st.composer) {
      st.composer.setPixelRatio(st.dpr);
      st.composer.setSize(st.w, st.h);
      st.finish.uniforms.uRes.value.set(st.w * st.dpr, st.h * st.dpr);
      st.bloom.resolution.set(st.w / 2, st.h / 2);
    }
    applyCamera();
  };

  /** The room the light is framed for. */
  st.setRoom = (w, d) => {
    st.bounds = { w, d };
    const cx = w / 2, cz = d / 2;
    const r = Math.hypot(w, d) / 2 + 3;
    sun.position.set(cx, 1.2, cz).addScaledVector(SUN_DIR, -30);
    sun.target.position.set(cx, 1.2, cz);
    const sc = sun.shadow.camera;
    sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r;
    sc.near = 5; sc.far = 60;
    sc.updateProjectionMatrix();
    key.position.set(cx + 10, 14, cz + 12);
    key.target.position.set(cx, 0, cz);
  };

  /** Span (units across the short side) that shows the whole room. */
  st.fitSpan = () => fitSpan(st.bounds.w, st.bounds.d, st.w / st.h);

  /**
   * Frames the room: whole (follow = 0), or about `follow` units round `focus`, leaning toward `lean` (the carrier,
   * the next cat) and ahead of where the focus is going (`ahead` {x, z}).
   */
  st.frame = (focus, { follow = 0, snap = false, zoom = 1, lean = null, ahead = null } = {}) => {
    const { w, d } = st.bounds;
    const fit = fitSpan(w, d, st.w / st.h) * zoom;
    let span = fit;
    const center = new THREE.Vector3(w / 2, 0, d / 2);
    if (follow && focus && fit > follow * zoom) {
      span = follow * zoom;
      let fx = focus.x, fz = focus.z;
      if (ahead) { fx += ahead.x; fz += ahead.z; }
      if (lean) { fx += (lean.x - fx) * 0.22; fz += (lean.z - fz) * 0.22; }
      // the back walls stay in view; past the open front edges, never much void
      const m0 = span * 0.3, m1 = span * 0.46;
      center.set(clamp(fx, Math.min(w / 2, m0), Math.max(w / 2, w - m1)), 0, clamp(fz, Math.min(d / 2, m0), Math.max(d / 2, d - m1)));
    } else if (focus) {
      center.set(lerp(w / 2, focus.x, 0.12), 0, lerp(d / 2, focus.z, 0.12));
    }
    st.goalTarget.copy(center);
    st.goalSpan = span;
    if (snap) {
      st.target.copy(center);
      st.span = span;
    }
  };

  /** Put the camera exactly here (posters, set pieces): looking at (x, z) with `span` units across the short side. */
  st.look = (x, z, span, y = 0) => {
    st.goalTarget.set(x, y, z);
    st.target.set(x, y, z);
    st.goalSpan = span;
    st.span = span;
    applyCamera();
  };

  st.shake = (amount) => {
    if (st.reducedMotion) return;
    st.trauma = Math.min(1, st.trauma + amount);
  };
  /** A quick lean in (a combo, the last cat). */
  st.punch = (amount = 0.1) => {
    if (st.reducedMotion) return;
    st.punchK = Math.min(0.3, st.punchK + amount);
  };
  st.flashScreen = (a = 0.25) => { if (!st.reducedMotion) st.flash = Math.max(st.flash, a); };

  st.update = (dt) => {
    const k = 1 - Math.exp(-dt * 3.4);
    st.target.lerp(st.goalTarget, k);
    st.span += (st.goalSpan - st.span) * k;
    st.trauma = Math.max(0, st.trauma - dt * 1.7);
    st.punchK = Math.max(0, st.punchK - dt * 0.9);
    st.flash = Math.max(0, st.flash - dt * 3);
    st.shakeT += dt;
    st.time += dt;
    applyCamera();
  };

  function applyCamera() {
    const aspect = st.w / st.h;
    camera.aspect = aspect;
    // distance so `span` units fit across the short side
    const half = (st.span * (1 - st.punchK)) / 2;
    const tanV = Math.tan((FOV * Math.PI) / 360);
    const dist = aspect >= 1 ? half / tanV : half / (tanV * aspect);
    st.dist = dist;
    tmp.copy(dir).multiplyScalar(dist).add(st.target);
    camera.position.copy(tmp);
    camera.lookAt(st.target);
    if (st.trauma > 0) {
      const s = st.trauma * st.trauma * 0.025;
      const t = st.shakeT * 31;
      camera.rotateX(Math.sin(t * 1.3) * s);
      camera.rotateY(Math.sin(t * 1.7 + 1) * s);
      camera.rotateZ(Math.sin(t * 1.1 + 2) * s * 0.6);
    }
    camera.near = Math.max(0.3, dist * 0.2);
    camera.far = dist * 4 + 40;
    camera.updateProjectionMatrix();
  }

  /** World point → CSS pixels on the canvas. */
  const proj = new THREE.Vector3();
  st.toScreen = (x, y, z, out = { x: 0, y: 0 }) => {
    proj.set(x, y, z).project(camera);
    out.x = (proj.x * 0.5 + 0.5) * st.w;
    out.y = (-proj.y * 0.5 + 0.5) * st.h;
    out.behind = proj.z > 1;
    return out;
  };
  /** CSS pixel → the floor point under it. */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  st.toFloor = (px, py, out = new THREE.Vector3()) => {
    ndc.set((px / st.w) * 2 - 1, -(py / st.h) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(floorPlane, out);
  };

  st.render = () => {
    if (st.composer) {
      st.finish.uniforms.uTime.value = st.time;
      st.finish.uniforms.uFlash.value = st.flash;
      st.composer.render();
    } else renderer.render(scene, camera);
  };
  return st;
}

/** World units across the short side of the screen that show a w × d room whole, at our angle. */
function fitSpan(w, d, aspect) {
  const c = Math.cos(YAW);
  const s = Math.sin(YAW);
  const sp = Math.sin(PITCH);
  const pts = [[0, 0], [w, 0], [0, d], [w, d]];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, z] of pts) {
    const rx = x * c - z * s;
    const ry = -(x * s + z * c) * sp;
    minX = Math.min(minX, rx); maxX = Math.max(maxX, rx);
    minY = Math.min(minY, ry); maxY = Math.max(maxY, ry);
  }
  maxY += 2.0 * Math.cos(PITCH);
  const width = (maxX - minX) * 1.08;
  const height = (maxY - minY) * 1.12;
  if (aspect >= 1) return Math.max(height, width / aspect);
  return Math.max(width, height * aspect);
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

/** Screen-relative stick → world direction (up the screen is north-west). */
export function screenToWorld(sx, sy) {
  const r = Math.SQRT1_2;
  return { x: (sx + sy) * r, z: (-sx + sy) * r };
}
