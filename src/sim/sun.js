// Windows and the patches of late sun they throw on the floor. The renderer puts its windows in the same places, and
// its sun travels the same way, so a patch the cats nap in is the patch you see.

import { KIT } from './kit.js';

export const SILL = 0.95;
export const WIN_TOP = 2.25;
export const WIN_W = 1.5;
// the way the light travels (x east, y up, z south), normalised
const SX = 0.62;
const SY = -0.5;
const SZ = 0.6;
const L = Math.hypot(SX, SY, SZ);
export const SUN = { x: SX / L, y: SY / L, z: SZ / L };
// how far along the floor a point at height y lands from the wall
const KX = SUN.x / -SUN.y;
const KZ = SUN.z / -SUN.y;

export function isOutdoor(room) {
  return room.wall === 'glass' || room.wall === 'white' || (room.wall === 'brick' && (room.floor === 'grass' || room.floor === 'stone'));
}

/** Where windows go along a wall: spots clear of tall things standing against it. */
export function windowSpots(len, blocked) {
  const out = [];
  const n = Math.max(1, Math.round(len / 4.5));
  const step = len / n;
  for (let i = 0; i < n; i++) {
    const c = step * (i + 0.5);
    for (const shift of [0, 0.7, -0.7, 1.4, -1.4]) {
      const x = c + shift;
      if (x - WIN_W / 2 < 0.6 || x + WIN_W / 2 > len - 0.4) continue;
      if (!blocked.some(([a, b]) => x + WIN_W / 2 + 0.1 > a && x - WIN_W / 2 - 0.1 < b)) { out.push(x); break; }
    }
  }
  return out;
}

/** The windows of a room: [{ axis: 'x' (north wall) | 'z' (west wall), c: centre along the wall }]. */
export function roomWindows(room, world) {
  if (isOutdoor(room)) return [];
  const near = (axis) => world.solids
    .filter((s) => s.item && (KIT[s.item.k]?.h ?? 0) > 1.2 && (axis === 'x' ? s.z0 < 1.2 : s.x0 < 1.2))
    .map((s) => (axis === 'x' ? [s.x0, s.x1] : [s.z0, s.z1]));
  return [
    ...windowSpots(room.w, near('x')).map((c) => ({ axis: 'x', c })),
    ...windowSpots(room.d, near('z')).map((c) => ({ axis: 'z', c })),
  ];
}

/** Each window's patch of sun on the floor: a parallelogram, with its middle (x, z) for cats to head for. */
export function sunPatches(room, world) {
  const out = [];
  for (const w of roomWindows(room, world)) {
    const mid = (SILL + WIN_TOP) / 2;
    const p = w.axis === 'x'
      ? { axis: 'x', c: w.c, x: w.c + KX * mid, z: KZ * mid }
      : { axis: 'z', c: w.c, x: KX * mid, z: w.c + KZ * mid };
    // furniture standing in it leaves no room to lie down
    if (p.x > room.w - 0.6 || p.z > room.d - 0.6) continue;
    if (world.solids.some((s) => p.x > s.x0 - 0.3 && p.x < s.x1 + 0.3 && p.z > s.z0 - 0.3 && p.z < s.z1 + 0.3)) continue;
    out.push(p);
  }
  return out;
}

/** Is (x, z) in this patch of sun? */
export function inSun(p, x, z) {
  if (p.axis === 'x') {
    const y = z / KZ;
    return y >= SILL && y <= WIN_TOP && Math.abs(x - KX * y - p.c) < WIN_W / 2;
  }
  const y = x / KX;
  return y >= SILL && y <= WIN_TOP && Math.abs(z - KZ * y - p.c) < WIN_W / 2;
}
