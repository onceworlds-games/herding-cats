// The cat, built in code: a body plan (a trunk swept from rump to head, a head with cheeks, muzzle and whisker pads,
// cupped ears, four jointed legs with paws, an eight-bone tail and two eyes) skinned to a 28-bone skeleton. Each
// personality has its own build. Every vertex also carries where it sits on the cat (`aRest`, model space) and a
// part-relative coordinate (`aAux`), so the fur shader can paint coats from the body itself.
//
// Model space: x forward (nose), y up, z across. A build is about 0.85 long from nose to rump at size 1.

import * as THREE from 'three';

export const BONE = {
  root: 0, hips: 1, spine: 2, chest: 3, neck: 4, head: 5, earL: 6, earR: 7,
  flU: 8, flL: 9, flP: 10, frU: 11, frL: 12, frP: 13,
  hlU: 14, hlL: 15, hlP: 16, hrU: 17, hrL: 18, hrP: 19,
  tail: 20, // 20..27
};
export const TAIL_BONES = 8;
const PARENT = [-1, 0, 1, 2, 3, 4, 5, 5, 3, 8, 9, 3, 11, 12, 1, 14, 15, 1, 17, 18, 1, 20, 21, 22, 23, 24, 25, 26];

// part ids the shader reads
export const PART = { trunk: 0, head: 1, earBack: 2, earFront: 3, leg: 4, paw: 5, tail: 6, eye: 7, nose: 8 };

/** Body plans, relative to the moggy. */
export const BUILDS = {
  moggy: {},
  loaf: { girth: 1.16, belly: 0.25, legLen: 0.86, legThick: 1.1, cheeks: 1.3, tailLen: 0.9, tailThick: 1.1, headR: 1.03, earSize: 0.92 },
  zoomer: { len: 1.1, girth: 0.86, legLen: 1.18, legThick: 0.9, headR: 0.93, earSize: 1.22, tailLen: 1.18, tailThick: 0.85, muzzle: 1.1, eyeSize: 1.08 },
  scaredy: { girth: 0.92, legLen: 1.0, earSize: 1.18, eyeSize: 1.28, tailThick: 1.35, tailLen: 1.05, cheeks: 0.9, fluff: 0.7 },
  glutton: { girth: 1.34, belly: 0.62, legLen: 0.84, legThick: 1.12, headR: 1.08, cheeks: 1.45, tailLen: 0.86, tailThick: 1.2, earSize: 0.9 },
  kitten: { len: 0.82, girth: 1.0, legLen: 0.88, legThick: 1.05, headR: 1.42, muzzle: 0.72, earSize: 1.14, eyeSize: 1.5, tailLen: 0.7, tailThick: 1.15, cheeks: 0.9 },
  boss: { len: 1.05, girth: 1.22, legLen: 1.02, legThick: 1.18, headR: 1.16, cheeks: 1.9, jowls: 1, earSize: 0.86, torn: true, tailThick: 1.3, neck: 1.25, fluff: 0.5 },
};

const DEF = { len: 1, girth: 1, belly: 0, legLen: 1, legThick: 1, headR: 1, muzzle: 1, cheeks: 1, jowls: 0, earSize: 1, eyeSize: 1, tailLen: 1, tailThick: 1, neck: 1, torn: false, fluff: 0 };

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

class Mesh {
  constructor() {
    this.pos = []; this.si = []; this.sw = []; this.rest = []; this.aux = []; this.part = []; this.idx = [];
  }
  /** w: [[bone, weight], ...] */
  vert(p, w, part, aux, rest = p) {
    this.pos.push(p.x, p.y, p.z);
    this.rest.push(rest.x, rest.y, rest.z);
    this.aux.push(aux[0], aux[1], aux[2]);
    this.part.push(part);
    const ws = w.filter((e) => e[1] > 0.001).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = ws.reduce((s, e) => s + e[1], 0) || 1;
    for (let k = 0; k < 4; k++) {
      this.si.push(ws[k] ? ws[k][0] : 0);
      this.sw.push(ws[k] ? ws[k][1] / sum : 0);
    }
    return this.pos.length / 3 - 1;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }
}

const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

function mixWeights(a, b, t) {
  const m = new Map();
  for (const [k, w] of a) m.set(k, (m.get(k) ?? 0) + w * (1 - t));
  for (const [k, w] of b) m.set(k, (m.get(k) ?? 0) + w * t);
  return [...m.entries()];
}

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return v3(
    0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    0.5 * (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
  );
}

/**
 * Sweeps rings along control points: [{ p, ry, rz, w, bot? }]. Rings are sampled smoothly between controls
 * (`sub` per span), framed by parallel transport from `up`, and closed with rounded caps.
 * aux = (s along 0..1, sin θ (1 = the dorsal side), cos θ).
 */
function sweep(M, ctrl, { n = 18, sub = 3, part, up = v3(0, 1, 0), capStart = 1, capEnd = 1, shape = null }) {
  const rings = [];
  const N = ctrl.length;
  for (let i = 0; i < N - 1; i++) {
    const a = ctrl[Math.max(0, i - 1)], b = ctrl[i], c = ctrl[i + 1], d = ctrl[Math.min(N - 1, i + 2)];
    for (let k = 0; k < sub; k++) {
      const t = k / sub;
      const ts = smooth(t);
      rings.push({
        p: catmull(a.p, b.p, c.p, d.p, t),
        ry: lerp(b.ry, c.ry, ts), rz: lerp(b.rz, c.rz, ts),
        bot: lerp(b.bot ?? 0, c.bot ?? 0, ts),
        w: mixWeights(b.w, c.w, ts),
      });
    }
  }
  const last = ctrl[N - 1];
  rings.push({ p: last.p.clone(), ry: last.ry, rz: last.rz, bot: last.bot ?? 0, w: last.w });
  // arc length for s
  let total = 0;
  rings[0].s = 0;
  for (let i = 1; i < rings.length; i++) { total += rings[i].p.distanceTo(rings[i - 1].p); rings[i].s = total; }
  for (const r of rings) r.s /= total || 1;
  // frames
  let nup = up.clone();
  for (let i = 0; i < rings.length; i++) {
    const prev = rings[Math.max(0, i - 1)].p, next = rings[Math.min(rings.length - 1, i + 1)].p;
    const T = next.clone().sub(prev).normalize();
    nup.sub(T.clone().multiplyScalar(nup.dot(T))).normalize();
    rings[i].T = T;
    rings[i].up = nup.clone();
    rings[i].side = new THREE.Vector3().crossVectors(T, nup).normalize();
  }
  const ringVerts = (r, scale = 1, offset = 0) => {
    const ids = [];
    for (let k = 0; k < n; k++) {
      const th = (k / n) * Math.PI * 2;
      const c = Math.cos(th), s = Math.sin(th);
      let ry = r.ry, rz = r.rz;
      if (s < 0) ry *= 1 + r.bot * -s; // a belly that hangs
      if (shape) ({ ry, rz } = shape(r, s, c, ry, rz));
      const p = r.p.clone()
        .addScaledVector(r.side, c * rz * scale)
        .addScaledVector(r.up, s * ry * scale)
        .addScaledVector(r.T, offset);
      ids.push(M.vert(p, r.w, part, [r.s, s, c]));
    }
    return ids;
  };
  const all = [];
  // start cap (rounded)
  const capRings = (r, dir, rounds) => {
    const out = [];
    const len = Math.min(r.ry, r.rz) * rounds;
    for (let k = 3; k >= 1; k--) {
      const a = (k / 4) * Math.PI / 2;
      out.push(ringVerts(r, Math.cos(a), dir * Math.sin(a) * len));
    }
    return out;
  };
  let startTip = -1;
  if (capStart) {
    const r = rings[0];
    startTip = M.vert(r.p.clone().addScaledVector(r.T, -Math.min(r.ry, r.rz) * capStart), r.w, part, [0, 0, 0]);
    all.push(...capRings(r, -1, capStart));
  }
  for (const r of rings) all.push(ringVerts(r));
  let endTip = -1;
  if (capEnd) {
    const r = rings[rings.length - 1];
    all.push(...capRings(r, 1, capEnd).reverse());
    endTip = M.vert(r.p.clone().addScaledVector(r.T, Math.min(r.ry, r.rz) * capEnd), r.w, part, [1, 0, 0]);
  }
  for (let i = 0; i < all.length - 1; i++) {
    const A = all[i], B = all[i + 1];
    for (let k = 0; k < n; k++) {
      const k1 = (k + 1) % n;
      M.quad(A[k], B[k], B[k1], A[k1]);
    }
  }
  if (startTip >= 0) { const A = all[0]; for (let k = 0; k < n; k++) M.tri(startTip, A[k], A[(k + 1) % n]); }
  if (endTip >= 0) { const A = all[all.length - 1]; for (let k = 0; k < n; k++) M.tri(endTip, A[(k + 1) % n], A[k]); }
  return rings;
}

const gauss = (d, c, s) => Math.exp(-(1 - d.dot(c)) / (s * s));

/** An ellipsoid sphere grid with a displacement, all on one bone. */
function blob(M, center, radii, { part, w, lat = 10, lon = 14, disp = null, aux = null, rot = null }) {
  const rows = [];
  for (let i = 0; i <= lat; i++) {
    const phi = (i / lat) * Math.PI; // 0 top .. π bottom
    const row = [];
    const count = i === 0 || i === lat ? 1 : lon;
    for (let j = 0; j < count; j++) {
      const th = (j / lon) * Math.PI * 2;
      const d = v3(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
      let r = 1;
      if (disp) r += disp(d);
      let p = v3(d.x * radii.x * r, d.y * radii.y * r, d.z * radii.z * r);
      if (rot) p.applyQuaternion(rot);
      p.add(center);
      row.push(M.vert(p, w, part, aux ? aux(d, r) : [d.x, d.y, d.z]));
    }
    rows.push(row);
  }
  for (let i = 0; i < lat; i++) {
    const A = rows[i], B = rows[i + 1];
    for (let j = 0; j < lon; j++) {
      const j1 = (j + 1) % lon;
      if (A.length === 1) M.tri(A[0], B[j1], B[j]);
      else if (B.length === 1) M.tri(A[j], A[j1], B[0]);
      else M.quad(A[j], A[j1], B[j1], B[j]);
    }
  }
}

/**
 * Builds one personality: { geometry, rest: [Vector3 per bone, relative to parent], info }.
 * `info` holds the numbers the animator needs (leg lengths, joint spots, heights).
 */
export function buildCat(type) {
  const b = { ...DEF, ...(BUILDS[type] ?? {}) };
  const L = b.len, G = b.girth, LL = b.legLen;
  const M = new Mesh();

  // ---- skeleton (model space)
  const yc = 0.165 * LL + 0.125 * G; // torso centre height standing
  const P = [];
  P[BONE.root] = v3(0, 0, 0);
  P[BONE.hips] = v3(-0.19 * L, yc, 0);
  P[BONE.spine] = v3(-0.01 * L, yc + 0.004, 0);
  P[BONE.chest] = v3(0.16 * L, yc + 0.012, 0);
  P[BONE.neck] = v3(0.25 * L, yc + 0.05 * G, 0);
  const hr = 0.083 * b.headR;
  const headC = v3(0.25 * L + 0.112 + 0.03 * (b.headR - 1), yc + 0.178 + 0.05 * (b.headR - 1), 0);
  P[BONE.head] = headC.clone();
  // front legs
  const shoulderY = yc - 0.015 * G;
  const fTotal = (shoulderY - 0.022) / 0.97;
  const fa = fTotal * 0.52, fb = fTotal * 0.48;
  const pawH = 0.022 * b.legThick;
  // hind legs
  const hipY = yc - 0.005;
  const hDrop = hipY - 0.016;
  const hS = hDrop / 0.927;
  const ta = hS * 0.38, tb = hS * 0.36, tm = hS * 0.26;
  const legs = [];
  for (const side of [-1, 1]) {
    const S = v3(0.17 * L, shoulderY, side * 0.062 * G);
    const E = S.clone().add(v3(-0.028, -fa * 0.995, 0));
    const W = E.clone().add(v3(0.012, -fb * 0.998, 0));
    legs.push({ front: true, side, J: S, K: E, W, a: fa, b: fb });
  }
  for (const side of [-1, 1]) {
    const H = v3(-0.2 * L, hipY, side * 0.07 * G);
    const K = H.clone().add(v3(Math.sin(0.35) * ta, -Math.cos(0.35) * ta, 0));
    const A = K.clone().add(v3(-Math.sin(0.52) * tb, -Math.cos(0.52) * tb, 0));
    const F = A.clone().add(v3(Math.sin(0.17) * tm, -Math.cos(0.17) * tm, 0));
    legs.push({ front: false, side, J: H, K, W: A, F, a: ta, b: tb, m: tm });
  }
  const legBones = [[BONE.flU, BONE.flL, BONE.flP], [BONE.frU, BONE.frL, BONE.frP], [BONE.hlU, BONE.hlL, BONE.hlP], [BONE.hrU, BONE.hrL, BONE.hrP]];
  legs.forEach((lg, i) => {
    const [u, l, p] = legBones[i];
    P[u] = lg.J.clone();
    P[l] = lg.K.clone();
    P[p] = lg.W.clone();
  });
  // ears
  const earDir = (side) => v3(-0.12, 0.86, side * 0.5).normalize();
  const headScale = v3(0.96, 0.86, 1.04).multiplyScalar(hr);
  const headSurface = (d) => v3(d.x * headScale.x, d.y * headScale.y, d.z * headScale.z).add(headC);
  P[BONE.earL] = headSurface(earDir(-1)).addScaledVector(earDir(-1), -0.008);
  P[BONE.earR] = headSurface(earDir(1)).addScaledVector(earDir(1), -0.008);
  // tail
  const tailBase = v3(-0.335 * L, yc + 0.045 * G, 0);
  const tl = (0.43 * b.tailLen) / TAIL_BONES;
  for (let i = 0; i < TAIL_BONES; i++) P[BONE.tail + i] = tailBase.clone().add(v3(-tl * i, 0, 0));

  // ---- trunk: rump to the back of the head
  const W = (pairs) => pairs;
  const bel = b.belly;
  const trunk = [
    { p: v3(-0.33 * L, yc + 0.012, 0), ry: 0.085 * G, rz: 0.078 * G, w: W([[BONE.hips, 1]]) },
    { p: v3(-0.27 * L, yc + 0.01, 0), ry: 0.114 * G, rz: 0.104 * G, w: W([[BONE.hips, 1]]) },
    { p: v3(-0.19 * L, yc, 0), ry: 0.122 * G, rz: 0.11 * G, bot: bel * 0.3, w: W([[BONE.hips, 1]]) },
    { p: v3(-0.09 * L, yc - bel * 0.025, 0), ry: (0.112 + bel * 0.03) * G, rz: (0.102 + bel * 0.04) * G, bot: bel * 0.6, w: W([[BONE.hips, 0.55], [BONE.spine, 0.45]]) },
    { p: v3(0.01 * L, yc - bel * 0.03, 0), ry: (0.115 + bel * 0.035) * G, rz: (0.104 + bel * 0.045) * G, bot: bel * 0.7, w: W([[BONE.spine, 1]]) },
    { p: v3(0.09 * L, yc, 0), ry: 0.126 * G, rz: 0.104 * G, bot: bel * 0.3, w: W([[BONE.spine, 0.45], [BONE.chest, 0.55]]) },
    { p: v3(0.17 * L, yc + 0.006, 0), ry: 0.134 * G, rz: 0.104 * G, w: W([[BONE.chest, 1]]) },
    { p: v3(0.235 * L, yc + 0.035, 0), ry: 0.112 * G * b.neck, rz: 0.092 * G * b.neck, w: W([[BONE.chest, 0.85], [BONE.neck, 0.15]]) },
    { p: v3(0.27 * L + 0.016, yc + 0.095, 0), ry: 0.078 * G * b.neck, rz: 0.072 * G * b.neck, w: W([[BONE.neck, 0.75], [BONE.chest, 0.25]]) },
    { p: headC.clone().add(v3(-0.055, -0.04, 0)), ry: 0.062 * b.neck * Math.max(1, b.headR * 0.85), rz: 0.062 * b.neck * Math.max(1, b.headR * 0.85), w: W([[BONE.neck, 0.4], [BONE.head, 0.6]]) },
    { p: headC.clone().add(v3(-0.02, -0.015, 0)), ry: 0.05, rz: 0.05, w: W([[BONE.head, 1]]) },
  ];
  sweep(M, trunk, {
    n: 22, sub: 3, part: PART.trunk, capStart: 0.85, capEnd: 0.5,
    // a flatter back, a chest that narrows at the bottom
    shape: (r, s, c, ry, rz) => ({ ry: s > 0 ? ry * 0.96 : ry, rz: rz * (s < 0 ? 1 - 0.12 * -s : 1) }),
  });

  // ---- head
  const eyeDir = (side) => v3(0.8, 0.2, side * 0.56).normalize();
  const cheekL = v3(0.28, -0.3, -0.92).normalize(), cheekR = v3(0.28, -0.3, 0.92).normalize();
  const jowlL = v3(0.35, -0.65, -0.68).normalize(), jowlR = v3(0.35, -0.65, 0.68).normalize();
  const padL = v3(0.9, -0.45, -0.25).normalize(), padR = v3(0.9, -0.45, 0.25).normalize();
  const chin = v3(0.72, -0.7, 0).normalize();
  const bridge = v3(0.97, -0.05, 0).normalize();
  const ruffL = v3(-0.1, -0.5, -0.86).normalize(), ruffR = v3(-0.1, -0.5, 0.86).normalize();
  const headDisp = (d) => {
    let r = 0;
    r += (gauss(d, cheekL, 0.42) + gauss(d, cheekR, 0.42)) * 0.16 * b.cheeks;
    r += (gauss(d, jowlL, 0.36) + gauss(d, jowlR, 0.36)) * 0.2 * b.jowls;
    r += (gauss(d, padL, 0.21) + gauss(d, padR, 0.21)) * 0.3 * b.muzzle;
    r += gauss(d, chin, 0.2) * 0.12 * b.muzzle;
    if (d.y < -0.62) r -= (-d.y - 0.62) * 0.3; // a narrow jaw
    r += gauss(d, bridge, 0.22) * 0.06 * b.muzzle;
    r -= (gauss(d, eyeDir(-1), 0.16) + gauss(d, eyeDir(1), 0.16)) * 0.09;
    if (d.x < -0.3) r -= (-d.x - 0.3) * 0.12; // the back of the skull
    if (d.y > 0.4 && d.x > 0.1) r -= (d.y - 0.4) * d.x * 0.18; // a flat brow
    if (b.fluff) {
      const f = gauss(d, ruffL, 0.5) + gauss(d, ruffR, 0.5);
      r += f * b.fluff * 0.12 * (0.6 + 0.4 * Math.sin(Math.atan2(d.y, d.x) * 11));
    }
    return r;
  };
  blob(M, headC, headScale, { part: PART.head, w: [[BONE.head, 1]], lat: 18, lon: 26, disp: headDisp, aux: (d) => [d.x, d.y, d.z] });
  const headPoint = (d) => {
    const r = 1 + headDisp(d);
    return v3(d.x * headScale.x * r, d.y * headScale.y * r, d.z * headScale.z * r).add(headC);
  };

  // nose
  const noseDir = v3(0.975, -0.2, 0).normalize();
  const noseC = headPoint(noseDir).add(v3(-0.004, 0.002, 0));
  blob(M, noseC, v3(0.011, 0.008, 0.014).multiplyScalar(Math.max(0.85, b.muzzle) * Math.min(1.2, b.headR)), {
    part: PART.nose, w: [[BONE.head, 1]], lat: 5, lon: 8,
    disp: (d) => (d.y < 0 ? -0.25 * -d.y * (1 - Math.abs(d.z)) : 0),
  });

  // eyes: each a sphere set into the head; aux = (u, v, front) in the eye's own frame
  const eyeR = 0.0235 * b.eyeSize * b.headR;
  const eyes = [];
  for (const side of [-1, 1]) {
    const d = eyeDir(side);
    const surf = headPoint(d);
    const c = surf.addScaledVector(d, -eyeR * 0.36);
    const fwd = v3(1, 0.05, side * 0.42).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, v3(0, 1, 0)).normalize().multiplyScalar(side);
    const upv = new THREE.Vector3().crossVectors(right, fwd).normalize().multiplyScalar(side);
    blob(M, c, v3(eyeR, eyeR, eyeR), {
      part: PART.eye, w: [[BONE.head, 1]], lat: 10, lon: 14,
      aux: (dd) => [dd.dot(right) * side, dd.dot(upv), dd.dot(fwd)],
    });
    eyes.push({ c, fwd });
  }

  // ears: a cupped shell, front (inner) and back faces; aux = (s up the ear, t across, side)
  for (const side of [-1, 1]) {
    const bone = side < 0 ? BONE.earL : BONE.earR;
    const base = P[bone];
    const up = v3(-0.08, 0.92, side * 0.4).normalize();
    const front = v3(0.92, 0.05, side * 0.38).normalize();
    front.sub(up.clone().multiplyScalar(front.dot(up))).normalize();
    const across = new THREE.Vector3().crossVectors(up, front).normalize();
    const eh = 0.078 * b.earSize * Math.pow(b.headR, 0.8), ew = 0.074 * b.earSize * Math.pow(b.headR, 0.8);
    const S = 6, T = 8;
    const grid = (back) => {
      const g = [];
      for (let i = 0; i <= S; i++) {
        const s = i / S;
        const row = [];
        for (let j = 0; j <= T; j++) {
          const t = (j / T) * 2 - 1;
          let width = (ew / 2) * Math.pow(1 - s, 0.85);
          if (b.torn && side > 0 && t * side > 0) width *= 1 - 0.55 * Math.exp(-((s - 0.5) ** 2) / 0.012);
          const cup = (1 - t * t) * (1 - s) * 0.014;
          const p = base.clone()
            .addScaledVector(up, eh * s + (back ? 0 : 0.002))
            .addScaledVector(across, width * t)
            .addScaledVector(front, back ? -0.006 * (1 - s) - (1 - t * t) * (1 - s) * 0.006 : -cup);
          row.push(M.vert(p, [[bone, 1]], back ? PART.earBack : PART.earFront, [s, t, side]));
        }
        g.push(row);
      }
      return g;
    };
    const F = grid(false), B = grid(true);
    for (let i = 0; i < S; i++) for (let j = 0; j < T; j++) {
      // front faces forward; back faces backward
      M.quad(F[i][j], F[i][j + 1], F[i + 1][j + 1], F[i + 1][j]);
      M.quad(B[i][j], B[i + 1][j], B[i + 1][j + 1], B[i][j + 1]);
    }
    // rims along both edges
    for (let i = 0; i < S; i++) {
      M.quad(F[i][0], F[i + 1][0], B[i + 1][0], B[i][0]);
      M.quad(F[i][T], B[i][T], B[i + 1][T], F[i + 1][T]);
    }
    for (let j = 0; j < T; j++) M.quad(F[0][j], B[0][j], B[0][j + 1], F[0][j + 1]);
  }

  // ---- legs
  const lt = b.legThick;
  legs.forEach((lg, i) => {
    const [u, l, p] = legBones[i];
    if (lg.front) {
      const top = lg.J.clone().add(v3(0.005, 0.07, -lg.side * 0.012));
      sweep(M, [
        { p: top, ry: 0.062 * G * lt, rz: 0.05 * G * lt, w: [[BONE.chest, 0.5], [u, 0.5]] },
        { p: lg.J.clone().add(v3(0, -0.01, 0)), ry: 0.056 * lt, rz: 0.046 * lt, w: [[u, 1]] },
        { p: lg.J.clone().lerp(lg.K, 0.6), ry: 0.042 * lt, rz: 0.036 * lt, w: [[u, 1]] },
        { p: lg.K.clone(), ry: 0.034 * lt, rz: 0.031 * lt, w: [[u, 0.5], [l, 0.5]] },
        { p: lg.K.clone().lerp(lg.W, 0.5), ry: 0.029 * lt, rz: 0.027 * lt, w: [[l, 1]] },
        { p: lg.W.clone().add(v3(0, 0.006, 0)), ry: 0.027 * lt, rz: 0.026 * lt, w: [[l, 0.6], [p, 0.4]] },
      ], { n: 12, sub: 2, part: PART.leg, up: v3(1, 0, 0), capStart: 0, capEnd: 0 });
      // the paw: a soft oval reaching forward, toes as bumps
      blob(M, lg.W.clone().add(v3(0.018, -pawH + 0.015, 0)), v3(0.038, 0.021, 0.031).multiplyScalar(lt), {
        part: PART.paw, w: [[p, 1]], lat: 7, lon: 12,
        disp: (d) => (d.x > 0.3 && d.y > -0.3 ? 0.08 * Math.max(0, Math.cos(d.z * 9)) * d.x : 0) - (d.y < -0.5 ? 0.3 * (-d.y - 0.5) : 0),
      });
    } else {
      const top = lg.J.clone().add(v3(-0.01, 0.06, -lg.side * 0.018));
      sweep(M, [
        { p: top, ry: 0.08 * G * lt, rz: 0.06 * G * lt, w: [[BONE.hips, 0.6], [u, 0.4]] },
        { p: lg.J.clone().add(v3(0.008, -0.015, 0)), ry: 0.078 * G * lt, rz: 0.056 * G * lt, w: [[u, 1]] },
        { p: lg.J.clone().lerp(lg.K, 0.6), ry: 0.054 * lt, rz: 0.042 * lt, w: [[u, 1]] },
        { p: lg.K.clone(), ry: 0.038 * lt, rz: 0.033 * lt, w: [[u, 0.5], [l, 0.5]] },
        { p: lg.K.clone().lerp(lg.W, 0.55), ry: 0.03 * lt, rz: 0.026 * lt, w: [[l, 1]] },
        { p: lg.W.clone(), ry: 0.025 * lt, rz: 0.023 * lt, w: [[l, 0.5], [p, 0.5]] },
        { p: lg.W.clone().lerp(lg.F, 0.6), ry: 0.024 * lt, rz: 0.023 * lt, w: [[p, 1]] },
        { p: lg.F.clone().add(v3(0, 0.008, 0)), ry: 0.025 * lt, rz: 0.025 * lt, w: [[p, 1]] },
      ], { n: 12, sub: 2, part: PART.leg, up: v3(1, 0, 0), capStart: 0, capEnd: 0 });
      blob(M, lg.F.clone().add(v3(0.018, -pawH + 0.016, 0)), v3(0.038, 0.02, 0.03).multiplyScalar(lt), {
        part: PART.paw, w: [[p, 1]], lat: 7, lon: 12,
        disp: (d) => (d.x > 0.3 && d.y > -0.3 ? 0.08 * Math.max(0, Math.cos(d.z * 9)) * d.x : 0) - (d.y < -0.5 ? 0.3 * (-d.y - 0.5) : 0),
      });
    }
  });

  // ---- tail: one ring per half bone, thick at the base, a rounded tip
  const tt = b.tailThick;
  const tailCtrl = [];
  const tailLen = tl * TAIL_BONES;
  for (let k = 0; k <= TAIL_BONES * 2; k++) {
    const s = k / (TAIL_BONES * 2);
    const bf = s * TAIL_BONES; // in bones
    const i0 = Math.min(TAIL_BONES - 1, Math.floor(bf));
    const f = bf - i0;
    let w;
    if (f < 0.5 && i0 > 0) w = [[BONE.tail + i0, 0.5 + f], [BONE.tail + i0 - 1, 0.5 - f]];
    else if (f >= 0.5 && i0 < TAIL_BONES - 1) w = [[BONE.tail + i0, 1.5 - f], [BONE.tail + i0 + 1, f - 0.5]];
    else w = [[BONE.tail + i0, 1]];
    if (k === 0) w = [[BONE.tail, 0.7], [BONE.hips, 0.3]];
    const r = (0.026 - 0.008 * s) * tt * (1 + 0.15 * Math.sin(s * Math.PI) * (tt - 1) * 2);
    tailCtrl.push({ p: tailBase.clone().add(v3(-tailLen * s + 0.02 * (k === 0), 0, 0)), ry: r, rz: r, w });
  }
  sweep(M, tailCtrl, { n: 10, sub: 1, part: PART.tail, capStart: 0, capEnd: 1.4 });

  // ---- geometry
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(M.pos, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(M.si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(M.sw, 4));
  geo.setAttribute('aRest', new THREE.Float32BufferAttribute(M.rest, 3));
  geo.setAttribute('aAux', new THREE.Float32BufferAttribute(M.aux, 3));
  geo.setAttribute('aPart', new THREE.Float32BufferAttribute(M.part, 1));
  geo.setIndex(M.idx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  geo.boundingSphere.radius += 0.6; // poses reach further than the rest pose

  // bone offsets relative to the parent (all rest rotations are identity)
  const rest = P.map((p, i) => (PARENT[i] < 0 ? p.clone() : p.clone().sub(P[PARENT[i]])));
  const info = {
    yc, headC, hr, eyes, eyeR, tailBase, tl, pawH, P,
    legs: legs.map((lg) => ({ front: lg.front, side: lg.side, a: lg.a, b: lg.b, m: lg.m ?? 0,
      restU: lg.K.clone().sub(lg.J).normalize(), restL: lg.W.clone().sub(lg.K).normalize(),
      restM: lg.F ? lg.F.clone().sub(lg.W).normalize() : null })),
    build: b,
  };
  return { geometry: geo, rest, parent: PARENT, info };
}

/** A fresh skeleton for one cat of a build (bones at rest). */
export function makeSkeleton(build) {
  const bones = build.rest.map((p) => {
    const bn = new THREE.Bone();
    bn.position.copy(p);
    return bn;
  });
  build.parent.forEach((pi, i) => { if (pi >= 0) bones[pi].add(bones[i]); });
  return { bones, skeleton: new THREE.Skeleton(bones) };
}
