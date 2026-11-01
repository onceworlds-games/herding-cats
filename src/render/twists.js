// The room's twists on screen: the laser pointer (the pen on the floor, the beam and the dancing red dot), robot
// vacuums, cardboard boxes people shove about, and a warm glow on the patches of sun cats nap in.

import * as THREE from 'three';
import { buildPiece } from './room.js';
import { BOX, VAC } from '../sim/tuning.js';
import { SILL, WIN_TOP, WIN_W, SUN } from '../sim/sun.js';

let dotTex = null;
function glowTex() {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.18, 'rgba(255,90,70,1)');
  gr.addColorStop(0.45, 'rgba(255,40,30,0.35)');
  gr.addColorStop(1, 'rgba(255,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c);
  dotTex.colorSpace = THREE.SRGBColorSpace;
  return dotTex;
}

function vacuumModel() {
  const g = new THREE.Group();
  const r = VAC.radius;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.98, 0.1, 40), new THREE.MeshStandardMaterial({ color: '#2a2c33', roughness: 0.35, metalness: 0.2 }));
  body.position.y = 0.065;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.92, 0.02, 40), new THREE.MeshStandardMaterial({ color: '#3d4049', roughness: 0.25, metalness: 0.3 }));
  top.position.y = 0.125;
  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.02, 24), new THREE.MeshStandardMaterial({ color: '#c9ccd2', roughness: 0.3, metalness: 0.6 }));
  button.position.set(0.12, 0.14, 0);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), new THREE.MeshBasicMaterial({ color: '#59e3ff', toneMapped: false }));
  led.position.set(0.24, 0.135, 0);
  const bumper = new THREE.Mesh(new THREE.TorusGeometry(r * 0.99, 0.03, 8, 30, Math.PI * 1.1), new THREE.MeshStandardMaterial({ color: '#16171b', roughness: 0.6 }));
  bumper.rotation.set(Math.PI / 2, 0, -Math.PI * 0.55);
  bumper.position.y = 0.06;
  const brush = new THREE.Group();
  const bristle = new THREE.MeshStandardMaterial({ color: '#d7d2c4', roughness: 0.9 });
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.008, 0.012), bristle);
    b.position.x = 0.08;
    const arm = new THREE.Group();
    arm.rotation.y = (i / 3) * Math.PI * 2;
    arm.add(b);
    brush.add(arm);
  }
  brush.position.set(r * 0.62, 0.02, -r * 0.55);
  for (const m of [body, top, button, bumper]) { m.castShadow = true; m.receiveShadow = true; }
  g.add(body, top, button, led, bumper, brush);
  return { group: g, brush, led };
}

function laserPen() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.34, 14), new THREE.MeshStandardMaterial({ color: '#c8322b', roughness: 0.3, metalness: 0.4 }));
  body.rotation.z = Math.PI / 2;
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.08, 14), new THREE.MeshStandardMaterial({ color: '#d9dbe0', roughness: 0.2, metalness: 0.9 }));
  tip.rotation.z = Math.PI / 2;
  tip.position.x = 0.2;
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.02), tip.material);
  clip.position.set(-0.04, 0.04, 0);
  body.castShadow = tip.castShadow = true;
  g.add(body, tip, clip);
  return g;
}

export function createTwists(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const T = { g: null, vacs: [], boxes: [], pen: null, ring: null, dot: null, beam: null, sun: null, drawn: [] };

  function clear() {
    for (const v of T.vacs) root.remove(v.group);
    for (const b of T.boxes) { root.remove(b.group); b.dispose(); }
    for (const o of [T.pen, T.ring, T.dot, T.beam, T.sun]) if (o) root.remove(o);
    T.vacs = [];
    T.boxes = [];
    T.pen = T.ring = T.dot = T.beam = T.sun = null;
    T.g = null;
  }

  function show(g) {
    clear();
    T.g = g;
    for (const v of g.vacs ?? []) {
      const m = vacuumModel();
      m.group.position.set(v.x, 0, v.z);
      m.x = v.x;
      m.z = v.z;
      root.add(m.group);
      T.vacs.push(m);
    }
    for (const b of g.boxes ?? []) {
      const p = buildPiece('box', BOX.radius * 2, BOX.radius * 2);
      p.group.position.set(b.x, 0, b.z);
      p.group.rotation.y = b.h ?? 0;
      p.x = b.x;
      p.z = b.z;
      root.add(p.group);
      T.boxes.push(p);
    }
    if (g.laser) {
      T.pen = laserPen();
      T.ring = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.4, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff6a55', transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }));
      T.dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      T.dot.renderOrder = 9;
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
      T.beam = new THREE.Line(bg, new THREE.LineBasicMaterial({ color: '#ff3b2e', transparent: true, opacity: 0.55, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }));
      root.add(T.pen, T.ring, T.dot, T.beam);
    }
    // the sun's patches: a soft warm glow where the cats like to lie
    if (g.suns?.length) {
      const pos = [];
      const kx = SUN.x / -SUN.y;
      const kz = SUN.z / -SUN.y;
      for (const p of g.suns) {
        const c = (y, s) => (p.axis === 'x' ? [p.c + s * WIN_W / 2 + kx * y, 0.02, kz * y] : [kx * y, 0.02, p.c + s * WIN_W / 2 + kz * y]);
        const a = c(SILL, -1), b = c(SILL, 1), d = c(WIN_TOP, 1), e = c(WIN_TOP, -1);
        pos.push(...a, ...b, ...d, ...a, ...d, ...e);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      T.sun = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.32, 0.22, 0.1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      T.sun.renderOrder = 3;
      root.add(T.sun);
    }
  }

  /** drawn: the people as drawn this frame (for the beam's start). */
  function update(dt, t, drawn, reduced) {
    const g = T.g;
    if (!g) return;
    const k = 1 - Math.exp(-dt * 25);
    g.vacs.forEach((v, i) => {
      const m = T.vacs[i];
      if (!m) return;
      m.x += (v.x - m.x) * k;
      m.z += (v.z - m.z) * k;
      m.group.position.set(m.x, 0, m.z);
      const want = -v.h;
      let d = want - m.group.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      m.group.rotation.y += d * Math.min(1, dt * 10);
      if (!reduced) m.brush.rotation.y += dt * 18;
      m.led.visible = reduced || Math.sin(t * 3) > -0.6;
    });
    g.boxes.forEach((b, i) => {
      const m = T.boxes[i];
      if (!m) return;
      const moving = Math.hypot(b.vx, b.vz) > 0.2;
      m.x += (b.x - m.x) * k;
      m.z += (b.z - m.z) * k;
      m.group.position.set(m.x, 0, m.z);
      // a shoved box judders
      m.group.rotation.z = moving && !reduced ? Math.sin(t * 40) * 0.02 : 0;
    });
    const L = g.laser;
    if (L && T.pen) {
      const onFloor = L.on === 0;
      T.pen.visible = T.ring.visible = onFloor;
      if (onFloor) {
        const bob = reduced ? 0 : Math.sin(t * 3) * 0.04;
        T.pen.position.set(L.hx, 0.12 + bob, L.hz);
        T.pen.rotation.y = reduced ? 0.6 : t * 1.2;
        T.ring.position.set(L.hx, 0.02, L.hz);
        const s = reduced ? 1 : 1 + ((t * 1.2) % 1) * 0.6;
        T.ring.scale.set(s, 1, s);
        T.ring.material.opacity = reduced ? 0.7 : 0.8 * (1 - ((t * 1.2) % 1));
      }
      const held = L.on === 1;
      T.dot.visible = T.beam.visible = held;
      if (held) {
        const jx = reduced ? 0 : Math.sin(t * 23) * 0.02 + Math.sin(t * 37) * 0.015;
        const jz = reduced ? 0 : Math.cos(t * 29) * 0.02;
        T.dot.position.set(L.x + jx, 0.06, L.z + jz);
        const pulse = reduced ? 1 : 0.9 + Math.sin(t * 18) * 0.1;
        T.dot.scale.set(0.42 * pulse, 0.42 * pulse, 1);
        const who = drawn?.[L.holder] ?? g.people[L.holder];
        if (who) {
          const a = T.beam.geometry.attributes.position;
          a.setXYZ(0, who.x + Math.cos(who.h) * 0.3, 1.05, who.z + Math.sin(who.h) * 0.3);
          a.setXYZ(1, L.x + jx, 0.06, L.z + jz);
          a.needsUpdate = true;
          T.beam.geometry.computeBoundingSphere();
        }
      }
    }
    if (T.sun) T.sun.material.color.setRGB(0.3, 0.2, 0.09).multiplyScalar(reduced ? 1 : 0.9 + Math.sin(t * 0.8) * 0.1);
  }

  return { show, update, clear };
}
