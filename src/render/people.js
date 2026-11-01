// People: CC0 animated characters (Quaternius) dressed from each player's avatar (skin, shirt, trousers, hair or a hat),
// blending idle, walk and run by speed, clapping, and shaking a bag of treats overhead. A ring in their seat colour
// sits under the feet in a match.

import * as THREE from 'three';
import { personModel, PEOPLE_FILES } from './assets.js';
import { drawSymbol } from '../ui/symbols.js';

// the platform's avatar colours (skins, then clothes), so a player looks like themselves
const BODY_COLORS = ['#f6dcc5', '#ebc29f', '#d4a07a', '#b07a55', '#875839', '#5e3d29', '#93c9bb', '#a8c595', '#94bcd3', '#ab9bd9', '#dca3ad', '#b3bccb'];
const COLORS = ['#c95f56', '#dc8a4f', '#e2bd52', '#9cc27a', '#5a8a5e', '#4f9a8e', '#6fb7c8', '#5b87c5', '#465089', '#8b68a8', '#dc8fae', '#f2eee6', '#a9a8ad', '#5d5c63', '#2b2a30', '#80604d'];
const HAIR = ['#7d5233', '#583a27', '#41291d', '#2f1f17', '#251812', '#1c130f'];
const HAIR_FROM = 12;
export const PERSON_H = 1.62; // how tall a person stands, in room units (a cat is about one long)

const RING = new THREE.RingGeometry(0.42, 0.52, 40);
const DISC = new THREE.CircleGeometry(0.36, 28);

const mats = new Map();
function mat(hex, rough = 0.8, extra = null) {
  const key = hex + rough + (extra ? JSON.stringify(extra) : '');
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color: hex, roughness: rough, ...(extra ?? {}) }));
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

// ---------------------------------------------------------------- hats (avatar caps, and the ones earned in play)
const HAT_GEO = {
  cap: new THREE.SphereGeometry(0.5, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  brim: new THREE.CylinderGeometry(0.5, 0.5, 0.06, 20, 1, false, -Math.PI / 2, Math.PI),
  ear: new THREE.ConeGeometry(0.16, 0.34, 4),
  band: new THREE.TorusGeometry(0.52, 0.05, 6, 24, Math.PI),
  bobble: new THREE.SphereGeometry(0.16, 10, 8),
  roll: new THREE.TorusGeometry(0.53, 0.08, 8, 24),
  crown: new THREE.CylinderGeometry(0.42, 0.38, 0.32, 8, 1, true),
  bucket: new THREE.CylinderGeometry(0.4, 0.5, 0.36, 18),
  bucketBrim: new THREE.CylinderGeometry(0.72, 0.72, 0.04, 22),
};

/** A hat in head units (the head is about one across), sitting on the crown of the head. */
export function makeHat(kind, color = '#e5493a') {
  const g = new THREE.Group();
  const m = mat(color, 0.8);
  if (kind === 'cap') {
    const c = new THREE.Mesh(HAT_GEO.cap, m);
    c.scale.set(1.08, 0.75, 1.08);
    const b = new THREE.Mesh(HAT_GEO.brim, m);
    b.position.set(0, 0.02, 0.32);
    b.scale.set(0.9, 1, 1.2);
    g.add(c, b);
  } else if (kind === 'beanie') {
    const c = new THREE.Mesh(HAT_GEO.cap, m);
    c.scale.set(1.1, 1.05, 1.1);
    const roll = new THREE.Mesh(HAT_GEO.roll, m);
    roll.rotation.x = Math.PI / 2;
    const bob = new THREE.Mesh(HAT_GEO.bobble, mat('#fff3df', 0.95));
    bob.position.y = 0.56;
    g.add(c, roll, bob);
  } else if (kind === 'ears') {
    const band = new THREE.Mesh(HAT_GEO.band, mat('#2b1d1c', 0.5));
    band.rotation.y = Math.PI / 2;
    g.add(band);
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(HAT_GEO.ear, m);
      e.position.set(s * 0.3, 0.42, 0);
      e.rotation.z = -s * 0.25;
      g.add(e);
      const inner = new THREE.Mesh(HAT_GEO.ear, mat('#f2a7a0', 0.9));
      inner.scale.setScalar(0.6);
      inner.position.set(s * 0.3, 0.38, 0.06);
      inner.rotation.z = -s * 0.25;
      g.add(inner);
    }
  } else if (kind === 'crown') {
    const gold = mat('#f6b941', 0.3, { metalness: 0.8, side: THREE.DoubleSide });
    const c = new THREE.Mesh(HAT_GEO.crown, gold);
    c.position.y = 0.16;
    g.add(c);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const p = new THREE.Mesh(HAT_GEO.bobble, gold);
      p.scale.setScalar(0.4);
      p.position.set(Math.cos(a) * 0.42, 0.34, Math.sin(a) * 0.42);
      g.add(p);
    }
  } else if (kind === 'bucket') {
    const c = new THREE.Mesh(HAT_GEO.bucket, m);
    c.position.y = 0.12;
    const b = new THREE.Mesh(HAT_GEO.bucketBrim, m);
    b.position.y = -0.05;
    g.add(c, b);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// a paper bag of treats, held up and shaken
const BAG = (() => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.1), mat('#f6b941', 0.6));
  const fold = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.04, 0.11), mat('#e5493a', 0.6));
  fold.position.y = 0.1;
  const fish = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat('#fff3df', 0.6));
  fish.scale.set(1.6, 1, 0.5);
  fish.position.set(0, 0, 0.055);
  g.add(body, fold, fish);
  return g;
})();

/** avatar: { skin, shirt, pants, hat } indices (the platform's), or null for a look picked from `seed`. extra.hat: an earned hat. */
export function makePerson(avatar, seed = 1, extra = {}) {
  const a = avatar ?? pickAvatar(seed);
  const skin = BODY_COLORS[a.skin] ?? BODY_COLORS[1];
  const shirt = COLORS[a.shirt] ?? COLORS[0];
  const pants = COLORS[a.pants] ?? COLORS[14];
  const hair = a.skin < 6 ? HAIR[(a.skin + (a.hat ?? 0)) % HAIR.length] : '#4a3a35';
  const fileKey = PEOPLE_FILES[Math.abs(hashLook(a)) % PEOPLE_FILES.length];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const model = personModel(fileKey);
  const bones = {};
  let mixer = null;
  const actions = {};
  if (model) {
    const scene = model.scene;
    // height from the skeleton (a skinned mesh's box isn't known before it is drawn): feet to the top of the head
    scene.updateMatrixWorld(true);
    const hv = new THREE.Vector3(), fv = new THREE.Vector3();
    let headB = null, footB = null;
    scene.traverse((o) => { if (o.isBone && o.name === 'Head') headB = o; if (o.isBone && o.name === 'Foot.L') footB = o; });
    headB?.getWorldPosition(hv);
    footB?.getWorldPosition(fv);
    const h = Math.max(0.01, (hv.y - Math.min(0, fv.y)) * 1.16);
    const s = PERSON_H / h;
    scene.scale.multiplyScalar(s);
    // models face +z; the game's heading 0 is +x
    scene.rotation.y = Math.PI / 2;
    const COL = { Skin: skin, Shirt: shirt, Dress: shirt, Pants: pants, Shoes: '#2b2a30', Socks: '#f2eee6', HairBase: hair, Hair: hair, Eyes: '#2b1d1c' };
    scene.traverse((o) => {
      if (o.isBone) bones[o.name] = o;
      if (!o.isMesh) return;
      const name = o.material?.name ?? '';
      const col = COL[name] ?? shirt;
      o.material = mat(col, name === 'Skin' ? 0.62 : name === 'Eyes' ? 0.3 : 0.85);
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
    });
    body.add(scene);
    mixer = new THREE.AnimationMixer(scene);
    for (const clip of model.animations) {
      const act = mixer.clipAction(clip);
      act.enabled = true;
      act.setEffectiveWeight(0);
      act.play();
      actions[clip.name] = act;
    }
    if (actions.clap) { actions.clap.setLoop(THREE.LoopOnce, 1); actions.clap.clampWhenFinished = true; }
    // a hat on the head bone (an earned one wins over the avatar's cap)
    const head = bones.Head;
    const hatKind = extra.hat ?? (a.hat === 11 ? 'ears' : a.hat > 0 && a.hat < HAIR_FROM ? 'cap' : null);
    if (head && hatKind) {
      const hat = makeHat(hatKind, extra.hatColor ?? COLORS[((a.hat ?? 1) * 3) % COLORS.length]);
      const ws = new THREE.Vector3();
      scene.updateMatrixWorld(true);
      head.getWorldScale(ws);
      const hs = 0.24 / ws.y;
      hat.scale.setScalar(hs);
      hat.position.set(0, 0.2 / ws.y, 0.0);
      head.add(hat);
      bones.hat = hat;
    }
    const palm = bones['Palm.R'];
    if (palm) {
      const ws = new THREE.Vector3();
      scene.updateMatrixWorld(true);
      palm.getWorldScale(ws);
      const bag = BAG.clone();
      bag.scale.setScalar(1 / ws.y);
      bag.position.set(0, 0.08 / ws.y, 0);
      bag.visible = false;
      palm.add(bag);
      bones.bag = bag;
    }
  }

  const ring = new THREE.Mesh(RING, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  ring.visible = false;
  root.add(ring);
  const disc = new THREE.Mesh(DISC, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.015;
  disc.visible = false;
  root.add(disc);

  const st = { h: null, shake: 0, clap: 0, tr: -1, cl: -1, w: { idle: 1, walk: 0, run: 0 }, lean: 0, sp: 0, dim: 1 };
  const q = new THREE.Quaternion();
  const ax = new THREE.Vector3(1, 0, 0);
  return {
    root,
    bones,
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
      root.visible = p.active !== false;
      if (st.tr < 0) { st.tr = p.treatsSeq ?? 0; st.cl = p.clapSeq ?? 0; }
      if ((p.treatsSeq ?? 0) > st.tr) { st.tr = p.treatsSeq; st.shake = 0.75; }
      if ((p.clapSeq ?? 0) > st.cl) {
        st.cl = p.clapSeq;
        st.clap = 0.6;
        if (actions.clap) { actions.clap.reset(); actions.clap.setEffectiveTimeScale(1.8); actions.clap.play(); }
      }
      st.shake = Math.max(0, st.shake - dt);
      st.clap = Math.max(0, st.clap - dt);
      root.position.set(p.x, 0, p.z);
      if (st.h == null) st.h = p.h ?? 0;
      let dh = (p.h ?? 0) - st.h;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      st.h += dh * Math.min(1, dt * 16);
      body.rotation.y = -st.h;
      // speed, eased so the blend doesn't flicker on stop-start
      const sp = Math.min(6, p.sp ?? 0);
      st.sp += (sp - st.sp) * Math.min(1, dt * 12);
      // lean into speed (forward is the body's +x)
      const leanT = reducedMotion ? 0 : Math.min(0.12, st.sp * 0.025);
      st.lean += (leanT - st.lean) * Math.min(1, dt * 8);
      body.rotation.z = -st.lean;
      if (mixer) {
        const want = st.sp < 0.25 ? 'idle' : st.sp < 2.6 ? 'walk' : 'run';
        const k = Math.min(1, dt * 10);
        for (const n of ['idle', 'walk', 'run']) st.w[n] += ((n === want ? 1 : 0) - st.w[n]) * k;
        const clapW = st.clap > 0 ? Math.min(1, st.clap * 6) : 0;
        actions.idle?.setEffectiveWeight(st.w.idle * (1 - clapW));
        if (actions.walk) { actions.walk.setEffectiveWeight(st.w.walk * (1 - clapW * 0.6)); actions.walk.setEffectiveTimeScale(Math.max(0.6, st.sp / 1.5)); }
        if (actions.run) { actions.run.setEffectiveWeight(st.w.run * (1 - clapW * 0.6)); actions.run.setEffectiveTimeScale(Math.max(0.7, st.sp / 4.2)); }
        actions.clap?.setEffectiveWeight(clapW);
        actions.jump?.setEffectiveWeight(0);
        actions.stand?.setEffectiveWeight(0);
        mixer.update(dt);
        // the treat shake: the right arm up, the bag rattling
        if (bones.bag) bones.bag.visible = st.shake > 0;
        const arm = bones['UpperArm.R'];
        if (arm && st.shake > 0) {
          const k2 = Math.min(1, st.shake * 5);
          q.setFromAxisAngle(ax, (-2.3 + (reducedMotion ? 0 : Math.sin(t * 38) * 0.18)) * k2);
          arm.quaternion.multiply(q);
          const fore = bones['LowerArm.R'];
          if (fore) { q.setFromAxisAngle(ax, -0.5 * k2); fore.quaternion.multiply(q); }
        }
      }
      const fade = away ? 0.45 : 1;
      if (st.dim !== fade) {
        st.dim = fade;
        body.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = fade < 1; o.material.opacity = fade; } });
      }
    },
  };
}

function hashLook(a) {
  return ((a.skin ?? 0) * 7 + (a.shirt ?? 0) * 13 + (a.pants ?? 0) * 3 + (a.hat ?? 0) * 5) | 0;
}

function pickAvatar(seed) {
  let h = 2166136261 ^ seed;
  const pick = (n) => {
    h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0;
    return h % n;
  };
  return { skin: pick(6), shirt: pick(COLORS.length), pants: [8, 13, 14, 15][pick(4)], hat: pick(4) === 0 ? 2 + pick(9) : HAIR_FROM + pick(8) };
}
