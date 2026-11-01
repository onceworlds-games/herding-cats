// The player's progress (meta/progress.js) loaded from and stored to ow.save, and the platform's badges and boards.
// Saved on events (a run ends, something is worn), never per frame.

import * as P from './meta/progress.js';
import { LEVELS } from './sim/levels.js';
import { dayOf } from './sim/daily.js';
import { PAGES } from './meta/catalog.js';
import { COAT_INFO } from './sim/coats.js';

const KEY = 'hc';
const ow = () => (typeof window !== 'undefined' ? window.onceworlds ?? null : null);

export const progress = P.fresh();

export async function load() {
  try {
    const o = ow();
    let raw = null;
    if (o?.save) raw = await o.save.get(KEY);
    else raw = JSON.parse(localStorage.getItem(`herding-cats:${KEY}`) ?? 'null');
    Object.assign(progress, P.clean(raw));
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
  try { return Promise.resolve(ow()?.leaderboards?.submit(board, score, opts)).catch(() => null); } catch { return Promise.resolve(null); }
}

/** Today, by the platform's clock when there is one (the same day for everyone, UTC). */
export function today() {
  let now = Date.now();
  try { const t = ow()?.now?.(); if (Number.isFinite(t) && t > 0) now = t; } catch { /* the device's clock */ }
  return dayOf(now);
}

// the Daily's board keeps each player's best ever, so a score carries its day: today's always outrank older ones
export const DAILY_BOARD = 'daily';
export const dailyScore = (day, time) => day * 10000 + (9999 - Math.max(0, Math.min(9999, Math.round(time * 10))));
export function dailyFromScore(score) {
  const day = Math.floor(score / 10000);
  return { day, time: (9999 - (score - day * 10000)) / 10 };
}

export const totalStars = () => P.totalStars(progress);
export const levelStars = (n) => P.levelStars(progress, n);
export const levelDone = (n) => P.levelDone(progress, n);
export const unlocked = (n) => P.unlocked(progress, n);
export const catLadyOpen = () => P.catLadyOpen(progress);
export const dailyOpen = () => P.dailyOpen(progress);
export const nextLevel = () => P.nextLevel(progress);
export const herder = () => P.herder(progress);
export const owned = () => P.owned(progress);
export const wearing = () => P.wearing(progress);
export const streak = () => P.streakNow(progress, today());
export const goals = () => P.goalsToday(progress, today());

export function wear(id) {
  if (!P.wear(progress, id)) return false;
  persist();
  return true;
}

/** A run is over: the report for the results screen. run: see meta/progress.js finishRun. */
export function finish(run) {
  const day = run.day ?? today();
  const rep = P.finishRun(progress, run, day);
  const res = run.result ?? {};
  const stats = res.stats ?? {};
  const own = run.kind !== 'round';
  // badges where they happen
  if ((run.mine ?? 0) > 0) award('first-cat');
  if (progress.boxed >= 500) award('crazy-cat-person');
  if ((run.kind === 'level' || run.kind === 'daily') && res.allIn) {
    award('full-carrier');
    if (rep.stars & P.STAR.par) award('under-par');
  }
  if (P.starCount(progress.levels[9]?.s ?? 0) === 3) award('cat-cafe');
  if (LEVELS.every((L) => P.levelDone(progress, L.n))) award('fifteen-appointments');
  if (own && stats.bossFirst != null && stats.bossFirst >= 0) award('boss-move');
  if (own && stats.zoomies) award('zoomies');
  if (own && (stats.bestCombo ?? 0) >= 4) award('cat-train');
  if (own && (stats.banks ?? 0) > 0) award('bank-shot');
  if (run.kind === 'catlady' && (run.mine ?? 0) >= 25) award('cat-lady');
  if (run.won) award('best-in-show');
  if ((run.cats ?? []).some((c) => (COAT_INFO[c.coat]?.rarity ?? 0) >= 2)) award('rare-coat');
  if (PAGES.every((pg) => P.owned(progress).has(pg.reward))) award('cat-alog');
  if (progress.daily.streak >= 7) award('week-of-dailies');
  if (rep.after.level >= 10) award('herder-10');
  // boards
  if (run.kind === 'level' && res.allIn) submit(`appt-${String(run.L.n).padStart(2, '0')}`, Math.round(res.time * 100) / 100, { lowerIsBetter: true });
  if (run.kind === 'daily' && res.allIn) rep.board = submit(DAILY_BOARD, dailyScore(day, res.time));
  if (run.kind === 'catlady' && (run.mine ?? 0) > 0) submit('cat-lady', run.mine);
  if (run.kind === 'level' || run.kind === 'daily') submit('stars', P.totalStars(progress));
  if (run.mine > 0) submit('cats-boxed', progress.boxed);
  if (rep.xpGained > 0) submit('herder', progress.xp);
  if (rep.dailyFirst) {
    try { ow()?.data?.game?.add?.('dailyHerders', 1)?.catch?.(() => {}); } catch { /* ignore */ }
  }
  persist();
  return rep;
}

export function seen(key) {
  if (progress.seen[key]) return true;
  progress.seen[key] = true;
  persist();
  return false;
}
