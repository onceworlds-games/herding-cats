// Everything a player keeps, as plain data, and what a finished run does to it: stars, the herder's XP and level, what
// that unlocks, the Cat-alog, today's Daily and its streak, the daily goals. Pure (no page, no SDK): save.js loads and
// stores it and talks to the platform; the tests drive it directly.

import { LEVELS } from '../sim/levels.js';
import { passed } from './challenges.js';
import { XP, levelOf, levelItem, ITEM, ITEMS, KINDS } from './herder.js';
import { PAGES, addToBook, pageState } from './catalog.js';
import { goalsFor, tally, BEST_OF } from './goals.js';
import { COAT_INFO } from '../sim/coats.js';
import { TYPE_LIST } from '../sim/tuning.js';

export const VERSION = 2;
const DEFAULT_WEAR = { hat: 'hat:none', carrier: 'carrier:red', clap: 'clap:dust', trail: 'trail:none' };
// star bits: all in, under par, the challenge
export const STAR = { allIn: 1, par: 2, challenge: 4 };
export const starCount = (mask) => ((mask & 1) ? 1 : 0) + ((mask & 2) ? 1 : 0) + ((mask & 4) ? 1 : 0);

export function fresh() {
  return {
    v: VERSION, levels: {}, catLady: 0, boxed: 0, wins: 0, xp: 0, wear: { ...DEFAULT_WEAR }, fresh: [],
    book: { coats: {}, types: {} },
    daily: { last: null, streak: 0, best: 0, day: null, time: null, s: 0 },
    goals: { day: null, list: [], prog: {}, done: 0 },
    seen: {}, hints: {},
  };
}

const int = (v, lo = 0, hi = 1e9) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);
const time = (v) => (Number.isFinite(v) && v > 0 && v < 3600 ? v : null);
const flags = (o, max = 40) => {
  const out = {};
  if (o && typeof o === 'object') for (const k of Object.keys(o).slice(0, max)) if (typeof k === 'string' && k.length < 40) out[k] = !!o[k];
  return out;
};

/** A save read back from storage, checked field by field; a v1 save is carried over. */
export function clean(raw) {
  const p = fresh();
  if (!raw || typeof raw !== 'object') return p;
  if (raw.v === 1) return migrate(raw);
  if (raw.v !== VERSION) return p;
  if (raw.levels && typeof raw.levels === 'object') {
    for (const L of LEVELS) {
      const v = raw.levels[L.n];
      if (!v || typeof v !== 'object') continue;
      p.levels[L.n] = { s: int(v.s, 0, 7) ?? 0, best: time(v.best), ros: !!v.ros };
    }
  }
  p.catLady = int(raw.catLady) ?? 0;
  p.boxed = int(raw.boxed) ?? 0;
  p.wins = int(raw.wins) ?? 0;
  p.xp = int(raw.xp) ?? 0;
  if (raw.wear && typeof raw.wear === 'object') {
    for (const k of KINDS) { const id = raw.wear[k]; if (ITEM[id]?.kind === k) p.wear[k] = id; }
  }
  if (Array.isArray(raw.fresh)) p.fresh = raw.fresh.filter((id) => ITEM[id]).slice(0, 60);
  if (raw.book && typeof raw.book === 'object') {
    for (const c of Object.keys(COAT_INFO)) { const n = int(raw.book.coats?.[c]); if (n) p.book.coats[c] = n; }
    for (const t of TYPE_LIST) { const n = int(raw.book.types?.[t]); if (n) p.book.types[t] = n; }
  }
  const d = raw.daily;
  if (d && typeof d === 'object') {
    p.daily = { last: int(d.last), streak: int(d.streak) ?? 0, best: int(d.best) ?? 0, day: int(d.day), time: time(d.time), s: int(d.s, 0, 7) ?? 0 };
  }
  const g = raw.goals;
  if (g && typeof g === 'object' && int(g.day) != null && Array.isArray(g.list)) {
    const list = g.list.slice(0, 3).filter((x) => x && typeof x.label === 'string' && typeof x.stat === 'string' && int(x.n, 1, 1000))
      .map((x) => ({ id: String(x.id ?? x.stat).slice(0, 20), label: x.label.slice(0, 40), stat: x.stat.slice(0, 20), n: x.n }));
    const prog = {};
    if (g.prog && typeof g.prog === 'object') for (const k of Object.keys(g.prog).slice(0, 20)) { const n = int(g.prog[k]); if (n) prog[k] = n; }
    if (list.length === 3) p.goals = { day: g.day, list, prog, done: int(g.done, 0, 7) ?? 0 };
  }
  p.seen = flags(raw.seen);
  p.hints = flags(raw.hints);
  return p;
}

/** v1 kept 0-3 time stars per level: the first two mean the same now, the third was the expert time (a rosette). */
function migrate(raw) {
  const p = fresh();
  let xp = 0;
  if (raw.levels && typeof raw.levels === 'object') {
    for (const L of LEVELS) {
      const v = raw.levels[L.n];
      if (!v || typeof v !== 'object') continue;
      const stars = int(v.stars, 0, 3) ?? 0;
      if (!stars) continue;
      p.levels[L.n] = { s: (stars >= 1 ? STAR.allIn : 0) | (stars >= 2 ? STAR.par : 0), best: time(v.best), ros: stars >= 3 };
      xp += XP.finish + Math.min(2, stars) * XP.star + (stars >= 3 ? XP.rosette : 0);
      // what they met there goes into the Cat-alog
      for (const c of L.cats) {
        p.book.types[c.type] = (p.book.types[c.type] ?? 0) + 1;
        if (COAT_INFO[c.coat]) p.book.coats[c.coat] = (p.book.coats[c.coat] ?? 0) + 1;
      }
    }
  }
  p.catLady = int(raw.catLady) ?? 0;
  p.boxed = int(raw.boxed) ?? 0;
  p.wins = int(raw.wins) ?? 0;
  p.xp = xp + p.boxed * XP.cat + p.wins * XP.win;
  p.seen = flags(raw.seen);
  p.hints = flags(raw.hints);
  return p;
}

// ------------------------------------------------------------------ reading it
export const levelStars = (p, n) => starCount(p.levels[n]?.s ?? 0);
export const totalStars = (p) => Object.values(p.levels).reduce((a, v) => a + starCount(v?.s ?? 0), 0);
export const levelDone = (p, n) => ((p.levels[n]?.s ?? 0) & STAR.allIn) !== 0;
export const unlocked = (p, n) => n === 1 || levelDone(p, n - 1);
export const catLadyOpen = (p) => levelDone(p, 5);
export const dailyOpen = (p) => levelDone(p, 3);
export function nextLevel(p) {
  for (const L of LEVELS) if (!levelDone(p, L.n)) return L.n;
  return null;
}
export const herder = (p) => levelOf(p.xp);

/** Every item the player has: the free ones, one per herder level reached, one per Cat-alog page filled. */
export function owned(p) {
  const out = new Set(ITEMS.filter((it) => it.free).map((it) => it.id));
  const L = levelOf(p.xp).level;
  for (let k = 2; k <= L; k++) { const it = levelItem(k); if (it) out.add(it.id); }
  for (const page of PAGES) if (pageState(page, p.book).done) out.add(page.reward);
  return out;
}

/** What a player wears, checked against what they own (a save from another device could be ahead or behind). */
export function wearing(p) {
  const own = owned(p);
  const out = {};
  for (const k of KINDS) out[k] = own.has(p.wear[k]) ? p.wear[k] : DEFAULT_WEAR[k];
  return out;
}

export function wear(p, id) {
  const it = ITEM[id];
  if (!it || !owned(p).has(id)) return false;
  p.wear[it.kind] = id;
  p.fresh = p.fresh.filter((x) => x !== id);
  return true;
}

/** The streak as it stands today: it lapses after a day without the Daily. */
export function streakNow(p, day) {
  const last = p.daily.last;
  return last != null && day - last <= 1 ? p.daily.streak : 0;
}

/** Today's goals with their progress; a new day starts a new set. */
export function goalsToday(p, day) {
  if (p.goals.day !== day || p.goals.list.length !== 3) {
    p.goals = { day, list: goalsFor(day, { catlady: catLadyOpen(p), online: true }), prog: {}, done: 0 };
  }
  return p.goals.list.map((g, i) => ({ ...g, have: Math.min(g.n, p.goals.prog[g.stat] ?? 0), done: (p.goals.done & (1 << i)) !== 0 }));
}

// ------------------------------------------------------------------ a finished run
/**
 * run: { kind: 'level' | 'daily' | 'catlady' | 'round', L (the level, or the daily from dailySetup), result (g.result),
 *        mine (cats into my carrier), cats ([{ type, coat }] I boxed), won (a match won) }
 * Returns a report for the results screen:
 *   { stars, newStars, rosette, newRosette, newBest, prevBest, xp: [{ label, n }], xpGained, before, after,
 *     unlocks: [item], book: { newCoats, newTypes, pages }, goals: [...], goalsDone: [i], streak, dailyFirst }
 */
export function finishRun(p, run, day) {
  const res = run.result ?? { allIn: false, time: 0, stats: {} };
  const stats = res.stats ?? {};
  const allIn = !!res.allIn;
  const before = levelOf(p.xp);
  const ownedBefore = owned(p);
  const xp = [];
  const add = (label, n) => { if (n > 0) xp.push({ label, n }); };
  const rep = { stars: 0, newStars: 0, rosette: false, newRosette: false, newBest: false, prevBest: null, streak: streakNow(p, day), dailyFirst: false };
  const mine = Math.max(0, run.mine ?? 0);

  // cats, combos, tricks
  add(mine === 1 ? 'A cat' : `${mine} cats`, mine * XP.cat);
  const comboCats = stats.comboCats ?? 0;
  if (run.kind !== 'round') {
    add('Combos', comboCats * XP.combo);
    const tricks = (stats.banks ?? 0) + (stats.chains ?? 0) + (stats.laserIns ?? 0) + (stats.rides ?? 0) + (stats.deliveries ?? 0);
    add(tricks === 1 ? 'Trick shot' : `${tricks} trick shots`, tricks * XP.trick);
  }
  p.boxed = Math.min(1e9, p.boxed + mine);

  let challengeDone = false;
  let underPar = false;
  if (run.kind === 'level' || run.kind === 'daily') {
    const L = run.L;
    underPar = allIn && res.time <= L.par;
    challengeDone = passed(L.challenge, res);
    const got = (allIn ? STAR.allIn : 0) | (underPar ? STAR.par : 0) | (challengeDone ? STAR.challenge : 0);
    rep.stars = got;
    rep.rosette = allIn && res.time <= L.expert;
    if (run.kind === 'level') {
      const cur = p.levels[L.n] ?? { s: 0, best: null, ros: false };
      rep.newStars = got & ~cur.s;
      rep.newRosette = rep.rosette && !cur.ros;
      rep.prevBest = cur.best;
      rep.newBest = allIn && (cur.best == null || res.time < cur.best - 0.005);
      p.levels[L.n] = { s: cur.s | got, best: rep.newBest ? Math.round(res.time * 100) / 100 : cur.best, ros: cur.ros || rep.rosette };
      if (allIn && !(cur.s & STAR.allIn)) add('Appointment kept', XP.finish);
    } else {
      // the Daily: today's best, the streak, a bonus the first time each day
      const today = p.daily.day === day ? p.daily : { ...p.daily, day, time: null, s: 0 };
      rep.newStars = got & ~today.s;
      rep.prevBest = today.time;
      rep.newBest = allIn && (today.time == null || res.time < today.time - 0.005);
      p.daily = { ...today, s: today.s | got, time: rep.newBest ? Math.round(res.time * 100) / 100 : today.time };
      if (allIn && p.daily.last !== day) {
        p.daily.streak = p.daily.last === day - 1 ? p.daily.streak + 1 : 1;
        p.daily.last = day;
        p.daily.best = Math.max(p.daily.best, p.daily.streak);
        rep.dailyFirst = true;
        add(`Daily · day ${p.daily.streak}`, XP.daily + Math.min(6, p.daily.streak - 1) * 25);
      }
      rep.streak = streakNow(p, day);
    }
    const n = starCount(rep.newStars);
    add(n === 1 ? 'New star' : `${n} new stars`, n * XP.star);
    if (challengeDone && !(rep.newStars & STAR.challenge)) add('Challenge', XP.challenge);
    if (rep.newRosette) add('Expert time', XP.rosette);
    if (rep.newBest && rep.prevBest != null) add('Personal best', XP.best);
  }
  if (run.kind === 'catlady' && mine > p.catLady) p.catLady = mine;
  if (run.kind === 'round') add('Round played', XP.round);
  if (run.won) { p.wins++; add('Match won', XP.win); }

  // the Cat-alog
  const book = addToBook(p.book, run.cats ?? []);
  add(book.newCoats.length + book.newTypes.length === 1 ? 'New in the Cat-alog' : `${book.newCoats.length + book.newTypes.length} new in the Cat-alog`,
    (book.newCoats.length + book.newTypes.length) * XP.coat);
  add(book.pages.length === 1 ? 'Page complete' : `${book.pages.length} pages complete`, book.pages.length * XP.page);
  rep.book = book;

  // today's goals
  const goals = goalsToday(p, day);
  const t = tally({ kind: run.kind, allIn, mine, stats: run.kind === 'round' ? {} : stats, stars: starCount(rep.stars), challenge: challengeDone, underPar });
  for (const k of Object.keys(t)) {
    if (!t[k]) continue;
    p.goals.prog[k] = BEST_OF.has(k) ? Math.max(p.goals.prog[k] ?? 0, t[k]) : Math.min(1e6, (p.goals.prog[k] ?? 0) + t[k]);
  }
  rep.goalsDone = [];
  goals.forEach((g, i) => {
    if (p.goals.done & (1 << i)) return;
    if ((p.goals.prog[g.stat] ?? 0) >= g.n) {
      p.goals.done |= 1 << i;
      rep.goalsDone.push(i);
      add(g.label, XP.goal);
    }
  });
  if (rep.goalsDone.length && p.goals.done === 7) add('All three goals', XP.goals);
  rep.goals = goalsToday(p, day);

  const gained = xp.reduce((a, x) => a + x.n, 0);
  p.xp = Math.min(1e9, p.xp + gained);
  rep.xp = xp;
  rep.xpGained = gained;
  rep.before = before;
  rep.after = levelOf(p.xp);
  const ownedAfter = owned(p);
  rep.unlocks = [...ownedAfter].filter((id) => !ownedBefore.has(id)).map((id) => ITEM[id]);
  for (const it of rep.unlocks) if (!p.fresh.includes(it.id)) p.fresh.push(it.id);
  return rep;
}
