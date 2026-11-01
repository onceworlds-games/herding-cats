// How cats move when something makes them: what pushes them (people, the robot vacuum), the straight run of a clap shot
// (shared by the simulation and its preview, so a gold preview really goes in), and the previews the view draws: where a
// pushed cat will run and where every cat in reach of a clap will go.

import { STEP, CLAP, DOOR, CAT, TYPES, S, VAC } from './tuning.js';
import { resolve, onMat, blockedCat } from './world.js';

const OUT = new Set([S.enter, S.boxed]);
// a cat in one of these can be knocked along by another cat's shot
export const KNOCKABLE = new Set([S.idle, S.walk, S.alert, S.flee, S.settle, S.lured, S.content, S.follow, S.march, S.chase, S.seek, S.nap, S.sleep, S.snub, S.wiggle, S.crouch]);
const PUSHABLE = new Set([S.idle, S.walk, S.alert, S.flee, S.settle, S.follow]);

/** What's pushing a cat: the sum of everyone near (and the vacuum), its pressure, and who's nearest. */
export function threat(g, c) {
  const T = TYPES[c.type];
  const R = T.flee;
  if (!R) return null;
  let fx = 0;
  let fz = 0;
  let pressure = 0;
  let near = Infinity;
  let who = -1;
  let any = false;
  for (const p of g.people) {
    if (!p.active) continue;
    const dx = c.x - p.x;
    const dz = c.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d >= R) continue;
    const w = (R - d) / R;
    const dd = Math.max(d, 0.05);
    fx += (dx / dd) * w;
    fz += (dz / dd) * w;
    const pr = Math.min(1, Math.max(0, (R - d) / Math.max(0.5, R - 1)));
    if (pr > pressure) pressure = pr;
    if (d < near) { near = d; who = p.slot; }
    any = true;
  }
  for (const v of g.vacs ?? []) {
    const dx = c.x - v.x;
    const dz = c.z - v.z;
    const d = Math.hypot(dx, dz);
    if (d >= VAC.scare || v.rider === c.id) continue;
    const w = (VAC.scare - d) / VAC.scare;
    const dd = Math.max(d, 0.05);
    fx += (dx / dd) * w;
    fz += (dz / dd) * w;
    pressure = Math.max(pressure, Math.min(1, w * 1.4));
    if (d < near) { near = d; who = -1; }
    any = true;
  }
  if (!any) return null;
  const l = Math.hypot(fx, fz);
  if (l < 1e-6) {
    const p = g.people[who];
    fx = p ? Math.cos(p.h) : Math.cos(c.h);
    fz = p ? Math.sin(p.h) : Math.sin(c.h);
  } else {
    fx /= l;
    fz /= l;
  }
  return { fx, fz, pressure, near, who };
}

// ------------------------------------------------------------------ the shot

/** Speed of a shot `kind` at `t` seconds in (before bounces), or 0 when it's over. */
export function shotSpeed(kind, t, type = 'moggy') {
  if (kind === 'scoot') {
    const T = TYPES.loaf;
    if (t >= T.scootTime) return 0;
    return (T.scoot / T.scootTime) * 2 * (1 - t / T.scootTime);
  }
  if (kind === 'sprint') {
    const T = TYPES[type].sprint ? TYPES[type] : TYPES.zoomer;
    if (t < T.sprintTime) return T.sprint;
    return t < T.sprintTime + 0.6 ? CLAP.trot : 0;
  }
  if (t < CLAP.boltTime) return CLAP.bolt;
  return t < CLAP.boltTime + CLAP.trotTime ? CLAP.trot : 0;
}

/**
 * One step of a shot: straight along s.h at s.sp, off walls and furniture like a ball (a glancing touch only slides).
 * s: { x, z, h, sp, r }. Returns true when it bounced.
 */
export function shotStep(world, s, dt) {
  const dx = Math.cos(s.h);
  const dz = Math.sin(s.h);
  const pos = { x: s.x + dx * s.sp * dt, z: s.z + dz * s.sp * dt };
  const n = resolve(world, pos, s.r);
  let bounced = false;
  if (n.nx || n.nz) {
    const dot = dx * n.nx + dz * n.nz;
    if (dot < -0.2) {
      s.h = Math.atan2(dz - 2 * dot * n.nz, dx - 2 * dot * n.nx);
      bounced = true;
    }
  }
  s.x = pos.x;
  s.z = pos.z;
  return bounced;
}

/** The carrier a cat at (x, z) moving (vx, vz) goes into, or null. */
export function doorFor(g, x, z, vx, vz, relaxed = false) {
  const sp = Math.hypot(vx, vz);
  for (const k of g.carriers) {
    if (k.closed) continue;
    if (!onMat(k, x, z)) continue;
    const inward = sp > 1e-3 ? -(vx * k.nx + vz * k.nz) / sp : 0;
    if (relaxed ? sp > 0.2 && inward > -0.2 : sp > DOOR.minSpeed && inward > DOOR.cosEntry) return k;
  }
  return null;
}

/** Can cat o be knocked by a shot from cat c? */
export function knockable(c, o) {
  return o !== c && o.type !== 'boss' && !OUT.has(o.st) && KNOCKABLE.has(o.st) && !o.surprise && (o.y ?? 0) < 0.05;
}

export const touchGap = (a, b) => CAT.separation * 0.5 * (a.size + b.size) + 0.04;

// ------------------------------------------------------------------ the preview: every cat a clap would move, run together

const MAX_BOUNCES = 2;

function makeRun(c, aim, kind, x, z, opts = {}) {
  return {
    c, kind, s: { x, z, h: aim, sp: 0, r: CAT.radius * c.size }, t: 0, keep: opts.keep ?? 1, bounces: 0, coast: -1,
    delay: opts.delay ?? 0, chain: opts.chain ?? 0, pts: [{ x, z }], knocks: [], end: null, ki: -1, i: 0,
  };
}

/** The kind of run a hit or a clap starts for cat o. */
function runKind(o) {
  if (o.type === 'loaf') return 'scoot';
  if (o.type === 'zoomer' && o.st === S.wiggle) return 'sprint';
  return 'bolt';
}

/** Where cat o is (and can it be knocked) while the preview runs. */
function standing(c, o, runs) {
  const r = runs.get(o.id);
  if (!r) return knockable(c, o) ? o : null;
  // one that ran can be knocked again once it's only coasting, or stopped
  if (r.delay > 0 || r.end === 'in' || (r.end == null && r.coast < 0) || o === c) return null;
  return r.s;
}

function stepRun(g, r, runs) {
  if (r.end) return;
  if (r.delay > 0) { r.delay -= STEP; return; }
  r.i++;
  const s = r.s;
  const base = shotSpeed(r.kind, r.t, r.c.type);
  const px = s.x;
  const pz = s.z;
  if (base <= 0) {
    // the run's over: it coasts to a stop (a Loaf just stops)
    if (r.kind === 'scoot') { r.end = 'stop'; r.pts.push({ x: s.x, z: s.z }); return; }
    if (r.coast < 0) r.coast = CAT.settle;
    r.coast -= STEP;
    if (r.coast <= 0) { r.end = 'stop'; r.pts.push({ x: s.x, z: s.z }); return; }
    s.sp -= (s.sp / Math.max(0.05, r.coast + STEP)) * STEP;
    const h = s.h;
    shotStep(g.world, s, STEP);
    s.h = h;
  } else {
    s.sp = base * r.keep;
    r.t += STEP;
    if (shotStep(g.world, s, STEP)) {
      r.keep = Math.max(CLAP.minKeep, r.keep * CLAP.keep);
      r.bounces++;
      r.pts.push({ x: s.x, z: s.z, bounce: true });
      if (r.bounces > MAX_BOUNCES) { r.end = 'stop'; return; }
    }
  }
  const k = doorFor(g, s.x, s.z, (s.x - px) / STEP, (s.z - pz) / STEP);
  if (k) {
    r.pts.push({ x: k.doorX, z: k.doorZ });
    r.end = 'in';
    r.ki = k.index;
    return;
  }
  if (r.i % 2 === 0) r.pts.push({ x: s.x, z: s.z });
  if (base <= 0) return;
  // into a cat that isn't running: it takes the hit, as in the simulation
  for (const o of g.cats) {
    const at = standing(r.c, o, runs);
    if (!at || o.type === 'boss') continue;
    const dx = at.x - s.x;
    const dz = at.z - s.z;
    const d = Math.hypot(dx, dz);
    if (d >= touchGap(r.c, o) || d < 1e-6) continue;
    const nx = dx / d;
    const nz = dz / d;
    const vx = Math.cos(s.h);
    const vz = Math.sin(s.h);
    const vn = vx * nx + vz * nz;
    if (vn <= 0.15) continue;
    r.pts.push({ x: s.x, z: s.z });
    r.knocks.push({ x: (s.x + at.x) / 2, z: (s.z + at.z) / 2, o: o.id });
    runs.set(o.id, makeRun(o, Math.atan2(nz, nx), runKind(o), at.x, at.z, {
      keep: Math.max(0.55, Math.min(1, r.keep * (0.45 + 0.6 * vn))), chain: r.chain + 1,
    }));
    const tx = vx - vn * nx;
    const tz = vz - vn * nz;
    const tl = Math.hypot(tx, tz);
    if (tl < 0.35) { r.end = 'knock'; return; }
    s.h = Math.atan2(tz, tx);
    r.keep = Math.max(CLAP.minKeep, r.keep * tl);
    return;
  }
}

/** One cat's shot on its own: { pts, end, ki, bounces }. */
export function shotPath(g, c, aim, kind = 'bolt', opts = {}) {
  const runs = new Map([[c.id, makeRun(c, aim, kind, opts.x ?? c.x, opts.z ?? c.z)]]);
  return simulate(g, runs).get(c.id);
}

function simulate(g, runs) {
  for (let i = 0; i < 120; i++) {
    let live = false;
    for (const c of g.cats) {
      const r = runs.get(c.id);
      if (!r || r.end) continue;
      stepRun(g, r, runs);
      live = true;
    }
    if (!live) break;
  }
  for (const r of runs.values()) {
    if (!r.end) { r.end = 'stop'; r.pts.push({ x: r.s.x, z: r.s.z }); }
  }
  return runs;
}

/** Where a cat leaving a perch lands, heading (dx, dz) from it (the first clear spot past the piece's edge). */
export function hopSpot(world, c, dx, dz) {
  const s = world.solids[c.a];
  let l = Math.hypot(dx, dz);
  if (l < 1e-6) { dx = 1; dz = 0; l = 1; }
  dx /= l;
  dz /= l;
  const tries = [[dx, dz], [-dz, dx], [dz, -dx], [-dx, -dz]];
  if (s) {
    for (const [tx, tz] of tries) {
      for (let t = 0.3; t < 3; t += 0.15) {
        const x = c.x + tx * t;
        const z = c.z + tz * t;
        const inside = x > s.x0 - 0.3 && x < s.x1 + 0.3 && z > s.z0 - 0.3 && z < s.z1 + 0.3;
        if (inside) continue;
        if (!blockedCat(world, x, z)) return { x, z };
        break;
      }
    }
  }
  return { x: c.x + dx * 0.8, z: c.z + dz * 0.8 };
}

/**
 * What a clap at (x, z) would do: every cat it shoots, run together with the cats they knock along, through a bounce or
 * two. Returns [{ c, kind: 'shot' | 'hide', path: { pts, end: 'in' | 'stop' | 'knock', ki, bounces, chain, knocks } }].
 * The clap preview (while the clap is ready), the doorbell's warning and the herder brain use it.
 */
export function clapPreview(g, x, z, radius = CLAP.radius, hideRadius = TYPES.scaredy.hideClap) {
  const out = [];
  const runs = new Map();
  for (const c of g.cats) {
    if (OUT.has(c.st) || c.surprise) continue;
    const dx = c.x - x;
    const dz = c.z - z;
    const d = Math.hypot(dx, dz);
    const away = Math.atan2(dz, dx);
    if (c.type === 'scaredy' && d < hideRadius && c.st !== S.hidden && c.st !== S.ride && c.st !== S.boxsit) {
      out.push({ c, kind: 'hide' });
      continue;
    }
    if (d > radius) continue;
    if (c.st === S.hidden || c.st === S.hop || c.st === S.enter || c.st === S.bump || c.st === S.creep) continue;
    if (c.type === 'boss') continue;
    if (c.st === S.perch) {
      const at = hopSpot(g.world, c, dx, dz);
      runs.set(c.id, makeRun(c, Math.atan2(at.z - c.z, at.x - c.x), 'bolt', at.x, at.z, { delay: CAT.hop }));
      continue;
    }
    const kind = c.type === 'loaf' ? 'scoot' : c.type === 'zoomer' && c.st === S.wiggle ? 'sprint' : 'bolt';
    runs.set(c.id, makeRun(c, away, kind, c.x, c.z));
  }
  simulate(g, runs);
  for (const r of runs.values()) {
    out.push({ c: r.c, kind: 'shot', path: { pts: r.pts, end: r.end, ki: r.ki, bounces: r.bounces, chain: r.chain, knocks: r.knocks } });
  }
  return out;
}

/** Where a cat pushed by person p will run: { a, len, gold, ki } or null when p isn't pushing it. */
export function pushPreview(g, c, p) {
  if (OUT.has(c.st) || !PUSHABLE.has(c.st)) return null;
  const T = TYPES[c.type];
  if (!T.flee) return null;
  const d = Math.hypot(c.x - p.x, c.z - p.z);
  if (d > T.flee + 0.4) return null;
  const th = threat(g, c) ?? { fx: (c.x - p.x) / (d || 1), fz: (c.z - p.z) / (d || 1) };
  const a = Math.atan2(th.fz, th.fx);
  const ux = th.fx;
  const uz = th.fz;
  let len = 0;
  for (let t = 0.1; t <= 4.5; t += 0.1) {
    const x = c.x + ux * t;
    const z = c.z + uz * t;
    const k = doorFor(g, x, z, ux, uz);
    if (k) return { a, len: t, gold: true, ki: k.index };
    if (blockedCat(g.world, x, z)) break;
    len = t;
  }
  return { a, len: Math.min(len, 2.4), gold: false, ki: -1 };
}

/** Is this cat about to go in (within `horizon` s, straight on as it's going)? Returns the carrier or null. */
export function soonIn(g, c, horizon = 0.5) {
  if (OUT.has(c.st)) return null;
  const sp = Math.hypot(c.vx, c.vz);
  if (sp < 0.6) return null;
  const ux = c.vx / sp;
  const uz = c.vz / sp;
  for (let t = 0; t <= horizon; t += STEP) {
    const k = doorFor(g, c.x + ux * sp * t, c.z + uz * sp * t, c.vx, c.vz, c.st === S.march || c.st === S.chase);
    if (k) return k;
  }
  return null;
}
