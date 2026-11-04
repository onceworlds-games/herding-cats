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
// ?autoplay: the trailer's takes and the tools' pictures play by themselves (never on onceworlds.com)
const AUTOPLAY = params.has('autoplay') && !/onceworlds\.com$/.test(location.hostname);
// a take's camera: about this many units across the short side, following the herder (autoplay only)
const TAKE_SPAN = AUTOPLAY ? Math.max(0, Math.min(30, Number(params.get('zoom')) || 0)) : 0;
const ow = POSTER ? null : window.onceworlds ?? null;
// join first (join.js already started it as the page loaded), so a reload keeps its seat
const joining = joinOnce();

import * as THREE from 'three';
import { createStage, screenToWorld } from './render/stage.js';
import { loadAssets } from './render/assets.js';
import { createView } from './render/view.js';
import { makeCarrier } from './render/carriers.js';
import { createGame, addPerson, step, treats, clap, loose } from './sim/game.js';
import { createBrain, think } from './sim/brain.js';
import { levelSetup, LEVELS, INTROS, TWIST_INTROS, catladySetup } from './sim/levels.js';
import { ROOMS } from './sim/rooms.js';
import { STEP, S, CATLADY, ROUND, SEATS, COMBO } from './sim/tuning.js';
import { soonIn } from './sim/motion.js';
import { createSession, makeRoundData, advance as advanceSession, stepAlpha } from './net/session.js';
import * as sfx from './audio.js';
import * as save from './save.js';
import { $ui, el, esc, button, star, stars, carrierSvg, rosette, clockFace, fmt, fmtTime, stampAt } from './ui/ui.js';
import { symbolSvg } from './ui/symbols.js';
import { icon } from './ui/icons.js';
import { herderCard, goalsBox, dailyTicket, bookGrid, wardrobePanel, catalogPanel, challengeChip, catPicture, itemPicture, sockets } from './ui/screens.js';
import { resultPanel } from './ui/results.js';
import { dailySetup } from './sim/daily.js';
import { liveState, passed, CHALLENGES } from './meta/challenges.js';
import { ITEM, itemAt, LEVEL_ITEMS } from './meta/herder.js';
import { PAGES, pageState } from './meta/catalog.js';
import { STAR } from './meta/progress.js';
import { COAT_INFO } from './sim/coats.js';

if (POSTER?.startsWith('sheet')) {
  import('./sheets.js').then((m) => m.runSheet(params)).catch((e) => { console.error(e); document.body.dataset.ready = '1'; });
} else if (POSTER === 'kit') {
  import('./studio.js').then((m) => m.runKit(params));
} else if (POSTER === 'studio') {
  import('./studio.js').then((m) => m.runStudio(params)).catch((e) => { console.error(e); document.body.dataset.ready = '1'; });
} else if (POSTER) {
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
    let menuEdge = 0; // how far right the top-left menu reaches
    if (Array.isArray(r)) {
      lt = 12;
      lb = 16;
      for (const a of r) {
        if (!a || !Number.isFinite(a.y)) continue;
        if (a.kind === 'menu') {
          if (a.x < W / 2 && a.y < H / 2) { lt = Math.max(lt, a.y + a.h + 8); menuEdge = Math.max(menuEdge, a.x + a.w); }
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
    // the clock sits top centre, or under the menu when a narrow screen puts them side by side
    const ct = menuEdge > W / 2 - 112 ? lt : 12;
    root.setProperty('--ct', `${ct + (app.watching ? 40 : 0)}px`);
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
    // Enter is the platform's Ready key while the lobby is up (it is up on every screen but the room-closed one and a match).
    if ((k === 'enter' && app.screen === 'closed') || (k === ' ' && (app.screen !== 'solo' || app.run?.over))) {
      const a = document.activeElement;
      if (a && a.tagName === 'BUTTON') return;
      if (app.primary) { e.preventDefault(); app.primary(); }
    }
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());
  addEventListener('pointerdown', () => sfx.unlock(), { capture: true });
  addEventListener('keydown', () => sfx.unlock(), { capture: true });

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

  // ------------------------------------------------------------------ edge arrows: my carrier and the last cats, when off screen
  const arrowPool = new Map();
  let arrowSeen = new Set();
  function edgeArrow(id, x, y, z, color, sym) {
    const p = stage.toScreen(x, y, z);
    const W = innerWidth;
    const H = innerHeight;
    const side = 34;
    const top = 92;
    const bottom = app.touch ? 150 : 56;
    if (p.x > 6 && p.x < W - 6 && p.y > 6 && p.y < H - 6) return; // on screen: no arrow
    let a = arrowPool.get(id);
    if (!a) {
      a = el('div', 'edge', '<i></i><b></b>');
      tags.appendChild(a);
      arrowPool.set(id, a);
      a._k = '';
    }
    const k = `${color}|${sym}`;
    if (a._k !== k) {
      a._k = k;
      a.firstChild.style.background = color;
      a.lastChild.innerHTML = sym === 'carrier' ? carrierSvg(color) : symbolSvg(sym, '#fff3df', '#2b1d1c', 22);
    }
    // from the middle of the safe box toward the target, stopped at its edge
    const x0 = side;
    const x1 = W - side;
    const y0 = top;
    const y1 = H - bottom;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const dx = p.x - cx;
    const dy = p.y - cy;
    const f = Math.min((x1 - cx) / Math.max(1e-3, Math.abs(dx)), (y1 - cy) / Math.max(1e-3, Math.abs(dy)), 1);
    a.style.transform = `translate(${(cx + dx * f).toFixed(1)}px, ${(cy + dy * f).toFixed(1)}px) translate(-50%, -50%)`;
    a.firstChild.style.transform = `rotate(${(Math.atan2(dy, dx) - Math.PI * 0.75).toFixed(3)}rad)`;
    arrowSeen.add(id);
  }
  function arrowsDone() {
    for (const [id, a] of arrowPool) {
      if (!arrowSeen.has(id)) { a.remove(); arrowPool.delete(id); }
    }
    arrowSeen = new Set();
  }
  /** Arrows to the carrier I fill and, once three or fewer are loose, to the last cats. */
  function pointers(g, k, color, sym) {
    if (k) edgeArrow('k', k.x, 0.5, k.z, color, sym);
    const left = loose(g);
    if (left.length <= 3) for (const c of left) edgeArrow(`c${c.id}`, c.x, 0.3 + (c.y || 0), c.z, '#f6b941', 'paw');
  }

  // ------------------------------------------------------------------ stamps
  const stampLayer = el('div');
  stampLayer.style.cssText = 'position:fixed;inset:0;pointer-events:none';
  // under the screens, so a panel always covers the stamps of the scene behind it
  ui.before(stampLayer);
  const TRICK_WORDS = { bank: 'Bank shot', chain: 'Chain', laser: 'Laser', ride: 'Special delivery', box: 'Special delivery' };
  function onStamp(kind, x, y, z, info = {}) {
    // the attract scene behind the book and the Cat-alog plays on without stamps
    if (app.screen === 'book' || app.screen === 'catalog') return;
    const p = stage.toScreen(x, y, z);
    // keep stamps on screen when what they're about is near an edge
    const mx = kind === 'combo' ? 190 : 110;
    p.x = Math.max(mx, Math.min(innerWidth - mx, p.x));
    p.y = Math.max(kind === 'combo' ? 150 : 90, Math.min(innerHeight - 80, p.y));
    const rm = reduced();
    switch (kind) {
      case 'in':
        stampAt(stampLayer, 'IN', p.x, p.y - 30, { reducedMotion: rm });
        sfx.stamp();
        juiceHit('in', x, z);
        break;
      case 'surprise':
        stampAt(stampLayer, '?!', p.x, p.y - 20, { gold: true, life: 1400, reducedMotion: rm });
        break;
      case 'combo': {
        const n = info.n ?? 2;
        const word = n >= 4 ? (n > 4 ? `Cat Train ×${n}` : 'Cat Train') : COMBO.names[n];
        stampAt(stampLayer, `${word}!`, p.x, p.y - 80, { gold: true, cls: 'big', life: 1400, reducedMotion: rm });
        sfx.star(Math.min(2, n - 2));
        juiceHit('combo', x, z, n);
        break;
      }
      case 'trick':
        if (TRICK_WORDS[info.trick]) stampAt(stampLayer, TRICK_WORDS[info.trick], p.x, p.y - 40, { gold: true, cls: 'small', life: 1200, reducedMotion: rm });
        break;
      case 'knock':
        stampAt(stampLayer, 'Bonk', p.x, p.y - 20, { cls: 'small', life: 600, reducedMotion: rm });
        juiceHit('knock', x, z);
        break;
      case 'ding':
        stampAt(stampLayer, 'Knock knock', p.x, p.y, { cls: 'small', life: 1300, reducedMotion: rm });
        break;
      case 'bell':
        stampAt(stampLayer, 'Ding dong!', p.x, p.y - 20, { gold: true, life: 1300, reducedMotion: rm });
        break;
      case 'ride':
        stampAt(stampLayer, 'All aboard', p.x, p.y, { cls: 'small', life: 900, reducedMotion: rm });
        break;
      default: break;
    }
  }

  // ------------------------------------------------------------------ juice: hit-stop, slow motion, the camera leaning in
  // (time only bends in solo play; a match's clock is shared)
  const juice = { stop: 0, slow: 0 };
  function juiceHit(kind, x, z, n = 1) {
    if (reduced()) return;
    const solo = app.screen === 'solo';
    if (kind === 'in') {
      if (solo) juice.stop = Math.max(juice.stop, 0.055);
      stage.punch(0.05, { x, z });
    } else if (kind === 'combo') {
      if (solo) juice.stop = Math.max(juice.stop, 0.07 + 0.025 * n);
      stage.punch(0.08 + 0.03 * n, { x, z });
      stage.flashScreen(0.05 + 0.02 * n);
      if (solo && n >= 3) juice.slow = Math.max(juice.slow, 0.5);
    } else if (kind === 'knock') {
      if (solo) juice.stop = Math.max(juice.stop, 0.045);
    }
  }
  /** Real seconds → seconds the run moves this frame. */
  function bend(dt) {
    if (app.screen !== 'solo') { juice.stop = 0; juice.slow = 0; return dt; }
    if (juice.stop > 0) { juice.stop -= dt; return dt * 0.03; }
    if (juice.slow > 0) { juice.slow -= dt; return dt * 0.3; }
    return dt;
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

  /** Where the page is, for tools that take its picture. */
  function flow(where) { try { document.body.dataset.flow = where; } catch { /* ignore */ } }

  function setScreen(name) {
    app.screen = name;
    flow(name === 'solo' || name === 'match' ? 'play' : name);
    if (app.net) app.net.screen = name === 'solo' ? 'solo' : name === 'match' ? 'play' : name;
    setControls(name === 'solo' || (name === 'match' && !!app.net?.session?.me));
  }

  // ------------------------------------------------------------------ what I wear
  function myWear() {
    const w = save.wearing();
    return { hat: ITEM[w.hat], carrier: ITEM[w.carrier], clap: ITEM[w.clap], trail: ITEM[w.trail] };
  }
  function syncLooks() {
    const w = myWear();
    if (app.net) app.net.looks = [w.hat.n, w.clap.n, w.trail.n];
  }
  /** What a player in a match wears: mine from the save, others' from their presence, bots plain. */
  function wearOf(id) {
    if (!id || id.startsWith('bot:')) return null;
    if (id === myId() || id === 'me') return myWear();
    const lk = app.net?.looksOf?.(id);
    if (!lk) return null;
    return { hat: itemAt('hat', lk[0]), clap: itemAt('clap', lk[1]), trail: itemAt('trail', lk[2]) };
  }

  // ---------- on the way in: the café in attract mode and the wordmark, until the room answers
  const letters = (word, from) => [...word].map((ch, i) => `<span style="--i:${from + i}">${esc(ch)}</span>`).join('');
  function showTitle() {
    clearUI();
    setScreen('title');
    startAttract();
    const root = el('section', '', '');
    root.id = 'title';
    root.innerHTML = `<div class="mark ink"><h1><span class="w">${letters('Herding', 0)}</span><span class="w">${letters('Cats', 7)}</span></h1></div>`;
    ui.appendChild(root);
  }

  // ---------- the waiting room: who's here, settings, the solo tickets; the platform's Ready strip below
  function showLobby() {
    if (!app.net) { showBook(); return; }
    clearUI();
    setScreen('lobby');
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
    refreshLobby(true);
    lastResults(root);
  }

  function refreshLobby(force = false) {
    const L = app.lobbyUI;
    const n = app.net;
    if (!L || !n || app.screen !== 'lobby') return;
    const set = n.settings();
    const host = n.isHost();
    const friends = n.friendsWaiting();
    const key = `${set.game}|${set.rounds}|${host}|${friends}|${save.totalStars()}|${save.progress.catLady}|${save.catLadyOpen()}|${save.progress.xp}|${save.streak()}|${app.herders ?? ''}`;
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
    L.tickets.appendChild(herderCard(save.herder(), { compact: true, onClick: friends ? null : () => { sfx.tap(); showWardrobe(); } }));
    const first = !save.levelDone(1) && !friends;
    const t1 = soloTicket({
      name: 'Appointments', pic: 'ui/rooms/1.jpg', sub: first ? 'Start here' : friends ? 'Friends are here' : null, flag: first,
      val: `${star(true, 26)}<b class="num">${save.totalStars()}</b>`, off: friends, onClick: () => showBook(),
    });
    const d = dailySetup(save.today());
    const dOpen = save.dailyOpen();
    const t2 = soloTicket({
      name: 'Daily', pic: `ui/rooms/${LEVELS.find((x) => x.room === d.roomId)?.n ?? 1}.jpg`, sub: dOpen ? (friends ? 'Friends are here' : d.name) : 'After appointment 3',
      val: `${icon('flame', { fill: save.streak() > 0 ? '#ff8a3d' : '#8a7570', size: 26 })}<b class="num">${save.streak()}</b>`, off: friends || !dOpen, locked: !dOpen, onClick: () => startDaily(),
    });
    const open = save.catLadyOpen();
    const t3 = soloTicket({
      name: 'Cat Lady', pic: 'ui/rooms/catlady.jpg', sub: open ? (friends ? 'Friends are here' : 'Endless shift') : 'After appointment 5',
      val: open ? `${carrierSvg('#e5493a')}<b class="num">${save.progress.catLady}</b>` : icon('lock', { size: 26 }), off: friends || !open, locked: !open, onClick: () => startCatLady(),
    });
    L.tickets.append(t1, t2, t3);
  }

  /** A solo ticket: a picture of the room, a name, one number. */
  function soloTicket({ name, pic, sub = null, flag = false, val = '', off = false, locked = false, onClick }) {
    const t = el('button', `ticket live${locked ? ' locked' : ''}`);
    t.type = 'button';
    t.innerHTML = `<span class="tp" style="background-image:url(${pic})"></span><span class="name${sub ? '' : ' solo'}"></span>${sub ? `<span class="sub${flag ? ' flag' : ''}"></span>` : ''}<span class="val">${val}</span>`;
    t.querySelector('.name').textContent = name;
    if (sub) t.querySelector('.sub').textContent = sub;
    t.querySelectorAll('.val svg:not(.ico)').forEach((x) => { x.style.width = '34px'; x.style.height = '30px'; });
    if (off) t.disabled = true;
    else t.addEventListener('click', (e) => { e.stopPropagation(); sfx.tap(); onClick(); });
    return t;
  }

  // ---------- the Appointment Book: the herder, today's goals, the Daily, Cat Lady and fifteen rooms
  function showBook() {
    if (app.net?.friendsWaiting()) { showLobby(); return; }
    clearUI();
    setScreen('book');
    if (!app.scene || (app.scene !== 'waiting' && app.scene !== 'attract')) { leaveScene(); startAttract(); }
    const root = el('section');
    root.id = 'book';
    const head = el('header');
    head.innerHTML = `<h2 class="ink">Appointments</h2><span class="total num ink">${star(true, 30)}${save.totalStars()}/45</span>`;
    if (app.net) head.appendChild(button('Back', { cls: 'live', key: 'Esc', onClick: () => goHome() }));
    const body = el('div', 'body live');
    const side = el('aside', 'side');
    side.appendChild(herderCard(save.herder(), { onClick: () => { sfx.tap(); showWardrobe(); } }));
    side.appendChild(goalsBox(save.goals()));
    const d = dailySetup(save.today());
    const rec = save.progress.daily.day === d.day ? save.progress.daily : null;
    side.appendChild(dailyTicket(d, rec, save.streak(), { onClick: () => { sfx.tap(); startDaily(); }, herders: app.herders, locked: !save.dailyOpen() }));
    const open = save.catLadyOpen();
    side.appendChild(soloTicket({
      name: 'Cat Lady', pic: 'ui/rooms/catlady.jpg', sub: open ? 'Endless shift' : 'After appointment 5',
      val: open ? `${carrierSvg('#e5493a')}<b class="num">${save.progress.catLady}</b>` : icon('lock', { size: 26 }), off: !open, locked: !open, onClick: () => startCatLady(),
    }));
    const more = el('div', 'more');
    const fresh = save.progress.fresh.length > 0;
    more.append(
      button('Wardrobe', { cls: `live${fresh ? ' dot' : ''}`, onClick: () => { sfx.tap(); showWardrobe(); } }),
      button('Cat-alog', { cls: 'live', onClick: () => { sfx.bookOpen(); showCatalog(); } }),
    );
    more.querySelector('.btn').insertAdjacentHTML('afterbegin', icon('hanger', { size: 24 }));
    more.querySelectorAll('.btn')[1].insertAdjacentHTML('afterbegin', icon('catalog', { size: 24 }));
    side.appendChild(more);
    const grid = el('div', 'grid');
    grid.appendChild(bookGrid(save.progress, { onPick: (n) => { sfx.tap(); startLevel(n); } }));
    body.append(side, grid);
    root.append(head, body);
    ui.appendChild(root);
    app.backAction = () => goHome();
    const next = save.nextLevel();
    app.primary = next ? () => startLevel(next) : null;
    if (!reduced()) grid.querySelectorAll('.appt').forEach((c, i) => c.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 260, delay: i * 22, fill: 'backwards', easing: 'ease-out' }));
    loadHerders();
  }

  /** How many herders kept today's Daily (the platform's counter), for the ticket. */
  async function loadHerders() {
    if (!ow?.data?.game?.get || app.herdersDay === save.today()) return;
    app.herdersDay = save.today();
    try {
      const v = await ow.data.game.get('dailyHerders');
      if (Number.isFinite(v) && v > 0) {
        app.herders = v;
        if (app.screen === 'book') { const c = ui.querySelector('#book .daily .crowd'); if (!c) showBook(); }
      }
    } catch { /* offline */ }
  }

  function goHome() {
    sfx.tap();
    if (app.net) showLobby();
    else showBook();
  }

  // ---------- the wardrobe: the herder in the studio, trying things on
  function showWardrobe(tab = app.wardTab ?? 'hat') {
    if (app.net?.friendsWaiting()) { showLobby(); return; }
    const again = app.screen === 'wardrobe';
    const from = app.screen === 'lobby' ? 'lobby' : 'book';
    clearUI();
    setScreen('wardrobe');
    app.wardTab = tab;
    app.wardFrom = again && app.wardFrom ? app.wardFrom : from;
    if (app.scene !== 'dressing') startDressing();
    const root = el('section');
    root.id = 'wardrobe';
    const head = el('header');
    head.innerHTML = '<h2 class="ink">Wardrobe</h2>';
    head.appendChild(button('Back', { cls: 'live', key: 'Esc', onClick: () => leaveWardrobe() }));
    const label = el('div', 'trying ink');
    root.append(head, label);
    const draw = () => {
      const old = root.querySelector('.wardrobe');
      const panel = wardrobePanel({
        owned: save.owned(), wearing: save.wearing(), fresh: save.progress.fresh, tab: app.wardTab, picked: app.dress?.trying ?? null,
        onTab: (k) => { sfx.toggle(); app.wardTab = k; tryOn(null); draw(); },
        onPick: (it) => { sfx.cloth(); tryOn(it); draw(); },
        onWear: (it) => { sfx.cloth(); sfx.chime(); save.wear(it.id); syncLooks(); tryOn(null); draw(); },
      });
      if (old) old.replaceWith(panel); else root.appendChild(panel);
      const t = app.dress?.trying;
      label.innerHTML = t ? `<span class="tn"></span><span class="ts">${icon('lock', { size: 20 })}<span></span></span>` : '';
      if (t) {
        label.querySelector('.tn').textContent = t.name;
        const lv = Object.entries(LEVEL_ITEMS).find(([, id]) => id === t.id)?.[0];
        label.querySelector('.ts span').textContent = lv ? `Herder level ${lv}` : `Fill the ${PAGES.find((pg) => pg.reward === t.id)?.name ?? ''} page`;
      }
      // what's new gets seen
      const seenNow = save.progress.fresh.filter((id) => ITEM[id]?.kind === app.wardTab);
      if (seenNow.length) { save.progress.fresh = save.progress.fresh.filter((id) => !seenNow.includes(id)); save.persist(); }
    };
    draw();
    ui.appendChild(root);
    app.backAction = () => leaveWardrobe();
  }
  function leaveWardrobe() {
    sfx.tap();
    app.dress = null;
    app.scene = null;
    view.hide();
    if (app.wardFrom === 'lobby' && app.net) showLobby();
    else showBook();
  }

  /** The dressing scene: the studio, the herder by their carrier, a cat to show off to. */
  function startDressing() {
    leaveScene();
    const room = ROOMS.studio;
    const g = createGame({ room, mode: 'ambient', seed: 3, cats: [{ type: 'moggy', coat: 'ginger', fixedCoat: true, x: 7.6, z: 7.2 }, { type: 'kitten', coat: 'calico', fixedCoat: true, x: 8.3, z: 6.6 }] });
    const k = g.carriers[0];
    const p = addPerson(g, { id: 'me', x: k.matX + k.nx * 2.2, z: k.matZ + k.nz * 2.2 });
    p.h = Math.PI / 2;
    app.dress = { g, p, t: 0, clapT: 1, trying: null, home: { x: p.x, z: p.z } };
    app.scene = 'dressing';
    dressView();
    stage.frame(p, { follow: 3.6, snap: true });
  }
  function dressView() {
    const d = app.dress;
    if (!d) return;
    const w = myWear();
    const t = d.trying;
    if (t) w[t.kind] = t;
    view.show(d.g, { people: [{ avatar: avatarOf(myId()), seed: 1, wear: w }], me: -1, total: 'solo', skins: [w.carrier] });
  }
  function tryOn(it) {
    const d = app.dress;
    if (!d) return;
    d.trying = it;
    d.clapT = 0.3;
    dressView();
  }
  function tickDressing(dt) {
    const d = app.dress;
    if (!d) return;
    d.t += dt;
    const p = d.p;
    const tab = app.wardTab;
    if (tab === 'trail') {
      // a slow lap so the prints show
      const a = d.t * 0.9;
      const r = 1.3;
      const nx = d.home.x + Math.cos(a) * r;
      const nz = d.home.z + Math.sin(a) * r;
      p.sp = Math.hypot(nx - p.x, nz - p.z) / Math.max(dt, 1e-3);
      p.h = Math.atan2(nz - p.z, nx - p.x);
      p.x = nx;
      p.z = nz;
    } else {
      p.x += (d.home.x - p.x) * Math.min(1, dt * 4);
      p.z += (d.home.z - p.z) * Math.min(1, dt * 4);
      p.sp = 0;
      // a three-quarter view, turned to the camera
      const want = Math.PI * 0.25 + 0.45;
      p.h += ((((want - p.h + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 5);
    }
    if (tab === 'clap') {
      d.clapT -= dt;
      if (d.clapT <= 0) {
        d.clapT = 1.8;
        p.clapSeq = (p.clapSeq ?? 0) + 1;
        view.event({ k: 'clap', p: 0, x: p.x, z: p.z }, { quiet: false });
      }
    }
    const k = d.g.carriers[0];
    if (tab === 'carrier') besidePanel(k.x + k.nx * 0.6, k.z + k.nz * 0.6, 3.8);
    else besidePanel(d.home.x, d.home.z, tab === 'trail' ? 5.6 : 4.4, 0.16);
  }

  /** Frame (x, z) beside the panel on the right (landscape) or above the sheet at the bottom (portrait). */
  function besidePanel(x, z, span, lift = 0) {
    const wide = innerWidth > innerHeight;
    stage.aim(x, z, span, wide ? -0.2 : 0, (wide ? 0 : 0.26) - lift);
  }

  // ---------- the Cat-alog
  function showCatalog(page = app.catPage ?? 0) {
    if (app.net?.friendsWaiting()) { showLobby(); return; }
    clearUI();
    setScreen('catalog');
    if (app.scene !== 'attract') { leaveScene(); startAttract(); }
    app.catPage = page;
    const root = el('section');
    root.id = 'catalog';
    const head = el('header');
    const all = PAGES.reduce((a, pg) => a + pageState(pg, save.progress.book).have, 0);
    const of = PAGES.reduce((a, pg) => a + pg.entries.length, 0);
    head.innerHTML = `<h2 class="ink">Cat-alog</h2><span class="total num ink">${all}/${of}</span>`;
    head.appendChild(button('Back', { cls: 'live', key: 'Esc', onClick: () => { sfx.tap(); showBook(); } }));
    const owned = save.owned();
    const panel = catalogPanel(save.progress.book, page, { onPage: (i) => { sfx.page(); showCatalog(i); }, rewardOwned: owned.has(PAGES[page].reward) });
    root.append(head, panel);
    ui.appendChild(root);
    app.backAction = () => { sfx.tap(); showBook(); };
  }

  // ---------- the Daily Appointment
  function startDaily({ auto = false, day = null } = {}) {
    const D = dailySetup(day ?? save.today());
    startLevel(0, { auto, daily: D });
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
    view.drain();
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
      return { id: p.id, name: p.name, host: p.host, me: p.me, away: p.away, solo: rp?.presence?.s === 'solo' };
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
      for (const cv of w.carriers ?? []) cv.dispose();
      w.carriers = [];
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
        w.carriers.push(cv);
      });
      w.list = roster;
      view.setPeople(roster.map((r, i) => ({ avatar: avatarOf(r.id), seed: hashId(r.id), look: SEATS[i], wear: wearOf(r.id) })), -1);
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
    if (app.waiting) { stage.scene.remove(app.waiting.props); for (const cv of app.waiting.carriers ?? []) cv.dispose(); app.waiting = null; }
    app.attract = null;
    app.dress = null;
    app.scene = null;
  }

  // close enough to read a cat's face, wide enough to plan the next herd: about nine room units across the short side
  function followSpan() {
    if (TAKE_SPAN) return TAKE_SPAN;
    return innerWidth >= innerHeight ? 8 : 6.6;
  }

  /** The follow camera looks a little ahead of the herder and leans toward their carrier as it comes into reach. */
  function aim(p, k, span) {
    if (!p || !Number.isFinite(p.vx) || !Number.isFinite(p.vz)) return {};
    let ax = p.vx * 0.32, az = p.vz * 0.32;
    const m = Math.hypot(ax, az);
    if (m > 1.1) { ax *= 1.1 / m; az *= 1.1 / m; }
    const out = { ahead: { x: ax, z: az } };
    if (k) {
      const d = Math.hypot(k.x - p.x, k.z - p.z);
      const t = Math.min(1, Math.max(0, (d - span * 0.55) / (span * 0.7)));
      out.lean = k;
      out.leanK = 0.36 * (1 - t * t * (3 - 2 * t));
    }
    return out;
  }

  /** An appointment (n), or the Daily when `daily` is today's setup (dailySetup). */
  function startLevel(n, { auto = false, daily = null } = {}) {
    const setup = daily ? { level: daily, room: daily.room, cats: daily.cats, twists: daily.twists } : levelSetup(n);
    if (!setup) return;
    leaveScene();
    clearUI();
    const L = setup.level;
    const tries = (app.tries = (app.tries ?? 0) + 1);
    // the Daily is the same room and cats for everyone; its coats, like every try, are rolled fresh
    const seed = daily ? daily.day * 13 + tries : n * 101 + tries;
    const g = createGame({ room: setup.room, mode: 'level', cats: setup.cats, seed, clock: L.closes, twists: setup.twists });
    const me = addPerson(g, { id: 'me' });
    app.run = {
      kind: daily ? 'daily' : 'level', n, L, g, me, acc: 0, introT: 2.4, over: false, overT: 0, paused: false, auto,
      brain: auto ? createBrain({ skill: 1, seed: (n || 3) * 7 + 3 }) : null,
      introCat: daily ? null : L.intro ? g.cats.find((c) => c.type === L.intro) : L.introTwist ? twistFocus(g, L.introTwist) : null, hintStage: daily ? 9 : 0, lastCount: 0, closeTicks: 0,
      chState: 0, newCoats: new Set(),
    };
    app.scene = 'run';
    const w = myWear();
    view.show(g, { people: [{ avatar: avatarOf(myId()), seed: 1, wear: w }], me: 0, total: 'solo', skins: [w.carrier] });
    stage.frame(app.run.introCat ?? me, { follow: followSpan(), snap: true, zoom: app.run.introCat ? 0.8 : 1 });
    setScreen('solo');
    buildSoloHud();
    sfx.setMusic('play', { seed: daily ? daily.day : n });
    sfx.clank();
    if (app.run.introCat?.type) setTimeout(() => sfx.meow(1, 0.45, 0.16), 300);
  }

  /** Something for the camera and the intro tag to follow: a twist's first appearance. */
  function twistFocus(g, t) {
    const at = t === 'laser' ? () => ({ x: g.laser?.hx ?? 0, z: g.laser?.hz ?? 0 })
      : t === 'vacs' ? () => g.vacs[0] ?? { x: 0, z: 0 }
        : t === 'boxes' ? () => g.boxes[0] ?? { x: 0, z: 0 }
          : () => ({ x: g.bell?.x ?? 0, z: (g.bell?.z ?? 0) - 1.5 });
    if (t === 'laser' && !g.laser) return null;
    return { twist: t, y: 0, get x() { return at().x; }, get z() { return at().z; } };
  }

  function startCatLady({ auto = false } = {}) {
    leaveScene();
    clearUI();
    const setup = catladySetup();
    const tries = (app.tries = (app.tries ?? 0) + 1);
    const g = createGame({ room: setup.room, mode: 'catlady', cats: [], seed: 4242 + tries, clock: CATLADY.start });
    const me = addPerson(g, { id: 'me' });
    app.run = { kind: 'catlady', g, me, acc: 0, introT: 1.6, over: false, overT: 0, paused: false, auto, brain: auto ? createBrain({ skill: 0.9, seed: 9 }) : null, lastCount: 0, closeTicks: 0, hintStage: 9, newCoats: new Set() };
    app.scene = 'run';
    const w = myWear();
    view.show(g, { people: [{ avatar: avatarOf(myId()), seed: 1, wear: w }], me: 0, total: 'versus', skins: [w.carrier] });
    stage.frame(me, { follow: followSpan(), snap: true });
    setScreen('solo');
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
    const count = el('div', 'count num ink', `${carrierSvg(myWear().carrier.shell ?? '#e5493a')}<span class="v">0</span>`);
    root.appendChild(count);
    let chip = null;
    if (r.kind !== 'catlady' && r.L.challenge) {
      chip = challengeChip(r.L.challenge);
      root.appendChild(chip.root);
    }
    const keysRow = el('div', 'keys');
    keysRow.innerHTML = `<span class="k ink"><span class="cap">J</span>Treats</span><span class="k ink"><span class="cap">K</span>Clap</span>`;
    root.appendChild(keysRow);
    const head = el('div', 'headline');
    head.innerHTML = r.kind === 'level'
      ? `<div class="a">Appointment ${r.n}</div><div class="b ink">${esc(r.L.name)}</div>`
      : r.kind === 'daily'
        ? `<div class="a">Daily · ${esc(r.L.name)}</div><div class="b ink">${esc(ROOMS[r.L.roomId]?.name ?? 'Today')}</div>`
        : `<div class="a">Endless shift</div><div class="b ink">Cat Lady</div>`;
    if (chip) head.insertAdjacentHTML('beforeend', `<div class="c">${esc(CHALLENGES[r.L.challenge]?.label ?? '')}</div>`);
    root.appendChild(head);
    ui.appendChild(root);
    if (r.kind !== 'catlady') clock.notches([r.L.par / r.L.closes]);
    app.hud = { root, clock, count, head, chip, countV: count.querySelector('.v'), shown: -1 };
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
      button(app.run.kind === 'catlady' && app.net ? 'Lobby' : 'Appointments', { onClick: () => quitRun() }),
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
    else if (r.kind === 'daily') startDaily({ auto: r.auto, day: r.L.day });
    else startCatLady({ auto: r.auto });
  }

  function quitRun() {
    sfx.tap();
    const r = app.run;
    app.run = null;
    view.hide();
    app.scene = null;
    if ((r?.kind === 'level' || r?.kind === 'daily' || !app.net) && !app.net?.friendsWaiting()) showBook();
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
      // the last cat on its way in: time slows and the camera leans in
      if (r.kind !== 'catlady' && !g.over && !r.lastSlow && !reduced() && !g.cats.some((c) => c.surprise)) {
        const left = loose(g);
        const k = left.length === 1 && g.boxed > 0 ? soonIn(g, left[0], 0.45) : null;
        if (k) { r.lastSlow = true; juice.slow = 1.0; stage.punch(0.2, { x: k.x, z: k.z }); }
      }
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
        // a coat the Cat-alog hasn't got: say so as it goes in
        const c = g.cats[e.c];
        if (c && !r.auto && !save.progress.book.coats[c.coat] && !r.newCoats.has(c.coat) && COAT_INFO[c.coat]) {
          r.newCoats.add(c.coat);
          const k = g.carriers[e.ki] ?? g.carriers[0];
          const rare = COAT_INFO[c.coat].rarity;
          const at = stage.toScreen(k.matX, 1.2, k.matZ);
          setTimeout(() => {
            stampAt(stampLayer, rare >= 2 ? `${COAT_INFO[c.coat].name}!` : `New: ${COAT_INFO[c.coat].name}`, Math.max(140, Math.min(innerWidth - 140, at.x)), Math.max(120, at.y - 110), { gold: rare >= 1, cls: 'small', life: 1500, reducedMotion: reduced() });
            if (rare >= 2) { sfx.rare(); view.hints.sparkle(k.matX, 0.8, k.matZ, 16); } else sfx.page();
          }, 380);
        }
      }
    }
    view.lastSeq = g.evSeq;
    // HUD
    if (hud) {
      if (r.kind !== 'catlady') hud.clock.set(g.clock ?? 0, r.L.closes);
      else hud.clock.set(g.clock ?? 0, Math.max(60, g.clock ?? 60));
      const shown = r.kind !== 'catlady' ? `${g.boxed}/${g.total}` : String(g.boxed);
      if (shown !== hud.shown) { hud.countV.textContent = shown; hud.shown = shown; }
      const left = g.clock ?? 99;
      sfx.setTense(left <= 30 && g.started && !g.over);
      sfx.setFill(r.kind === 'catlady' ? Math.min(1, g.boxed / 20) : g.boxed / Math.max(1, g.total));
      const sec = Math.ceil(left);
      if (g.started && !g.over && sec <= 30 && sec !== r.lastTick) { r.lastTick = sec; sfx.tick(sec <= 10); }
    }
    // the par star drops as the hand passes it; the challenge lights up or is lost
    if (r.kind !== 'catlady' && g.started && !g.over) {
      if (!r.lostPar && g.elapsed > r.L.par) { r.lostPar = true; sfx.dull(); }
      const st = liveState(r.L.challenge, g.stats);
      if (st !== r.chState) {
        r.chState = st;
        hud?.chip?.set(st);
        if (st === 1) { sfx.chime(); if (!reduced()) hud?.chip?.root.animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 360, easing: 'cubic-bezier(.3,1.6,.6,1)' }); }
        if (st === -1) sfx.dull();
      }
    }
    // hints and the new cat's tag
    soloHints(r);
    if (!r.over && !(r.introCat && r.introT > 0)) pointers(g, g.carriers[0], '#e5493a', 'carrier');
    // camera: the run, then the full carrier beside the results
    if (r.shown) {
      const k = g.carriers[0];
      besidePanel(k.x + k.nx * 0.6, k.z + k.nz * 0.6, 5);
    } else {
      const intro = r.introCat && r.introT > 0;
      const span = followSpan();
      stage.frame(intro ? r.introCat : r.me, { follow: span, zoom: intro ? 0.8 : 1, ...(intro ? {} : aim(r.me, g.carriers[0], span)) });
    }
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
      const info = r.introCat.twist ? TWIST_INTROS[r.introCat.twist] : INTROS[r.introCat.type];
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

  /** The cats I boxed in a run, for the Cat-alog: [{ type, coat }]. */
  function boxedCats(g, slot = null, carrier = null) {
    return g.cats.filter((c) => (c.st === S.boxed || c.st === S.enter) && !c.surprise
      && (carrier == null || c.carrier === carrier) && (slot == null || c.by === slot || carrier != null)).map((c) => ({ type: c.type, coat: c.coat }));
  }

  function showSoloResult() {
    const r = app.run;
    const g = r.g;
    const root = app.hud.root;
    root.querySelector('.keys')?.remove();
    root.querySelector('.chip')?.remove();
    const res = g.result ?? { allIn: false, time: g.elapsed, stats: g.stats };
    const kind = r.kind;
    const before = kind === 'level' ? (save.progress.levels[r.n]?.s ?? 0) : kind === 'daily' && save.progress.daily.day === r.L.day ? save.progress.daily.s : 0;
    const prevShift = save.progress.catLady;
    const rep = r.auto && !params.has('demo') ? null : save.finish({ kind, L: r.L, result: res, mine: g.boxed, cats: boxedCats(g), day: kind === 'daily' ? r.L.day : undefined });
    if (rep) syncLooks();
    const acts = [];
    const L = r.L;
    let o;
    if (kind === 'catlady') {
      const best = save.progress.catLady;
      o = {
        title: 'Shift over', good: g.boxed > 0, sub: 'Cat Lady', big: { label: 'Cats boxed', value: String(g.boxed) },
        lines: [['Shift', fmtTime(g.elapsed)], ['Best', String(Math.max(best, g.boxed))]], newBest: !r.auto && g.boxed > prevShift && prevShift > 0,
      };
      acts.push(button('Retry', { cls: 'red', key: 'Space', onClick: () => retry() }), button(app.net ? 'Lobby' : 'Book', { key: 'Esc', onClick: () => quitRun() }));
      app.primary = () => retry();
    } else {
      const mask = rep ? rep.stars : (res.allIn ? STAR.allIn : 0) | (res.allIn && res.time <= L.par ? STAR.par : 0) | (passed(L.challenge, res) ? STAR.challenge : 0);
      o = {
        title: res.allIn ? 'All in!' : 'Missed appointment', good: res.allIn,
        sub: kind === 'daily' ? `Daily · ${L.name}` : `Appointment ${r.n} · ${L.name}`,
        big: res.allIn ? { label: 'Time', value: fmtTime(res.time) } : { label: 'Cats left', value: String(g.total - g.boxed) },
        lines: [],
        stars: { mask, had: before, challenge: L.challenge, parText: `Under ${fmt(L.par)}` },
        rosette: res.allIn && res.time <= L.expert, newRosette: !!rep?.newRosette, newBest: !!rep?.newBest && rep.prevBest != null,
      };
      const best = kind === 'level' ? save.progress.levels[r.n]?.best : save.progress.daily.time;
      if (best && !o.newBest) o.lines.push(['Best', fmtTime(best)]);
      const hasNext = kind === 'level' && res.allIn && r.n < LEVELS.length;
      if (hasNext) {
        acts.push(button('Next', { cls: 'red', key: 'Space', onClick: () => startLevel(r.n + 1) }), button('Retry', { key: 'R', onClick: () => retry() }));
        app.primary = () => startLevel(r.n + 1);
      } else {
        acts.push(button('Retry', { cls: 'red', key: 'Space', onClick: () => retry() }));
        app.primary = () => retry();
      }
      acts.push(button('Book', { key: 'Esc', onClick: () => quitRun() }));
    }
    app.keyR = () => retry();
    app.backAction = () => quitRun();
    const tops = el('div', 'tops');
    const panel = resultPanel({
      ...o, report: rep, actions: acts, tops, reduced: reduced(), sfx,
      onWear: (it) => { save.wear(it.id); syncLooks(); },
    });
    root.appendChild(panel.root);
    if (!reduced()) panel.root.animate([{ transform: 'translateX(40px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2,1.2,.4,1)' });
    // the carrier full of cats, a little confetti over it
    const k = g.carriers[0];
    if (res.allIn || kind === 'catlady') setTimeout(() => view.hints.confetti(k.x + k.nx * 0.4, k.z + k.nz * 0.4, ['#e5493a', '#f6b941', '#fff3df', '#4f9a5e'], 1.3, 10), 500);
    if (kind === 'level' && res.allIn) loadTops(tops, `appt-${String(r.n).padStart(2, '0')}`, 'time');
    if (kind === 'daily') {
      const after = () => loadTops(tops, save.DAILY_BOARD, 'daily', L.day);
      if (rep?.board) rep.board.then(after, after); else after();
    }
    if (kind === 'catlady') loadTops(tops, 'cat-lady', 'count');
  }

  /** The board's top five under the results: times, counts, or today's Daily (its scores carry the day). */
  async function loadTops(box, board, as, day = null) {
    if (!box || !ow?.leaderboards?.top) return;
    try {
      const res = await ow.leaderboards.top(board, { limit: as === 'daily' ? 25 : 5 });
      let list = Array.isArray(res?.entries) ? res.entries : [];
      if (as === 'daily') list = list.filter((e) => Number.isFinite(e?.score) && save.dailyFromScore(e.score).day === day);
      list = list.slice(0, 5);
      if (!list.length || !box.isConnected) return;
      box.innerHTML = `<div class="th">${as === 'daily' ? "Today's board" : 'Board'}</div>`;
      list.forEach((e, i) => {
        const v = Number(e?.score);
        const row = el('div', 'tr');
        row.innerHTML = '<span class="num"></span><span class="nm"></span><span class="num"></span>';
        row.children[0].textContent = String(i + 1);
        row.children[1].textContent = String(e?.player?.name ?? 'Player').slice(0, 24);
        row.children[2].textContent = !Number.isFinite(v) ? '' : as === 'time' ? fmtTime(v) : as === 'daily' ? fmtTime(save.dailyFromScore(v).time) : String(v);
        box.appendChild(row);
      });
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
      alpha: () => n.alpha(), paused: m.paused, elapsed: m.elapsed,
    };
  }

  function enterMatch() {
    if (app.screen !== 'match') {
      clearUI();
      setScreen('match');
      app.mv = { key: null, phase: null, hud: null };
    }
  }

  function tickMatch(dt) {
    const src = matchSource();
    if (!src) return;
    const mv = app.mv ?? (app.mv = { key: null, phase: null });
    const s = src.session;
    // countdown: the waiting room stays, the platform's 3-2-1 over it, a tick from us on each number
    if (src.phase === 'countdown') {
      if (app.scene !== 'waiting') { leaveScene(); startWaiting(); }
      tickWaiting(dt);
      if (mv.phase !== 'countdown') { clearUI(); mv.phase = 'countdown'; mv.lastN = null; sfx.unlock(); sfx.setMusic('menu'); }
      const nleft = Math.max(1, Math.ceil(src.countdown ?? 3));
      if (nleft !== mv.lastN) {
        mv.lastN = nleft;
        sfx.count(1);
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
        people: s.data.seats.map((id, i) => ({ avatar: id.startsWith('bot:') ? null : avatarOf(id), seed: hashId(id), look: looks[i], wear: wearOf(id) })),
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
      view.setPeople(s.data.seats.map((id, i) => ({ avatar: id.startsWith('bot:') ? null : avatarOf(id), seed: hashId(id), look: looks[i], wear: wearOf(id) })), s.me ? s.data.seats.indexOf(s.me) : -1);
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
    const mineI = s.me ? s.data.seats.indexOf(s.me) : -1;
    const own = mineI >= 0 && focus === s.people.get(s.me) ? s.g.carriers[s.data.mode === 'together' ? 0 : mineI] : null;
    stage.frame(focus, focus ? { follow: span, ...aim(focus, own, span) } : { zoom: 1.02 });
    if (src.phase === 'round' && mineI >= 0 && !s.g.over) {
      const together = s.data.mode === 'together';
      const k = s.g.carriers[together ? 0 : mineI];
      pointers(s.g, k, together ? '#e5493a' : SEATS[mineI].color, together ? 'carrier' : SEATS[mineI].symbol);
    }
  }

  function matchFollow() {
    if (TAKE_SPAN) return TAKE_SPAN;
    return innerWidth >= innerHeight ? 10.5 : 8.2;
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
      sfx.setFill(g.boxed / Math.max(1, g.total));
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
    if ((src.phase === 'intro' || (src.phase === 'round' && src.round === 1 && (src.elapsed ?? 0) < 2500)) && s.me) {
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
    if (src.phase === 'intro' && src.round > 1) {
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
      // my part of the round: XP, the Cat-alog, goals
      if (s.me && !app.local && !s.roundPaid) {
        s.roundPaid = true;
        const i = s.data.seats.indexOf(s.me);
        const together = s.data.mode === 'together';
        const cats = together ? boxedCats(g, i) : boxedCats(g, null, i);
        const rep = save.finish({ kind: 'round', mine: cats.length, cats, result: { allIn: false, time: 0, stats: {} } });
        setTimeout(() => xpToast(rep, head), 700);
      }
    }
  }

  /** A short "+n XP" under a headline after a round, and the level when it went up. */
  function xpToast(rep, under = null) {
    if (!rep || rep.xpGained <= 0) return;
    const host = under ?? app.hud?.root;
    if (!host || !host.isConnected) return;
    const t = el('div', 'xptoast');
    t.innerHTML = `${icon('xp', { fill: '#f6b941', size: 26 })}<span class="num">+${rep.xpGained}</span>${rep.after.level > rep.before.level ? `<span class="up">Level ${rep.after.level}</span>` : ''}`;
    host.appendChild(t);
    if (rep.after.level > rep.before.level) sfx.fanfare(); else sfx.chime();
    if (!reduced()) t.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' });
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
    if (mv.phase === 'results') return;
    mv.phase = 'results';
    clearUI();
    setControls(false);
    const list = src.results ?? src.standings ?? [];
    app.lastMatch = { n: app.net?.room.match?.n ?? 0, seats: s?.data.seats ?? null };
    ui.appendChild(podium(list, app.lastMatch.seats, src.me?.id));
    sfx.fanfare();
    if (s && list.some((x) => x.place === 1)) view.hints.confetti(s.g.world.w / 2, s.g.world.d / 2, ['#e5493a', '#f6b941', '#fff3df', '#3f7fcb']);
  }

  /** The match's places. Results start nothing: the platform's strip is the way to the next one. */
  function podium(list, seats, myId2) {
    const pod = el('div', 'podium');
    list.slice(0, 6).forEach((st, idx) => {
      const i = seats ? seats.indexOf(st.id) : idx;
      const look = SEATS[i >= 0 ? i : idx % 6];
      const row = el('div', `standing${st.place === 1 ? ' first' : ''}${st.id === myId2 ? ' mine' : ''}`);
      row.innerHTML = `<span class="pl">${st.place}</span>${symbolSvg(look.symbol, look.color, '#2b1d1c', 32)}<span class="nm">${esc(st.name)}</span><span class="pts">${st.points}</span>`;
      pod.appendChild(row);
      if (!reduced()) row.animate([{ transform: 'translateY(30px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, delay: idx * 90, fill: 'backwards' });
    });
    const win = list.find((x) => x.place === 1);
    if (win) {
      const head = el('div', 'headline');
      head.innerHTML = `<div class="b ink">${win.id === myId2 ? 'Best in Show!' : `${esc(win.name)}: Best in Show`}</div>`;
      pod.prepend(head);
      head.style.position = 'static';
      head.style.transform = 'none';
    }
    return pod;
  }

  /** The match just played stays over the waiting room, with the strip below it, until it's closed. */
  function lastResults(root) {
    const m = app.net?.match;
    const last = app.lastMatch;
    if (!m?.results || !last || last.closed || last.n !== app.net.room.match?.n) return;
    const pod = podium(m.results, last.seats, m.me?.id);
    pod.classList.add('over');
    pod.querySelectorAll('.standing').forEach((r) => r.getAnimations?.().forEach((a) => a.finish()));
    const close = () => {
      sfx.tap();
      last.closed = true;
      pod.remove();
      root.classList.remove('hasresults');
    };
    const acts = el('div', 'acts live');
    acts.appendChild(button('Close', { key: 'Esc', onClick: close }));
    pod.appendChild(acts);
    root.appendChild(pod);
    root.classList.add('hasresults');
    app.backAction = close;
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
    goHome();
  }

  // ------------------------------------------------------------------ the net
  function attachNet(room) {
    app.net = createNet(room, {
      press: (kind, p) => view.event({ k: kind, p: p.slot, x: p.x, z: p.z }),
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
        const won = mine.place === 1 && standings.length > 1;
        if (won) { const rep = save.finish({ kind: 'match', won: true, mine: 0, cats: [] }); xpToast(rep); }
      },
      close: (reason) => showClosed(reason),
      starting: () => {},
    });
    app.net.rank = Math.min(3, Math.floor(save.totalStars() / 15) + (save.progress.wins > 2 ? 1 : 0));
    syncLooks();
    app.net.before = () => view.capture();
    room.on?.('join', () => { app.peopleDirty = true; });
    room.on?.('leave', () => { app.peopleDirty = true; });
    room.on?.('rename', () => { app.peopleDirty = true; });
  }

  // ------------------------------------------------------------------ the loop
  let last = performance.now();
  let touchCheck = 0;
  let frameFailed = false;
  function frame() {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    try {
      frameStep();
    } catch (err) {
      if (!frameFailed) { frameFailed = true; console.error(err); }
    }
    // every frame draws, even after a failed step (a page that skips a draw can stall a capture's clock)
    try { stage.render(); } catch { /* the next frame tries again */ }
    try { tagsDone(); arrowsDone(); } catch { /* likewise */ }
  }

  function frameStep() {
    // the page's own clock (not the frame's timestamp), which also follows a capture's virtual time
    const now = performance.now();
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
      // Readying closes whatever is open (the book, the wardrobe, a solo run): the lobby, and the match the moment it starts.
      const ready = !!n.room.me?.ready;
      if (ready && !app.wasReady && ph === 'lobby' && app.screen !== 'lobby') {
        if (app.run) { app.run = null; view.hide(); app.scene = null; }
        showLobby();
      }
      app.wasReady = ready;
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
    let vdt = dt;
    switch (app.screen) {
      case 'wardrobe':
        tickDressing(dt);
        break;
      case 'title': case 'book': case 'catalog':
        if (app.scene === 'attract') { tickAttract(dt); alpha = app.attract.acc / STEP; }
        else if (app.scene === 'waiting') { tickWaiting(dt); alpha = app.waiting.acc / STEP; }
        break;
      case 'lobby':
        tickWaiting(dt);
        alpha = app.waiting ? app.waiting.acc / STEP : 1;
        break;
      case 'solo':
        vdt = bend(dt);
        tickSolo(vdt);
        alpha = app.run?.alpha ?? 1;
        me = app.run?.me ?? null;
        break;
      case 'match': {
        if (app.local) tickLocal(dt);
        tickMatch(dt);
        const s = app.local ? app.local.session : n?.session;
        if (s && app.scene === 'match') {
          alpha = app.local ? stepAlpha(s, app.local.clockT) : n.alpha();
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
    if (view.g) view.update(vdt, app.t, { alpha, me, offsets, away, reducedMotion: reduced(), guides: app.screen === 'solo' || app.screen === 'match' });
    stage.update(dt);
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
      names: { me: 'Mo', 'bot:1': 'Priya', 'bot:2': 'Otis', 'bot:3': 'Bea' }, alpha: () => stepAlpha(s, app.local?.clockT ?? null),
    };
    enterMatch();
  }

  // ------------------------------------------------------------------ go
  // the furniture, people and surfaces come first: every room is built from them
  await loadAssets().catch((e) => console.warn('assets', e));
  requestAnimationFrame(frame);
  if (AUTOPLAY) {
    await loading;
    if (params.has('demo')) demoProgress();
    sfx.unlock();
    const sc = params.get('scene') ?? 'versus';
    if (sc === 'book') showBook();
    else if (sc === 'wardrobe') showWardrobe(params.get('tab') ?? 'hat');
    else if (sc === 'catalog') showCatalog(Number(params.get('page') ?? 0));
    else if (sc === 'daily') startDaily({ auto: true });
    else if (sc === 'catlady') startCatLady({ auto: true });
    else if (sc === 'versus') startLocalMatch('versus');
    else if (sc === 'together') startLocalMatch('together');
    else startLevel(Math.max(1, Math.min(15, Number(params.get('n')) || 1)), { auto: true });
  } else {
    // The wordmark over the café until the room answers (a guest may be naming themselves), then the lobby. No room: the book.
    showTitle();
    await loading;
    if (app.screen === 'title') showTitle();
    const room = await joining;
    if (room) attachNet(room);
    goHome();
  }
}

/** Pictures of the screens need a player some way in (?autoplay&demo, never on onceworlds.com). */
function demoProgress() {
  const p = save.progress;
  const masks = [7, 7, 5, 3, 7, 1, 3, 7, 1, 0];
  masks.forEach((s, i) => { if (s) p.levels[i + 1] = { s, best: 18 + i * 7.3, ros: i % 3 === 0 }; });
  p.xp = 1900;
  p.catLady = 23;
  p.boxed = 160;
  for (const t of ['moggy', 'loaf', 'glutton', 'zoomer', 'scaredy', 'kitten']) p.book.types[t] = 3 + t.length;
  for (const c of ['ginger', 'grey', 'tuxedo', 'calico', 'black', 'white', 'silver', 'cow', 'panda']) p.book.coats[c] = 2 + c.length;
  p.daily = { last: save.today() - 1, streak: 4, best: 6, day: null, time: null, s: 0 };
  p.fresh = ['hat:bucket', 'clap:hearts'];
  p.wear = { hat: 'hat:bucket', carrier: 'carrier:teal', clap: 'clap:hearts', trail: 'trail:paws' };
}

function hashId(id) {
  let h = 2166136261;
  for (let i = 0; i < String(id).length; i++) h = Math.imul(h ^ String(id).charCodeAt(i), 16777619);
  return h >>> 0;
}
