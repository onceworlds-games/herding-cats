// Effects in the world: the treat ring (gold dots out to its reach), the clap shockwave, and particles drawn from one
// sprite sheet (soft puffs, fur tufts, sparks, stars, hearts, shards, confetti, crumbs), two clouds: one blended, one
// glowing. Gold footprints for the first hint. All pooled; nothing allocated per frame.

import * as THREE from 'three';
import { TREATS, CLAP } from '../sim/tuning.js';

const MAXP = 700;
// sprite sheet cells (4 × 4)
export const SHAPE = { puff: 0, dot: 1, star: 2, heart: 3, tuft: 4, spark: 5, ring: 6, shard: 7, paw: 8, square: 9, streak: 10, crumb: 11, note: 12, fish: 13, flower: 14, drop: 15 };

function sheetTexture() {
  const S = 512, C = S / 4;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const cell = (i, draw) => {
    g.save();
    g.translate((i % 4) * C + C / 2, Math.floor(i / 4) * C + C / 2);
    draw(C / 2 - 4);
    g.restore();
  };
  g.fillStyle = '#fff';
  g.strokeStyle = '#fff';
  // puff: a soft round cloud
  cell(SHAPE.puff, (r) => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
  });
  cell(SHAPE.dot, (r) => { g.beginPath(); g.arc(0, 0, r * 0.8, 0, Math.PI * 2); g.fill(); });
  cell(SHAPE.star, (r) => {
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.42 : r * 0.95; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.closePath(); g.fill();
  });
  cell(SHAPE.heart, (r) => {
    g.beginPath();
    g.moveTo(0, r * 0.85);
    g.bezierCurveTo(-r * 1.1, r * 0.05, -r * 0.6, -r * 0.85, 0, -r * 0.3);
    g.bezierCurveTo(r * 0.6, -r * 0.85, r * 1.1, r * 0.05, 0, r * 0.85);
    g.fill();
  });
  // tuft: a wisp of fur, a few curved strands
  cell(SHAPE.tuft, (r) => {
    g.lineCap = 'round';
    for (let i = -2; i <= 2; i++) {
      g.lineWidth = 7 - Math.abs(i) * 1.5;
      g.beginPath();
      g.moveTo(i * 4, r * 0.7);
      g.quadraticCurveTo(i * 10 + 8, 0, i * 6 + 14, -r * 0.8);
      g.stroke();
    }
  });
  // spark: a four-point twinkle with a glow
  cell(SHAPE.spark, (r) => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; const rr = i % 2 ? r * 0.12 : r * 0.95; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.closePath(); g.fill();
  });
  cell(SHAPE.ring, (r) => { g.lineWidth = 8; g.beginPath(); g.arc(0, 0, r * 0.8, 0, Math.PI * 2); g.stroke(); });
  cell(SHAPE.shard, (r) => { g.beginPath(); g.moveTo(-r * 0.5, r * 0.6); g.lineTo(r * 0.7, r * 0.2); g.lineTo(-r * 0.1, -r * 0.8); g.closePath(); g.fill(); });
  cell(SHAPE.paw, (r) => {
    g.beginPath(); g.ellipse(0, r * 0.25, r * 0.42, r * 0.36, 0, 0, Math.PI * 2); g.fill();
    for (const [x, y] of [[-0.5, -0.3], [-0.18, -0.6], [0.18, -0.6], [0.5, -0.3]]) { g.beginPath(); g.ellipse(x * r, y * r, r * 0.16, r * 0.2, 0, 0, Math.PI * 2); g.fill(); }
  });
  cell(SHAPE.square, (r) => { g.fillRect(-r * 0.45, -r * 0.7, r * 0.9, r * 1.4); });
  cell(SHAPE.streak, (r) => {
    const gr = g.createLinearGradient(0, -r, 0, r);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(-r * 0.12, -r, r * 0.24, r * 2);
  });
  cell(SHAPE.crumb, (r) => { g.beginPath(); g.moveTo(-r * 0.5, -r * 0.2); g.lineTo(r * 0.2, -r * 0.55); g.lineTo(r * 0.55, r * 0.15); g.lineTo(-r * 0.1, r * 0.5); g.closePath(); g.fill(); });
  // a quaver: head, stem, flag
  cell(SHAPE.note, (r) => {
    g.beginPath(); g.ellipse(-r * 0.22, r * 0.5, r * 0.3, r * 0.22, -0.4, 0, Math.PI * 2); g.fill();
    g.fillRect(r * 0.0, -r * 0.8, r * 0.13, r * 1.3);
    g.beginPath(); g.moveTo(r * 0.1, -r * 0.8); g.quadraticCurveTo(r * 0.75, -r * 0.45, r * 0.45, r * 0.05); g.quadraticCurveTo(r * 0.5, -r * 0.4, r * 0.1, -r * 0.45); g.fill();
  });
  // a fish: body, tail, an eye cut out
  cell(SHAPE.fish, (r) => {
    g.beginPath(); g.ellipse(-r * 0.12, 0, r * 0.58, r * 0.34, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(r * 0.36, 0); g.lineTo(r * 0.9, -r * 0.38); g.lineTo(r * 0.9, r * 0.38); g.closePath(); g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.arc(-r * 0.42, -r * 0.06, r * 0.08, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'source-over';
  });
  // a daisy: five round petals round a hole
  cell(SHAPE.flower, (r) => {
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; g.beginPath(); g.arc(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.36, 0, Math.PI * 2); g.fill(); }
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.arc(0, 0, r * 0.2, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'source-over';
  });
  cell(SHAPE.drop, (r) => { g.beginPath(); g.moveTo(0, -r * 0.85); g.bezierCurveTo(r * 0.7, 0, r * 0.55, r * 0.75, 0, r * 0.75); g.bezierCurveTo(-r * 0.55, r * 0.75, -r * 0.7, 0, 0, -r * 0.85); g.fill(); });
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function dotsTexture() {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 512;
  const g = cv.getContext('2d');
  g.fillStyle = '#f6b941';
  const n = 36;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    g.beginPath();
    g.arc(256 + Math.cos(a) * 236, 256 + Math.sin(a) * 236, 11, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function shockTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 60, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.75, 'rgba(255,255,255,0.15)');
  gr.addColorStop(0.92, 'rgba(255,255,255,1)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function footTexture() {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#f6b941';
  for (const [x, y, flip] of [[40, 80, 1], [86, 40, -1]]) {
    g.save();
    g.translate(x, y);
    g.rotate(flip * 0.15);
    g.beginPath();
    g.ellipse(0, 0, 13, 22, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(0, 26, 10, 9, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const VERT = `attribute float size; attribute float shape; attribute float rot; attribute float alpha;
  varying vec3 vColor; varying float vShape; varying float vRot; varying float vAlpha; uniform float scale;
  void main() {
    vColor = color; vShape = shape; vRot = rot; vAlpha = alpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = size * scale * (14.0 / max(1.0, -mv.z));
  }`;
const FRAG = `uniform sampler2D sheet; varying vec3 vColor; varying float vShape; varying float vRot; varying float vAlpha;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float c = cos(vRot), s = sin(vRot);
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
    if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) discard;
    float cx = mod(vShape, 4.0), cy = floor(vShape / 4.0);
    vec4 t = texture2D(sheet, (vec2(cx, cy) + p) / 4.0);
    float a = t.a * vAlpha;
    if (a < 0.02) discard;
    gl_FragColor = vec4(vColor * t.rgb, a);
  }`;

const PRINT_VERT = `attribute vec4 info; varying vec2 vUv; varying vec4 vInfo; varying vec3 vCol; attribute vec3 tint;
  void main() {
    vUv = uv; vInfo = info; vCol = tint;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }`;
const PRINT_FRAG = `uniform sampler2D sheet; varying vec2 vUv; varying vec4 vInfo; varying vec3 vCol;
  void main() {
    float cx = mod(vInfo.x, 4.0), cy = floor(vInfo.x / 4.0);
    vec4 t = texture2D(sheet, (vec2(cx, cy) + vec2(vUv.x, 1.0 - vUv.y)) / 4.0);
    float a = t.a * vInfo.y;
    if (a < 0.02) discard;
    gl_FragColor = vec4(vCol * t.rgb * (1.0 + vInfo.z), a);
  }`;
const MAX_PRINTS = 96;

/** Flat marks left on the floor (a herder's trail): an instanced quad per print, fading out. */
function prints(scene, sheet) {
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const info = new Float32Array(MAX_PRINTS * 4);
  const tint = new Float32Array(MAX_PRINTS * 3);
  geo.setAttribute('info', new THREE.InstancedBufferAttribute(info, 4).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('tint', new THREE.InstancedBufferAttribute(tint, 3).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { sheet: { value: sheet } }, vertexShader: PRINT_VERT, fragmentShader: PRINT_FRAG });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX_PRINTS);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  mesh.count = 0;
  scene.add(mesh);
  const list = [];
  for (let i = 0; i < MAX_PRINTS; i++) list.push({ live: false, t: 0, life: 1, x: 0, z: 0, h: 0, s: 0.2, shape: 0, glow: 0 });
  let cursor = 0;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const c = new THREE.Color();
  return {
    add(x, z, h, shape, color, size, life, glow = 0) {
      const p = list[cursor];
      cursor = (cursor + 1) % MAX_PRINTS;
      Object.assign(p, { live: true, t: 0, life, x, z, h, s: size, shape, glow });
      c.set(color);
      const i = list.indexOf(p);
      tint[i * 3] = c.r; tint[i * 3 + 1] = c.g; tint[i * 3 + 2] = c.b;
      geo.attributes.tint.needsUpdate = true;
    },
    update(dt) {
      let n = 0;
      for (let i = 0; i < MAX_PRINTS; i++) {
        const p = list[i];
        if (p.live) { p.t += dt; if (p.t >= p.life) p.live = false; }
        const k = p.live ? p.t / p.life : 1;
        // a print pops in, then fades
        const grow = p.live ? Math.min(1, p.t * 10) : 0;
        q.setFromAxisAngle(up, -p.h - Math.PI / 2);
        pos.set(p.x, 0.022 + i * 0.00002, p.z);
        sc.setScalar(Math.max(0.0001, p.s * (0.6 + grow * 0.4)));
        m.compose(pos, q, sc);
        mesh.setMatrixAt(i, m);
        info[i * 4] = p.shape;
        info[i * 4 + 1] = p.live ? Math.min(1, (1 - k) * 2.5) * 0.85 : 0;
        info[i * 4 + 2] = p.glow;
        if (p.live) n = i + 1;
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      geo.attributes.info.needsUpdate = true;
    },
    clear() { for (const p of list) p.live = false; mesh.count = 0; },
  };
}

/** One cloud of particles (blended or glowing). */
function cloud(scene, sheet, additive) {
  const pos = new Float32Array(MAXP * 3);
  const col = new Float32Array(MAXP * 3);
  const size = new Float32Array(MAXP);
  const shape = new Float32Array(MAXP);
  const rot = new Float32Array(MAXP);
  const alpha = new Float32Array(MAXP);
  const geo = new THREE.BufferGeometry();
  const dyn = (a, n) => new THREE.BufferAttribute(a, n).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', dyn(pos, 3));
  geo.setAttribute('color', dyn(col, 3));
  geo.setAttribute('size', dyn(size, 1));
  geo.setAttribute('shape', dyn(shape, 1));
  geo.setAttribute('rot', dyn(rot, 1));
  geo.setAttribute('alpha', dyn(alpha, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, vertexColors: true,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { scale: { value: 40 }, sheet: { value: sheet } },
    vertexShader: VERT,
    fragmentShader: FRAG,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = additive ? 8 : 6;
  scene.add(points);
  const parts = [];
  for (let i = 0; i < MAXP; i++) parts.push({ live: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 0, g: 9, drag: 0, spin: 0, rot: 0, grow: 0, fade: 1, bounce: 0.3 });
  return { pos, col, size, shape, rot, alpha, geo, mat, parts, cursor: 0, points };
}

export function createFx(scene) {
  const sheet = sheetTexture();
  const soft = cloud(scene, sheet, false);
  const glow = cloud(scene, sheet, true);
  const marks = prints(scene, sheet);
  const c = new THREE.Color();

  const rings = [];
  const dots = dotsTexture();
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: dots, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    m.renderOrder = 5;
    scene.add(m);
    rings.push({ m, t: 0, life: 0, r: 1 });
  }
  const shock = [];
  const shockTex = shockTexture();
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: shockTex, transparent: true, depthWrite: false, color: '#fff3df' }));
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    m.renderOrder = 5;
    scene.add(m);
    shock.push({ m, t: 0, life: 0, r: 1, y: 0.05 });
  }

  const feet = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: footTexture(), transparent: true, depthWrite: false }));
  feet.rotation.x = -Math.PI / 2;
  feet.position.y = 0.02;
  feet.visible = false;
  scene.add(feet);

  let reduced = false;

  /**
   * n particles from (x, y, z). o: color, shape, speed (outward), up, life, size, gravity, drag, spread (xz), glow,
   * spin, grow (size per second, fraction), dir {x, z} + cone (a directed spray), bounce.
   */
  function emit(x, y, z, n, o = {}) {
    const cl = o.glow ? glow : soft;
    const colors = Array.isArray(o.color) ? o.color : [o.color ?? '#fff3df'];
    if (reduced) n = Math.ceil(n * 0.4);
    for (let k = 0; k < n; k++) {
      const i = cl.cursor;
      const p = cl.parts[i];
      cl.cursor = (cl.cursor + 1) % MAXP;
      let a = Math.random() * Math.PI * 2;
      if (o.dir) a = Math.atan2(o.dir.z, o.dir.x) + (Math.random() - 0.5) * (o.cone ?? 0.8);
      const s = (o.speed ?? 2) * (0.4 + Math.random() * 0.6);
      p.live = true;
      p.x = x + (Math.random() - 0.5) * (o.jitter ?? 0);
      p.y = y;
      p.z = z + (Math.random() - 0.5) * (o.jitter ?? 0);
      p.vx = Math.cos(a) * s * (o.spread ?? 1);
      p.vz = Math.sin(a) * s * (o.spread ?? 1);
      p.vy = (o.up ?? 2) * (0.5 + Math.random() * 0.5);
      p.life = (o.life ?? 0.6) * (0.7 + Math.random() * 0.6);
      p.max = p.life;
      p.size = (o.size ?? 0.12) * (0.7 + Math.random() * 0.6);
      p.g = o.gravity ?? 9;
      p.drag = o.drag ?? 0;
      p.spin = (o.spin ?? 0) * (Math.random() - 0.5) * 2;
      p.rot = Math.random() * Math.PI * 2 * (o.spin === 0 ? 0 : 1);
      p.grow = o.grow ?? 0;
      p.bounce = o.bounce ?? 0.3;
      c.set(colors[k % colors.length]);
      cl.col[i * 3] = c.r;
      cl.col[i * 3 + 1] = c.g;
      cl.col[i * 3 + 2] = c.b;
      cl.shape[i] = o.shape ?? SHAPE.dot;
    }
    cl.geo.attributes.color.needsUpdate = true;
    cl.geo.attributes.shape.needsUpdate = true;
  }

  function stepCloud(cl, dt) {
    const { parts, pos, size, rot, alpha } = cl;
    let any = false;
    for (let i = 0; i < MAXP; i++) {
      const p = parts[i];
      if (!p.live) { if (size[i] !== 0) { size[i] = 0; any = true; } continue; }
      any = true;
      p.life -= dt;
      if (p.life <= 0) { p.live = false; size[i] = 0; continue; }
      const dr = Math.max(0, 1 - p.drag * dt);
      p.vx *= dr; p.vz *= dr; p.vy *= p.g ? 1 : dr;
      p.vy -= p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.02) { p.y = 0.02; p.vy *= -p.bounce; p.vx *= 0.6; p.vz *= 0.6; }
      p.rot += p.spin * dt;
      p.size *= 1 + p.grow * dt;
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.y;
      pos[i * 3 + 2] = p.z;
      const k = p.life / p.max;
      size[i] = p.size * Math.min(1, k * 4, (1 - k) * 12 + 0.4);
      rot[i] = p.rot;
      alpha[i] = Math.min(1, k * 2.5);
    }
    if (any) {
      cl.geo.attributes.position.needsUpdate = true;
      cl.geo.attributes.size.needsUpdate = true;
      cl.geo.attributes.rot.needsUpdate = true;
      cl.geo.attributes.alpha.needsUpdate = true;
    }
  }

  function wave(x, z, r, life, color = '#fff3df', y = 0.05) {
    const s = shock.find((q) => !q.m.visible) ?? shock[0];
    s.m.visible = true;
    s.t = 0;
    s.life = life;
    s.r = r;
    s.m.material.color.set(color);
    s.m.position.set(x, y, z);
    return s;
  }

  const fx = {
    emit,
    wave,
    setReduced(on) { reduced = !!on; },
    treats(x, z) {
      const r = rings.find((q) => !q.m.visible) ?? rings[0];
      r.m.visible = true;
      r.t = 0;
      r.life = 0.55;
      r.r = TREATS.radius;
      r.m.position.set(x, 0.04, z);
      emit(x, 1.4, z, 12, { color: ['#c98a4b', '#a86a33', '#e0a55e'], shape: SHAPE.crumb, speed: 1.6, up: 3, life: 0.9, size: 0.09, spin: 8, bounce: 0.4 });
      emit(x, 1.5, z, 6, { color: '#ffd77a', shape: SHAPE.spark, glow: true, speed: 1, up: 1.5, life: 0.5, size: 0.18, gravity: 0 });
    },
    /** style: a clap item from meta/herder.js (hearts, stars, confetti...) thrown out with the shockwave */
    clap(x, z, style = null) {
      wave(x, z, CLAP.radius, 0.38);
      wave(x, z, CLAP.radius * 0.55, 0.26, style?.colors?.[0] ?? '#ffd77a');
      emit(x, 1.15, z, 10, { color: '#fff3df', shape: SHAPE.streak, glow: true, speed: 5, up: 0, gravity: 0, life: 0.22, size: 0.35, drag: 6 });
      emit(x, 0.08, z, 10, { color: '#efe2c8', shape: SHAPE.puff, speed: 3.2, up: 0.3, gravity: 0, drag: 4, life: 0.5, size: 0.4, grow: 1.5 });
      if (style?.fx && SHAPE[style.fx] != null) {
        const bubbles = style.fx === 'ring';
        emit(x, 1.1, z, 16, {
          color: style.colors, shape: SHAPE[style.fx], speed: bubbles ? 2.2 : 4.2, up: bubbles ? 1.2 : 2.6, life: bubbles ? 1.2 : 0.9,
          size: bubbles ? 0.2 : 0.17, gravity: bubbles ? -0.6 : 5, drag: bubbles ? 2.2 : 1.6, spin: style.fx === 'square' ? 12 : 3, bounce: 0.2,
        });
      }
    },
    /** one mark of a herder's trail where a foot came down */
    print(x, z, h, style, side = 1) {
      if (!style?.fx || SHAPE[style.fx] == null) return;
      const ox = Math.cos(h + Math.PI / 2) * 0.13 * side;
      const oz = Math.sin(h + Math.PI / 2) * 0.13 * side;
      const col = style.colors[Math.floor(Math.random() * style.colors.length)];
      marks.add(x + ox, z + oz, h + (style.fx === 'paw' ? 0 : (Math.random() - 0.5) * 0.8), SHAPE[style.fx], col, style.fx === 'dot' ? 0.16 : 0.22, reduced ? 1.2 : 2.6, style.glow ? 0.6 : 0);
      if (style.glow && !reduced) emit(x + ox, 0.1, z + oz, 1, { color: col, shape: SHAPE.spark, glow: true, speed: 0.2, up: 0.6, life: 0.5, size: 0.14, gravity: 0, drag: 2 });
    },
    /** soft dust kicked up from the floor */
    dust(x, z, n = 6, color = '#efe2c8') { emit(x, 0.08, z, n, { color, shape: SHAPE.puff, speed: 1.2, up: 0.5, life: 0.5, size: 0.3, gravity: 0, drag: 3, grow: 1.2 }); },
    /** a footstep puff behind something running, pushed back along -dir */
    kick(x, z, dx, dz, color = '#efe2c8') { emit(x, 0.05, z, 2, { color, shape: SHAPE.puff, speed: 0.8, up: 0.25, life: 0.4, size: 0.2, gravity: 0, drag: 3, grow: 1.4, dir: { x: -dx, z: -dz }, cone: 1.2 }); },
    /** fur flying off a startled cat */
    tufts(x, y, z, color, n = 6) { emit(x, y, z, n, { color: [color, '#fff3df'], shape: SHAPE.tuft, speed: 1.6, up: 2, life: 0.9, size: 0.16, gravity: 2.2, drag: 2, spin: 6 }); },
    hearts(x, z, y = 0.8) { emit(x, y, z, 5, { color: ['#e57fa6', '#f29bb9'], shape: SHAPE.heart, speed: 0.6, up: 1.6, life: 0.9, size: 0.16, gravity: -0.5, drag: 1.5 }); },
    shards(x, y, z, color) {
      emit(x, y, z, 14, { color: [color, '#ffffff'], shape: SHAPE.shard, speed: 2.6, up: 3, life: 0.9, size: 0.1, gravity: 12, spin: 14, bounce: 0.35 });
      emit(x, y + 0.05, z, 6, { color: '#efe2c8', shape: SHAPE.puff, speed: 1.2, up: 0.4, life: 0.45, size: 0.3, gravity: 0, drag: 3, grow: 1.4 });
    },
    confetti(x, z, colors, y = 1.2, n = 16) {
      for (const col of colors) emit(x, y, z, n, { color: col, shape: SHAPE.square, speed: 3, up: 6, life: 1.8, size: 0.1, gravity: 6, drag: 1.2, spin: 12, bounce: 0.1 });
    },
    stars(x, z, y = 1.0, n = 12) { emit(x, y, z, n, { color: ['#f6b941', '#ffe08a'], shape: SHAPE.star, speed: 2.4, up: 3.5, life: 0.9, size: 0.16, gravity: 8, spin: 6 }); },
    sparkle(x, y, z, n = 8, color = '#ffe9a8') { emit(x, y, z, n, { color, shape: SHAPE.spark, glow: true, speed: 0.9, up: 0.9, life: 0.7, size: 0.22, gravity: 0, drag: 2 }); },
    /** a cat goes in: a ring on the mat, sparks, hearts, a few paw prints flying */
    gulp(x, z, color = '#f6b941', big = false) {
      wave(x, z, big ? 2.6 : 1.7, big ? 0.5 : 0.36, color, 0.06);
      emit(x, 0.6, z, big ? 18 : 10, { color: ['#ffe9a8', color], shape: SHAPE.spark, glow: true, speed: 2.4, up: 2.2, life: 0.6, size: 0.22, gravity: 3, drag: 1.5 });
      emit(x, 0.7, z, big ? 8 : 4, { color: ['#e57fa6', '#f29bb9'], shape: SHAPE.heart, speed: 1.2, up: 2.2, life: 1, size: 0.18, gravity: -0.4, drag: 1.4 });
    },
    showFeet(x, z, h) {
      feet.visible = true;
      feet.position.set(x, 0.02, z);
      feet.rotation.z = -h + Math.PI / 2;
    },
    hideFeet() { feet.visible = false; },
    update(dt, t) {
      for (const r of rings) {
        if (!r.m.visible) continue;
        r.t += dt;
        const k = Math.min(1, r.t / r.life);
        const e = 1 - (1 - k) * (1 - k);
        const s = 0.3 + e * r.r;
        r.m.scale.set(s, s, 1);
        r.m.material.opacity = 1 - k * k;
        r.m.rotation.z = t * 0.6;
        if (k >= 1) r.m.visible = false;
      }
      for (const r of shock) {
        if (!r.m.visible) continue;
        r.t += dt;
        const k = Math.min(1, r.t / r.life);
        const s = 0.2 + (1 - (1 - k) ** 3) * r.r;
        r.m.scale.set(s, s, 1);
        r.m.material.opacity = (1 - k) * 0.95;
        if (k >= 1) r.m.visible = false;
      }
      stepCloud(soft, dt);
      stepCloud(glow, dt);
      marks.update(dt);
      if (feet.visible) feet.material.opacity = 0.55 + Math.sin(t * 5) * 0.35;
    },
    /** particle size follows the camera's zoom: pixels per room unit at the focus */
    setScale(pxPerUnit, camDist = 14) {
      const k = pxPerUnit * (camDist / 14);
      soft.mat.uniforms.scale.value = k;
      glow.mat.uniforms.scale.value = k;
    },
    clear() {
      for (const cl of [soft, glow]) for (const p of cl.parts) p.live = false;
      marks.clear();
      for (const r of rings) r.m.visible = false;
      for (const r of shock) r.m.visible = false;
      feet.visible = false;
    },
  };
  return fx;
}
