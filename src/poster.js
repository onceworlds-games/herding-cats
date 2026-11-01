// Store art: ?poster=<name> draws one staged, deterministic frame with the real renderer (no SDK, no room, no HUD).

import { createStage } from './render/stage.js';
import { loadAssets } from './render/assets.js';
import { freeSpot } from './sim/world.js';
import { createView } from './render/view.js';
import { createGame, addPerson } from './sim/game.js';
import { ROOMS, arena } from './sim/rooms.js';
import { levelSetup, catladySetup } from './sim/levels.js';
import { S, SEATS, TYPES } from './sim/tuning.js';
import { symbolSvg, PATHS } from './ui/symbols.js';
import { icon } from './ui/icons.js';
import { carrierSvg, rosette, star } from './ui/ui.js';

const BADGES = {
  'first-cat': ['paw', '#f6b941'], 'full-carrier': ['carrier', '#4f9a5e'], 'under-par': ['clock', '#3f7fcb'],
  'boss-move': ['crown', '#8c5bc4'], zoomies: ['bolt', '#e5493a'], 'cat-cafe': ['heart', '#e57fa6'],
  'fifteen-appointments': ['star', '#2b1d1c'], 'crazy-cat-person': ['yarn', '#d9a066'], 'best-in-show': ['rosette', '#fff3df'],
  'cat-lady': ['cat', '#3f8a86'], 'cat-train': ['chain', '#e57f3a'], 'bank-shot': ['bank', '#6aa7d8'], 'rare-coat': ['spark', '#b9a3ec'],
  'cat-alog': ['catalog', '#9fd08f'], 'week-of-dailies': ['flame', '#5a2f2a'], 'herder-10': ['xp', '#3f5fa0'],
};
const ICON_FILL = { flame: '#ff8a3d', xp: '#f6b941', spark: '#fff3df' };

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ready() {
  requestAnimationFrame(() => requestAnimationFrame(() => { document.body.dataset.ready = '1'; }));
}

function overlay(html, css = '') {
  const d = document.createElement('div');
  d.style.cssText = `position:fixed;inset:0;pointer-events:none;${css}`;
  d.innerHTML = html;
  document.body.appendChild(d);
  return d;
}

export async function renderPoster(name) {
  Math.random = seeded(20261101);
  const card = name.startsWith('card-');
  const W = name === 'icon' ? 512 : name.startsWith('badge-') ? 256 : card ? 480 : 1280;
  const H = name === 'icon' ? 512 : name.startsWith('badge-') ? 256 : card ? 300 : 720;
  document.documentElement.style.cssText = `width:${W}px;height:${H}px`;
  document.body.style.cssText = `width:${W}px;height:${H}px`;
  try {
    await Promise.race([
      Promise.all(['900 40px Fraunces', '700 20px Fraunces', '800 40px "Big Shoulders Stencil Display"'].map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
    await document.fonts.ready;
  } catch { /* fallbacks */ }

  if (name.startsWith('badge-')) {
    badge(name.slice(6), W);
    ready();
    return;
  }

  await loadAssets();
  const canvas = document.getElementById('world');
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  const stage = createStage(canvas, { poster: true });
  const q = new URLSearchParams(location.search);
  stage.setQuality(q.get('q') ?? 'high', 1);
  stage.resize(W, H);
  const view = createView(stage);
  const scene = SCENES[name] ?? (card ? SCENES.card : SCENES.cover);
  const plan = scene(view, stage, name);
  // let poses, headings and tails settle, then draw once
  let t = 0;
  for (let i = 0; i < 90; i++) {
    t += 1 / 60;
    plan.before?.(i, t);
    view.update(1 / 60, t, { me: plan.me ?? null, alpha: 1 });
    stage.update(1 / 60);
  }
  plan.camera();
  stage.render();
  plan.after?.();
  ready();
}

function badge(id, size) {
  const [sym, color] = BADGES[id] ?? ['paw', '#f6b941'];
  const inner = sym === 'carrier' ? carrierSvg('#e5493a') : sym === 'rosette' ? rosette()
    : PATHS[sym] ? symbolSvg(sym, sym === 'star' ? '#f6b941' : '#fff3df', '#2b1d1c', 120)
      : icon(sym, { fill: ICON_FILL[sym] ?? '#fff3df', size: 120 });
  overlay(`<div style="position:absolute;left:14px;top:14px;width:${size - 28}px;height:${size - 28}px;border-radius:50%;background:${color};border:10px solid #2b1d1c;box-shadow:inset 0 -14px 0 rgba(43,29,28,0.18);display:flex;align-items:center;justify-content:center">
    <div style="width:132px;height:132px;display:flex;align-items:center;justify-content:center">${inner}</div></div>`, 'background:transparent');
  const svg = document.querySelector('body > div svg');
  if (svg) { svg.setAttribute('width', '132'); svg.setAttribute('height', '132'); svg.style.width = '132px'; svg.style.height = '132px'; }
  document.body.style.background = 'transparent';
  document.documentElement.style.background = 'transparent';
}

// ------------------------------------------------------------------ staging helpers

function cat(g, type, coat, x, z, st, { h = 0, sp = 0, y = 0, look = -1 } = {}) {
  const i = g.cats.length;
  g.cats.push({
    id: i, type, coat, gang: -1, size: TYPES[type]?.size ?? 1,
    x, z, h, sp, vx: Math.cos(h) * sp, vz: Math.sin(h) * sp, y, st, tt: 1, a: 0, b: 0, look, surprise: false, lureBy: -1, carrier: -1,
  });
  return g.cats[i];
}

function room(roomDef, opts = {}) {
  const g = createGame({ room: roomDef, mode: opts.mode ?? 'level', cats: [], seed: 7, clock: 120, owners: opts.owners });
  return g;
}

const SCENES = {
  // a room card for the book (?poster=card-<n> or card-catlady): the whole room with its cats where they start
  card(view, stage, name) {
    const id = name.slice(5);
    const setup = id === 'catlady' ? catladySetup() : levelSetup(Number(id)) ?? levelSetup(1);
    const g = createGame({ room: setup.room, mode: 'level', cats: setup.cats, seed: 5, clock: 120, twists: setup.level?.twists });
    if (id === 'catlady') {
      const rng = { s: 23, next() { this.s = (this.s * 16807) % 2147483647; return this.s / 2147483647; } };
      const coats = ['ginger', 'tuxedo', 'calico', 'grey', 'tortie', 'black', 'white', 'siamese', 'cow', 'silver'];
      const placed = [];
      for (let i = 0; i < 10; i++) {
        const p = freeSpot(g.world, rng, { avoid: placed, gap: 1.3 });
        placed.push(p);
        cat(g, i % 4 === 3 ? 'kitten' : 'moggy', coats[i], p.x, p.z, i % 3 ? S.idle : S.walk, { h: rng.next() * 6.28, sp: i % 3 ? 0 : 1 });
      }
    }
    view.show(g, { people: [], me: -1, total: 'solo' });
    return { camera() { stage.frame(null, { snap: true }); stage.update(0); } };
  },
  // a look at one room (?poster=room&room=studio&x=6&z=4&span=9): a few cats about, the person by the door
  room(view, stage) {
    const q = new URLSearchParams(location.search);
    const id = q.get('room') ?? 'studio';
    const g = room(ROOMS[id] ?? ROOMS.studio);
    const rng = { s: 11, next() { this.s = (this.s * 16807) % 2147483647; return this.s / 2147483647; } };
    const coats = ['ginger', 'tuxedo', 'calico', 'grey', 'tortie', 'siamese', 'black', 'white'];
    const types = ['moggy', 'loaf', 'zoomer', 'scaredy', 'glutton', 'moggy', 'kitten', 'moggy'];
    const sts = [S.idle, S.sleep, S.walk, S.idle, S.idle, S.walk, S.idle, S.idle];
    const n = Number(q.get('cats') ?? 6);
    const placed = [];
    for (let i = 0; i < n; i++) {
      const p = freeSpot(g.world, rng, { avoid: placed, gap: 1.6 });
      placed.push(p);
      cat(g, types[i % types.length], coats[i % coats.length], p.x, p.z, sts[i % sts.length], { h: rng.next() * 6.28, sp: sts[i % sts.length] === S.walk ? 1.2 : 0 });
    }
    const np = Number(q.get('people') ?? 1);
    let me = null;
    for (let i = 0; i < np; i++) {
      const p = addPerson(g, { id: `p${i}`, x: g.room.entry.x + i * 1.1, z: g.room.entry.z + 0.6 });
      p.h = Math.PI / 2 + i * 0.6;
      p.sp = Number(q.get('psp') ?? 0);
      me ??= p;
    }
    view.show(g, { people: Array.from({ length: np }, (_, i) => ({ avatar: null, seed: 3 + i, look: SEATS[i % SEATS.length] })), me: 0 });
    const span = Number(q.get('span') ?? 0);
    return {
      me,
      camera() {
        if (span) stage.look(Number(q.get('x') ?? g.room.w / 2), Number(q.get('z') ?? g.room.d / 2), span);
        else { stage.frame(null, { snap: true }); stage.update(0); }
      },
    };
  },
  // the cover: a train of cats walked into the red carrier, one up on the sofa, the count on the shell
  cover(view, stage) {
    const g = room(ROOMS.studio);
    const k = g.carriers[0];
    const me = addPerson(g, { id: 'me', x: 6.9, z: 8.75 });
    me.h = Math.PI;
    me.sp = 3.2;
    cat(g, 'moggy', 'ginger', 2.35, 8.45, S.flee, { h: Math.PI + 0.05, sp: 2.4 });
    cat(g, 'moggy', 'tuxedo', 3.55, 8.85, S.flee, { h: Math.PI - 0.1, sp: 2.2 });
    cat(g, 'kitten', 'calico', 4.45, 8.2, S.flee, { h: Math.PI + 0.25, sp: 2.4 });
    cat(g, 'moggy', 'grey', 5.5, 8.65, S.alert, { h: Math.PI - 0.3, look: 0 });
    cat(g, 'moggy', 'calico', 3.7, 0.75, S.perch, { h: 0.6, y: 0.62 });
    cat(g, 'loaf', 'white', 4.6, 3.6, S.sleep, { h: 0.4 });
    cat(g, 'zoomer', 'black', 9.6, 5.2, S.sprint, { h: -0.4, sp: 6 });
    k.count = 3;
    g.total = 9;
    view.show(g, { people: [{ seed: 11 }], me: -1, total: 'solo' });
    return {
      camera: () => stage.look(5.6, 6.0, 8.6),
      after: () => overlay(`<div class="ink" style="position:absolute;right:46px;top:30px;text-align:right;font:900 128px/0.84 Fraunces,serif;letter-spacing:-0.02em">Herding<br>Cats</div>`),
    };
  },

  // close-up: treats! every cat in reach turns and trots to the bag
  action(view, stage) {
    const g = room(ROOMS.living);
    const me = addPerson(g, { id: 'me', x: 9.4, z: 9.2 });
    me.h = Math.PI * 0.75;
    cat(g, 'glutton', 'tortie', 7.4, 9.0, S.lured, { h: 0.1, sp: 2.6 });
    cat(g, 'moggy', 'ginger', 9.2, 7.1, S.lured, { h: Math.PI / 2 - 0.1, sp: 2.2 });
    cat(g, 'kitten', 'white', 10.9, 8.1, S.lured, { h: Math.PI * 0.8, sp: 2.4 });
    cat(g, 'moggy', 'black', 8.0, 10.9, S.content, { h: -0.7, look: 0 });
    cat(g, 'moggy', 'siamese', 11.3, 10.6, S.lured, { h: -Math.PI * 0.75, sp: 2 });
    view.show(g, { people: [{ seed: 11 }], me: 0, total: 'solo' });
    return {
      before: (i) => {
        if (i === 82) { me.treatsSeq = 1; view.event({ k: 'treats', x: me.x, z: me.z }, { quiet: true }); }
      },
      camera: () => stage.look(9.3, 9.0, 5.4),
    };
  },

  // all in: the carrier shut and wobbling, the count full, confetti
  win(view, stage) {
    const g = room(ROOMS.bedroom);
    const k = g.carriers[0];
    const me = addPerson(g, { id: 'me', x: 3.9, z: 10.9 });
    me.h = Math.PI;
    k.count = 6;
    g.total = 6;
    k.shutT = 0.4;
    cat(g, 'moggy', 'ginger', 1.75, 10.5, S.enter, { h: Math.PI, sp: 0 }).tt = 0.18;
    view.show(g, { people: [{ seed: 11 }], me: -1, total: 'solo' });
    return {
      before: (i) => {
        if (i === 40) { me.clapSeq = 1; view.carriers[0].gulp(); }
        if (i === 56) view.hints.confetti(k.x + 0.6, k.z - 0.4, ['#e5493a', '#f6b941', '#fff3df', '#4f9a5e']);
        if (i === 68) view.hints.confetti(k.x + 1.5, k.z + 0.5, ['#e5493a', '#f6b941', '#fff3df', '#3f7fcb']);
        if (i === 76) view.hints.stars(k.x + 0.4, k.z + 0.2);
      },
      camera: () => stage.look(2.05, 9.25, 5.2),
      after: () => overlay(`<div style="position:absolute;right:70px;top:110px;text-align:center">
        <div class="ink" style="font:900 112px/1 Fraunces,serif">All in!</div>
        <div style="display:flex;gap:14px;justify-content:center;margin-top:18px">${star(true, 96)}${star(true, 96)}${star(true, 96)}</div></div>`),
    };
  },

  // versus: four carriers in their owners' colours, four herders, cats everywhere
  multi(view, stage) {
    const def = arena('loft', 4);
    const g = createGame({ room: def, mode: 'versus', cats: [], seed: 7, clock: 120, owners: ['a', 'b', 'c', 'd'] });
    const counts = [5, 3, 4, 2];
    g.carriers.forEach((k, i) => { k.count = counts[i]; });
    const spots = [[12, 4.1, -Math.PI / 2], [4.0, 10.6, Math.PI], [12.6, 15.6, Math.PI / 2], [19.6, 9.4, 0]];
    spots.forEach(([x, z, h], i) => { const p = addPerson(g, { id: 'abcd'[i], seat: 'abcd'[i], x, z }); p.h = h; p.sp = 3; });
    const coats = ['ginger', 'grey', 'tuxedo', 'calico', 'black', 'white', 'tortie', 'siamese'];
    const cs = [[12.1, 2.6, -Math.PI / 2, S.flee], [11.4, 3.0, -Math.PI / 2 + 0.3, S.flee], [2.6, 10.2, Math.PI, S.flee], [2.9, 11.4, Math.PI - 0.3, S.flee],
      [12.4, 17.0, Math.PI / 2, S.flee], [21.0, 9.8, 0, S.flee], [8, 7, 0.4, S.walk], [15.5, 6.5, 2.4, S.idle], [7.4, 13.6, -1, S.walk], [16.6, 13.4, 3.6, S.lured]];
    cs.forEach(([x, z, h, st], i) => cat(g, i === 6 ? 'glutton' : i === 9 ? 'kitten' : 'moggy', coats[i % coats.length], x, z, st, { h, sp: st === S.flee ? 2.4 : st === S.idle ? 0 : 1.2 }));
    view.show(g, { looks: SEATS.slice(0, 4), people: [11, 12, 13, 14].map((seed, i) => ({ seed, look: SEATS[i] })), me: -1, total: 'versus' });
    return { camera: () => stage.look(12, 10, 17.5) };
  },

  // the icon: the carrier and a cat on its doormat, nothing else
  icon(view, stage) {
    const g = room(ROOMS.studio);
    const k = g.carriers[0];
    cat(g, 'moggy', 'ginger', k.matX + 0.25, k.matZ + 0.05, S.content, { h: Math.PI * 0.82 });
    view.show(g, { people: [], me: -1, total: 'solo' });
    view.carriers[0].sign.visible = false;
    g.people.length = 0;
    return { camera: () => stage.look(k.x + 0.62, k.z, 3.2) };
  },
};
