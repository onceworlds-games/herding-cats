// Effects in the world: the treat ring (gold dots out to its reach), the clap shockwave, dust, crumbs, shards and
// confetti, gold footprints for the first hint. All pooled; nothing allocated per frame.

import * as THREE from 'three';
import { TREATS, CLAP } from '../sim/tuning.js';

const MAXP = 360;

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

export function createFx(scene) {
  const rings = [];
  const dots = dotsTexture();
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: dots, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    m.renderOrder = 5;
    scene.add(m);
    rings.push({ m, t: 0, life: 0, r: 1, kind: 'treats' });
  }
  const shock = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: '#fff3df', transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    m.renderOrder = 5;
    scene.add(m);
    shock.push({ m, t: 0, life: 0, r: 1 });
  }

  // particles: one Points cloud with per-particle colour and size
  const pos = new Float32Array(MAXP * 3);
  const colr = new Float32Array(MAXP * 3);
  const size = new Float32Array(MAXP);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(colr, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  const pmat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, vertexColors: true,
    uniforms: { scale: { value: 40 } },
    vertexShader: `attribute float size; varying vec3 vColor; uniform float scale;
      void main() { vColor = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size * scale; }`,
    fragmentShader: `varying vec3 vColor; void main() { vec2 d = gl_PointCoord - 0.5; if (dot(d, d) > 0.25) discard; gl_FragColor = vec4(vColor, 1.0); }`,
  });
  const points = new THREE.Points(geo, pmat);
  points.frustumCulled = false;
  points.renderOrder = 6;
  scene.add(points);
  const parts = [];
  for (let i = 0; i < MAXP; i++) parts.push({ live: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 0, g: 9 });
  let cursor = 0;
  const c = new THREE.Color();

  const feet = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: footTexture(), transparent: true, depthWrite: false }));
  feet.rotation.x = -Math.PI / 2;
  feet.position.y = 0.02;
  feet.visible = false;
  scene.add(feet);

  function emit(x, y, z, n, { color = '#fff3df', speed = 2, up = 2, life = 0.6, size: sz = 0.12, gravity = 9, spread = 1 } = {}) {
    c.set(color);
    for (let k = 0; k < n; k++) {
      const i = cursor;
      const p = parts[i];
      cursor = (cursor + 1) % MAXP;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      p.live = true;
      p.x = x;
      p.y = y;
      p.z = z;
      p.vx = Math.cos(a) * s * spread;
      p.vz = Math.sin(a) * s * spread;
      p.vy = up * (0.5 + Math.random() * 0.5);
      p.life = life * (0.7 + Math.random() * 0.6);
      p.max = p.life;
      p.size = sz * (0.7 + Math.random() * 0.6);
      p.g = gravity;
      colr[i * 3] = c.r;
      colr[i * 3 + 1] = c.g;
      colr[i * 3 + 2] = c.b;
    }
  }

  return {
    treats(x, z) {
      const r = rings.find((q) => !q.m.visible) ?? rings[0];
      r.m.visible = true;
      r.t = 0;
      r.life = 0.55;
      r.r = TREATS.radius;
      r.m.position.set(x, 0.04, z);
      emit(x, 1.1, z, 10, { color: '#f6b941', speed: 1.2, up: 2.5, life: 0.7, size: 0.08 });
    },
    clap(x, z) {
      const r = shock.find((q) => !q.m.visible) ?? shock[0];
      r.m.visible = true;
      r.t = 0;
      r.life = 0.35;
      r.r = CLAP.radius;
      r.m.position.set(x, 0.05, z);
    },
    dust(x, z, n = 6) { emit(x, 0.1, z, n, { color: '#efe2c8', speed: 1.5, up: 0.8, life: 0.45, size: 0.12, gravity: 1 }); },
    hearts(x, z) { emit(x, 0.7, z, 5, { color: '#e57fa6', speed: 0.6, up: 1.5, life: 0.8, size: 0.1, gravity: 1 }); },
    shards(x, y, z, color) {
      emit(x, y, z, 14, { color, speed: 2.4, up: 3, life: 0.8, size: 0.07, gravity: 12 });
      emit(x, y, z, 8, { color: '#ffffff', speed: 2, up: 2.5, life: 0.6, size: 0.05, gravity: 12 });
    },
    confetti(x, z, colors) {
      for (const col of colors) emit(x, 1.2, z, 16, { color: col, speed: 3, up: 6, life: 1.6, size: 0.09, gravity: 7 });
    },
    stars(x, z) { emit(x, 1.0, z, 12, { color: '#f6b941', speed: 2.2, up: 3.5, life: 0.9, size: 0.1, gravity: 8 }); },
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
        const s = 0.4 + (1 - (1 - k) * (1 - k)) * r.r;
        r.m.scale.set(s, s, 1);
        r.m.material.opacity = (1 - k) * 0.9;
        if (k >= 1) r.m.visible = false;
      }
      for (let i = 0; i < MAXP; i++) {
        const p = parts[i];
        if (!p.live) { size[i] = 0; continue; }
        p.life -= dt;
        if (p.life <= 0) { p.live = false; size[i] = 0; continue; }
        p.vy -= p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (p.y < 0.02) { p.y = 0.02; p.vy *= -0.3; p.vx *= 0.7; p.vz *= 0.7; }
        pos[i * 3] = p.x;
        pos[i * 3 + 1] = p.y;
        pos[i * 3 + 2] = p.z;
        size[i] = p.size * Math.min(1, (p.life / p.max) * 3);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      geo.attributes.size.needsUpdate = true;
      if (feet.visible) feet.material.opacity = 0.55 + Math.sin(t * 5) * 0.35;
    },
    /** point size follows the camera's zoom */
    setScale(pxPerUnit) { pmat.uniforms.scale.value = pxPerUnit; },
    clear() {
      for (const p of parts) p.live = false;
      for (const r of rings) r.m.visible = false;
      for (const r of shock) r.m.visible = false;
      feet.visible = false;
    },
  };
}
