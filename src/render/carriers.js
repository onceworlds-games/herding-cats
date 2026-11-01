// The signature: a red plastic cat carrier with a wire door, a gold doormat, and its count stencilled big over it in its
// owner's colour and symbol.

import * as THREE from 'three';
import { CARRIER, DOOR } from '../sim/tuning.js';
import { drawSymbol } from '../ui/symbols.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const SHELL = new RoundedBoxGeometry(1, 1, 1, 3, 0.14);
const BAR = new THREE.CylinderGeometry(0.012, 0.012, 1, 6);
const HANDLE = new THREE.TorusGeometry(0.16, 0.035, 8, 16, Math.PI);

function signTexture() {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 256;
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return { cv, t };
}

function matTexture(look) {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 192;
  const g = cv.getContext('2d');
  g.fillStyle = '#f6b941';
  g.fillRect(0, 0, 256, 192);
  g.strokeStyle = '#d9962a';
  g.lineWidth = 10;
  g.strokeRect(12, 12, 232, 168);
  if (look) drawSymbol(g, look.symbol, 128, 96, 110, look.color, '#2b1d1c', 2);
  else drawSymbol(g, 'paw', 128, 96, 100, '#d9962a', null);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** k: a simulation carrier. look: { color, symbol } of its owner, or null (solo, together). */
export function makeCarrier(k, look) {
  const root = new THREE.Group();
  root.position.set(k.x, 0, k.z);
  // face the door along (nx, nz): build with the door at +x
  root.rotation.y = -Math.atan2(k.nz, k.nx);
  const red = new THREE.MeshStandardMaterial({ color: look ? shadeHex(look.color, '#e5493a') : '#e5493a', roughness: 0.45 });
  const cream = new THREE.MeshStandardMaterial({ color: '#fff3df', roughness: 0.6 });
  const wire = new THREE.MeshStandardMaterial({ color: '#d8d6d0', roughness: 0.3, metalness: 0.8 });
  const L = CARRIER.len;
  const W = CARRIER.wid;
  const H = CARRIER.height;
  const top = new THREE.Mesh(SHELL, red);
  top.scale.set(L, H * 0.55, W);
  top.position.set(0, H * 0.72, 0);
  const bottom = new THREE.Mesh(SHELL, cream);
  bottom.scale.set(L, H * 0.5, W);
  bottom.position.set(0, H * 0.25, 0);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(L + 0.04, 0.05, W + 0.04), red);
  rim.position.y = H * 0.48;
  // vents
  for (let i = 0; i < 4; i++) {
    for (const s of [-1, 1]) {
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.02), new THREE.MeshStandardMaterial({ color: '#2b1d1c' }));
      v.position.set(-0.3 + i * 0.16, H * 0.72, s * (W / 2 + 0.005));
      root.add(v);
    }
  }
  const handle = new THREE.Mesh(HANDLE, new THREE.MeshStandardMaterial({ color: '#2b1d1c', roughness: 0.5 }));
  handle.position.set(0, H + 0.02, 0);
  // the wire door, hinged on one side
  const hinge = new THREE.Group();
  hinge.position.set(L / 2 + 0.01, 0.08, -W / 2 + 0.08);
  const door = new THREE.Group();
  hinge.add(door);
  const dw = W - 0.16;
  const dh = H - 0.2;
  for (let i = 0; i <= 5; i++) {
    const b = new THREE.Mesh(BAR, wire);
    b.scale.y = dh;
    b.position.set(0, dh / 2, (i * dw) / 5);
    door.add(b);
  }
  for (let j = 0; j <= 3; j++) {
    const b = new THREE.Mesh(BAR, wire);
    b.scale.y = dw;
    b.rotation.x = Math.PI / 2;
    b.position.set(0, (j * dh) / 3, dw / 2);
    door.add(b);
  }
  const dark = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.12, H - 0.16), new THREE.MeshBasicMaterial({ color: '#1a1110' }));
  dark.rotation.y = Math.PI / 2;
  dark.position.set(L / 2 - 0.02, H / 2, 0);
  root.add(top, bottom, rim, handle, hinge, dark);
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  // doormat
  const mat = new THREE.Mesh(new RoundedBoxGeometry(DOOR.matD, 0.03, DOOR.matW, 2, 0.012), [
    new THREE.MeshStandardMaterial({ color: '#d9962a' }), new THREE.MeshStandardMaterial({ color: '#d9962a' }),
    new THREE.MeshStandardMaterial({ map: matTexture(look), roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: '#d9962a' }),
    new THREE.MeshStandardMaterial({ color: '#d9962a' }), new THREE.MeshStandardMaterial({ color: '#d9962a' }),
  ]);
  mat.position.set(L / 2 + DOOR.matD / 2, 0.015, 0);
  mat.receiveShadow = true;
  // the top face's texture runs along x; turn it so the symbol reads from the camera
  mat.material[2].map.center.set(0.5, 0.5);
  mat.material[2].map.rotation = -Math.PI / 2;
  root.add(mat);

  // the count, over the carrier, always facing the camera
  const sign = signTexture();
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: sign.t, transparent: true, depthTest: false }));
  spr.renderOrder = 20;
  spr.scale.set(2.2, 1.1, 1);
  const signHolder = new THREE.Group();
  signHolder.position.set(k.x, 1.75, k.z);
  signHolder.add(spr);

  const st = { open: 0, shut: 0, count: -1, total: -1, pop: 0, wobble: 0, closed: false, label: '' };

  function drawSign(count, total, closed) {
    const g = sign.cv.getContext('2d');
    g.clearRect(0, 0, 512, 256);
    const color = look ? look.color : '#e5493a';
    const text = closed ? 'Closed' : total > 0 ? `${count}/${total}` : String(count);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const big = closed ? 96 : total > 0 ? 170 : 200;
    g.font = `800 ${big}px "Big Shoulders Stencil Display", Impact, sans-serif`;
    const x = look && !closed ? 300 : 256;
    g.lineJoin = 'round';
    g.lineWidth = 22;
    g.strokeStyle = '#2b1d1c';
    g.strokeText(text, x, 136);
    g.fillStyle = closed ? '#fff3df' : color;
    g.fillText(text, x, 136);
    if (look && !closed) drawSymbol(g, look.symbol, 110, 128, 120, color, '#2b1d1c', 2.6);
    sign.t.needsUpdate = true;
  }

  return {
    root, sign: signHolder,
    /** a cat went in: snap the door shut, pop the count */
    gulp() { st.shut = DOOR.pull + DOOR.shut; st.pop = 1; st.wobble = 1; },
    bump() { st.wobble = Math.max(st.wobble, 0.6); },
    /** Draw the count again (the stencil font arrived). */
    redraw() { st.count = -1; },
    update(k, dt, t, total, { reducedMotion = false } = {}) {
      if (k.count !== st.count || total !== st.total || !!k.closed !== st.closed) {
        st.count = k.count;
        st.total = total;
        st.closed = !!k.closed;
        drawSign(k.count, total, st.closed);
      }
      st.shut = Math.max(0, st.shut - dt);
      const want = k.closed || k.shutT > 0 || st.shut > 0 ? 0 : 1;
      st.open += (want - st.open) * Math.min(1, dt * (want ? 6 : 22));
      door.rotation.y = st.open * 1.9;
      st.pop = Math.max(0, st.pop - dt * 2.5);
      st.wobble = Math.max(0, st.wobble - dt * 1.8);
      const w = reducedMotion ? 0 : Math.sin(t * 28) * st.wobble * 0.08;
      top.rotation.x = w;
      bottom.rotation.x = w * 0.5;
      const s = 1 + st.pop * 0.35;
      spr.scale.set(2.2 * s, 1.1 * s, 1);
      signHolder.position.y = 1.75 + st.pop * 0.2;
    },
  };
}

function shadeHex(c, fallback) {
  return c || fallback;
}
