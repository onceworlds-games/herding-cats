// Seat and cat symbols as 24×24 paths: the same shapes in the DOM (SVG) and on canvases (Path2D).

const circle = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;

export const PATHS = {
  fish: 'M2.5 12c3.2-5.2 9.5-6.4 13.6-2.6L21.5 5v14l-5.4-4.4C12 18.4 5.7 17.2 2.5 12z' + circle(8, 11, 1.3),
  yarn: circle(12, 12, 9) + 'M6 7.5c4 1 8 4 10.5 9.5l1.6-1.2C15.5 10.5 11 7.2 7 6zM4.2 12.5c3.5.2 6.5 2.4 8 6.8l1.9-.4c-1.6-5-5.2-7.8-9.6-8.2z',
  bell: 'M12 2.5c-4.2 0-6.6 3.2-6.6 7.3v3.9L3 17.4h18l-2.4-3.7V9.8c0-4.1-2.4-7.3-6.6-7.3zM9.4 19a2.6 2.6 0 0 0 5.2 0z',
  paw: circle(6, 9.5, 2.1) + circle(10, 5.8, 2.2) + circle(14, 5.8, 2.2) + circle(18, 9.5, 2.1) +
    'M12 10.5c-3.4 0-6.4 4.4-6.4 7.2 0 2 1.6 3 3.4 3 1.2 0 2-.6 3-.6s1.8.6 3 .6c1.8 0 3.4-1 3.4-3 0-2.8-3-7.2-6.4-7.2z',
  mouse: 'M3 16.5c0-4.4 4-7.8 8.5-7.8 3.4 0 6.2 1.8 7.4 4.6l2.6.6-1.6 2.6H3z' + circle(15.2, 7.6, 2.8) + 'M3 16.5c-1.4 1.6-1.6 3.4-.4 4.6l1-.8c-.6-.8-.4-1.8.6-2.8z',
  moon: 'M15.5 2.5a9.6 9.6 0 1 0 6 16.2A8 8 0 1 1 15.5 2.5z',
  crown: 'M2.5 7.5l5 4.2L12 4l4.5 7.7 5-4.2-2 12H4.5z',
  bolt: 'M13.5 1.5L4 13.8h6.2L8.2 22.5 20 9.4h-6.4l1.9-7.9z',
  star: 'M12 1.8l3.1 6.6 7.1.8-5.3 4.9 1.5 7.1L12 17.6l-6.4 3.6 1.5-7.1-5.3-4.9 7.1-.8z',
  heart: 'M12 21s-8.5-5.3-8.5-11.2C3.5 6.6 5.8 4.5 8.4 4.5c1.6 0 2.9.8 3.6 2 .7-1.2 2-2 3.6-2 2.6 0 4.9 2.1 4.9 5.3C20.5 15.7 12 21 12 21z',
  lock: 'M7 10V7.5a5 5 0 0 1 10 0V10h1.5v11h-13V10zm2.6 0h4.8V7.5a2.4 2.4 0 0 0-4.8 0z',
  cat: 'M4 3l4.2 4.4c1.2-.4 2.5-.6 3.8-.6s2.6.2 3.8.6L20 3v8.5c0 5.2-3.6 9-8 9s-8-3.8-8-9z',
  clock: circle(12, 12, 9.5) + 'M11 6h2v5.6l3.6 2.2-1 1.7L11 12.7z',
  check: 'M2.5 12.8l3.2-3.2 3.9 3.9 9-9 3.2 3.2L9.6 19.9z',
  arrow: 'M12 2l9 10h-5.5v10h-7V12H3z',
};

/** An inline SVG of a symbol: filled, with a dark outline so it reads on anything. */
export function symbolSvg(name, fill = '#fff3df', stroke = '#2b1d1c', size = 24) {
  const d = PATHS[name] ?? PATHS.paw;
  return `<svg class="sym" viewBox="-2 -2 28 28" width="${size}" height="${size}" aria-hidden="true"><path d="${d}" fill="${fill}" fill-rule="evenodd" stroke="${stroke}" stroke-width="2.2" stroke-linejoin="round" paint-order="stroke"/></svg>`;
}

const cache = new Map();
function path2d(name) {
  if (typeof Path2D === 'undefined') return null;
  if (!cache.has(name)) cache.set(name, new Path2D(PATHS[name] ?? PATHS.paw));
  return cache.get(name);
}

/** Draws a symbol centred at (x, y), `size` px across. */
export function drawSymbol(ctx, name, x, y, size, fill = '#fff3df', stroke = '#2b1d1c', line = 2.2) {
  const p = path2d(name);
  if (!p) return;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.lineJoin = 'round';
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = line * 2;
    ctx.stroke(p);
  }
  ctx.fillStyle = fill;
  ctx.fill(p, 'evenodd');
  ctx.restore();
}
