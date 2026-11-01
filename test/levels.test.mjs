// The fifteen appointments, played by the scripted herder (it walks round behind a cat and pushes it along a line to
// the carrier, with treats for cats on or under furniture and claps for a Loaf).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, levelSetup } from '../src/sim/levels.js';
import { runLevel } from '../src/sim/runs.js';
import { createGame, addPerson, step } from '../src/sim/game.js';
import { S, TYPE_LIST } from '../src/sim/tuning.js';

const SEEDS = 10;

test('targets are in order: expert < par < closing time', () => {
  for (const L of LEVELS) {
    assert.ok(L.expert < L.par, `level ${L.n}`);
    assert.ok(L.par + 20 <= L.closes, `level ${L.n} leaves room after par`);
  }
});

test('the herder boxes every cat of every appointment within par', () => {
  const boxedTypes = new Set();
  for (const L of LEVELS) {
    const times = [];
    for (let seed = 1; seed <= SEEDS; seed++) {
      const r = runLevel(L.n, { skill: 1, seed });
      assert.ok(r.allIn, `level ${L.n} seed ${seed}: ${r.boxed}/${r.total} in`);
      assert.ok(r.time <= L.par, `level ${L.n} seed ${seed}: ${r.time.toFixed(1)} s, par ${L.par}`);
      times.push(r.time);
      for (const c of r.g.cats) if (c.st === S.boxed) boxedTypes.add(c.type);
    }
    times.sort((a, b) => a - b);
    // the expert time is a stretch even for the herder
    assert.ok(times[0] <= L.expert * 1.15, `level ${L.n}: best ${times[0].toFixed(1)} vs expert ${L.expert}`);
  }
  for (const type of TYPE_LIST) assert.ok(boxedTypes.has(type), `${type} boxed somewhere`);
});

test('a slow, clumsy herder still makes closing time almost always', () => {
  let ok = 0;
  let runs = 0;
  for (const L of LEVELS) {
    for (let seed = 1; seed <= 4; seed++) {
      const r = runLevel(L.n, { skill: 0.4, seed });
      runs++;
      if (r.allIn) ok++;
    }
  }
  assert.ok(ok / runs >= 0.9, `${ok}/${runs}`);
});

test('every new cat type is introduced by its own level', () => {
  const seen = new Set(['moggy']);
  for (const L of LEVELS) {
    for (const c of L.cats) {
      if (!seen.has(c.type)) assert.equal(L.intro, c.type, `level ${L.n} brings in ${c.type} without an intro`);
      seen.add(c.type);
    }
  }
});

test('the surprise cat appears from under the sofa once the others are in', () => {
  const setup = levelSetup(1);
  const g = createGame({ room: setup.room, mode: 'level', cats: setup.cats, seed: 3, clock: 120 });
  addPerson(g, { id: 'me' });
  g.started = true;
  assert.equal(g.total, 2);
  const surprise = g.cats.find((c) => c.surprise);
  assert.ok(surprise && surprise.st === S.hidden);
  // box the other two by hand
  for (const c of g.cats) if (!c.surprise) { c.st = S.boxed; c.carrier = 0; }
  step(g);
  assert.equal(surprise.surprise, false);
  assert.equal(g.total, 3);
  assert.ok(g.events.some((e) => e.k === 'surprise'));
  assert.equal(g.over, false, 'not all in until the surprise cat is too');
});

test('levels are the same on every try', () => {
  const a = runLevel(9, { seed: 4 });
  const b = runLevel(9, { seed: 4 });
  assert.equal(a.time, b.time);
  assert.deepEqual(a.g.cats.map((c) => [c.x, c.z]), b.g.cats.map((c) => [c.x, c.z]));
});
