// What a player keeps: stars that differ, the herder's level and unlocks, the Cat-alog, the Daily and its streak, goals.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/meta/progress.js';
import { levelOf, need, MAX_LEVEL, LEVEL_ITEMS, ITEM, ITEMS, XP } from '../src/meta/herder.js';
import { CHALLENGES, passed, liveState, possible } from '../src/meta/challenges.js';
import { PAGES, addToBook, pageState } from '../src/meta/catalog.js';
import { goalsFor } from '../src/meta/goals.js';
import { dailySetup, dayOf, DAILY_ROOMS } from '../src/sim/daily.js';
import { LEVELS } from '../src/sim/levels.js';
import { buildWorld, overlaps } from '../src/sim/world.js';
import { rollCoat, COAT_INFO, COAT_IDS } from '../src/sim/coats.js';
import { makeRng } from '../src/sim/rng.js';
import { createGame } from '../src/sim/game.js';

const STATS = {
  zoomies: false, bossFirst: null, firstBoxed: 0, bestCombo: 1, combos: 0, banks: 0, chains: 0, knocks: 0, claps: 2,
  treats: 1, crashes: 0, laserIns: 0, rides: 0, deliveries: 0, loafShot: false, shots: 2, hides: 0, comboCats: 0, shotIns: 1,
};
const result = (o = {}) => ({ allIn: true, time: 20, boxed: 3, stats: { ...STATS, ...(o.stats ?? {}) }, ...o, stats: { ...STATS, ...(o.stats ?? {}) } });
const DAY = 20393;

test('the herder levels up on a rising curve and stops at the top', () => {
  assert.deepEqual(levelOf(0), { level: 1, into: 0, next: need(1), total: 0 });
  assert.equal(levelOf(need(1) - 1).level, 1);
  assert.equal(levelOf(need(1)).level, 2);
  assert.equal(levelOf(need(1) + need(2)).level, 3);
  assert.equal(levelOf(1e9).level, MAX_LEVEL);
  assert.ok(need(10) > need(2));
  // every level from 2 to the top brings something, and nothing twice
  const ids = [];
  for (let L = 2; L <= MAX_LEVEL; L++) { assert.ok(ITEM[LEVEL_ITEMS[L]], `level ${L}`); ids.push(LEVEL_ITEMS[L]); }
  assert.equal(new Set(ids).size, ids.length);
  for (const pg of PAGES) assert.ok(ITEM[pg.reward] && !ids.includes(pg.reward), pg.id);
});

test('three different stars: all in, under par, the challenge; each kept once', () => {
  const p = P.fresh();
  const L = LEVELS[0];
  assert.equal(L.challenge, 'double');
  // all in, over par, no Double
  let rep = P.finishRun(p, { kind: 'level', L, result: result({ time: L.par + 5 }), mine: 3, cats: [] }, DAY);
  assert.equal(rep.stars, P.STAR.allIn);
  assert.equal(P.levelStars(p, 1), 1);
  // the challenge without par: the third star alone
  rep = P.finishRun(p, { kind: 'level', L, result: result({ time: L.par + 1, stats: { bestCombo: 2, combos: 1, comboCats: 1 } }), mine: 3, cats: [] }, DAY);
  assert.equal(rep.stars, P.STAR.allIn | P.STAR.challenge);
  assert.equal(rep.newStars, P.STAR.challenge);
  assert.equal(P.levelStars(p, 1), 2);
  // under par and expert: the last star and the rosette, a new best
  rep = P.finishRun(p, { kind: 'level', L, result: result({ time: L.expert - 1 }), mine: 3, cats: [] }, DAY);
  assert.equal(rep.newStars, P.STAR.par);
  assert.ok(rep.newRosette && rep.newBest);
  assert.equal(P.levelStars(p, 1), 3);
  assert.equal(p.levels[1].best, L.expert - 1);
  // again: nothing new, XP only for the cats
  rep = P.finishRun(p, { kind: 'level', L, result: result({ time: L.expert }), mine: 3, cats: [] }, DAY);
  assert.equal(rep.newStars, 0);
  assert.ok(!rep.newRosette && !rep.newBest);
  assert.equal(rep.xp.find((x) => /new stars?$/.test(x.label)), undefined);
  // a missed appointment keeps nothing and opens nothing
  const q = P.fresh();
  rep = P.finishRun(q, { kind: 'level', L, result: result({ allIn: false, time: 120 }), mine: 1, cats: [] }, DAY);
  assert.equal(rep.stars, 0);
  assert.ok(!P.levelDone(q, 1) && !P.unlocked(q, 2));
  assert.equal(q.xp, XP.cat);
});

test('challenges read the run, need a full carrier, and know when they are lost', () => {
  for (const L of LEVELS) assert.ok(CHALLENGES[L.challenge], `level ${L.n}`);
  assert.ok(passed('noclap', result({ stats: { claps: 0 } })));
  assert.ok(!passed('noclap', result({ allIn: false, stats: { claps: 0 } })));
  assert.equal(liveState('noclap', { ...STATS, claps: 0 }), 0);
  assert.equal(liveState('noclap', { ...STATS, claps: 1 }), -1);
  assert.equal(liveState('double', { ...STATS, bestCombo: 2 }), 1);
  assert.equal(liveState('boss', { ...STATS, bossFirst: -1 }), -1);
  assert.ok(passed('boss', result({ stats: { bossFirst: 0 } })));
  assert.ok(!possible('loaf', { types: ['moggy'] }) && possible('loaf', { types: ['loaf'] }));
  assert.ok(!possible('ride', { twists: {} }) && possible('ride', { twists: { vacs: [{}] } }));
});

test('XP adds up from cats, combos, tricks, stars and the first finish; a level-up unlocks its item', () => {
  const p = P.fresh();
  const L = LEVELS[0];
  const rep = P.finishRun(p, { kind: 'level', L, result: result({ time: L.par - 1, stats: { comboCats: 1, banks: 1, bestCombo: 2, combos: 1 } }), mine: 3, cats: [] }, DAY);
  const want = 3 * XP.cat + XP.combo + XP.trick + XP.finish + 3 * XP.star;
  const goalXp = rep.xp.filter((x) => rep.goals.some((g) => g.label === x.label) || x.label === 'All three goals').reduce((a, x) => a + x.n, 0);
  assert.equal(rep.xpGained - goalXp, want);
  assert.equal(p.xp, rep.xpGained);
  assert.ok(rep.after.level >= 2);
  assert.ok(rep.unlocks.some((it) => it.id === LEVEL_ITEMS[2]));
  assert.ok(p.fresh.includes(LEVEL_ITEMS[2]));
  assert.ok(P.owned(p).has(LEVEL_ITEMS[2]));
});

test('you can only wear what you own; a save from elsewhere never dresses you in a locked item', () => {
  const p = P.fresh();
  assert.equal(P.wear(p, 'hat:crown'), false);
  assert.equal(P.wear(p, 'nonsense'), false);
  p.xp = 10 ** 6;
  assert.equal(P.wear(p, 'hat:crown'), true);
  assert.equal(P.wearing(p).hat, 'hat:crown');
  const q = P.clean({ ...JSON.parse(JSON.stringify(p)), xp: 0 });
  assert.equal(P.wearing(q).hat, 'hat:none');
});

test('the Cat-alog collects coats and personalities; a full page brings its reward', () => {
  const book = { coats: {}, types: {} };
  let r = addToBook(book, [{ type: 'moggy', coat: 'ginger' }, { type: 'moggy', coat: 'ginger' }]);
  assert.deepEqual(r.newCoats, ['ginger']);
  assert.deepEqual(r.newTypes, ['moggy']);
  assert.equal(book.coats.ginger, 2);
  const common = PAGES.find((pg) => pg.id === 'common');
  r = addToBook(book, common.entries.map((coat) => ({ type: 'kitten', coat })));
  assert.deepEqual(r.pages, ['common']);
  assert.ok(pageState(common, book).done);
  const p = P.fresh();
  p.book = book;
  assert.ok(P.owned(p).has(common.reward));
  // in a run: new entries pay XP and the page shows in the report
  const q = P.fresh();
  const rep = P.finishRun(q, { kind: 'catlady', result: { allIn: false, time: 60, stats: STATS }, mine: 8, cats: common.entries.map((coat) => ({ type: 'moggy', coat })) }, DAY);
  assert.deepEqual(rep.book.pages, ['common']);
  assert.ok(rep.unlocks.some((it) => it.id === common.reward));
  assert.equal(q.catLady, 8);
});

test('rare coats turn up now and then, never in place of a level that asked for nothing', () => {
  const rng = makeRng(7);
  const counts = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (let i = 0; i < 30000; i++) counts[COAT_INFO[rollCoat(rng, 'ginger')].rarity]++;
  assert.ok(counts[0] / 30000 > 0.8, 'mostly what was asked');
  assert.ok(counts[1] > counts[2] && counts[2] > counts[3] && counts[3] > 0);
  // a game rolls the same coats on every page from its seed, and a fixed coat stays
  const room = { id: 't', w: 12, d: 10, items: [], carriers: [{ x: 0.65, z: 5, dir: 'e' }], entry: { x: 6, z: 5 } };
  const cats = Array.from({ length: 12 }, (_, i) => ({ type: 'moggy', coat: 'grey', x: 2 + (i % 6) * 1.5, z: 3 + Math.floor(i / 6) * 3 }));
  const a = createGame({ room, cats, seed: 99 }).cats.map((c) => c.coat);
  const b = createGame({ room, cats, seed: 99 }).cats.map((c) => c.coat);
  assert.deepEqual(a, b);
  assert.ok(a.every((c) => COAT_IDS.includes(c)));
  assert.equal(createGame({ room, cats: [{ type: 'moggy', coat: 'grey', fixedCoat: true, x: 5, z: 5 }], seed: 1 }).cats[0].coat, 'grey');
});

test('the Daily: the same room and cats for everyone today, a different one tomorrow, and sane', () => {
  const a = dailySetup(DAY);
  const b = dailySetup(DAY);
  assert.deepEqual(JSON.parse(JSON.stringify(a.cats)), JSON.parse(JSON.stringify(b.cats)));
  const rooms = new Set();
  for (let d = DAY; d < DAY + 60; d++) {
    const s = dailySetup(d);
    rooms.add(s.roomId);
    assert.ok(DAILY_ROOMS.includes(s.roomId));
    assert.ok(s.cats.length >= 5 && s.cats.length <= 7, `day ${d}: ${s.cats.length} cats`);
    assert.ok(CHALLENGES[s.challenge] && possible(s.challenge, { types: s.cats.map((c) => c.type), twists: s.twists }), `day ${d}: ${s.challenge}`);
    assert.ok(s.expert < s.par && s.par < s.closes, `day ${d}`);
    const w = buildWorld(s.room);
    for (const c of s.cats) {
      assert.ok(c.x > 0.5 && c.z > 0.5 && c.x < s.room.w - 0.5 && c.z < s.room.d - 0.5, `day ${d}: cat out of the room`);
      assert.ok(!overlaps(w, c.x, c.z, 0.3), `day ${d}: cat in furniture at ${c.x.toFixed(1)},${c.z.toFixed(1)} in ${s.roomId}`);
    }
    if (s.cats.some((c) => c.type === 'boss')) assert.ok(s.cats.some((c) => c.gang != null));
  }
  assert.ok(rooms.size >= 6);
  assert.equal(dayOf(Date.UTC(2025, 10, 1, 23, 59)), dayOf(Date.UTC(2025, 10, 1, 0, 1)));
});

test('the Daily streak grows day by day, lapses after a missed day, and pays once a day', () => {
  const p = P.fresh();
  const D = dailySetup(DAY);
  const go = (day, allIn = true) => P.finishRun(p, { kind: 'daily', L: { ...D, day }, result: result({ allIn, time: D.par - 1 }), mine: D.cats.length, cats: [] }, day);
  let rep = go(DAY);
  assert.ok(rep.dailyFirst);
  assert.equal(rep.streak, 1);
  rep = go(DAY);
  assert.ok(!rep.dailyFirst, 'once a day');
  assert.equal(p.daily.streak, 1);
  go(DAY + 1);
  assert.equal(p.daily.streak, 2);
  assert.equal(P.streakNow(p, DAY + 2), 2, 'still alive the next day');
  assert.equal(P.streakNow(p, DAY + 3), 0, 'gone after a missed day');
  go(DAY + 3);
  assert.equal(p.daily.streak, 1);
  assert.equal(p.daily.best, 2);
  // a missed Daily doesn't count
  const before = p.daily.streak;
  go(DAY + 4, false);
  assert.equal(p.daily.streak, before);
});

test('daily goals: three a day, the same all day, counted across runs, paid once', () => {
  const g1 = goalsFor(DAY, {});
  assert.equal(g1.length, 3);
  assert.deepEqual(goalsFor(DAY, {}), g1);
  assert.equal(new Set(g1.map((g) => g.stat)).size, 3);
  let differs = false;
  for (let d = DAY + 1; d < DAY + 10; d++) if (JSON.stringify(goalsFor(d, {})) !== JSON.stringify(g1)) differs = true;
  assert.ok(differs);
  // a player chasing "Box n cats" gets there over several runs
  const p = P.fresh();
  p.goals = { day: DAY, list: [{ id: 'cats', label: 'Box 15 cats', stat: 'cats', n: 15 }, { id: 'banks', label: 'A bank shot', stat: 'banks', n: 1 }, { id: 'stars', label: 'Earn 3 stars', stat: 'stars', n: 3 }], prog: {}, done: 0 };
  const go = (mine, stats = {}) => P.finishRun(p, { kind: 'catlady', result: { allIn: false, time: 60, stats: { ...STATS, ...stats } }, mine, cats: [] }, DAY);
  let rep = go(8);
  assert.deepEqual(rep.goalsDone, []);
  assert.equal(rep.goals[0].have, 8);
  rep = go(8, { banks: 1 });
  assert.deepEqual(rep.goalsDone, [0, 1]);
  rep = go(20, { banks: 2 });
  assert.deepEqual(rep.goalsDone, []);
  // a new day, new goals
  P.goalsToday(p, DAY + 1);
  assert.equal(p.goals.day, DAY + 1);
  assert.equal(p.goals.done, 0);
});

test('a v1 save carries over: its stars, best times and rosettes, with XP for them', () => {
  const v1 = { v: 1, levels: { 1: { stars: 3, best: 12.3 }, 2: { stars: 1, best: 50 }, 3: { stars: 2, best: 28 } }, catLady: 14, boxed: 40, wins: 2, seen: { a: true }, hints: { push: true } };
  const p = P.clean(v1);
  assert.equal(p.v, 2);
  assert.deepEqual(p.levels[1], { s: P.STAR.allIn | P.STAR.par, best: 12.3, ros: true });
  assert.deepEqual(p.levels[2], { s: P.STAR.allIn, best: 50, ros: false });
  assert.equal(P.levelStars(p, 3), 2);
  assert.equal(p.catLady, 14);
  assert.ok(p.xp > 0 && p.hints.push);
  assert.ok(p.book.types.moggy > 0);
  // and it reads back the same once saved as v2
  assert.deepEqual(P.clean(JSON.parse(JSON.stringify(p))), p);
});

test('a broken or hostile save reads as a fresh one, field by field', () => {
  assert.deepEqual(P.clean(null), P.fresh());
  assert.deepEqual(P.clean({ v: 9 }), P.fresh());
  const p = P.clean({ v: 2, levels: { 1: { s: 99, best: -4 }, x: 1 }, xp: 'lots', wear: { hat: 'hat:nope', carrier: 'hat:beanie' }, book: { coats: { ginger: -1, plaid: 4 } }, fresh: ['hat:beanie', 'zzz'], goals: { day: 1, list: [1, 2, 3] } });
  assert.equal(p.levels[1].s, 0);
  assert.equal(p.levels[1].best, null);
  assert.equal(p.xp, 0);
  assert.deepEqual(p.wear, P.fresh().wear);
  assert.deepEqual(p.book.coats, {});
  assert.deepEqual(p.fresh, ['hat:beanie']);
  assert.equal(p.goals.day, null);
  assert.equal(ITEMS.filter((it) => it.free).length, 4);
});
