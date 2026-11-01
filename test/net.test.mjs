// The room flow through fake pages: a host and others sharing snapshots, a host that reloads, a leaver, a latecomer,
// and everything read from the room checked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSession, makeRoundData, readRoundData, snapshot, applySnapshot, advance, easeOffsets, feedPresence, readPresence,
  becomeHost, seatLeft, roundScore,
} from '../src/net/session.js';
import { decode, encode } from '../src/sim/codec.js';
import { STEP, S } from '../src/sim/tuning.js';

const seats = ['ann', 'bo', 'bot:1', 'bot:2'];
const data = makeRoundData({ seed: 41, round: 2, mode: 'versus', seats, skills: [0.5, 0.5, 0.6, 0.6] });
const bots = ['bot:1', 'bot:2'];

/** A fake room: pages step at 60 fps; presence and the host's state arrive `lag` seconds late. */
function play({ seconds, lag = 0.1, onFrame, hostId = 'ann', pages: who = ['ann', 'bo'] }) {
  const pages = new Map(who.map((id) => [id, createSession({ data, me: id, host: id === hostId, bots, roundId: 'r2' })]));
  const wire = []; // { at, kind, from, value }
  let now = 0;
  const frames = Math.round(seconds * 60);
  for (let f = 0; f < frames; f++) {
    now += 1 / 60;
    for (const [id, s] of pages) {
      const me = s.people.get(id);
      // each player walks a slow circle
      if (me) {
        const a = now * 0.6 + (id === 'bo' ? 2 : 0);
        me.ix = Math.cos(a) * 0.7;
        me.iz = Math.sin(a) * 0.7;
      }
      advance(s, 1 / 60, now);
      easeOffsets(s, 1 / 60);
      wire.push({ at: now + lag, kind: 'presence', from: id, value: { x: me.x, z: me.z, h: me.h, tr: me.treatsSeq, cl: me.clapSeq } });
      if (s.host && f % 6 === 0) wire.push({ at: now + lag, kind: 'state', from: id, value: JSON.parse(JSON.stringify(snapshot(s))) });
    }
    for (let i = 0; i < wire.length; i++) {
      const m = wire[i];
      if (m.at > now) continue;
      wire.splice(i--, 1);
      for (const [id, s] of pages) {
        if (id === m.from) continue;
        if (m.kind === 'presence') feedPresence(s, m.from, readPresence(m.value, s.g.world.w, s.g.world.d), 1 / 60);
        else if (!s.host) applySnapshot(s, m.value, s.g.time);
      }
    }
    onFrame?.(pages, now, f);
  }
  return pages;
}

test('round data and snapshots are checked before use', () => {
  assert.ok(readRoundData(data));
  assert.equal(readRoundData({ ...data, mode: 'chaos' }), null);
  assert.equal(readRoundData({ ...data, seats: ['a', 'a'] , skills: [0, 0] }), null);
  assert.equal(readRoundData({ ...data, round: 0 }), null);
  assert.equal(readRoundData(null), null);
  const s = createSession({ data, me: 'ann', host: true, bots });
  for (let i = 0; i < 30; i++) advance(s, STEP, (i + 1) * STEP);
  const raw = JSON.parse(JSON.stringify(snapshot(s)));
  const shape = { cats: s.g.cats.length, carriers: s.g.carriers.length, w: s.g.world.w, d: s.g.world.d };
  const ok = decode(raw, shape);
  assert.ok(ok);
  assert.equal(ok.cats.length, s.g.cats.length);
  assert.ok(Math.abs(ok.cats[0].x - s.g.cats[0].x) < 0.01);
  assert.equal(decode({ ...raw, c: raw.c.slice(1) }, shape), null, 'wrong cat count');
  assert.equal(decode({ ...raw, c: [[1e9, 0, 0, 0, 0, 0, 0, 0, 0, 0], ...raw.c.slice(1)] }, shape), null, 'off the map');
  assert.equal(decode({ ...raw, c: [[0, 0, 0, 99, 0, 0, 0, 0, 0, 0], ...raw.c.slice(1)] }, shape), null, 'no such state');
  assert.equal(decode({ ...raw, n: [1, 2] }, shape), null);
  assert.equal(decode('nope', shape), null);
  assert.equal(readPresence({ x: NaN, z: 1 }, 20, 20), null);
  assert.equal(readPresence({ x: 1, z: 900 }, 20, 20), null);
  assert.deepEqual(readPresence({ x: 1, z: 2, h: 'x', tr: -4, cl: 2 }, 20, 20), { x: 1, z: 2, h: 0, tr: 0, cl: 2 });
});

test('pages that predict agree with the host and never let a cat snap', () => {
  let worstJump = 0;
  const last = new Map();
  let maxErr = 0;
  play({
    seconds: 20,
    onFrame(pages, now) {
      const host = pages.get('ann');
      const bo = pages.get('bo');
      bo.g.cats.forEach((c, i) => {
        if (c.st === S.boxed || c.st === S.enter || host.g.cats[i].st === S.boxed) { last.delete(i); return; }
        const x = c.x + bo.offsets[i].x;
        const z = c.z + bo.offsets[i].z;
        const prev = last.get(i);
        if (prev) worstJump = Math.max(worstJump, Math.hypot(x - prev.x, z - prev.z));
        last.set(i, { x, z });
        if (now > 2) maxErr = Math.max(maxErr, Math.hypot(c.x - host.g.cats[i].x, c.z - host.g.cats[i].z));
      });
    },
  });
  // a shot cat moves 0.23 u a step: a drawn jump much bigger than that would be a visible snap
  assert.ok(worstJump < 0.6, `worst drawn jump ${worstJump.toFixed(3)} u`);
  assert.ok(maxErr < 2.5, `prediction strays ${maxErr.toFixed(2)} u`);
});

test('the host and the others see the same count in every carrier', () => {
  const pages = play({ seconds: 60 });
  const host = pages.get('ann');
  const bo = pages.get('bo');
  assert.deepEqual(bo.g.carriers.map((k) => k.count), host.g.carriers.map((k) => k.count));
  assert.ok(host.g.carriers.reduce((a, k) => a + k.count, 0) > 0, 'cats went in');
});

test('when the host reloads, another page takes over and the round goes on', () => {
  let before = null;
  let handedOver = false;
  const pages = play({
    seconds: 40,
    onFrame(pages, now) {
      if (!handedOver && now >= 15) {
        handedOver = true;
        const host = pages.get('ann');
        before = { counts: host.g.carriers.map((k) => k.count), cats: host.g.cats.length };
        // ann's page is gone; bo's page heard the room name it host
        pages.delete('ann');
        becomeHost(pages.get('bo'));
      }
    },
  });
  const bo = pages.get('bo');
  assert.equal(bo.g.cats.length, before.cats);
  const after = bo.g.carriers.map((k) => k.count);
  after.forEach((n, i) => assert.ok(n >= before.counts[i], 'no cat comes back out'));
  assert.ok(after.reduce((a, b) => a + b, 0) > before.counts.reduce((a, b) => a + b, 0), 'the new host keeps boxing (its bots play on)');
  assert.ok(bo.brains.size === 2, 'the bots think on the new host');
});

test('a leaver keeps their points but their carrier shuts', () => {
  const s = createSession({ data, me: 'ann', host: true, bots });
  for (let i = 0; i < 30 * 20; i++) advance(s, STEP, (i + 1) * STEP);
  const bo = s.people.get('bo');
  const k = s.g.carriers[bo.carrier];
  const had = k.count;
  seatLeft(s, 'bo');
  assert.equal(k.closed, true);
  assert.equal(bo.active, false);
  for (let i = 0; i < 30 * 60; i++) advance(s, STEP, 20 + (i + 1) * STEP);
  assert.equal(k.count, had, 'nothing goes into a shut carrier');
  assert.equal(roundScore(s).bo, had);
});

test('a latecomer takes a bot seat at the next round', () => {
  const next = makeRoundData({ seed: 41, round: 3, mode: 'versus', seats: ['ann', 'bo', 'cy', 'bot:2'], skills: [0.5, 0.5, 0.5, 0.6] });
  const s = createSession({ data: next, me: 'cy', host: false, bots: ['bot:2'], roundId: 'r3' });
  const me = s.people.get('cy');
  assert.ok(me && !me.external, 'their own person, moved by their page');
  assert.equal(s.g.carriers[me.carrier].owner, 'cy');
});

test('together: everyone shares one carrier and credit goes to whoever pushed', () => {
  const tdata = makeRoundData({ seed: 9, round: 1, mode: 'together', seats: ['ann', 'bot:1', 'bot:2'], skills: [0.5, 0.8, 0.8] });
  const s = createSession({ data: tdata, me: 'ann', host: true, bots: ['bot:1', 'bot:2'], roundId: 't1' });
  assert.equal(s.g.carriers.length, 1);
  for (let i = 0; i < 30 * 150 && !s.g.over; i++) advance(s, STEP, (i + 1) * STEP);
  const score = roundScore(s);
  const credited = Object.values(score).reduce((a, b) => a + b, 0);
  assert.ok(credited > 0 && credited <= s.g.carriers[0].count, `${credited} credited of ${s.g.carriers[0].count}`);
  assert.ok(score['bot:1'] + score['bot:2'] > 0);
});

test('the wire stays small', () => {
  const big = makeRoundData({ seed: 3, round: 3, mode: 'versus', seats: ['a', 'b', 'c', 'd', 'e', 'f'], skills: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5] });
  const s = createSession({ data: big, me: 'a', host: true, bots: ['d', 'e', 'f'] });
  for (let i = 0; i < 30 * 30; i++) advance(s, STEP, (i + 1) * STEP);
  const bytes = JSON.stringify(encode(s.g, 'x', [])).length;
  assert.ok(bytes < 2500, `${bytes} bytes`);
});
