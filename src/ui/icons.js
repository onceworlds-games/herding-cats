// Small pictures for the screens as inline SVG (24 × 24, cream on an espresso edge like the symbols): the star sockets,
// each challenge, the claps and trails you can wear, the streak flame. Pictures of cats, hats and carriers come from the
// rendered sheets in public/ui (see sheets.js).

import { PATHS } from './symbols.js';
import { SHEETS, SHEET_COLS, sheetIndex } from './sheetlist.js';

const INK = '#2b1d1c';
const circle = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
const star = (cx, cy, r, k = 0.45) => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const q = i % 2 ? r * k : r;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * q).toFixed(2)} ${(cy + Math.sin(a) * q).toFixed(2)}`;
  }
  return `${d}z`;
};

// shapes in the 24 box (filled, evenodd)
const SHAPES = {
  ...PATHS,
  carrier: 'M8 6.5a4 4 0 0 1 8 0h-2a2 2 0 0 0-4 0zM2.5 8h19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 21.5 20h-19A1.5 1.5 0 0 1 1 18.5v-9A1.5 1.5 0 0 1 2.5 8zM16 11v6h1.4v-6zm3 0v6h1.4v-6z',
  clockface: `${circle(12, 12, 10)}M11 6v7h6v-2h-4V6z`,
  note: 'M9 17.5a3.5 2.8 -20 1 1 -1-3.3V3h2c.5 3 5 3.5 5 8-1.5-2-3-2.6-4-2.7v9.2z',
  flower: `${circle(12, 6.5, 3.6)}${circle(17.2, 10.3, 3.6)}${circle(15.2, 16.4, 3.6)}${circle(8.8, 16.4, 3.6)}${circle(6.8, 10.3, 3.6)}${circle(12, 12, 2)}`,
  square: 'M6 5l11 2-2 12L4 17z',
  ring: `${circle(12, 12, 8)}${circle(12, 12, 5.6)}`,
  spark: 'M12 1.5l2.2 8.3 8.3 2.2-8.3 2.2-2.2 8.3-2.2-8.3L1.5 12l8.3-2.2z',
  dot: circle(12, 12, 6),
  box: 'M3 8l9-4 9 4v10l-9 4-9-4zM12 12l-7-3.2v8l7 3.2zm1.4 0v8l7-3.2v-8z',
  vacuum: `${circle(12, 13, 9)}${circle(12, 13, 3)}M10.5 3h3v3h-3z`,
  laser: `${circle(12, 12, 4)}M12 1v4M12 19v4M1 12h4M19 12h4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M4.2 19.8L7 17M17 7l2.8-2.8`,
  vase: 'M9 2h6v2.5c3 1.5 5 4.5 5 8.5 0 5-3.5 9-8 9s-8-4-8-9c0-4 2-7 5-8.5zm-3 12l12-2.5v-1L6 13z',
  bank: 'M3 3h2.5v18H3zM7 19l9.5-12.5L19 9 9.6 21.4zM17.5 4.5l4 .5-1 4z',
  chain: `${circle(7, 14, 4.5)}${circle(7, 14, 2.3)}${circle(17, 10, 4.5)}${circle(17, 10, 2.3)}M10.5 11.4l3.2-1.4.6 1.8-3.2 1.4z`,
  clap: 'M5 13c0-4 3-8 6-9l1.5 2c-2 1-3.5 3-3.6 5L14 4l1.8 1.2-4.2 7 5.8-5.6 1.4 1.4-5.6 5.6 6.4-3.8 1.1 1.8-6.4 4 5.2-1.5.6 2C14 20 10 21.5 8 20.5 6 19.5 5 16.5 5 13zM2 6l2.5 1M3.5 2.5L5 5M8 1l.5 2.5',
  noclap: 'M5 13c0-4 3-8 6-9l1.5 2c-2 1-3.5 3-3.6 5L14 4l1.8 1.2-4.2 7 5.8-5.6 1.4 1.4-5.6 5.6 6.4-3.8 1.1 1.8-6.4 4 5.2-1.5.6 2C14 20 10 21.5 8 20.5 6 19.5 5 16.5 5 13z',
  notreats: 'M6 6h12l-1.5 15h-9zM8 3h8v2H8z',
  loaf: 'M2.5 17c0-5 4.5-8.5 10-8.5 2 0 3.6.4 5 1.2l1.5-2.7 1 3.6c1.5 1.4 2.5 3.4 2.5 6.4zM15.5 13a1 1 0 1 0 0 2 1 1 0 1 0 0-2z',
  flame: 'M12 1.5c1 4 6.5 6.5 6.5 12.5a6.5 6.5 0 0 1-13 0c0-3 1.5-5 3-6.5 0 2 1 3.5 2.3 4C10 8.5 11.5 5 12 1.5z',
  xp: star(12, 12, 10.5, 0.58),
  goal: `${circle(12, 12, 10)}${circle(12, 12, 6.8)}${circle(12, 12, 3.4)}`,
  tick: 'M3 12.5l2.4-2.4 4.1 4.1L18.6 5l2.4 2.4L9.5 19z',
  catalog: 'M4 3h13a3 3 0 0 1 3 3v15H7a3 3 0 0 1-3-3zm3 15h11V6H7zm2-10h7v2H9z',
  hanger: 'M12 3a3 3 0 0 1 3 3c0 1.5-1 2.2-2 2.8v1.4l9.5 6.3c.9.6.5 2-.6 2H2.1c-1.1 0-1.5-1.4-.6-2l9.5-6.3V8c1-.6 2-1 2-2a1 1 0 1 0-2 0H9a3 3 0 0 1 3-3z',
};
const STROKED = new Set(['laser']);

/** One picture: fill colour, size in px, an espresso edge unless edge = false. */
export function icon(name, { fill = '#fff3df', size = 24, edge = true, cls = '' } = {}) {
  const d = SHAPES[name] ?? SHAPES.paw;
  if (STROKED.has(name)) {
    return `<svg class="ico ${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="5" stroke-linecap="round" paint-order="stroke"/><path d="${d}" fill="${fill}" stroke="${fill}" stroke-width="2" stroke-linecap="round"/></svg>`;
  }
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="${d}" fill="${fill}" fill-rule="evenodd"${edge ? ` stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" paint-order="stroke"` : ''}/></svg>`;
}

/** A challenge's icon: numbers for combos, a shape for the rest. */
export function challengeIcon(ch, { fill = '#fff3df', size = 24 } = {}) {
  if (ch === 'two' || ch === 'three' || ch === 'train') {
    const n = ch === 'two' ? '2' : ch === 'three' ? '3' : '4';
    return `<svg class="ico" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><text x="12" y="19" text-anchor="middle" font-family="Big Shoulders Stencil Display, Impact, sans-serif" font-weight="800" font-size="21" fill="${fill}" stroke="${INK}" stroke-width="3" paint-order="stroke">×${n}</text></svg>`;
  }
  return icon(ch, { fill, size });
}

// the clap and trail items as a little burst or a row of prints, in their own colours
export function itemIcon(it, size = 56) {
  if (!it) return '';
  if (it.kind === 'clap') {
    if (!it.fx) return `<svg class="ico" viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true"><circle cx="24" cy="24" r="17" fill="none" stroke="#fff3df" stroke-width="4" stroke-dasharray="3 5"/><circle cx="24" cy="24" r="9" fill="none" stroke="#ffd77a" stroke-width="3"/></svg>`;
    const parts = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      const r = i % 2 ? 15 : 11;
      const s = i % 2 ? 0.48 : 0.62;
      parts.push(`<g transform="translate(${(24 + Math.cos(a) * r - 12 * s).toFixed(1)} ${(24 + Math.sin(a) * r - 12 * s).toFixed(1)}) scale(${s})"><path d="${SHAPES[it.fx] ?? SHAPES.dot}" fill="${it.colors[i % it.colors.length]}" fill-rule="evenodd" stroke="${INK}" stroke-width="2.4" paint-order="stroke"/></g>`);
    }
    return `<svg class="ico" viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true"><circle cx="24" cy="24" r="6" fill="#fff3df" stroke="${INK}" stroke-width="2"/>${parts.join('')}</svg>`;
  }
  if (it.kind === 'trail') {
    if (!it.fx) return `<svg class="ico" viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true"><path d="M10 38L38 10" stroke="#fff3df" stroke-width="4" stroke-linecap="round" stroke-dasharray="2 7" opacity="0.5"/></svg>`;
    const parts = [];
    for (let i = 0; i < 4; i++) {
      const x = 6 + i * 10;
      const y = 32 - i * 7 + (i % 2 ? 4 : -4);
      parts.push(`<g transform="translate(${x} ${y}) scale(0.5) rotate(45 12 12)" opacity="${0.45 + i * 0.18}"><path d="${SHAPES[it.fx] ?? SHAPES.dot}" fill="${it.colors[i % it.colors.length]}" fill-rule="evenodd" stroke="${INK}" stroke-width="2.4" paint-order="stroke"/></g>`);
    }
    return `<svg class="ico" viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true">${parts.join('')}</svg>`;
  }
  return '';
}

/** A picture from a rendered sheet as a CSS background (cats: 'type' or 'coat'; wear: 'hat' or 'carrier'). */
export function sheetStyle(set, kind, id, size) {
  const i = sheetIndex(set, kind, id);
  if (i < 0) return '';
  const rows = Math.ceil(SHEETS[set].length / SHEET_COLS);
  const col = i % SHEET_COLS;
  const row = Math.floor(i / SHEET_COLS);
  return `background-image:url(ui/${set}.jpg);background-size:${SHEET_COLS * size}px ${rows * size}px;background-position:${-col * size}px ${-row * size}px`;
}
