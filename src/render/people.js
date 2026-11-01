// People: chunky little figures dressed from each player's avatar (skin, shirt, trousers, hair or hat), with a walk, a
// treat-bag shake and a clap. A ring in their seat colour sits under the feet in a match.

import * as THREE from 'three';
import { drawSymbol } from '../ui/symbols.js';

// the platform's avatar colours (skins, then clothes), so a player looks like themselves
const BODY_COLORS = ['#f6dcc5', '#ebc29f', '#d4a07a', '#b07a55', '#875839', '#5e3d29', '#93c9bb', '#a8c595', '#94bcd3', '#ab9bd9', '#dca3ad', '#b3bccb'];
const COLORS = ['#c95f56', '#dc8a4f', '#e2bd52', '#9cc27a', '#5a8a5e', '#4f9a8e', '#6fb7c8', '#5b87c5', '#465089', '#8b68a8', '#dc8fae', '#f2eee6', '#a9a8ad', '#5d5c63', '#2b2a30', '#80604d'];
const HAIR = ['#7d5233', '#583a27', '#41291d', '#2f1f17', '#251812', '#1c130f'];
const HAIR_FROM = 12;

const GEO = {
  torso: new THREE.CapsuleGeometry(0.2, 0.26, 4, 12),
  head: new THREE.SphereGeometry(0.19, 16, 12),
  hair: new THREE.SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
  limb: new THREE.CapsuleGeometry(0.065, 0.24, 3, 8),
  shoe: new THREE.SphereGeometry(0.08, 10, 8),
  brim: new THREE.CylinderGeometry(0.24, 0.24, 0.03, 16),
  cap: new THREE.CylinderGeometry(0.17, 0.2, 0.14, 16),
  bag: new THREE.BoxGeometry(0.13, 0.17, 0.08),
  ear: new THREE.ConeGeometry(0.07, 0.13, 4),
  ring: new THREE.RingGeometry(0.42, 0.52, 32),
  disc: new THREE.CircleGeometry(0.36, 24),
};
for (const g of [GEO.limb]) g.translate(0, -0.15, 0);

const mats = new Map();
function mat(hex, rough = 0.8) {
  const key = hex + rough;
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color: hex, roughness: rough }));
  return mats.get(key);
}

const discTex = new Map();
function seatDisc(look) {
  if (discTex.has(look.symbol)) return discTex.get(look.symbol);
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 128;
  const g = cv.getContext('2d');
  g.globalAlpha = 0.85;
  drawSymbol(g, look.symbol, 64, 64, 70, look.color, '#2b1d1c', 2);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  discTex.set(look.symbol, t);
  return t;
}

/** avatar: { skin, shirt, pants, hat } indices (the platform's), or null for a look picked from `seed`. */
export function makePerson(avatar, seed = 1) {
  const a = avatar ?? pickAvatar(seed);
  const skin = BODY_COLORS[a.skin] ?? BODY_COLORS[1];
  const shirt = COLORS[a.shirt] ?? COLORS[0];
  const pants = COLORS[a.pants] ?? COLORS[14];
  const hair = a.skin < 6 ? HAIR[a.skin] ?? HAIR[0] : '#4a3a35';
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const torso = new THREE.Mesh(GEO.torso, mat(shirt));
  torso.position.y = 0.62;
  const head = new THREE.Mesh(GEO.head, mat(skin, 0.6));
  head.position.y = 1.02;
  const face = new THREE.Group();
  head.add(face);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(GEO.shoe, mat('#2b1d1c', 0.3));
    eye.scale.set(0.22, 0.3, 0.22);
    eye.position.set(0.17, 0.03, s * 0.065);
    face.add(eye);
  }
  body.add(torso, head);
  // hair or a hat
  if (a.hat >= HAIR_FROM || a.hat === 0) {
    const h = new THREE.Mesh(GEO.hair, mat(hair, 0.9));
    h.position.set(-0.02, 0.03, 0);
    h.rotation.z = 0.25;
    head.add(h);
  } else if (a.hat === 11) {
    const h = new THREE.Mesh(GEO.hair, mat(hair, 0.9));
    head.add(h);
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(GEO.ear, mat(shirt));
      e.position.set(0, 0.2, s * 0.1);
      head.add(e);
    }
  } else {
    const cap = new THREE.Mesh(GEO.cap, mat(COLORS[(a.hat * 3) % COLORS.length]));
    cap.position.y = 0.14;
    const brim = new THREE.Mesh(GEO.brim, mat(COLORS[(a.hat * 3) % COLORS.length]));
    brim.position.set(0.06, 0.08, 0);
    head.add(cap, brim);
  }
  const limbs = {};
  for (const [name, x, y, z, color] of [
    ['armL', 0.0, 0.84, -0.26, shirt], ['armR', 0.0, 0.84, 0.26, shirt],
    ['legL', 0.0, 0.42, -0.1, pants], ['legR', 0.0, 0.42, 0.1, pants],
  ]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    const m = new THREE.Mesh(GEO.limb, mat(color));
    pivot.add(m);
    if (name.startsWith('arm')) {
      const hand = new THREE.Mesh(GEO.shoe, mat(skin, 0.6));
      hand.scale.setScalar(0.8);
      hand.position.y = -0.36;
      pivot.add(hand);
    } else {
      const shoe = new THREE.Mesh(GEO.shoe, mat('#2b2a30', 0.5));
      shoe.scale.set(1.3, 0.7, 1);
      shoe.position.set(0.04, -0.4, 0);
      pivot.add(shoe);
    }
    body.add(pivot);
    limbs[name] = pivot;
  }
  const bag = new THREE.Mesh(GEO.bag, mat('#f6b941', 0.5));
  bag.position.set(0, -0.42, 0);
  bag.visible = false;
  limbs.armR.add(bag);
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  const ring = new THREE.Mesh(GEO.ring, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  ring.visible = false;
  root.add(ring);
  const disc = new THREE.Mesh(GEO.disc, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.015;
  disc.visible = false;
  root.add(disc);

  const st = { phase: 0, h: 0, shake: 0, clap: 0, tr: -1, cl: -1, dim: 1, poof: 0 };
  return {
    root,
    setSeat(look) {
      if (!look) { ring.visible = false; disc.visible = false; return; }
      ring.material.color.set(look.color);
      ring.visible = true;
      disc.material.map = seatDisc(look);
      disc.material.needsUpdate = true;
      disc.visible = true;
    },
    /** p: a simulation person ({ x, z, h, sp, treatsSeq, clapSeq, active }). */
    update(p, dt, t, { away = false, reducedMotion = false } = {}) {
      root.visible = p.active !== false || st.poof > 0;
      if (st.tr < 0) { st.tr = p.treatsSeq ?? 0; st.cl = p.clapSeq ?? 0; }
      if ((p.treatsSeq ?? 0) > st.tr) { st.tr = p.treatsSeq; st.shake = 0.7; }
      if ((p.clapSeq ?? 0) > st.cl) { st.cl = p.clapSeq; st.clap = 0.45; }
      st.shake = Math.max(0, st.shake - dt);
      st.clap = Math.max(0, st.clap - dt);
      root.position.set(p.x, 0, p.z);
      let dh = (p.h ?? 0) - st.h;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      st.h += dh * Math.min(1, dt * 14);
      body.rotation.y = -st.h;
      const sp = Math.min(4, p.sp ?? 0);
      st.phase += dt * (sp * 3.2);
      const swing = Math.min(0.8, sp * 0.22);
      limbs.legL.rotation.z = Math.sin(st.phase) * swing;
      limbs.legR.rotation.z = -Math.sin(st.phase) * swing;
      limbs.armL.rotation.set(0, 0, -Math.sin(st.phase) * swing * 0.8);
      limbs.armR.rotation.set(0, 0, Math.sin(st.phase) * swing * 0.8);
      body.position.y = Math.abs(Math.sin(st.phase)) * 0.04 * Math.min(1, sp);
      bag.visible = st.shake > 0;
      if (st.shake > 0) {
        limbs.armR.rotation.set(0.15, 0, 2.5 + Math.sin(t * 40) * (reducedMotion ? 0.05 : 0.3));
      }
      if (st.clap > 0) {
        const k = Math.sin((1 - st.clap / 0.45) * Math.PI * 2);
        limbs.armL.rotation.set(-0.6 + k * 0.3, 0, 1.3);
        limbs.armR.rotation.set(0.6 - k * 0.3, 0, 1.3);
      }
      head.rotation.z = st.shake > 0 ? 0.15 : 0;
      const dim = away ? 0.45 : 1;
      st.dim += (dim - st.dim) * Math.min(1, dt * 4);
      root.scale.setScalar(1);
    },
  };
}

function pickAvatar(seed) {
  let h = 2166136261 ^ seed;
  const pick = (n) => {
    h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0;
    return h % n;
  };
  return { skin: pick(6), shirt: pick(COLORS.length), pants: [8, 13, 14, 15][pick(4)], hat: pick(4) === 0 ? 2 + pick(9) : HAIR_FROM + pick(8) };
}
