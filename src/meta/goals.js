// Three goals a day, picked by the UTC day (and what the player has opened), counted across every mode.

import { makeRng } from '../sim/rng.js';

// stat: which tally a goal counts (see tally()); n: how many; needs: something the player must have opened
export const GOAL_POOL = [
  { id: 'cats', label: (n) => `Box ${n} cats`, stat: 'cats', n: [15, 20, 25, 30] },
  { id: 'doubles', label: (n) => (n === 1 ? 'A Double' : `${n} Doubles`), stat: 'combos', n: [2, 3, 4] },
  { id: 'triple', label: () => 'A Triple', stat: 'triples', n: [1] },
  { id: 'banks', label: (n) => (n === 1 ? 'A bank shot' : `${n} bank shots`), stat: 'banks', n: [1, 2, 3] },
  { id: 'chains', label: (n) => (n === 1 ? 'A knock-on' : `${n} knock-ons`), stat: 'chains', n: [1, 2] },
  { id: 'tricks', label: (n) => `${n} trick shots`, stat: 'tricks', n: [3, 4, 5] },
  { id: 'stars', label: (n) => `Earn ${n} stars`, stat: 'stars', n: [3, 4, 6] },
  { id: 'challenges', label: (n) => (n === 1 ? 'A challenge star' : `${n} challenge stars`), stat: 'challenges', n: [1, 2] },
  { id: 'noclap', label: () => 'Finish with no claps', stat: 'noclap', n: [1] },
  { id: 'notreats', label: () => 'Finish with no treats', stat: 'notreats', n: [1] },
  { id: 'underpar', label: (n) => (n === 1 ? 'Beat a par' : `Beat ${n} pars`), stat: 'underpar', n: [1, 2, 3] },
  { id: 'catlady', label: (n) => `${n} in one Cat Lady shift`, stat: 'catladyBest', n: [10, 15, 20], needs: 'catlady' },
  { id: 'rounds', label: (n) => `Play ${n} Versus rounds`, stat: 'rounds', n: [2, 3], needs: 'online' },
];

/** Today's three goals: [{ id, label, stat, n }]. open: { catlady, online }. */
export function goalsFor(day, open = {}) {
  const rng = makeRng(`goals:${day}`);
  const pool = GOAL_POOL.filter((g) => !g.needs || open[g.needs]);
  const picked = [];
  const stats = new Set();
  for (const g of rng.shuffle(pool)) {
    if (picked.length >= 3) break;
    // one goal per tally, and never both no-claps and no-treats
    if (stats.has(g.stat) || (g.stat === 'notreats' && stats.has('noclap')) || (g.stat === 'noclap' && stats.has('notreats'))) continue;
    stats.add(g.stat);
    const n = rng.pick(g.n);
    picked.push({ id: g.id, label: g.label(n), stat: g.stat, n });
  }
  return picked;
}

/**
 * What one run adds to each tally. run: { kind: 'level'|'daily'|'catlady'|'round', allIn, mine (cats into my carrier),
 * stats (g.stats), newStars (stars earned this run, any), challenge (bool), underPar (bool) }.
 */
export function tally(run) {
  const s = run.stats ?? {};
  const out = {
    cats: run.mine ?? 0,
    combos: s.combos ?? 0,
    triples: (s.bestCombo ?? 0) >= 3 ? 1 : 0,
    banks: s.banks ?? 0,
    chains: s.chains ?? 0,
    tricks: (s.banks ?? 0) + (s.chains ?? 0) + (s.laserIns ?? 0) + (s.rides ?? 0) + (s.deliveries ?? 0),
    stars: run.stars ?? 0,
    challenges: run.challenge ? 1 : 0,
    noclap: run.allIn && (run.kind === 'level' || run.kind === 'daily') && (s.claps ?? 0) === 0 ? 1 : 0,
    notreats: run.allIn && (run.kind === 'level' || run.kind === 'daily') && (s.treats ?? 0) === 0 ? 1 : 0,
    underpar: run.underPar ? 1 : 0,
    catladyBest: run.kind === 'catlady' ? run.mine ?? 0 : 0,
    rounds: run.kind === 'round' ? 1 : 0,
  };
  return out;
}

/** Best-of tallies (a shift's best) keep the most; the rest add up. */
export const BEST_OF = new Set(['catladyBest']);
