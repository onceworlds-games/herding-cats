// How cats answer a person: the tell, the push, the door, treats, claps and each personality.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, addCat, addPerson, step, treats, clap, placePerson } from '../src/sim/game.js';
import { S, TYPES, STEP, CATLADY } from '../src/sim/tuning.js';
import { catladySetup } from '../src/sim/levels.js';

// an empty 20 × 14 room, carrier on the west wall facing east
const ROOM = { id: 'test', w: 20, d: 14, items: [], carriers: [{ x: 0.65, z: 7, dir: 'e' }], entry: { x: 10, z: 7 } };

function setup(cats, opts = {}) {
  const g = createGame({ room: opts.room ?? ROOM, mode: opts.mode ?? 'level', cats, seed: opts.seed ?? 1, clock: 600, owners: opts.owners });
  g.started = true;
  return g;
}

const run = (g, seconds, each) => {
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    each?.(i * STEP);
    step(g);
  }
};

test('a cat stops and glances for 150-250 ms before it walks away from you', () => {
  for (const type of ['moggy', 'zoomer', 'scaredy', 'glutton', 'kitten', 'boss']) {
    const g = setup([{ type, x: 10, z: 7, h: 0 }]);
    const c = g.cats[0];
    c.st = S.idle;
    c.tt = 10;
    const p = addPerson(g, { x: 10 + TYPES[type].flee + 1.5, z: 7 });
    let alertAt = null;
    let fleeAt = null;
    run(g, 2, (t) => {
      p.ix = -1;
      p.iz = 0;
      if (alertAt == null && c.st === S.alert) alertAt = t;
      if (alertAt != null && fleeAt == null && c.st === S.flee) fleeAt = t;
    });
    assert.ok(alertAt != null && fleeAt != null, `${type} alerted and fled`);
    const tell = fleeAt - alertAt;
    assert.ok(tell >= 0.14 && tell <= 0.27, `${type} tell ${tell.toFixed(3)} s`);
  }
});

test('pushing is readable: a cat walks straight away from the person behind it', () => {
  for (let seed = 1; seed <= 6; seed++) {
    const g = setup([{ type: 'moggy', x: 10, z: 7, h: Math.PI }], { seed });
    const c = g.cats[0];
    c.st = S.idle;
    c.tt = 10;
    const p = addPerson(g, { x: 12, z: 7 });
    run(g, 1.2, () => { p.ix = -0.5; p.iz = 0; });
    assert.ok(c.st === S.flee || c.st === S.settle, `seed ${seed}: ${c.st}`);
    // moving west, within ~25° of straight away
    const a = Math.atan2(c.vz, c.vx);
    assert.ok(Math.abs(Math.abs(a) - Math.PI) < 0.45, `seed ${seed}: heading ${a.toFixed(2)}`);
    assert.ok(c.x < 9.4, `seed ${seed}: moved to ${c.x.toFixed(2)}`);
  }
});

test('walked straight into the carrier, a cat goes in; walked past the door, it does not', () => {
  const g = setup([{ type: 'moggy', x: 4.5, z: 7, h: Math.PI }]);
  const c = g.cats[0];
  c.st = S.idle;
  c.tt = 10;
  const p = addPerson(g, { x: 6.8, z: 7 });
  run(g, 4, () => { p.ix = -0.6; p.iz = 0; });
  assert.equal(c.st, S.boxed);
  assert.equal(g.carriers[0].count, 1);
  assert.ok(g.events.some((e) => e.k === 'in' && e.c === c.id));

  // across the mat, sideways: no
  const g2 = setup([{ type: 'moggy', x: 1.9, z: 4.6, h: Math.PI / 2 }]);
  const c2 = g2.cats[0];
  c2.st = S.idle;
  c2.tt = 10;
  const p2 = addPerson(g2, { x: 1.9, z: 2.2 });
  run(g2, 2.5, () => { p2.ix = 0; p2.iz = 0.6; });
  assert.notEqual(c2.st, S.boxed);
  assert.notEqual(c2.st, S.enter);
});

test('treats bring a cat to you; on the far side of the door, it walks in', () => {
  const g = setup([{ type: 'moggy', x: 4.8, z: 7, h: 0 }]);
  const c = g.cats[0];
  c.st = S.idle;
  c.tt = 10;
  const p = addPerson(g, { x: 0.75, z: 7 - 0.8 });
  // a person stands just past the door's edge
  p.x = 0.75;
  p.z = 6.2;
  assert.ok(treats(g, p));
  assert.equal(c.st, S.lured);
  run(g, 3);
  assert.ok(c.st === S.boxed || c.st === S.enter, `state ${c.st}`);
  assert.equal(treats(g, p), false, 'treats have a cooldown');
});

test('a clap makes a Loaf scoot; walking at it does nothing', () => {
  const g = setup([{ type: 'loaf', x: 10, z: 7 }]);
  const c = g.cats[0];
  const p = addPerson(g, { x: 11.2, z: 7 });
  run(g, 1.5, () => { p.ix = -0.3; });
  assert.equal(c.st, S.sleep);
  const x0 = c.x;
  p.ix = 0;
  assert.ok(clap(g, p));
  run(g, 1);
  assert.ok(c.x < x0 - 1.5, `scooted ${(x0 - c.x).toFixed(2)}`);
});

test('a clap sends a Scaredy under the nearest furniture, treats coax it out', () => {
  const room = { ...ROOM, items: [{ k: 'sofa', x: 10, z: 3 }] };
  const g = setup([{ type: 'scaredy', x: 10, z: 6 }], { room });
  const c = g.cats[0];
  const p = addPerson(g, { x: 15, z: 8 });
  clap(g, p);
  run(g, 3);
  assert.equal(c.st, S.hidden);
  p.x = 10;
  p.z = 6.5;
  p.treatsCd = 0;
  treats(g, p);
  assert.equal(c.st, S.creep);
  run(g, 2);
  assert.ok(![S.hidden, S.creep].includes(c.st), `out: ${c.st}`);
});

test('a Glutton smells treats from across the room', () => {
  const g = setup([{ type: 'glutton', x: 18, z: 7 }, { type: 'moggy', x: 18, z: 11 }]);
  const p = addPerson(g, { x: 6, z: 7 });
  treats(g, p);
  assert.equal(g.cats[0].st, S.lured);
  assert.notEqual(g.cats[1].st, S.lured);
});

test('kittens follow a grown cat, and once the Boss is in, the gang marches in', () => {
  const g = setup([
    { type: 'moggy', x: 10, z: 7 },
    { type: 'kitten', x: 11.5, z: 7.5 },
  ]);
  run(g, 4);
  assert.ok(Math.hypot(g.cats[1].x - g.cats[0].x, g.cats[1].z - g.cats[0].z) < 3.2);

  const g2 = setup([
    { type: 'boss', x: 3.2, z: 7, h: Math.PI },
    { type: 'moggy', x: 9, z: 5, gang: 0 },
    { type: 'moggy', x: 9, z: 9, gang: 0 },
  ]);
  const p = addPerson(g2, { x: 5.6, z: 7 });
  run(g2, 20, () => { if (g2.cats[0].st !== S.boxed) { p.ix = -0.5; p.iz = 0; } else { p.x = 15; p.z = 1; p.ix = 0; } });
  assert.equal(g2.cats[0].st, S.boxed);
  assert.ok(g2.cats.every((c) => c.st === S.boxed), g2.cats.map((c) => c.st).join(','));
});

test('in versus, a rival can not stand on your doormat', () => {
  const room = { ...ROOM, carriers: [{ x: 0.65, z: 4, dir: 'e' }, { x: 19.35, z: 10, dir: 'w' }] };
  const g = setup([], { room, mode: 'versus', owners: ['a', 'b'] });
  const rival = addPerson(g, { id: 'b', seat: 'b', carrier: 1, x: 4, z: 4 });
  run(g, 1.5, () => { rival.ix = -1; rival.iz = 0; });
  const k = g.carriers[0];
  const out = (rival.x - k.doorX) * k.nx + (rival.z - k.doorZ) * k.nz;
  assert.ok(out > 0.9, `kept ${out.toFixed(2)} u out`);
});

test('Cat Lady: every cat in adds time to the clock', () => {
  const s = catladySetup();
  const g = createGame({ room: s.room, mode: 'catlady', cats: [], seed: 2, clock: CATLADY.start });
  addPerson(g, { id: 'me' });
  g.started = true;
  run(g, 3);
  assert.ok(g.cats.length >= 2, 'cats come in through the flap');
  const before = g.clock;
  const c = g.cats[0];
  const k = g.carriers[0];
  c.x = k.matX + k.nx * 0.2;
  c.z = k.matZ + k.nz * 0.2;
  c.st = S.flee;
  c.tt = 1;
  c.h = Math.atan2(-k.nz, -k.nx);
  c.vx = -k.nx * 2;
  c.vz = -k.nz * 2;
  c.sp = 2;
  run(g, 1);
  assert.ok(g.boxed >= 1);
  assert.ok(g.clock > before - 1 + CATLADY.bonus - 0.5, `${before.toFixed(1)} → ${g.clock.toFixed(1)}`);
});

test('a predicting copy never decides: no cat goes in on its own, it waits for the host', () => {
  const g = createGame({ room: ROOM, mode: 'versus', cats: [{ type: 'moggy', x: 4.5, z: 7, h: Math.PI }], seed: 1, clock: 120, authority: false });
  g.started = true;
  const c = g.cats[0];
  c.st = S.idle;
  c.tt = 10;
  const p = addPerson(g, { x: 6.8, z: 7, external: true });
  run(g, 4, () => placePerson(g, p, Math.max(2.6, p.x - 0.06), 7, STEP));
  assert.notEqual(c.st, S.boxed);
  assert.equal(g.carriers[0].count, 0);
  assert.equal(g.over, false);
});
