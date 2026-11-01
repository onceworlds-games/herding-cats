// Every room and arena is sound: free doormats, reachable carriers and hiding places, nobody inside the furniture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOMS, ARENA_IDS, arena } from '../src/sim/rooms.js';
import { buildWorld, blockedCat, blockedPerson, findPath, overlaps } from '../src/sim/world.js';
import { LEVELS, levelSetup, roundSetup } from '../src/sim/levels.js';
import { createGame, addPerson, step, treats, clap } from '../src/sim/game.js';
import { createBrain, think } from '../src/sim/brain.js';
import { S, STEP, CAT, PERSON } from '../src/sim/tuning.js';

function allRooms() {
  const out = Object.values(ROOMS);
  for (const id of ARENA_IDS) for (const seats of [1, 2, 3, 4, 5, 6]) {
    out.push(arena(id, seats, false));
    out.push(arena(id, seats, true));
  }
  return out;
}

test('doormats are clear and every carrier can be reached', () => {
  for (const room of allRooms()) {
    const w = buildWorld(room);
    if (room.entry) assert.ok(!blockedPerson(w, room.entry.x, room.entry.z), `${room.id}: entry`);
    for (const k of w.carriers) {
      assert.ok(!blockedCat(w, k.matX, k.matZ), `${room.id}: mat ${k.index} for cats`);
      const fx = k.matX + k.nx * 1.4;
      const fz = k.matZ + k.nz * 1.4;
      assert.ok(!blockedPerson(w, fx, fz), `${room.id}: in front of carrier ${k.index}`);
      if (room.entry) assert.ok(findPath(w, room.entry.x, room.entry.z, fx, fz, false), `${room.id}: walk to carrier ${k.index}`);
    }
  }
});

test('every hiding place can be coaxed from', () => {
  for (const room of allRooms()) {
    const w = buildWorld(room);
    const k = w.carriers[0];
    if (!k) continue;
    w.solids.forEach((s, i) => {
      if (!s.hide) return;
      // some side of it is open floor a cat can walk from, to the carrier
      const sides = [
        [(s.x0 + s.x1) / 2, s.z0 - 0.4], [(s.x0 + s.x1) / 2, s.z1 + 0.4], [s.x0 - 0.4, (s.z0 + s.z1) / 2], [s.x1 + 0.4, (s.z0 + s.z1) / 2],
      ].filter(([x, z]) => x > 0.3 && z > 0.3 && x < w.w - 0.3 && z < w.d - 0.3 && !blockedCat(w, x, z));
      assert.ok(sides.length, `${room.id}: piece ${i} (${s.kind}) is boxed in`);
      assert.ok(sides.some(([x, z]) => findPath(w, x, z, k.matX + k.nx * 1.2, k.matZ + k.nz * 1.2, true)), `${room.id}: piece ${i} is cut off`);
    });
  }
});

test('cats start on open floor', () => {
  for (const L of LEVELS) {
    const s = levelSetup(L.n);
    const g = createGame({ room: s.room, mode: 'level', cats: s.cats, seed: 1, clock: 60 });
    for (const c of g.cats) {
      if (c.st === S.perch || c.st === S.hidden) continue;
      assert.ok(!overlaps(g.world, c.x, c.z, CAT.radius * 0.9), `level ${L.n}: cat ${c.id} in furniture`);
    }
  }
  for (const seats of [2, 4, 6]) {
    for (let seed = 1; seed <= 20; seed++) {
      for (const together of [false, true]) {
        const s = roundSetup({ seed, round: 1 + (seed % 3), seats, together });
        const w = buildWorld(s.room);
        for (const c of s.cats) assert.ok(!overlaps(w, c.x, c.z, CAT.radius * 0.9), `round ${seed} ${seats}: cat in furniture`);
      }
    }
  }
});

function checkPlay(g, label) {
  for (const c of g.cats) {
    assert.ok(Number.isFinite(c.x) && Number.isFinite(c.z) && Number.isFinite(c.h), `${label}: cat ${c.id} NaN`);
    if ([S.boxed, S.enter, S.perch, S.hidden, S.hop, S.runhide, S.creep, S.bump].includes(c.st)) continue;
    assert.ok(c.x > 0 && c.z > 0 && c.x < g.world.w && c.z < g.world.d, `${label}: cat ${c.id} outside at ${c.x.toFixed(2)},${c.z.toFixed(2)}`);
    assert.ok(!overlaps(g.world, c.x, c.z, CAT.radius * 0.5), `${label}: cat ${c.id} (${c.type}, state ${c.st}) inside furniture at ${c.x.toFixed(2)},${c.z.toFixed(2)}`);
  }
  for (const p of g.people) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z), `${label}: person NaN`);
    assert.ok(!overlaps(g.world, p.x, p.z, PERSON.radius * 0.5), `${label}: person inside furniture`);
  }
}

test('in play, nobody ends up inside furniture or outside the room', () => {
  for (const L of LEVELS) {
    for (const seed of [1, 2]) {
      const s = levelSetup(L.n);
      const g = createGame({ room: s.room, mode: 'level', cats: s.cats, seed, clock: L.closes });
      const p = addPerson(g, { id: 'me' });
      const b = createBrain({ skill: seed === 1 ? 1 : 0.4, seed });
      g.started = true;
      for (let i = 0; !g.over && i < 30 * L.closes; i++) {
        const act = think(g, p, b, STEP);
        if (act.treats) treats(g, p);
        if (act.clap) clap(g, p);
        step(g);
        if (i % 3 === 0) checkPlay(g, `level ${L.n} seed ${seed} t ${g.time.toFixed(1)}`);
      }
    }
  }
});
