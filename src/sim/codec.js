// The host's cat stream (`host:cats`): what every other page needs to draw and predict the round. Numbers are quantized
// to hundredths. Reading is strict: anything off-shape or out of range is dropped, never trusted.

import { STATE_COUNT, S } from './tuning.js';

const q = (v) => Math.round((Number.isFinite(v) ? v : 0) * 100);
const TAU = Math.PI * 2;
const qa = (a) => q(Number.isFinite(a) ? ((((a % TAU) + TAU + Math.PI) % TAU) - Math.PI) : 0);
const MAX_CATS = 64;
const MAX_PEOPLE = 30;
const MAX_EVENTS = 8;
const HOPS = new Set([S.hop, S.enter, S.bump, S.runhide]);

// event kinds on the wire
export const EVENTS = ['in', 'bump', 'crash', 'hide', 'emerge', 'zoom', 'slip', 'hop', 'surprise', 'treats', 'clap', 'swat', 'scared', 'wiggle',
  'knock', 'combo', 'trick', 'laser', 'ding', 'bell', 'ride', 'boxsit', 'nap'];
const MAX_VACS = 4;
const EV_INDEX = Object.fromEntries(EVENTS.map((k, i) => [k, i]));

/** The round's state, from the host's simulation. `bots`: the bot people (by seat order). */
export function encode(g, roundId, bots = []) {
  const c = [];
  for (const cat of g.cats) {
    c.push([q(cat.x), q(cat.z), qa(cat.h), cat.st, q(cat.tt), q(cat.sp), cat.a | 0, cat.b | 0, cat.lureBy | 0, cat.carrier | 0, q(cat.y), cat.surprise ? 1 : 0]);
  }
  const b = bots.map((p) => [q(p.x), q(p.z), qa(p.h), q(p.sp), p.treatsSeq | 0, p.clapSeq | 0]);
  const e = [];
  for (let i = g.events.length - 1; i >= 0 && e.length < MAX_EVENTS; i--) {
    const ev = g.events[i];
    const kind = EV_INDEX[ev.k];
    if (kind == null) continue;
    e.unshift([ev.seq, kind, ev.c ?? ev.p ?? -1, ev.ki ?? (ev.up ? 1 : 0), q(ev.x), q(ev.z)]);
  }
  return {
    r: String(roundId).slice(0, 64),
    t: Math.round(g.time * 1000),
    c,
    b,
    n: g.carriers.map((k) => k.count),
    x: g.carriers.map((k) => (k.closed ? 1 : 0)),
    e,
    o: g.over ? (g.result?.allIn ? 2 : 1) : 0,
    k: q(g.clock ?? 0),
    ...(g.laser ? { l: [g.laser.on, g.laser.holder | 0, q(g.laser.t), q(g.laser.x), q(g.laser.z)] } : {}),
    ...(g.vacs?.length ? { v: g.vacs.slice(0, MAX_VACS).map((v) => [q(v.x), q(v.z), qa(v.h), v.rider | 0]) } : {}),
  };
}

const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const arr = (v, max) => Array.isArray(v) && v.length <= max;

/** A snapshot read back from the room, checked; null when it doesn't fit. Coordinates come back in units. */
export function decode(raw, { cats, carriers, w, d }) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.r !== 'string' || raw.r.length > 64) return null;
  if (!int(raw.t, 0, 3_600_000)) return null;
  if (!arr(raw.c, MAX_CATS) || raw.c.length !== cats) return null;
  const lim = Math.max(w, d) * 100 + 400;
  const out = { r: raw.r, t: raw.t, cats: [], bots: [], counts: [], closed: [], events: [], over: 0, clock: 0 };
  for (const e of raw.c) {
    if (!arr(e, 12) || e.length < 10) return null;
    const [x, z, h, st, tt, sp, a, b, lb, k, y = 0, sur = 0] = e;
    if (!int(x, -400, lim) || !int(z, -400, lim) || !int(h, -2000, 2000) || !int(st, 0, STATE_COUNT - 1)) return null;
    if (!int(tt, -100000, 100000) || !int(sp, -2000, 2000) || !int(a, -1, 4096) || !int(b, -100, 4096)) return null;
    if (!int(lb, -1, MAX_PEOPLE) || !int(k, -1, 64) || !int(y, -500, 500) || !int(sur, 0, 1)) return null;
    out.cats.push({ x: x / 100, z: z / 100, h: h / 100, st, tt: tt / 100, sp: sp / 100, a, b, lureBy: lb, carrier: k, y: y / 100, surprise: sur === 1 });
  }
  if (!arr(raw.b, MAX_PEOPLE)) return null;
  for (const e of raw.b) {
    if (!arr(e, 6) || e.length !== 6) return null;
    const [x, z, h, sp, tr, cl] = e;
    if (!int(x, -400, lim) || !int(z, -400, lim) || !int(h, -2000, 2000) || !int(sp, 0, 2000) || !int(tr, 0, 1e7) || !int(cl, 0, 1e7)) return null;
    out.bots.push({ x: x / 100, z: z / 100, h: h / 100, sp: sp / 100, tr, cl });
  }
  if (!arr(raw.n, carriers) || raw.n.length !== carriers || !raw.n.every((v) => int(v, 0, MAX_CATS))) return null;
  out.counts = raw.n.slice();
  if (raw.x != null) {
    if (!arr(raw.x, carriers) || !raw.x.every((v) => v === 0 || v === 1)) return null;
    out.closed = raw.x.map((v) => v === 1);
  }
  if (!arr(raw.e, MAX_EVENTS)) return null;
  for (const e of raw.e) {
    if (!arr(e, 6) || e.length !== 6) return null;
    const [seq, kind, c, extra, x, z] = e;
    if (!int(seq, 1, 1e9) || !int(kind, 0, EVENTS.length - 1) || !int(c, -1, 4096) || !int(extra, -1, 64) || !int(x, -100000, 100000) || !int(z, -100000, 100000)) return null;
    out.events.push({ seq, k: EVENTS[kind], c, ki: extra, x: x / 100, z: z / 100 });
  }
  out.over = int(raw.o, 0, 2) ? raw.o : 0;
  out.clock = int(raw.k, -100000, 1000000) ? raw.k / 100 : 0;
  if (raw.l != null) {
    if (!arr(raw.l, 5) || raw.l.length !== 5) return null;
    const [on, holder, t, x, z] = raw.l;
    if (!int(on, 0, 2) || !int(holder, -1, MAX_PEOPLE) || !int(t, -10000, 100000) || !int(x, -400, lim) || !int(z, -400, lim)) return null;
    out.laser = { on, holder, t: t / 100, x: x / 100, z: z / 100 };
  }
  if (raw.v != null) {
    if (!arr(raw.v, MAX_VACS)) return null;
    out.vacs = [];
    for (const e of raw.v) {
      if (!arr(e, 4) || e.length !== 4) return null;
      const [x, z, h, rider] = e;
      if (!int(x, -400, lim) || !int(z, -400, lim) || !int(h, -2000, 2000) || !int(rider, -1, MAX_CATS)) return null;
      out.vacs.push({ x: x / 100, z: z / 100, h: h / 100, rider });
    }
  }
  return out;
}

/** Put a decoded snapshot's cats into a simulation (a predicting copy, or a new host taking over). */
export function applyCats(g, snap) {
  snap.cats.forEach((s, i) => {
    const c = g.cats[i];
    if (!c) return;
    c.x = s.x;
    c.z = s.z;
    c.h = s.h;
    c.tt = s.tt;
    c.sp = s.sp;
    c.vx = Math.cos(s.h) * s.sp;
    c.vz = Math.sin(s.h) * s.sp;
    c.a = s.a;
    c.b = s.b;
    c.lureBy = s.lureBy;
    c.carrier = s.carrier;
    c.y = s.y;
    c.surprise = s.surprise;
    c.entering = s.st === S.enter;
    // keep a hop this page already knows (it predicted it); a new one waits for the next snapshot
    if (c.st !== s.st || !HOPS.has(s.st)) c.hop = null;
    c.st = s.st;
  });
  if (snap.laser && g.laser) Object.assign(g.laser, snap.laser);
  if (snap.vacs) snap.vacs.forEach((v, i) => { if (g.vacs[i]) Object.assign(g.vacs[i], v); });
  snap.counts.forEach((n, i) => { if (g.carriers[i]) g.carriers[i].count = n; });
  snap.closed.forEach((v, i) => { if (g.carriers[i]) g.carriers[i].closed = v; });
  g.boxed = snap.counts.reduce((a, b) => a + b, 0);
}
