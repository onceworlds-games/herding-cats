// Bot times on Daily Appointments, against today's par formula: node tools/daily.mjs [days] [seeds] [fromDay]
import { runDaily } from '../src/sim/runs.js';
import { dailySetup, DAILY_PAR } from '../src/sim/daily.js';
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
  const want = Math.max(times[Math.floor(seeds * 0.8)] + 1, times[Math.floor(seeds / 2)] / 0.8 + 1);
  rows.push({ d, n: D.cats.length, area: D.room.w * D.room.d, twist: D.twist, want, par: D.par, fails, times });
  console.log(`${d} ${D.roomId.padEnd(10)} ${D.twist.padEnd(6)} cats ${D.cats.length} ${D.cats.map((c) => c.type[0]).join('')} ch ${D.challenge.padEnd(8)} | ${times.map((t) => t.toFixed(0).padStart(3)).join(' ')} | want ${want.toFixed(0)} par ${D.par} fails ${fails}`);
}
// least squares: want ~ base + perCat n + area a + twist
const twists = ['laser', 'vacuum', 'bell', 'boxes'];
const X = rows.map((r) => [1, r.n, r.area, ...twists.map((t) => (r.twist === t ? 1 : 0))]);
const y = rows.map((r) => r.want);
const k = X[0].length;
const A = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => X.reduce((s, x) => s + x[i] * x[j], 0) + (i === j ? 1e-3 : 0)));
const b = Array.from({ length: k }, (_, i) => X.reduce((s, x, r) => s + x[i] * y[r], 0));
for (let i = 0; i < k; i++) { let p = i; for (let r = i + 1; r < k; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r; [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]]; for (let r = 0; r < k; r++) { if (r === i) continue; const f = A[r][i] / A[i][i]; for (let c = i; c < k; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; } }
const w = b.map((v, i) => v / A[i][i]);
console.log('fit: base', w[0].toFixed(1), 'perCat', w[1].toFixed(2), 'area', w[2].toFixed(3), twists.map((t, i) => `${t} ${w[3 + i].toFixed(1)}`).join(' '));
console.log('now:', JSON.stringify(DAILY_PAR));
const under = rows.filter((r) => r.par < r.want).length;
console.log(`par below the bot's want on ${under}/${rows.length} days; fails ${rows.reduce((a, r) => a + r.fails, 0)}`);
