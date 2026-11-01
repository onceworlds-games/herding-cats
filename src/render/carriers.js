// The signature: a red plastic cat carrier (moulded shell, vent slots, clasps, a carry handle with its owner's tag) with
// a sprung wire door that slams and bounces, glowing eyes inside for every cat already in, a coir doormat, and its count
// stencilled big over it in its owner's colour and symbol.

import * as THREE from 'three';
import { CARRIER, DOOR } from '../sim/tuning.js';
import { drawSymbol } from '../ui/symbols.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { blobTexture } from './cats.js';

const L = CARRIER.len, W = CARRIER.wid, H = CARRIER.height;
const SHELL_TOP = new RoundedBoxGeometry(1, 1, 1, 4, 0.2);
const SHELL_BOT = new RoundedBoxGeometry(1, 1, 1, 3, 0.12);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const BAR = new THREE.CylinderGeometry(0.013, 0.013, 1, 6);
const GRIP = new THREE.CylinderGeometry(0.045, 0.045, 1, 10);
const EYE = new THREE.SphereGeometry(0.028, 10, 8);

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
  g.fillStyle = '#e7a94a';
  g.fillRect(0, 0, 256, 192);
  // coir fibres
  let r = 3;
  const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * 256, y = rnd() * 192;
    g.fillStyle = i % 3 ? 'rgba(150,90,30,0.25)' : 'rgba(255,220,150,0.3)';
    g.fillRect(x, y, 1 + (i % 2), 3);
  }
  g.strokeStyle = '#b8752a';
  g.lineWidth = 10;
  g.strokeRect(10, 10, 236, 172);
  if (look) drawSymbol(g, look.symbol, 128, 96, 104, look.color, '#2b1d1c', 2);
  else drawSymbol(g, 'paw', 128, 96, 96, '#b8752a', null);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function tagTexture(look) {
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 96;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff3df';
  g.beginPath();
  g.moveTo(14, 0); g.lineTo(50, 0); g.lineTo(64, 16); g.lineTo(64, 96); g.lineTo(0, 96); g.lineTo(0, 16); g.closePath();
  g.fill();
  g.fillStyle = '#2b1d1c';
  g.beginPath(); g.arc(32, 14, 5, 0, Math.PI * 2); g.fill();
  drawSymbol(g, look ? look.symbol : 'paw', 32, 58, 44, look ? look.color : '#e5493a', '#2b1d1c', 1.6);
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
  const own = [];
  const M = (o) => { const m = new THREE.MeshStandardMaterial(o); own.push(m); return m; };
  const red = M({ color: look ? look.color : '#e5493a', roughness: 0.38 });
  const redDark = M({ color: new THREE.Color(look ? look.color : '#e5493a').multiplyScalar(0.72), roughness: 0.5 });
  const base = M({ color: '#f3ead9', roughness: 0.55 });
  const ink = M({ color: '#2b1d1c', roughness: 0.5 });
  const wire = M({ color: '#e4e2dc', roughness: 0.25, metalness: 0.85 });
  const inside = new THREE.MeshBasicMaterial({ color: '#160e0c' });
  own.push(inside);

  // everything that squashes and wobbles hangs off `body`, pivoting at the floor
  const body = new THREE.Group();
  root.add(body);
  const add = (geo, m, x, y, z, sx, sy, sz, parent = body) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  // the cream base tray and the red moulded top
  add(SHELL_BOT, base, 0, H * 0.24, 0, L, H * 0.48, W);
  const top = add(SHELL_TOP, red, -0.02, H * 0.68, 0, L - 0.04, H * 0.62, W - 0.02);
  add(BOX, redDark, 0, H * 0.47, 0, L + 0.03, 0.045, W + 0.03);
  // ridges along the top
  for (const s of [-1, 1]) add(SHELL_BOT, redDark, -0.04, H * 0.99, s * W * 0.22, L * 0.78, 0.04, 0.06);
  // vent slots down both sides
  for (let i = 0; i < 4; i++) {
    for (const s of [-1, 1]) add(SHELL_BOT, ink, -0.32 + i * 0.15, H * 0.7, s * (W / 2 - 0.005), 0.07, 0.2, 0.03);
  }
  // clasps where the halves meet
  for (const x of [-0.34, 0.2]) for (const s of [-1, 1]) add(SHELL_BOT, base, x, H * 0.47, s * (W / 2 + 0.02), 0.1, 0.09, 0.04);
  // the carry handle and a tag on it
  for (const s of [-1, 1]) add(BOX, ink, s * 0.17, H + 0.06, 0, 0.05, 0.14, 0.08);
  const grip = add(GRIP, ink, 0, H + 0.13, 0, 1, 0.38, 1);
  grip.rotation.z = Math.PI / 2;
  const tagMat = new THREE.MeshStandardMaterial({ map: tagTexture(look), roughness: 0.7, side: THREE.DoubleSide });
  own.push(tagMat, tagMat.map);
  const tagHold = new THREE.Group();
  tagHold.position.set(0.12, H + 0.12, 0.05);
  body.add(tagHold);
  const tag = add(new THREE.PlaneGeometry(0.12, 0.18), tagMat, 0, -0.1, 0, 1, 1, 1, tagHold);
  own.push(tag.geometry);
  // the dark inside, a blanket, and eyes for the cats already in
  const cave = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.16, H - 0.2), inside);
  own.push(cave.geometry);
  cave.rotation.y = Math.PI / 2;
  cave.position.set(L / 2 - 0.05, H / 2 + 0.02, 0);
  body.add(cave);
  const eyes = [];
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#d7f06a' });
  own.push(eyeMat);
  for (let i = 0; i < 3; i++) {
    const pair = new THREE.Group();
    pair.position.set(L / 2 - 0.035, 0.24 + (i % 2) * 0.16, (i - 1) * 0.2);
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(EYE, eyeMat);
      e.position.z = s * 0.042;
      e.scale.set(0.4, 1, 1);
      pair.add(e);
    }
    pair.visible = false;
    body.add(pair);
    eyes.push(pair);
  }
  // the wire door: a frame and bars, hinged on one side, sprung
  const hinge = new THREE.Group();
  hinge.position.set(L / 2 + 0.015, 0.09, -W / 2 + 0.08);
  const door = new THREE.Group();
  hinge.add(door);
  const dw = W - 0.16, dh = H - 0.22;
  for (const [x0, y0, x1, y1] of [[0, 0, 0, dh], [dw, 0, dw, dh], [0, 0, dw, 0], [0, dh, dw, dh]]) {
    const b = new THREE.Mesh(BAR, wire);
    const len = Math.hypot(x1 - x0, y1 - y0);
    b.scale.set(2, len, 2);
    b.position.set(0, (y0 + y1) / 2, (x0 + x1) / 2);
    if (y0 === y1) b.rotation.x = Math.PI / 2;
    door.add(b);
  }
  for (let i = 1; i < 6; i++) {
    const b = new THREE.Mesh(BAR, wire);
    b.scale.y = dh;
    b.position.set(0, dh / 2, (i * dw) / 6);
    door.add(b);
  }
  for (let j = 1; j < 3; j++) {
    const b = new THREE.Mesh(BAR, wire);
    b.scale.y = dw;
    b.rotation.x = Math.PI / 2;
    b.position.set(0, (j * dh) / 3, dw / 2);
    door.add(b);
  }
  const latch = new THREE.Mesh(BOX, wire);
  latch.scale.set(0.03, 0.12, 0.05);
  latch.position.set(0.02, dh / 2, dw + 0.02);
  door.add(latch);
  door.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  body.add(hinge);
  // a soft shadow under it
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, color: '#2a1810', opacity: 0.7 });
  own.push(blobMat);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(L * 1.5, W * 1.6).rotateX(-Math.PI / 2), blobMat);
  own.push(blob.geometry);
  blob.position.y = 0.012;
  blob.renderOrder = 1;
  root.add(blob);

  // doormat
  const matTex = matTexture(look);
  const matTop = new THREE.MeshStandardMaterial({ map: matTex, roughness: 0.95 });
  const matSide = new THREE.MeshStandardMaterial({ color: '#b8752a', roughness: 0.95 });
  own.push(matTop, matSide, matTex);
  const matGeo = new RoundedBoxGeometry(DOOR.matD, 0.035, DOOR.matW, 2, 0.014);
  own.push(matGeo);
  const mat = new THREE.Mesh(matGeo, [matSide, matSide, matTop, matSide, matSide, matSide]);
  mat.position.set(L / 2 + DOOR.matD / 2, 0.018, 0);
  mat.receiveShadow = true;
  // the top face's texture runs along x; turn it so the symbol reads from the camera
  matTex.center.set(0.5, 0.5);
  matTex.rotation = -Math.PI / 2;
  root.add(mat);

  // the count, over the carrier, always facing the camera
  const sign = signTexture();
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: sign.t, transparent: true, depthTest: false }));
  own.push(spr.material, sign.t);
  spr.renderOrder = 20;
  spr.scale.set(2.2, 1.1, 1);
  const signHolder = new THREE.Group();
  signHolder.position.set(k.x, 1.8, k.z);
  signHolder.add(spr);

  const st = { open: 1, vel: 0, shut: 0, count: -1, total: -1, pop: 0, popV: 0, squash: 0, squashV: 0, wobble: 0, closed: false, tagA: 0, tagV: 0, blink: 0 };

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
    root, sign: signHolder, body,
    /** free this carrier's own geometry, materials and textures (the shell and bar shapes are shared) */
    dispose() { for (const r of own) r.dispose(); },
    /** a cat went in: slam the door, squash the shell, pop the count */
    gulp() { st.shut = DOOR.pull + DOOR.shut; st.popV += 9; st.squashV -= 7; st.tagV += 10; },
    bump() { st.squashV -= 3; st.tagV += 6; st.wobble = Math.max(st.wobble, 0.6); },
    /** Draw the count again (the stencil font arrived). */
    redraw() { st.count = -1; },
    update(k, dt, t, total, { reducedMotion = false } = {}) {
      if (k.count !== st.count || total !== st.total || !!k.closed !== st.closed) {
        st.count = k.count;
        st.total = total;
        st.closed = !!k.closed;
        drawSign(k.count, total, st.closed);
        eyes.forEach((e, i) => { e.visible = i < Math.min(3, k.count); });
      }
      const d = Math.min(dt, 0.05);
      st.shut = Math.max(0, st.shut - d);
      // the door: a stiff spring toward open or shut, bouncing on the frame
      const want = k.closed || k.shutT > 0 || st.shut > 0 ? 0 : 1;
      const kk = want ? 40 : 520, damp = want ? 9 : 16;
      st.vel += ((want - st.open) * kk - st.vel * damp) * d;
      st.open += st.vel * d;
      if (st.open < 0) { st.open = -st.open * 0.4; st.vel = -st.vel * 0.45; }
      door.rotation.y = st.open * 1.9;
      // squash and pop
      st.squashV += (-st.squash * 260 - st.squashV * 11) * d;
      st.squash += st.squashV * d;
      st.popV += (-st.pop * 180 - st.popV * 10) * d;
      st.pop += st.popV * d;
      st.wobble = Math.max(0, st.wobble - d * 1.8);
      const sq = reducedMotion ? 0 : st.squash * 0.12;
      body.scale.set(1 - sq * 0.5, 1 + sq, 1 - sq * 0.5);
      top.rotation.x = reducedMotion ? 0 : Math.sin(t * 28) * st.wobble * 0.06;
      // the tag swings
      st.tagV += (-st.tagA * 60 - st.tagV * 3) * d;
      st.tagA += st.tagV * d;
      tagHold.rotation.x = Math.max(-1, Math.min(1, st.tagA * 0.15)) + Math.sin(t * 1.3) * 0.04;
      // the eyes blink now and then
      const blink = (Math.sin(t * 0.9 + k.x) > 0.985) ? 0.1 : 1;
      for (const e of eyes) e.scale.y = blink;
      const s = 1 + (reducedMotion ? 0 : st.pop * 0.35);
      spr.scale.set(2.2 * s, 1.1 * s, 1);
      signHolder.position.y = 1.8 + st.pop * 0.05;
    },
  };
}
