// Every cat in the room, drawn with a handful of instanced meshes (one per body part), posed each frame from the
// simulation: walks and trots, the tell (stop, glance), flattened ears when pushed, tails that say what a cat thinks.

import * as THREE from 'three';
import { S } from '../sim/tuning.js';
import { COATS } from './palette.js';
import { drawSymbol } from '../ui/symbols.js';

const MAX = 72;
const TAIL = 5;
const col = new THREE.Color();
const HIDE = new THREE.Matrix4().makeScale(0, 0, 0);

const MOVING = new Set([S.walk, S.flee, S.lured, S.bolt, S.trot, S.slip, S.runhide, S.creep, S.scoot, S.sprint, S.follow, S.march, S.stalk, S.settle]);
const PUSHED = new Set([S.flee, S.bolt, S.trot, S.slip, S.runhide, S.sprint, S.crouch]);
const SITTING = new Set([S.content, S.perch, S.snub, S.hold]);

function partMesh(geo, mat, perCat) {
  const m = new THREE.InstancedMesh(geo, mat, MAX * perCat);
  m.castShadow = true;
  m.receiveShadow = false;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false;
  for (let i = 0; i < MAX * perCat; i++) { m.setMatrixAt(i, HIDE); m.setColorAt(i, col.set('#ffffff')); }
  return m;
}

function symbolTexture(name, fill) {
  const cv = document.createElement('canvas');
  cv.width = 96;
  cv.height = 96;
  const g = cv.getContext('2d');
  if (name === 'z') {
    g.font = '900 54px Fraunces, Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 9;
    g.strokeStyle = '#2b1d1c';
    g.strokeText('z', 36, 58);
    g.fillStyle = '#fff3df';
    g.fillText('z', 36, 58);
    g.font = '900 38px Fraunces, Georgia, serif';
    g.strokeText('z', 66, 30);
    g.fillText('z', 66, 30);
  } else if (name === '!') {
    g.font = '900 72px Fraunces, Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 10;
    g.strokeStyle = '#2b1d1c';
    g.strokeText('!', 48, 52);
    g.fillStyle = fill;
    g.fillText('!', 48, 52);
  } else {
    drawSymbol(g, name, 48, 48, 72, fill, '#2b1d1c', 2.4);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createCats(scene) {
  const fur = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
  const eyeMat = new THREE.MeshStandardMaterial({ roughness: 0.15, metalness: 0, color: '#ffffff' });
  const sphere = new THREE.SphereGeometry(0.5, 16, 12);
  const ear = new THREE.ConeGeometry(0.5, 1, 4);
  ear.translate(0, 0.5, 0);
  const leg = new THREE.CylinderGeometry(0.5, 0.42, 1, 8);
  leg.translate(0, -0.5, 0);
  const collar = new THREE.TorusGeometry(0.5, 0.12, 6, 14);

  const parts = {
    body: partMesh(sphere, fur, 1),
    patch: partMesh(sphere, fur, 1),
    chest: partMesh(sphere, fur, 1),
    head: partMesh(sphere, fur, 1),
    muzzle: partMesh(sphere, fur, 1),
    ear: partMesh(ear, fur, 2),
    eye: partMesh(sphere, eyeMat, 2),
    leg: partMesh(leg, fur, 4),
    tail: partMesh(sphere, fur, TAIL),
    collar: partMesh(collar, new THREE.MeshStandardMaterial({ color: '#2b1d1c', roughness: 0.5, metalness: 0.3 }), 1),
  };
  const group = new THREE.Group();
  for (const m of Object.values(parts)) group.add(m);
  scene.add(group);

  // a reusable rig: pose it, then copy world matrices into the instances
  const root = new THREE.Object3D();
  const body = new THREE.Object3D();
  const patch = new THREE.Object3D();
  const chest = new THREE.Object3D();
  const neck = new THREE.Object3D();
  const head = new THREE.Object3D();
  const muzzle = new THREE.Object3D();
  const ears = [new THREE.Object3D(), new THREE.Object3D()];
  const eyes = [new THREE.Object3D(), new THREE.Object3D()];
  const legs = [0, 1, 2, 3].map(() => new THREE.Object3D());
  const tail = [];
  const collarO = new THREE.Object3D();
  root.add(body);
  body.add(patch, chest, collarO);
  root.add(neck);
  neck.add(head);
  head.add(muzzle, ...ears, ...eyes);
  legs.forEach((l) => root.add(l));
  let parent = body;
  for (let i = 0; i < TAIL; i++) {
    const t = new THREE.Object3D();
    parent.add(t);
    tail.push(t);
    parent = t;
  }

  const sym = {};
  const symbols = [];
  for (let i = 0; i < MAX; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
    s.visible = false;
    s.renderOrder = 10;
    s.scale.set(0.5, 0.5, 1);
    scene.add(s);
    symbols.push(s);
  }
  const tex = (name, fill = '#fff3df') => (sym[name + fill] ??= symbolTexture(name, fill));

  const state = []; // per cat: smoothed heading, gait phase, head yaw, etc.
  let colored = new Array(MAX).fill(null);

  function paintCat(i, c) {
    const coat = COATS[c.coat] ?? COATS.ginger;
    const key = `${c.coat}:${c.type}`;
    if (colored[i] === key) return;
    colored[i] = key;
    const siamese = c.coat === 'siamese';
    const base = coat.base;
    const set = (m, idx, hex) => m.setColorAt(idx, col.set(hex));
    set(parts.body, i, base);
    set(parts.patch, i, c.coat === 'calico' ? coat.second : coat.second);
    set(parts.chest, i, coat.bib);
    set(parts.head, i, base);
    set(parts.muzzle, i, siamese ? coat.second : coat.bib);
    for (let e = 0; e < 2; e++) set(parts.ear, i * 2 + e, siamese ? coat.second : c.coat === 'calico' && e ? coat.third : base);
    for (let e = 0; e < 2; e++) set(parts.eye, i * 2 + e, c.type === 'scaredy' ? '#1e2a24' : '#2a2a1e');
    for (let l = 0; l < 4; l++) set(parts.leg, i * 4 + l, c.coat === 'tuxedo' && l < 2 ? coat.bib : siamese ? coat.second : base);
    for (let t = 0; t < TAIL; t++) set(parts.tail, i * TAIL + t, siamese ? coat.second : c.coat === 'calico' ? coat.third : t === TAIL - 1 && c.coat === 'ginger' ? coat.second : base);
    for (const m of Object.values(parts)) if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }

  function hideCat(i) {
    parts.body.setMatrixAt(i, HIDE);
    parts.patch.setMatrixAt(i, HIDE);
    parts.chest.setMatrixAt(i, HIDE);
    parts.head.setMatrixAt(i, HIDE);
    parts.muzzle.setMatrixAt(i, HIDE);
    parts.collar.setMatrixAt(i, HIDE);
    for (let e = 0; e < 2; e++) { parts.ear.setMatrixAt(i * 2 + e, HIDE); parts.eye.setMatrixAt(i * 2 + e, HIDE); }
    for (let l = 0; l < 4; l++) parts.leg.setMatrixAt(i * 4 + l, HIDE);
    for (let t = 0; t < TAIL; t++) parts.tail.setMatrixAt(i * TAIL + t, HIDE);
    symbols[i].visible = false;
  }

  function write(i, c, hideBody) {
    root.updateMatrixWorld(true);
    if (hideBody) {
      parts.body.setMatrixAt(i, HIDE);
      parts.patch.setMatrixAt(i, HIDE);
      parts.chest.setMatrixAt(i, HIDE);
      parts.head.setMatrixAt(i, HIDE);
      parts.muzzle.setMatrixAt(i, HIDE);
      parts.collar.setMatrixAt(i, HIDE);
      for (let e = 0; e < 2; e++) { parts.ear.setMatrixAt(i * 2 + e, HIDE); parts.eye.setMatrixAt(i * 2 + e, HIDE); }
      for (let l = 0; l < 4; l++) parts.leg.setMatrixAt(i * 4 + l, HIDE);
    } else {
      parts.body.setMatrixAt(i, body.matrixWorld);
      parts.patch.setMatrixAt(i, c.coat === 'tuxedo' || c.coat === 'black' || c.coat === 'white' ? HIDE : patch.matrixWorld);
      parts.chest.setMatrixAt(i, chest.matrixWorld);
      parts.head.setMatrixAt(i, head.matrixWorld);
      parts.muzzle.setMatrixAt(i, muzzle.matrixWorld);
      parts.collar.setMatrixAt(i, c.type === 'boss' || c.gang >= 0 ? collarO.matrixWorld : HIDE);
      for (let e = 0; e < 2; e++) {
        parts.ear.setMatrixAt(i * 2 + e, ears[e].matrixWorld);
        parts.eye.setMatrixAt(i * 2 + e, eyes[e].matrixWorld);
      }
      for (let l = 0; l < 4; l++) parts.leg.setMatrixAt(i * 4 + l, legs[l].scale.y > 0.01 ? legs[l].matrixWorld : HIDE);
    }
    for (let t = 0; t < TAIL; t++) parts.tail.setMatrixAt(i * TAIL + t, tail[t].matrixWorld);
  }

  /**
   * cats: the simulation's cats. `offset(i)` → {x, z} drawing correction (prediction easing). `people`: for glances.
   * `near(x, z)`: distance to the player (symbols show up close).
   */
  function update(cats, dt, t, { offset, people, me, reducedMotion }) {
    const n = Math.min(cats.length, MAX);
    for (let i = 0; i < n; i++) {
      const c = cats[i];
      paintCat(i, c);
      const s = (state[i] ??= { h: c.h, phase: Math.random() * 6, head: 0, tailT: Math.random() * 6, blink: 0, last: -1, since: 0, squash: 0, sit: 0 });
      if (c.st !== s.last) {
        if (c.st === S.alert || c.st === S.crouch || c.st === S.hop) s.squash = 1;
        s.last = c.st;
        s.since = 0;
      }
      s.since += dt;
      s.squash = Math.max(0, s.squash - dt * 4);
      if (c.st === S.boxed || c.surprise) { hideCat(i); continue; }
      const o = offset ? offset(i) : null;
      const x = c.x + (o ? o.x : 0);
      const z = c.z + (o ? o.z : 0);
      const size = c.size || 1;
      // heading eases (fast when it means it)
      const turn = PUSHED.has(c.st) ? 18 : 9;
      let dh = c.h - s.h;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      s.h += dh * Math.min(1, dt * turn);
      const sp = MOVING.has(c.st) ? Math.max(0, c.sp) : 0;
      s.phase += dt * (2 + sp * 4.2);
      s.tailT += dt;
      const gait = Math.min(0.75, sp * 0.22);
      const pushed = PUSHED.has(c.st);
      const sleeping = c.st === S.sleep || (c.type === 'loaf' && (c.st === S.idle || c.st === S.settle));
      const sitting = SITTING.has(c.st) || (c.st === S.idle && s.since > 1.4 && c.type !== 'loaf');
      s.sit += ((sitting ? 1 : 0) - s.sit) * Math.min(1, dt * 6);
      const loafK = sleeping ? 1 : 0;

      const enterK = c.st === S.enter ? Math.max(0.05, c.tt / 0.35) : 1;
      const sc = size * enterK;
      root.position.set(x, (c.y || 0), z);
      root.rotation.set(0, -s.h, 0);
      root.scale.setScalar(sc);

      const low = (pushed ? 0.9 : 1) * (c.st === S.crouch || c.st === S.creep ? 0.72 : 1);
      const bob = Math.abs(Math.sin(s.phase)) * 0.018 * Math.min(3, sp);
      const legLen = 0.21;
      const bodyY = sleeping ? 0.15 : legLen * low + 0.06 + bob;
      body.position.set(0, bodyY, 0);
      const breathe = sleeping ? 1 + Math.sin(t * 2.2 + i) * 0.035 : 1;
      const sq = s.squash * 0.12;
      if (sleeping) body.scale.set(0.62 * breathe, 0.34 * breathe, 0.46 * breathe);
      else body.scale.set(0.58 + sq * 0.5 + (c.st === S.sprint ? 0.08 : 0), 0.3 - sq * 0.3, 0.3 + sq * 0.2);
      if (c.type === 'glutton') body.scale.z *= 1.25;
      // sitting: rear down, front up
      body.rotation.set(0, 0, s.sit * 0.42 + (c.st === S.wiggle ? 0 : 0));
      if (c.st === S.wiggle) body.rotation.y = Math.sin(t * 38) * 0.22;
      else body.rotation.y = 0;
      body.position.x = -s.sit * 0.05;
      body.position.y -= s.sit * 0.04;
      patch.position.set(-0.06, 0.24, 0);
      patch.scale.set(0.62, 0.5, 0.8);
      chest.position.set(0.32, -0.1, 0);
      chest.scale.set(0.42, 0.62, 0.72);
      collarO.position.set(0.36, 0.12, 0);
      collarO.rotation.set(0, Math.PI / 2, 0.3);
      collarO.scale.set(1, 1, 0.42);

      // head: looks where it goes, at the person who made it stop (the tell), down when asleep
      let look = 0;
      if (c.st === S.alert || c.st === S.snub || sitting) {
        const p = people && c.look >= 0 ? people[c.look] : null;
        if (p) {
          const a = Math.atan2(p.z - z, p.x - x);
          look = Math.atan2(Math.sin(a - s.h), Math.cos(a - s.h));
          if (c.st === S.snub) look = 0;
          look = Math.max(-1.3, Math.min(1.3, look));
        }
      }
      s.head += (look - s.head) * Math.min(1, dt * (c.st === S.alert ? 22 : 6));
      const headUp = s.sit * 0.12;
      neck.position.set(0.27 + s.sit * 0.02 - loafK * 0.05, bodyY + 0.13 + headUp - loafK * 0.08 - (c.st === S.stalk ? 0.06 : 0), 0);
      neck.rotation.set(0, -s.head, 0);
      head.position.set(0, 0, 0);
      head.scale.setScalar(c.type === 'kitten' ? 1.25 : 1);
      head.rotation.set(0, 0, loafK * -0.25);
      const H = 0.34;
      // the head sphere is drawn through a scaled child-less transform: scale the head's own mesh via a nested trick
      muzzle.position.set(0.14, -0.05, 0);
      muzzle.scale.set(0.12, 0.09, 0.14);
      const flat = pushed || c.st === S.hidden || c.st === S.crouch ? 1 : 0;
      for (let e = 0; e < 2; e++) {
        const side = e ? 1 : -1;
        ears[e].position.set(0.0, 0.12, side * 0.085);
        ears[e].rotation.set(side * (0.25 + flat * 0.6), 0, -0.15 + flat * 0.95);
        ears[e].scale.set(0.09, 0.13 * (1 - flat * 0.25), 0.07);
        if (c.type === 'boss' && e === 0) ears[e].scale.y *= 0.7;
        eyes[e].position.set(0.15, 0.03, side * 0.07);
        const wide = c.type === 'scaredy' || c.type === 'zoomer' || c.type === 'kitten' ? 1.35 : 1;
        const blink = sleeping ? 0.12 : (Math.sin(t * 0.7 + i * 1.7) > 0.985 ? 0.15 : 1);
        eyes[e].scale.set(0.05 * wide, 0.065 * wide * blink, 0.05 * wide);
      }

      // legs: diagonal pairs swing; tucked when asleep, folded when sitting
      const legX = [0.17, 0.17, -0.17, -0.17];
      const legZ = [-0.085, 0.085, -0.085, 0.085];
      for (let l = 0; l < 4; l++) {
        const pair = l === 0 || l === 3 ? 0 : Math.PI;
        const front = l < 2;
        legs[l].position.set(legX[l] - (front ? 0 : s.sit * 0.04), bodyY - 0.02, legZ[l]);
        legs[l].rotation.set(0, 0, Math.sin(s.phase + pair) * gait);
        const fold = front ? 1 : 1 - s.sit * 0.55;
        legs[l].scale.set(0.075, sleeping ? 0.0 : (bodyY - 0.02) * fold, 0.075);
      }

      // tail: up and curled when happy, low and straight when pushed, puffed and twitching when scared, swishing on a perch
      const scared = c.type === 'scaredy' || c.st === S.alert;
      const tw = scared ? 1.35 : 1;
      let base = 0.9;
      if (pushed) base = 0.15;
      else if (c.st === S.lured || c.st === S.follow || c.st === S.content || c.st === S.march) base = 1.45;
      else if (sleeping) base = -0.1;
      for (let k = 0; k < TAIL; k++) {
        const tk = tail[k];
        if (k === 0) tk.position.set(-0.46, 0.14, 0);
        else tk.position.set(-0.8, 0, 0);
        const swish = c.st === S.perch || c.st === S.snub ? Math.sin(t * 3 + k * 0.6) * 0.35 : Math.sin(t * 1.6 + k * 0.7 + i) * 0.12;
        const shiver = c.st === S.hidden ? Math.sin(t * 40 + k) * 0.12 : 0;
        const curl = k === 0 ? base : (base > 1 ? 0.22 : base < 0.3 ? 0.02 : 0.12);
        tk.rotation.set(swish + shiver, swish * 0.6, -curl);
        if (sleeping) tk.rotation.set(0, 0.55, 0.15);
        // each segment scaled in the parent's (body's) squashed space: undo it on the first
        if (k === 0) tk.scale.set(0.15 / body.scale.x * tw, 0.085 / body.scale.y * tw, 0.085 / body.scale.z * tw);
        else tk.scale.set(0.96, 0.96, 0.96);
      }

      if (c.st === S.hidden) {
        // only the tail shows, poking out from under the furniture, shivering
        root.position.set(x, 0, z);
        root.rotation.set(0, -(s.h + Math.PI), 0);
        root.updateMatrix();
        body.position.set(0, 0.12, 0);
        body.scale.set(0.58, 0.3, 0.3);
        write(i, c, true);
      } else {
        // the head mesh is the neck's sphere; scale it via the head node
        write(i, c, false);
        // head sphere scale: apply through matrix (head node had scale for kitten); patch it here
        tmpM.copy(head.matrixWorld).scale(tmpV.set(H, H * 0.88, H * 1.02));
        parts.head.setMatrixAt(i, tmpM);
      }

      // a symbol above some cats when it matters
      const spr = symbols[i];
      let symName = null;
      let fill = '#fff3df';
      const dMe = me ? Math.hypot(me.x - x, me.z - z) : 0;
      if (c.type === 'boss') { symName = 'crown'; fill = '#f6b941'; }
      else if (c.type === 'loaf' && sleeping && dMe < 7) symName = 'z';
      else if (c.type === 'zoomer' && (c.st === S.wiggle || c.st === S.sprint)) { symName = 'bolt'; fill = c.st === S.wiggle && Math.sin(t * 30) > 0 ? '#f6b941' : '#fff3df'; }
      else if (c.type === 'scaredy' && (c.st === S.hidden || c.st === S.runhide)) { symName = '!'; fill = '#f6b941'; }
      else if (c.type === 'glutton' && c.st === S.lured) { symName = 'fish'; fill = '#f6b941'; }
      if (symName && c.st !== S.enter) {
        spr.visible = true;
        spr.material.map = tex(symName, fill);
        const bobS = reducedMotion ? 0 : Math.sin(t * 3 + i) * 0.05;
        spr.position.set(x, (c.y || 0) + 0.85 * size + bobS + (c.st === S.hidden ? -0.2 : 0), z);
        const big = c.type === 'boss' ? 0.55 : 0.45;
        spr.scale.set(big, big, 1);
      } else spr.visible = false;
    }
    for (let i = n; i < MAX; i++) {
      if (state[i]) { hideCat(i); state[i] = null; colored[i] = null; }
    }
    for (const m of Object.values(parts)) m.instanceMatrix.needsUpdate = true;
  }

  const tmpM = new THREE.Matrix4();
  const tmpV = new THREE.Vector3();

  function reset() {
    for (let i = 0; i < MAX; i++) { hideCat(i); state[i] = null; colored[i] = null; }
    for (const m of Object.values(parts)) m.instanceMatrix.needsUpdate = true;
  }

  return { group, update, reset, symbols };
}
