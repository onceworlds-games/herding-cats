// Progress: stars and best times per appointment, Cat Lady's best, cats boxed in all, wins. Saved on events (a level ends,
// a shift ends, a match ends), never per frame. Badges and leaderboards go through the platform when it's there.

import { LEVELS } from './sim/levels.js';

const KEY = 'hc';
const ow = () => window.onceworlds ?? null;

const fresh = () => ({ v: 1, levels: {}, catLady: 0, boxed: 0, wins: 0, seen: {}, hints: {} });

export const progress = fresh();

function clean(raw) {
  const p = fresh();
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return p;
  if (raw.levels && typeof raw.levels === 'object') {
    for (const L of LEVELS) {
      const v = raw.levels[L.n];
      if (!v || typeof v !== 'object') continue;
      const stars = Number.isInteger(v.stars) ? Math.max(0, Math.min(3, v.stars)) : 0;
      const best = Number.isFinite(v.best) && v.best > 0 && v.best < 3600 ? v.best : null;
      p.levels[L.n] = { stars, best };
    }
  }
  p.catLady = Number.isInteger(raw.catLady) && raw.catLady >= 0 ? raw.catLady : 0;
  p.boxed = Number.isInteger(raw.boxed) && raw.boxed >= 0 ? raw.boxed : 0;
  p.wins = Number.isInteger(raw.wins) && raw.wins >= 0 ? raw.wins : 0;
  if (raw.seen && typeof raw.seen === 'object') for (const k of Object.keys(raw.seen).slice(0, 20)) p.seen[k] = !!raw.seen[k];
  if (raw.hints && typeof raw.hints === 'object') for (const k of Object.keys(raw.hints).slice(0, 20)) p.hints[k] = !!raw.hints[k];
  return p;
}

export async function load() {
  try {
    const o = ow();
    let raw = null;
    if (o?.save) raw = await o.save.get(KEY);
    else raw = JSON.parse(localStorage.getItem(`herding-cats:${KEY}`) ?? 'null');
    Object.assign(progress, clean(raw));
  } catch { /* a fresh start */ }
  return progress;
}

let writing = null;
export function persist() {
  const data = JSON.parse(JSON.stringify(progress));
  try {
    const o = ow();
    if (o?.save) writing = Promise.resolve(o.save.set(KEY, data)).catch(() => {});
    else localStorage.setItem(`herding-cats:${KEY}`, JSON.stringify(data));
  } catch { /* ignore */ }
  return writing;
}

export function award(key) {
  try { ow()?.badges?.award(key)?.catch?.(() => {}); } catch { /* ignore */ }
}

export function submit(board, score, opts) {
  try { ow()?.leaderboards?.submit(board, score, opts)?.catch?.(() => {}); } catch { /* ignore */ }
}

export const totalStars = () => Object.values(progress.levels).reduce((a, v) => a + (v?.stars ?? 0), 0);
export const levelDone = (n) => (progress.levels[n]?.stars ?? 0) > 0;
export const unlocked = (n) => n === 1 || levelDone(n - 1);
export const catLadyOpen = () => levelDone(5);
export const nextLevel = () => {
  for (const L of LEVELS) if (!levelDone(L.n)) return L.n;
  return null;
};

export function starsFor(L, allIn, time) {
  if (!allIn) return 0;
  if (time <= L.expert) return 3;
  if (time <= L.par) return 2;
  return 1;
}

/** A finished appointment: stars, best, badges, boards. Returns { stars, newBest, prevBest }. */
export function finishLevel(L, { allIn, time, boxed, stats }) {
  const cur = progress.levels[L.n] ?? { stars: 0, best: null };
  const stars = starsFor(L, allIn, time);
  const prevBest = cur.best;
  const newBest = allIn && (prevBest == null || time < prevBest - 0.005);
  progress.levels[L.n] = { stars: Math.max(cur.stars, stars), best: newBest ? Math.round(time * 100) / 100 : prevBest };
  addBoxed(boxed);
  if (allIn) {
    award('full-carrier');
    if (time <= L.par) award('under-par');
    if (L.n === 9 && stars === 3) award('cat-cafe');
    if (LEVELS.every((x) => levelDone(x.n))) award('fifteen-appointments');
    submit(`appt-${String(L.n).padStart(2, '0')}`, Math.round(time * 100) / 100, { lowerIsBetter: true });
  }
  if (stats?.bossFirst != null && stats.bossFirst >= 0) award('boss-move');
  if (stats?.zoomies) award('zoomies');
  submit('stars', totalStars());
  persist();
  return { stars, newBest, prevBest };
}

export function addBoxed(n) {
  if (!(n > 0)) return;
  progress.boxed += n;
  award('first-cat');
  if (progress.boxed >= 500) award('crazy-cat-person');
  submit('cats-boxed', progress.boxed);
}

export function finishCatLady(boxed, stats) {
  const prev = progress.catLady;
  if (boxed > prev) progress.catLady = boxed;
  addBoxed(boxed);
  if (boxed >= 25) award('cat-lady');
  if (stats?.zoomies) award('zoomies');
  if (stats?.bossFirst != null && stats.bossFirst >= 0) award('boss-move');
  if (boxed > 0) submit('cat-lady', boxed);
  persist();
  return { best: progress.catLady, newBest: boxed > prev };
}

export function finishMatch({ won, boxed }) {
  if (won) {
    progress.wins++;
    award('best-in-show');
  }
  addBoxed(boxed);
  persist();
}

export function seen(key) {
  if (progress.seen[key]) return true;
  progress.seen[key] = true;
  persist();
  return false;
}
