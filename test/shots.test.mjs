// The clap as a shot (straight runs, bounces, knocks, previews that tell the truth), the open door and its combos, and the
// room's twists: the laser pointer, the robot vacuum, the doorbell, cardboard boxes and patches of sun.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, addPerson, step, clap, treats } from '../src/sim/game.js';
import { clapPreview, pushPreview } from '../src/sim/motion.js';
import { S, STEP, CLAP, LASER } from '../src/sim/tuning.js';
import { makeRng } from '../src/sim/rng.js';
import { sunPatches, inSun } from '../src/sim/sun.js';
import { buildWorld } from '../src/sim/world.js';

// an empty 20 × 14 room, carrier on the west wall facing east
const ROOM = { id: 'test', w: 20, d: 14, items: [], carriers: [{ x: 0.65, z: 7, dir: 'e' }], entry: { x: 10, z: 13 }, floor: 'grass', wall: 'brick' };

function setup(cats, opts = {}) {
  const g = createGame({ room: opts.room ?? ROOM, mode: 'level', cats, seed: opts.seed ?? 1, clock: 600, twists: opts.twists });
  g.started = true;
  for (const c of g.cats) if (c.st === S.idle || c.st === S.walk) { c.st = S.idle; c.tt = opts.idle ?? 30; }
  return g;
}
const run = (g, seconds, each) => {
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    each?.(i * STEP);
    step(g);
  }
};

test('a clap shoots a cat dead straight away from you, and it comes off a wall at the angle it went in', () => {
  const g = setup([{ type: 'moggy', x: 10, z: 7 }]);
  const c = g.cats[0];
  const p = addPerson(g, { x: 8, z: 9 });
  assert.ok(clap(g, p));
  p.active = false;
  const a0 = Math.atan2(c.z - 9, c.x - 8);
  const pts = [];
  run(g, 0.3, () => pts.push({ x: c.x, z: c.z }));
  for (const q of pts.slice(2)) {
    const a = Math.atan2(q.z - 9, q.x - 8);
    assert.ok(Math.abs(a - a0) < 0.02, `off line by ${(a - a0).toFixed(3)}`);
  }
  // toward the north wall at 45°: it leaves at 45° the other way
  const g2 = setup([{ type: 'moggy', x: 10, z: 2.5 }]);
  const c2 = g2.cats[0];
  const p2 = addPerson(g2, { x: 8.5, z: 4 });
  clap(g2, p2);
  p2.active = false;
  run(g2, 0.6);
  assert.ok(c2.bounces >= 1, 'bounced');
  const out = Math.atan2(c2.vz, c2.vx);
  assert.ok(Math.abs(out - Math.PI / 4) < 0.12, `out at ${out.toFixed(2)}`);
});

test('the clap preview tells the truth: gold paths go in, the others do not', () => {
  const rng = makeRng(7);
  let golds = 0;
  let agree = 0;
  let trials = 0;
  for (let i = 0; i < 160; i++) {
    const x = 1.6 + rng.next() * 7;
    const z = 2 + rng.next() * 10;
    const g = setup([{ type: 'moggy', x, z }]);
    const c = g.cats[0];
    const a = rng.range(-Math.PI, Math.PI);
    const r = 1 + rng.next() * 2.6;
    const p = addPerson(g, { x: x + Math.cos(a) * r, z: z + Math.sin(a) * r });
    if (Math.hypot(p.x - c.x, p.z - c.z) > CLAP.radius - 0.05) continue;
    const prev = clapPreview(g, p.x, p.z).find((e) => e.c === c);
    if (!prev) continue;
    trials++;
    const gold = prev.path.end === 'in';
    if (gold) golds++;
    clap(g, p);
    p.active = false;
    run(g, 2.2);
    const went = c.st === S.boxed || c.st === S.enter;
    if (went === gold) agree++;
  }
  assert.ok(trials > 100 && golds >= 8, `${trials} trials, ${golds} gold`);
  assert.equal(agree, trials, `${agree}/${trials} previews right`);
  // bunches of three: shots, knocks and chains, all run together
  let right = 0;
  let total = 0;
  let chained = 0;
  for (let i = 0; i < 120; i++) {
    const cx = 2.4 + rng.next() * 4;
    const cz = 4 + rng.next() * 6;
    const cats = [0, 1, 2].map(() => ({ type: 'moggy', x: cx + rng.range(-1.4, 1.4), z: cz + rng.range(-1.4, 1.4) }));
    const g = setup(cats, { seed: i + 1 });
    const a = rng.range(-Math.PI, Math.PI);
    const p = addPerson(g, { x: cx + Math.cos(a) * 2.6, z: cz + Math.sin(a) * 2.6 });
    const prev = clapPreview(g, p.x, p.z);
    clap(g, p);
    p.active = false;
    run(g, 2.6);
    for (const e of prev) {
      if (e.kind !== 'shot') continue;
      total++;
      if (e.path.chain > 0) chained++;
      const went = e.c.st === S.boxed || e.c.st === S.enter;
      if (went === (e.path.end === 'in')) right++;
    }
  }
  assert.ok(chained >= 5, `${chained} knocked along`);
  assert.ok(right / total >= 0.95, `${right}/${total} right with company`);
});

test('a bank shot: off the wall and into the carrier, called a bank', () => {
  // a carrier near the north-west corner: shots off the north wall can come down into its door
  const room = { ...ROOM, carriers: [{ x: 0.65, z: 3, dir: 'e' }] };
  let found = null;
  for (let cz = 1.2; cz < 3 && !found; cz += 0.2) {
    for (let cx = 3; cx < 6 && !found; cx += 0.25) {
      for (let i = 0; i < 24 && !found; i++) {
        const a = (i / 24) * Math.PI * 2;
        const g = setup([{ type: 'moggy', x: cx, z: cz }], { room });
        const p = addPerson(g, { x: cx + Math.cos(a) * 2, z: cz + Math.sin(a) * 2 });
        const e = clapPreview(g, p.x, p.z)[0];
        if (e && e.path.end === 'in' && e.path.bounces === 1) found = { cx, cz, x: p.x, z: p.z };
      }
    }
  }
  assert.ok(found, 'a bank shot exists');
  const g = setup([{ type: 'moggy', x: found.cx, z: found.cz }], { room });
  const p = addPerson(g, { x: found.x, z: found.z });
  clap(g, p);
  p.active = false;
  run(g, 2.5);
  assert.equal(g.cats[0].st, S.boxed);
  assert.equal(g.cats[0].how, 'bank');
  assert.equal(g.stats.banks, 1);
  assert.ok(g.events.some((e) => e.k === 'trick'));
});

test('a shot cat knocks a sitting cat on along the line between them; head on, it stops dead', () => {
  const g = setup([{ type: 'moggy', x: 10, z: 7 }, { type: 'moggy', x: 8, z: 7 }]);
  const [a, b] = g.cats;
  const p = addPerson(g, { x: 12.2, z: 7 });
  const prev = clapPreview(g, p.x, p.z);
  assert.equal(prev.length, 2, 'the preview shows the knock');
  assert.equal(prev.find((e) => e.c === b).path.end, 'in', 'and where the knocked cat goes');
  assert.equal(prev.find((e) => e.c === a).path.end, 'knock');
  clap(g, p);
  p.active = false;
  run(g, 0.5);
  assert.ok(b.chain === 1 && (b.st === S.bolt || b.st === S.trot), `struck: ${b.st}`);
  assert.ok(b.x < 7.2, `struck one ran on: ${b.x.toFixed(2)}`);
  assert.ok(a.x > b.x + 0.4 && a.sp < 3, `striker stopped: ${a.x.toFixed(2)} at ${a.sp.toFixed(2)}`);
  assert.equal(g.stats.knocks, 1);
  assert.ok(g.events.some((e) => e.k === 'knock' && e.c === b.id && e.o === a.id));
  // the struck one goes in: a chain
  run(g, 2);
  assert.equal(b.st, S.boxed);
  assert.equal(b.how, 'chain');
});

test('the door stays open: cats one after another all go in and make a combo', () => {
  // three cats bunched in front of the door, one clap from behind: a Triple
  const g = setup([{ type: 'moggy', x: 3.2, z: 7 }, { type: 'moggy', x: 3.7, z: 7.45 }, { type: 'moggy', x: 3.7, z: 6.55 }]);
  const p = addPerson(g, { x: 6.6, z: 7 });
  const prev = clapPreview(g, p.x, p.z);
  assert.ok(prev.every((e) => e.path.end === 'in'), 'all three gold');
  clap(g, p);
  p.active = false;
  run(g, 2);
  assert.ok(g.cats.every((c) => c.st === S.boxed), g.cats.map((c) => c.st).join(','));
  assert.ok(!g.events.some((e) => e.k === 'bump'), 'nobody bounced off the door');
  assert.equal(g.stats.bestCombo, 3);
  assert.ok(g.events.some((e) => e.k === 'combo' && e.c === 3));
  // in again more than COMBO.window later: the chain starts over
  const g2 = setup([{ type: 'moggy', x: 3.2, z: 7 }, { type: 'moggy', x: 12, z: 7 }]);
  const a = addPerson(g2, { x: 5.2, z: 7 });
  clap(g2, a);
  a.active = false;
  run(g2, 3);
  const b = addPerson(g2, { x: 13.5, z: 7 });
  g2.cats[1].x = 3.2;
  g2.cats[1].z = 7;
  b.x = 5.2;
  b.z = 7;
  clap(g2, b);
  b.active = false;
  run(g2, 2);
  assert.equal(g2.boxed, 2);
  assert.equal(g2.stats.bestCombo, 1);
});

test('push preview: the arrow points where the cat will run, gold when it is lined up with the door', () => {
  const g = setup([{ type: 'moggy', x: 4, z: 7 }]);
  const c = g.cats[0];
  const p = addPerson(g, { x: 6, z: 7 });
  const pv = pushPreview(g, c, p);
  assert.ok(pv && pv.gold, 'lined up');
  assert.ok(Math.abs(Math.abs(pv.a) - Math.PI) < 0.05);
  const p2 = addPerson(g, { x: 4, z: 9 });
  p.active = false;
  const pv2 = pushPreview(g, c, p2);
  assert.ok(pv2 && !pv2.gold, 'not lined up');
  const far = addPerson(g, { x: 15, z: 7 });
  p2.active = false;
  assert.equal(pushPreview(g, c, far), null, 'out of reach');
});

test('the laser pointer: pick it up, cats chase the dot, point it at the door and they go in', () => {
  const g = setup([{ type: 'moggy', x: 6, z: 3 }, { type: 'kitten', x: 7, z: 11 }, { type: 'boss', x: 9, z: 9 }, { type: 'loaf', x: 12, z: 4 }], {
    twists: { laser: { x: 9, z: 7 } },
  });
  const p = addPerson(g, { x: 11, z: 7 });
  run(g, 1, () => { p.ix = -1; p.iz = 0; });
  assert.equal(g.laser.on, 1);
  assert.equal(g.laser.holder, p.slot);
  assert.ok(g.events.some((e) => e.k === 'laser' && e.ki === 1));
  // walk to a spot in front of the door, facing it
  run(g, 3, () => {
    const tx = 0.65 + 0.55 + LASER.reach + 0.5;
    const d = tx - p.x;
    p.ix = Math.abs(d) > 0.2 ? Math.sign(d) * 0.8 : -0.1;
    p.iz = (7 - p.z) * 0.8;
  });
  assert.ok(g.cats[0].st === S.chase || g.cats[0].st === S.boxed || g.cats[0].st === S.enter, `moggy ${g.cats[0].st}`);
  assert.notEqual(g.cats[2].st, S.chase, 'the Boss is above it');
  assert.notEqual(g.cats[3].st, S.chase, 'a Loaf sleeps through it');
  run(g, 3, () => { p.ix = 0; p.iz = 0; });
  assert.equal(g.cats[0].st, S.boxed);
  assert.equal(g.cats[0].how, 'laser');
  run(g, LASER.time);
  assert.equal(g.laser.on, 2, 'it runs out');
});

test('the robot vacuum: cats keep clear, a Loaf rides it, and it delivers', () => {
  // headed for the door, a Loaf in its way
  const g = setup([{ type: 'loaf', x: 6, z: 7 }, { type: 'moggy', x: 12, z: 3 }], { twists: { vacs: [{ x: 9, z: 7, h: Math.PI }] } });
  const loaf = g.cats[0];
  run(g, 3);
  assert.ok(loaf.st === S.ride || loaf.st === S.boxed || loaf.st === S.enter, `loaf ${loaf.st}`);
  run(g, 5);
  assert.equal(loaf.st, S.boxed);
  assert.equal(loaf.how, 'ride');
  assert.equal(g.stats.rides, 1);
  // it turns off a person in its way
  const g2 = setup([], { twists: { vacs: [{ x: 6, z: 7, h: 0 }] } });
  addPerson(g2, { x: 8, z: 7 });
  run(g2, 2);
  assert.ok(g2.vacs[0].x < 7.3, `stopped by the person: ${g2.vacs[0].x.toFixed(2)}`);
  assert.ok(Math.abs(Math.cos(g2.vacs[0].h) - 1) > 0.1, 'turned');
});

test('the doorbell dings, then every cat scatters from the front door', () => {
  const g = setup([{ type: 'moggy', x: 10, z: 9 }, { type: 'moggy', x: 4, z: 10 }], { twists: { bell: { every: 20, first: 3 } } });
  run(g, 1.5);
  assert.ok(g.events.some((e) => e.k === 'ding'));
  assert.ok(!g.events.some((e) => e.k === 'bell'));
  const before = g.cats.map((c) => Math.hypot(c.x - 10, c.z - 13));
  run(g, 2);
  assert.ok(g.events.some((e) => e.k === 'bell'));
  g.cats.forEach((c, i) => assert.ok(Math.hypot(c.x - 10, c.z - 13) > before[i] + 1, `cat ${i} ran from the door`));
});

test('if I fits I sits: a cat in a box stays put until you push the box onto the doormat', () => {
  const g = setup([{ type: 'moggy', x: 6, z: 7 }], { twists: { boxes: [{ x: 7.5, z: 7 }] }, idle: 0.1 });
  const c = g.cats[0];
  let sat = false;
  for (let i = 0; i < 40 && !sat; i++) {
    run(g, 1);
    sat = c.st === S.boxsit;
    if (!sat && c.st === S.idle && c.tt > 0.5) c.tt = 0.05;
  }
  assert.ok(sat, `in the box: ${c.st}`);
  // a walk at it does nothing
  const p = addPerson(g, { x: g.boxes[0].x + 2.5, z: g.boxes[0].z });
  run(g, 0.3, () => { p.ix = -0.3; });
  assert.equal(c.st, S.boxsit);
  // shove the box west along the door's line
  run(g, 6, () => {
    const b = g.boxes[0];
    const tz = 7;
    p.ix = -0.8;
    p.iz = (tz - b.z) * 2 + (b.z - p.z) * 1.5;
  });
  assert.equal(c.st, S.boxed, `state ${c.st}`);
  assert.equal(c.how, 'box');
});

test('a clap shoots a cat out of its box like a cannon', () => {
  const g = setup([{ type: 'moggy', x: 6, z: 7 }], { twists: { boxes: [{ x: 4, z: 7 }] } });
  const c = g.cats[0];
  const b = g.boxes[0];
  c.st = S.boxsit;
  c.a = 0;
  b.cat = 0;
  c.x = b.x;
  c.z = b.z;
  const p = addPerson(g, { x: 6.5, z: 7 });
  const prev = clapPreview(g, p.x, p.z)[0];
  assert.equal(prev.path.end, 'in');
  clap(g, p);
  p.active = false;
  run(g, 1.5);
  assert.equal(c.st, S.boxed);
  assert.equal(b.cat, -1);
});

test('patches of sun: they fall where the windows throw them, lazy cats nap there and ignore a push', () => {
  const room = { ...ROOM, floor: 'oak', wall: 'sage' };
  const world = buildWorld(room);
  const suns = sunPatches(room, world);
  assert.ok(suns.length >= 4, `${suns.length} patches`);
  for (const p of suns) assert.ok(inSun(p, p.x, p.z), 'a patch holds its own middle');
  const sp = suns[0];
  const g = setup([{ type: 'glutton', x: sp.x + 2, z: sp.z + 2 }], { room, idle: 0.1, seed: 3 });
  const c = g.cats[0];
  let napped = false;
  for (let i = 0; i < 60 && !napped; i++) {
    run(g, 1);
    napped = c.st === S.nap;
    if (c.st === S.idle && c.tt > 0.5) c.tt = 0.05;
  }
  assert.ok(napped, `napping: ${c.st}`);
  assert.ok(g.suns.some((p) => inSun(p, c.x, c.z)), 'in the sun');
  const p = addPerson(g, { x: c.x + 1.5, z: c.z });
  run(g, 1, () => { p.ix = -0.2; });
  assert.equal(c.st, S.nap, 'a push does nothing');
  p.treatsCd = 0;
  treats(g, p);
  assert.equal(c.st, S.lured, 'treats wake it');
});
