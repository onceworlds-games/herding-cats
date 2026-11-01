// The herding simulation: people, cats, carriers and the clock, stepped at a fixed 30 Hz. Pure: no page, no three.js.
// The authoritative copy (solo, or the host) decides everything; a predicting copy (`authority: false`) only runs the
// reactive steering (fleeing, lures, bolts, sprints) and leaves every decision (going in, hiding, perching, new wanders) to
// the host's snapshots.

import { STEP, PERSON, TREATS, CLAP, DOOR, CAT, TYPES, S, ROUND, CATLADY } from './tuning.js';
import { makeRng, hash } from './rng.js';
import { buildWorld, resolve, freeAhead, normalNear, nearestHide, freeSpot, onMat, blockedCat, findPath, overlaps } from './world.js';

const TAU = Math.PI * 2;
const angTo = (a, b) => ((((b - a) % TAU) + TAU + Math.PI) % TAU) - Math.PI;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const fin = (v, d = 0) => (Number.isFinite(v) ? v : d);

const CALM = new Set([S.idle, S.walk, S.settle, S.follow]);
const CAN_ENTER = new Set([S.flee, S.settle, S.walk, S.bolt, S.trot, S.slip, S.scoot, S.sprint, S.march, S.lured, S.stalk, S.follow, S.idle]);
const IGNORES_PUSH = new Set([S.enter, S.boxed, S.bump, S.hop, S.perch, S.runhide, S.hidden, S.creep, S.sleep, S.scoot, S.wiggle, S.sprint, S.slip, S.crouch, S.lured, S.content, S.bolt, S.hold, S.arrive, S.snub, S.stalk]);
const OUT = new Set([S.enter, S.boxed]);

/**
 * opts: { room, mode: 'level' | 'versus' | 'together' | 'catlady' | 'ambient', cats: [{ type, coat, x, z, gang, perch, surprise }],
 *         seed, clock, authority = true, owners: [seatId per carrier] }
 */
export function createGame(opts) {
  const world = buildWorld(opts.room);
  const rng = makeRng(opts.seed ?? 1);
  const g = {
    world, room: opts.room, mode: opts.mode ?? 'level', rng, seed: opts.seed ?? 1,
    authority: opts.authority !== false,
    time: 0, clock: opts.clock ?? null, clockMax: opts.clock ?? null, started: false, over: false, result: null,
    elapsed: 0,
    cats: [], people: [], events: [], evSeq: 0,
    carriers: world.carriers.map((c, i) => ({ ...c, count: 0, shutT: 0, busy: 0, owner: opts.owners?.[i] ?? null, closed: false, cats: [] })),
    total: 0, boxed: 0, spawned: 0, spawnT: 0, bonus: CATLADY.bonus,
    stats: { zoomies: false, bossFirst: null, firstBoxed: null },
  };
  (opts.cats ?? []).forEach((spec) => addCat(g, spec));
  g.total = g.cats.filter((c) => !c.surprise).length;
  return g;
}

export function addCat(g, spec) {
  const id = g.cats.length;
  const type = TYPES[spec.type] ? spec.type : 'moggy';
  const T = TYPES[type];
  const r = makeRng(hash(`${g.seed}:${id}`));
  let { x, z } = spec;
  if (!Number.isFinite(x) || !Number.isFinite(z) || overlaps(g.world, x, z, CAT.radius)) {
    const p = freeSpot(g.world, r, { margin: 1.2, avoid: g.cats.map((c) => ({ x: c.x, z: c.z, r: 1.2 })) });
    x = p.x;
    z = p.z;
  }
  const c = {
    id, type, coat: spec.coat ?? 'ginger', gang: spec.gang ?? -1, size: T.size,
    x, z, h: fin(spec.h, r.range(-Math.PI, Math.PI)), sp: 0, vx: 0, vz: 0, y: 0,
    st: type === 'loaf' ? S.sleep : S.idle, tt: r.range(0.5, 3), a: 0, b: 0,
    tell: T.tell[0] + (T.tell[1] - T.tell[0]) * r.next(),
    wob: 0, wobT: 0, fleeMem: 0, lingerT: 0, cornerT: 0,
    zoomT: T.zoomEvery ? r.range(T.zoomEvery[0], T.zoomEvery[1]) : 0,
    aim: 0, lureBy: -1, carrier: -1, hop: null, path: null, pathT: 0,
    followIn: null, swatted: false, surprise: !!spec.surprise, credit: null, creditT: 0, entering: false, zoomed: false,
    look: -1, glance: 0,
  };
  g.cats.push(c);
  if (spec.perch != null) placeOnPerch(g, c, spec.perch);
  if (spec.surprise || spec.hidden) {
    const hide = nearestHide(g.world, c.x, c.z);
    if (hide) {
      c.x = hide.hx;
      c.z = hide.hz;
      c.st = S.hidden;
      c.a = hide.index;
      c.b = 0;
      c.tt = 999;
      c.h = Math.atan2(hide.nz, hide.nx);
    }
  }
  return c;
}

function placeOnPerch(g, c, solidIndex) {
  const s = g.world.solids[solidIndex];
  if (!s || !s.perch) return;
  c.x = (s.x0 + s.x1) / 2;
  c.z = (s.z0 + s.z1) / 2;
  c.y = s.perch;
  c.st = S.perch;
  c.a = solidIndex;
  c.tt = 40;
}

export function addPerson(g, spec = {}) {
  const p = {
    id: spec.id ?? `p${g.people.length}`, slot: g.people.length, seat: spec.seat ?? null, carrier: spec.carrier ?? 0,
    x: spec.x ?? g.room.entry?.x ?? g.world.w / 2, z: spec.z ?? g.room.entry?.z ?? g.world.d / 2,
    vx: 0, vz: 0, h: spec.h ?? Math.PI / 2, ix: 0, iz: 0, sp: 0,
    treatsCd: 0, clapCd: 0, treatsSeq: 0, clapSeq: 0, external: !!spec.external, active: spec.active !== false,
    bot: spec.bot ?? null, lastShake: -9, lastClap: -9,
  };
  const pos = { x: p.x, z: p.z };
  resolve(g.world, pos, PERSON.radius);
  p.x = pos.x;
  p.z = pos.z;
  g.people.push(p);
  return p;
}

function emit(g, k, data) {
  g.events.push({ ...data, seq: ++g.evSeq, k, t: g.time });
  if (g.events.length > 200) g.events.splice(0, g.events.length - 200);
}

// ------------------------------------------------------------------ actions

export function treats(g, p) {
  if (!p.active || p.treatsCd > 0 || g.over) return false;
  p.treatsCd = TREATS.cooldown;
  p.treatsSeq++;
  p.lastShake = g.time;
  emit(g, 'treats', { p: p.slot, x: p.x, z: p.z });
  for (const c of g.cats) applyTreats(g, c, p);
  return true;
}

export function clap(g, p) {
  if (!p.active || p.clapCd > 0 || g.over) return false;
  p.clapCd = CLAP.cooldown;
  p.clapSeq++;
  p.lastClap = g.time;
  emit(g, 'clap', { p: p.slot, x: p.x, z: p.z });
  for (const c of g.cats) applyClap(g, c, p);
  return true;
}

function applyTreats(g, c, p) {
  if (OUT.has(c.st)) return;
  const T = TYPES[c.type];
  const d = Math.hypot(c.x - p.x, c.z - p.z);
  if (c.type === 'boss') {
    if (d < TREATS.radius) { setState(c, S.snub, 1.0); c.h = Math.atan2(c.z - p.z, c.x - p.x); }
    return;
  }
  if (!T.lure || d > T.lure) return;
  if (c.st === S.perch) return hopDown(g, c, p.x - c.x, p.z - c.z, S.lured, T.lureTime, p.slot);
  if (c.st === S.hidden) {
    if (!g.authority) return;
    setState(c, S.creep, 0.6);
    c.lureBy = p.slot;
    c.h = Math.atan2(p.z - c.z, p.x - c.x);
    emit(g, 'emerge', { c: c.id });
    return;
  }
  if (c.st === S.runhide || c.st === S.hop || c.st === S.bump || c.st === S.wiggle || c.st === S.sprint || c.st === S.march) return;
  setState(c, S.lured, T.lureTime);
  c.lureBy = p.slot;
  c.credit = p.id;
  c.creditT = 3;
}

function applyClap(g, c, p) {
  if (OUT.has(c.st)) return;
  const T = TYPES[c.type];
  const dx = c.x - p.x;
  const dz = c.z - p.z;
  const d = Math.hypot(dx, dz);
  const away = Math.atan2(dz, dx);
  if (c.type === 'scaredy' && d < T.hideClap && c.st !== S.hidden) {
    if (g.authority) startHide(g, c);
    return;
  }
  if (d > CLAP.radius) return;
  c.credit = p.id;
  c.creditT = 3;
  if (c.st === S.hidden) return;
  if (c.st === S.perch) return hopDown(g, c, dx, dz, S.bolt, CLAP.boltTime);
  if (c.st === S.hop || c.st === S.enter || c.st === S.bump) return;
  if (c.type === 'loaf') {
    setState(c, S.scoot, T.scootTime);
    c.h = away;
    c.aim = away;
    return;
  }
  if (c.type === 'boss') {
    setState(c, S.stalk, T.stalkTime);
    c.aim = away;
    return;
  }
  if (c.type === 'zoomer' && c.st === S.wiggle) {
    c.aim = away;
    startSprint(g, c);
    return;
  }
  setState(c, S.bolt, CLAP.boltTime);
  c.aim = away;
  c.h = away;
  c.sp = Math.max(c.sp, CLAP.bolt * 0.8);
  c.fleeMem = 1.5;
}

function setState(c, st, tt) {
  c.st = st;
  c.tt = tt;
  c.cornerT = 0;
  if (st !== S.lured && st !== S.creep) c.lureBy = -1;
}

// ------------------------------------------------------------------ people

export function movePerson(g, p, dt) {
  if (!p.active) return;
  p.treatsCd = Math.max(0, p.treatsCd - dt);
  p.clapCd = Math.max(0, p.clapCd - dt);
  if (p.external) return;
  let ix = fin(p.ix);
  let iz = fin(p.iz);
  const il = Math.hypot(ix, iz);
  if (il > 1) { ix /= il; iz /= il; }
  const tx = ix * PERSON.speed;
  const tz = iz * PERSON.speed;
  const rate = il > 0.05 ? PERSON.accel : PERSON.decel;
  const dvx = tx - p.vx;
  const dvz = tz - p.vz;
  const dl = Math.hypot(dvx, dvz);
  const maxDv = rate * dt;
  if (dl <= maxDv) { p.vx = tx; p.vz = tz; } else { p.vx += (dvx / dl) * maxDv; p.vz += (dvz / dl) * maxDv; }
  const pos = { x: p.x + p.vx * dt, z: p.z + p.vz * dt };
  resolve(g.world, pos, PERSON.radius);
  keepOffMats(g, p, pos);
  p.vx = (pos.x - p.x) / dt;
  p.vz = (pos.z - p.z) / dt;
  p.x = pos.x;
  p.z = pos.z;
  p.sp = Math.hypot(p.vx, p.vz);
  if (p.sp > 0.3) p.h = Math.atan2(p.vz, p.vx);
}

/** A carrier's doormat belongs to its owner (versus): anyone else slides off it. */
function keepOffMats(g, p, pos) {
  if (g.mode !== 'versus') return;
  for (const c of g.carriers) {
    if (c.owner == null || c.owner === p.seat) continue;
    const m = onMat(c, pos.x, pos.z);
    if (!m) continue;
    const push = DOOR.matD + PERSON.radius - m[0];
    pos.x += c.nx * push;
    pos.z += c.nz * push;
  }
}

/** For people whose position comes from elsewhere (other pages, presence): move them there and keep their speed. */
export function placePerson(g, p, x, z, dt) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return;
  const nx = clamp(x, 0, g.world.w);
  const nz = clamp(z, 0, g.world.d);
  if (dt > 0) {
    p.vx = (nx - p.x) / dt;
    p.vz = (nz - p.z) / dt;
    const s = Math.hypot(p.vx, p.vz);
    if (s > PERSON.speed * 3) { p.vx = 0; p.vz = 0; }
    p.sp = Math.min(PERSON.speed, s);
    if (p.sp > 0.3) p.h = Math.atan2(p.vz, p.vx);
  }
  p.x = nx;
  p.z = nz;
}

// ------------------------------------------------------------------ cats

function threat(g, c) {
  const T = TYPES[c.type];
  const R = T.flee;
  if (!R) return null;
  let fx = 0;
  let fz = 0;
  let pressure = 0;
  let near = Infinity;
  let who = -1;
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
    const pr = clamp((R - d) / Math.max(0.5, R - 1), 0, 1);
    if (pr > pressure) pressure = pr;
    if (d < near) { near = d; who = p.slot; }
  }
  if (who < 0) return null;
  const l = Math.hypot(fx, fz);
  if (l < 1e-6) {
    const p = g.people[who];
    fx = Math.cos(p.h);
    fz = Math.sin(p.h);
  } else {
    fx /= l;
    fz /= l;
  }
  return { fx, fz, pressure, near, who };
}

function nearestPerson(g, c, within = Infinity) {
  let best = null;
  let bd = within;
  for (const p of g.people) {
    if (!p.active) continue;
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

/** Steer along walls instead of into them. Returns the heading to take, and flags a cat with nowhere to go. */
function slide(g, c, dirA, speed) {
  const look = 0.45 + speed * 0.28;
  let dx = Math.cos(dirA);
  let dz = Math.sin(dirA);
  const free = freeAhead(g.world, c.x, c.z, dx, dz, look);
  if (free >= look - 0.01) { c.cornerT = 0; return { a: dirA, cornered: false }; }
  const n = normalNear(g.world, c.x + dx * (free + 0.2), c.z + dz * (free + 0.2), 1.0);
  let tx = -n.nz;
  let tz = n.nx;
  if (tx * dx + tz * dz < 0) { tx = -tx; tz = -tz; }
  // when the push is square into the wall, slide toward the open side
  if (Math.abs(tx * dx + tz * dz) < 0.15) {
    const fa = freeAhead(g.world, c.x, c.z, tx, tz, 1.5);
    const fb = freeAhead(g.world, c.x, c.z, -tx, -tz, 1.5);
    if (fb > fa) { tx = -tx; tz = -tz; }
  }
  const tFree = freeAhead(g.world, c.x, c.z, tx, tz, 0.5);
  const blend = clamp(free / look, 0, 1);
  const ax = dx * blend + tx * (1 - blend) + n.nx * 0.15;
  const az = dz * blend + tz * (1 - blend) + n.nz * 0.15;
  const cornered = tFree < 0.3 && free < 0.3;
  return { a: Math.atan2(az, ax), cornered };
}

function avoidCarriers(g, c, a) {
  let ax = Math.cos(a);
  let az = Math.sin(a);
  for (const k of g.carriers) {
    const dx = c.x - k.x;
    const dz = c.z - k.z;
    const d = Math.hypot(dx, dz);
    if (d < CAT.carrierAvoid + 0.6 && d > 1e-3) {
      const w = (CAT.carrierAvoid + 0.6 - d) * 0.9;
      ax += (dx / d) * w;
      az += (dz / d) * w;
    }
  }
  return Math.atan2(az, ax);
}

function moveCat(g, c, a, speed, turn, dt, bounce = false) {
  if (!Number.isFinite(a)) a = c.h;
  c.h += clamp(angTo(c.h, a), -turn * dt, turn * dt);
  const ds = speed - c.sp;
  c.sp += clamp(ds, -CAT.accel * 1.6 * dt, CAT.accel * dt);
  if (c.sp < 0) c.sp = 0;
  // moving mostly along the heading, a little toward the goal so tight turns don't swing wide
  const ma = c.h + clamp(angTo(c.h, a), -0.5, 0.5) * 0.5;
  c.vx = Math.cos(ma) * c.sp;
  c.vz = Math.sin(ma) * c.sp;
  const pos = { x: c.x + c.vx * dt, z: c.z + c.vz * dt };
  const n = resolve(g.world, pos, CAT.radius * c.size);
  if ((n.nx || n.nz) && bounce) {
    const dot = Math.cos(c.h) * n.nx + Math.sin(c.h) * n.nz;
    if (dot < 0) {
      const rx = Math.cos(c.h) - 2 * dot * n.nx;
      const rz = Math.sin(c.h) - 2 * dot * n.nz;
      c.h = Math.atan2(rz, rx);
      c.aim = c.h;
      c.sp *= 0.9;
      emit(g, 'bounce', { c: c.id });
    }
  }
  c.vx = (pos.x - c.x) / dt;
  c.vz = (pos.z - c.z) / dt;
  c.x = pos.x;
  c.z = pos.z;
}

function startHide(g, c) {
  const hide = nearestHide(g.world, c.x, c.z, 25);
  if (!hide) {
    setState(c, S.bolt, CLAP.boltTime);
    return;
  }
  setState(c, S.runhide, 3.5);
  c.a = hide.index;
  c.hop = hide;
  emit(g, 'scared', { c: c.id });
}

function startSprint(g, c) {
  const T = TYPES[c.type];
  setState(c, S.sprint, T.sprintTime);
  c.h = c.aim;
  c.sp = T.sprint * 0.85;
  c.zoomT = g.rng.range(T.zoomEvery[0], T.zoomEvery[1]);
  emit(g, 'zoom', { c: c.id });
}

function hopDown(g, c, dx, dz, next, nextT, lureBy = -1) {
  const s = g.world.solids[c.a];
  let l = Math.hypot(dx, dz);
  if (l < 1e-6) { dx = 1; dz = 0; l = 1; }
  dx /= l;
  dz /= l;
  const tries = [[dx, dz], [-dz, dx], [dz, -dx], [-dx, -dz]];
  let target = null;
  if (s) {
    for (const [tx, tz] of tries) {
      // walk out from the middle until the cat is clear of the piece
      for (let t = 0.3; t < 3; t += 0.15) {
        const x = c.x + tx * t;
        const z = c.z + tz * t;
        const inside = x > s.x0 - 0.3 && x < s.x1 + 0.3 && z > s.z0 - 0.3 && z < s.z1 + 0.3;
        if (inside) continue;
        if (!blockedCat(g.world, x, z)) target = { x, z };
        break;
      }
      if (target) break;
    }
  }
  if (!target) target = { x: c.x + dx * 0.8, z: c.z + dz * 0.8 };
  c.hop = { fx: c.x, fz: c.z, fy: c.y, tx: target.x, tz: target.z, ty: 0, next, nextT, lureBy };
  setState(c, S.hop, CAT.hop);
  c.h = Math.atan2(target.z - c.z, target.x - c.x);
  emit(g, 'hop', { c: c.id, up: false });
}

function hopUp(g, c, si) {
  const s = g.world.solids[si];
  const inset = 0.3;
  const tx = clamp(c.x, s.x0 + inset, s.x1 - inset);
  const tz = clamp(c.z, s.z0 + inset, s.z1 - inset);
  c.hop = { fx: c.x, fz: c.z, fy: 0, tx, tz, ty: s.perch, next: S.perch, nextT: g.rng.range(CAT.perchMin, CAT.perchMax) };
  c.a = si;
  setState(c, S.hop, CAT.hop);
  c.h = Math.atan2(tz - c.z, tx - c.x);
  c.swatted = false;
  emit(g, 'hop', { c: c.id, up: true });
}

function findPerch(g, c) {
  let best = -1;
  let bd = 1.4;
  g.world.solids.forEach((s, i) => {
    if (!s.perch || s.kind === 'carrier') return;
    const cx = clamp(c.x, s.x0, s.x1);
    const cz = clamp(c.z, s.z0, s.z1);
    const d = Math.hypot(c.x - cx, c.z - cz);
    if (d < bd && !g.cats.some((o) => o !== c && (o.st === S.perch || o.st === S.hop) && o.a === i)) { bd = d; best = i; }
  });
  return best;
}

function wanderPick(g, c) {
  // a new direction, away from walls and carriers
  let a = g.rng.range(-Math.PI, Math.PI);
  for (let i = 0; i < 6; i++) {
    const f = freeAhead(g.world, c.x, c.z, Math.cos(a), Math.sin(a), 2.5);
    if (f > 2) break;
    a = g.rng.range(-Math.PI, Math.PI);
  }
  return a;
}

function enterCarrier(g, c, k) {
  const wasSprint = c.st === S.sprint;
  c.entering = true;
  c.hop = { fx: c.x, fz: c.z, tx: k.x, tz: k.z };
  setState(c, S.enter, DOOR.pull);
  c.carrier = k.index;
  c.h = Math.atan2(-k.nz, -k.nx);
  k.count++;
  k.shutT = DOOR.pull + DOOR.shut;
  k.cats.push(c.id);
  g.boxed++;
  if (g.stats.firstBoxed == null) g.stats.firstBoxed = c.id;
  if (wasSprint && c.type === 'zoomer') { g.stats.zoomies = true; c.zoomed = true; }
  if (c.type === 'boss' && g.stats.bossFirst == null) {
    const gangOut = g.cats.some((o) => o.gang === c.id && o.st === S.boxed);
    g.stats.bossFirst = gangOut ? -1 : k.index;
  }
  emit(g, 'in', { c: c.id, ki: k.index, by: c.credit, zoom: wasSprint && c.type === 'zoomer' });
  // kittens tumble in after their cat; a gang goes with its Boss
  for (const o of g.cats) {
    if (OUT.has(o.st)) continue;
    if (o.type === 'kitten' && Math.hypot(o.x - c.x, o.z - c.z) < TYPES.kitten.followIn && o.st !== S.hidden && o.st !== S.perch) {
      o.followIn = { k: k.index, t: TYPES.kitten.followDelay };
    }
    if (c.type === 'boss' && o.gang === c.id) {
      o.followIn = { k: k.index, t: 0.4 + o.id * 0.05 };
    }
  }
  if (g.mode === 'catlady') g.clock = Math.min(g.clock + g.bonus, 600);
  if (g.mode === 'catlady') g.bonus = Math.max(CATLADY.bonusMin, g.bonus - CATLADY.bonusDrop);
}

function checkDoor(g, c) {
  if (!CAN_ENTER.has(c.st)) return;
  const sp = Math.hypot(c.vx, c.vz);
  // marching cats and cats following treats go in on any step over the mat that isn't leaving it
  const relaxed = c.st === S.march || c.st === S.lured;
  for (const k of g.carriers) {
    if (k.closed) continue;
    const m = onMat(k, c.x, c.z);
    if (!m) continue;
    const inward = sp > 1e-3 ? -(c.vx * k.nx + c.vz * k.nz) / sp : 0;
    const going = c.st === S.march ? inward > -0.2 || sp < 0.3 : relaxed ? sp > 0.2 && inward > 0.05 : sp > DOOR.minSpeed && inward > DOOR.cosEntry;
    if (!going) continue;
    if (!g.authority) {
      setState(c, S.hold, 0.6);
      c.carrier = k.index;
      return;
    }
    if (k.shutT > 0) {
      c.hop = { fx: c.x, fz: c.z, tx: c.x + k.nx * 0.8, tz: c.z + k.nz * 0.8 };
      setState(c, S.bump, 0.3);
      emit(g, 'bump', { c: c.id, ki: k.index });
      return;
    }
    enterCarrier(g, c, k);
    return;
  }
}

function updateCat(g, c, dt) {
  const T = TYPES[c.type];
  c.tt -= dt;
  c.fleeMem = Math.max(0, c.fleeMem - dt);
  c.creditT = Math.max(0, c.creditT - dt);
  if (c.creditT <= 0) c.credit = null;
  c.glance = Math.max(0, c.glance - dt);
  c.wobT -= dt;
  if (c.wobT <= 0) {
    c.wobT = 0.5;
    c.wob = (((hash(`${c.id}:${Math.floor(g.time * 2)}`) % 1000) / 1000) * 2 - 1) * CAT.wobble;
  }

  // a kitten or gang cat that saw its cat go in follows it
  if (c.followIn && !OUT.has(c.st)) {
    c.followIn.t -= dt;
    if (c.followIn.t <= 0 && c.st !== S.march && c.st !== S.hidden && c.st !== S.perch && c.st !== S.hop) {
      setState(c, S.march, 30);
      c.a = c.followIn.k;
      c.path = null;
    }
  }

  switch (c.st) {
    case S.boxed:
      return;
    case S.enter: {
      const t = clamp(1 - c.tt / DOOR.pull, 0, 1);
      const e = t * t * (3 - 2 * t);
      c.x = c.hop.fx + (c.hop.tx - c.hop.fx) * e;
      c.z = c.hop.fz + (c.hop.tz - c.hop.fz) * e;
      c.sp = 0;
      if (c.tt <= 0) { c.st = S.boxed; c.entering = false; c.hop = null; emit(g, 'boxed', { c: c.id, ki: c.carrier }); }
      return;
    }
    case S.hold: {
      c.sp = 0;
      c.vx = 0;
      c.vz = 0;
      if (c.tt <= 0) setState(c, S.idle, 0.5);
      return;
    }
    case S.bump: {
      const t = clamp(1 - c.tt / 0.3, 0, 1);
      if (c.hop) {
        const pos = { x: c.hop.fx + (c.hop.tx - c.hop.fx) * t, z: c.hop.fz + (c.hop.tz - c.hop.fz) * t };
        resolve(g.world, pos, CAT.radius * c.size);
        c.x = pos.x;
        c.z = pos.z;
      }
      c.y = Math.sin(t * Math.PI) * 0.25;
      if (c.tt <= 0) { c.y = 0; c.hop = null; setState(c, S.settle, CAT.settle); c.fleeMem = 1; }
      return;
    }
    case S.hop: {
      const hp = c.hop;
      if (!hp) { setState(c, S.idle, 1); return; }
      const t = clamp(1 - c.tt / CAT.hop, 0, 1);
      c.x = hp.fx + (hp.tx - hp.fx) * t;
      c.z = hp.fz + (hp.tz - hp.fz) * t;
      c.y = hp.fy + (hp.ty - hp.fy) * t + Math.sin(t * Math.PI) * 0.45;
      c.sp = 0;
      if (c.tt <= 0) {
        c.x = hp.tx;
        c.z = hp.tz;
        c.y = hp.ty;
        const next = hp.next ?? S.idle;
        setState(c, next, hp.nextT ?? 1);
        if (next === S.lured) c.lureBy = hp.lureBy ?? -1;
        if (next === S.bolt) c.aim = c.h;
        c.hop = null;
        if (next !== S.perch) c.y = 0;
      }
      return;
    }
    case S.perch: {
      c.sp = 0;
      const s = g.world.solids[c.a];
      c.y = s ? s.perch : 0;
      const near = nearestPerson(g, c, 6);
      if (near) c.look = near.slot;
      if (g.authority && s && !c.swatted && s.props > 0 && c.tt < 4 && g.rng.chance(CAT.swatChance * dt * 0.5)) {
        c.swatted = true;
        crash(g, c, s);
      }
      if (g.authority && c.tt <= 0) {
        const a = g.rng.range(-Math.PI, Math.PI);
        hopDown(g, c, Math.cos(a), Math.sin(a), S.idle, 1.5);
      }
      return;
    }
    case S.hidden: {
      c.sp = 0;
      if (g.authority && !c.surprise && c.tt <= 0 && !nearestPerson(g, c, 5)) {
        setState(c, S.creep, 0.8);
        emit(g, 'emerge', { c: c.id });
      }
      return;
    }
    case S.creep: {
      const s = g.world.solids[c.a];
      const lp = g.people[c.lureBy];
      let a = c.h;
      if (lp) a = Math.atan2(lp.z - c.z, lp.x - c.x);
      moveCatFree(g, c, s, a, T.creep ?? 1.2, dt);
      if (c.tt <= 0 || !s || !insideSolid(s, c.x, c.z, 0.05)) {
        if (lp) {
          setState(c, S.lured, T.lureTime || 2);
          c.lureBy = lp.slot;
        } else setState(c, S.idle, 1);
        // out from under: make sure it stands somewhere free
        const pos = { x: c.x, z: c.z };
        resolve(g.world, pos, CAT.radius * c.size);
        c.x = pos.x;
        c.z = pos.z;
      }
      return;
    }
    case S.runhide: {
      const hp = c.hop;
      if (!hp) { setState(c, S.flee, 0.5); return; }
      const d = Math.hypot(hp.ex - c.x, hp.ez - c.z);
      if (d < 0.35) {
        c.x = hp.hx;
        c.z = hp.hz;
        c.h = Math.atan2(hp.nz, hp.nx);
        setState(c, S.hidden, T.emerge ?? 15);
        c.a = hp.index;
        c.hop = null;
        emit(g, 'hide', { c: c.id });
        return;
      }
      const a = pathDir(g, c, hp.ex, hp.ez, dt);
      moveCat(g, c, a, 5, CAT.fleeTurn, dt);
      if (c.tt <= 0) { c.hop = null; setState(c, S.flee, 0.5); }
      return;
    }
    case S.sleep: {
      c.sp = 0;
      c.vx = 0;
      c.vz = 0;
      return;
    }
    case S.scoot: {
      const t = clamp(1 - c.tt / T.scootTime, 0, 1);
      const sp = (T.scoot / T.scootTime) * 2 * (1 - t);
      c.sp = sp;
      moveCat(g, c, c.aim, sp, 20, dt);
      c.sp = sp;
      c.h = c.aim;
      checkDoor(g, c);
      if (c.st === S.scoot && c.tt <= 0) { setState(c, S.sleep, 999); c.sp = 0; }
      return;
    }
    case S.wiggle: {
      const near = nearestPerson(g, c, T.aimRadius);
      if (near) c.aim = Math.atan2(c.z - near.z, c.x - near.x);
      c.h += clamp(angTo(c.h, c.aim), -6 * dt, 6 * dt);
      c.sp = 0;
      c.vx = 0;
      c.vz = 0;
      if (c.tt <= 0) { c.aim = c.h; startSprint(g, c); }
      return;
    }
    case S.sprint: {
      moveCat(g, c, c.h, T.sprint, 3, dt, true);
      checkDoor(g, c);
      if (c.st === S.sprint && c.tt <= 0) { setState(c, S.trot, 0.6); c.fleeMem = 1; }
      return;
    }
    case S.bolt: case S.trot: case S.stalk: {
      const sp = c.st === S.bolt ? CLAP.bolt : c.st === S.trot ? CLAP.trot : T.stalk;
      const sl = slide(g, c, c.aim + c.wob, sp);
      if (sl.cornered && c.st === S.bolt) c.aim = sl.a;
      moveCat(g, c, sl.a, sp, CAT.fleeTurn, dt);
      checkDoor(g, c);
      if (c.tt <= 0 && (c.st === S.bolt || c.st === S.trot || c.st === S.stalk)) {
        if (c.st === S.bolt) setState(c, S.trot, CLAP.trotTime);
        else { setState(c, S.settle, CAT.settle); c.fleeMem = 1; }
      }
      return;
    }
    case S.crouch: {
      c.sp = Math.max(0, c.sp - 20 * dt);
      moveCat(g, c, c.h, 0, 6, dt);
      if (c.tt <= 0) {
        setState(c, S.slip, CAT.slipTime);
        emit(g, 'slip', { c: c.id });
      }
      return;
    }
    case S.slip: {
      moveCat(g, c, c.aim, CAT.slipSpeed, CAT.fleeTurn, dt);
      checkDoor(g, c);
      if (c.st === S.slip && c.tt <= 0) { setState(c, S.settle, CAT.settle); c.fleeMem = 1.2; }
      return;
    }
    case S.snub: {
      c.sp = Math.max(0, c.sp - 8 * dt);
      moveCat(g, c, c.h, 0, 4, dt);
      if (c.tt <= 0) setState(c, S.idle, 1);
      return;
    }
    case S.content: {
      c.sp = Math.max(0, c.sp - 8 * dt);
      moveCat(g, c, c.h, 0, 4, dt);
      if (c.tt <= 0) setState(c, S.idle, 0.3);
      return;
    }
    case S.lured: {
      const p = g.people[c.lureBy];
      if (!p || !p.active) { setState(c, S.idle, 0.5); return; }
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      const d = Math.hypot(dx, dz);
      const sp = d > TREATS.stopAt ? T.lureSpeed * clamp((d - TREATS.stopAt) / 0.6, 0.2, 1) : 0;
      const a = d > 0.05 ? (d > 2 ? pathDir(g, c, p.x, p.z, dt) : Math.atan2(dz, dx)) : c.h;
      const sl = slide(g, c, a, sp);
      moveCat(g, c, sl.a, sp, CAT.fleeTurn, dt);
      checkDoor(g, c);
      if (c.st === S.lured && c.tt <= 0) setState(c, S.content, TREATS.content);
      return;
    }
    case S.march: {
      const k = g.carriers[c.a];
      if (!k) { setState(c, S.idle, 1); c.followIn = null; return; }
      const th = threat(g, c);
      if (th && th.near < 2.2) {
        const sl = slide(g, c, Math.atan2(th.fz, th.fx), TYPES[c.type].fleeMax * 0.8);
        moveCat(g, c, sl.a, TYPES[c.type].fleeMax * 0.8, CAT.fleeTurn, dt);
        return;
      }
      const onIt = onMat(k, c.x, c.z);
      const tx = onIt ? k.doorX : k.matX;
      const tz = onIt ? k.doorZ : k.matZ;
      const a = onIt ? Math.atan2(tz - c.z, tx - c.x) : pathDir(g, c, tx, tz, dt);
      moveCat(g, c, a, c.type === 'kitten' ? 2.4 : TYPES.boss.march, CAT.fleeTurn, dt);
      checkDoor(g, c);
      if (c.st === S.march && c.tt <= 0) { setState(c, S.idle, 1); c.followIn = null; }
      return;
    }
    case S.alert: {
      // the tell: stop, look at whoever is coming, then go
      c.sp = Math.max(0, c.sp - 12 * dt);
      const near = nearestPerson(g, c, T.flee + 0.5);
      if (near) c.look = near.slot;
      c.glance = 0.4;
      moveCat(g, c, c.h, 0, 3, dt);
      if (c.tt <= 0) { setState(c, S.flee, 0); c.fleeMem = 1.5; c.lingerT = CAT.linger; }
      return;
    }
    default:
      break;
  }

  // ------- calm and fleeing cats
  const th = threat(g, c);
  if (th && !IGNORES_PUSH.has(c.st)) {
    if (CALM.has(c.st) || c.st === S.idle) {
      if (c.fleeMem > 0 && c.st === S.settle) setState(c, S.flee, 0);
      else {
        setState(c, S.alert, c.tell);
        c.look = th.who;
        emit(g, 'alert', { c: c.id });
        return;
      }
    }
    if (c.st === S.flee) {
      c.lingerT = CAT.linger;
      const p = g.people[th.who];
      if (p) { c.credit = p.id; c.creditT = 2; }
      // zoomers wind up when crowded
      if (c.type === 'zoomer' && g.authority) {
        c.zoomT -= dt * 0.5;
        if (c.zoomT <= 0) { setState(c, S.wiggle, T.wiggle); c.aim = Math.atan2(th.fz, th.fx); emit(g, 'wiggle', { c: c.id }); return; }
      }
      const speed = T.fleeMin + (T.fleeMax - T.fleeMin) * th.pressure;
      const a = Math.atan2(th.fz, th.fx) + c.wob;
      const sl = slide(g, c, a, speed);
      if (sl.cornered) {
        c.cornerT += dt;
        if (c.cornerT > CAT.cornerTime) {
          const p2 = g.people[th.who];
          slipPast(g, c, p2);
          return;
        }
      }
      moveCat(g, c, sl.a, speed, CAT.fleeTurn, dt);
      checkDoor(g, c);
      return;
    }
  }

  if (c.st === S.flee) {
    c.lingerT -= dt;
    const a = c.h;
    const sl = slide(g, c, a, c.sp);
    moveCat(g, c, sl.a, Math.max(c.sp, 1.2), CAT.fleeTurn, dt);
    checkDoor(g, c);
    if (c.st === S.flee && c.lingerT <= 0) setState(c, S.settle, CAT.settle);
    return;
  }
  if (c.st === S.settle) {
    const sp = Math.max(0, c.sp - (c.sp / Math.max(0.05, c.tt + dt)) * dt);
    moveCat(g, c, c.h, sp, CAT.calmTurn, dt);
    checkDoor(g, c);
    if (c.st === S.settle && c.tt <= 0) {
      setState(c, S.idle, 1 + (g.authority ? g.rng.range(1, 4) : 2));
      const near = nearestPerson(g, c, 8);
      if (near) c.look = near.slot;
    }
    return;
  }

  // calm life: kittens follow, gangs follow the Boss, zoomers zoom, everybody wanders, sits and perches
  if (c.type === 'kitten') {
    const mum = nearestAdult(g, c, T.followRange);
    if (mum) {
      const bx = mum.x - Math.cos(mum.h) * T.followGap;
      const bz = mum.z - Math.sin(mum.h) * T.followGap;
      const d = Math.hypot(bx - c.x, bz - c.z);
      if (d > 0.35) {
        if (c.st !== S.follow) setState(c, S.follow, 1);
        const sp = Math.min(T.fleeMax, d * 2.2);
        moveCat(g, c, avoidCarriers(g, c, Math.atan2(bz - c.z, bx - c.x)), sp, CAT.calmTurn * 1.5, dt);
        checkDoor(g, c);
        return;
      }
    }
  }
  if (c.gang >= 0) {
    const boss = g.cats[c.gang];
    if (boss && !OUT.has(boss.st) && Math.hypot(boss.x - c.x, boss.z - c.z) < TYPES.boss.gangRange) {
      const slotI = g.cats.filter((o) => o.gang === c.gang && o.id < c.id).length;
      const side = slotI % 2 === 0 ? 1 : -1;
      const back = 1.4 + Math.floor(slotI / 2) * 0.9;
      const bx = boss.x - Math.cos(boss.h) * back + Math.cos(boss.h + Math.PI / 2) * side * 0.8;
      const bz = boss.z - Math.sin(boss.h) * back + Math.sin(boss.h + Math.PI / 2) * side * 0.8;
      const d = Math.hypot(bx - c.x, bz - c.z);
      if (d > 0.4) {
        if (c.st !== S.follow) setState(c, S.follow, 1);
        const sp = Math.min(2.2, d * 1.8);
        moveCat(g, c, avoidCarriers(g, c, Math.atan2(bz - c.z, bx - c.x)), sp, CAT.calmTurn * 1.5, dt);
        checkDoor(g, c);
        return;
      }
    }
  }
  if (c.st === S.follow) setState(c, S.idle, 0.6);

  if (c.type === 'zoomer' && g.authority) {
    c.zoomT -= dt;
    if (c.zoomT <= 0 && !g.over) {
      setState(c, S.wiggle, T.wiggle);
      const near = nearestPerson(g, c, T.aimRadius);
      c.aim = near ? Math.atan2(c.z - near.z, c.x - near.x) : wanderPick(g, c);
      emit(g, 'wiggle', { c: c.id });
      return;
    }
  }

  if (c.st === S.walk) {
    const a = avoidCarriers(g, c, c.aim + c.wob);
    const sl = slide(g, c, a, T.calm);
    moveCat(g, c, sl.a, T.calm, CAT.calmTurn, dt);
    if (c.tt <= 0 && g.authority) setState(c, S.idle, g.rng.range(2, 6));
    else if (c.tt <= 0) setState(c, S.idle, 2);
    return;
  }
  // idle: sitting
  c.sp = Math.max(0, c.sp - 6 * dt);
  moveCat(g, c, c.h, c.sp, CAT.calmTurn, dt);
  if (!g.authority || c.tt > 0) return;
  if (g.mode !== 'ambient' && g.rng.chance(0.35)) {
    const pi = findPerch(g, c);
    if (pi >= 0 && g.rng.chance(CAT.perchChance * 12)) { hopUp(g, c, pi); return; }
  }
  setState(c, S.walk, g.rng.range(1, 3));
  c.aim = wanderPick(g, c);
}

function nearestAdult(g, c, range) {
  let best = null;
  let bd = range;
  for (const o of g.cats) {
    if (o === c || o.type === 'kitten' || OUT.has(o.st) || o.st === S.hidden || o.st === S.perch) continue;
    const d = Math.hypot(o.x - c.x, o.z - c.z);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

function slipPast(g, c, p) {
  const fx = p ? c.x - p.x : Math.cos(c.h);
  const fz = p ? c.z - p.z : Math.sin(c.h);
  const l = Math.hypot(fx, fz) || 1;
  // along the wall, on the side with more room, past the person
  const ta = { x: -fz / l, z: fx / l };
  const fa = freeAhead(g.world, c.x, c.z, ta.x, ta.z, 3);
  const fb = freeAhead(g.world, c.x, c.z, -ta.x, -ta.z, 3);
  const s = fa >= fb ? 1 : -1;
  const back = 0.55;
  c.aim = Math.atan2(ta.z * s - (fz / l) * back, ta.x * s - (fx / l) * back);
  setState(c, S.crouch, CAT.crouch);
  emit(g, 'crouch', { c: c.id });
}

function insideSolid(s, x, z, pad = 0) {
  return x > s.x0 - pad && x < s.x1 + pad && z > s.z0 - pad && z < s.z1 + pad;
}

function moveCatFree(g, c, s, a, speed, dt) {
  // creeping out from under furniture: collisions with that piece are off
  c.h += clamp(angTo(c.h, a), -6 * dt, 6 * dt);
  c.sp = speed;
  c.vx = Math.cos(c.h) * speed;
  c.vz = Math.sin(c.h) * speed;
  const pos = { x: c.x + c.vx * dt, z: c.z + c.vz * dt };
  const skip = s ? g.world.solids.indexOf(s) : -1;
  resolve(g.world, pos, CAT.radius * c.size, skip);
  c.x = pos.x;
  c.z = pos.z;
}

function pathDir(g, c, tx, tz, dt) {
  c.pathT -= dt;
  const direct = Math.atan2(tz - c.z, tx - c.x);
  if (freeAhead(g.world, c.x, c.z, Math.cos(direct), Math.sin(direct), Math.min(2, Math.hypot(tx - c.x, tz - c.z))) >= Math.min(1.9, Math.hypot(tx - c.x, tz - c.z) - 0.1)) {
    return direct;
  }
  if (!c.path || c.pathT <= 0) {
    c.path = findPath(g.world, c.x, c.z, tx, tz, true);
    c.pathT = 1;
  }
  if (!c.path || c.path.length < 2) return direct;
  while (c.path.length > 1 && Math.hypot(c.path[1].x - c.x, c.path[1].z - c.z) < 0.4) c.path.shift();
  const w = c.path[1] ?? c.path[0];
  return Math.atan2(w.z - c.z, w.x - c.x);
}

function crash(g, c, s) {
  const x = clamp(c.x + Math.cos(c.h) * 0.4, s.x0, s.x1);
  const z = clamp(c.z + Math.sin(c.h) * 0.4, s.z0, s.z1);
  // it lands just off the edge
  const ox = x <= s.x0 + 0.01 ? -0.3 : x >= s.x1 - 0.01 ? 0.3 : 0;
  const oz = z <= s.z0 + 0.01 ? -0.3 : z >= s.z1 - 0.01 ? 0.3 : 0.3;
  emit(g, 'crash', { c: c.id, x: x + ox, z: z + oz, y: s.perch, s: g.world.solids.indexOf(s) });
  for (const o of g.cats) {
    if (o === c || OUT.has(o.st)) continue;
    const d = Math.hypot(o.x - x, o.z - z);
    if (o.type === 'scaredy' && d < CAT.crashScare && o.st !== S.hidden) startHide(g, o);
    else if (d < 3 && CALM.has(o.st)) { setState(o, S.alert, 0.3); emit(g, 'alert', { c: o.id }); }
  }
}

function separate(g) {
  const cats = g.cats;
  for (let i = 0; i < cats.length; i++) {
    const a = cats[i];
    if (!free(a)) continue;
    for (let j = i + 1; j < cats.length; j++) {
      const b = cats[j];
      if (!free(b)) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const min = CAT.separation * 0.5 * (a.size + b.size);
      const dd = dx * dx + dz * dz;
      if (dd >= min * min || dd < 1e-9) continue;
      const d = Math.sqrt(dd);
      const push = (min - d) * 0.5;
      const ux = dx / d;
      const uz = dz / d;
      const pa = { x: a.x - ux * push, z: a.z - uz * push };
      const pb = { x: b.x + ux * push, z: b.z + uz * push };
      resolve(g.world, pa, CAT.radius * a.size);
      resolve(g.world, pb, CAT.radius * b.size);
      if (a.st !== S.sleep) { a.x = pa.x; a.z = pa.z; }
      if (b.st !== S.sleep) { b.x = pb.x; b.z = pb.z; }
    }
  }
  // people step round cats (never the other way: a cat only moves for its own reasons)
  for (const p of g.people) {
    if (!p.active || p.external) continue;
    for (const c of cats) {
      if (!free(c)) continue;
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      const min = PERSON.radius + CAT.radius * c.size;
      const dd = dx * dx + dz * dz;
      if (dd >= min * min || dd < 1e-9) continue;
      const d = Math.sqrt(dd);
      const pos = { x: c.x + (dx / d) * min, z: c.z + (dz / d) * min };
      resolve(g.world, pos, PERSON.radius);
      p.x = pos.x;
      p.z = pos.z;
    }
  }
}

function free(c) {
  return !(OUT.has(c.st) || c.st === S.hidden || c.st === S.perch || c.st === S.hop || c.st === S.creep);
}

// ------------------------------------------------------------------ modes

function catladyTick(g, dt) {
  const loose = g.cats.filter((c) => !OUT.has(c.st)).length;
  const target = Math.min(CATLADY.looseMax, CATLADY.loose + Math.floor(g.boxed / CATLADY.looseEvery));
  g.spawnT -= dt;
  if (loose < target && g.spawnT <= 0 && g.room.flap) {
    const n = g.spawned++;
    const pool = ['moggy', 'moggy', 'moggy'];
    if (g.boxed >= 5) pool.push('zoomer');
    if (g.boxed >= 10) pool.push('scaredy');
    if (g.boxed >= 15) pool.push('glutton', 'kitten', 'loaf');
    let type = g.rng.pick(pool);
    const coat = g.rng.pick(['ginger', 'grey', 'tuxedo', 'calico', 'black', 'white', 'tortie', 'siamese']);
    if (g.boxed >= 20 && !g.cats.some((c) => c.type === 'boss' && !OUT.has(c.st)) && g.rng.chance(0.25)) type = 'boss';
    const c = addCat(g, { type, coat, x: g.room.flap.x, z: g.room.flap.z + 0.5, h: Math.PI / 2 });
    c.st = type === 'loaf' ? S.sleep : S.walk;
    c.tt = 1.2;
    c.aim = Math.PI / 2;
    if (type === 'loaf') { c.x = g.room.flap.x; c.z = g.room.flap.z + 1.6; }
    if (type === 'boss') {
      for (let i = 0; i < 2; i++) {
        const m = addCat(g, { type: 'moggy', coat: g.rng.pick(['black', 'grey', 'tuxedo']), x: g.room.flap.x + (i ? 0.6 : -0.6), z: g.room.flap.z + 1.2, gang: c.id });
        m.st = S.walk;
        m.tt = 1;
        m.aim = Math.PI / 2;
      }
    }
    g.total = g.cats.length;
    emit(g, 'arrive', { c: c.id, n });
    g.spawnT = 0.8;
  }
}

function modeTick(g, dt) {
  for (const k of g.carriers) k.shutT = Math.max(0, k.shutT - dt);
  if (g.over) return;
  if (g.mode === 'catlady' && g.authority) catladyTick(g, dt);
  if (g.started && g.clock != null) {
    g.clock -= dt;
    g.elapsed += dt;
  }
  // a predicting copy never ends a round or reveals a cat: the host's snapshots do
  if (!g.authority) return true;
  if (g.mode === 'level') {
    const hiddenSurprise = g.cats.find((c) => c.surprise);
    const counted = g.cats.filter((c) => !c.surprise);
    if (hiddenSurprise && counted.every((c) => c.st === S.boxed)) {
      hiddenSurprise.surprise = false;
      setState(hiddenSurprise, S.creep, 1.0);
      hiddenSurprise.lureBy = -1;
      g.total++;
      emit(g, 'surprise', { c: hiddenSurprise.id });
    }
  }
  const loose = g.cats.some((c) => !c.surprise && c.st !== S.boxed);
  const anyLeft = g.cats.some((c) => c.st !== S.boxed);
  if (g.mode === 'level' || g.mode === 'versus' || g.mode === 'together') {
    if (!anyLeft && g.cats.length) finish(g, true);
    else if (g.clock != null && g.clock <= 0) finish(g, false);
  } else if (g.mode === 'catlady') {
    if (g.clock != null && g.clock <= 0) finish(g, false);
  }
  return loose;
}

function finish(g, allIn) {
  g.over = true;
  if (g.clock != null) g.clock = Math.max(0, g.clock);
  g.result = { allIn, time: g.elapsed, boxed: g.boxed, counts: g.carriers.map((k) => k.count) };
  emit(g, allIn ? 'allin' : 'timeup', {});
}

/** One fixed step: people, cats, carriers, the clock. */
export function step(g, dt = STEP) {
  g.time += dt;
  for (const p of g.people) movePerson(g, p, dt);
  for (const c of g.cats) {
    updateCat(g, c, dt);
    if (!Number.isFinite(c.x) || !Number.isFinite(c.z)) {
      c.x = g.world.w / 2;
      c.z = g.world.d / 2;
      c.sp = 0;
    }
    if (!Number.isFinite(c.h)) c.h = 0;
    if (c.st !== S.hop && c.st !== S.perch && c.st !== S.bump) c.y = 0;
  }
  separate(g);
  modeTick(g, dt);
}

export function loose(g) {
  return g.cats.filter((c) => c.st !== S.boxed && c.st !== S.enter && !c.surprise);
}

export const isOut = (c) => OUT.has(c.st);
