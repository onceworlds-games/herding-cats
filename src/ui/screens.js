// The screens round play: the herder's card (level, XP, what's next, today's goals), the Appointment Book with its room
// pictures, the Daily ticket, the wardrobe, the Cat-alog and the results. Built from data main.js hands over; nothing here
// keeps game state. Names and labels go in through textContent or esc().

import { el, esc, button, fmt, fmtTime } from './ui.js';
import { icon, challengeIcon, itemIcon, sheetStyle } from './icons.js';
import { LEVELS } from '../sim/levels.js';
import { CHALLENGES } from '../meta/challenges.js';
import { ITEM, byKind, KINDS, LEVEL_ITEMS, nextUnlock } from '../meta/herder.js';
import { PAGES, pageState, entryName, rarityOf, TYPE_NAMES } from '../meta/catalog.js';
import { STAR, starCount } from '../meta/progress.js';
import { COAT_INFO } from '../sim/coats.js';

const KIND_NAMES = { hat: 'Hats', carrier: 'Carriers', clap: 'Claps', trail: 'Trails' };
const TWIST_NAMES = { laser: 'Laser pointer', vacuum: 'Robot vacuum', bell: 'Doorbell', boxes: 'Boxes', none: 'Just cats' };
const TWIST_ICON = { laser: 'laser', vacuum: 'vacuum', bell: 'bell', boxes: 'box', none: 'paw' };

/** The picture of a thing you can wear: a rendered hat or carrier, or a drawn clap or trail. */
export function itemPicture(it, size = 72) {
  if (!it) return '';
  if (it.kind === 'hat' && !it.look) return `<span class="pic none" style="width:${size}px;height:${size}px">${icon('hanger', { size: size * 0.5 })}</span>`;
  if (it.kind === 'hat' || it.kind === 'carrier') return `<span class="pic" style="width:${size}px;height:${size}px;${sheetStyle('wear', it.kind, it.id, size)}"></span>`;
  return `<span class="pic drawn" style="width:${size}px;height:${size}px">${itemIcon(it, size * 0.8)}</span>`;
}

/** A cat's portrait from the Cat-alog sheet (kind 'type' or 'coat'). */
export function catPicture(kind, id, size = 64, cls = '') {
  return `<span class="cat-pic ${cls}" style="width:${size}px;height:${size}px;${sheetStyle('cats', kind, id, size)}"></span>`;
}

/** Where a thing comes from, for the wardrobe's locked tiles. */
function source(it) {
  const lv = Object.entries(LEVEL_ITEMS).find(([, id]) => id === it.id)?.[0];
  if (lv) return { pic: 'lock', text: `Level ${lv}` };
  const page = PAGES.find((p) => p.reward === it.id);
  return { pic: 'catalog', text: page ? page.name : '' };
}

// ------------------------------------------------------------------ the herder's card
/** h: { level, into, next }, opts: { compact, wearing, onClick } */
export function herderCard(h, { compact = false, onClick = null } = {}) {
  const root = el(onClick ? 'button' : 'div', `herder${compact ? ' compact' : ''}${onClick ? ' live' : ''}`);
  if (onClick) { root.type = 'button'; root.addEventListener('click', (e) => { e.stopPropagation(); onClick(); }); }
  const pct = h.next ? Math.round((h.into / h.next) * 100) : 100;
  const nx = nextUnlock(h.level);
  root.innerHTML = `<span class="lv">${icon('xp', { fill: '#f6b941', size: 58 })}<b class="num">${h.level}</b></span>
    <span class="hx">
      <span class="ttl">Herder level ${h.level}</span>
      <span class="bar"><i style="width:${pct}%"></i></span>
      ${nx && !compact ? `<span class="nx">${itemPicture(nx.item, 30)}<span>${esc(nx.item.name)} <em>at ${nx.level}</em></span></span>` : ''}
    </span>`;
  return root;
}

/** Today's three goals. */
export function goalsBox(goals) {
  const root = el('div', 'goals');
  const done = goals.filter((g) => g.done).length;
  root.innerHTML = `<div class="gh"><span>Today's goals</span><span class="num">${done}/3</span></div>`;
  for (const g of goals) {
    const row = el('div', `goal${g.done ? ' done' : ''}`);
    row.innerHTML = `<span class="gi">${icon(g.done ? 'tick' : 'goal', { fill: g.done ? '#f6b941' : '#fff3df', size: 22 })}</span><span class="gl"></span><span class="gn num">${g.done ? '' : `${g.have}/${g.n}`}</span>`;
    row.querySelector('.gl').textContent = g.label;
    root.appendChild(row);
  }
  return root;
}

// ------------------------------------------------------------------ the Daily ticket
/** d: dailySetup(day); rec: { s, time } today; streak; opts: { onClick, herders, picture } */
export function dailyTicket(d, rec, streak, { onClick = null, herders = null, locked = false } = {}) {
  const b = el('button', `daily live${locked ? ' locked' : ''}`);
  b.type = 'button';
  const level = LEVELS.find((L) => L.room === d.roomId);
  const ch = CHALLENGES[d.challenge];
  b.innerHTML = `<span class="pic" style="background-image:url(ui/rooms/${level ? level.n : 1}.jpg)"></span>
    <span class="body">
      <span class="k">Daily</span>
      <span class="day num">${esc(d.name)}</span>
      <span class="row">${icon(TWIST_ICON[d.twist] ?? 'paw', { size: 20 })}<span>${esc(TWIST_NAMES[d.twist] ?? '')}</span></span>
      <span class="row">${challengeIcon(ch?.icon, { size: 20 })}<span>${esc(ch?.label ?? '')}</span></span>
    </span>
    <span class="side">
      <span class="streak${streak > 0 ? ' on' : ''}">${icon('flame', { fill: streak > 0 ? '#ff8a3d' : '#d8c9b2', size: 30 })}<b class="num">${streak}</b></span>
      ${sockets(rec?.s ?? 0, d.challenge, 18)}
      <span class="best num">${rec?.time ? fmtTime(rec.time) : ''}</span>
    </span>
    <span class="faces">${d.cats.slice(0, 7).map((c) => catPicture('type', c.type, 30)).join('')}</span>
    ${herders ? `<span class="crowd num">${herders} today</span>` : ''}
    ${locked ? `<span class="lock">${icon('lock', { size: 30 })}<span>After appointment 3</span></span>` : ''}`;
  if (onClick && !locked) b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
  else b.disabled = true;
  return b;
}

/** Three star sockets: a carrier (all in), a clock (par), the challenge's own picture. */
export function sockets(mask, challenge, size = 22) {
  const ch = CHALLENGES[challenge];
  const on = (bit) => (mask & bit) !== 0;
  const col = (bit) => (on(bit) ? '#f6b941' : '#6b5550');
  return `<span class="sockets">
    <span class="sk${on(STAR.allIn) ? ' on' : ''}">${icon('carrier', { fill: col(STAR.allIn), size })}</span>
    <span class="sk${on(STAR.par) ? ' on' : ''}">${icon('clockface', { fill: col(STAR.par), size })}</span>
    <span class="sk${on(STAR.challenge) ? ' on' : ''}">${challengeIcon(ch?.icon, { fill: col(STAR.challenge), size })}</span>
  </span>`;
}

// ------------------------------------------------------------------ the Appointment Book
/** progress: the save; onPick(n). */
export function bookGrid(progress, { onPick }) {
  const frag = document.createDocumentFragment();
  let nextMarked = false;
  for (const L of LEVELS) {
    const rec = progress.levels[L.n];
    const open = L.n === 1 || ((progress.levels[L.n - 1]?.s ?? 0) & STAR.allIn) !== 0;
    const done = ((rec?.s ?? 0) & STAR.allIn) !== 0;
    const isNext = open && !done && !nextMarked;
    if (isNext) nextMarked = true;
    const c = el('button', `appt${open ? '' : ' locked'}${isNext ? ' next' : ''}${starCount(rec?.s ?? 0) === 3 ? ' full' : ''}`);
    c.type = 'button';
    const types = [...new Set(L.cats.map((x) => x.type))];
    c.innerHTML = `<span class="img" style="background-image:url(ui/rooms/${L.n}.jpg)">
        <span class="n num">${L.n}</span>
        ${L.intro && open ? `<span class="new">${catPicture('type', L.intro, 44)}</span>` : ''}
        <span class="who">${types.map((t) => catPicture('type', t, 26)).join('')}</span>
        ${open ? '' : `<span class="lk">${icon('lock', { size: 30 })}</span>`}
      </span>
      <span class="foot">
        <span class="nm"></span>
        <span class="meta">${open ? sockets(rec?.s ?? 0, L.challenge, 22) : ''}${rec?.ros ? `<span class="ros">${icon('xp', { fill: '#f6b941', size: 22 })}</span>` : ''}${rec?.best ? `<span class="bt num">${fmtTime(rec.best)}</span>` : ''}</span>
      </span>`;
    c.querySelector('.nm').textContent = L.name;
    if (open) c.addEventListener('click', () => onPick(L.n));
    else c.disabled = true;
    frag.appendChild(c);
  }
  return frag;
}

// ------------------------------------------------------------------ the wardrobe
/**
 * owned: Set of item ids; wearing: { kind: id }; fresh: [ids]; tab; onTab(kind); onPick(item) (try it on);
 * onWear(item); picked: the item tried on (or null).
 */
export function wardrobePanel({ owned, wearing, fresh, tab, picked, onTab, onPick, onWear }) {
  const root = el('div', 'wardrobe live');
  const tabs = el('div', 'tabs');
  for (const k of KINDS) {
    const t = el('button', `tab${k === tab ? ' on' : ''}${byKind(k).some((it) => fresh.includes(it.id)) ? ' dot' : ''}`);
    t.type = 'button';
    t.textContent = KIND_NAMES[k];
    t.addEventListener('click', (e) => { e.stopPropagation(); onTab(k); });
    tabs.appendChild(t);
  }
  const grid = el('div', 'items');
  for (const it of byKind(tab)) {
    const have = owned.has(it.id);
    const on = wearing[it.kind] === it.id;
    const b = el('button', `item${have ? '' : ' locked'}${on ? ' on' : ''}${picked?.id === it.id ? ' picked' : ''}${fresh.includes(it.id) ? ' fresh' : ''}`);
    b.type = 'button';
    b.innerHTML = `${itemPicture(it, 76)}<span class="nm"></span>${have ? (on ? `<span class="tag">${icon('tick', { fill: '#f6b941', size: 18 })}</span>` : '') : `<span class="src">${icon(source(it).pic, { size: 16 })}${esc(source(it).text)}</span>`}`;
    b.querySelector('.nm').textContent = it.id === 'hat:none' ? 'Your own' : it.name;
    b.addEventListener('click', (e) => { e.stopPropagation(); if (have) onWear(it); else onPick(it); });
    grid.appendChild(b);
  }
  root.append(tabs, grid);
  return root;
}

// ------------------------------------------------------------------ the Cat-alog
/** book: { coats, types }; page index; onPage(i) */
export function catalogPanel(book, page, { onPage, rewardOwned }) {
  const root = el('div', 'catalog live');
  const tabs = el('div', 'tabs');
  PAGES.forEach((p, i) => {
    const st = pageState(p, book);
    const t = el('button', `tab${i === page ? ' on' : ''}${st.done ? ' full' : ''}`);
    t.type = 'button';
    t.innerHTML = `<span></span><span class="num">${st.have}/${st.of}</span>`;
    t.firstChild.textContent = p.name;
    t.addEventListener('click', (e) => { e.stopPropagation(); onPage(i); });
    tabs.appendChild(t);
  });
  const P = PAGES[page];
  const st = pageState(P, book);
  const grid = el('div', 'entries');
  for (const e of P.entries) {
    const n = (P.kind === 'type' ? book.types?.[e] : book.coats?.[e]) ?? 0;
    const rar = P.kind === 'coat' ? rarityOf(e) : 'type';
    const tile = el('div', `entry ${rar}${n ? '' : ' unseen'}`);
    tile.innerHTML = `${catPicture(P.kind, e, 132, 'big')}<span class="nm"></span><span class="ct num">${n ? `×${n}` : '?'}</span>${P.kind === 'coat' && COAT_INFO[e].rarity > 0 ? `<span class="rar">${esc(rar)}</span>` : ''}`;
    tile.querySelector('.nm').textContent = n ? entryName(P, e) : '???';
    grid.appendChild(tile);
  }
  const reward = ITEM[P.reward];
  const foot = el('div', `reward${st.done ? ' got' : ''}`);
  foot.innerHTML = `${itemPicture(reward, 54)}<span class="rt"><span class="k">${st.done ? 'Page complete' : 'Fill the page'}</span><b></b></span><span class="bar"><i style="width:${Math.round((st.have / st.of) * 100)}%"></i></span>${st.done && rewardOwned ? icon('tick', { fill: '#f6b941', size: 28 }) : ''}`;
  foot.querySelector('b').textContent = reward ? (reward.kind === 'hat' ? reward.name : `${reward.name} ${reward.kind}`) : '';
  root.append(tabs, grid, foot);
  return root;
}

// ------------------------------------------------------------------ the HUD's challenge chip
export function challengeChip(id) {
  const ch = CHALLENGES[id];
  const c = el('div', 'chip');
  c.innerHTML = `${challengeIcon(ch?.icon, { size: 26 })}<span></span>`;
  c.querySelector('span').textContent = ch?.label ?? '';
  return {
    root: c,
    set(state) {
      c.classList.toggle('done', state === 1);
      c.classList.toggle('lost', state === -1);
    },
  };
}

export { TWIST_NAMES, TWIST_ICON, TYPE_NAMES, fmt };
