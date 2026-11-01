// The fifteen appointments, Cat Lady, and the cat line-ups for Versus and Together rounds.

import { ROOMS, arena, ARENA_IDS } from './rooms.js';
import { makeRng } from './rng.js';
import { ROUND, COATS } from './tuning.js';
import { buildWorld, freeSpot, overlaps } from './world.js';

const overlapsAny = (world, p) => overlaps(world, p.x, p.z, 0.8);

const c = (type, coat, x, z, extra = {}) => ({ type, coat, x, z, ...extra });

// par / expert are seconds, set from the herder's runs (test/levels.test.mjs); closes is the vet's closing time.
// `intro` names the cat a level introduces.
export const LEVELS = [
  { n: 1, name: 'Two Lazy Cats', room: 'studio', challenge: 'double', closes: 120, par: 25, expert: 15, hint: 'push',
    cats: [c('moggy', 'ginger', 6.5, 6.5), c('moggy', 'tuxedo', 10, 8.5), c('moggy', 'grey', 3.6, 1.6, { surprise: true })] },
  { n: 2, name: 'Up on the Sofa', room: 'living', challenge: 'noclap', closes: 120, par: 35, expert: 20, hint: 'treats',
    cats: [c('moggy', 'calico', 6, 3.7, { perchKind: 'sofa' }), c('moggy', 'black', 9.5, 4.8), c('moggy', 'white', 10, 10.5)] },
  { n: 3, name: 'Loaf Around', room: 'bedroom', challenge: 'loaf', closes: 120, par: 30, expert: 20, hint: 'clap', intro: 'loaf',
    cats: [c('loaf', 'grey', 6, 8.5), c('loaf', 'ginger', 10, 6.2), c('moggy', 'tuxedo', 13, 11.5)] },
  { n: 4, name: 'Snack Attack', room: 'kitchen', challenge: 'chain', closes: 120, par: 25, expert: 15, intro: 'glutton',
    cats: [c('glutton', 'tortie', 13.5, 9.6), c('moggy', 'ginger', 5, 9), c('moggy', 'grey', 9.5, 8.6)] },
  { n: 5, name: 'Zoomies', room: 'hallway', challenge: 'zoomies', closes: 120, par: 35, expert: 20, intro: 'zoomer',
    cats: [c('zoomer', 'black', 14, 4), c('moggy', 'calico', 10, 2.6), c('moggy', 'white', 18, 5.5)] },
  { n: 6, name: 'Under the Bed', room: 'bedroom2', challenge: 'nohide', closes: 120, par: 40, expert: 25, intro: 'scaredy',
    cats: [c('scaredy', 'siamese', 12, 5.6), c('moggy', 'ginger', 6, 7.4), c('moggy', 'grey', 14, 9), c('moggy', 'tuxedo', 4.5, 11)] },
  { n: 7, name: 'Kitten Pile', room: 'laundry', challenge: 'triple', closes: 120, par: 20, expert: 10, intro: 'kitten',
    cats: [c('moggy', 'calico', 8, 9), c('kitten', 'calico', 9, 10.2), c('kitten', 'ginger', 7.4, 10.4), c('kitten', 'white', 9.4, 8.3)] },
  { n: 8, name: 'The Boss', room: 'garden', challenge: 'boss', closes: 150, par: 50, expert: 25, intro: 'boss',
    cats: [c('boss', 'grey', 15, 11.6), c('moggy', 'black', 14, 14.8, { gang: 0 }), c('moggy', 'tuxedo', 16.6, 10.6, { gang: 0 }), c('moggy', 'black', 13.4, 10.9, { gang: 0 }), c('moggy', 'ginger', 6, 11)] },
  { n: 9, name: 'Cat Café', room: 'cafe', challenge: 'nocrash', closes: 180, par: 85, expert: 35,
    cats: [c('moggy', 'ginger', 9, 8), c('moggy', 'tuxedo', 15, 13), c('loaf', 'white', 11, 12.5), c('glutton', 'tortie', 19, 16.8),
      c('zoomer', 'black', 16, 7.8), c('scaredy', 'siamese', 4, 15.2), c('kitten', 'ginger', 9.6, 8.7), c('kitten', 'calico', 8.4, 8.8)] },
  { n: 10, name: 'Quiet Please', room: 'library', challenge: 'bank', closes: 180, par: 105, expert: 60,
    cats: [c('scaredy', 'siamese', 17, 8.6), c('scaredy', 'white', 8, 11.5), c('loaf', 'grey', 14.5, 11), c('zoomer', 'black', 8, 6.2),
      c('moggy', 'ginger', 14, 15.6), c('moggy', 'tuxedo', 5.5, 15.4)] },
  { n: 11, name: 'Moving Day', room: 'movingday', challenge: 'double', closes: 180, par: 85, expert: 45,
    cats: [c('moggy', 'ginger'), c('moggy', 'grey'), c('scaredy', 'white'), c('zoomer', 'black'), c('glutton', 'calico'),
      c('kitten', 'ginger'), c('kitten', 'grey')] },
  { n: 12, name: 'All Aboard', room: 'boat', challenge: 'banks2', closes: 180, par: 80, expert: 45,
    cats: [c('zoomer', 'black'), c('zoomer', 'white'), c('moggy', 'ginger'), c('moggy', 'tuxedo'), c('moggy', 'calico'), c('moggy', 'grey'),
      c('loaf', 'tortie'), c('kitten', 'ginger')] },
  { n: 13, name: 'Greenhouse', room: 'greenhouse', challenge: 'boss', closes: 180, par: 55, expert: 25,
    cats: [c('boss', 'black', 16.5, 10), c('moggy', 'grey', 17.5, 11.4, { gang: 0 }), c('moggy', 'black', 15.4, 11.4, { gang: 0 }),
      c('moggy', 'tuxedo', 16.6, 12.6, { gang: 0 }), c('glutton', 'ginger'), c('kitten', 'calico'), c('kitten', 'white'), c('moggy', 'calico')] },
  { n: 14, name: 'Rooftop', room: 'rooftop', challenge: 'triple', closes: 210, par: 115, expert: 60,
    cats: [c('moggy', 'ginger'), c('moggy', 'grey'), c('moggy', 'tuxedo'), c('moggy', 'black'), c('loaf', 'white'), c('zoomer', 'calico'),
      c('scaredy', 'siamese'), c('glutton', 'tortie'), c('kitten', 'ginger'), c('kitten', 'black')] },
  { n: 15, name: 'Closing Time', room: 'flat', challenge: 'nocrash', closes: 270, par: 140, expert: 90,
    cats: [c('boss', 'grey', 20, 15), c('moggy', 'black', 21.2, 16.4, { gang: 0 }), c('moggy', 'tuxedo', 18.8, 16.4, { gang: 0 }),
      c('moggy', 'ginger'), c('loaf', 'white'), c('zoomer', 'black'), c('scaredy', 'siamese'), c('glutton', 'tortie'),
      c('kitten', 'ginger')] },
];

export const INTROS = {
  loaf: { name: 'Loaf', tip: 'Clap to move it' },
  glutton: { name: 'Glutton', tip: 'Loves treats' },
  zoomer: { name: 'Zoomer', tip: 'Wait for the wiggle' },
  scaredy: { name: 'Scaredy', tip: "Don't clap!" },
  kitten: { name: 'Kitten', tip: 'Follows a cat' },
  boss: { name: 'Boss', tip: 'The gang follows' },
};

/** The cats of a level, placed: random spots are seeded by the level so every try starts the same. */
export function levelSetup(n) {
  const L = LEVELS[n - 1];
  if (!L) return null;
  const room = ROOMS[L.room];
  const world = buildWorld(room);
  const rng = makeRng(`level:${n}`);
  const placed = [];
  const avoid = [{ x: room.entry.x, z: room.entry.z, r: 4 }];
  const cats = L.cats.map((spec, i) => {
    const out = { ...spec };
    if (spec.perchKind) {
      out.perch = world.solids.findIndex((s) => s.kind === spec.perchKind);
      delete out.perchKind;
    }
    if (out.gang === 0) out.gang = L.cats.findIndex((x) => x.type === 'boss');
    if (!Number.isFinite(out.x)) {
      const p = freeSpot(world, rng, { margin: 1.4, avoid: [...avoid, ...placed.map((q) => ({ ...q, r: 2 }))] });
      out.x = p.x;
      out.z = p.z;
    }
    placed.push({ x: out.x, z: out.z });
    out.h = rng.range(-Math.PI, Math.PI);
    return out;
  });
  return { level: L, room, cats };
}

/** A versus or together round: room, carriers and cats, the same on every page from the match seed. */
export function roundSetup({ seed, round, seats, together }) {
  const rng = makeRng(`round:${seed}:${round}`);
  const order = rng.shuffle(ARENA_IDS);
  const arenaId = order[(round - 1) % order.length];
  const n = Math.max(1, Math.min(6, seats));
  const room = arena(arenaId, n, together);
  const world = buildWorld(room);
  const count = together ? ROUND.togetherBase + ROUND.togetherPerSeat * n : ROUND.catsPerSeatVersus * Math.max(2, n);
  const pool = [];
  for (let i = 0; i < count; i++) pool.push('moggy');
  // the mix grows round by round
  const swap = (type, k) => { for (let i = 0; i < k; i++) pool[pool.indexOf('moggy')] = type; };
  swap('glutton', 1);
  swap('kitten', 2);
  if (round >= 2) { swap('zoomer', 2); swap('loaf', 1); swap('scaredy', 1); }
  const cats = [];
  const avoid = room.carriers.map((k) => ({ x: k.x, z: k.z, r: 4 }));
  let bossAt = -1;
  if (round >= 3) {
    const p = freeSpot(world, rng, { margin: 5, avoid });
    bossAt = 0;
    cats.push({ type: 'boss', coat: 'grey', x: p.x, z: p.z });
    for (let i = 0; i < 3 && pool.includes('moggy'); i++) {
      pool.splice(pool.indexOf('moggy'), 1);
      const q = freeSpot(world, rng, { margin: 2, avoid: [{ x: p.x, z: p.z, r: 0.9 }, ...cats.map((x) => ({ x: x.x, z: x.z, r: 0.9 }))] });
      const near = Math.hypot(q.x - p.x, q.z - p.z) < 4 ? q : { x: p.x + (i - 1) * 1.1, z: p.z + 1.2 };
      cats.push({ type: 'moggy', coat: rng.pick(['black', 'tuxedo', 'grey']), x: near.x, z: near.z, gang: 0 });
    }
    pool.pop();
  }
  for (const type of rng.shuffle(pool)) {
    const p = freeSpot(world, rng, { margin: 2.5, avoid: [...avoid, ...cats.map((x) => ({ x: x.x, z: x.z, r: 1.4 }))] });
    cats.push({ type, coat: rng.pick(COATS), x: p.x, z: p.z, h: rng.range(-Math.PI, Math.PI) });
  }
  if (bossAt < 0) cats.forEach((x) => delete x.gang);
  // mid-round, a laser pointer turns up in the middle of the room: whoever grabs it can pull a crowd
  let spot = { x: room.w / 2, z: room.d / 2 };
  for (let r = 0; r < 4 && overlapsAny(world, spot); r++) spot = { x: room.w / 2 + (r + 1) * 0.8, z: room.d / 2 };
  const twists = { laser: { x: spot.x, z: spot.z, delay: together ? 55 : 45 } };
  return { room, cats, arena: arenaId, twists };
}

export function catladySetup() {
  return { room: ROOMS.parlour, cats: [] };
}
