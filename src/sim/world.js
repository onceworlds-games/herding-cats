// The room as something to bump into: solids (furniture and carriers as boxes), the walls, clearance grids for quick
// "is this free?" questions, line-of-sight and grid paths for the herder brain.

import { KIT, footprint } from './kit.js';
import { CARRIER, CAT, PERSON, DOOR } from './tuning.js';
import { dirVec } from './rooms.js';

const CELL = 0.25;

export function buildWorld(room) {
  const solids = [];
  for (const it of room.items ?? []) {
    const k = KIT[it.k];
    if (!k || k.flat) continue;
    const fp = footprint(it);
    solids.push({
      x0: it.x - fp.w / 2, z0: it.z - fp.d / 2, x1: it.x + fp.w / 2, z1: it.z + fp.d / 2,
      h: it.h ?? k.h, kind: it.k, perch: it.h && it.h < 1.2 && it.k === 'wall' ? 0 : k.perch ?? 0, hide: !!k.hide, open: !!k.open,
      props: k.props ?? 0, water: !!k.water, tall: !!k.tall && !(it.h && it.h < 1.5), item: it,
    });
  }
  const carriers = (room.carriers ?? []).map((c, i) => makeCarrier(c, i));
  for (const c of carriers) solids.push({ ...c.box, h: CARRIER.height, kind: 'carrier', carrier: c.index, perch: 0, props: 0 });
  const world = { w: room.w, d: room.d, solids, carriers, room };
  world.catGrid = clearance(world, CAT.radius);
  world.personGrid = clearance(world, PERSON.radius);
  world.pathGrid = clearance(world, PERSON.radius + 0.05, 0.5);
  world.catPathGrid = clearance(world, CAT.radius + 0.12, 0.5);
  return world;
}

export function makeCarrier(def, index) {
  const [nx, nz] = dirVec(def.dir);
  const half = CARRIER.len / 2;
  const hw = CARRIER.wid / 2;
  const ex = Math.abs(nx) * half + Math.abs(nz) * hw;
  const ez = Math.abs(nz) * half + Math.abs(nx) * hw;
  return {
    index, x: def.x, z: def.z, dir: def.dir, nx, nz,
    doorX: def.x + nx * half, doorZ: def.z + nz * half,
    matX: def.x + nx * (half + DOOR.matD / 2), matZ: def.z + nz * (half + DOOR.matD / 2),
    box: { x0: def.x - ex, z0: def.z - ez, x1: def.x + ex, z1: def.z + ez },
  };
}

function clearance(world, r, cell = CELL) {
  const cols = Math.ceil(world.w / cell);
  const rows = Math.ceil(world.d / cell);
  const grid = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = (i + 0.5) * cell;
      const z = (j + 0.5) * cell;
      grid[j * cols + i] = overlaps(world, x, z, r) ? 1 : 0;
    }
  }
  return { cols, rows, cell, grid };
}

export function overlaps(world, x, z, r, skip = -1) {
  if (x < r || z < r || x > world.w - r || z > world.d - r) return true;
  const s = world.solids;
  for (let i = 0; i < s.length; i++) {
    if (i === skip) continue;
    const b = s[i];
    const cx = x < b.x0 ? b.x0 : x > b.x1 ? b.x1 : x;
    const cz = z < b.z0 ? b.z0 : z > b.z1 ? b.z1 : z;
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}

function gridAt(g, x, z) {
  const i = Math.floor(x / g.cell);
  const j = Math.floor(z / g.cell);
  if (i < 0 || j < 0 || i >= g.cols || j >= g.rows) return 1;
  return g.grid[j * g.cols + i];
}

export const blockedCat = (world, x, z) => gridAt(world.catGrid, x, z) === 1;
export const blockedPerson = (world, x, z) => gridAt(world.personGrid, x, z) === 1;

/** Push a circle out of the walls and every solid. Returns the contact normal (0, 0 when free). */
export function resolve(world, pos, r, skip = -1) {
  let nx = 0;
  let nz = 0;
  for (let pass = 0; pass < 2; pass++) {
    if (pos.x < r) { pos.x = r; nx += 1; }
    if (pos.z < r) { pos.z = r; nz += 1; }
    if (pos.x > world.w - r) { pos.x = world.w - r; nx -= 1; }
    if (pos.z > world.d - r) { pos.z = world.d - r; nz -= 1; }
    const s = world.solids;
    for (let i = 0; i < s.length; i++) {
      if (i === skip) continue;
      const b = s[i];
      if (pos.x < b.x0 - r || pos.x > b.x1 + r || pos.z < b.z0 - r || pos.z > b.z1 + r) continue;
      const cx = pos.x < b.x0 ? b.x0 : pos.x > b.x1 ? b.x1 : pos.x;
      const cz = pos.z < b.z0 ? b.z0 : pos.z > b.z1 ? b.z1 : pos.z;
      let dx = pos.x - cx;
      let dz = pos.z - cz;
      const dd = dx * dx + dz * dz;
      if (dd >= r * r) continue;
      if (dd > 1e-9) {
        const d = Math.sqrt(dd);
        dx /= d;
        dz /= d;
        pos.x = cx + dx * r;
        pos.z = cz + dz * r;
      } else {
        // inside: out along the shortest axis
        const l = pos.x - b.x0;
        const rr = b.x1 - pos.x;
        const t = pos.z - b.z0;
        const bb = b.z1 - pos.z;
        const m = Math.min(l, rr, t, bb);
        dx = 0;
        dz = 0;
        if (m === l) { pos.x = b.x0 - r; dx = -1; } else if (m === rr) { pos.x = b.x1 + r; dx = 1; } else if (m === t) { pos.z = b.z0 - r; dz = -1; } else { pos.z = b.z1 + r; dz = 1; }
      }
      nx += dx;
      nz += dz;
    }
  }
  const l = Math.hypot(nx, nz);
  return l > 1e-6 ? { nx: nx / l, nz: nz / l } : { nx: 0, nz: 0 };
}

/** How far a cat can go from (x, z) along (dx, dz) (unit) before it's blocked, up to max. */
export function freeAhead(world, x, z, dx, dz, max) {
  const step = 0.12;
  for (let t = step; t <= max; t += step) {
    if (blockedCat(world, x + dx * t, z + dz * t)) return t - step;
  }
  return max;
}

/** The outward normal of whatever blocks near (x, z) (walls or the nearest solid face). */
export function normalNear(world, x, z, reach = 0.8) {
  let best = reach;
  let nx = 0;
  let nz = 0;
  const walls = [[x, 1, 0], [z, 0, 1], [world.w - x, -1, 0], [world.d - z, 0, -1]];
  for (const [dist, wx, wz] of walls) if (dist < best) { best = dist; nx = wx; nz = wz; }
  for (const b of world.solids) {
    const cx = x < b.x0 ? b.x0 : x > b.x1 ? b.x1 : x;
    const cz = z < b.z0 ? b.z0 : z > b.z1 ? b.z1 : z;
    const d = Math.hypot(x - cx, z - cz);
    if (d < best && d > 1e-6) { best = d; nx = (x - cx) / d; nz = (z - cz) / d; }
  }
  return { nx, nz, dist: best };
}

export function lineClear(world, ax, az, bx, bz, cat = true) {
  const d = Math.hypot(bx - ax, bz - az);
  const n = Math.ceil(d / 0.2);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    if (cat ? blockedCat(world, x, z) : blockedPerson(world, x, z)) return false;
  }
  return true;
}

/** Grid path (8-way, A*) from a to b for a person (cat = false) or a cat. Waypoints in world units, or null. */
export function findPath(world, ax, az, bx, bz, cat = false) {
  const g = cat ? world.catPathGrid : world.pathGrid;
  const { cols, rows, cell, grid } = g;
  const clampI = (v, n) => Math.max(0, Math.min(n - 1, v));
  const toCell = (x, z) => [clampI(Math.floor(x / cell), cols), clampI(Math.floor(z / cell), rows)];
  let [si, sj] = toCell(ax, az);
  let [ti, tj] = toCell(bx, bz);
  const free = (i, j) => i >= 0 && j >= 0 && i < cols && j < rows && grid[j * cols + i] === 0;
  const nearestFree = (i, j) => {
    if (free(i, j)) return [i, j];
    for (let r = 1; r < 6; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (free(i + di, j + dj)) return [i + di, j + dj];
    return null;
  };
  const s = nearestFree(si, sj);
  const t = nearestFree(ti, tj);
  if (!s || !t) return null;
  [si, sj] = s;
  [ti, tj] = t;
  const n = cols * rows;
  const gScore = new Float32Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const open = [];
  const start = sj * cols + si;
  const goal = tj * cols + ti;
  gScore[start] = 0;
  const h = (i, j) => Math.hypot(i - ti, j - tj);
  open.push([h(si, sj), start]);
  let found = false;
  let guard = 0;
  while (open.length && guard++ < 20000) {
    // small open lists: a linear pop is fine
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
    const [, cur] = open[bi];
    open[bi] = open[open.length - 1];
    open.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === goal) { found = true; break; }
    const ci = cur % cols;
    const cj = (cur - ci) / cols;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di;
        const nj = cj + dj;
        if (!free(ni, nj)) continue;
        if (di && dj && (!free(ci + di, cj) || !free(ci, cj + dj))) continue;
        const k = nj * cols + ni;
        if (closed[k]) continue;
        const gs = gScore[cur] + (di && dj ? 1.4142 : 1);
        if (gs < gScore[k]) {
          gScore[k] = gs;
          came[k] = cur;
          open.push([gs + h(ni, nj), k]);
        }
      }
    }
  }
  if (!found) return null;
  const pts = [];
  for (let k = goal; k !== -1; k = came[k]) {
    const i = k % cols;
    const j = (k - i) / cols;
    pts.push({ x: (i + 0.5) * cell, z: (j + 0.5) * cell });
  }
  pts.reverse();
  pts[pts.length - 1] = { x: bx, z: bz };
  return smooth(world, pts, cat);
}

function smooth(world, pts, cat) {
  if (pts.length <= 2) return pts;
  const out = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !lineClear(world, pts[i].x, pts[i].z, pts[j].x, pts[j].z, cat)) j--;
    out.push(pts[j]);
    i = j;
  }
  return out;
}

/** The nearest spot under a hiding piece (and the point at its edge where the cat dives in). */
export function nearestHide(world, x, z, maxDist = 30) {
  let best = null;
  let bestD = maxDist;
  world.solids.forEach((b, index) => {
    if (!b.hide) return;
    const cx = x < b.x0 ? b.x0 : x > b.x1 ? b.x1 : x;
    const cz = z < b.z0 ? b.z0 : z > b.z1 ? b.z1 : z;
    const d = Math.hypot(x - cx, z - cz);
    if (d < bestD) {
      // the edge point, nudged out to where a cat can stand
      const nx = cx === b.x0 ? -1 : cx === b.x1 ? 1 : 0;
      const nz = cz === b.z0 ? -1 : cz === b.z1 ? 1 : 0;
      const ex = cx + nx * (CAT.radius + 0.05);
      const ez = cz + nz * (CAT.radius + 0.05);
      if (blockedCat(world, ex, ez)) return;
      bestD = d;
      best = { index, ex, ez, hx: cx - nx * 0.35, hz: cz - nz * 0.35, nx, nz };
    }
  });
  return best;
}

/** A free spot for a cat or person away from the given points. */
export function freeSpot(world, rng, opts = {}) {
  const margin = opts.margin ?? 1;
  const avoid = opts.avoid ?? [];
  const minGap = opts.gap ?? 2;
  for (let tries = 0; tries < 400; tries++) {
    const x = margin + rng.next() * (world.w - margin * 2);
    const z = margin + rng.next() * (world.d - margin * 2);
    if (blockedPerson(world, x, z)) continue;
    if (overlaps(world, x, z, 0.6)) continue;
    if (avoid.some((p) => Math.hypot(p.x - x, p.z - z) < (p.r ?? minGap))) continue;
    if (world.carriers.some((c) => Math.hypot(c.matX - x, c.matZ - z) < 2.6)) continue;
    return { x, z };
  }
  return { x: world.w / 2, z: world.d / 2 };
}

/** Is (x, z) on carrier c's doormat? Returns [out, across] in the door's frame or null. */
export function onMat(c, x, z) {
  const dx = x - c.doorX;
  const dz = z - c.doorZ;
  const out = dx * c.nx + dz * c.nz;
  const across = -dx * c.nz + dz * c.nx;
  if (out < -0.05 || out > DOOR.matD || Math.abs(across) > DOOR.matW / 2) return null;
  return [out, across];
}

/**
 * How far a cat has to walk from (x, z) to carrier k's doormat, round the furniture (cached per carrier). The herder
 * brain uses it to judge a shot by how much nearer it leaves the cat.
 */
export function walkToMat(world, k, x, z) {
  world.matFields ??= [];
  let f = world.matFields[k.index];
  const { cols, rows, cell, grid } = world.catPathGrid;
  if (!f) {
    f = new Float32Array(cols * rows).fill(Infinity);
    const free = (i, j) => i >= 0 && j >= 0 && i < cols && j < rows && grid[j * cols + i] === 0;
    // Dijkstra over the grid from the mat's cells (8-way; small grids, a simple bucket queue is plenty)
    const queue = [];
    const mx = k.doorX + k.nx * 0.6;
    const mz = k.doorZ + k.nz * 0.6;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        if (!free(i, j)) continue;
        const x0 = (i + 0.5) * cell;
        const z0 = (j + 0.5) * cell;
        if (Math.hypot(x0 - mx, z0 - mz) < 0.8) { f[j * cols + i] = 0; queue.push(j * cols + i); }
      }
    }
    for (let qi = 0; qi < queue.length; qi++) {
      const cur = queue[qi];
      const ci = cur % cols;
      const cj = (cur - ci) / cols;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di;
          const nj = cj + dj;
          if (!free(ni, nj)) continue;
          if (di && dj && (!free(ci + di, cj) || !free(ci, cj + dj))) continue;
          const nk = nj * cols + ni;
          const d = f[cur] + (di && dj ? 1.4142 : 1) * cell;
          if (d < f[nk] - 1e-6) { f[nk] = d; queue.push(nk); }
        }
      }
    }
    world.matFields[k.index] = f;
  }
  const i = Math.floor(x / cell);
  const j = Math.floor(z / cell);
  let best = Infinity;
  for (let r = 0; r < 3 && best === Infinity; r++) {
    for (let dj = -r; dj <= r; dj++) {
      for (let di = -r; di <= r; di++) {
        const ii = i + di;
        const jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= cols || jj >= rows) continue;
        const v = f[jj * cols + ii];
        if (v < best) best = v + r * cell;
      }
    }
  }
  return best;
}
