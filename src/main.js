// Herding Cats: boot, the frame loop, input, and which screen shows. The simulation (src/sim), the match wiring
// (src/net) and the drawing (src/render, src/ui) do the work; this file connects them.

import '@fontsource/fraunces/latin-700.css';
import '@fontsource/fraunces/latin-900.css';
import '@fontsource/big-shoulders-stencil-display/latin-800';
import './style.css';
import { JOIN, joining as joinOnce } from './join.js';
import { createNet } from './net/net.js';

const params = new URLSearchParams(location.search);
const POSTER = params.get('poster');
// ?autoplay: the trailer's takes and the tools' pictures play by themselves (never on onceworlds.com); ?autoplay-to=title|lobby
// goes that far like a player would
const AUTOPLAY = params.has('autoplay') && !/onceworlds\.com$/.test(location.hostname);
const AUTOPLAY_TO = /onceworlds\.com$/.test(location.hostname) ? null : params.get('autoplay-to');
const ow = POSTER ? null : window.onceworlds ?? null;
// join first (join.js already started it as the page loaded), so a reload keeps its seat
const joining = joinOnce();

import * as THREE from 'three';
import { createStage, screenToWorld } from './render/stage.js';
import { createView } from './render/view.js';
import { makeCarrier } from './render/carriers.js';
import { createGame, addPerson, step, treats, clap, loose } from './sim/game.js';
import { createBrain, think } from './sim/brain.js';
import { levelSetup, LEVELS, INTROS, catladySetup } from './sim/levels.js';
import { ROOMS } from './sim/rooms.js';
import { STEP, S, CATLADY, ROUND, SEATS } from './sim/tuning.js';
import { createSession, makeRoundData, advance as advanceSession, stepAlpha } from './net/session.js';
import * as sfx from './audio.js';
import * as save from './save.js';
import { $ui, el, esc, button, star, stars, carrierSvg, rosette, clockFace, fmt, fmtTime, bookCards, stampAt } from './ui/ui.js';
import { symbolSvg } from './ui/symbols.js';

if (POSTER) {
  import('./poster.js').then((m) => m.renderPoster(POSTER)).catch((e) => { console.error(e); document.body.dataset.ready = '1'; });
} else {
  boot();
}

async function boot() {
  const canvas = document.getElementById('world');
  const stage = createStage(canvas);
  const ui = $ui();
  const tags = document.getElementById('tags');
  const reduced = () => !!ow?.settings?.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ------------------------------------------------------------------ settings, size, the platform's areas
  function applyQuality() {
    const q = ow?.settings?.quality ?? 'high';
    const pr = ow?.settings?.pixelRatio ? ow.settings.pixelRatio(2) : Math.min(2, devicePixelRatio || 1);
    stage.setQuality(q, pr);
    stage.reducedMotion = reduced();
  }
  function resize() {
    stage.resize(innerWidth, innerHeight);
    layout();
  }
  function layout() {
    const r = ow && ow.ui ? ow.ui.reserved : null;
    const root = document.documentElement.style;
    const H = innerHeight;
    const W = innerWidth;
    let lt = 82;
    let rt = 12;
    let lb = 96;
    let bb = 16;
    if (Array.isArray(r)) {
      lt = 12;
      lb = 16;
      for (const a of r) {
        if (!a || !Number.isFinite(a.y)) continue;
        if (a.kind === 'menu') {
          if (a.x < W / 2 && a.y < H / 2) lt = Math.max(lt, a.y + a.h + 8);
          if (a.x >= W / 2 && a.y < H / 2) rt = Math.max(rt, a.y + a.h + 8);
        }
        if (a.kind === 'lobby') lb = Math.max(lb, H - a.y + 10);
        if (a.kind === 'buttons') bb = Math.max(bb, H - a.y + 10);
      }
    }
    root.setProperty('--lt', `${lt}px`);
    root.setProperty('--rt', `${rt}px`);
    root.setProperty('--lb', `${lb}px`);
    root.setProperty('--bb', `${bb}px`);
    root.setProperty('--ct', `${12 + (app.watching ? 40 : 0)}px`);
  }

  // ------------------------------------------------------------------ app state
  const app = {
    screen: 'boot', net: null, run: null, scene: null, primary: null, watching: false, myAvatar: null, avatars: new Map(),
    attract: null, waiting: null, matchView: null, local: null, t: 0, touch: false, closedReason: null, toastT: 0,
  };
  const view = createView(stage, { onStamp });
  const avatarWanted = new Set();

  applyQuality();
  resize();
  addEventListener('resize', resize);
  ow?.on?.('reserved', layout);
  ow?.settings?.on?.('change', applyQuality);

  // the carriers' stencilled counts are drawn on canvases: draw them again once the fonts are in
  Promise.all(['900 40px Fraunces', '700 20px Fraunces', '800 40px "Big Shoulders Stencil Display"'].map((f) => document.fonts.load(f)))
    .then(() => view.refreshSigns()).catch(() => {});
  const loading = Promise.race([save.load(), new Promise((r) => setTimeout(r, 2500))]);
  try { ow?.ui?.setLook?.({ accent: '#e5493a', panel: '#2b1d1c', text: '#fff3df' }); } catch { /* ignore */ }

  // ------------------------------------------------------------------ input
  const keys = new Set();
  const MOVE = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (e.repeat && !MOVE[k]) return;
    if (MOVE[k]) { keys.add(k); if (app.screen === 'solo' || app.screen === 'match') e.preventDefault(); }
    sfx.unlock();
    if (k === 'j' || k === ' ') { if (app.screen === 'solo' || app.screen === 'match') { e.preventDefault(); press('treats'); return; } }
    if (k === 'k' || k === 'shift') { if (app.screen === 'solo' || app.screen === 'match') { press('clap'); return; } }
    if (k === 'escape' || k === 'p') { onBack(k); return; }
    if (k === 'r' && app.keyR) { app.keyR(); return; }
    if (k === 'enter' || (k === ' ' && app.screen !== 'solo')) {
      const a = document.activeElement;
      if (a && a.tagName === 'BUTTON') return;
      if (app.primary) { e.preventDefault(); app.primary(); }
    }
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());
  addEventListener('pointerdown', () => sfx.unlock(), { capture: true });

  function stick() {
    let sx = 0;
    let sy = 0;
    for (const k of keys) { const m = MOVE[k]; if (m) { sx += m[0]; sy += m[1]; } }
    const st = ow?.controls?.stick;
    if (st && Number.isFinite(st.x) && Number.isFinite(st.y)) { sx += st.x; sy += st.y; }
    const l = Math.hypot(sx, sy);
    if (l > 1) { sx /= l; sy /= l; }
    return screenToWorld(sx, sy);
  }

  let controlsOn = null;
  function setControls(on) {
    if (controlsOn === on) return;
    controlsOn = on;
    try {
      ow?.controls?.set?.(on ? { stick: 'analog', zone: 'wide', buttons: [{ id: 'treats', label: 'Treats', key: 'j' }, { id: 'clap', label: 'Clap', key: 'k' }] } : null);
    } catch { /* ignore */ }
  }

  function press(kind) {
    if (app.screen === 'solo') {
      const r = app.run;
      if (!r || r.paused || r.introT > 0 || r.over) return;
      const ok = (kind === 'treats' ? treats : clap)(r.g, r.me);
      if (!ok) { view.dud(); return; }
      r.g.started = true;
      if (kind === 'treats') r.usedTreats = true;
      else r.usedClap = true;
    } else if (app.screen === 'match' && app.net) {
      if (app.net.press(kind) === 'cooldown') view.dud();
    }
  }

  function onBack(k) {
    if (app.screen === 'solo' && app.run) {
      if (app.run.over) { app.backAction?.(); return; }
      setPaused(!app.run.paused);
      return;
    }
    if (k === 'escape') app.backAction?.();
  }

  // ------------------------------------------------------------------ platform events
  ow?.on?.('pause', () => { if (app.screen === 'solo' && app.run && !app.run.over) setPaused(true); sfx.suspend(true); });
  ow?.on?.('resume', () => sfx.suspend(false));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (app.screen === 'solo' && app.run && !app.run.over && !AUTOPLAY) setPaused(true);
      sfx.suspend(true);
    } else {
      sfx.suspend(false);
      last = performance.now();
    }
  });

  // ------------------------------------------------------------------ tags (names, hints) over the world
  const tagPool = new Map();
  let tagSeen = new Set();
  function tag(id, html, x, y, z, cls = 'tag ink') {
    let t = tagPool.get(id);
    if (!t) {
      t = el('div', cls);
      tags.appendChild(t);
      tagPool.set(id, t);
      t._html = null;
    }
    if (t.className !== cls) t.className = cls;
    if (t._html !== html) { t.innerHTML = html; t._html = html; }
    const p = stage.toScreen(x, y, z);
    t.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -100%)`;
    t.style.left = '0';
    t.style.top = '0';
    tagSeen.add(id);
    return t;
  }
  function tagsDone() {
    for (const [id, t] of tagPool) {
      if (!tagSeen.has(id)) { t.remove(); tagPool.delete(id); }
    }
    tagSeen = new Set();
  }

  // ------------------------------------------------------------------ stamps
  const stampLayer = el('div');
  stampLayer.style.cssText = 'position:fixed;inset:0;pointer-events:none';
  document.body.appendChild(stampLayer);
  function onStamp(kind, x, y, z) {
    const p = stage.toScreen(x, y, z);
    if (kind === 'in') {
      stampAt(stampLayer, 'IN', p.x, p.y - 30, { reducedMotion: reduced() });
      sfx.stamp();
    } else if (kind === 'surprise') {
      stampAt(stampLayer, '?!', p.x, p.y - 20, { gold: true, life: 1400, reducedMotion: reduced() });
    }
  }

  // ------------------------------------------------------------------ avatars
  function avatarOf(id) {
    if (!id || !ow?.player?.avatar) return null;
    if (app.avatars.has(id)) return app.avatars.get(id);
    if (!avatarWanted.has(id)) {
      avatarWanted.add(id);
      Promise.resolve(ow.player.avatar(id)).then((a) => {
        if (a && typeof a === 'object') {
          const ok = ['skin', 'shirt', 'pants', 'hat'].every((k) => Number.isInteger(a[k]) && a[k] >= 0 && a[k] < 64);
          app.avatars.set(id, ok ? a : null);
          app.peopleDirty = true;
        }
      }).catch(() => {});
    }
    return null;
  }
  const myId = () => app.net?.room?.me?.id ?? 'me';

  // ------------------------------------------------------------------ screens
  function clearUI() {
    ui.innerHTML = '';
    app.primary = null;
    app.backAction = null;
    app.keyR = null;
    app.hud = null;
  }

  function hideLobbyStrip(on) { app.net?.hideLobby(on); }
  /** Where the page is, for tools that take its picture. */
  function flow(where) { try { document.body.dataset.flow = where; } catch { /* ignore */ } }

  function setScreen(name) {
    app.screen = name;
    flow(name === 'solo' || name === 'match' ? 'play' : name);
    if (app.net) app.net.screen = name === 'solo' ? 'solo' : name === 'match' ? 'play' : name;
    setControls(name === 'solo' || (name === 'match' && !!app.net?.session?.me));
  }

  // ---------- title: the café in attract mode, the wordmark, one Play button
  function showTitle() {
    clearUI();
    setScreen('title');
    hideLobbyStrip(true);
    startAttract();
    const root = el('section', '', '');
    root.id = 'title';
    root.innerHTML = `<div class="mark ink"><h1><span>Herding</span><span class="cats"><i class="ear" style="left:0.06em"></i><i class="ear" style="left:0.36em"></i>Cats</span></h1></div>`;
    const play = button('Play', { cls: 'red big play live', key: 'Enter', onClick: () => onPlay() });
    root.appendChild(play);
    const total = save.totalStars();
    if (total > 0 || save.progress.catLady > 0) {
      const st = el('div', 'stats num ink');
      st.innerHTML = `<span>${star(true, 30)}${total}/45</span>${save.progress.catLady > 0 ? `<span>${carrierSvg('#e5493a')}<b style="font-weight:800">${save.progress.catLady}</b></span>` : ''}`;
      st.querySelectorAll('svg').forEach((s) => { s.style.width = '34px'; s.style.height = '30px'; });
      root.appendChild(st);
    }
    ui.appendChild(root);
    app.primary = () => onPlay();
    setTimeout(() => { try { play.focus({ preventScroll: true }); } catch { /* ignore */ } }, 50);
  }

  function onPlay() {
    sfx.unlock();
    sfx.tap();
    sfx.setMusic('menu', { seed: 3 });
    const others = app.net ? (app.net.room.online?.length ?? 1) > 1 : false;
    if (!save.levelDone(1) && !others) { startLevel(1); return; }
    if (app.net) showLobby();
    else showBook();
  }

  // ---------- the waiting room: who's here, settings, the solo tickets; the platform's Ready strip below
  function showLobby() {
    if (!app.net) { showBook(); return; }
    clearUI();
    setScreen('lobby');
    hideLobbyStrip(false);
    startWaiting();
    sfx.setMusic('menu');
    const root = el('section');
    root.id = 'lobby';
    const side = el('div', 'side');
    const board = el('div', 'board live');
    const tickets = el('div', 'tickets');
    side.append(board, tickets);
    root.appendChild(side);
    ui.appendChild(root);
    app.lobbyUI = { board, tickets, key: '' };
    app.backAction = () => showTitle();
    refreshLobby(true);
  }

  function refreshLobby(force = false) {
    const L = app.lobbyUI;
    const n = app.net;
    if (!L || !n || app.screen !== 'lobby') return;
    const set = n.settings();
    const host = n.isHost();
    const friends = n.friendsWaiting();
    const key = `${set.game}|${set.rounds}|${host}|${friends}|${save.totalStars()}|${save.progress.catLady}|${save.catLadyOpen()}`;
    if (!force && key === L.key) return;
    L.key = key;
    const seg = (id, opts, cur) => {
      const s = el('div', `seg${host ? '' : ' locked'}`);
      for (const o of opts) {
        const b = el('button', `${o.v === cur ? 'on' : ''}${o.num ? ' num' : ''}`, esc(o.label));
        b.type = 'button';
        if (host) b.addEventListener('click', () => { sfx.tap(); n.setSetting(id, o.v); setTimeout(() => refreshLobby(true), 60); });
        else b.tabIndex = -1;
        s.appendChild(b);
      }
      return s;
    };
    L.board.innerHTML = '';
    const r1 = el('div', 'row', '<b>Game</b>');
    r1.appendChild(seg('game', [{ v: 'versus', label: 'Versus' }, { v: 'together', label: 'Together' }], set.game ?? 'versus'));
    const r2 = el('div', 'row', '<b>Rounds</b>');
    r2.appendChild(seg('rounds', [1, 3, 5].map((v) => ({ v, label: String(v), num: true })), Number(set.rounds ?? 3)));
    L.board.append(r1, r2);
    L.tickets.innerHTML = '';
    const t1 = el('button', 'ticket live');
    t1.type = 'button';
    t1.innerHTML = `<span class="name">Appointments</span><span class="sub">${friends ? 'Friends are here' : 'Solo, 15 rooms'}</span><span class="val">${star(true, 30)}${save.totalStars()}</span>`;
    if (!save.levelDone(1) && !friends) t1.insertAdjacentHTML('beforeend', '<span class="flag">Start here</span>');
    if (friends) t1.disabled = true;
    else t1.addEventListener('click', () => { sfx.tap(); showBook(); });
    const open = save.catLadyOpen();
    const t2 = el('button', `ticket live${open ? ' gold' : ' locked'}`);
    t2.type = 'button';
    t2.innerHTML = open
      ? `<span class="name">Cat Lady</span><span class="sub">${friends ? 'Friends are here' : 'Endless shift'}</span><span class="val">${carrierSvg('#e5493a')}${save.progress.catLady}</span>`
      : `<span class="name">Cat Lady</span><span class="sub">After appointment 5</span><span class="val">${symbolSvg('lock', '#2b1d1c', '#2b1d1c', 28)}</span>`;
    t2.querySelectorAll('.val svg:not(.sym)').forEach((s) => { s.style.width = '40px'; s.style.height = '34px'; });
    if (!open || friends) t2.disabled = true;
    else t2.addEventListener('click', () => { sfx.tap(); startCatLady(); });
    L.tickets.append(t1, t2);
  }

  // ---------- the Appointment Book
  function showBook() {
    if (app.net?.friendsWaiting()) { showLobby(); return; }
    clearUI();
    setScreen('book');
    hideLobbyStrip(true);
    if (!app.scene || (app.scene !== 'waiting' && app.scene !== 'attract')) startAttract();
    const root = el('section');
    root.id = 'book';
    const head = el('header');
    head.innerHTML = `<h2 class="ink">Appointments</h2><span class="total num ink">${star(true, 30)}${save.totalStars()}/45</span>`;
    const back = button('Back', { cls: 'live', key: 'Esc', onClick: () => goHome() });
    head.appendChild(back);
    const grid = el('div', 'grid live');
    grid.appendChild(bookCards(save.progress, { onPick: (n) => { sfx.tap(); startLevel(n); } }));
    root.append(head, grid);
    ui.appendChild(root);
    app.backAction = () => goHome();
    const next = save.nextLevel();
    app.primary = next ? () => startLevel(next) : null;
  }

  function goHome() {
    sfx.tap();
    if (app.net) showLobby();
    else showTitle();
  }

  // ------------------------------------------------------------------ background scenes
  function startAttract() {
    if (app.scene === 'attract') return;
    const setup = levelSetup(9);
    const seed = 1 + Math.floor(Math.random() * 1000);
    const g = createGame({ room: setup.room, mode: 'level', cats: setup.cats, seed, clock: null });
    const p = addPerson(g, { id: 'bot', x: setup.room.entry.x, z: setup.room.entry.z });
    g.started = true;
    app.attract = { g, p, brain: createBrain({ skill: 0.85, seed }), acc: 0, overT: 0 };
    view.show(g, { people: [{ seed: 7 }], me: -1, total: 'solo' });
    stage.frame(null, { snap: true });
    app.scene = 'attract';
  }

  function tickAttract(dt) {
    const a = app.attract;
    if (!a) return;
    a.acc += Math.min(dt, 0.1);
    while (a.acc >= STEP) {
      view.capture();
      const act = think(a.g, a.p, a.brain, STEP);
      if (act.treats) treats(a.g, a.p);
      if (act.clap) clap(a.g, a.p);
      step(a.g, STEP);
      a.acc -= STEP;
    }
    view.drain((e) => e.k !== 'in' || true);
    if (a.g.over) {
      a.overT += dt;
      if (a.overT > 2.5) { app.scene = null; startAttract(); }
    }
    // a slow drift round the café
    const tt = app.t * 0.12;
    stage.frame({ x: a.g.world.w / 2 + Math.cos(tt) * 3, z: a.g.world.d / 2 + Math.sin(tt) * 2 }, { zoom: 0.92 });
  }

  /** The waiting room: everyone here stands with their carrier; a few cats potter about. */
  function startWaiting() {
    if (app.scene === 'waiting') { app.peopleDirty = true; return; }
    const room = ROOMS.waiting;
    const g = createGame({ room, mode: 'ambient', seed: 5, cats: [
      { type: 'moggy', coat: 'ginger', x: 3, z: 7.5 }, { type: 'loaf', coat: 'white', x: 7, z: 5.2 }, { type: 'kitten', coat: 'calico', x: 11.5, z: 7.6 },
      { type: 'moggy', coat: 'tuxedo', x: 13.5, z: 8.4 },
    ] });
    g.started = true;
    app.waiting = { g, acc: 0, key: '', props: new THREE.Group(), list: [] };
    stage.scene.add(app.waiting.props);
    view.show(g, { people: [], me: -1, total: 'solo' });
    stage.frame(null, { snap: true });
    app.scene = 'waiting';
    app.peopleDirty = true;
  }

  function lobbyRoster() {
    const n = app.net;
    if (!n) return [];
    const lob = n.match.lobby?.players ?? [];
    return lob.slice(0, 6).map((p) => {
      const rp = n.room.players.get(p.id);
      return { id: p.id, name: p.name, ready: p.ready, host: p.host, me: p.me, away: p.away, solo: rp?.presence?.s === 'solo' };
    });
  }

  function tickWaiting(dt) {
    const w = app.waiting;
    if (!w) return;
    const roster = lobbyRoster();
    const key = roster.map((r) => r.id).join(',');
    if (key !== w.key || app.peopleDirty) {
      w.key = key;
      app.peopleDirty = false;
      // people stand in a row in front of the benches, each with their carrier
      w.g.people.length = 0;
      for (const c of w.props.children.slice()) w.props.remove(c);
      roster.forEach((r, i) => {
        const x = 2.4 + i * 2.25;
        addPerson(w.g, { id: r.id, x, z: 2.1, h: Math.PI / 2, external: true });
        const look = SEATS[i];
        const k = { x: x + 0.05, z: 3.35, nx: 0, nz: 1, matX: x, matZ: 4, count: 0, closed: false, shutT: 0 };
        const cv = makeCarrier(k, look);
        cv.root.scale.setScalar(0.62);
        cv.sign.visible = false;
        cv.root.children.forEach((ch) => { if (Array.isArray(ch.material)) ch.visible = false; }); // no doormat in the waiting room
        w.props.add(cv.root);
      });
      w.list = roster;
      view.setPeople(roster.map((r, i) => ({ avatar: avatarOf(r.id), seed: hashId(r.id), look: SEATS[i] })), -1);
    }
    w.acc += Math.min(dt, 0.1);
    while (w.acc >= STEP) { view.capture(); step(w.g, STEP); w.acc -= STEP; }
    view.drain();
    stage.frame(null);
    if (app.screen === 'lobby') {
      w.list.forEach((r, i) => {
        const p = w.g.people[i];
        if (!p) return;
        const bits = [];
        if (r.host) bits.push(symbolSvg('bell', '#f6b941', '#2b1d1c', 22));
        bits.push(`<span>${esc(r.name)}</span>`);
        if (r.ready) bits.push(symbolSvg('check', '#4f9a5e', '#2b1d1c', 24));
        const sub = r.solo ? '<span class="note" style="display:block;text-align:center;color:#f6b941">At the vet</span>' : '';
        tag(`lob:${r.id}`, `<span style="display:flex;gap:5px;align-items:center">${bits.join('')}</span>${sub}`, p.x, 1.55, p.z, `tag ink${r.me ? ' me' : ''}${r.away ? ' dim' : ''}`);
      });
      // one empty seat invites friends
      if (w.list.length < 6 && ow?.ui?.showInvite) {
        const x = 2.4 + w.list.length * 2.25;
        const t = tag('lob:invite', '', x, 1.3, 2.1, 'tag invite');
        if (!t._built) {
          t._built = true;
          t.innerHTML = '';
          t.appendChild(button('+ Invite', { cls: 'live', onClick: () => { sfx.tap(); try { ow.ui.showInvite(); } catch { /* ignore */ } } }));
          t._html = '';
        }
      }
      refreshLobby();
    }
  }

  // ------------------------------------------------------------------ solo: an appointment or a Cat Lady shift
  function leaveScene() {
    if (app.waiting) { stage.scene.remove(app.waiting.props); app.waiting = null; }
    app.attract = null;
    app.scene = null;
  }

  function followSpan() {
    const short = Math.min(innerWidth, innerHeight);
    return short / 34;
  }

  function startLevel(n, { auto = false } = {}) {
    const setup = levelSetup(n);
    if (!setup) return;
    leaveScene();
    clearUI();
    const L = setup.level;
    const tries = (app.tries = (app.tries ?? 0) + 1);
    const g = createGame({ room: setup.room, mode: 'level', cats: setup.cats, seed: n * 101 + tries, clock: L.closes });
    const me = addPerson(g, { id: 'me' });
    app.run = {
      kind: 'level', n, L, g, me, acc: 0, introT: 2.4, over: false, overT: 0, paused: false, auto,
      brain: auto ? createBrain({ skill: 1, seed: n * 7 + 3 }) : null,
      introCat: L.intro ? g.cats.find((c) => c.type === L.intro) : null, hintStage: 0, lastCount: 0, closeTicks: 0,
    };
    app.scene = 'run';
    view.show(g, { people: [{ avatar: avatarOf(myId()), seed: 1 }], me: 0, total: 'solo' });
    stage.frame(app.run.introCat ?? me, { follow: followSpan(), snap: true, zoom: app.run.introCat ? 0.8 : 1 });
    setScreen('solo');
    hideLobbyStrip(true);
    buildSoloHud();
    sfx.setMusic('play', { seed: n });
    sfx.clank();
    if (app.run.introCat) setTimeout(() => sfx.meow(1, 0.45, 0.16), 300);
  }

  function startCatLady({ auto = false } = {}) {
    leaveScene();
    clearUI();
    const setup = catladySetup();
    const tries = (app.tries = (app.tries ?? 0) + 1);
    const g = createGame({ room: setup.room, mode: 'catlady', cats: [], seed: 4242 + tries, clock: CATLADY.start });
    const me = addPerson(g, { id: 'me' });
    app.run = { kind: 'catlady', g, me, acc: 0, introT: 1.6, over: false, overT: 0, paused: false, auto, brain: auto ? createBrain({ skill: 0.9, seed: 9 }) : null, lastCount: 0, closeTicks: 0, hintStage: 9 };
    app.scene = 'run';
    view.show(g, { people: [{ avatar: avatarOf(myId()), seed: 1 }], me: 0, total: 'versus' });
    stage.frame(me, { follow: followSpan(), snap: true });
    setScreen('solo');
    hideLobbyStrip(true);
    buildSoloHud();
    sfx.setMusic('play', { seed: 77 });
  }

  function buildSoloHud() {
    const r = app.run;
    clearUI();
    const root = el('section');
    root.id = 'hud';
    const clock = clockFace();
    root.appendChild(clock.root);
    const count = el('div', 'count num ink', `${carrierSvg('#e5493a')}<span class="v">0</span>`);
    root.appendChild(count);
    const keysRow = el('div', 'keys');
    keysRow.innerHTML = `<span class="k ink"><span class="cap">J</span>Treats</span><span class="k ink"><span class="cap">K</span>Clap</span>`;
    root.appendChild(keysRow);
    const head = el('div', 'headline');
    head.innerHTML = r.kind === 'level'
      ? `<div class="a">Appointment ${r.n}</div><div class="b ink">${esc(r.L.name)}</div>`
      : `<div class="a">Endless shift</div><div class="b ink">Cat Lady</div>`;
    root.appendChild(head);
    ui.appendChild(root);
    if (r.kind === 'level') clock.notches([r.L.expert / r.L.closes, r.L.par / r.L.closes]);
    app.hud = { root, clock, count, head, countV: count.querySelector('.v'), shown: -1 };
    if (!reduced()) head.animate([{ opacity: 0, transform: 'translate(-50%, -30%) scale(0.9)' }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }], { duration: 300, easing: 'ease-out' });
  }

  function setPaused(on) {
    const r = app.run;
    if (!r || r.over || r.paused === on) return;
    r.paused = on;
    const old = app.hud?.root.querySelector('.paused');
    if (old) old.remove();
    setControls(!on);
    if (!on) { app.primary = null; app.backAction = null; app.keyR = null; return; }
    const card = el('div', 'paused live');
    const stack = el('div', 'card-stack');
    stack.innerHTML = '<h2 class="ink">Paused</h2>';
    stack.append(
      button('Resume', { cls: 'red', key: 'Esc', onClick: () => setPaused(false) }),
      button('Retry', { key: 'R', onClick: () => retry() }),
      button(app.run.kind === 'level' ? 'Appointments' : 'Lobby', { onClick: () => quitRun() }),
    );
    card.appendChild(stack);
    app.hud?.root.appendChild(card);
    app.primary = () => setPaused(false);
    app.keyR = () => retry();
  }

  function retry() {
    const r = app.run;
    if (!r) return;
    sfx.tap();
    if (r.kind === 'level') startLevel(r.n, { auto: r.auto });
    else startCatLady({ auto: r.auto });
  }

  function quitRun() {
    sfx.tap();
    const r = app.run;
    app.run = null;
    view.hide();
    app.scene = null;
    if (r?.kind === 'level' && !app.net?.friendsWaiting()) showBook();
    else goHome();
  }

  function tickSolo(dt) {
    const r = app.run;
    if (!r) return;
    const g = r.g;
    const hud = app.hud;
    // the room needs me: a match starting with me in it, or friends waiting on a private server's host
    if (!r.auto && app.net && (app.net.inMatch() || app.net.friendsWaiting())) {
      const why = app.net.friendsWaiting() ? 'Friends are here' : null;
      app.run = null;
      view.hide();
      app.scene = null;
      if (app.net.inMatch()) enterMatch();
      else { showLobby(); if (why) toast(why); }
      return;
    }
    let alpha = 1;
    if (r.introT > 0) {
      r.introT -= dt;
      if (r.introT <= 0) {
        hud?.head.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' });
        r.introCat = null;
      }
    } else if (!r.paused && !r.over) {
      r.acc += Math.min(dt, 0.1);
      const mv = r.brain ? null : stick();
      while (r.acc >= STEP) {
        view.capture();
        if (r.brain) {
          const act = think(g, r.me, r.brain, STEP);
          if (act.treats) treats(g, r.me);
          if (act.clap) clap(g, r.me);
          g.started = true;
        } else {
          r.me.ix = mv.x;
          r.me.iz = mv.z;
          if (Math.hypot(mv.x, mv.z) > 0.1) g.started = true;
        }
        step(g, STEP);
        r.acc -= STEP;
        if (g.over) break;
      }
      alpha = r.acc / STEP;
    }
    r.alpha = alpha;
    // events: sounds, stamps, the counter
    for (const e of g.events) {
      if (e.seq <= view.lastSeq) continue;
      view.event(e);
      if (e.k === 'in') {
        hud?.count.classList.remove('pop');
        void hud?.count.offsetWidth;
        hud?.count.classList.add('pop');
        if (r.kind === 'catlady') flyPlus(g.carriers[0]);
      }
    }
    view.lastSeq = g.evSeq;
    // HUD
    if (hud) {
      if (r.kind === 'level') hud.clock.set(g.clock ?? 0, r.L.closes);
      else hud.clock.set(g.clock ?? 0, Math.max(60, g.clock ?? 60));
      const shown = r.kind === 'level' ? `${g.boxed}/${g.total}` : String(g.boxed);
      if (shown !== hud.shown) { hud.countV.textContent = shown; hud.shown = shown; }
      const left = g.clock ?? 99;
      sfx.setTense(left <= 30 && g.started && !g.over);
      const sec = Math.ceil(left);
      if (g.started && !g.over && sec <= 30 && sec !== r.lastTick) { r.lastTick = sec; sfx.tick(sec <= 10); }
    }
    // star drops as the hand passes par and expert
    if (r.kind === 'level' && g.started && !g.over) {
      const used = g.elapsed;
      if (!r.lostExpert && used > r.L.expert) { r.lostExpert = true; sfx.dull(); }
      if (!r.lostPar && used > r.L.par) { r.lostPar = true; sfx.dull(); }
    }
    // hints and the new cat's tag
    soloHints(r);
    // camera
    const focus = r.introCat && r.introT > 0 ? r.introCat : r.me;
    stage.frame(focus, { follow: followSpan(), zoom: r.introCat && r.introT > 0 ? 0.8 : 1 });
    // done
    if (g.over && !r.over) {
      r.over = true;
      r.overT = 0;
      if (g.result?.allIn) sfx.allIn(); else { sfx.missed(); sfx.chime(); }
      sfx.setTense(false);
      setControls(false);
    }
    if (r.over) {
      r.overT += dt;
      if (r.overT > 1.3 && !r.shown) { r.shown = true; showSoloResult(); }
    }
  }

  function flyPlus(k) {
    const hud = app.hud;
    if (!hud || !k) return;
    const from = stage.toScreen(k.x, 1.4, k.z);
    const to = hud.clock.root.getBoundingClientRect();
    const p = el('div', 'plus ink', `+${Math.round(app.run.g.bonus + 0.08)}`);
    hud.root.appendChild(p);
    p.style.left = `${from.x}px`;
    p.style.top = `${from.y}px`;
    const dx = to.left + to.width / 2 - from.x;
    const dy = to.top + to.height / 2 - from.y;
    const a = p.animate([{ transform: 'translate(-50%, -50%) scale(1)' }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.6)`, opacity: 0.6 }], { duration: reduced() ? 1 : 700, easing: 'cubic-bezier(.5,0,.8,.6)' });
    a.onfinish = () => p.remove();
  }

  const done = (k) => save.progress.hints[k];
  function markHint(k) {
    if (save.progress.hints[k]) return;
    save.progress.hints[k] = true;
    save.persist();
  }

  function soloHints(r) {
    const g = r.g;
    if (r.introT > 0 && r.introCat) {
      const info = INTROS[r.introCat.type];
      if (info) tag('intro', `<span class="big">${esc(info.name)}</span><span style="color:#f6b941">${esc(info.tip)}</span>`, r.introCat.x, 1.4 + (r.introCat.y || 0), r.introCat.z, 'float big ink');
      return;
    }
    if (r.auto || r.over || r.kind !== 'level') { view.hints.hideFeet(); return; }
    const L = r.L;
    // 1: stand behind the nearest cat, then push it in
    if (L.hint === 'push' && !done('push')) {
      const k = g.carriers[0];
      const cs = loose(g).filter((c) => c.st !== S.hidden && c.st !== S.perch);
      let best = null;
      let bd = Infinity;
      for (const c of cs) { const d = Math.hypot(c.x - r.me.x, c.z - r.me.z); if (d < bd) { bd = d; best = c; } }
      if (best && g.boxed === 0) {
        const dx = best.x - k.matX;
        const dz = best.z - k.matZ;
        const l = Math.hypot(dx, dz) || 1;
        const fx = best.x + (dx / l) * 1.8;
        const fz = best.z + (dz / l) * 1.8;
        const near = Math.hypot(r.me.x - fx, r.me.z - fz) < 1.1;
        if (near) r.hintStage = 1;
        if (r.hintStage === 0) {
          view.hints.showFeet(fx, fz, Math.atan2(-dz, -dx));
          tag('hint', 'Stand behind it', best.x, 1.1, best.z, 'float ink');
        } else {
          view.hints.hideFeet();
          tag('hint', 'Push it in', best.x, 1.1, best.z, 'float ink');
        }
      } else {
        view.hints.hideFeet();
        if (g.boxed > 0) markHint('push');
      }
      return;
    }
    view.hints.hideFeet();
    if (L.hint === 'treats' && !done('treats')) {
      const c = g.cats.find((x) => x.st === S.perch) ?? loose(g)[0];
      if (r.usedTreats) markHint('treats');
      else if (c) tag('hint', `Shake treats <span class="cap">J</span>`, c.x, 1.3 + (c.y || 0), c.z, 'float ink');
      return;
    }
    if (L.hint === 'clap' && !done('clap')) {
      const c = g.cats.find((x) => x.type === 'loaf' && x.st !== S.boxed && x.st !== S.enter);
      if (r.usedClap) markHint('clap');
      else if (c) tag('hint', `Clap to move it <span class="cap">K</span>`, c.x, 1.0, c.z, 'float ink');
    }
  }

  function showSoloResult() {
    const r = app.run;
    const g = r.g;
    const root = app.hud.root;
    root.querySelector('.keys')?.remove();
    const card = el('div', 'result live');
    if (r.kind === 'level') {
      const L = r.L;
      const res = g.result ?? { allIn: false, time: g.elapsed };
      const outcome = r.auto ? { stars: save.starsFor(L, res.allIn, res.time), newBest: false, prevBest: null } : save.finishLevel(L, { allIn: res.allIn, time: res.time, boxed: g.boxed, stats: g.stats });
      const best = save.progress.levels[L.n]?.best;
      card.innerHTML = `<h2>${res.allIn ? 'All in!' : 'Missed appointment'}</h2>
        <div class="stars"></div>
        <div class="line"><span>${res.allIn ? 'Time' : 'Cats left'}</span><span class="num">${res.allIn ? fmtTime(res.time) : `${g.total - g.boxed}`}</span></div>
        <div class="line"><span>Par ${fmt(L.par)} · Expert ${fmt(L.expert)}</span><span>Best <span class="num">${best ? fmtTime(best) : '-'}</span></span></div>
        <div class="tops"></div>
        <div class="acts"></div>`;
      const starsEl = card.querySelector('.stars');
      for (let i = 0; i < 3; i++) {
        const s = el('span', '', star(false, 64));
        starsEl.appendChild(s);
        if (i < outcome.stars) {
          setTimeout(() => {
            s.innerHTML = star(true, 64);
            if (!reduced()) s.animate([{ transform: 'translateY(-40px) scale(1.4)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.3,1.6,.6,1)' });
            sfx.star(i);
          }, 350 + i * 330);
        }
      }
      if (outcome.newBest && outcome.prevBest != null) card.insertAdjacentHTML('beforeend', '<div class="stamp gold best">New best</div>');
      const acts = card.querySelector('.acts');
      const hasNext = res.allIn && L.n < LEVELS.length;
      if (hasNext) {
        acts.append(button('Next', { cls: 'red', key: 'Enter', onClick: () => startLevel(L.n + 1) }), button('Retry', { key: 'R', onClick: () => retry() }));
        app.primary = () => startLevel(L.n + 1);
      } else {
        acts.append(button('Retry', { cls: 'red', key: 'Enter', onClick: () => retry() }));
        app.primary = () => retry();
      }
      acts.append(button('Book', { key: 'Esc', onClick: () => quitRun() }));
      app.keyR = () => retry();
      app.backAction = () => quitRun();
      if (res.allIn) loadTops(card.querySelector('.tops'), `appt-${String(L.n).padStart(2, '0')}`, true);
    } else {
      const out = r.auto ? { best: g.boxed, newBest: false } : save.finishCatLady(g.boxed, g.stats);
      card.innerHTML = `<h2>Shift over</h2>
        <div class="line"><span>Cats boxed</span><span class="num" style="font-size:56px">${g.boxed}</span></div>
        <div class="line"><span>Shift</span><span class="num">${fmtTime(g.elapsed)}</span></div>
        <div class="line"><span>Best</span><span class="num">${out.best}</span></div>
        <div class="tops"></div><div class="acts"></div>`;
      if (out.newBest && g.boxed > 0) card.insertAdjacentHTML('beforeend', '<div class="stamp gold best">New best</div>');
      card.querySelector('.acts').append(button('Retry', { cls: 'red', key: 'Enter', onClick: () => retry() }), button(app.net ? 'Lobby' : 'Title', { key: 'Esc', onClick: () => quitRun() }));
      app.primary = () => retry();
      app.keyR = () => retry();
      app.backAction = () => quitRun();
      loadTops(card.querySelector('.tops'), 'cat-lady', false);
    }
    root.appendChild(card);
    if (!reduced()) card.animate([{ transform: 'translate(-50%, 120%)' }, { transform: 'translate(-50%, 0)' }], { duration: 380, easing: 'cubic-bezier(.2,1.2,.4,1)' });
  }

  async function loadTops(box, board, time) {
    if (!box || !ow?.leaderboards?.top) return;
    try {
      const res = await ow.leaderboards.top(board, { limit: 5 });
      const list = Array.isArray(res?.entries) ? res.entries.slice(0, 5) : [];
      if (!list.length || !box.isConnected) return;
      box.innerHTML = list.map((e, i) => {
        const v = Number(e?.score);
        return `<span class="num">${i + 1}</span><span>${esc(String(e?.player?.name ?? 'Player').slice(0, 24))}</span><span class="num">${Number.isFinite(v) ? (time ? fmtTime(v) : v) : ''}</span>`;
      }).join('');
    } catch { /* offline, a guest */ }
  }

  // ------------------------------------------------------------------ matches
  function seatLooks(s) {
    return s.data.seats.map((_, i) => SEATS[i]);
  }

  function seatName(id) {
    const m = app.net?.match;
    const seat = m?.seats.find((x) => x.id === id);
    if (seat) return seat.name;
    const loc = app.local?.names?.[id];
    return loc ?? 'Player';
  }

  /** The source of the round on screen: the room's match, or a local practice round (autoplay). */
  function matchSource() {
    if (app.local) return app.local;
    const n = app.net;
    if (!n) return null;
    const m = n.match;
    return {
      phase: m.phase, session: n.session, round: m.round, rounds: m.rounds, secondsLeft: m.secondsLeft, countdown: m.countdown,
      standings: m.standings, results: m.results, last: m.last, me: m.me, isHost: m.isHost, kind: n.room.kind,
      alpha: () => n.alpha(), paused: m.paused,
    };
  }

  function enterMatch() {
    if (app.screen !== 'match') {
      clearUI();
      setScreen('match');
      hideLobbyStrip(false);
      app.mv = { key: null, phase: null, hud: null };
    }
  }

  function tickMatch(dt) {
    const src = matchSource();
    if (!src) return;
    const mv = app.mv ?? (app.mv = { key: null, phase: null });
    const s = src.session;
    // countdown: the waiting room stays, our own 3-2-1 over it
    if (src.phase === 'countdown') {
      if (app.scene !== 'waiting') { leaveScene(); startWaiting(); }
      tickWaiting(dt);
      if (mv.phase !== 'countdown') { clearUI(); mv.phase = 'countdown'; mv.cd = el('div', 'countdown num ink'); ui.appendChild(mv.cd); mv.lastN = null; sfx.setMusic('menu'); }
      const nleft = Math.max(1, Math.ceil(src.countdown ?? 3));
      if (nleft !== mv.lastN) {
        mv.lastN = nleft;
        mv.cd.textContent = String(nleft);
        sfx.count(1);
        if (!reduced()) mv.cd.animate([{ transform: 'translate(-50%, -50%) scale(1.5)', opacity: 0.3 }, { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }], { duration: 300, easing: 'ease-out' });
      }
      return;
    }
    if (src.phase === 'results') { tickResults(src, dt); return; }
    if (!s) {
      // waiting for the round's data
      if (app.scene !== 'waiting' && app.scene !== 'match') { leaveScene(); startWaiting(); }
      if (app.scene === 'waiting') tickWaiting(dt);
      return;
    }
    if (mv.key !== s.roundId || app.matchSession !== s) {
      mv.key = s.roundId;
      app.matchSession = s;
      leaveScene();
      app.scene = 'match';
      const looks = seatLooks(s);
      const together = s.data.mode === 'together';
      view.show(s.g, {
        looks: together ? [] : looks,
        people: s.data.seats.map((id, i) => ({ avatar: id.startsWith('bot:') ? null : avatarOf(id), seed: hashId(id), look: looks[i] })),
        me: s.me ? s.data.seats.indexOf(s.me) : -1, total: together ? 'together' : 'versus',
      });
      stage.frame(null, { snap: true, zoom: 1.05 });
      buildMatchHud(s, src);
      mv.phase = null;
      setControls(!!s.me);
      app.watching = !s.me;
      layout();
      sfx.setMusic('play', { seed: s.data.seed });
    }
    if (app.peopleDirty) {
      app.peopleDirty = false;
      const looks = seatLooks(s);
      view.setPeople(s.data.seats.map((id, i) => ({ avatar: id.startsWith('bot:') ? null : avatarOf(id), seed: hashId(id), look: looks[i] })), s.me ? s.data.seats.indexOf(s.me) : -1);
    }
    if (mv.phase !== src.phase) {
      const prev = mv.phase;
      mv.phase = src.phase;
      flow(src.phase === 'round' ? 'play' : src.phase === 'intro' ? 'countdown' : src.phase);
      onMatchPhase(src, s, prev);
    }
    // events from the host (clients) or this page's simulation (host, local)
    // a client plays only its own presses from here; the host's stream brings the rest (see attachNet)
    const mySlot = s.me ? s.data.seats.indexOf(s.me) : -2;
    for (const e of s.g.events) {
      if (e.seq <= view.lastSeq) continue;
      if (s.host || ((e.k === 'treats' || e.k === 'clap') && e.p === mySlot)) view.event(e);
    }
    view.lastSeq = s.g.evSeq;
    updateMatchHud(src, s, dt);
    // camera: me, or the leader when watching
    let focus = s.people.get(s.me);
    if (!focus || src.phase === 'roundEnd' || src.phase === 'intro') {
      if (src.phase === 'intro' && s.people.get(s.me) && (src.secondsLeft ?? 3) < 2.2) focus = s.people.get(s.me);
      else if (src.phase === 'roundEnd' || src.phase === 'intro') focus = null;
      else focus = leaderPerson(s);
    }
    const span = matchFollow();
    stage.frame(focus, focus ? { follow: span } : { zoom: 1.02 });
  }

  function matchFollow() {
    const short = Math.min(innerWidth, innerHeight);
    return short / (app.touch ? 34 : 29);
  }

  function leaderPerson(s) {
    let best = null;
    let bc = -1;
    s.data.seats.forEach((id, i) => {
      const p = s.people.get(id);
      const c = s.data.mode === 'versus' ? s.g.carriers[i]?.count ?? 0 : 0;
      if (p && p.active && c > bc) { bc = c; best = p; }
    });
    return best;
  }

  function buildMatchHud(s, src) {
    clearUI();
    const root = el('section');
    root.id = 'hud';
    const clock = clockFace();
    root.appendChild(clock.root);
    const together = s.data.mode === 'together';
    if (together) {
      const total = ROUND.together;
      clock.notches(ROUND.togetherStars.map((left) => 1 - left / total).sort());
    }
    const board = el('div', 'board');
    root.appendChild(board);
    const keysRow = el('div', 'keys');
    if (s.me) keysRow.innerHTML = `<span class="k ink"><span class="cap">J</span>Treats</span><span class="k ink"><span class="cap">K</span>Clap</span>`;
    root.appendChild(keysRow);
    ui.appendChild(root);
    app.hud = { root, clock, board, boardKey: '', head: null };
    app.backAction = null;
  }

  function updateMatchHud(src, s, dt) {
    const hud = app.hud;
    if (!hud) return;
    const g = s.g;
    hud.clock.set(g.clock ?? 0, g.clockMax ?? ROUND.versus);
    const left = g.clock ?? 99;
    if (src.phase === 'round') {
      sfx.setTense(left <= 30);
      const sec = Math.ceil(left);
      if (sec <= 30 && sec !== hud.lastTick && !g.over) { hud.lastTick = sec; sfx.tick(sec <= 10); }
    }
    // the scoreboard: every carrier's count, huge for mine, in its owner's colour and symbol
    const together = s.data.mode === 'together';
    let key;
    if (together) {
      key = `t|${g.carriers[0].count}|${g.total}`;
      if (key !== hud.boardKey) {
        hud.boardKey = key;
        hud.board.innerHTML = `<div class="seat mine num ink">${carrierSvg('#e5493a')}<span>${g.carriers[0].count}/${g.total}</span></div>`;
      }
    } else {
      const counts = s.data.seats.map((_, i) => g.carriers[i]?.count ?? 0);
      const top = Math.max(...counts);
      const mineI = s.me ? s.data.seats.indexOf(s.me) : -1;
      key = `v|${counts.join(',')}|${mineI}|${s.left.size}`;
      if (key !== hud.boardKey) {
        const prev = hud.counts ?? [];
        hud.boardKey = key;
        hud.counts = counts;
        const order = s.data.seats.map((id, i) => i).sort((a, b) => (a === mineI ? -1 : b === mineI ? 1 : counts[b] - counts[a] || a - b));
        hud.board.innerHTML = order.map((i) => {
          const look = SEATS[i];
          const lead = top > 0 && counts[i] === top ? rosette() : '';
          const gone = s.left.has(s.data.seats[i]);
          return `<div class="seat num ink${i === mineI ? ' mine' : ''}${gone ? ' gone' : ''}" data-i="${i}" style="color:${look.color}">${lead}${symbolSvg(look.symbol, look.color, '#2b1d1c', i === mineI ? 52 : 30)}<span>${counts[i]}</span></div>`;
        }).join('');
        counts.forEach((c, i) => {
          if (c > (prev[i] ?? 0) && !reduced()) hud.board.querySelector(`[data-i="${i}"]`)?.animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out' });
        });
      }
    }
    // names over heads (not mine: my ring says where I am)
    s.data.seats.forEach((id, i) => {
      const p = s.people.get(id);
      if (!p || !p.active || id === s.me) return;
      const q = view.drawn?.[i] ?? p;
      tag(`nm:${id}`, `${symbolSvg(SEATS[i].symbol, SEATS[i].color, '#2b1d1c', 20)}<span>${esc(seatName(id))}</span>`, q.x, 1.62, q.z, 'tag ink');
    });
    if (src.phase === 'intro' && s.me) {
      const i = s.data.seats.indexOf(s.me);
      const k = g.carriers[together ? 0 : i];
      if (k) tag('yours', together ? 'Your carrier' : 'Your carrier', k.x, 2.45, k.z, 'float big ink');
    }
    if (src.phase === 'intro' && hud.head) {
      const n = Math.ceil(src.secondsLeft ?? 0);
      if (n !== hud.introN && n > 0 && n <= 3) { hud.introN = n; sfx.tick(true); }
    }
  }

  function onMatchPhase(src, s, prev) {
    const hud = app.hud;
    if (!hud) return;
    hud.head?.remove();
    hud.head = null;
    if (src.phase === 'intro') {
      const name = s.g.room.name;
      const head = el('div', 'headline');
      head.innerHTML = `<div class="a">Round ${src.round}${src.rounds ? ` of ${src.rounds}` : ''}</div><div class="b ink">${esc(name)}</div>`;
      hud.root.appendChild(head);
      hud.head = head;
      if (!reduced()) head.animate([{ opacity: 0, transform: 'translate(-50%, -30%)' }, { opacity: 1, transform: 'translate(-50%, -50%)' }], { duration: 300 });
    } else if (src.phase === 'round') {
      if (prev === 'intro' || prev == null) sfx.roundStart();
    } else if (src.phase === 'roundEnd') {
      setControls(false);
      sfx.setTense(false);
      const g = s.g;
      const head = el('div', 'headline');
      if (s.data.mode === 'together') {
        const left = Math.max(0, g.clock ?? 0);
        const all = g.carriers[0].count >= g.total;
        const n = !all ? 0 : left >= ROUND.togetherStars[1] ? 3 : left >= ROUND.togetherStars[0] ? 2 : 1;
        head.innerHTML = `<div class="a">${all ? `${fmt(left)} left` : `${g.total - g.carriers[0].count} cats left`}</div><div class="b ink">${all ? 'All in!' : 'Time!'}</div><div style="margin-top:8px">${stars(n, 54)}</div>`;
        if (all) sfx.allIn(); else sfx.missed();
      } else {
        const counts = s.data.seats.map((_, i) => g.carriers[i]?.count ?? 0);
        const top = Math.max(...counts);
        const winners = s.data.seats.filter((_, i) => counts[i] === top && top > 0);
        const mine = s.me && winners.includes(s.me);
        const who = winners.length === 1 ? (winners[0] === s.me ? 'You win' : `${esc(seatName(winners[0]))} wins`) : winners.length ? 'A tie' : 'No cats';
        head.innerHTML = `<div class="a">${top} cat${top === 1 ? '' : 's'}</div><div class="b ink">${who}</div>`;
        if (mine) sfx.allIn(); else sfx.chime();
        const wi = s.data.seats.indexOf(winners[0]);
        if (winners.length === 1 && g.carriers[wi]) onStamp('in', g.carriers[wi].x, 1.4, g.carriers[wi].z);
      }
      hud.root.appendChild(head);
      hud.head = head;
      if (!reduced()) head.animate([{ transform: 'translate(-50%, -50%) scale(1.6)', opacity: 0 }, { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.3,1.5,.6,1)' });
    }
  }

  function tickResults(src, dt) {
    const mv = app.mv;
    const s = app.matchSession;
    if (s && app.scene === 'match') {
      // the last round's room stays behind the standings
      view.lastSeq = s.g.evSeq;
      stage.frame(null, { zoom: 1.05 });
    } else if (app.scene !== 'waiting') { leaveScene(); startWaiting(); }
    if (app.scene === 'waiting') tickWaiting(dt);
    if (mv.phase === 'results') {
      if (mv.ring && src.kind === 'public') {
        const left = Math.max(0, 25 - (performance.now() - mv.resAt) / 1000);
        mv.ring.textContent = `Lobby in ${Math.ceil(left)}`;
      }
      return;
    }
    mv.phase = 'results';
    mv.resAt = performance.now();
    clearUI();
    setControls(false);
    const list = src.results ?? src.standings ?? [];
    const pod = el('div', 'podium');
    const myId2 = src.me?.id;
    list.slice(0, 6).forEach((st, idx) => {
      const i = s ? s.data.seats.indexOf(st.id) : idx;
      const look = SEATS[i >= 0 ? i : idx % 6];
      const row = el('div', `standing${st.place === 1 ? ' first' : ''}${st.id === myId2 ? ' mine' : ''}`);
      row.innerHTML = `<span class="pl">${st.place}</span>${symbolSvg(look.symbol, look.color, '#2b1d1c', 32)}<span class="nm">${esc(st.name)}</span><span class="pts">${st.points}</span>`;
      pod.appendChild(row);
      if (!reduced()) row.animate([{ transform: 'translateY(30px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, delay: idx * 90, fill: 'backwards' });
    });
    const win = list.find((x) => x.place === 1);
    if (win) {
      const head = el('div', 'headline');
      head.style.top = 'calc(var(--ct) + 40px)';
      head.innerHTML = `<div class="b ink">${win.id === myId2 ? 'Best in Show!' : `${esc(win.name)}: Best in Show`}</div>`;
      pod.prepend(head);
      head.style.position = 'static';
      head.style.transform = 'none';
    }
    const acts = el('div', 'acts');
    if (src.isHost && src.kind !== 'public' && !app.local) {
      acts.appendChild(button('Lobby', { cls: 'red live', key: 'Enter', onClick: () => app.net?.endMatch() }));
      app.primary = () => app.net?.endMatch();
    } else if (src.kind === 'public') {
      mv.ring = el('div', 'note ink', 'Lobby in 25');
      acts.appendChild(mv.ring);
    } else {
      acts.appendChild(el('div', 'note ink', 'The host picks what\'s next'));
    }
    pod.appendChild(acts);
    ui.appendChild(pod);
    sfx.fanfare();
    if (s && win) view.hints.confetti(s.g.world.w / 2, s.g.world.d / 2, ['#e5493a', '#f6b941', '#fff3df', '#3f7fcb']);
  }

  // ------------------------------------------------------------------ a toast for a short note
  function toast(text) {
    const t = el('div', 'headline');
    t.style.top = '18%';
    t.innerHTML = `<div class="b ink" style="font-size:34px">${esc(text)}</div>`;
    ui.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  // ------------------------------------------------------------------ room closed
  function showClosed(reason) {
    if (reason === 'left' || reason === 'moved') return;
    app.closedReason = reason;
    app.run = null;
    view.hide();
    leaveScene();
    clearUI();
    setScreen('closed');
    const msg = reason === 'kicked' ? 'You were removed' : reason === 'replaced' ? 'Playing in another tab' : 'Connection lost';
    const label = reason === 'kicked' ? 'Play' : reason === 'replaced' ? 'Play here' : 'Rejoin';
    const box = el('div', 'closed live');
    const stack = el('div', 'card-stack');
    stack.innerHTML = `<h2 class="ink">${esc(msg)}</h2>`;
    stack.appendChild(button(label, { cls: 'red big', key: 'Enter', onClick: () => rejoin() }));
    box.appendChild(stack);
    ui.appendChild(box);
    app.primary = () => rejoin();
  }

  async function rejoin() {
    sfx.tap();
    try { app.net?.match?.dispose(); app.net?.bots?.dispose(); } catch { /* ignore */ }
    app.net = null;
    clearUI();
    const room = await Promise.resolve().then(() => ow?.rooms?.join(JOIN)).catch(() => null);
    if (room) attachNet(room);
    showTitle();
  }

  // ------------------------------------------------------------------ the net
  function attachNet(room) {
    app.net = createNet(room, {
      press: (kind, p) => view.event({ k: kind, x: p.x, z: p.z }),
      snapshot: ({ fresh }) => {
        const s = app.net.session;
        view.invalidate();
        for (const e of fresh) {
          if (e.k === 'treats' || e.k === 'clap') {
            const id = s?.data.seats[e.c];
            if (!id || !s.bots.has(id)) continue; // people's presses play from their presence
          }
          view.event(e);
        }
      },
      results: (standings, mine) => {
        if (!mine) return;
        const s = app.matchSession;
        save.finishMatch({ won: mine.place === 1 && standings.length > 1, boxed: s?.data.mode === 'versus' ? mine.points : 0 });
      },
      close: (reason) => showClosed(reason),
      starting: () => {},
    });
    app.net.rank = Math.min(3, Math.floor(save.totalStars() / 15) + (save.progress.wins > 2 ? 1 : 0));
    app.net.before = () => view.capture();
    room.on?.('join', () => { app.peopleDirty = true; });
    room.on?.('leave', () => { app.peopleDirty = true; });
    room.on?.('rename', () => { app.peopleDirty = true; });
  }

  // ------------------------------------------------------------------ the loop
  let last = performance.now();
  let touchCheck = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    app.t += dt;
    touchCheck -= dt;
    if (touchCheck <= 0) {
      touchCheck = 0.5;
      layout(); // the platform's areas can move without an event (a rotation): cheap to read again
      const touch = !!ow?.controls?.touch || matchMedia('(pointer: coarse)').matches;
      if (touch !== app.touch) { app.touch = touch; document.body.classList.toggle('touch', touch); }
    }
    const n = app.net;
    // the match decides the screen while one runs
    if (n && app.screen !== 'closed' && !app.local) {
      const ph = n.phase();
      // players in the match go to it from anywhere (a solo run ends itself); watchers only from the waiting room
      const want = n.inMatch() ? app.screen !== 'solo' : app.screen === 'lobby' && (!!n.session || ph === 'results');
      if (ph !== 'lobby' && app.screen !== 'match' && want) {
        if (app.run) { app.run = null; view.hide(); app.scene = null; }
        enterMatch();
      } else if (ph === 'lobby' && app.screen === 'match') {
        app.matchSession = null;
        app.watching = false;
        layout();
        leaveScene();
        showLobby();
      }
      const mv = app.screen === 'match' && n.session?.people.get(n.session.me) ? stick() : { x: 0, z: 0 };
      n.frame(dt, mv);
    }
    let alpha = 1;
    let me = null;
    let offsets = null;
    let away = null;
    switch (app.screen) {
      case 'title': case 'book':
        if (app.scene === 'attract') { tickAttract(dt); alpha = app.attract.acc / STEP; }
        else if (app.scene === 'waiting') { tickWaiting(dt); alpha = app.waiting.acc / STEP; }
        break;
      case 'lobby':
        tickWaiting(dt);
        alpha = app.waiting ? app.waiting.acc / STEP : 1;
        break;
      case 'solo':
        tickSolo(dt);
        alpha = app.run?.alpha ?? 1;
        me = app.run?.me ?? null;
        break;
      case 'match': {
        if (app.local) tickLocal(dt);
        tickMatch(dt);
        const s = app.local ? app.local.session : n?.session;
        if (s && app.scene === 'match') {
          alpha = app.local ? stepAlpha(s, null) : n.alpha();
          me = s.people.get(s.me) ?? null;
          offsets = s.offsets;
          away = new Set();
          const m = n?.match;
          if (m) s.data.seats.forEach((id, i) => { const seat = m.seats.find((x) => x.id === id); if (seat?.away) away.add(i); });
        }
        break;
      }
      default: break;
    }
    if (view.g) view.update(dt, app.t, { alpha, me, offsets, away, reducedMotion: reduced() });
    stage.update(dt);
    stage.render();
    tagsDone();
  }

  // ------------------------------------------------------------------ autoplay (trailer takes, never on onceworlds.com)
  function tickLocal(dt) {
    const L = app.local;
    if (!L) return;
    L.t += dt;
    if (L.phase === 'intro' && L.t > 3) { L.phase = 'round'; L.t = 0; }
    if (L.phase === 'round') {
      const s = L.session;
      const p = s.people.get(s.me);
      if (p && L.brain) {
        L.acc += dt;
        while (L.acc >= STEP) {
          const act = think(s.g, p, L.brain, STEP);
          if (act.treats) treats(s.g, p);
          if (act.clap) clap(s.g, p);
          L.acc -= STEP;
        }
      }
      advanceSession(s, dt, (L.clockT += dt), () => view.capture());
      if (s.g.over) { L.phase = 'roundEnd'; L.t = 0; }
    }
    L.secondsLeft = L.phase === 'intro' ? 3 - L.t : null;
  }

  function startLocalMatch(mode = 'versus') {
    const seats = ['me', 'bot:1', 'bot:2', 'bot:3'];
    const data = makeRoundData({ seed: 7, round: 3, mode, seats, skills: [1, 0.75, 0.65, 0.7] });
    const s = createSession({ data, me: 'me', host: true, bots: seats.slice(1), roundId: 'local' });
    app.local = {
      phase: 'intro', session: s, round: 3, rounds: 3, secondsLeft: 3, countdown: null, standings: [], results: null, me: { id: 'me' },
      isHost: true, kind: 'public', t: 0, acc: 0, clockT: 0, brain: createBrain({ skill: 1, seed: 3 }),
      names: { me: 'Mo', 'bot:1': 'Priya', 'bot:2': 'Otis', 'bot:3': 'Bea' }, alpha: () => stepAlpha(s, null),
    };
    enterMatch();
  }

  // ------------------------------------------------------------------ go
  requestAnimationFrame(frame);
  if (AUTOPLAY) {
    await loading;
    sfx.unlock();
    const sc = params.get('scene') ?? 'versus';
    if (sc === 'title') showTitle();
    else if (sc === 'catlady') startCatLady({ auto: true });
    else if (sc === 'versus') startLocalMatch('versus');
    else if (sc === 'together') startLocalMatch('together');
    else startLevel(Math.max(1, Math.min(15, Number(params.get('n')) || 1)), { auto: true });
  } else {
    showTitle();
    await loading;
    if (app.screen === 'title') showTitle();
    const room = await joining;
    if (room) {
      attachNet(room);
      if (app.screen === 'title') showTitle();
      if (AUTOPLAY_TO === 'lobby') showLobby();
    }
  }
}

function hashId(id) {
  let h = 2166136261;
  for (let i = 0; i < String(id).length; i++) h = Math.imul(h ^ String(id).charCodeAt(i), 16777619);
  return h >>> 0;
}
