// The renderer, the light and the camera: a miniature cutaway room lit by afternoon sun, seen from the south-east.

import * as THREE from 'three';

const YAW = Math.PI / 4; // camera sits south-east of the room, looking north-west
const PITCH = (40 * Math.PI) / 180;

export function createStage(canvas, { poster = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: poster, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const backdrop = new THREE.Color('#3a2724');
  scene.background = backdrop;
  scene.fog = new THREE.Fog(backdrop, 60, 140);

  const hemi = new THREE.HemisphereLight('#fff1d6', '#7a5a44', 1.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe2b0', 2.6);
  sun.castShadow = true;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight('#bcd3ff', 0.35);
  fill.position.set(30, 12, 40);
  scene.add(fill);

  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
  const dir = new THREE.Vector3(Math.cos(PITCH) * Math.sin(YAW), Math.sin(PITCH), Math.cos(PITCH) * Math.cos(YAW));

  const st = {
    renderer, scene, camera, sun, hemi, backdrop,
    w: 1, h: 1, dpr: 1, quality: 'medium',
    target: new THREE.Vector3(), span: 14, // world units shown across the short side
    goalTarget: new THREE.Vector3(), goalSpan: 14,
    trauma: 0, shakeT: 0, reducedMotion: false,
    bounds: { w: 16, d: 14 },
  };

  const tmp = new THREE.Vector3();

  st.setQuality = (q, pixelRatio) => {
    st.quality = q;
    st.dpr = pixelRatio;
    renderer.setPixelRatio(pixelRatio);
    const size = q === 'high' ? 2048 : q === 'medium' ? 1024 : 0;
    renderer.shadowMap.enabled = size > 0;
    sun.castShadow = size > 0;
    if (size) {
      sun.shadow.mapSize.set(size, size);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    st.resize(st.w, st.h);
  };

  st.resize = (w, h) => {
    st.w = Math.max(1, w);
    st.h = Math.max(1, h);
    renderer.setSize(st.w, st.h, false);
    applyCamera();
  };

  /** The room the light and the camera are framed for. */
  st.setRoom = (w, d) => {
    st.bounds = { w, d };
    const cx = w / 2;
    const cz = d / 2;
    const r = Math.hypot(w, d) / 2 + 2;
    sun.position.set(cx + 7, 24, cz + 15); // from the front, high: both back walls catch it, shadows fall up the screen
    sun.target.position.set(cx, 0, cz);
    const sc = sun.shadow.camera;
    sc.left = -r;
    sc.right = r;
    sc.top = r;
    sc.bottom = -r;
    sc.near = 1;
    sc.far = 80;
    sc.updateProjectionMatrix();
  };

  /** How much of the room to show: the whole of it, or (big rooms, small screens) about `follow` units round `focus`. */
  st.frame = (focus, { follow = 0, snap = false, zoom = 1 } = {}) => {
    const { w, d } = st.bounds;
    const fit = fitSpan(w, d, st.w / st.h) * zoom;
    let span = fit;
    const center = new THREE.Vector3(w / 2, 0, d / 2);
    if (follow && fit > follow) {
      span = follow;
      // keep the view inside the room as far as it can be
      const t = clamp01((fit - follow) / Math.max(1, fit));
      center.set(lerp(w / 2, focus.x, 0.35 + t * 0.6), 0, lerp(d / 2, focus.z, 0.35 + t * 0.6));
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
  st.look = (x, z, span) => {
    st.goalTarget.set(x, 0, z);
    st.target.set(x, 0, z);
    st.goalSpan = span;
    st.span = span;
    applyCamera();
  };

  st.shake = (amount) => {
    if (st.reducedMotion) return;
    st.trauma = Math.min(1, st.trauma + amount);
  };

  st.update = (dt) => {
    const k = 1 - Math.exp(-dt * 3.2);
    st.target.lerp(st.goalTarget, k);
    st.span += (st.goalSpan - st.span) * k;
    st.trauma = Math.max(0, st.trauma - dt * 1.6);
    st.shakeT += dt;
    applyCamera();
  };

  function applyCamera() {
    const aspect = st.w / st.h;
    const half = st.span / 2;
    const hw = aspect >= 1 ? half * aspect : half;
    const hh = aspect >= 1 ? half : half / aspect;
    camera.left = -hw;
    camera.right = hw;
    camera.top = hh;
    camera.bottom = -hh;
    camera.updateProjectionMatrix();
    tmp.copy(dir).multiplyScalar(80).add(st.target);
    camera.position.copy(tmp);
    if (st.trauma > 0) {
      const s = st.trauma * st.trauma * 0.35;
      const t = st.shakeT * 31;
      camera.position.x += Math.sin(t * 1.3) * s;
      camera.position.y += Math.sin(t * 1.7 + 1) * s * 0.6;
      camera.position.z += Math.sin(t * 1.1 + 2) * s;
    }
    camera.lookAt(st.target.x + (camera.position.x - tmp.x), (camera.position.y - tmp.y), st.target.z + (camera.position.z - tmp.z));
  }

  /** World point → CSS pixels on the canvas. */
  const proj = new THREE.Vector3();
  st.toScreen = (x, y, z, out = { x: 0, y: 0 }) => {
    proj.set(x, y, z).project(camera);
    out.x = (proj.x * 0.5 + 0.5) * st.w;
    out.y = (-proj.y * 0.5 + 0.5) * st.h;
    return out;
  };

  st.render = () => renderer.render(scene, camera);
  return st;
}

/** World units across the short side of the screen that show a w × d room whole (ortho, our angle). */
function fitSpan(w, d, aspect) {
  // the room's footprint corners in camera space
  const c = Math.cos(YAW);
  const s = Math.sin(YAW);
  const sp = Math.sin(PITCH);
  const pts = [[0, 0], [w, 0], [0, d], [w, d]];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, z] of pts) {
    const rx = x * c - z * s; // screen right
    const ry = -(x * s + z * c) * sp; // screen up (depth tilts)
    minX = Math.min(minX, rx);
    maxX = Math.max(maxX, rx);
    minY = Math.min(minY, ry);
    maxY = Math.max(maxY, ry);
  }
  // walls stand 2.6 u on the far edges
  maxY += 2.6 * Math.cos(PITCH);
  const width = (maxX - minX) * 1.08;
  const height = (maxY - minY) * 1.12;
  // span = the short side
  if (aspect >= 1) return Math.max(height, width / aspect);
  return Math.max(width, height * aspect);
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;

/** Screen-relative stick → world direction (up the screen is north-west). */
export function screenToWorld(sx, sy) {
  const r = Math.SQRT1_2;
  return { x: (sx + sy) * r, z: (-sx + sy) * r };
}
