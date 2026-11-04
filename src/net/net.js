// The platform side of a match: the room, the match helper, bots, presence and the host's cat stream. Everything that
// decides lives in session.js (pure, tested with fake rooms); this file only moves data between it and the SDK.

import { createMatch } from '@onceworlds/sdk/match';
import { createBots } from '@onceworlds/sdk/bots';
import {
  createSession, readRoundData, makeRoundData, becomeHost, becomeClient, seatLeft, readPresence, feedPresence,
  snapshot, applySnapshot, easeOffsets, advance, roundScore, stepAlpha,
} from './session.js';
import { treats as doTreats, clap as doClap } from '../sim/game.js';

export { JOIN } from '../join.js';

const KEY = 'host:cats';
const BOT_NAMES = ['Marge', 'Dev', 'Priya', 'Otis', 'Bea', 'Hiro', 'Ruth', 'Sunny', 'Arlo', 'Nell', 'Gus', 'Tamsin'];
const PLAYING = new Set(['intro', 'round', 'roundEnd']);
const fillFor = (game) => (game === 'together' ? 3 : 4);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/**
 * hooks: { session(s) a round's simulation is ready, snapshot({ snap, fresh }) host state arrived (clients), press(kind, person)
 * someone else pressed treats or clap (clients), phase(phase, prev), results(standings, mine), close(reason) }
 */
export function createNet(room, hooks = {}) {
  const n = {
    room, match: null, bots: null, session: null, sessionKey: null, lastRaw: null, presT: 0, screen: 'lobby', rank: 0, looks: [0, 0, 0],
    ended: new Set(), before: null, admitted: new Set(),
  };

  n.match = createMatch(room, {
    rounds: 'rounds',
    introSeconds: 3,
    roundEndSeconds: 5,
    // The standings stay up over the lobby, with the platform's strip, until the player closes them or readies.
    resultsSeconds: 1,
    admit: 'next',
    startRound(m) {
      const present = m.seats.filter((s) => !s.left);
      const humans = present.filter((s) => !s.bot);
      const picked = humans.slice(0, 6);
      for (const s of present) if (s.bot && picked.length < 6) picked.push(s);
      picked.sort((a, b) => a.index - b.index);
      // bots play to the table: a table of strong herders gets sharper bots
      const ranks = humans.map((s) => room.players.get(s.id)?.presence?.rk).filter((v) => Number.isInteger(v) && v >= 0 && v <= 3);
      const rk = ranks.length ? ranks.reduce((a, b) => a + b, 0) / ranks.length : 1;
      const skills = picked.map((s) => (s.bot ? clamp((s.skill ?? 0.5) + (rk - 1) * 0.12, 0.25, 0.95) : 0.5));
      return makeRoundData({
        seed: Math.floor(Math.random() * 2 ** 30), round: m.round, mode: m.settings.game === 'together' ? 'together' : 'versus',
        seats: picked.map((s) => s.id), skills,
      });
    },
    onTick(m) {
      const s = ensure();
      if (!s || !s.host || m.phase !== 'round') return;
      advance(s, 0, m.elapsed / 1000, n.before);
      try { room.setState(KEY, snapshot(s)); } catch { /* the room paces it */ }
      if (s.g.over && !n.ended.has(m.roundId)) {
        n.ended.add(m.roundId);
        m.endRound(roundScore(s));
      }
    },
    score() { return n.session ? roundScore(n.session) : {}; },
    resume() { if (n.session) becomeHost(n.session); },
  });

  n.bots = createBots(n.match, { fill: fillFor(room.settings?.game), think: () => null, names: BOT_NAMES, skill: [0.35, 0.7] });
  room.on('settings', (vals) => { try { n.bots.setFill(fillFor(vals?.game)); } catch { /* ignore */ } });

  n.match.on('phase', (phase, prev) => {
    // Play begins as the platform's countdown ends: the round's headline and its wait are for the rounds after the first.
    if (phase === 'intro' && n.match.round === 1 && n.match.isHost) n.match.skip();
    // latecomers who aren't busy with an appointment join at the next round
    if (phase === 'roundEnd' && n.match.isHost) {
      try {
        const ids = room.online.filter((p) => !p.idle && !room.isParticipant?.(p.id) && p.presence?.s !== 'solo').map((p) => p.id);
        if (ids.length) room.admit(ids);
      } catch { /* ignore */ }
    }
    hooks.phase?.(phase, prev);
  });
  n.match.on('results', (standings, mine) => hooks.results?.(standings, mine));
  room.on('starting', () => {
    if (room.isHost && room.kind !== 'public') { try { room.setOpen(true); } catch { /* ignore */ } }
    hooks.starting?.();
  });
  room.on('close', (reason) => hooks.close?.(reason));

  function botIds(data) {
    return data.seats.filter((id) => n.match.seats.find((s) => s.id === id)?.bot ?? id.startsWith('bot:'));
  }

  /** The round's simulation on this page, made when its data arrives. */
  function ensure() {
    const m = n.match;
    if (!PLAYING.has(m.phase)) {
      if (n.session) { n.session = null; n.sessionKey = null; hooks.session?.(null); }
      return null;
    }
    if (n.session && n.sessionKey === m.roundId) return n.session;
    const data = readRoundData(m.data);
    if (!data || data.round !== m.round) return null; // this round's data hasn't arrived yet
    const meId = m.me?.id ?? null;
    const s = createSession({ data, me: data.seats.includes(meId) ? meId : null, host: m.isHost, bots: botIds(data), roundId: m.roundId });
    n.session = s;
    n.sessionKey = m.roundId;
    n.lastRaw = null;
    // a reload in the middle of this round: carry on from where my page last was
    const mine = s.people.get(s.me);
    const last = room.me?.presence;
    if (mine && last && last.r === m.roundId) {
      const p = readPresence(last, s.g.world.w, s.g.world.d);
      if (p) { mine.x = p.x; mine.z = p.z; mine.treatsSeq = p.tr; mine.clapSeq = p.cl; }
    }
    // pick up the host's stream at once (a reload or a watcher arriving)
    const raw = room.state?.[KEY];
    if (raw && !s.host && m.phase !== 'intro') {
      n.lastRaw = raw;
      applySnapshot(s, raw, m.elapsed / 1000);
      s.offsets.forEach((o) => { o.x = 0; o.z = 0; });
    }
    hooks.session?.(s);
    return s;
  }
  n.ensure = ensure;

  function presenceOf(id, w, d) {
    const p = room.players.get(id);
    if (!p || p.connected === false) return null;
    let smooth = null;
    try { smooth = room.presenceAt(id); } catch { smooth = null; }
    const raw = p.presence;
    if (!raw || typeof raw !== 'object') return null;
    const pos = smooth && typeof smooth === 'object' ? smooth : raw;
    return readPresence({ x: pos.x, z: pos.z, h: pos.h, tr: raw.tr, cl: raw.cl }, w, d);
  }

  /** Per frame: input in, others' presence in, the simulation forward, the host's stream out or in, my presence out. */
  n.frame = (dt, input) => {
    const m = n.match;
    const s = ensure();
    if (s) {
      if (m.isHost && room.connected && !s.host) becomeHost(s);
      else if ((!m.isHost || !room.connected) && s.host) becomeClient(s);
      const me = s.people.get(s.me);
      if (me) {
        const live = m.phase === 'round';
        me.ix = live ? input.x : 0;
        me.iz = live ? input.z : 0;
      }
      // seats that left for good
      for (const seat of m.seats) if (seat.left && s.people.has(seat.id)) seatLeft(s, seat.id);
      const { w, d } = s.g.world;
      for (const id of s.data.seats) {
        if (id === s.me || s.bots.has(id)) continue;
        const pres = presenceOf(id, w, d);
        if (pres) feedPresence(s, id, pres, dt, (kind, p) => hooks.press?.(kind, p));
      }
      if (m.phase === 'round' && !m.paused) {
        if (s.host) advance(s, dt, m.elapsed / 1000, n.before);
        else advance(s, dt, null, n.before);
      }
      if (!s.host) {
        const raw = room.state?.[KEY];
        if (raw && raw !== n.lastRaw) {
          n.lastRaw = raw;
          const res = applySnapshot(s, raw, m.elapsed / 1000);
          if (res) hooks.snapshot?.(res);
        }
      }
      easeOffsets(s, dt);
    }
    n.presT -= dt;
    if (n.presT <= 0) {
      n.presT = 0.05;
      const me = s?.people.get(s.me);
      try {
        room.setPresence(me
          ? { x: r2(me.x), z: r2(me.z), h: r2(me.h), v: r2(me.sp), tr: me.treatsSeq, cl: me.clapSeq, s: n.screen, rk: n.rank, r: n.sessionKey, lk: n.looks }
          : { s: n.screen, rk: n.rank, lk: n.looks });
      } catch { /* ignore */ }
    }
  };

  /** What a player wears ([hat, clap, trail] item numbers from their presence), checked: null when there's nothing to read. */
  n.looksOf = (id) => {
    const lk = room.players?.get?.(id)?.presence?.lk;
    if (!Array.isArray(lk) || lk.length !== 3 || !lk.every((v) => Number.isInteger(v) && v >= 0 && v < 64)) return null;
    return lk;
  };

  /** This page's player pressed treats or clap. Returns true, 'cooldown', or false (not playing). */
  n.press = (kind) => {
    const s = n.session;
    const me = s?.people.get(s.me);
    if (!me || n.match.phase !== 'round' || !me.active) return false;
    if ((kind === 'treats' ? me.treatsCd : me.clapCd) > 0) return 'cooldown';
    return (kind === 'treats' ? doTreats : doClap)(s.g, me) ? true : 'cooldown';
  };

  n.alpha = () => (n.session ? stepAlpha(n.session, n.match.elapsed / 1000) : 1);
  n.isHost = () => n.match.isHost;
  n.phase = () => n.match.phase;
  n.settings = () => room.settings ?? {};
  n.setSetting = (id, v) => { try { room.setSetting(id, v); } catch { /* ignore */ } };
  /** A private server whose host has friends here: no solo runs for that host. */
  n.friendsWaiting = () => room.kind === 'private' && room.isHost && (room.online?.length ?? 1) > 1;
  /** In the next match (it's counting down or playing and I'm one of its players). */
  n.inMatch = () => {
    const ph = room.match?.phase;
    if (ph !== 'starting' && ph !== 'playing') return false;
    try { return room.isParticipant ? room.isParticipant(room.me.id) : !room.spectating; } catch { return !room.spectating; }
  };
  return n;
}

const r2 = (v) => Math.round(v * 100) / 100;
