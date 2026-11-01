// Versus, Together and Cat Lady played by herder bots.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runRound, runCatLady } from '../src/sim/runs.js';
import { ROUND } from '../src/sim/tuning.js';

test('versus rounds box nearly every cat in two minutes, with no runaway leader', () => {
  for (const seats of [2, 4, 6]) {
    let boxed = 0;
    let total = 0;
    let top = 0;
    let n = 0;
    for (let seed = 1; seed <= 6; seed++) {
      for (const round of [1, 2, 3]) {
        const r = runRound({ seed, round, seats, skills: Array(seats).fill(0.6) });
        const inside = r.counts.reduce((a, b) => a + b, 0);
        boxed += inside;
        total += r.total;
        top += Math.max(...r.counts) / Math.max(1, inside);
        n++;
        assert.ok(r.time <= ROUND.versus + 0.1);
      }
    }
    assert.ok(boxed / total >= 0.85, `${seats} seats: ${boxed}/${total} boxed`);
    assert.ok(top / n < 1 / seats + 0.4, `${seats} seats: leader's share ${(top / n).toFixed(2)}`);
  }
});

test('a much better herder wins most versus matches, not all', () => {
  let wins = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const tot = [0, 0, 0, 0];
    for (let round = 1; round <= 3; round++) {
      const r = runRound({ seed, round, seats: 4, skills: [1, 0.3, 0.3, 0.3], styles: ['shepherd', 'shepherd', 'clapper', 'poacher'] });
      r.counts.forEach((c, i) => (tot[i] += c));
    }
    if (tot[0] > Math.max(...tot.slice(1))) wins++;
  }
  assert.ok(wins >= 6, `${wins}/8`);
});

test('together: a good team gets every cat in, from one to six people', () => {
  for (const seats of [1, 3, 6]) {
    let allIn = 0;
    let stars3 = 0;
    for (let seed = 1; seed <= 5; seed++) {
      const r = runRound({ seed, round: 2, seats, together: true, skills: Array(seats).fill(0.8) });
      if (r.allIn) allIn++;
      if (r.allIn && ROUND.together - r.time >= ROUND.togetherStars[1]) stars3++;
    }
    assert.ok(allIn >= 4, `${seats} seats: ${allIn}/5 all in`);
    if (seats >= 3) assert.ok(stars3 >= 1, `${seats} seats: three stars reachable`);
  }
});

test('Cat Lady: an average shift lasts a couple of minutes, a great one goes on and on', () => {
  const mid = [];
  for (let seed = 1; seed <= 4; seed++) mid.push(runCatLady({ skill: 0.5, seed }).time);
  const avg = mid.reduce((a, b) => a + b, 0) / mid.length;
  assert.ok(avg >= 80 && avg <= 240, `skill 0.5 averages ${avg.toFixed(0)} s`);
  let long = 0;
  for (let seed = 1; seed <= 4; seed++) if (runCatLady({ skill: 1, seed, limit: 400 }).boxed >= 30) long++;
  assert.ok(long >= 2, `${long}/4 great shifts pass 30 cats`);
});
