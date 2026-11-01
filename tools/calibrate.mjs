// Suggests par and expert per appointment from 10 runs of the herder bot at full skill: node tools/calibrate.mjs [--write]
// (--write patches src/sim/levels.js).
import fs from 'node:fs';
import { runLevel } from '../src/sim/runs.js';
import { LEVELS } from '../src/sim/levels.js';
const FILE = new URL('../src/sim/levels.js', import.meta.url);
const write = process.argv.includes('--write');
let src = fs.readFileSync(FILE, 'utf8');
for (const L of LEVELS) {
  const times = [];
  let fails = 0;
  for (let s = 1; s <= 10; s++) { const r = runLevel(L.n, { skill: 1, seed: s }); if (!r.allIn) fails++; times.push(r.allIn ? r.time : 999); }
  times.sort((a, b) => a - b);
  const par = Math.ceil(Math.max(times[8] + 1, times[5] / 0.8 + 1) / 5) * 5;
  const expert = Math.max(5, Math.ceil(times[0] / 1.1 / 5) * 5);
  const closes = Math.max(L.closes, Math.ceil((par + 30) / 30) * 30);
  console.log(`L${L.n} fails ${fails} times ${times.map((t) => t.toFixed(0)).join(' ')} → par ${par} expert ${expert} closes ${closes}`);
  const re = new RegExp(`(\\{ n: ${L.n}, name: '[^']*', room: '[^']*', (?:challenge: '[^']*', )?closes: )\\d+(, par: )\\d+(, expert: )\\d+`);
  src = src.replace(re, `$1${closes}$2${par}$3${expert}`);
}
if (write) fs.writeFileSync(FILE, src);
