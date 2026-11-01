// The game's screens in the DOM: built from small pieces, in the world's language (stencilled numbers, tickets, stamps,
// the wall clock, the carrier glyph). main.js decides what shows; nothing here keeps game state.

import { symbolSvg, PATHS } from './symbols.js';
import { LEVELS } from '../sim/levels.js';

export const $ui = () => document.getElementById('ui');

export function el(tag, cls = '', html = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** A block button: label, optional key cap, click. */
export function button(label, { cls = '', key = null, onClick = null } = {}) {
  const b = el('button', `btn ${cls}`);
  b.type = 'button';
  b.innerHTML = `<span>${esc(label)}</span>${key ? `<span class="cap">${esc(key)}</span>` : ''}`;
  if (onClick) b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
  return b;
}

export const star = (on, size = 30) => symbolSvg('star', on ? '#f6b941' : '#d8c9b2', '#2b1d1c', size);

export function stars(n, size = 22) {
  return `<span class="stars">${[0, 1, 2].map((i) => star(i < n, size)).join('')}</span>`;
}

/** The carrier seen from the side, in a colour, with a symbol on its shell. */
export function carrierSvg(color = '#e5493a', symbol = null) {
  const sym = symbol ? `<g transform="translate(13 15) scale(0.72)"><path d="${PATHS[symbol] ?? PATHS.paw}" fill="#fff3df" fill-rule="evenodd" stroke="#2b1d1c" stroke-width="2.6" stroke-linejoin="round" paint-order="stroke"/></g>` : '';
  return `<svg viewBox="0 0 60 52" aria-hidden="true">
    <path d="M22 9a8 8 0 0 1 16 0" fill="none" stroke="#2b1d1c" stroke-width="4" stroke-linecap="round"/>
    <rect x="3" y="9" width="54" height="22" rx="8" fill="${color}" stroke="#2b1d1c" stroke-width="3"/>
    <rect x="3" y="27" width="54" height="21" rx="7" fill="#fff3df" stroke="#2b1d1c" stroke-width="3"/>
    <path d="M45 14v30M50 14v30M41 19h13M41 26h13M41 33h13M41 40h13" stroke="#2b1d1c" stroke-width="2"/>
    ${sym}
  </svg>`;
}

export function rosette() {
  return `<svg class="ros" viewBox="0 0 30 30" aria-hidden="true"><path d="M8 18l-3 11 5-3 3 4 2-10zM22 18l3 11-5-3-3 4-2-10z" fill="#e5493a" stroke="#2b1d1c" stroke-width="2" stroke-linejoin="round"/><circle cx="15" cy="13" r="10" fill="#f6b941" stroke="#2b1d1c" stroke-width="2.5"/><circle cx="15" cy="13" r="5" fill="#fff3df" stroke="#2b1d1c" stroke-width="2"/></svg>`;
}

/** The wall clock face: a cream dial, an espresso rim, gold notches at the star times, a red hand. */
export function clockFace() {
  const wrap = el('div', 'clock');
  wrap.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="29" fill="#fff3df" stroke="#2b1d1c" stroke-width="5"/>
    <g class="ticks">${Array.from({ length: 12 }, (_, i) => `<rect x="31" y="7" width="2" height="5" fill="#2b1d1c" transform="rotate(${i * 30} 32 32)"/>`).join('')}</g>
    <g class="notches"></g>
    <path class="sweep" fill="#f6b941" opacity="0.35"/>
    <line class="hand" x1="32" y1="32" x2="32" y2="10" stroke="#e5493a" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="32" cy="32" r="3.5" fill="#2b1d1c"/>
  </svg><span class="t num ink">2:00</span>`;
  const hand = wrap.querySelector('.hand');
  const notchG = wrap.querySelector('.notches');
  const t = wrap.querySelector('.t');
  let last = '';
  return {
    root: wrap,
    /** fractions of the dial (0-1 from the top) where a star drops */
    notches(list) {
      notchG.innerHTML = list.map((f) => `<path d="M32 3l4 6h-8z" fill="#f6b941" stroke="#2b1d1c" stroke-width="1.6" stroke-linejoin="round" transform="rotate(${f * 360} 32 32)"/>`).join('');
    },
    set(secondsLeft, total) {
      const s = Math.max(0, secondsLeft);
      const used = total > 0 ? 1 - s / total : 0;
      hand.setAttribute('transform', `rotate(${used * 360} 32 32)`);
      const txt = fmt(s);
      if (txt !== last) { t.textContent = txt; last = txt; }
      wrap.classList.toggle('warn', s <= 30 && s > 0);
      wrap.classList.toggle('pulse', s <= 10 && s > 0);
    },
  };
}

export function fmt(sec) {
  const s = Math.max(0, Math.ceil(sec - 1e-6));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtTime(sec) {
  if (sec == null || !Number.isFinite(sec)) return '-';
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

const INTRO_SYMBOL = { loaf: 'moon', glutton: 'fish', zoomer: 'bolt', scaredy: 'heart', kitten: 'paw', boss: 'crown' };

/** The Appointment Book: 15 cards. */
export function bookCards(progress, { onPick }) {
  const frag = document.createDocumentFragment();
  let nextMarked = false;
  for (const L of LEVELS) {
    const rec = progress.levels[L.n];
    const open = L.n === 1 || (progress.levels[L.n - 1]?.stars ?? 0) > 0;
    const isNext = open && !(rec?.stars > 0) && !nextMarked;
    if (isNext) nextMarked = true;
    const c = el('button', `card${open ? '' : ' locked'}${isNext ? ' next' : ''}`);
    c.type = 'button';
    const sym = L.intro ? symbolSvg(INTRO_SYMBOL[L.intro] ?? 'paw', '#fff3df', '#2b1d1c', 30) : '';
    c.innerHTML = `<span class="n">${L.n}</span><span class="nm">${esc(L.name)}</span>
      <span class="ft">${open ? stars(rec?.stars ?? 0, 20) : symbolSvg('lock', '#2b1d1c', '#2b1d1c', 22)}<span>${rec?.best ? fmtTime(rec.best) : ''}</span></span>${open ? sym : ''}`;
    if (open) c.addEventListener('click', () => onPick(L.n));
    else c.disabled = true;
    frag.appendChild(c);
  }
  return frag;
}

/** A stamp that thumps onto the screen at (x, y) and goes. */
export function stampAt(layer, text, x, y, { gold = false, life = 900, reducedMotion = false, cls = '' } = {}) {
  const s = el('div', `stamp${gold ? ' gold' : ''}${cls ? ` ${cls}` : ''}`, esc(text));
  s.style.left = `${x}px`;
  s.style.top = `${y}px`;
  layer.appendChild(s);
  if (!reducedMotion) {
    s.animate([
      { transform: 'translate(-50%, -50%) rotate(-8deg) scale(2.2)', opacity: 0 },
      { transform: 'translate(-50%, -50%) rotate(-8deg) scale(0.92)', opacity: 1, offset: 0.25 },
      { transform: 'translate(-50%, -50%) rotate(-8deg) scale(1)', opacity: 1, offset: 0.4 },
      { transform: 'translate(-50%, -70%) rotate(-8deg) scale(1)', opacity: 0 },
    ], { duration: life, easing: 'ease-out' });
  }
  setTimeout(() => s.remove(), life);
  return s;
}
