// Procedural animation for one cat: blended poses (stand, sit, loaf, curled sleep, crouch, arched hiss, butt wiggle,
// leap, scramble, groom), gaits from speed (walk, trot, rotary gallop) with feet planted by two-bone IK, a spine that
// bends into turns and flexes at the gallop, a head that steadies itself and looks at people, ears, tail and face.

import * as THREE from 'three';
import { BONE, TAIL_BONES } from './catmesh.js';
import { S } from '../sim/tuning.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const approach = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const FAST = new Set([S.flee, S.bolt, S.sprint, S.runhide, S.chase]);
const HAPPY = new Set([S.lured, S.follow, S.march, S.seek]);
const POSES = ['sit', 'loaf', 'sleep', 'crouch', 'arch', 'wiggle', 'leap', 'scramble'];

// gait tables: leg order FL, FR, HL, HR
const GAITS = [
  { off: [0.25, 0.75, 0.0, 0.5], duty: 0.64, stride: 0.3, lift: 0.05 }, // walk
  { off: [0.0, 0.5, 0.5, 0.0], duty: 0.5, stride: 0.44, lift: 0.07 }, // trot
  { off: [0.62, 0.5, 0.0, 0.12], duty: 0.36, stride: 0.74, lift: 0.085 }, // gallop
];

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _u = new THREE.Vector3();
const _m = new THREE.Matrix4(), _mh = new THREE.Matrix4(), _ms = new THREE.Matrix4(), _mc = new THREE.Matrix4();
const ONE = new THREE.Vector3(1, 1, 1);
const POLE_F = new THREE.Vector3(-1, 0.1, 0), POLE_H = new THREE.Vector3(1, 0.15, 0);

function eulerQ(q, x, y, z) { return q.setFromEuler(_e.set(x, y, z, 'YZX')); }

/** Two-bone IK: J joint, T target, a/b lengths, pole → writes the middle joint into E and the reached end into T. */
function ik(J, T, a, b, pole, E) {
  _u.subVectors(T, J);
  let d = _u.length();
  d = clamp(d, Math.abs(a - b) + 1e-4, (a + b) * 0.999);
  _u.normalize();
  const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  _v3.copy(pole).addScaledVector(_u, -pole.dot(_u)).normalize();
  E.copy(J).addScaledVector(_u, a * cosA).addScaledVector(_v3, a * sinA);
  T.copy(J).addScaledVector(_u, d);
}

/**
 * build: from buildCat; bones: this cat's bones; seed: 0..1.
 * update(c, dt, t, env) poses the bones from a simulation cat and returns face values for the shader.
 * env: { people, scale, reducedMotion }
 */
export function createAnimator(build, bones, seed = Math.random()) {
  const I = build.info;
  const R = build.rest;
  const legs = I.legs;
  const legIdx = [[BONE.flU, BONE.flL, BONE.flP], [BONE.frU, BONE.frL, BONE.frP], [BONE.hlU, BONE.hlL, BONE.hlP], [BONE.hrU, BONE.hrL, BONE.hrP]];
  // rest feet in root space: front wrists, hind paws
  const restFoot = legs.map((lg, i) => {
    const P = I.P;
    if (lg.front) return P[legIdx[i][2]].clone();
    return P[legIdx[i][2]].clone().addScaledVector(lg.restM, lg.m);
  });
  const yc = I.yc;
  const G = I.build.girth;
  const st = {
    h: null, hv: 0, spd: 0, phase: seed, w: Object.fromEntries(POSES.map((k) => [k, 0])),
    earFlat: 0, earFwd: 0, tailUp: 0, tailCurl: 0.3, tailWrap: 0, tailPuff: 1, sway: 0.15, swayF: 1.6, twitch: 0,
    pupil: 0.5, sleepy: 0, mouth: 0, blink: 0, blinkT: 1 + seed * 3, headYaw: 0, headPitch: 0, lookX: 0, lookY: 0,
    since: 0, last: -1, hop: 0, squash: 0, tumble: 0, tumbleDir: 1, earTw: 0, earTwT: 2 + seed * 4, groom: 0, groomOn: false,
    walkW: 1, trotW: 0, galW: 0, flash: 0, startle: 0, purr: 0,
  };
  const face = { pupil: 0.5, blink: 0, mouth: 0, sleepy: 0, lookX: 0, lookY: 0, breath: 0 };

  function poseTargets(c, env) {
    const T = { sit: 0, loaf: 0, sleep: 0, crouch: 0, arch: 0, wiggle: 0, leap: 0, scramble: 0 };
    const A = { earFlat: 0, earFwd: 0.2, tailUp: -0.35, tailCurl: 0.55, tailWrap: 0, tailPuff: 1, sway: 0.14, swayF: 1.3, twitch: 0, pupil: 0.45, sleepy: 0, mouth: 0, look: c.look };
    const loafy = c.type === 'loaf';
    const since = st.since;
    switch (c.st) {
      case S.idle:
        if (loafy) { T.loaf = 1; A.sleepy = 0.55; A.tailWrap = 1; }
        else if (since > 1.1) { T.sit = 1; A.tailWrap = 1; A.sway = 0.08; }
        break;
      case S.walk: case S.arrive: case S.seek: A.tailUp = 0.75; A.tailCurl = 0.45; A.earFwd = 0.5; break;
      case S.chase:
        // hunting the dot: ears up, eyes wide, a butt wiggle when it's right there
        A.earFwd = 1; A.pupil = 1; A.tailUp = 0.25; A.tailCurl = 0.2; A.sway = 0.3; A.swayF = 4; A.twitch = 1;
        if ((c.sp || 0) < 0.8) { T.wiggle = 1; A.tailUp = -0.1; } else T.crouch = 0.25;
        break;
      case S.ride: T.loaf = 1; A.sleepy = 0.45; A.tailWrap = 1; A.earFwd = 0.6; A.sway = 0.05; break;
      case S.boxsit: T.sit = 1; A.earFwd = 0.9; A.tailWrap = 1; A.pupil = 0.75; A.sway = 0.05; break;
      case S.nap: T.sleep = 1; A.sleepy = 1; A.tailWrap = 1; A.earFwd = 0; A.sway = 0.02; break;
      case S.alert:
        A.tailUp = 0.9; A.tailCurl = 0.1; A.sway = 0; A.tailPuff = 1.25; A.earFlat = 0.35; A.earFwd = 1; A.pupil = 1; T.crouch = 0.3;
        break;
      case S.flee: case S.bolt: case S.sprint: case S.runhide:
        A.tailUp = 0.05; A.tailCurl = 0; A.sway = 0.04; A.earFlat = 1; A.pupil = 1; T.crouch = 0.3;
        if (c.st === S.sprint) { A.tailUp = 0.35; A.tailPuff = 1.15; }
        break;
      case S.slip: T.scramble = 1; A.earFlat = 0.8; A.pupil = 1; A.mouth = 0.35; A.tailUp = 0.6; A.tailPuff = 1.3; break;
      case S.settle: A.earFlat = 0.35; A.tailUp = 0.2; A.pupil = 0.7; break;
      case S.lured: case S.follow: case S.march:
        A.tailUp = 1.25; A.tailCurl = 0.9; A.earFwd = 1; A.pupil = 0.85; A.sway = 0.1; A.swayF = 2; break;
      case S.content:
        if (loafy) T.loaf = 1; else T.sit = 1;
        A.sleepy = 0.7; A.tailWrap = 1; A.pupil = 0.3; A.earFwd = 0.3; break;
      case S.trot: A.tailUp = 0.45; A.earFlat = 0.5; A.pupil = 0.8; break;
      case S.crouch: T.crouch = 1; A.earFlat = 0.85; A.tailUp = -0.9; A.tailCurl = 0; A.pupil = 1; A.sway = 0.02; break;
      case S.enter: T.crouch = 0.6; A.earFlat = 0.5; A.tailUp = 0.4; A.pupil = 0.9; break;
      case S.bump: T.scramble = 0.8; A.earFlat = 1; A.pupil = 1; A.mouth = 0.7; A.tailPuff = 1.4; A.tailUp = 0.9; break;
      case S.hop: T.leap = 1; A.earFwd = 1; A.tailUp = 0.2; A.pupil = 0.9; break;
      case S.perch:
        if (loafy) T.loaf = 1; else T.sit = 1;
        A.tailWrap = -1; A.sway = 0.35; A.swayF = 1.1; A.earFwd = 0.6; A.sleepy = 0.2; break;
      case S.hidden: T.crouch = 1; T.loaf = 0.5; A.earFlat = 1; A.pupil = 1; A.tailUp = -0.2; A.twitch = 1; A.tailCurl = 0; break;
      case S.creep: T.crouch = 1; A.earFlat = 0.6; A.tailUp = -0.6; A.pupil = 1; A.tailCurl = 0.1; break;
      case S.sleep: T.sleep = 1; A.sleepy = 1; A.tailWrap = 1; A.earFwd = 0; A.sway = 0.02; break;
      case S.scoot: T.loaf = 1; A.earFlat = 0.4; A.tailWrap = 0.6; A.sleepy = 0.3; break;
      case S.wiggle: T.wiggle = 1; A.earFwd = 1; A.pupil = 1; A.tailUp = -0.15; A.tailCurl = 0; A.twitch = 1; A.sway = 0; break;
      case S.snub: T.sit = 1; A.sleepy = 0.55; A.tailWrap = 0.4; A.sway = 0.3; A.swayF = 2.2; A.look = -1; break;
      case S.stalk: T.crouch = 0.75; A.earFlat = 0.25; A.earFwd = 1; A.tailUp = -0.5; A.sway = 0.25; A.swayF = 3; A.pupil = 0.9; break;
      case S.hold: T.arch = 0.0; A.earFwd = 1; A.tailUp = 0.7; A.tailPuff = 1.1; A.pupil = 0.6; break;
      default: break;
    }
    if (c.type === 'boss' && (c.st === S.alert || c.st === S.stalk)) { T.arch = 0.6; A.mouth = 0.8; A.tailPuff = 1.5; }
    if (c.type === 'scaredy' && (FAST.has(c.st) || c.st === S.alert)) A.tailPuff = Math.max(A.tailPuff, 1.55);
    return { T, A };
  }

  const J = new THREE.Vector3(), Tg = new THREE.Vector3(), E = new THREE.Vector3(), H = new THREE.Vector3();
  const qParent = new THREE.Quaternion(), qU = new THREE.Quaternion(), qL = new THREE.Quaternion();
  const feet = restFoot.map((p) => p.clone());

  function update(c, dt, t, env) {
    const scale = env.scale || 1;
    if (c.st !== st.last) {
      if (c.st === S.alert || c.st === S.crouch) { st.squash = 1; st.startle = 1; }
      if (c.st === S.bump) { st.tumble = 1; st.tumbleDir = Math.random() < 0.5 ? -1 : 1; }
      // knocked on by another cat: a roll as it goes
      if (c.st === S.bolt && (c.chain || 0) > 0) { st.tumble = 1; st.tumbleDir = Math.random() < 0.5 ? -1 : 1; st.squash = 1; }
      if (st.last === S.hop) st.squash = 0.8;
      st.last = c.st;
      st.since = 0;
      st.groomOn = false;
    }
    st.since += dt;
    // heading & turn rate
    if (st.h === null) st.h = c.h;
    const fast = FAST.has(c.st) || c.st === S.slip;
    const dh = wrapA(c.h - st.h);
    const turn = Math.min(1, dt * (fast ? 16 : 9));
    st.h = wrapA(st.h + dh * turn);
    st.hv = approach(st.hv, dt > 0 ? (dh * turn) / dt : 0, 10, dt);
    const moving = !(c.st === S.hop || c.st === S.enter || c.st === S.perch || c.st === S.hidden || c.st === S.bump || c.st === S.ride || c.st === S.boxsit || c.st === S.scoot);
    const vM = (moving ? Math.max(0, c.sp || 0) : 0) / scale;
    st.spd = approach(st.spd, vM, 12, dt);

    // pose weights
    const { T, A } = poseTargets(c, env);
    // grooming: a long sit sometimes turns into licking a paw
    if (T.sit > 0.5 && st.since > 3 + seed * 4 && !st.groomOn && c.st === S.idle) st.groomOn = ((st.since * 7 + seed * 13) % 9) < 5;
    const groomT = st.groomOn && T.sit > 0.5 ? 1 : 0;
    st.groom = approach(st.groom, groomT, 6, dt);
    const poseRate = c.st === S.hop ? 18 : fast ? 14 : 7;
    for (const k of POSES) st.w[k] = approach(st.w[k], T[k], poseRate, dt);
    for (const k of ['earFlat', 'earFwd', 'tailUp', 'tailCurl', 'tailWrap', 'tailPuff', 'sway', 'swayF', 'twitch', 'pupil', 'sleepy', 'mouth']) {
      st[k] = approach(st[k], A[k], k === 'earFlat' || k === 'pupil' ? 14 : 6, dt);
    }
    st.squash = Math.max(0, st.squash - dt * 4);
    st.startle = Math.max(0, st.startle - dt * 3.5);
    st.tumble = Math.max(0, st.tumble - dt * 3.3);

    // gait mix
    const gal = sstep(2.3, 3.3, st.spd);
    const trot = sstep(0.95, 1.5, st.spd) * (1 - gal);
    const walk = 1 - gal - trot;
    let off = [0, 0, 0, 0];
    let duty = 0, stride = 0, lift = 0;
    const gw = [walk, trot, gal];
    for (let g = 0; g < 3; g++) {
      const gt = GAITS[g];
      for (let l = 0; l < 4; l++) off[l] += gt.off[l] * gw[g];
      duty += gt.duty * gw[g];
      stride += gt.stride * gw[g];
      lift += gt.lift * gw[g];
    }
    let gaitV = st.spd;
    const turning = Math.abs(st.hv) > 1.2 && st.spd < 0.4 && moving && st.w.sit < 0.3 && st.w.loaf < 0.3 && st.w.sleep < 0.3;
    if (turning) gaitV = 0.5;
    if (st.w.scramble > 0.3) { gaitV = Math.max(gaitV, 3.5); duty = 0.4; }
    stride *= clamp(0.65 + 0.25 * gaitV, 0.6, 1.25);
    const freq = gaitV * duty / Math.max(0.1, stride);
    st.phase = (st.phase + freq * dt) % 1;
    const amp = sstep(0.03, 0.35, gaitV) * (1 - Math.max(st.w.sit, st.w.loaf, st.w.sleep, st.w.leap));
    const ph = st.phase * Math.PI * 2;

    // ---- body
    const w = st.w;
    const stand = Math.max(0, 1 - (w.sit + w.loaf + w.sleep + w.crouch + w.arch + w.wiggle + w.leap + w.scramble));
    const sum = Math.max(1, w.sit + w.loaf + w.sleep + w.crouch + w.arch + w.wiggle + w.leap + w.scramble);
    const k = (v) => v / sum;
    const low = yc - 0.112 * G;
    let hipsDy = k(w.sit) * -(yc - 0.1 * G) + k(w.loaf + w.sleep) * -low + k(w.crouch) * -0.065 + k(w.arch) * 0.035 + k(w.wiggle) * -0.03 + k(w.scramble) * -0.04;
    let chestDy = k(w.crouch) * -0.01 + k(w.wiggle) * -0.025;
    let hipsP = k(w.sit) * 0.58 + k(w.arch) * 0.42 + k(w.wiggle) * -0.2 + k(w.leap) * 0.1;
    let spineP = k(w.sit) * -0.04 + k(w.arch) * -0.28 + k(w.crouch) * -0.02;
    let chestP = k(w.sit) * -0.1 + k(w.arch) * -0.5 + k(w.crouch) * -0.06 + k(w.wiggle) * -0.06 + k(w.leap) * -0.1;
    let bend = k(w.sleep) * 0.42;
    let headWorldP = k(w.sit) * 0.06 + k(w.loaf) * -0.05 + k(w.sleep) * -0.32 + k(w.crouch) * 0.1 + k(w.wiggle) * 0.15 + k(w.arch) * -0.05;
    let neckP = k(w.sit) * 0.05 + k(w.loaf) * -0.35 + k(w.sleep) * -0.55 + k(w.crouch) * -0.45 + k(w.wiggle) * -0.35 + k(w.arch) * 0.2;
    let headRoll = k(w.sleep) * 0.45;
    let stretch = k(w.leap) * 0.04;
    // gait motion
    const flex = Math.sin(ph - 0.6);
    stretch += 0.032 * flex * gal * amp;
    hipsP += 0.14 * flex * gal * amp;
    chestP += -0.2 * flex * gal * amp;
    hipsDy += (0.02 * Math.sin(ph) * gal + 0.006 * Math.cos(ph * 2) * (walk + trot)) * amp;
    chestDy += 0.024 * Math.sin(ph + 2.2) * gal * amp;
    const hipsRoll = 0.06 * Math.sin(ph) * walk * amp;
    // into turns
    bend += clamp(st.hv * 0.06, -0.3, 0.3) * (1 - w.sleep);
    // startle hop & squash
    const startleY = Math.sin(Math.min(1, (1 - st.startle) * 1.4) * Math.PI) * 0.08 * (st.startle > 0 ? 1 : 0);
    if (st.startle > 0 && !env.reducedMotion) hipsDy += startleY;
    // wiggle: the rear sways fast
    const wig = w.wiggle * Math.sin(t * 34) * 0.22;
    // breathing / purr
    const breath = Math.sin(t * (w.sleep > 0.5 ? 1.8 : 3.2) + seed * 6) * (0.4 + w.sleep + w.loaf * 0.6);

    const bh = bones[BONE.hips];
    bh.position.copy(R[BONE.hips]).add(_v.set(0, hipsDy, 0));
    eulerQ(bh.quaternion, hipsRoll + st.tumble * st.tumbleDir * Math.sin(st.tumble * Math.PI) * 0.9, -bend + wig, hipsP);
    const bs = bones[BONE.spine];
    bs.position.copy(R[BONE.spine]).add(_v.set(stretch, 0, 0));
    eulerQ(bs.quaternion, 0, bend * 0.9 - wig * 0.6, spineP);
    const bc = bones[BONE.chest];
    bc.position.copy(R[BONE.chest]).add(_v.set(stretch * 0.6, chestDy - hipsDy * 0, 0));
    eulerQ(bc.quaternion, 0, bend, chestP);

    // ---- head: looks along its way, at whoever made it stop, or away (a snub)
    let lookYaw = clamp(st.hv * 0.14, -0.6, 0.6);
    let lookPitch = 0;
    const p = env.people && A.look >= 0 ? env.people[A.look] : null;
    if (p && (c.st === S.alert || c.st === S.perch || c.st === S.hold || c.st === S.stalk || w.sit > 0.5 || c.st === S.crouch || c.st === S.content)) {
      const a = Math.atan2(p.z - c.z, p.x - c.x);
      lookYaw = clamp(wrapA(a - st.h), -1.35, 1.35);
      lookPitch = 0.22;
    }
    if (c.st === S.snub) lookYaw = Math.sin(seed * 10) > 0 ? 1.2 : -1.2;
    if (w.sleep > 0.5) lookYaw = 0.7;
    // a quick look round now and then
    if (c.st === S.idle && st.since > 0.8) lookYaw += Math.sin(t * 0.7 + seed * 9) * 0.5 * sstep(0.6, 1, Math.sin(t * 0.31 + seed * 5));
    st.headYaw = approach(st.headYaw, lookYaw, c.st === S.alert ? 20 : 7, dt);
    st.headPitch = approach(st.headPitch, lookPitch, 7, dt);
    const groomK = st.groom;
    const bodyP = hipsP + spineP + chestP;
    const bn = bones[BONE.neck];
    eulerQ(bn.quaternion, 0, st.headYaw * 0.4, neckP * (1 - groomK) - 0.4 * groomK);
    const hd = bones[BONE.head];
    const headLocalP = headWorldP + st.headPitch - (bodyP + neckP) * (1 - groomK) * 0.85 - groomK * 0.35
      + Math.sin(t * 9) * 0.12 * groomK;
    eulerQ(hd.quaternion, headRoll + groomK * 0.3, st.headYaw * 0.6 - bend * 0.5, headLocalP);

    // ---- ears
    st.earTwT -= dt;
    if (st.earTwT <= 0) { st.earTw = 1; st.earTwT = 1.5 + ((seed * 97 + t) % 4); }
    st.earTw = Math.max(0, st.earTw - dt * 5);
    for (const [bi, side] of [[BONE.earL, -1], [BONE.earR, 1]]) {
      const f = st.earFlat;
      const tw = st.earTw * (side < 0 ? 1 : 0.4) * (1 - f);
      eulerQ(bones[bi].quaternion, side * (f * 0.75 + 0.05), -side * (f * 0.5 - st.earFwd * 0.15 + tw * 0.5), -f * 0.85 + st.earFwd * 0.12);
    }

    // ---- legs
    _mh.compose(bh.position, bh.quaternion, ONE);
    _ms.compose(bs.position, bs.quaternion, ONE);
    _mc.compose(bc.position, bc.quaternion, ONE);
    _ms.premultiply(_mh);
    _mc.premultiply(_ms);
    for (let l = 0; l < 4; l++) {
      const lg = legs[l];
      const [bu, bl, bp] = legIdx[l];
      const parentM = lg.front ? _mc : _mh;
      J.copy(R[bu]).applyMatrix4(parentM);
      qParent.setFromRotationMatrix(parentM);
      const rf = restFoot[l];
      // the pose's foot
      const front = lg.front;
      let tx = rf.x, ty = rf.y, tz = rf.z * 1.05;
      let mdx = Math.sin(0.17), mdy = -Math.cos(0.17); // hind: hock→paw
      const blendTo = (wgt, x, y, z, mx = null, my = null) => {
        if (wgt <= 0.001) return;
        tx += (x - tx) * wgt; ty += (y - ty) * wgt; tz += (z - tz) * wgt;
        if (mx !== null) { mdx += (mx - mdx) * wgt; mdy += (my - mdy) * wgt; }
      };
      const jx = R[bu].x + (front ? R[BONE.chest].x : 0) + (front ? R[BONE.spine].x + R[BONE.hips].x : R[BONE.hips].x);
      if (front) {
        blendTo(k(w.crouch), rf.x + 0.02, rf.y, rf.z * 1.15);
        blendTo(k(w.arch), rf.x + 0.03, rf.y, rf.z);
        blendTo(k(w.wiggle), rf.x + 0.06, rf.y, rf.z * 1.1);
        blendTo(k(w.sit), J.x + 0.015, rf.y, rf.z * 0.85);
        blendTo(k(w.loaf + w.sleep), J.x + 0.035, 0.03, rf.z * 0.8);
        blendTo(k(w.leap), J.x + 0.16, J.y - 0.14, rf.z * 0.8);
        if (l === 0 && groomK > 0.01) blendTo(groomK, I.headC.x - 0.02, I.headC.y - 0.1, -0.015);
      } else {
        blendTo(k(w.crouch), rf.x - 0.02, rf.y, rf.z * 1.15);
        blendTo(k(w.arch), rf.x - 0.04, rf.y, rf.z);
        blendTo(k(w.sit), J.x + 0.13, rf.y, rf.z * 1.55, 1, -0.12);
        blendTo(k(w.loaf + w.sleep), J.x + 0.1, 0.022, rf.z * 1.15, 1, -0.02);
        blendTo(k(w.leap), J.x - 0.17, J.y - 0.12, rf.z * 0.9, -0.7, -0.7);
      }
      void jx;
      // the gait on top
      if (amp > 0.001) {
        const u = (st.phase + off[l]) % 1;
        let dx, dy = 0;
        const sw = clamp((u - duty) / (1 - duty), 0, 1);
        if (u < duty) dx = stride * (0.5 - u / duty);
        else { const e = sw * sw * (3 - 2 * sw); dx = stride * (-0.5 + e); dy = lift * Math.sin(Math.PI * sw) * (front ? 1 : 0.85); }
        tx += dx * amp;
        ty += dy * amp;
        if (!front && u >= duty) { const tilt = Math.sin(Math.PI * sw) * 0.9 * amp; mdx -= tilt * 0.8; }
        if (w.scramble > 0.1) tz += Math.sin(u * 6.28) * 0.04 * w.scramble * lg.side;
      }
      Tg.set(tx, ty, tz);
      const pole = front ? POLE_F : POLE_H;
      if (front) {
        ik(J, Tg, lg.a, lg.b, pole, E);
        _v.subVectors(E, J).normalize();
        qU.setFromUnitVectors(lg.restU, _v);
        _v2.subVectors(Tg, E).normalize();
        qL.setFromUnitVectors(lg.restL, _v2);
        bones[bu].quaternion.copy(qParent).invert().multiply(qU);
        bones[bl].quaternion.copy(qU).invert().multiply(qL);
        // paw: flat on the floor, toes down in the swing, curled up when groomed
        const swingTilt = ty > rf.y + 0.005 ? -(ty - rf.y) * 8 : 0;
        eulerQ(_q, 0, 0, swingTilt + groomK * (l === 0 ? 1.2 : 0));
        bones[bp].quaternion.copy(qL).invert().multiply(_q);
      } else {
        const ml = Math.hypot(mdx, mdy) || 1;
        mdx /= ml; mdy /= ml;
        H.set(Tg.x - mdx * lg.m, Tg.y - mdy * lg.m, Tg.z);
        ik(J, H, lg.a, lg.b, pole, E);
        _v.subVectors(E, J).normalize();
        qU.setFromUnitVectors(lg.restU, _v);
        _v2.subVectors(H, E).normalize();
        qL.setFromUnitVectors(lg.restL, _v2);
        _v3.set(mdx, mdy, 0);
        _q2.setFromUnitVectors(lg.restM, _v3);
        bones[bu].quaternion.copy(qParent).invert().multiply(qU);
        bones[bl].quaternion.copy(qU).invert().multiply(qL);
        bones[bp].quaternion.copy(qL).invert().multiply(_q2);
      }
      feet[l].copy(Tg);
    }

    // ---- tail: free (up, curled, swishing), wrapped round the body on the floor, or dangling off a perch
    const up = st.tailUp;
    const curl = st.tailCurl;
    const wrapK = Math.max(0, st.tailWrap);
    const dangle = Math.max(0, -st.tailWrap);
    const wrapDir = w.sleep > 0.3 ? -1 : seed > 0.5 ? 1 : -1;
    const swayAmp = env.reducedMotion ? st.sway * 0.5 : st.sway;
    for (let i = 0; i < TAIL_BONES; i++) {
      const b = bones[BONE.tail + i];
      const f = i / (TAIL_BONES - 1);
      let pitch = i === 0 ? -up * 0.75 : i < 3 ? -up * 0.12 : -curl * 0.3 * (f - 0.2);
      let yaw = 0;
      if (wrapK > 0.001) {
        const wp = i === 0 ? 1.0 - hipsP : i === 1 ? -0.78 : i === 2 ? -0.22 : 0;
        const wy = i >= 1 ? wrapDir * 0.36 : 0;
        pitch += (wp - pitch) * wrapK;
        yaw += wy * wrapK;
      }
      if (dangle > 0.001) {
        const dp = i === 0 ? 1.4 - hipsP : i < 4 ? 0.1 : -0.04;
        pitch += (dp - pitch) * dangle;
      }
      yaw += Math.sin(t * st.swayF * 2 - i * 0.55 + seed * 6) * swayAmp * (0.3 + f) * (1 - wrapK * 0.7);
      if (st.twitch > 0.01 && i >= 5) yaw += Math.sin(t * 22 + i) * 0.35 * st.twitch;
      eulerQ(b.quaternion, 0, yaw, pitch);
      if (i === 0) b.scale.set(1, st.tailPuff, st.tailPuff);
    }

    // ---- face
    st.blinkT -= dt;
    if (st.blinkT <= 0) { st.blink = 1; st.blinkT = 1.8 + ((seed * 31 + t * 0.37) % 1) * 4; }
    st.blink = Math.max(0, st.blink - dt * 7);
    const blinkV = st.blink > 0 ? Math.sin(st.blink * Math.PI) : 0;
    face.pupil = st.pupil;
    face.blink = Math.max(blinkV, w.sleep, c.st === S.content ? (Math.sin(t * 0.9 + seed * 4) > 0.6 ? 0.9 : 0) : 0);
    face.sleepy = st.sleepy;
    face.mouth = Math.max(st.mouth, groomK * (Math.sin(t * 9) > 0.2 ? 0.4 : 0));
    face.lookX = clamp(st.headYaw - lookYaw, -0.25, 0.25) * -0.6;
    face.lookY = 0;
    face.breath = breath;
    return face;
  }

  return { update, st, feet };
}
