// The herder brain: walks round behind a cat and pushes it along a line into a carrier. Bots, the title's attract mode,
// the trailer's autoplay and the balance tests all use it. It only touches what a player touches: a move direction and
// the two buttons (with the same cooldowns).

import { S, TYPES, CLAP, PERSON, LASER } from './tuning.js';
import { makeRng } from './rng.js';
import { lineClear, findPath, onMat, blockedPerson, normalNear, walkToMat } from './world.js';
import { clapPreview, shotPath } from './motion.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = Math.PI * 2;
const angTo = (a, b) => ((((b - a) % TAU) + TAU + Math.PI) % TAU) - Math.PI;
const OUT = new Set([S.boxed, S.enter]);

const STAND = { moggy: 1.9, loaf: 1.7, zoomer: 2.0, scaredy: 3.9, glutton: 1.5, kitten: 1.25, boss: 2.0 };
// cats that only a clap moves
const SETTLED = new Set([S.nap, S.boxsit, S.ride, S.sleep]);

/** How good a spot is to shoot a cat in from: near the door by foot, better still in front of it with a clear run. */
function spotValue(g, k, x, z) {
  const rx = x - k.doorX;
  const rz = z - k.doorZ;
  const rl = Math.hypot(rx, rz) || 1;
  const front = (rx * k.nx + rz * k.nz) / rl > 0.55 && rl < 5.5 && lineClear(g.world, x, z, k.matX, k.matZ, true);
  return -walkToMat(g.world, k, x, z) + (front ? 3 : 0);
}

/** For a cat only a clap moves: the reachable spot to clap from whose shot gets it furthest toward the door (or in). */
function planShot(g, p, b, c, k, mp) {
  if (b.plan && b.plan.c === c.id && b.plan.t > g.time) return b.plan;
  const kind = c.type === 'loaf' ? 'scoot' : 'bolt';
  const d0 = -spotValue(g, k, c.x, c.z);
  let best = null;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    const path = shotPath(g, c, a, kind);
    const end = path.pts[path.pts.length - 1];
    const mine = path.end === 'in' && (g.mode !== 'versus' || path.ki === k.index);
    if (path.end === 'in' && !mine) continue;
    const gain = mine ? d0 + 6 : d0 + spotValue(g, k, end.x, end.z);
    for (const r of [1.5, 2.5]) {
      const sx = c.x - Math.cos(a) * r;
      const sz = c.z - Math.sin(a) * r;
      if (sx < 0.5 || sz < 0.5 || sx > g.world.w - 0.5 || sz > g.world.d - 0.5 || blockedPerson(g.world, sx, sz)) continue;
      if (!lineClear(g.world, sx, sz, c.x, c.z, false) && c.st !== S.ride) continue;
      const score = gain - Math.hypot(sx - p.x, sz - p.z) * 0.12;
      if (!best || score > best.score) best = { c: c.id, x: sx, z: sz, a, score, gain, t: g.time + 1.2 };
      break;
    }
  }
  b.plan = best;
  return best;
}

/** What a clap from where p stands would do: cats shot into p's carrier, cats shot into someone else's, Scaredies spooked. */
export function clapValue(g, p, k) {
  let ins = 0;
  let gifts = 0;
  let hides = 0;
  for (const e of clapPreview(g, p.x, p.z)) {
    if (e.kind === 'hide') { hides++; continue; }
    if (e.path.end !== 'in') continue;
    if (g.mode === 'versus' && e.path.ki !== k.index) gifts++;
    else ins++;
  }
  return { ins, gifts, hides };
}

/** style: 'shepherd' | 'clapper' | 'poacher'. skill 0..1. */
export function createBrain({ skill = 0.6, style = 'shepherd', seed = 1 } = {}) {
  return {
    skill: clamp(skill, 0, 1), style, rng: makeRng(seed),
    target: -1, replan: 0, noise: 0, ix: 0, iz: 0, wantTreats: false, wantClap: false,
    best: Infinity, bestAt: 0, banned: new Map(), path: null, pathFor: null, pathT: 0, catPath: null, catPathT: 0,
    mode: 'go', t: 0, lead: -1,
  };
}

function carrierFor(g, p) {
  return g.carriers[p.carrier] ?? g.carriers[0];
}

function matPoint(k, out = 0.5) {
  return { x: k.doorX + k.nx * out, z: k.doorZ + k.nz * out };
}

function scoreCat(g, p, b, c, k) {
  if (OUT.has(c.st) || c.surprise) return Infinity;
  const until = b.banned.get(c.id);
  if (until && until > g.time) return Infinity;
  const m = matPoint(k, 0.6);
  let s = Math.hypot(c.x - p.x, c.z - p.z) * 0.45 + Math.hypot(c.x - m.x, c.z - m.z);
  if (c.type === 'boss' && g.cats.some((o) => o.gang === c.id && !OUT.has(o.st))) s -= 8;
  if (c.gang >= 0 && g.cats[c.gang] && !OUT.has(g.cats[c.gang].st)) s += 10;
  if (c.type === 'kitten' && g.cats.some((o) => o.type !== 'kitten' && !OUT.has(o.st) && Math.hypot(o.x - c.x, o.z - c.z) < 5)) s += 6;
  if (c.st === S.march) s += 12;
  if (c.type === 'loaf' && g.cats.some((o) => o.type === 'scaredy' && !OUT.has(o.st))) s += 9;
  if (c.st === S.hidden || c.st === S.perch) s += 3;
  if (g.mode === 'versus') {
    // others' herds: a poacher goes for cats near rivals' doors, everyone avoids cats a rival is pushing
    for (const o of g.people) {
      if (o === p || !o.active) continue;
      const d = Math.hypot(o.x - c.x, o.z - c.z);
      if (d < 2.6) s += b.style === 'poacher' ? -2 : 4;
    }
    for (const kk of g.carriers) {
      if (kk === k) continue;
      const d = Math.hypot(kk.matX - c.x, kk.matZ - c.z);
      if (d < 5 && b.style === 'poacher') s -= 5;
    }
  }
  if (g.mode === 'together' && g.claims) {
    const owner = g.claims.get(c.id);
    if (owner && owner !== p.id) s += 14;
  }
  return s;
}

function pickTarget(g, p, b, k) {
  let best = -1;
  let bs = Infinity;
  for (const c of g.cats) {
    let s = scoreCat(g, p, b, c, k);
    if (b.skill < 0.5 && b.rng.chance((0.5 - b.skill) * 0.3)) s += b.rng.range(0, 10); // a clumsy pick now and then
    if (s < bs) { bs = s; best = c.id; }
  }
  return best;
}

/** Where the cat should go next: the mat if it can walk straight there, else the next turn of a path. */
function catWaypoint(g, b, c, k) {
  const front = matPoint(k, 1.7);
  const door = { x: k.doorX, z: k.doorZ };
  const rel = { x: c.x - k.doorX, z: c.z - k.doorZ };
  const rl = Math.hypot(rel.x, rel.z) || 1;
  const inCone = (rel.x * k.nx + rel.z * k.nz) / rl > 0.72;
  const final = inCone && rl < 4.5;
  const goal = final ? door : front;
  const check = final ? matPoint(k, 0.35) : front;
  if (lineClear(g.world, c.x, c.z, check.x, check.z, true)) return { ...goal, final };
  if (!b.catPath || b.catPathT <= g.time || b.pathFor !== c.id) {
    b.catPath = findPath(g.world, c.x, c.z, front.x, front.z, true);
    b.catPathT = g.time + 0.8;
    b.pathFor = c.id;
  }
  const path = b.catPath;
  if (!path || path.length < 2) return { ...front, final: false };
  // the furthest point of the path the cat can see
  let w = path[1];
  for (let i = path.length - 1; i >= 1; i--) {
    if (lineClear(g.world, c.x, c.z, path[i].x, path[i].z, true)) { w = path[i]; break; }
  }
  return { x: w.x, z: w.z, final: false };
}

function walkTo(g, p, b, tx, tz) {
  if (lineClear(g.world, p.x, p.z, tx, tz, false)) return dirTo(p, tx, tz);
  if (!b.path || b.pathT <= g.time || Math.hypot(b.path.tx - tx, b.path.tz - tz) > 1.2) {
    const pts = findPath(g.world, p.x, p.z, tx, tz, false);
    b.path = pts ? { pts, tx, tz } : null;
    b.pathT = g.time + 0.7;
  }
  if (!b.path) return dirTo(p, tx, tz);
  const pts = b.path.pts;
  while (pts.length > 1 && Math.hypot(pts[1].x - p.x, pts[1].z - p.z) < 0.45) pts.shift();
  let w = pts[1] ?? pts[0];
  for (let i = pts.length - 1; i >= 1; i--) {
    if (lineClear(g.world, p.x, p.z, pts[i].x, pts[i].z, false)) { w = pts[i]; break; }
  }
  return dirTo(p, w.x, w.z);
}

function dirTo(p, x, z, gain = 1) {
  const dx = x - p.x;
  const dz = z - p.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.08) return { x: 0, z: 0 };
  const s = Math.min(1, (d / 0.6) * gain);
  return { x: (dx / d) * s, z: (dz / d) * s };
}

/** Where to stand so a cat walking to you goes the right way: on the far side of the door when it can see the mat, else
 * ahead of it along its way. Stands still while the cat comes, moves on while it munches. */
function leadCat(g, p, b, c, k, T, wp, dist) {
  const tucked = c.st === S.hidden || c.st === S.perch || c.st === S.creep;
  const range = Math.min(T.lure - 0.6, c.type === 'glutton' ? 9 : 5.2);
  const tx = -k.nz;
  const tz = k.nx;
  const rx = c.x - k.doorX;
  const rz = c.z - k.doorZ;
  const rl = Math.hypot(rx, rz) || 1;
  const front = (rx * k.nx + rz * k.nz) / rl;
  const lat = rx * tx + rz * tz;
  let spot = null;
  const sees = !tucked && lineClear(g.world, c.x, c.z, k.matX, k.matZ, true);
  if (sees && rl <= range + 0.6 && front > (b.lead === c.id ? 0.1 : 0.3)) {
    // just past the door's edge on the side away from the cat: walking to you, it crosses the mat heading in
    const order = lat >= 0 ? [-1, 1] : [1, -1];
    for (const s of order) {
      const q = { x: k.doorX - k.nx * 0.45 + tx * s * 0.8, z: k.doorZ - k.nz * 0.45 + tz * s * 0.8 };
      if (!blockedPerson(g.world, q.x, q.z)) { spot = q; break; }
    }
    if (spot) b.lead = c.id;
  }
  if (!spot) {
    b.lead = -1;
    let ax = wp.x - c.x;
    let az = wp.z - c.z;
    const al = Math.hypot(ax, az) || 1;
    ax /= al;
    az /= al;
    const reachOut = Math.min(range, Math.max(2.5, al + (wp.final ? 1.2 : 0.4)));
    for (const da of [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1]) {
      const a = Math.atan2(az, ax) + da;
      for (const r of [reachOut, reachOut * 0.7]) {
        const qx = c.x + Math.cos(a) * r;
        const qz = c.z + Math.sin(a) * r;
        if (qx < 0.6 || qz < 0.6 || qx > g.world.w - 0.6 || qz > g.world.d - 0.6 || blockedPerson(g.world, qx, qz)) continue;
        // a cat on or under furniture starts inside it, so only the open floor counts
        if (tucked || (lineClear(g.world, c.x, c.z, qx, qz, true) && lineClear(g.world, c.x, c.z, qx, qz, false))) { spot = { x: qx, z: qz }; break; }
      }
      if (spot) break;
    }
  }
  if (!spot) return null;
  const toSpot = Math.hypot(spot.x - p.x, spot.z - p.z);
  if (c.st === S.lured && c.lureBy === p.slot) {
    // it's coming: keep still
    b.ix = 0;
    b.iz = 0;
    return { treats: false };
  }
  // get to the spot without walking at the cat
  let d = walkTo(g, p, b, spot.x, spot.z);
  if (toSpot < 0.3) d = { x: 0, z: 0 };
  const R = T.flee || 0;
  if (R && dist < R + 0.4 && !tucked && c.st !== S.content) {
    // inside its reach: swing wide round it
    const ox = p.x - c.x;
    const oz = p.z - c.z;
    const ol = Math.hypot(ox, oz) || 1;
    d = { x: d.x + (ox / ol) * 0.6, z: d.z + (oz / ol) * 0.6 };
  }
  b.ix = d.x;
  b.iz = d.z;
  const seen = tucked || lineClear(g.world, c.x, c.z, p.x, p.z, true);
  const ready = p.treatsCd <= 0 && dist < T.lure - 0.3 && dist > 1.4 && seen && (toSpot < 0.6 || (tucked && dist < 4));
  if (ready) b.bestAt = g.time;
  return { treats: ready && c.st !== S.creep };
}

/** One decision for person p. Sets p.ix / p.iz; returns { treats, clap } for the caller to apply. */
export function think(g, p, b, dt) {
  b.replan -= dt;
  const out = { treats: false, clap: false };
  if (!p.active || g.over) { p.ix = 0; p.iz = 0; return out; }
  const k = carrierFor(g, p);
  if (!k) return out;
  // slower hands react later: between replans the bot keeps its last input
  if (b.replan > 0) {
    p.ix = b.ix;
    p.iz = b.iz;
    return out;
  }
  b.replan = 0.06 + (1 - b.skill) * 0.5;
  if (b.rng.chance(0.25)) b.noise = (b.rng.next() * 2 - 1) * (1 - b.skill) * 0.6;
  // a less practised hand now and then stops to look around
  if (b.rng.chance((1 - b.skill) * 0.04)) {
    b.replan = 0.5 + b.rng.next() * (1 - b.skill) * 1.2;
    b.ix = 0;
    b.iz = 0;
    p.ix = 0;
    p.iz = 0;
    return out;
  }

  // a clap that puts a cat (or two) in, right now
  if (p.clapCd <= 0 && b.rng.chance(0.35 + b.skill * 0.65)) {
    const v = clapValue(g, p, k);
    if (v.ins > 0 && v.gifts === 0 && v.hides === 0) out.clap = true;
  }
  // the laser pointer: pick it up, then stand off the door pointing in
  const L = g.laser;
  if (L && b.skill >= 0.5 && g.mode !== 'catlady') {
    if (L.on === 1 && L.holder === p.slot) {
      const sx = k.doorX + k.nx * (LASER.reach + 0.6);
      const sz = k.doorZ + k.nz * (LASER.reach + 0.6);
      let d = walkTo(g, p, b, sx, sz);
      if (Math.hypot(sx - p.x, sz - p.z) < 0.5) {
        const want = Math.atan2(-k.nz, -k.nx);
        d = Math.abs(angTo(p.h, want)) > 0.15 ? { x: -k.nx * 0.12, z: -k.nz * 0.12 } : { x: 0, z: 0 };
      }
      b.ix = d.x;
      b.iz = d.z;
      p.ix = b.ix;
      p.iz = b.iz;
      return out;
    }
    const looseN = g.cats.filter((o) => !OUT.has(o.st) && !o.surprise && o.type !== 'boss' && o.type !== 'loaf').length;
    if (L.on === 0 && looseN >= 2 && Math.hypot(L.hx - p.x, L.hz - p.z) < 10) {
      const d = walkTo(g, p, b, L.hx, L.hz);
      b.ix = d.x;
      b.iz = d.z;
      p.ix = b.ix;
      p.iz = b.iz;
      return out;
    }
  }

  let c = g.cats[b.target];
  if (!c || OUT.has(c.st) || c.surprise || (c.st === S.march && g.cats.some((o) => !OUT.has(o.st) && o.st !== S.march))) {
    b.target = pickTarget(g, p, b, k);
    c = g.cats[b.target];
    b.best = Infinity;
    b.bestAt = g.time;
    if (g.claims) {
      for (const [id, who] of g.claims) if (who === p.id) g.claims.delete(id);
      if (c) g.claims.set(c.id, p.id);
    }
  }
  if (!c) {
    const m = matPoint(k, 3);
    const d = walkTo(g, p, b, m.x, m.z);
    b.ix = d.x * 0.4;
    b.iz = d.z * 0.4;
    p.ix = b.ix;
    p.iz = b.iz;
    return out;
  }

  // progress: give up on a cat that isn't getting closer
  const mp = matPoint(k, 0.5);
  const dm = Math.hypot(c.x - mp.x, c.z - mp.z);
  if (dm < b.best - 0.4) { b.best = dm; b.bestAt = g.time; }
  if (g.time - b.bestAt > (c.type === 'loaf' ? 14 : 10)) {
    b.banned.set(c.id, g.time + 4);
    b.target = -1;
    b.best = Infinity;
  }

  const T = TYPES[c.type];
  const R = T.flee || CLAP.radius;
  const dist = Math.hypot(c.x - p.x, c.z - p.z);

  const wp = catWaypoint(g, b, c, k);
  let ux = wp.x - c.x;
  let uz = wp.z - c.z;
  const ul = Math.hypot(ux, uz) || 1;
  ux /= ul;
  uz /= ul;
  const ua = Math.atan2(uz, ux) + b.noise;
  ux = Math.cos(ua);
  uz = Math.sin(ua);
  const sd = STAND[c.type] ?? 1.9;
  const sx = c.x - ux * sd;
  const sz = c.z - uz * sd;

  // leading with treats: for cats under or on furniture, a Scaredy (too jumpy to push far), a far Glutton, and any cat
  // pinned to a wall where nobody can stand behind it
  const edge = 0.5;
  const standBlocked = sx < edge || sz < edge || sx > g.world.w - edge || sz > g.world.d - edge || blockedPerson(g.world, sx, sz);
  const stalled = g.time - b.bestAt > 3.5 && normalNear(g.world, c.x, c.z, 0.8).dist < 0.75;
  const tucked = c.st === S.hidden || c.st === S.perch || c.st === S.creep;
  const lead = T.lure > 0 && b.skill >= 0.3 && (tucked || (c.type === 'glutton' && dm > 5) || standBlocked || stalled);
  if (lead && (c.st !== S.lured || c.lureBy === p.slot)) {
    const res = leadCat(g, p, b, c, k, T, wp, dist);
    if (res) {
      out.treats = res.treats;
      p.ix = b.ix;
      p.iz = b.iz;
      return out;
    }
  }

  const rx = p.x - c.x;
  const rz = p.z - c.z;
  const rl = Math.hypot(rx, rz) || 1;
  const behind = -(rx * ux + rz * uz) / rl; // 1 = straight behind
  const reach = c.type === 'loaf' ? CLAP.radius : R;
  // a clap here would send a Scaredy under the furniture: hold it unless the clap is the whole point
  const scaredyNear = g.cats.some((o) => o.type === 'scaredy' && !OUT.has(o.st) && o.st !== S.hidden && Math.hypot(o.x - p.x, o.z - p.z) < TYPES.scaredy.hideClap + 0.5);
  let move;
  if (c.type === 'loaf' || SETTLED.has(c.st)) {
    // a Loaf (or a napping, boxed-up or riding cat) only moves for a clap: find the spot whose shot (as previewed) does
    // most, off a wall if need be, walk there and clap
    const plan = planShot(g, p, b, c, k, mp);
    let lx = sx;
    let lz = sz;
    if (plan) { lx = plan.x; lz = plan.z; }
    move = walkTo(g, p, b, lx, lz);
    const at = Math.hypot(lx - p.x, lz - p.z);
    if (at < 0.3) move = { x: 0, z: 0 };
    if (p.clapCd <= 0 && rl < CLAP.radius - 0.3 && (!scaredyNear || b.skill < 0.5) && (at < 0.45 || g.time - b.bestAt > 6)) {
      const prev = clapPreview(g, p.x, p.z);
      const mine = prev.find((e) => e.c === c && e.kind === 'shot');
      const gifts = g.mode === 'versus' && prev.some((e) => e.kind === 'shot' && e.path.end === 'in' && e.path.ki !== k.index);
      if (mine && !gifts) {
        const end = mine.path.pts[mine.path.pts.length - 1];
        const gain = mine.path.end === 'in' ? 9 : spotValue(g, k, end.x, end.z) - spotValue(g, k, c.x, c.z);
        if (gain > 0.6 || mine.path.end === 'in') { out.clap = true; b.plan = null; }
      }
    }
  } else if (behind > 0.86 && rl < reach + 0.6) {
    // pushing: hold the stand-off and lean in
    const lean = wp.final ? 0.55 : 0.85;
    const hold = dirTo(p, sx, sz, 1.6);
    move = { x: hold.x + ux * lean, z: hold.z + uz * lean };
    if (b.style === 'clapper' && c.type !== 'scaredy' && c.type !== 'loaf' && p.clapCd <= 0 && behind > 0.94 && rl < 3.4 && dm > 3 && !scaredyNear) out.clap = true;
  } else if (rl < reach + 0.9) {
    // wrong side: circle round outside the cat's reach
    const cur = Math.atan2(rz, rx);
    const want = Math.atan2(-uz, -ux);
    const turn = angTo(cur, want);
    const step = Math.sign(turn || 1) * Math.min(Math.abs(turn), 1.1);
    const orbit = reach + 0.75;
    const tx = c.x + Math.cos(cur + step) * orbit;
    const tz = c.z + Math.sin(cur + step) * orbit;
    move = walkTo(g, p, b, tx, tz);
  } else {
    // far: head for the stand point, coming in from behind
    const approachX = c.x - ux * (reach + 0.5);
    const approachZ = c.z - uz * (reach + 0.5);
    move = walkTo(g, p, b, approachX, approachZ);
  }
  // step round sleeping or sitting cats in the way
  const mlen = Math.hypot(move.x, move.z);
  if (mlen > 0.05) {
    const fx = move.x / mlen;
    const fz = move.z / mlen;
    for (const o of g.cats) {
      if (o === c || OUT.has(o.st) || o.st === S.hidden || o.st === S.perch) continue;
      const ox = o.x - p.x;
      const oz = o.z - p.z;
      const along = ox * fx + oz * fz;
      if (along < 0 || along > 1.3) continue;
      const side = -ox * fz + oz * fx;
      if (Math.abs(side) > 0.75) continue;
      const s = side >= 0 ? -1 : 1;
      move.x += -fz * s * 0.9;
      move.z += fx * s * 0.9;
    }
  }
  // keep off the cat-door line so the bot never blocks its own carrier
  const onm = onMat(k, p.x, p.z);
  if (onm) { move.x += k.nx; move.z += k.nz; }
  const ml = Math.hypot(move.x, move.z);
  if (ml > 1) { move.x /= ml; move.z /= ml; }
  b.ix = move.x;
  b.iz = move.z;
  p.ix = b.ix;
  p.iz = b.iz;
  return out;
}

export const PERSON_SPEED = PERSON.speed;
