// The Daily Appointment: one room, one line-up of cats, one twist and one challenge a day, the same for every player
// (seeded by the UTC day). Its par comes from a formula fitted to the herder bot's times (tools: daily.mjs).

import { ROOMS } from './rooms.js';
import { makeRng } from './rng.js';
import { buildWorld, freeSpot, overlaps } from './world.js';
import { COATS } from './tuning.js';
import { possible } from '../meta/challenges.js';

export const DAY_MS = 86400000;
export const dayOf = (ms) => Math.floor(ms / DAY_MS);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** "Nov 1" */
export function dayLabel(day) {
  const d = new Date(day * DAY_MS);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
export const weekday = (day) => WEEKDAYS[(((day + 4) % 7) + 7) % 7];

export const DAILY_ROOMS = ['studio', 'living', 'bedroom', 'kitchen', 'laundry', 'bedroom2', 'garden', 'cafe', 'library', 'movingday', 'greenhouse', 'hallway'];
const TWISTS = ['laser', 'vacuum', 'bell', 'boxes', 'none'];
const CHALLENGE_POOL = ['double', 'triple', 'noclap', 'notreats', 'bank', 'chain', 'loaf', 'boss', 'zoomies', 'laser', 'ride', 'box', 'nohide', 'nocrash'];
// the bot's time is about A + B per cat + the twist's extra (fitted in tools/daily.mjs)
export const DAILY_PAR = { base: 6, perCat: 6.5, area: 0.05, twist: { laser: 2, vacuum: 3, bell: 6, boxes: 2, none: 0 } };

/** Today's appointment: { day, name, room, cats, twists, twist, challenge, par, expert, closes }. */
export function dailySetup(day) {
  const rng = makeRng(`daily:${day}`);
  const roomId = rng.pick(DAILY_ROOMS);
  const room = ROOMS[roomId];
  const world = buildWorld(room);
  // the line-up: a few moggies and a mix of personalities, bigger at the weekend
  const dow = (((day + 4) % 7) + 7) % 7;
  const count = 5 + (dow === 0 || dow === 6 ? 2 : rng.int(2));
  const pool = ['loaf', 'glutton', 'zoomer', 'scaredy', 'kitten', 'kitten', 'boss'];
  const types = [];
  const special = Math.min(count - 2, 2 + rng.int(2));
  for (let i = 0; i < special; i++) types.push(rng.pick(pool));
  while (types.length < count) types.push('moggy');
  // a Boss brings a gang of two (already among the moggies)
  const hasBoss = types.includes('boss');
  if (types.filter((t) => t === 'boss').length > 1) types[types.lastIndexOf('boss')] = 'moggy';
  const avoid = [{ x: room.entry.x, z: room.entry.z, r: 4 }];
  const placed = [];
  const cats = [];
  let bossAt = -1;
  for (const type of types) {
    const p = freeSpot(world, rng, { margin: 1.4, avoid: [...avoid, ...placed.map((q) => ({ ...q, r: 2 }))] });
    placed.push({ x: p.x, z: p.z });
    const spec = { type, coat: rng.pick(COATS), x: p.x, z: p.z, h: rng.range(-Math.PI, Math.PI) };
    if (type === 'boss') bossAt = cats.length;
    cats.push(spec);
  }
  if (hasBoss && bossAt >= 0) {
    const b = cats[bossAt];
    let gang = 0;
    for (const c of cats) {
      if (gang >= 2 || c.type !== 'moggy') continue;
      // the gang stands round its Boss
      const a = gang * 2.1 + 0.6;
      const x = b.x + Math.cos(a) * 1.3;
      const z = b.z + Math.sin(a) * 1.3;
      if (x > 1 && z > 1 && x < room.w - 1 && z < room.d - 1 && !overlaps(world, x, z, 0.5)) { c.x = x; c.z = z; }
      c.gang = bossAt;
      c.coat = rng.pick(['black', 'tuxedo', 'grey']);
      gang++;
    }
  }
  // the twist
  const twist = rng.pick(TWISTS);
  const twists = {};
  if (twist === 'laser') {
    const p = freeSpot(world, rng, { margin: 2.5, avoid: placed.map((q) => ({ ...q, r: 1.5 })) });
    twists.laser = { x: p.x, z: p.z, delay: 12 };
  } else if (twist === 'vacuum') {
    const p = freeSpot(world, rng, { margin: 2, avoid: [...avoid, ...placed.map((q) => ({ ...q, r: 1.5 }))] });
    twists.vacs = [{ x: p.x, z: p.z, h: rng.range(-Math.PI, Math.PI) }];
  } else if (twist === 'bell') {
    twists.bell = { every: 26, first: 22 };
  } else if (twist === 'boxes') {
    twists.boxes = [];
    for (let i = 0; i < 2; i++) {
      const p = freeSpot(world, rng, { margin: 1.6, avoid: [...avoid, ...placed.map((q) => ({ ...q, r: 1.5 })), ...twists.boxes.map((q) => ({ ...q, r: 3 }))] });
      twists.boxes.push({ x: p.x, z: p.z });
    }
  }
  const challenges = CHALLENGE_POOL.filter((id) => possible(id, { types, twists }));
  const challenge = rng.pick(challenges);
  const area = room.w * room.d;
  const parRaw = DAILY_PAR.base + DAILY_PAR.perCat * cats.length + DAILY_PAR.area * area + DAILY_PAR.twist[twist];
  const par = Math.round(parRaw / 5) * 5;
  const expert = Math.max(10, Math.round((par * 0.6) / 5) * 5);
  const closes = Math.max(120, Math.ceil((par * 2.2) / 30) * 30);
  return { day, name: dayLabel(day), roomId, room, cats, twists, twist, challenge, par, expert, closes };
}
