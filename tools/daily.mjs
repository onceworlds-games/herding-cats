// The herder bot on Daily Appointments against today's par: node tools/daily.mjs [days] [seeds] [fromDay]
// Prints each day's bot times and par, then suggested seconds per cat for each room (the 75th percentile of the time
// the bot wants per cat) and how often par sits under what the bot needs.
import { runDaily } from '../src/sim/runs.js';
import { DAILY_PAR } from '../src/sim/daily.js';

const days = Number(process.argv[2] ?? 20);
const seeds = Number(process.argv[3] ?? 5);
const from = Number(process.argv[4] ?? 20393);
const rows = [];
for (let d = from; d < from + days; d++) {
  const times = [];
  let fails = 0;
  let D = null;
  for (let s = 1; s <= seeds; s++) { const r = runDaily(d, { seed: s, limit: 400 }); D = r.D; if (!r.allIn) fails++; times.push(r.allIn ? r.time : 400); }
  times.sort((a, b) => a - b);
  // what par should be: the median run beats it by a fifth
  const want = times[Math.floor(seeds / 2)] / 0.8 + 1;
  rows.push({ room: D.roomId, n: D.cats.length, want, par: D.par, fails });
  console.log(`${d} ${D.roomId.padEnd(10)} ${D.twist.padEnd(6)} cats ${D.cats.length} ${D.cats.map((c) => c.type[0]).join('')} ch ${D.challenge.padEnd(8)} | ${times.map((t) => t.toFixed(0).padStart(3)).join(' ')} | want ${want.toFixed(0)} par ${D.par}${fails ? ` fails ${fails}` : ''}`);
}
const byRoom = {};
for (const r of rows) (byRoom[r.room] ??= []).push(r.want / r.n);
for (const [room, v] of Object.entries(byRoom)) {
  v.sort((a, b) => a - b);
  console.log(`${room.padEnd(11)} days ${String(v.length).padStart(3)}  per cat now ${DAILY_PAR.perCat[room]}  suggested ${v[Math.floor(v.length * 0.75)].toFixed(1)}`);
}
console.log(`par under the bot's median / 0.8 on ${rows.filter((r) => r.par < r.want).length}/${rows.length} days; failed runs ${rows.reduce((a, r) => a + r.fails, 0)}`);
