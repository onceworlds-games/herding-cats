// The herding simulation: people, cats, carriers and the clock, stepped at a fixed 30 Hz. Pure: no page, no three.js.
// The authoritative copy (solo, or the host) decides everything; a predicting copy (`authority: false`) only runs the
// reactive steering (fleeing, lures, bolts, sprints) and leaves every decision (going in, hiding, perching, new wanders) to
// the host's snapshots.

import { STEP, PERSON, TREATS, CLAP, DOOR, CAT, TYPES, S, CATLADY, COMBO, LASER, VAC, BELL, BOX, SUN } from './tuning.js';
import { makeRng, hash } from './rng.js';
import { buildWorld, resolve, freeAhead, normalNear, nearestHide, freeSpot, onMat, findPath, overlaps } from './world.js';
import { threat, shotStep, knockable, touchGap, hopSpot, doorFor } from './motion.js';
import { sunPatches, inSun } from './sun.js';
import { rollCoat } from './coats.js';

const TAU = Math.PI * 2;
const angTo = (a, b) => ((((b - a) % TAU) + TAU + Math.PI) % TAU) - Math.PI;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const fin = (v, d = 0) => (Number.isFinite(v) ? v : d);

const CALM = new Set([S.idle, S.walk, S.settle, S.follow, S.seek]);
const CAN_ENTER = new Set([S.flee, S.settle, S.walk, S.bolt, S.trot, S.slip, S.scoot, S.sprint, S.march, S.lured, S.stalk, S.follow, S.idle, S.chase, S.seek]);
const IGNORES_PUSH = new Set([S.enter, S.boxed, S.bump, S.hop, S.perch, S.runhide, S.hidden, S.creep, S.sleep, S.scoot, S.wiggle, S.sprint, S.slip, S.crouch, S.lured, S.content, S.bolt, S.trot, S.hold, S.arrive, S.snub, S.stalk, S.chase, S.ride, S.boxsit, S.nap]);
const OUT = new Set([S.enter, S.boxed]);
// what the laser dot pulls away from whatever it was doing
const CHASERS = new Set([S.idle, S.walk, S.alert, S.flee, S.settle, S.follow, S.content, S.seek, S.nap, S.lured, S.snub]);

/**
 * opts: { room, mode: 'level' | 'versus' | 'together' | 'catlady' | 'ambient', cats: [{ type, coat, x, z, gang, perch, surprise }],
 *         seed, clock, authority = true, owners: [seatId per carrier],
 *         twists: { laser: { x, z, delay }, vacs: [{ x, z, h }], bell: { every, first }, boxes: [{ x, z }], sun: false } }
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
    stats: {
      zoomies: false, bossFirst: null, firstBoxed: null, bestCombo: 0, combos: 0, banks: 0, chains: 0, knocks: 0, claps: 0,
      treats: 0, crashes: 0, laserIns: 0, rides: 0, deliveries: 0, loafShot: false, shots: 0, hides: 0, comboCats: 0, shotIns: 0,
    },
  };
  const tw = opts.twists ?? {};
  g.suns = tw.sun === false ? [] : sunPatches(opts.room, world);
  g.laser = tw.laser ? { hx: tw.laser.x, hz: tw.laser.z, x: tw.laser.x, z: tw.laser.z, on: tw.laser.delay ? 2 : 0, holder: -1, t: tw.laser.delay ?? 0 } : null;
  g.vacs = (tw.vacs ?? []).map((v) => ({ x: v.x, z: v.z, h: v.h ?? 0, rider: -1, turns: 0 }));
  g.bell = tw.bell ? { x: opts.room.entry?.x ?? 0, z: opts.room.entry?.z ?? 0, every: tw.bell.every, next: tw.bell.first ?? tw.bell.every, warned: false } : null;
  g.boxes = (tw.boxes ?? []).map((b) => ({ x: b.x, z: b.z, vx: 0, vz: 0, cat: -1, h: b.h ?? 0 }));
  for (const b of g.boxes) { const pos = { x: b.x, z: b.z }; resolve(world, pos, BOX.radius); b.x = pos.x; b.z = pos.z; }
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
    // now and then a rarer coat than the level asked for (its own dice, so nothing else about the cat changes)
    id, type, coat: spec.fixedCoat ? spec.coat ?? 'ginger' : rollCoat(makeRng(hash(`${g.seed}:${id}:coat`)), spec.coat ?? 'ginger'), gang: spec.gang ?? -1, size: T.size,
    x, z, h: fin(spec.h, r.range(-Math.PI, Math.PI)), sp: 0, vx: 0, vz: 0, y: 0,
    st: type === 'loaf' ? S.sleep : S.idle, tt: r.range(0.5, 3), a: 0, b: 0,
    tell: T.tell[0] + (T.tell[1] - T.tell[0]) * r.next(),
    wob: 0, wobT: 0, fleeMem: 0, lingerT: 0, cornerT: 0,
    zoomT: T.zoomEvery ? r.range(T.zoomEvery[0], T.zoomEvery[1]) : 0,
    aim: 0, lureBy: -1, carrier: -1, hop: null, path: null, pathT: 0,
    followIn: null, swatted: false, surprise: !!spec.surprise, credit: null, creditT: 0, by: null, entering: false, zoomed: false,
    look: -1, glance: 0, keep: 1, bounces: 0, chain: 0, claps: 0, how: null,
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
  g.stats.treats++;
  emit(g, 'treats', { p: p.slot, x: p.x, z: p.z });
  for (const c of g.cats) applyTreats(g, c, p);
  return true;
}

export function clap(g, p) {
  if (!p.active || p.clapCd > 0 || g.over) return false;
  p.clapCd = CLAP.cooldown;
  p.clapSeq++;
  p.lastClap = g.time;
  g.stats.claps++;
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
  if (c.st === S.chase) return; // the dot wins
  if (c.st === S.ride || c.st === S.boxsit) {
    leaveSeat(g, c);
    return hopOff(g, c, p.x - c.x, p.z - c.z, S.lured, T.lureTime, p.slot);
  }
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
  scatter(g, c, p.x, p.z, CLAP.radius, p.id, true);
}

/** A clap (or the doorbell) at (x, z): every cat in reach is shot straight away from it; a Scaredy dives for cover. */
function scatter(g, c, x, z, radius, credit, clapped = false) {
  if (OUT.has(c.st)) return;
  const T = TYPES[c.type];
  const dx = c.x - x;
  const dz = c.z - z;
  const d = Math.hypot(dx, dz);
  const away = Math.atan2(dz, dx);
  if (c.type === 'scaredy' && d < T.hideClap && c.st !== S.hidden && c.st !== S.ride && c.st !== S.boxsit) {
    if (g.authority) startHide(g, c);
    return;
  }
  if (d > radius) return;
  if (credit) { c.credit = credit; c.creditT = 3; }
  if (c.st === S.hidden || c.st === S.hop || c.st === S.enter || c.st === S.bump || c.st === S.creep) return;
  if (clapped) c.claps++;
  if (c.st === S.perch) return hopTo(g, c, hopSpot(g.world, c, dx, dz), S.bolt, CLAP.boltTime);
  if (c.type === 'boss') {
    setState(c, S.stalk, T.stalkTime);
    c.aim = away;
    return;
  }
  if (c.st === S.ride || c.st === S.boxsit) leaveSeat(g, c);
  g.stats.shots++;
  if (c.type === 'loaf') return startShot(g, c, S.scoot, T.scootTime, away);
  if (c.type === 'zoomer' && c.st === S.wiggle) {
    c.aim = away;
    startSprint(g, c);
    return;
  }
  startShot(g, c, S.bolt, CLAP.boltTime, away);
}

function startShot(g, c, st, tt, a) {
  setState(c, st, tt);
  c.aim = a;
  c.h = a;
  c.keep = 1;
  c.bounces = 0;
  c.chain = 0;
  c.y = 0;
  c.sp = st === S.scoot ? (TYPES.loaf.scoot / TYPES.loaf.scootTime) * 2 : CLAP.bolt;
  c.fleeMem = 1.5;
}

const SHOT = { x: 0, z: 0, h: 0, sp: 0, r: 0 };
/** One step of a shot cat: straight on, off walls and furniture, into other cats. False when the hit stopped it dead. */
function shotTick(g, c, speed, dt) {
  SHOT.x = c.x;
  SHOT.z = c.z;
  SHOT.h = c.h;
  SHOT.sp = speed;
  SHOT.r = CAT.radius * c.size;
  const bounced = shotStep(g.world, SHOT, dt);
  c.vx = (SHOT.x - c.x) / dt;
  c.vz = (SHOT.z - c.z) / dt;
  c.x = SHOT.x;
  c.z = SHOT.z;
  c.h = SHOT.h;
  c.aim = SHOT.h;
  c.sp = speed;
  if (bounced) {
    c.keep = Math.max(CLAP.minKeep, c.keep * CLAP.keep);
    c.bounces++;
    emit(g, 'bounce', { c: c.id, x: c.x, z: c.z });
  }
  for (const o of g.cats) {
    if (!knockable(c, o)) continue;
    const dx = o.x - c.x;
    const dz = o.z - c.z;
    const d = Math.hypot(dx, dz);
    if (d >= touchGap(c, o) || d < 1e-6) continue;
    const nx = dx / d;
    const nz = dz / d;
    const vx = Math.cos(c.h);
    const vz = Math.sin(c.h);
    const vn = vx * nx + vz * nz;
    if (vn <= 0.15) continue;
    knock(g, c, o, nx, nz, vn);
    // like a ball: the striker keeps what was across the line between them; head on, it stops dead
    const tx = vx - vn * nx;
    const tz = vz - vn * nz;
    const tl = Math.hypot(tx, tz);
    if (tl < 0.35) {
      setState(c, S.settle, CAT.settle);
      c.sp *= 0.25;
      c.fleeMem = 1;
      return false;
    }
    c.h = Math.atan2(tz, tx);
    c.aim = c.h;
    c.keep = Math.max(CLAP.minKeep, c.keep * tl);
    break;
  }
  return true;
}

/** Cat c's shot hits cat o: o runs on along the line between them (a Loaf slides, a wiggling Zoomer launches). */
function knock(g, c, o, nx, nz, vn) {
  const a = Math.atan2(nz, nx);
  if (c.credit) { o.credit = c.credit; o.creditT = 3; }
  if (o.type === 'loaf') startShot(g, o, S.scoot, TYPES.loaf.scootTime, a);
  else if (o.type === 'zoomer' && o.st === S.wiggle) { o.aim = a; startSprint(g, o); o.keep = 1; o.bounces = 0; }
  else startShot(g, o, S.bolt, CLAP.boltTime, a);
  o.keep = Math.max(0.55, Math.min(1, c.keep * (0.45 + 0.6 * vn)));
  o.chain = (c.chain | 0) + 1;
  g.stats.knocks++;
  emit(g, 'knock', { c: o.id, o: c.id, x: (c.x + o.x) / 2, z: (c.z + o.z) / 2 });
}

/** Off the vacuum or out of the box. */
function leaveSeat(g, c) {
  if (c.st === S.ride) { const v = g.vacs[c.a]; if (v && v.rider === c.id) v.rider = -1; }
  if (c.st === S.boxsit) { const b = g.boxes[c.a]; if (b && b.cat === c.id) b.cat = -1; }
  c.y = 0;
}

/** A little hop off a seat (the vacuum, a box) toward (dx, dz). */
function hopOff(g, c, dx, dz, next, nextT, lureBy = -1) {
  const l = Math.hypot(dx, dz) || 1;
  const pos = { x: c.x + (dx / l) * 0.85, z: c.z + (dz / l) * 0.85 };
  resolve(g.world, pos, CAT.radius * c.size);
  hopTo(g, c, pos, next, nextT, lureBy);
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
  if (g.started) g.stats.hides++;
  c.a = hide.index;
  c.hop = hide;
  emit(g, 'scared', { c: c.id });
}

function startSprint(g, c) {
  const T = TYPES[c.type];
  setState(c, S.sprint, T.sprintTime);
  c.h = c.aim;
  c.sp = T.sprint;
  c.keep = 1;
  c.bounces = 0;
  c.chain = 0;
  c.zoomT = g.rng.range(T.zoomEvery[0], T.zoomEvery[1]);
  emit(g, 'zoom', { c: c.id });
}

function hopDown(g, c, dx, dz, next, nextT, lureBy = -1) {
  hopTo(g, c, hopSpot(g.world, c, dx, dz), next, nextT, lureBy);
}

function hopTo(g, c, target, next, nextT, lureBy = -1) {
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

const TRICKS = ['bank', 'chain', 'laser', 'ride', 'box'];
export { TRICKS };

function enterCarrier(g, c, k, how = null) {
  const wasSprint = c.st === S.sprint;
  const shot = c.st === S.bolt || c.st === S.trot || c.st === S.scoot || c.st === S.sprint;
  how ??= shot && c.chain > 0 ? 'chain' : shot && c.bounces > 0 ? 'bank' : c.st === S.chase ? 'laser' : null;
  if (c.type === 'loaf' && c.st === S.scoot && c.claps === 1 && c.chain === 0) g.stats.loafShot = true;
  c.entering = true;
  c.hop = { fx: c.x, fz: c.z, tx: k.x, tz: k.z };
  setState(c, S.enter, DOOR.pull);
  c.carrier = k.index;
  c.h = Math.atan2(-k.nz, -k.nx);
  k.count++;
  // one after another: a combo
  const n = g.time - (k.lastIn ?? -99) <= COMBO.window ? (k.combo ?? 0) + 1 : 1;
  k.combo = n;
  k.lastIn = g.time;
  k.cats.push(c.id);
  c.how = how;
  if (how === 'bank') g.stats.banks++;
  if (how === 'chain') g.stats.chains++;
  if (how === 'laser') g.stats.laserIns++;
  if (how === 'ride') g.stats.rides++;
  if (how === 'box') g.stats.deliveries++;
  if (n >= 2) { g.stats.combos++; g.stats.comboCats++; }
  if (shot && !wasSprint) g.stats.shotIns++;
  g.stats.bestCombo = Math.max(g.stats.bestCombo, n);
  c.by = c.credit;
  g.boxed++;
  if (g.stats.firstBoxed == null) g.stats.firstBoxed = c.id;
  if (wasSprint && c.type === 'zoomer') { g.stats.zoomies = true; c.zoomed = true; }
  if (c.type === 'boss' && g.stats.bossFirst == null) {
    const gangOut = g.cats.some((o) => o.gang === c.id && o.st === S.boxed);
    g.stats.bossFirst = gangOut ? -1 : k.index;
  }
  emit(g, 'in', { c: c.id, ki: k.index, by: c.credit, zoom: wasSprint && c.type === 'zoomer', n, how });
  if (how) emit(g, 'trick', { c: c.id, ki: TRICKS.indexOf(how), x: k.matX, z: k.matZ });
  if (n >= 2) emit(g, 'combo', { c: n, ki: k.index, x: k.matX, z: k.matZ });
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
  if (g.mode === 'catlady') g.clock = Math.min(g.clock + g.bonus + (n - 1) * 3, 600);
  if (g.mode === 'catlady') g.bonus = Math.max(CATLADY.bonusMin, g.bonus - CATLADY.bonusDrop);
}

function checkDoor(g, c) {
  if (!CAN_ENTER.has(c.st)) return;
  const sp = Math.hypot(c.vx, c.vz);
  // marching cats and cats following treats go in on any step over the mat that isn't leaving it
  const relaxed = c.st === S.march || c.st === S.lured || c.st === S.chase;
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

  // the laser dot: everyone near it (but the Boss and a Loaf) drops everything
  const L = g.laser;
  if (L && L.on === 1 && CHASERS.has(c.st) && c.type !== 'boss' && c.type !== 'loaf' && Math.hypot(L.x - c.x, L.z - c.z) < LASER.radius) {
    setState(c, S.chase, 99);
    c.followIn = null;
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
      if (!c.hop) {
        const k = g.carriers[c.carrier] ?? g.carriers[0];
        c.hop = { fx: c.x, fz: c.z, tx: k ? k.x : c.x, tz: k ? k.z : c.z };
      }
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
      // a predicting copy that only heard of the hop from the host waits for the next word
      if (!hp) { if (g.authority) setState(c, S.idle, 1); else c.sp = 0; return; }
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
        if (next === S.bolt) startShot(g, c, S.bolt, hp.nextT ?? CLAP.boltTime, c.h);
        c.hop = null;
        if (next !== S.perch) c.y = 0;
        if (next === S.boxsit) emit(g, 'boxsit', { c: c.id });
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
      if (!hp) { if (g.authority) setState(c, S.flee, 0.5); else c.sp = 0; return; }
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
    case S.bolt: case S.trot: case S.scoot: case S.sprint: {
      // a shot: dead straight, off walls, into other cats
      let base;
      if (c.st === S.bolt) base = CLAP.bolt;
      else if (c.st === S.trot) base = CLAP.trot;
      else if (c.st === S.sprint) base = T.sprint;
      else base = (T.scoot / T.scootTime) * 2 * (1 - clamp((T.scootTime - c.tt - dt) / T.scootTime, 0, 1));
      const st = c.st;
      if (!shotTick(g, c, base * c.keep, dt)) return;
      checkDoor(g, c);
      if (c.st !== st || c.tt > 0) return;
      if (st === S.bolt) setState(c, S.trot, CLAP.trotTime);
      else if (st === S.sprint) setState(c, S.trot, 0.6);
      else if (st === S.scoot) { setState(c, S.sleep, 999); c.sp = 0; }
      else { setState(c, S.settle, CAT.settle); c.fleeMem = 1; }
      return;
    }
    case S.chase: {
      const Lz = g.laser;
      if (!Lz || Lz.on !== 1) { setState(c, S.settle, CAT.settle); return; }
      // a dot at a door: come at the door from in front, so it pulls the cat in
      let tx = Lz.x;
      let tz = Lz.z;
      const k = g.carriers.find((kk) => !kk.closed && Math.hypot(kk.doorX - Lz.x, kk.doorZ - Lz.z) < LASER.near);
      if (k) {
        const m = onMat(k, c.x, c.z);
        const front = m && Math.abs(m[1]) < DOOR.matW / 2 - 0.1;
        tx = front ? k.doorX - k.nx * 0.4 : k.matX + k.nx * 0.5;
        tz = front ? k.doorZ - k.nz * 0.4 : k.matZ + k.nz * 0.5;
      }
      const d = Math.hypot(tx - c.x, tz - c.z);
      const pace = c.type === 'glutton' ? 0.7 : c.type === 'kitten' ? 0.85 : c.type === 'zoomer' ? 1.2 : 1;
      const sp = d > 0.25 ? LASER.speed * pace * clamp(d / 0.9, 0.35, 1) : 0;
      const a = d > 0.05 ? (d > 1.5 ? pathDir(g, c, tx, tz, dt) : Math.atan2(tz - c.z, tx - c.x)) : c.h;
      moveCat(g, c, a, sp, CAT.fleeTurn * 1.3, dt);
      checkDoor(g, c);
      if (c.st === S.chase && Math.hypot(Lz.x - c.x, Lz.z - c.z) > LASER.radius + 2) setState(c, S.settle, CAT.settle);
      return;
    }
    case S.ride: {
      const v = g.vacs[c.a];
      if (!v || v.rider !== c.id) { setState(c, S.idle, 1); c.y = 0; return; }
      c.x = v.x;
      c.z = v.z;
      c.y = 0.12;
      c.h = v.h;
      c.sp = VAC.speed;
      c.vx = Math.cos(v.h) * VAC.speed;
      c.vz = Math.sin(v.h) * VAC.speed;
      const near = nearestPerson(g, c, 5);
      if (near) c.look = near.slot;
      // special delivery: the vacuum runs over a doormat heading in
      const k = g.authority ? doorFor(g, v.x, v.z, c.vx, c.vz) : null;
      if (k) { v.rider = -1; c.y = 0; enterCarrier(g, c, k, 'ride'); }
      return;
    }
    case S.boxsit: {
      const b = g.boxes[c.a];
      if (!b || b.cat !== c.id) { setState(c, S.idle, 1); c.y = 0; return; }
      c.x = b.x;
      c.z = b.z;
      c.y = 0.05;
      c.vx = b.vx;
      c.vz = b.vz;
      c.sp = Math.hypot(b.vx, b.vz);
      const near = nearestPerson(g, c, 5);
      if (near) { c.look = near.slot; c.h += clamp(angTo(c.h, Math.atan2(near.z - c.z, near.x - c.x)), -3 * dt, 3 * dt); }
      // pushed onto a doormat heading in: special delivery
      const k = g.authority ? doorFor(g, b.x, b.z, b.vx, b.vz) : null;
      if (k) { b.cat = -1; c.y = 0; enterCarrier(g, c, k, 'box'); }
      return;
    }
    case S.nap: {
      c.sp = 0;
      c.vx = 0;
      c.vz = 0;
      if (g.authority && c.tt <= 0) setState(c, S.idle, 1);
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
    case S.stalk: {
      const sl = slide(g, c, c.aim + c.wob, T.stalk);
      moveCat(g, c, sl.a, T.stalk, CAT.fleeTurn, dt);
      checkDoor(g, c);
      if (c.st === S.stalk && c.tt <= 0) { setState(c, S.settle, CAT.settle); c.fleeMem = 1; }
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

  if (c.st === S.seek) {
    // off to a box or a patch of sun
    const box = c.b === 1 ? g.boxes[c.a] : null;
    const sun = c.b === 2 ? g.suns[c.a] : null;
    if ((c.b === 1 && (!box || box.cat >= 0)) || (c.b === 2 && !sun) || (g.authority && c.tt <= 0)) { setState(c, S.idle, 1); return; }
    const tx = box ? box.x : sun ? sun.x : c.x;
    const tz = box ? box.z : sun ? sun.z : c.z;
    const d = Math.hypot(tx - c.x, tz - c.z);
    if (g.authority && box && d < BOX.radius + 0.55) {
      // if I fits, I sits
      box.cat = c.id;
      hopTo(g, c, { x: box.x, z: box.z }, S.boxsit, 999);
      c.hop.ty = 0.05;
      c.a = g.boxes.indexOf(box);
      return;
    }
    if (g.authority && sun && (d < 0.3 || (d < 0.8 && inSun(sun, c.x, c.z)))) {
      setState(c, S.nap, g.rng.range(SUN.nap[0], SUN.nap[1]));
      c.sp = 0;
      emit(g, 'nap', { c: c.id });
      return;
    }
    const a = d > 2 ? pathDir(g, c, tx, tz, dt) : Math.atan2(tz - c.z, tx - c.x);
    moveCat(g, c, d < 1.2 ? a : avoidCarriers(g, c, a), (TYPES[c.type].calm || 1.2) * 1.1, CAT.calmTurn, dt);
    return;
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
  // if I fits I sits: an empty box nearby
  if (g.boxes.length && c.type !== 'boss' && c.gang < 0 && g.rng.chance(BOX.sitChance)) {
    const bi = nearestBox(g, c, BOX.sitRange);
    if (bi >= 0) { setState(c, S.seek, 6); c.a = bi; c.b = 1; return; }
  }
  // a patch of sun to nap in
  if (g.suns.length && c.gang < 0 && g.mode !== 'ambient' && g.rng.chance(SUN.chance * (SUN.lazy[c.type] ?? 0.4))) {
    const si = nearestSun(g, c, SUN.range);
    if (si >= 0) { setState(c, S.seek, 8); c.a = si; c.b = 2; return; }
  }
  setState(c, S.walk, g.rng.range(1, 3));
  c.aim = wanderPick(g, c);
}

function nearestBox(g, c, range) {
  let best = -1;
  let bd = range;
  g.boxes.forEach((b, i) => {
    if (b.cat >= 0 || g.cats.some((o) => o.st === S.seek && o.b === 1 && o.a === i)) return;
    const d = Math.hypot(b.x - c.x, b.z - c.z);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

function nearestSun(g, c, range) {
  let best = -1;
  let bd = range;
  g.suns.forEach((p, i) => {
    // room for two in a patch
    if (g.cats.filter((o) => o !== c && (o.st === S.nap || o.st === S.seek) && o.b === 2 && o.a === i).length >= 2) return;
    const d = Math.hypot(p.x - c.x, p.z - c.z);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
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
  g.stats.crashes++;
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
  return !(OUT.has(c.st) || c.st === S.hidden || c.st === S.perch || c.st === S.hop || c.st === S.creep || c.st === S.ride || c.st === S.boxsit);
}

// ------------------------------------------------------------------ twists

/** The laser pointer: lies on the floor until someone walks over it, then throws a dot ahead of them for a while. */
function laserTick(g, dt) {
  const L = g.laser;
  if (!L) return;
  if (L.on === 2) {
    if (g.authority && g.started && !g.over) {
      L.t -= dt;
      if (L.t <= 0) { L.on = 0; L.x = L.hx; L.z = L.hz; emit(g, 'laser', { p: -1, ki: 0, x: L.x, z: L.z }); }
    }
    return;
  }
  if (L.on === 0) {
    if (!g.authority || g.over) return;
    for (const p of g.people) {
      if (!p.active || Math.hypot(p.x - L.hx, p.z - L.hz) > LASER.pick) continue;
      L.on = 1;
      L.holder = p.slot;
      L.t = LASER.time;
      emit(g, 'laser', { p: p.slot, ki: 1, x: L.hx, z: L.hz });
      break;
    }
    return;
  }
  const p = g.people[L.holder];
  L.t -= dt;
  if (!p || !p.active || (g.authority && (L.t <= 0 || g.over))) {
    L.on = 2;
    L.t = LASER.respawn;
    L.holder = -1;
    emit(g, 'laser', { p: -1, ki: 2, x: L.x, z: L.z });
    return;
  }
  const ux = Math.cos(p.h);
  const uz = Math.sin(p.h);
  const reach = freeAhead(g.world, p.x, p.z, ux, uz, LASER.reach);
  L.x = p.x + ux * Math.max(0.6, reach);
  L.z = p.z + uz * Math.max(0.6, reach);
}

/** A robot vacuum: straight lines, a turn off whatever it bumps (people too). Cats get out of its way, or ride it. */
function vacTick(g, v, i, dt) {
  const dx = Math.cos(v.h);
  const dz = Math.sin(v.h);
  const pos = { x: v.x + dx * VAC.speed * dt, z: v.z + dz * VAC.speed * dt };
  const n = resolve(g.world, pos, VAC.radius);
  let nx = n.nx;
  let nz = n.nz;
  const block = (ox, oz, min) => {
    const ex = pos.x - ox;
    const ez = pos.z - oz;
    const d = Math.hypot(ex, ez);
    if (d >= min || d < 1e-6) return;
    pos.x = ox + (ex / d) * min;
    pos.z = oz + (ez / d) * min;
    nx += ex / d;
    nz += ez / d;
  };
  for (const p of g.people) if (p.active) block(p.x, p.z, VAC.radius + PERSON.radius);
  for (const b of g.boxes) block(b.x, b.z, VAC.radius + BOX.radius);
  g.vacs.forEach((o, j) => { if (j !== i) block(o.x, o.z, VAC.radius * 2); });
  const nl = Math.hypot(nx, nz);
  if (nl > 1e-6 && (dx * nx + dz * nz) / nl < -0.1) {
    // away from what it hit, at one of three angles in turn
    v.turns++;
    v.h = Math.atan2(nz, nx) + ((v.turns % 3) - 1) * VAC.turn;
    emit(g, 'vbump', { c: i, x: pos.x, z: pos.z });
  }
  v.x = pos.x;
  v.z = pos.z;
  // it runs into a cat: a Loaf (or a sleepy one) climbs aboard, anyone else hops aside
  for (const c of g.cats) {
    if (!free(c) || c.id === v.rider) continue;
    const d = Math.hypot(c.x - v.x, c.z - v.z);
    const min = VAC.radius + CAT.radius * c.size;
    if (d >= min) continue;
    const sleepy = c.st === S.sleep || c.st === S.nap || c.st === S.idle;
    if (g.authority && v.rider < 0 && sleepy && c.type !== 'boss' && c.type !== 'kitten' && (c.type === 'loaf' || g.rng.chance(VAC.rideChance))) {
      v.rider = c.id;
      setState(c, S.ride, 999);
      c.a = i;
      emit(g, 'ride', { c: c.id });
      continue;
    }
    const pos2 = { x: v.x + ((c.x - v.x) / (d || 1)) * min, z: v.z + ((c.z - v.z) / (d || 1)) * min };
    resolve(g.world, pos2, CAT.radius * c.size);
    if (c.st !== S.sleep) { c.x = pos2.x; c.z = pos2.z; }
  }
}

/** The doorbell: a ding, then every cat in the room scatters from the front door. */
function bellTick(g) {
  const B = g.bell;
  if (!B || !g.started || g.over) return;
  if (!B.warned && g.elapsed >= B.next - BELL.warn) {
    B.warned = true;
    emit(g, 'ding', { x: B.x, z: B.z });
  }
  if (g.elapsed >= B.next) {
    B.warned = false;
    B.next += B.every;
    emit(g, 'bell', { x: B.x, z: B.z });
    for (const c of g.cats) scatter(g, c, B.x, B.z, BELL.radius, null);
  }
}

/** People shove boxes about; a cat sitting in one goes with it. Boxes keep cats out. */
function boxTick(g, dt) {
  for (const b of g.boxes) {
    const ox = b.x;
    const oz = b.z;
    for (const p of g.people) {
      if (!p.active) continue;
      const dx = b.x - p.x;
      const dz = b.z - p.z;
      const min = BOX.radius + PERSON.radius;
      const d = Math.hypot(dx, dz);
      if (d >= min || d < 1e-6) continue;
      const pos = { x: p.x + (dx / d) * min, z: p.z + (dz / d) * min };
      resolve(g.world, pos, BOX.radius);
      for (const o of g.boxes) {
        if (o === b) continue;
        const ex = pos.x - o.x;
        const ez = pos.z - o.z;
        const e = Math.hypot(ex, ez);
        if (e < BOX.radius * 2 && e > 1e-6) { pos.x = o.x + (ex / e) * BOX.radius * 2; pos.z = o.z + (ez / e) * BOX.radius * 2; }
      }
      b.x = pos.x;
      b.z = pos.z;
      // stuck against a wall: the box stops the person instead
      const gap = Math.hypot(b.x - p.x, b.z - p.z);
      if (gap < min - 0.01 && !p.external) {
        const pp = { x: b.x - (dx / d) * min, z: b.z - (dz / d) * min };
        resolve(g.world, pp, PERSON.radius);
        p.x = pp.x;
        p.z = pp.z;
      }
    }
    b.vx = (b.x - ox) / dt;
    b.vz = (b.z - oz) / dt;
    const sit = g.cats[b.cat];
    if (sit && sit.st === S.boxsit) { sit.x = b.x; sit.z = b.z; }
    for (const c of g.cats) {
      if (!free(c)) continue;
      const dx = c.x - b.x;
      const dz = c.z - b.z;
      const min = BOX.radius + CAT.radius * c.size;
      const d = Math.hypot(dx, dz);
      if (d >= min || d < 1e-6) continue;
      const pos = { x: b.x + (dx / d) * min, z: b.z + (dz / d) * min };
      resolve(g.world, pos, CAT.radius * c.size);
      c.x = pos.x;
      c.z = pos.z;
    }
  }
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
  g.result = { allIn, time: g.elapsed, boxed: g.boxed, counts: g.carriers.map((k) => k.count), stats: { ...g.stats } };
  emit(g, allIn ? 'allin' : 'timeup', {});
}

/** One fixed step: people, the room's twists, cats, carriers, the clock. */
export function step(g, dt = STEP) {
  g.time += dt;
  for (const p of g.people) movePerson(g, p, dt);
  laserTick(g, dt);
  g.vacs.forEach((v, i) => vacTick(g, v, i, dt));
  bellTick(g);
  for (const c of g.cats) {
    updateCat(g, c, dt);
    if (!Number.isFinite(c.x) || !Number.isFinite(c.z)) {
      c.x = g.world.w / 2;
      c.z = g.world.d / 2;
      c.sp = 0;
    }
    if (!Number.isFinite(c.h)) c.h = 0;
    else if (c.h > Math.PI || c.h < -Math.PI) c.h = angTo(0, c.h);
    if (c.st !== S.hop && c.st !== S.perch && c.st !== S.bump && c.st !== S.ride && c.st !== S.boxsit) c.y = 0;
  }
  separate(g);
  if (g.boxes.length) boxTick(g, dt);
  modeTick(g, dt);
}

export function loose(g) {
  return g.cats.filter((c) => c.st !== S.boxed && c.st !== S.enter && !c.surprise);
}

export const isOut = (c) => OUT.has(c.st);
export { scatter };
