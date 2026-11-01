// A room as one diorama: the floor slab, the two standing walls with windows, and every piece of furniture merged into a
// handful of meshes (vertex colours), plus the little things on top that cats knock off.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { KIT } from '../sim/kit.js';
import { FLOORS, WALLS, FABRIC, C } from './palette.js';

const col = new THREE.Color();
const m4 = new THREE.Matrix4();
const q4 = new THREE.Quaternion();
const v3 = new THREE.Vector3();
const s3 = new THREE.Vector3();

// shared unit shapes
const BOX = new THREE.BoxGeometry(1, 1, 1);
const RBOX = new RoundedBoxGeometry(1, 1, 1, 2, 0.12);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
const CONE = new THREE.ConeGeometry(0.5, 1, 14);
const SPH = new THREE.SphereGeometry(0.5, 14, 10);
const TOR = new THREE.TorusGeometry(0.35, 0.12, 8, 18);

/** Collects coloured parts in a piece's own frame (x across, z depth with the front at +z, y up). */
class Parts {
  constructor() { this.list = []; }
  add(geo, color, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) {
    this.list.push({ geo, color, x, y, z, sx, sy, sz, ry, rx, rz });
    return this;
  }
  box(color, x, y, z, sx, sy, sz, ry = 0) { return this.add(BOX, color, x, y + sy / 2, z, sx, sy, sz, ry); }
  soft(color, x, y, z, sx, sy, sz, ry = 0) { return this.add(RBOX, color, x, y + sy / 2, z, sx, sy, sz, ry); }
  cyl(color, x, y, z, r, h, rz = 0) { return this.add(CYL, color, x, y + h / 2, z, r * 2, h, r * 2, 0, 0, rz); }
  ball(color, x, y, z, r, sy = 1) { return this.add(SPH, color, x, y, z, r * 2, r * 2 * sy, r * 2); }
  cone(color, x, y, z, r, h) { return this.add(CONE, color, x, y + h / 2, z, r * 2, h, r * 2); }
}

function legs(p, color, w, d, h, inset = 0.08, r = 0.04) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.cyl(color, sx * (w / 2 - inset), 0, sz * (d / 2 - inset), r, h);
}

const OAK = '#b77b45';
const OAK_DARK = '#7d5130';
const CREAM = '#f6ecda';
const IRON = '#3b302e';
const BOOKS = ['#c4473b', '#3f8a86', '#d9a23a', '#5b87c5', '#7fa276', '#8e3b46', '#efe2c8'];

/** Each piece of the kit, sized to its footprint. `prop(x, y, z)` marks a spot for a knockable thing on top. */
const BUILD = {
  rug(p, w, d, it) {
    const c = FABRIC[it.c] ?? FABRIC.teal;
    p.box(shade(c, -0.18), 0, 0, 0, w, 0.015, d);
    p.box(c, 0, 0.004, 0, w - 0.24, 0.015, d - 0.24);
    p.box(shade(c, 0.22), 0, 0.008, 0, w - 0.5, 0.015, d - 0.5);
  },
  sofa(p, w, d, it) {
    const c = FABRIC[it.c] ?? FABRIC.teal;
    p.soft(shade(c, -0.12), 0, 0.08, 0, w, 0.34, d);
    const n = w > 2 ? 3 : 1;
    const cw = (w - 0.5) / n;
    for (let i = 0; i < n; i++) p.soft(shade(c, 0.06), -w / 2 + 0.25 + cw * (i + 0.5), 0.38, 0.08, cw - 0.04, 0.16, d - 0.34);
    p.soft(c, 0, 0.3, -d / 2 + 0.14, w - 0.1, 0.55, 0.28);
    p.soft(shade(c, -0.05), -w / 2 + 0.12, 0.3, 0, 0.24, 0.32, d);
    p.soft(shade(c, -0.05), w / 2 - 0.12, 0.3, 0, 0.24, 0.32, d);
    legs(p, OAK_DARK, w, d, 0.08, 0.12, 0.035);
  },
  armchair(p, w, d, it) { BUILD.sofa(p, w, d, it); },
  bed(p, w, d, it) {
    const c = FABRIC[it.c] ?? FABRIC.blush;
    p.box(OAK, 0, 0, 0, w, 0.3, d);
    p.soft(CREAM, 0, 0.3, 0, w - 0.08, 0.2, d - 0.08);
    p.soft(c, 0, 0.42, 0.25, w - 0.02, 0.14, d * 0.62);
    p.soft('#ffffff', -w / 4 + 0.02, 0.48, -d / 2 + 0.36, w / 2 - 0.18, 0.12, 0.4);
    p.soft('#ffffff', w / 4 - 0.02, 0.48, -d / 2 + 0.36, w / 2 - 0.18, 0.12, 0.4);
    p.box(OAK_DARK, 0, 0, -d / 2 + 0.05, w + 0.06, 1.05, 0.1);
  },
  coffee(p, w, d, it, prop) {
    p.soft(OAK, 0, 0.36, 0, w, 0.08, d);
    legs(p, OAK_DARK, w, d, 0.36, 0.1);
    prop(-w * 0.2, 0.44, 0);
    prop(w * 0.22, 0.44, 0.05);
  },
  table(p, w, d, it, prop) {
    p.soft(OAK, 0, 0.7, 0, w, 0.07, d);
    legs(p, OAK_DARK, w, d, 0.7, 0.1, 0.045);
    prop(-w * 0.22, 0.77, 0);
    prop(w * 0.25, 0.77, -0.05);
  },
  desk(p, w, d, it, prop) {
    BUILD.table(p, w, d, it, prop);
    p.box(OAK, w * 0.25, 0.48, 0, w * 0.4, 0.22, d - 0.1);
  },
  cafetable(p, w, d, it, prop) {
    p.cyl(CREAM, 0, 0.7, 0, w / 2, 0.06);
    p.cyl(IRON, 0, 0, 0, 0.05, 0.7);
    p.cyl(IRON, 0, 0, 0, 0.25, 0.04);
    prop(0.1, 0.76, 0);
  },
  chair(p, w, d) {
    p.box(OAK, 0, 0.42, 0, w, 0.06, d);
    legs(p, OAK_DARK, w, d, 0.42, 0.05, 0.03);
    p.box(OAK, 0, 0.42, -d / 2 + 0.03, w, 0.5, 0.05);
  },
  sideboard(p, w, d, it, prop) {
    p.box(OAK, 0, 0.1, 0, w, 0.82, d);
    p.box(OAK_DARK, 0, 0, 0, w - 0.1, 0.1, d - 0.1);
    p.box(shade(OAK, 0.12), 0, 0.88, 0, w + 0.04, 0.06, d + 0.04);
    for (const x of [-w / 4, w / 4]) p.box(OAK_DARK, x, 0.45, d / 2, 0.08, 0.04, 0.02);
    prop(-w * 0.28, 0.94, 0);
    prop(w * 0.2, 0.94, 0);
  },
  tvunit(p, w, d, it, prop) {
    p.box(shade(OAK, -0.1), 0, 0.08, 0, w, 0.5, d);
    p.box(OAK_DARK, 0, 0, 0, w - 0.1, 0.08, d - 0.1);
    prop(w * 0.3, 0.58, 0);
  },
  bookshelf(p, w, d) {
    p.box(OAK_DARK, 0, 0, 0, w, 2.1, d);
    p.box(shade(OAK_DARK, -0.25), 0, 0.08, 0.02, w - 0.12, 1.94, d - 0.02);
    for (let s = 0; s < 5; s++) {
      const y = 0.1 + s * 0.4;
      p.box(OAK, 0, y, 0.02, w - 0.1, 0.04, d - 0.06);
      let x = -w / 2 + 0.12;
      let i = s * 3;
      while (x < w / 2 - 0.2) {
        const bw = 0.07 + ((i * 37) % 5) * 0.015;
        const bh = 0.24 + ((i * 53) % 4) * 0.025;
        p.box(BOOKS[i % BOOKS.length], x + bw / 2, y + 0.04, 0.05, bw, bh, d - 0.18);
        x += bw + 0.01;
        i++;
      }
    }
  },
  shelfrow(p, w, d) {
    p.box(OAK_DARK, 0, 0, 0, w, 2.0, d);
    for (let s = 0; s < 5; s++) {
      const y = 0.1 + s * 0.38;
      for (const side of [-1, 1]) {
        let x = -w / 2 + 0.1;
        let i = s * 5 + (side > 0 ? 2 : 0);
        while (x < w / 2 - 0.15) {
          const bw = 0.07 + ((i * 37) % 5) * 0.015;
          const bh = 0.22 + ((i * 53) % 4) * 0.025;
          p.box(BOOKS[i % BOOKS.length], x + bw / 2, y + 0.04, side * (d / 2 - 0.02), bw, bh, 0.06);
          x += bw + 0.012;
          i++;
        }
      }
    }
  },
  wardrobe(p, w, d) {
    p.box('#e8dcc4', 0, 0.06, 0, w, 2.14, d);
    p.box(OAK_DARK, 0, 0, 0, w - 0.06, 0.06, d - 0.06);
    p.box(shade('#e8dcc4', -0.12), 0, 0.12, d / 2, 0.02, 1.9, 0.02);
    for (const x of [-0.12, 0.12]) p.box('#b08a4a', x, 1.1, d / 2 + 0.02, 0.04, 0.18, 0.03);
  },
  fridge(p, w, d) {
    p.soft('#f2efe8', 0, 0, 0, w, 2.0, d);
    p.box('#d8d3c8', 0, 1.3, d / 2, w - 0.06, 0.02, 0.02);
    p.box('#9a948a', w / 2 - 0.14, 0.8, d / 2 + 0.02, 0.04, 0.4, 0.04);
    p.box('#9a948a', w / 2 - 0.14, 1.5, d / 2 + 0.02, 0.04, 0.3, 0.04);
  },
  counter(p, w, d, it, prop) {
    p.box('#7fa276', 0, 0.08, 0, w, 0.8, d);
    p.box(OAK_DARK, 0, 0, 0, w - 0.06, 0.08, d - 0.06);
    p.box('#f1ebe0', 0, 0.88, 0, w + 0.04, 0.07, d + 0.04);
    for (const x of [-w / 4, w / 4]) p.box('#e8e2d6', x, 0.55, d / 2, 0.16, 0.03, 0.02);
    prop(-w * 0.25, 0.95, 0);
    prop(w * 0.25, 0.95, 0);
  },
  plant(p, w) {
    p.cyl('#c56a3d', 0, 0, 0, w * 0.32, 0.4);
    p.cyl('#5e3d29', 0, 0.38, 0, w * 0.28, 0.03);
    const g = ['#4f9a5e', '#5fae68', '#3d7f4b'];
    p.ball(g[0], 0, 0.75, 0, 0.3, 1.2);
    p.ball(g[1], 0.15, 0.95, 0.08, 0.22);
    p.ball(g[2], -0.14, 1.05, -0.06, 0.2);
    p.ball(g[1], 0.02, 1.2, 0.0, 0.15);
  },
  lamp(p) {
    p.cyl(IRON, 0, 0, 0, 0.18, 0.04);
    p.cyl(IRON, 0, 0, 0, 0.025, 1.3);
    p.cone('#f3d9a6', 0, 1.2, 0, 0.24, 0.36);
  },
  box(p, w, d) {
    const c = '#c79a63';
    p.box(shade(c, -0.15), 0, 0, 0, w, 0.04, d);
    p.box(c, 0, 0, -d / 2 + 0.02, w, 0.6, 0.04);
    p.box(c, 0, 0, d / 2 - 0.02, w, 0.6, 0.04);
    p.box(shade(c, 0.08), -w / 2 + 0.02, 0, 0, 0.04, 0.6, d);
    p.box(shade(c, 0.08), w / 2 - 0.02, 0, 0, 0.04, 0.6, d);
    p.add(BOX, shade(c, 0.12), -w / 2 - 0.12, 0.62, 0, 0.3, 0.03, d, 0, 0, 0.6);
    p.add(BOX, shade(c, 0.12), w / 2 + 0.12, 0.62, 0, 0.3, 0.03, d, 0, 0, -0.6);
  },
  boxstack(p, w, d) {
    const c = '#c79a63';
    p.box(c, 0, 0, 0, w, 0.62, d);
    p.box(shade(c, 0.1), 0.05, 0.62, -0.03, w * 0.85, 0.55, d * 0.85, 0.2);
    p.box('#e9d7b1', 0, 0.3, d / 2 + 0.005, w * 0.5, 0.06, 0.01);
  },
  basket(p, w) {
    p.cyl('#b88a4e', 0, 0, 0, w / 2, 0.3);
    p.cyl('#e9d7b1', 0, 0.12, 0, w / 2 - 0.05, 0.2);
    p.add(TOR, '#9c7240', 0, 0.3, 0, w * 1.35, w * 1.35, 0.5, 0, Math.PI / 2);
  },
  washer(p, w, d) {
    p.soft('#f4f2ec', 0, 0, 0, w, 0.9, d);
    p.add(CYL, '#4a5866', 0, 0.45, d / 2, 0.5, 0.04, 0.5, 0, Math.PI / 2);
    p.add(CYL, '#9cc3d4', 0, 0.45, d / 2 + 0.02, 0.38, 0.03, 0.38, 0, Math.PI / 2);
  },
  cattree(p, w) {
    p.box('#d9cbb2', 0, 0, 0, w, 0.08, w);
    p.cyl('#cdb48a', -0.2, 0.08, -0.2, 0.08, 1.4);
    p.cyl('#cdb48a', 0.22, 0.08, 0.18, 0.08, 0.8);
    p.cyl('#b9a3d4', 0.22, 0.85, 0.18, 0.3, 0.06);
    p.cyl('#b9a3d4', -0.1, 1.48, -0.05, 0.42, 0.07);
    p.add(TOR, '#a48fc4', -0.1, 1.58, -0.05, 0.9, 0.9, 0.5, 0, Math.PI / 2);
  },
  bench(p, w, d) {
    for (let i = 0; i < 3; i++) p.box(OAK, 0, 0.44, -d / 2 + 0.1 + i * (d - 0.2) / 2, w, 0.05, 0.16);
    legs(p, IRON, w, d, 0.44, 0.1, 0.04);
  },
  hedge(p, w, d) {
    p.soft('#4f8a4f', 0, 0, 0, w, 1.0, d);
    p.ball('#5c9a59', -w / 4, 0.95, 0, 0.35);
    p.ball('#5c9a59', w / 4, 0.95, 0.05, 0.32);
  },
  pond(p, w, d) {
    p.add(CYL, '#9b9285', 0, 0.03, 0, w, 0.06, d);
    p.add(CYL, '#4f8fa6', 0, 0.06, 0, w - 0.3, 0.02, d - 0.3);
    p.ball('#5fae68', w * 0.2, 0.08, -d * 0.12, 0.18, 0.2);
  },
  shed(p, w, d) {
    p.box('#8f6a4a', 0, 0, 0, w, 1.7, d);
    p.add(BOX, '#5e3d29', 0, 1.95, 0, w + 0.3, 0.12, d * 0.62, 0, 0.6);
    p.add(BOX, '#5e3d29', 0, 1.95, 0, w + 0.3, 0.12, d * 0.62, 0, -0.6);
    p.box('#6e4f36', 0, 0, d / 2, 0.7, 1.4, 0.03);
  },
  flowerbed(p, w, d) {
    p.box('#8a5a3a', 0, 0, 0, w, 0.25, d);
    const f = ['#e5493a', '#f6b941', '#fff3df', '#e57fa6', '#8c5bc4'];
    for (let i = 0; i < 9; i++) p.ball(f[i % f.length], -w / 2 + 0.2 + (i * (w - 0.4)) / 8, 0.35, ((i * 7) % 3 - 1) * d * 0.2, 0.11);
  },
  rail(p, w, d) {
    p.box('#f4f2ec', 0, 0.85, 0, w, 0.06, d);
    p.box('#f4f2ec', 0, 0.45, 0, w, 0.04, d * 0.6);
    for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) p.box('#f4f2ec', x, 0, 0, 0.06, 0.88, 0.06);
  },
  lifeboat(p, w, d) {
    p.box('#5d5c63', -w / 3, 0, 0, 0.2, 0.25, d * 0.8);
    p.box('#5d5c63', w / 3, 0, 0, 0.2, 0.25, d * 0.8);
    p.soft('#e8803a', 0, 0.22, 0, w, 0.5, d);
    p.soft('#fff3df', 0, 0.6, 0, w - 0.2, 0.06, d - 0.2);
  },
  rope(p, w) {
    p.add(TOR, '#d9c08f', 0, 0.08, 0, w * 1.3, w * 1.3, 0.9, 0, Math.PI / 2);
    p.add(TOR, '#cdb07c', 0, 0.22, 0, w * 1.1, w * 1.1, 0.9, 0, Math.PI / 2);
  },
  deckchair(p, w, d) {
    p.add(BOX, '#e5493a', 0, 0.38, 0.05, w, 0.04, d * 0.95, 0, -0.35);
    p.add(BOX, '#fff3df', 0, 0.39, 0.05, w * 0.34, 0.045, d * 0.95, 0, -0.35);
    legs(p, OAK, w, d, 0.3, 0.06, 0.03);
  },
  planttable(p, w, d, it, prop) {
    BUILD.table(p, w, d, it, () => {});
    for (const x of [-w / 3, 0, w / 3]) {
      p.cyl('#c56a3d', x, 0.77, 0, 0.12, 0.16);
      p.ball('#5fae68', x, 1.0, 0, 0.16);
    }
    prop(-w * 0.15, 0.77, 0.2);
    prop(w * 0.15, 0.77, -0.2);
    prop(w * 0.4, 0.77, 0.2);
  },
  chimney(p, w, d) {
    p.box('#b8664c', 0, 0, 0, w, 1.3, d);
    p.box('#8e4a37', 0, 1.3, 0, w + 0.1, 0.1, d + 0.1);
    p.cyl('#6e6a64', -0.15, 1.4, 0, 0.1, 0.25);
  },
  skylight(p, w, d) {
    p.box('#d8d3c8', 0, 0, 0, w, 0.3, d);
    p.box('#9cc3d4', 0, 0.3, 0, w - 0.16, 0.03, d - 0.16);
  },
  wall(p, w, d, it, prop, h, room) {
    p.box(WALLS[room.wall] ?? C.sage, 0, 0, 0, w, h, d);
    p.box(shade(WALLS[room.wall] ?? C.sage, 0.15), 0, h, 0, w + 0.02, 0.04, d + 0.04);
  },
  counterdesk(p, w, d) {
    p.box('#7fa276', 0, 0, 0, w, 1.0, d);
    p.box('#f1ebe0', 0, 1.0, 0, w + 0.08, 0.06, d + 0.08);
    p.box('#e5493a', 0, 0.45, d / 2 + 0.005, w * 0.6, 0.1, 0.01);
  },
  waitbench(p, w, d) {
    p.box(OAK_DARK, 0, 0, 0, w, 0.08, d);
    const n = 4;
    for (let i = 0; i < n; i++) p.soft('#e5493a', -w / 2 + (w / n) * (i + 0.5), 0.36, 0, w / n - 0.08, 0.12, d - 0.06);
    legs(p, IRON, w, d, 0.36, 0.1, 0.035);
  },
};

function shade(hex, amt) {
  col.set(hex);
  if (amt > 0) col.lerp(new THREE.Color('#ffffff'), amt);
  else col.lerp(new THREE.Color('#000000'), -amt);
  return '#' + col.getHexString();
}

function bake(parts, x, z, r, out) {
  const rot = (r ?? 0) * (Math.PI / 2);
  const base = new THREE.Matrix4().makeRotationY(rot).setPosition(x, 0, z);
  for (const p of parts.list) {
    const g = p.geo.clone();
    q4.setFromEuler(new THREE.Euler(p.rx, p.ry, p.rz));
    m4.compose(v3.set(p.x, p.y, p.z), q4, s3.set(p.sx, p.sy, p.sz));
    g.applyMatrix4(m4);
    g.applyMatrix4(base);
    paint(g, p.color);
    out.push(g);
  }
}

function paint(g, hex) {
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  col.set(hex).convertSRGBToLinear();
  for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  g.deleteAttribute('uv');
}

function mergeAll(list) {
  if (!list.length) return null;
  const prepared = list.map((g) => (g.index ? g.toNonIndexed() : g));
  return mergeGeometries(prepared, false);
}

// ---------------------------------------------------------------- floor and walls

function floorTexture(kind, w, d) {
  const f = FLOORS[kind] ?? FLOORS.oak;
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 512;
  const g = cv.getContext('2d');
  g.fillStyle = f.base;
  g.fillRect(0, 0, 512, 512);
  if (kind === 'oak' || kind === 'deck') {
    const rows = kind === 'deck' ? 6 : 8;
    const h = 512 / rows;
    for (let r = 0; r < rows; r++) {
      const off = (r * 173) % 512;
      for (let x = -off; x < 512; x += 256) {
        g.fillStyle = (r + Math.floor(x / 256)) % 2 ? f.alt : f.base;
        g.fillRect(x, r * h, 256, h);
        g.fillStyle = f.line;
        g.fillRect(x, r * h, 3, h);
      }
      g.fillStyle = f.line;
      g.fillRect(0, r * h, 512, 3);
    }
  } else if (kind === 'tile' || kind === 'stone') {
    const n = kind === 'tile' ? 4 : 3;
    const s = 512 / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = (i + j) % 2 ? f.alt : f.base;
      g.fillRect(i * s, j * s, s, s);
    }
    g.fillStyle = f.line;
    for (let i = 0; i <= n; i++) { g.fillRect(i * s - 2, 0, 4, 512); g.fillRect(0, i * s - 2, 512, 4); }
  } else if (kind === 'grass') {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? f.alt : f.base;
      g.fillRect(0, i * 64, 512, 64);
    }
    g.fillStyle = f.line;
    for (let i = 0; i < 900; i++) g.fillRect((i * 97) % 512, (i * 211) % 512, 2, 5);
  } else {
    g.fillStyle = f.alt;
    for (let i = 0; i < 2500; i++) g.fillRect((i * 97) % 512, (i * 389) % 512, 2, 2);
    g.fillStyle = f.line;
    for (let i = 0; i < 1500; i++) g.fillRect((i * 131) % 512, (i * 271) % 512, 2, 2);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  const unit = kind === 'oak' || kind === 'deck' ? 4 : kind === 'grass' ? 6 : 3;
  tex.repeat.set(w / unit, d / unit);
  tex.anisotropy = 4;
  return tex;
}

const OUTDOOR = new Set(['grass', 'stone', 'deck']);

function walls(room, parts) {
  const { w, d } = room;
  const outdoor = OUTDOOR.has(room.floor);
  const wc = WALLS[room.wall] ?? C.sage;
  const h = outdoor ? (room.wall === 'glass' ? 2.4 : 1.1) : 2.6;
  const t = 0.22;
  // north wall (along x), west wall (along z), with skirting, a top cap, windows
  parts.box(wc, w / 2 - t / 2, 0, -t / 2, w + t, h, t);
  parts.box(shade(wc, -0.08), -t / 2, 0, d / 2, t, h, d);
  parts.box(shade(wc, 0.25), w / 2 - t / 2, h, -t / 2, w + t + 0.04, 0.06, t + 0.06);
  parts.box(shade(wc, 0.18), -t / 2, h, d / 2 - t / 2, t + 0.06, 0.06, d + t + 0.04);
  if (!outdoor) {
    parts.box('#f4eadb', w / 2, 0, 0.01, w, 0.16, 0.04);
    parts.box('#f4eadb', 0.01, 0, d / 2, 0.04, 0.16, d);
    const windows = Math.max(1, Math.floor(w / 6));
    for (let i = 0; i < windows; i++) {
      const x = ((i + 0.5) * w) / windows;
      parts.box('#fff6e6', x, 1.0, 0.0, 1.5, 1.2, 0.06);
      parts.box('#bfe0e8', x, 1.08, 0.03, 1.3, 1.04, 0.04);
      parts.box('#fff6e6', x, 1.0, 0.05, 0.06, 1.2, 0.04);
      parts.box('#fff6e6', x, 1.57, 0.05, 1.5, 0.06, 0.04);
    }
    const sideWindows = Math.max(1, Math.floor(d / 7));
    for (let i = 0; i < sideWindows; i++) {
      const z = ((i + 0.5) * d) / sideWindows;
      parts.box('#fff6e6', 0.0, 1.0, z, 0.06, 1.2, 1.3);
      parts.box('#bfe0e8', 0.03, 1.08, z, 0.04, 1.04, 1.1);
    }
  } else if (room.wall === 'glass') {
    for (let x = 0; x <= w; x += 2) parts.box('#e9efe9', x, 0, 0, 0.08, h, 0.1);
    for (let z = 0; z <= d; z += 2) parts.box('#e9efe9', 0, 0, z, 0.1, h, 0.08);
  } else if (room.wall === 'white') {
    for (let x = 1; x < w; x += 3) parts.box('#9cc3d4', x, 0.5, 0.02, 0.6, 0.6, 0.06);
  }
}

/**
 * Builds the room into `group`. Returns { props: { solidIndex: [instance ids] }, propMesh, update(t) } so a crash can hide the
 * thing that fell.
 */
export function buildRoom(room, world) {
  const group = new THREE.Group();
  const geoms = [];
  const propSpots = [];
  // floor slab
  const slab = new THREE.Mesh(new THREE.BoxGeometry(room.w + 0.6, 0.5, room.d + 0.6), new THREE.MeshStandardMaterial({ color: '#6b4630', roughness: 0.9 }));
  slab.position.set(room.w / 2, -0.26, room.d / 2);
  slab.receiveShadow = true;
  group.add(slab);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.w, room.d), new THREE.MeshStandardMaterial({ map: floorTexture(room.floor, room.w, room.d), roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(room.w / 2, 0, room.d / 2);
  floor.receiveShadow = true;
  group.add(floor);
  if (room.sea) {
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#3f7f9a', roughness: 0.4 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(room.w / 2, -0.7, room.d / 2);
    group.add(sea);
  }
  const wallParts = new Parts();
  walls(room, wallParts);
  bake(wallParts, 0, 0, 0, geoms);

  for (let i = 0; i < (room.items ?? []).length; i++) {
    const it = room.items[i];
    const k = KIT[it.k];
    const build = BUILD[it.k];
    if (!k || !build) continue;
    const w = it.w ?? k.w;
    const d = it.d ?? k.d;
    const h = it.h ?? k.h;
    const parts = new Parts();
    const solidIndex = world.solids.findIndex((s) => s.item === it);
    const local = [];
    build(parts, w, d, it, (px, py, pz) => local.push({ px, py, pz }), h, room);
    bake(parts, it.x, it.z, it.r, geoms);
    const rot = (it.r ?? 0) * (Math.PI / 2);
    for (const l of local) {
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      propSpots.push({ solid: solidIndex, x: it.x + l.px * c + l.pz * s, y: l.py, z: it.z - l.px * s + l.pz * c });
    }
  }
  // line for washing (rooftop): a string with pegged laundry
  if (room.line) {
    const [x0, z0, x1, z1] = room.line;
    const lp = new Parts();
    lp.box('#e9e2d6', x0, 0, z0, 0.06, 1.9, 0.06);
    lp.box('#e9e2d6', x1, 0, z1, 0.06, 1.9, 0.06);
    const len = Math.hypot(x1 - x0, z1 - z0);
    lp.add(BOX, '#f4f2ec', (x0 + x1) / 2, 1.85, (z0 + z1) / 2, len, 0.02, 0.02, -Math.atan2(z1 - z0, x1 - x0));
    const cloth = ['#e5493a', '#fff3df', '#3f7fcb', '#f6b941'];
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      lp.box(cloth[i % 4], x0 + (x1 - x0) * t, 1.35, z0 + (z1 - z0) * t, 0.5, 0.5, 0.03, -Math.atan2(z1 - z0, x1 - x0));
    }
    bake(lp, 0, 0, 0, geoms);
  }
  if (room.flap) {
    const fp = new Parts();
    fp.box('#5e3d29', room.flap.x, 0, 0.05, 0.8, 0.75, 0.06);
    fp.box('#efe2c8', room.flap.x, 0.06, 0.09, 0.6, 0.6, 0.04);
    bake(fp, 0, 0, 0, geoms);
  }

  const merged = mergeAll(geoms);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 });
  const mesh = new THREE.Mesh(merged, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  geoms.forEach((g) => g.dispose());

  // knockable things: mugs, vases, little plants
  const propGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.16, 10);
  propGeo.translate(0, 0.08, 0);
  const propMesh = new THREE.InstancedMesh(propGeo, new THREE.MeshStandardMaterial({ roughness: 0.4 }), Math.max(1, propSpots.length));
  propMesh.castShadow = true;
  const PROP_COLORS = ['#fff3df', '#3f8a86', '#e5493a', '#f6b941', '#5b87c5'];
  const byS = {};
  const dummy = new THREE.Object3D();
  propSpots.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.scale.set(1, 1 + (i % 3) * 0.35, 1);
    dummy.updateMatrix();
    propMesh.setMatrixAt(i, dummy.matrix);
    propMesh.setColorAt(i, col.set(PROP_COLORS[i % PROP_COLORS.length]));
    (byS[p.solid] ??= []).push(i);
  });
  propMesh.count = propSpots.length;
  if (propSpots.length) group.add(propMesh);

  return {
    group,
    /** A cat swatted something off piece `solid`: hide one of its things, return where it stood. */
    knock(solid) {
      const list = byS[solid];
      if (!list || !list.length) return null;
      const i = list.shift();
      const p = propSpots[i];
      dummy.position.set(0, -50, 0);
      dummy.scale.set(0.001, 0.001, 0.001);
      dummy.updateMatrix();
      propMesh.setMatrixAt(i, dummy.matrix);
      propMesh.instanceMatrix.needsUpdate = true;
      return { x: p.x, y: p.y, z: p.z, color: PROP_COLORS[i % PROP_COLORS.length] };
    },
    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (o.material.map) o.material.map.dispose();
          o.material.dispose();
        }
      });
    },
  };
}
