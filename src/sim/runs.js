// Whole games played by the herder brain, headless: the balance tests and the par/expert calibration use these.

import { createGame, addPerson, step, treats, clap } from './game.js';
import { createBrain, think } from './brain.js';
import { levelSetup, roundSetup, catladySetup } from './levels.js';
import { STEP, ROUND, CATLADY } from './tuning.js';

export function runLevel(n, { skill = 1, style = 'shepherd', seed = 1, limit = null } = {}) {
  const setup = levelSetup(n);
  const g = createGame({ room: setup.room, mode: 'level', cats: setup.cats, seed, clock: limit ?? setup.level.closes });
  const p = addPerson(g, { id: 'me' });
  const b = createBrain({ skill, style, seed: seed * 7 + 3 });
  g.started = true;
  let guard = 0;
  while (!g.over && guard++ < 30 * 400) {
    const act = think(g, p, b, STEP);
    if (act.treats) treats(g, p);
    if (act.clap) clap(g, p);
    step(g, STEP);
  }
  return { n, allIn: !!g.result?.allIn, time: g.result?.time ?? g.elapsed, boxed: g.boxed, total: g.total, g };
}

export function runRound({ seed = 1, round = 1, seats = 4, together = false, skills = null, styles = null, limit = null } = {}) {
  const setup = roundSetup({ seed, round, seats, together });
  const g = createGame({ room: setup.room, mode: together ? 'together' : 'versus', cats: setup.cats, seed, clock: limit ?? (together ? ROUND.together : ROUND.versus), owners: setup.room.carriers.map((_, i) => `s${i}`) });
  if (together) g.claims = new Map();
  const people = [];
  for (let i = 0; i < seats; i++) {
    const k = g.carriers[together ? 0 : i % g.carriers.length];
    const p = addPerson(g, { id: `s${i}`, seat: `s${i}`, carrier: k.index, x: k.matX + k.nx * 2.5 + (together ? (i - seats / 2) * 0.9 * k.nz : 0), z: k.matZ + k.nz * 2.5 + (together ? (i - seats / 2) * 0.9 * k.nx : 0) });
    people.push({ p, b: createBrain({ skill: skills?.[i] ?? 0.6, style: styles?.[i] ?? ['shepherd', 'clapper', 'poacher'][i % 3], seed: seed * 31 + i }) });
  }
  g.started = true;
  let guard = 0;
  while (!g.over && guard++ < 30 * 400) {
    for (const { p, b } of people) {
      const act = think(g, p, b, STEP);
      if (act.treats) treats(g, p);
      if (act.clap) clap(g, p);
    }
    step(g, STEP);
  }
  return { allIn: !!g.result?.allIn, time: g.result?.time ?? g.elapsed, counts: g.carriers.map((k) => k.count), total: g.cats.length, g };
}

export function runCatLady({ skill = 0.6, seed = 1, limit = 900 } = {}) {
  const setup = catladySetup();
  const g = createGame({ room: setup.room, mode: 'catlady', cats: [], seed, clock: CATLADY.start });
  const p = addPerson(g, { id: 'me' });
  const b = createBrain({ skill, seed: seed * 11 + 5 });
  g.started = true;
  let guard = 0;
  while (!g.over && guard++ < 30 * limit) {
    const act = think(g, p, b, STEP);
    if (act.treats) treats(g, p);
    if (act.clap) clap(g, p);
    step(g, STEP);
  }
  return { boxed: g.boxed, time: g.elapsed, g };
}
