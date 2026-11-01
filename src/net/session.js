// One multiplayer round on one page: the simulation with every seat's person, run by the host (authority) or predicted by
// everyone else from the host's snapshots. Pure: the SDK wiring lives in net.js, so node tests drive this with fake rooms.

import { createGame, addPerson, step, treats, clap, placePerson } from '../sim/game.js';
import { createBrain, think } from '../sim/brain.js';
import { roundSetup } from '../sim/levels.js';
import { encode, decode, applyCats } from '../sim/codec.js';
import { STEP, ROUND, PERSON } from '../sim/tuning.js';

const STYLES = ['shepherd', 'clapper', 'poacher'];
const MAX_RESIM = 8;

/** match.data for a round, checked. */
export function readRoundData(d) {
  if (!d || typeof d !== 'object') return null;
  if (d.v !== 1 || !Number.isInteger(d.seed) || !Number.isInteger(d.round) || d.round < 1 || d.round > 50) return null;
  if (d.mode !== 'versus' && d.mode !== 'together') return null;
  if (!Array.isArray(d.seats) || d.seats.length < 1 || d.seats.length > 6) return null;
  if (!d.seats.every((s) => typeof s === 'string' && s.length > 0 && s.length <= 64)) return null;
  if (new Set(d.seats).size !== d.seats.length) return null;
  if (!Array.isArray(d.skills) || d.skills.length !== d.seats.length || !d.skills.every((v) => typeof v === 'number' && v >= 0 && v <= 1)) return null;
  return { v: 1, seed: d.seed, round: d.round, mode: d.mode, seats: d.seats.slice(), skills: d.skills.slice() };
}

/** What the host writes as match.data when a round begins. */
export function makeRoundData({ seed, round, mode, seats, skills }) {
  return { v: 1, seed: seed | 0, round, mode, seats: seats.slice(0, 6), skills: seats.slice(0, 6).map((_, i) => Math.max(0, Math.min(1, skills?.[i] ?? 0.5))) };
}

/**
 * opts: { data (round data), me: my seat id or null (watching), host: boolean, bots: Set of bot seat ids, roundId }
 */
export function createSession(opts) {
  const data = opts.data;
  const together = data.mode === 'together';
  const setup = roundSetup({ seed: data.seed, round: data.round, seats: data.seats.length, together });
  const owners = together ? [null] : setup.room.carriers.map((_, i) => data.seats[i] ?? null);
  const g = createGame({
    room: setup.room, mode: data.mode, cats: setup.cats, seed: data.seed * 7919 + data.round,
    clock: together ? ROUND.together : ROUND.versus, authority: !!opts.host, owners, twists: setup.twists,
  });
  if (together) g.claims = new Map();
  g.started = true;
  const s = {
    data, setup, g, me: opts.me ?? null, host: !!opts.host, roundId: opts.roundId ?? `${data.seed}:${data.round}`,
    bots: new Set(opts.bots ?? []), people: new Map(), brains: new Map(), seen: new Map(), lastSnap: null, lastEv: 0,
    acc: 0, history: [], offsets: g.cats.map(() => ({ x: 0, z: 0 })), left: new Set(),
  };
  data.seats.forEach((id, i) => {
    const k = g.carriers[together ? 0 : i] ?? g.carriers[0];
    const spread = together ? (i - (data.seats.length - 1) / 2) * 1.1 : 0;
    const p = addPerson(g, {
      id, seat: id, carrier: k.index,
      x: k.matX + k.nx * 2.6 - k.nz * spread, z: k.matZ + k.nz * 2.6 + k.nx * spread,
      h: Math.atan2(k.nz, k.nx),
    });
    p.external = !isLocal(s, id);
    s.people.set(id, p);
    if (s.host && s.bots.has(id)) s.brains.set(id, createBrain({ skill: data.skills[i], style: STYLES[i % 3], seed: data.seed + i * 101 }));
  });
  return s;
}

function isLocal(s, id) {
  return id === s.me || (s.host && s.bots.has(id));
}

/** This page became the host (the last one left or reloaded): take over from the last snapshot. */
export function becomeHost(s) {
  if (s.host) return;
  s.host = true;
  s.g.authority = true;
  s.data.seats.forEach((id, i) => {
    const p = s.people.get(id);
    if (!p) return;
    p.external = !isLocal(s, id);
    if (s.bots.has(id) && !s.brains.has(id)) s.brains.set(id, createBrain({ skill: s.data.skills[i], style: STYLES[i % 3], seed: s.data.seed + i * 101 + 7 }));
  });
}

/** Another page took over as host: this one predicts again. */
export function becomeClient(s) {
  if (!s.host) return;
  s.host = false;
  s.g.authority = false;
  for (const [id, p] of s.people) p.external = id !== s.me;
}

/** A seat's player is gone for good: their person goes, and in Versus their carrier shuts. */
export function seatLeft(s, id) {
  const p = s.people.get(id);
  if (!p || s.left.has(id)) return;
  s.left.add(id);
  p.active = false;
  if (s.data.mode === 'versus') {
    const k = s.g.carriers[p.carrier];
    if (k && k.owner === id) k.closed = true;
  }
}

/** Presence, checked: { x, z, h, tr, cl } or null. */
export function readPresence(raw, w, d) {
  if (!raw || typeof raw !== 'object') return null;
  const { x, z, h, tr, cl } = raw;
  if (![x, z].every(Number.isFinite) || x < -1 || z < -1 || x > w + 1 || z > d + 1) return null;
  return {
    x, z, h: Number.isFinite(h) ? h : 0,
    tr: Number.isInteger(tr) && tr >= 0 ? tr : 0,
    cl: Number.isInteger(cl) && cl >= 0 ? cl : 0,
  };
}

/**
 * Move a remote person to where their page says, at most as fast as a person walks (with slack). A treats or clap counter
 * that went up is a press: on the host it applies (cooldowns are the host's), elsewhere it is only shown.
 */
export function feedPresence(s, id, pres, dt, fx) {
  const p = s.people.get(id);
  if (!p || !pres || !p.external || !p.active) return;
  const max = PERSON.speed * 1.5 * Math.max(dt, STEP) + 0.05;
  const dx = pres.x - p.x;
  const dz = pres.z - p.z;
  const d = Math.hypot(dx, dz);
  if (d > 3) placePerson(s.g, p, pres.x, pres.z, 0); // a jump: a reload or a lost packet, no push from it
  else if (d > max) placePerson(s.g, p, p.x + (dx / d) * max, p.z + (dz / d) * max, dt);
  else placePerson(s.g, p, pres.x, pres.z, dt);
  const seen = s.seen.get(id) ?? { tr: pres.tr, cl: pres.cl };
  if (pres.tr > seen.tr) {
    if (s.host) treats(s.g, p);
    else fx?.('treats', p);
  }
  if (pres.cl > seen.cl) {
    if (s.host) clap(s.g, p);
    else fx?.('clap', p);
  }
  s.seen.set(id, { tr: pres.tr, cl: pres.cl });
}

/** The host: bots decide, then one fixed step. */
export function hostStep(s) {
  const g = s.g;
  for (const [id, b] of s.brains) {
    const p = s.people.get(id);
    if (!p || !p.active) continue;
    const act = think(g, p, b, STEP);
    if (act.treats) treats(g, p);
    if (act.clap) clap(g, p);
  }
  step(g, STEP);
}

/** The host's snapshot for the room. */
export function snapshot(s) {
  const bots = s.data.seats.filter((id) => s.bots.has(id)).map((id) => s.people.get(id));
  return encode(s.g, s.roundId, bots);
}

/** Everyone but the host: my own person's recent positions, for re-simulating after a snapshot. */
export function recordMe(s) {
  const p = s.people.get(s.me);
  if (!p) return;
  s.history.push({ t: s.g.time, x: p.x, z: p.z });
  if (s.history.length > 40) s.history.shift();
}

function meAt(s, t) {
  const h = s.history;
  if (!h.length) return null;
  for (let i = h.length - 1; i >= 0; i--) if (h[i].t <= t + 1e-6) return h[i];
  return h[0];
}

/**
 * A snapshot arrived (raw from the room). Cats reset to the host's state at its time, then re-simulated forward to `now`
 * (seconds of round time on this page). What this page drew before is kept as an offset that eases away, so nothing snaps.
 * Returns the decoded snapshot (new events to play) or null.
 */
export function applySnapshot(s, raw, now) {
  const g = s.g;
  const snap = decode(raw, { cats: g.cats.length, carriers: g.carriers.length, w: g.world.w, d: g.world.d });
  if (!snap || snap.r !== s.roundId) return null;
  if (s.lastSnap && snap.t < s.lastSnap.t) return null;
  s.lastSnap = snap;
  // what's on screen now
  const drawn = g.cats.map((c, i) => ({ x: c.x + s.offsets[i].x, z: c.z + s.offsets[i].z, st: c.st }));
  applyCats(g, snap);
  g.clock = snap.clock;
  // bots' people
  const botIds = s.data.seats.filter((id) => s.bots.has(id));
  snap.bots.forEach((b, i) => {
    const p = s.people.get(botIds[i]);
    if (!p || !p.external) return;
    placePerson(g, p, b.x, b.z, 0);
    p.h = b.h;
    p.sp = b.sp;
  });
  if (snap.over) { g.over = true; g.result = { allIn: snap.over === 2, time: g.elapsed, boxed: g.boxed, counts: snap.counts.slice() }; }
  // forward to now, with my own person where it was
  const me = s.people.get(s.me);
  const live = me ? { x: me.x, z: me.z, vx: me.vx, vz: me.vz, ext: me.external } : null;
  const target = Math.max(now, snap.t / 1000);
  let t = snap.t / 1000;
  g.time = t;
  let n = 0;
  if (!g.over) {
    while (t + STEP <= target + 1e-6 && n < MAX_RESIM) {
      if (me) {
        const at = meAt(s, t);
        me.external = true;
        if (at) placePerson(g, me, at.x, at.z, STEP);
      }
      step(g, STEP);
      t += STEP;
      n++;
    }
  }
  g.time = Math.max(g.time, now);
  if (me && live) {
    me.x = live.x;
    me.z = live.z;
    me.vx = live.vx;
    me.vz = live.vz;
    me.external = live.ext;
  }
  g.cats.forEach((c, i) => {
    const o = s.offsets[i];
    const was = drawn[i];
    o.x = was.x - c.x;
    o.z = was.z - c.z;
    // a teleport or a cat that just went in: no easing across it
    if (Math.hypot(o.x, o.z) > 2 || (c.st !== was.st && (c.st === 12 || c.st === 11 || c.st === 17))) { o.x = 0; o.z = 0; }
  });
  const fresh = snap.events.filter((e) => e.seq > s.lastEv);
  if (snap.events.length) s.lastEv = Math.max(s.lastEv, ...snap.events.map((e) => e.seq));
  return { snap, fresh };
}

/** Ease the drawn cats onto the simulated ones (about 150 ms). */
export function easeOffsets(s, dt) {
  const k = Math.exp(-20 * dt);
  for (const o of s.offsets) {
    o.x *= k;
    o.z *= k;
    if (Math.abs(o.x) < 1e-3) o.x = 0;
    if (Math.abs(o.z) < 1e-3) o.z = 0;
  }
}

/**
 * Advance the round on this page by real time `dt`: the host to the match clock, a predicting page on its own. `before` runs
 * ahead of each step (the renderer keeps the last positions to draw between steps).
 */
export function advance(s, dt, matchSeconds, before = null) {
  const g = s.g;
  if (g.over) return 0;
  let steps = 0;
  if (s.host) {
    // the match clock is the truth: catch up (a background tab) a couple of seconds at most at a time
    const goal = matchSeconds ?? g.time + dt;
    while (g.time + STEP <= goal + 1e-6 && steps < 60 && !g.over) {
      before?.();
      hostStep(s);
      steps++;
    }
  } else {
    s.acc += Math.min(dt, 0.25);
    while (s.acc >= STEP && steps < 8) {
      before?.();
      step(g, STEP);
      recordMe(s);
      s.acc -= STEP;
      steps++;
    }
  }
  return steps;
}

/** How far between the last step and the next this page is drawing (0-1). */
export function stepAlpha(s, matchSeconds) {
  if (s.host) return Math.max(0, Math.min(1, ((matchSeconds ?? s.g.time) - s.g.time) / STEP));
  return Math.max(0, Math.min(1, s.acc / STEP));
}

/** The round's score: cats in each seat's carrier (Versus), or credits per seat (Together). */
export function roundScore(s) {
  const out = {};
  if (s.data.mode === 'versus') {
    s.data.seats.forEach((id) => {
      const p = s.people.get(id);
      out[id] = s.g.carriers[p?.carrier]?.count ?? 0;
    });
  } else {
    s.data.seats.forEach((id) => { out[id] = 0; });
    for (const c of s.g.cats) {
      if (c.st !== 12 && c.st !== 11) continue;
      if (c.by && out[c.by] != null) out[c.by]++;
    }
  }
  return out;
}

export { decode };
