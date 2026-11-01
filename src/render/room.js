// A room as a lived-in miniature: a textured floor with contact shadows baked under every piece, two standing walls
// (wallpaper, wainscoting, skirting, windows with a view and curtains, pictures), late sun through the windows with
// light shafts and dust, and the furniture kit (CC0 models recoloured to one palette, plus a few pieces built here)
// with little things on top that cats knock off and that stay where they land.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { KIT } from '../sim/kit.js';
import { kitModel, kitSurface, surface } from './assets.js';
import { SUN_DIR } from './stage.js';
import { roomWindows, isOutdoor, SILL, WIN_TOP, WIN_W } from '../sim/sun.js';

export const WALL_H = 2.6;
export const WALL_T = 0.22;
const WAINS = 0.8;

// ---------------------------------------------------------------- palette
export const PAL = {
  oak: '#c58a55', oakLight: '#dcae7c', oakDark: '#6e4529', walnut: '#6b4a33',
  cream: '#f3e7d2', white: '#f4eee4', ink: '#2b1d1c', section: '#3b2622',
  metal: '#b8b2a8', metalDark: '#4b4542', black: '#2c2727', brass: '#d0a24a',
  leaf: '#5d9a49', leafDark: '#3b7536', pot: '#c66a43', glass: '#d6ecee', lamp: '#fff0c4', soil: '#4a3326',
  appliance: '#eeebe4',
};
export const FABRIC = {
  teal: '#3f8a86', mustard: '#d9a23a', blush: '#d98b86', sage: '#7fa276', red: '#c4473b', navy: '#3f5d8c', plum: '#8a4a68', cream: '#efe2c8',
};
const BOOKS = ['#c4473b', '#3f8a86', '#d9a23a', '#5b87c5', '#7fa276', '#8e3b46', '#efe2c8', '#2f4f6a', '#d98b86'];
const POTS = ['#c66a43', '#e9e2d6', '#3f8a86', '#d9a23a', '#2c2727'];

const FLOORS = {
  oak: { planks: 'wood', rows: 10, color: '#e4b081', tile: 3.6, rough: 0.5 },
  carpet: { tex: 'carpet', color: '#c9ad92', tile: 1.6, rough: 0.95, n: 0.7 },
  tile: { tex: 'tile', color: '#f6ecda', tile: 2.2, rough: 0.35, n: 0.5 },
  checker: { tex: 'checker', color: '#f6ecda', tile: 2.6, rough: 0.3, n: 0.4 },
  grass: { tex: 'grass', color: '#8cbf63', tile: 3.0, rough: 0.95, n: 0.8 },
  deck: { planks: 'planks', rows: 7, color: '#d6a476', tile: 3.6, rough: 0.7 },
  stone: { tex: 'bigtile', color: '#e2d6c2', tile: 3.0, rough: 0.6, n: 0.6 },
};

// walls: paper colour, the pattern on it, the wainscot below, trim
const WALLS = {
  sage: { paper: '#a9c2a0', ink: '#9ab693', pattern: 'stripe', wains: '#efe5d1', trim: '#f6efe2' },
  blush: { paper: '#e9bba8', ink: '#f1cbbb', pattern: 'dots', wains: '#f5ece0', trim: '#fbf5ec' },
  butter: { paper: '#f0d68f', ink: '#e6c87a', pattern: 'diamond', wains: '#a9c2a0', trim: '#f6efe2' },
  burgundy: { paper: '#8f3d47', ink: '#9d4a53', pattern: 'damask', wains: '#6f4529', trim: '#d0a24a' },
  cream: { paper: '#f2e3c6', ink: '#ead9b7', pattern: 'plain', wains: '#c58a55', trim: '#fbf5ec' },
  brick: { brick: true, paper: '#d08465', trim: '#e7dccb' },
  white: { paper: '#f1f0ea', ink: '#e2e6e4', pattern: 'plank', wains: '#3f7fa8', trim: '#ffffff' },
  glass: { glass: true, paper: '#bcd8d2', trim: '#f6f6f2' },
};

// ---------------------------------------------------------------- materials
const mats = new Map();
function mat(key, make) {
  if (!mats.has(key)) mats.set(key, make());
  return mats.get(key);
}
const std = (color, rough = 0.8, metal = 0) => mat(`s:${color}:${rough}:${metal}`, () => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));

const ROLE = {
  Red: 'fabric', DarkRed: 'fabricDark', Couch_Mustard: 'fabric', Couch_Beige: 'fabric', Couch_BeigeDark: 'fabricDark', Couch_Blue: 'fabric',
  Cushin: 'fabric', carpet: 'fabric', carpetBlue: 'fabric', carpetDarker: 'fabricDark',
  Wood: 'wood', wood: 'wood', Wood_Light: 'woodLight', Wood_Dark: 'woodDark', woodDark: 'woodDark',
  Metal: 'metal', LightMetal: 'metal', metal: 'metal', metalLight: 'metalLight', metalMedium: 'metal', DarkMetal: 'metalDark', metalDark: 'metalDark', Grey: 'metal',
  Black: 'black', White: 'white', carpetWhite: 'white', _defaultMat: 'white', Marble: 'stone',
  Glass: 'glass', glass: 'glass', DarkGreen: 'leafDark', Plant_Green: 'leaf', plant: 'leaf', LightOrange: 'pot', lamp: 'lamp',
};

function shade(hex, k) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + k)));
  return `#${c.getHexString()}`;
}

/** Material for a model part by role, in this piece's colours. */
function roleMat(role, o) {
  switch (role) {
    case 'fabric': return std(o.fabric, 0.95);
    case 'fabricDark': return std(shade(o.fabric, -0.08), 0.95);
    case 'wood': return std(o.wood, 0.6);
    case 'woodLight': return std(shade(o.wood, 0.08), 0.6);
    case 'woodDark': return std(shade(o.wood, -0.14), 0.6);
    case 'metal': return std(o.metal ?? PAL.metal, 0.38, 0.5);
    case 'metalLight': return std('#e8e4dc', 0.35, 0.3);
    case 'metalDark': return std(PAL.metalDark, 0.45, 0.4);
    case 'black': return std(o.black ?? PAL.black, 0.55);
    case 'white': return std(o.white ?? PAL.white, 0.7);
    case 'appliance': return std(PAL.appliance, 0.3, 0.05);
    case 'stone': return std('#efe6d8', 0.4);
    case 'soil': return std(PAL.soil, 0.95);
    case 'brass': return std(PAL.brass, 0.35, 0.7);
    case 'glass': return mat('glass', () => new THREE.MeshStandardMaterial({ color: PAL.glass, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false }));
    case 'leaf': return std(o.leaf ?? PAL.leaf, 0.7);
    case 'leafDark': return std(PAL.leafDark, 0.7);
    case 'pot': return std(o.pot ?? PAL.pot, 0.8);
    case 'lamp': return mat('lamp', () => new THREE.MeshStandardMaterial({ color: PAL.lamp, emissive: '#ffcf8a', emissiveIntensity: 1.4, roughness: 0.6 }));
    case 'screen': return mat('screen', () => new THREE.MeshStandardMaterial({ color: '#1d2a33', emissive: '#3b6b8a', emissiveIntensity: 0.5, roughness: 0.15, metalness: 0.2 }));
    default: return std('#cccccc', 0.7);
  }
}

function recolor(obj, o) {
  obj.traverse((m) => {
    if (!m.isMesh) return;
    const name = m.material?.name ?? '';
    const role = (o.roles && o.roles[name]) || ROLE[name] || 'white';
    m.material = roleMat(role, o);
    m.userData.kit = true;
    m.castShadow = role !== 'glass';
    m.receiveShadow = true;
  });
  return obj;
}

// ---------------------------------------------------------------- canvas textures
function canvasTex(w, h, draw, srgb = true) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function wallpaper(style) {
  return mat(`paper:${style.paper}:${style.pattern}`, () => {
    const t = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = style.paper;
      g.fillRect(0, 0, w, h);
      g.fillStyle = style.ink;
      g.strokeStyle = style.ink;
      if (style.pattern === 'stripe') {
        for (let x = 0; x < w; x += 64) { g.fillRect(x + 6, 0, 14, h); g.fillRect(x + 28, 0, 4, h); }
      } else if (style.pattern === 'dots') {
        for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? 16 : 0; x < w; x += 32) { g.beginPath(); g.arc(x + 8, y + 8, 4, 0, Math.PI * 2); g.fill(); }
      } else if (style.pattern === 'diamond') {
        g.lineWidth = 3;
        for (let y = -64; y < h + 64; y += 64) for (let x = -64; x < w + 64; x += 64) {
          g.beginPath(); g.moveTo(x + 32, y); g.lineTo(x + 64, y + 32); g.lineTo(x + 32, y + 64); g.lineTo(x, y + 32); g.closePath(); g.stroke();
        }
      } else if (style.pattern === 'damask') {
        for (let y = 0; y < h; y += 128) for (let x = 0; x < w; x += 128) {
          const cx = x + 64, cy = y + 64;
          g.beginPath(); g.ellipse(cx, cy, 16, 32, 0, 0, Math.PI * 2); g.fill();
          for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * 28, cy + 8, 9, 18, s * 0.6, 0, Math.PI * 2); g.fill(); }
          g.beginPath(); g.arc(x, y, 8, 0, Math.PI * 2); g.fill();
        }
      } else if (style.pattern === 'plank') {
        for (let x = 0; x < w; x += 42) g.fillRect(x, 0, 3, h);
      }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.92, normalMap: surface('plaster', true), normalScale: new THREE.Vector2(0.35, 0.35) });
  });
}

const PAINTINGS = [
  // hills at sunset
  (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f6b26b'); gr.addColorStop(0.6, '#f6d6a0'); gr.addColorStop(1, '#e8c38a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fbe9bd'; g.beginPath(); g.arc(w * 0.65, h * 0.48, 20, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#7fa276'; g.beginPath(); g.moveTo(0, h * 0.7); g.quadraticCurveTo(w * 0.3, h * 0.45, w * 0.6, h * 0.68); g.quadraticCurveTo(w * 0.8, h * 0.6, w, h * 0.66); g.lineTo(w, h); g.lineTo(0, h); g.fill();
    g.fillStyle = '#4f7a52'; g.beginPath(); g.moveTo(0, h * 0.85); g.quadraticCurveTo(w * 0.5, h * 0.68, w, h * 0.86); g.lineTo(w, h); g.lineTo(0, h); g.fill();
  },
  // a cat, sitting, from behind
  (g, w, h) => {
    g.fillStyle = '#3f8a86'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f3e7d2'; g.beginPath(); g.ellipse(w / 2, h * 0.64, w * 0.25, h * 0.28, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(w / 2, h * 0.34, w * 0.16, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(w * 0.36, h * 0.28); g.lineTo(w * 0.38, h * 0.12); g.lineTo(w * 0.47, h * 0.22); g.fill();
    g.beginPath(); g.moveTo(w * 0.64, h * 0.28); g.lineTo(w * 0.62, h * 0.12); g.lineTo(w * 0.53, h * 0.22); g.fill();
    g.strokeStyle = '#f3e7d2'; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.moveTo(w * 0.7, h * 0.86); g.quadraticCurveTo(w * 0.92, h * 0.78, w * 0.84, h * 0.52); g.stroke();
  },
  // mid-century arches
  (g, w, h) => {
    g.fillStyle = '#f3e7d2'; g.fillRect(0, 0, w, h);
    ['#d9a23a', '#c4473b', '#3f8a86', '#2b1d1c'].forEach((col, i) => { g.fillStyle = col; g.beginPath(); g.arc(w * 0.5, h * 0.72, w * (0.4 - i * 0.09), Math.PI, 0); g.fill(); });
  },
  // a fish
  (g, w, h) => {
    g.fillStyle = '#5b87c5'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f6b941'; g.beginPath(); g.ellipse(w * 0.45, h / 2, w * 0.28, h * 0.15, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(w * 0.68, h / 2); g.lineTo(w * 0.88, h * 0.36); g.lineTo(w * 0.88, h * 0.64); g.fill();
    g.fillStyle = '#2b1d1c'; g.beginPath(); g.arc(w * 0.28, h * 0.48, 5, 0, Math.PI * 2); g.fill();
  },
  // a ball of yarn
  (g, w, h) => {
    g.fillStyle = '#e9bba8'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c4473b'; g.beginPath(); g.arc(w / 2, h / 2, w * 0.28, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#e8786a'; g.lineWidth = 4;
    for (let i = -3; i <= 3; i++) { g.beginPath(); g.ellipse(w / 2, h / 2, w * 0.27, w * 0.1 + Math.abs(i) * 5, i * 0.5, 0, Math.PI * 2); g.stroke(); }
    g.beginPath(); g.moveTo(w * 0.7, h * 0.66); g.quadraticCurveTo(w * 0.85, h * 0.9, w * 0.5, h * 0.92); g.stroke();
  },
];
function painting(i) {
  return mat(`painting${i % PAINTINGS.length}`, () => new THREE.MeshStandardMaterial({ map: canvasTex(128, 160, PAINTINGS[i % PAINTINGS.length]), roughness: 0.55 }));
}

function skyCard() {
  return mat('sky', () => {
    const t = canvasTex(128, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#a6d4f0'); gr.addColorStop(0.55, '#ffe9c2'); gr.addColorStop(1, '#ffd49a');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(126,168,112,0.9)';
      for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(i * 26 + 6, h * 0.84, 22 + (i % 2) * 8, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = 'rgba(208,150,118,0.75)';
      g.fillRect(70, h * 0.72, 50, h * 0.3);
      g.beginPath(); g.moveTo(64, h * 0.72); g.lineTo(95, h * 0.62); g.lineTo(126, h * 0.72); g.fill();
    });
    return new THREE.MeshBasicMaterial({ map: t, toneMapped: false, color: new THREE.Color(1.5, 1.42, 1.3) });
  });
}

/**
 * Floorboards: rows of planks of random lengths, each cut from a random patch of the grain photo and a little lighter or
 * darker than its neighbours, with dark seams. Tiles seamlessly.
 */
function plankTexture(name, rows) {
  return mat(`planks:${name}:${rows}`, () => {
    const src = surface(name).image;
    const S = 1024;
    let r = 7;
    const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
    return canvasTex(S, S, (g) => {
      const rh = S / rows;
      for (let row = 0; row < rows; row++) {
        const start = rnd() * S;
        let x = start;
        while (x < start + S) {
          const len = Math.min(start + S - x, S * (0.3 + rnd() * 0.4));
          const sx = rnd() * Math.max(1, src.width - 260), sy = rnd() * Math.max(1, src.height - 30);
          const b = (rnd() - 0.5) * 0.16;
          for (const off of [0, -S]) {
            const px = x + off;
            if (px > S || px + len < 0) continue;
            g.drawImage(src, sx, sy, 260, 26, px, row * rh, len, rh);
            g.fillStyle = b > 0 ? `rgba(255,255,255,${b})` : `rgba(0,0,0,${-b})`;
            g.fillRect(px, row * rh, len, rh);
            g.fillStyle = 'rgba(30,18,10,0.6)';
            g.fillRect(px, row * rh, 3, rh);
          }
          x += len;
        }
        g.fillStyle = 'rgba(30,18,10,0.55)';
        g.fillRect(0, row * rh, S, 3);
        g.fillStyle = 'rgba(255,255,255,0.08)';
        g.fillRect(0, row * rh + 3, S, 2);
      }
    });
  });
}

function rugTexture(color, seed) {
  return canvasTex(256, 256, (g, w, h) => {
    const base = color, dark = shade(color, -0.12), light = shade(color, 0.16);
    g.fillStyle = dark; g.fillRect(0, 0, w, h);
    g.fillStyle = base; g.fillRect(16, 16, w - 32, h - 32);
    g.strokeStyle = light; g.lineWidth = 5; g.strokeRect(28, 28, w - 56, h - 56);
    g.strokeStyle = dark; g.lineWidth = 2; g.strokeRect(38, 38, w - 76, h - 76);
    g.fillStyle = light;
    const kind = seed % 3;
    if (kind === 0) {
      g.beginPath(); g.ellipse(w / 2, h / 2, w * 0.22, h * 0.16, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = dark; g.beginPath(); g.ellipse(w / 2, h / 2, w * 0.1, h * 0.07, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = light;
      for (const [x, y] of [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) { g.beginPath(); g.arc(w * x, h * y, 7, 0, Math.PI * 2); g.fill(); }
    } else if (kind === 1) {
      for (let y = 52; y < h - 44; y += 26) g.fillRect(48, y, w - 96, 8);
    } else {
      for (let y = 54; y < h - 54; y += 34) for (let x = 54; x < w - 54; x += 34) { g.save(); g.translate(x + 9, y + 9); g.rotate(Math.PI / 4); g.fillRect(-7, -7, 14, 14); g.restore(); }
    }
  });
}

// ---------------------------------------------------------------- shapes
const RB = new RoundedBoxGeometry(1, 1, 1, 2, 0.08);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 18);
const SHARED = new Set([RB, BOX, CYL]);

/** One piece of furniture, built in its own frame (front at +z, footprint centred, floor at 0). */
class Piece {
  constructor(o, own = []) {
    this.group = new THREE.Group();
    this.own = own;
    this.o = o;
    this.props = [];
    this.glows = [];
  }
  /**
   * A kit model fitted into (w, d, h) at (x, y, z), turned `rot` quarter turns. mode 'fit' keeps its proportions,
   * 'stretch' fills the box; `top` (with `at` [fx, fz]) sets the height so its surface there sits at `top`.
   */
  model(name, { x = 0, z = 0, y = 0, rot = 0, w = null, d = null, h = null, mode = 'fit', o = null, top = null, at = [0, 0] } = {}) {
    const m = kitModel(name);
    if (!m) return null;
    const S = m.userData.size;
    const odd = rot % 2 === 1;
    const sw = odd ? S.z : S.x, sd = odd ? S.x : S.z;
    let sx, sy, sz;
    if (mode === 'stretch') {
      sx = w ? w / sw : 1;
      sz = d ? d / sd : 1;
      sy = top != null ? top / (kitSurface(name, at[0], at[1]) * S.y) : h ? h / S.y : Math.min(sx, sz);
    } else {
      const ks = [w && w / sw, d && d / sd, h && h / S.y].filter(Boolean);
      sx = sy = sz = Math.min(...ks);
    }
    recolor(m, { ...this.o, ...(o ?? {}) });
    m.rotation.y = rot * (Math.PI / 2);
    const holder = new THREE.Group();
    holder.add(m);
    holder.scale.set(sx, sy, sz);
    holder.position.set(x, y, z);
    this.group.add(holder);
    return holder;
  }
  mesh(geo, material, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, cast = true) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.rotation.y = ry;
    m.castShadow = cast;
    m.receiveShadow = true;
    this.group.add(m);
    return m;
  }
  /** A box standing on y. */
  box(color, x, y, z, sx, sy, sz, { rough = 0.8, round = false, ry = 0, metal = 0 } = {}) {
    return this.mesh(round ? RB : BOX, std(color, rough, metal), x, y + sy / 2, z, sx, sy, sz, ry);
  }
  cyl(color, x, y, z, r, h, rough = 0.8) { return this.mesh(CYL, std(color, rough), x, y + h / 2, z, r * 2, h, r * 2); }
  prop(x, y, z) { this.props.push({ x, y, z }); }
  /** A warm pool of light on the floor (lamps). */
  glow(x, z, r) { this.glows.push({ x, z, r }); }
}

const PLANTS = ['plant2', 'plant3', 'plant4', 'plant5', 'plant6', 'plant1'];
const PLANT_ROLES = { Black: 'pot', Grey: 'pot', Wood: 'soil' };
const hash = (a, b = 0) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** A bookcase built here: a frame, a back, shelves, rows of books with gaps, the odd thing on a shelf. */
function bookcase(P, w, d, h, seed) {
  const wood = PAL.oakDark;
  const t = 0.05;
  P.box(wood, -w / 2 + t / 2, 0, 0, t, h, d, { rough: 0.6 });
  P.box(wood, w / 2 - t / 2, 0, 0, t, h, d, { rough: 0.6 });
  P.box(shade(wood, 0.04), 0, h - 0.06, 0, w + 0.06, 0.06, d + 0.04, { rough: 0.6 });
  P.box(shade(wood, -0.06), 0, 0, -d / 2 + 0.015, w, h, 0.03, { rough: 0.7 });
  P.box(shade(wood, -0.04), 0, 0, 0.02, w - 2 * t, 0.1, d - 0.04, { rough: 0.6 });
  const shelves = Math.max(3, Math.round((h - 0.1) / 0.45));
  const gap = (h - 0.16) / shelves;
  const books = [];
  for (let s = 0; s < shelves; s++) {
    const y = 0.1 + s * gap;
    if (s > 0) P.box(wood, 0, y - 0.03, 0.01, w - 2 * t, 0.03, d - 0.03, { rough: 0.6 });
    let x = -w / 2 + t + 0.02;
    const end = w / 2 - t - 0.02;
    let k = 0;
    while (x < end - 0.05) {
      const r = hash(seed + s * 17, k);
      k++;
      if (r < 0.07 && x < end - 0.35) {
        // a gap with a little thing
        const kind = Math.floor(hash(seed, s + k) * 3);
        if (kind === 0) {
          P.cyl(POTS[(s + k) % POTS.length], x + 0.12, y, 0.02, 0.07, 0.12, 0.8);
          P.mesh(new THREE.IcosahedronGeometry(0.09, 0), std(PAL.leaf, 0.7), x + 0.12, y + 0.2, 0.02, 1, 0.8, 1);
        } else if (kind === 1) {
          P.cyl('#e9e2d6', x + 0.1, y, 0.02, 0.05, gap * 0.55, 0.3);
        }
        x += 0.28;
        continue;
      }
      const bw = 0.045 + hash(seed + 3, k + s) * 0.05;
      const bh = gap * (0.62 + hash(seed + 7, k * 3 + s) * 0.28);
      const lean = r > 0.93 && x > -w / 2 + 0.2 ? 0.28 : 0;
      books.push({ x: x + bw / 2 + (lean ? bh * 0.12 : 0), y: y + bh / 2, z: 0.04, w: bw, h: bh, d: d * (0.62 + hash(k, s) * 0.15), c: BOOKS[Math.floor(hash(seed + s, k * 7) * BOOKS.length)], lean });
      x += bw + 0.004 + (lean ? bh * 0.3 : 0);
    }
  }
  const im = new THREE.InstancedMesh(BOX, std('#ffffff', 0.75), books.length);
  const dummy = new THREE.Object3D();
  const c = new THREE.Color();
  books.forEach((b, i) => {
    dummy.position.set(b.x, b.y, b.z);
    dummy.rotation.set(0, 0, -b.lean);
    dummy.scale.set(b.w, b.h, b.d);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
    im.setColorAt(i, c.set(shade(b.c, (hash(i, seed) - 0.5) * 0.08)));
  });
  im.castShadow = true;
  im.receiveShadow = true;
  P.group.add(im);
}

const BUILD = {
  rug(P, w, d, it) {
    const g = new THREE.BoxGeometry(w, 0.018, d);
    const p = g.attributes.position;
    const uv1 = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { uv1[i * 2] = p.getX(i) / 0.6; uv1[i * 2 + 1] = p.getZ(i) / 0.6; }
    g.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
    const n = surface('fabric', true).clone();
    n.channel = 1;
    const m = new THREE.MeshStandardMaterial({ map: rugTexture(FABRIC[it.c] ?? FABRIC.teal, Math.round(Math.abs(it.x * 7 + it.z * 3))), roughness: 0.97, normalMap: n, normalScale: new THREE.Vector2(0.8, 0.8) });
    P.own.push(m, m.map, n);
    P.mesh(g, m, 0, 0.009, 0, 1, 1, 1, 0, false);
    // tassels on the short ends
    const fringe = mat('fringe', () => {
      const t = canvasTex(64, 8, (g) => { for (let x = 0; x < 64; x += 8) { g.fillStyle = '#f3e7d2'; g.fillRect(x + 1, 0, 4, 8); } });
      t.wrapS = THREE.RepeatWrapping;
      return new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, transparent: false, roughness: 0.95, side: THREE.DoubleSide });
    });
    const long = w >= d;
    const span = long ? d : w;
    for (const s of [-1, 1]) {
      const g2 = new THREE.PlaneGeometry(span * 0.94, 0.1);
      const uv = g2.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * span * 6);
      g2.rotateX(-Math.PI / 2);
      if (long) g2.rotateY(Math.PI / 2);
      P.own.push(g2);
      P.mesh(g2, fringe, long ? s * (w / 2 + 0.05) : 0, 0.006, long ? 0 : s * (d / 2 + 0.05), 1, 1, 1, 0, false);
    }
  },
  sofa(P, w, d, it, o) {
    P.model(w > 2.2 ? 'sofa3' : 'sofa2', { w, d, mode: 'stretch', top: KIT.sofa.perch, at: [0, 0.25] });
    P.model('pillow', { x: -w * 0.33, z: -d * 0.08, y: KIT.sofa.perch - 0.04, w: 0.42, d: 0.2, h: 0.4, o: { fabric: o.accent } });
    P.model('pillowBlue', { x: w * 0.33, z: -d * 0.08, y: KIT.sofa.perch - 0.04, w: 0.38, d: 0.2, h: 0.36, o: { fabric: o.accent2 } });
  },
  armchair(P, w, d) { P.model('armchair', { w, d, mode: 'stretch', top: KIT.armchair.perch, at: [0, 0.2], o: { roles: { Black: 'woodDark' } } }); },
  bed(P, w, d, it, o) {
    P.model('bedKing', { w, d, mode: 'stretch', top: KIT.bed.perch, at: [0, 0.1], o: { white: '#f7f1e6', wood: PAL.oak, roles: { Grey: 'woodDark' } } });
    P.model('nightstand', { x: -w / 2 - 0.32, z: -d / 2 + 0.32, w: 0.52, d: 0.48, h: 0.62, mode: 'stretch', o: { wood: PAL.oak } });
    P.model('tablelamp', { x: -w / 2 - 0.32, z: -d / 2 + 0.3, y: 0.62, w: 0.3, d: 0.3, h: 0.5, o: { roles: { White: 'lamp', LightMetal: 'brass' } } });
  },
  coffee(P, w, d) {
    P.model('tableOval', { w, d, h: KIT.coffee.h, mode: 'stretch', o: { wood: PAL.walnut } });
    P.prop(-w * 0.25, KIT.coffee.h, 0);
    P.prop(w * 0.22, KIT.coffee.h, 0.06);
  },
  table(P, w, d, it) {
    P.model('tableCloth', { w, d, h: KIT.table.h, mode: 'stretch', o: { fabric: FABRIC[it.c] ?? '#f3ece0', wood: PAL.oak } });
    P.prop(-w * 0.26, KIT.table.h, 0);
    P.prop(w * 0.2, KIT.table.h, 0.1);
  },
  cafetable(P, w, d) {
    P.model('tableRound', { w, d, h: KIT.cafetable.h, mode: 'stretch', o: { wood: PAL.walnut } });
    P.prop(0, KIT.cafetable.h, 0);
  },
  chair(P, w, d) { P.model('chair', { w, d, h: KIT.chair.h, mode: 'stretch', o: { wood: PAL.oak } }); },
  sideboard(P, w, d) {
    P.model('sideboard', { w, d, h: KIT.sideboard.h, mode: 'stretch', o: { wood: PAL.oak } });
    P.prop(-w * 0.3, KIT.sideboard.h, 0);
    P.prop(w * 0.3, KIT.sideboard.h, 0);
  },
  tvunit(P, w, d) {
    P.model('tvunit', { w, d, h: KIT.tvunit.h, mode: 'stretch', o: { wood: PAL.walnut } });
    P.model('tv', { y: KIT.tvunit.h, z: -d * 0.12, w: w * 0.62, d: 0.3, h: 0.78, o: { roles: { metalDark: 'black', metal: 'screen' } } });
    P.prop(w * 0.4, KIT.tvunit.h, 0.04);
  },
  bookshelf(P, w, d, it) { bookcase(P, w, d, KIT.bookshelf.h, Math.round(it.x * 13 + it.z * 7)); },
  shelfrow(P, w, d, it) {
    for (const s of [-1, 1]) {
      const sub = new Piece(P.o, P.own);
      bookcase(sub, w / 2 - 0.02, d, KIT.shelfrow.h, Math.round(it.x * 13 + it.z * 7 + s * 5));
      sub.group.position.x = (s * w) / 4;
      P.group.add(sub.group);
    }
  },
  wardrobe(P, w, d) {
    const h = KIT.wardrobe.h;
    const wood = PAL.oakLight;
    P.box(shade(wood, -0.1), 0, 0, 0, w - 0.1, 0.1, d - 0.1);
    P.box(wood, 0, 0.1, 0, w, h - 0.18, d, { rough: 0.6 });
    P.box(shade(wood, -0.05), 0, h - 0.08, 0, w + 0.08, 0.08, d + 0.06, { rough: 0.6 });
    for (const s of [-1, 1]) {
      P.box(shade(wood, 0.04), s * w / 4, 0.2, d / 2 + 0.01, w / 2 - 0.08, h - 0.38, 0.03, { rough: 0.55 });
      P.box(shade(wood, -0.02), s * w / 4, 0.38, d / 2 + 0.025, w / 2 - 0.3, h - 0.78, 0.02, { rough: 0.55 });
      P.box(PAL.brass, s * 0.07, h * 0.5, d / 2 + 0.05, 0.03, 0.2, 0.03, { rough: 0.3, metal: 0.7 });
    }
    // a suitcase on top
    P.box(FABRIC.red, -w * 0.15, h, -0.02, w * 0.45, 0.2, d * 0.7, { round: true, rough: 0.6 });
  },
  fridge(P, w, d) {
    P.model('fridge', { w, d, h: KIT.fridge.h, mode: 'stretch', o: { roles: { White: 'appliance' } } });
    // magnets and a drawing
    P.box('#fff3df', -w * 0.12, KIT.fridge.h * 0.62, d / 2 + 0.01, 0.22, 0.28, 0.01, { rough: 0.9 });
    P.box(FABRIC.red, w * 0.18, KIT.fridge.h * 0.7, d / 2 + 0.012, 0.06, 0.06, 0.015);
    P.box(FABRIC.mustard, w * 0.05, KIT.fridge.h * 0.52, d / 2 + 0.012, 0.06, 0.06, 0.015);
  },
  counter(P, w, d) {
    const n = Math.max(1, Math.round(w / 0.8));
    const h = KIT.counter.h;
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w / n) * (i + 0.5);
      const name = n > 1 && i === 1 ? 'kSink' : n > 2 && i === n - 1 ? 'kStove' : 'kCabinet';
      P.model(name, { x, w: w / n, d, h, mode: 'stretch', o: { wood: '#e6dccb', metal: '#d8d4cc', roles: { metal: 'metalLight' } } });
    }
    P.model('kCoffee', { x: -w * 0.4, y: h, z: -d * 0.15, w: 0.34, d: 0.34, h: 0.42, o: { roles: { carpetWhite: 'black' } } });
    P.prop(w * 0.08, h, 0);
    P.prop(w * 0.32, h, 0.05);
  },
  plant(P, w, d, it) {
    const i = Math.floor(hash(it.x, it.z) * PLANTS.length);
    P.model(PLANTS[i], { w: w * 1.5, d: d * 1.5, h: KIT.plant.h * 1.1, o: { roles: PLANT_ROLES, pot: POTS[i % POTS.length] } });
  },
  lamp(P, w, d, it) {
    P.model(hash(it.x, it.z) > 0.5 ? 'floorlamp' : 'floorlamp2', { w: w * 1.1, d: d * 1.1, h: KIT.lamp.h * 1.05, o: { roles: { White: 'lamp', LightMetal: 'brass' } } });
    P.glow(0, 0, 1.4);
  },
  desk(P, w, d) {
    const h = KIT.desk.h;
    P.model('desk', { w, d, h, mode: 'stretch', o: { wood: PAL.oak } });
    P.model('laptop', { x: -w * 0.05, y: h, z: -d * 0.05, w: 0.5, d: 0.4, h: 0.32, o: { roles: { metal: 'screen' } } });
    P.model('lampRound', { x: w * 0.36, y: h, z: -d * 0.2, w: 0.3, d: 0.3, h: 0.5, o: { roles: { lamp: 'lamp' } } });
    P.prop(-w * 0.36, h, 0.05);
    P.prop(w * 0.18, h, 0.12);
  },
  box(P, w, d) { P.model('boxOpen', { w, d, h: KIT.box.h * 1.15, mode: 'stretch', o: { wood: '#c8925a' } }); },
  boxstack(P, w, d) {
    P.model('boxClosed', { w, d, h: 0.62, mode: 'stretch', o: { wood: '#c8925a' } });
    P.model('boxClosed', { y: 0.62, x: 0.04, w: w * 0.86, d: d * 0.86, h: 0.46, mode: 'stretch', rot: 1, o: { wood: '#d4a26a' } });
    P.model('boxClosed', { y: 1.08, x: -0.03, w: w * 0.62, d: d * 0.62, h: 0.24, mode: 'stretch', o: { wood: '#c08550' } });
  },
  basket(P, w, d) {
    const r = Math.min(w, d) / 2;
    const weave = mat('weave', () => {
      const t = canvasTex(128, 64, (g) => {
        g.fillStyle = '#c39158'; g.fillRect(0, 0, 128, 64);
        g.fillStyle = '#9c6f3e';
        for (let y = 0; y < 64; y += 8) for (let x = (y / 8) % 2 ? 8 : 0; x < 128; x += 16) g.fillRect(x, y, 8, 8);
      });
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(5, 2);
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, side: THREE.DoubleSide });
    });
    P.mesh(new THREE.CylinderGeometry(r, r * 0.86, 0.4, 28, 1, true), weave, 0, 0.2, 0);
    P.mesh(new THREE.CylinderGeometry(r * 0.86, r * 0.86, 0.02, 28), std('#9c6f3e', 0.9), 0, 0.01, 0);
    const rim = P.mesh(new THREE.TorusGeometry(r, 0.045, 8, 28), std('#9c6f3e', 0.9), 0, 0.4, 0);
    rim.rotation.x = Math.PI / 2;
    const cushion = P.mesh(new THREE.SphereGeometry(r * 0.85, 20, 10), std(FABRIC.blush, 0.95), 0, 0.22, 0, 1, 0.16, 1);
    cushion.castShadow = false;
  },
  washer(P, w, d, it) {
    P.model(hash(it.x, it.z) > 0.5 ? 'washer' : 'dryer', { w, d, h: KIT.washer.h, mode: 'stretch', o: { roles: { metalLight: 'appliance', _defaultMat: 'appliance', metal: 'appliance', metalMedium: 'metal' } } });
  },
  cattree(P, w, d) {
    const sisal = mat('sisal', () => {
      const t = canvasTex(64, 128, (g) => {
        g.fillStyle = '#d7b98a'; g.fillRect(0, 0, 64, 128);
        g.fillStyle = '#b8955f';
        for (let y = 0; y < 128; y += 6) g.fillRect(0, y, 64, 2);
      });
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1, 3);
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 });
    });
    const fab = FABRIC.blush;
    P.box(fab, 0, 0, 0, w, 0.1, d, { round: true, rough: 0.95 });
    P.mesh(CYL, sisal, -w * 0.22, 0.6, -d * 0.18, 0.16, 1.2, 0.16);
    P.mesh(CYL, sisal, w * 0.24, 0.45, d * 0.2, 0.14, 0.9, 0.14);
    P.box(fab, w * 0.1, 0.9, d * 0.05, w * 0.8, 0.08, d * 0.7, { round: true, rough: 0.95 });
    P.mesh(new THREE.CylinderGeometry(w * 0.42, w * 0.38, 0.14, 24), std(fab, 0.95), -w * 0.1, 1.5, -d * 0.1);
    P.mesh(new THREE.TorusGeometry(w * 0.38, 0.06, 8, 24), std(shade(fab, 0.06), 0.95), -w * 0.1, 1.58, -d * 0.1).rotation.x = Math.PI / 2;
    P.mesh(CYL, sisal, -w * 0.1, 1.2, -d * 0.1, 0.12, 0.6, 0.12);
    P.mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.4, 4), std('#f3e7d2'), w * 0.38, 0.7, d * 0.05, 1, 1, 1, 0, false);
    P.mesh(new THREE.SphereGeometry(0.07, 12, 8), std(FABRIC.red, 0.9), w * 0.38, 0.48, d * 0.05);
  },
  bench(P, w, d, it) { P.model('benchCushion', { w, d, mode: 'stretch', top: KIT.bench.perch, at: [0, 0.2], o: { fabric: FABRIC[it.c] ?? FABRIC.teal, wood: PAL.oak } }); },
  hedge(P, w, d, it) {
    const geos = [];
    const n = Math.max(3, Math.round(w / 0.45));
    for (let i = 0; i < n; i++) {
      const s = new THREE.IcosahedronGeometry(0.46 + hash(i, it.x) * 0.1, 1);
      s.scale(1, 1.1, d / 0.85);
      s.translate(-w / 2 + 0.3 + ((w - 0.6) / (n - 1)) * i, 0.52 + hash(it.z, i) * 0.1, (hash(i, 3) - 0.5) * 0.1);
      geos.push(s);
    }
    P.mesh(mergeGeometries(geos), std('#4f8a45', 0.9), 0, 0, 0);
  },
  pond(P, w, d) {
    const water = mat('water', () => new THREE.MeshStandardMaterial({ color: '#3d8fa8', roughness: 0.06, metalness: 0.2, emissive: '#1d4f63', emissiveIntensity: 0.3 }));
    const sh = new THREE.Shape();
    sh.absellipse(0, 0, w / 2, d / 2, 0, Math.PI * 2);
    const g = new THREE.ShapeGeometry(sh, 32);
    g.rotateX(-Math.PI / 2);
    P.mesh(g, water, 0, 0.02, 0, 1, 1, 1, 0, false);
    const n = 24;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      P.mesh(new THREE.DodecahedronGeometry(0.17, 0), std(i % 2 ? '#c9c0b2' : '#b3aa9c', 0.85), (Math.cos(a) * w) / 2, 0.06, (Math.sin(a) * d) / 2, 1.2, 0.6, 1.2, a);
    }
    for (let i = 0; i < 3; i++) {
      const pad = P.mesh(new THREE.CircleGeometry(0.18, 12, 0.3, Math.PI * 1.8), std('#5e9a4a', 0.6), (hash(i, 1) - 0.5) * w * 0.5, 0.03, (hash(i, 2) - 0.5) * d * 0.5, 1, 1, 1, 0, false);
      pad.rotation.x = -Math.PI / 2;
    }
  },
  shed(P, w, d) {
    P.mesh(BOX, std('#6f8f6a', 0.85), 0, 0.9, 0, w, 1.8, d);
    for (let x = -w / 2 + 0.2; x < w / 2; x += 0.3) P.box('#62805e', x, 0, d / 2 + 0.005, 0.02, 1.8, 0.01);
    const roof = new THREE.CylinderGeometry(0.01, 1, 1, 4, 1);
    roof.rotateY(Math.PI / 4);
    P.mesh(roof, std('#5e3b26', 0.8), 0, 2.15, 0, w * 0.78, 0.7, d * 0.78);
    P.box('#4a3324', 0, 0, d / 2 + 0.02, 0.8, 1.5, 0.04);
  },
  flowerbed(P, w, d) {
    P.box('#7a5038', 0, 0, 0, w, 0.22, d, { rough: 0.95 });
    P.box('#4a3326', 0, 0.22, 0, w - 0.1, 0.02, d - 0.1, { rough: 1 });
    const cols = ['#e5493a', '#f6b941', '#e57fa6', '#fff3df', '#8c5bc4'];
    const n = Math.round(w * 4);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + 0.15 + ((w - 0.3) / n) * (i + 0.5);
      const z = (hash(i, w) - 0.5) * d * 0.6;
      P.mesh(new THREE.IcosahedronGeometry(0.12, 0), std('#4f8a45', 0.8), x, 0.3, z, 1, 0.8, 1);
      P.mesh(new THREE.IcosahedronGeometry(0.075, 0), std(cols[i % cols.length], 0.7), x, 0.44, z, 1, 0.7, 1);
    }
  },
  rail(P, w, d) {
    P.box('#f4f2ec', 0, 0.85, 0, w, 0.06, d, { rough: 0.5 });
    P.box('#f4f2ec', 0, 0.45, 0, w, 0.04, d * 0.6, { rough: 0.5 });
  },
  lifeboat(P, w, d) {
    const hull = new THREE.CapsuleGeometry(d / 2, w - d, 6, 16);
    hull.rotateZ(Math.PI / 2);
    P.mesh(hull, std('#e8763a', 0.6), 0, 0.5, 0, 1, 0.6, 1);
    P.box('#f4f2ec', 0, 0.72, 0, w * 0.8, 0.08, d * 0.7, { rough: 0.6 });
    for (const s of [-1, 1]) P.box('#9a7552', s * w * 0.42, 0, 0, 0.12, 0.4, d * 0.9);
  },
  rope(P, w) {
    for (let i = 0; i < 4; i++) P.mesh(new THREE.TorusGeometry(w * 0.4 - i * 0.07, 0.05, 6, 18), std('#d7b98a', 0.95), 0, 0.06 + i * 0.08, 0).rotation.x = Math.PI / 2;
  },
  deckchair(P, w, d) {
    const wood = '#b78252';
    for (const s of [-1, 1]) {
      const rail = P.box(wood, s * (w / 2 - 0.04), 0, 0, 0.05, 0.05, d * 1.05);
      rail.position.y = 0.3;
      rail.rotation.x = 0.35;
    }
    const cloth = P.mesh(BOX, mat('stripes', () => {
      const t = canvasTex(64, 64, (g) => { for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#fff3df' : '#e8763a'; g.fillRect(i * 16, 0, 16, 64); } });
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
    }), 0, 0.32, 0, w - 0.1, 0.02, d);
    cloth.rotation.x = 0.35;
  },
  planttable(P, w, d) {
    const h = KIT.planttable.h;
    P.model('table', { w, d, h, mode: 'stretch', o: { wood: '#9a7552' } });
    const n = Math.max(2, Math.round(w / 0.7));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w / n) * (i + 0.5);
      if (i % 2) P.prop(x, h, 0);
      else P.model(['plantSmall1', 'plantSmall2', 'plantSmall3'][i % 3], { x, y: h, w: 0.45, d: 0.45, h: 0.55, o: { roles: { wood: 'pot' }, leaf: '#5d9a49' } });
    }
  },
  chimney(P, w, d) {
    const brick = mat('chimney', () => new THREE.MeshStandardMaterial({ color: '#c97a5a', map: surface('brick'), normalMap: surface('brick', true), roughness: 0.9 }));
    P.mesh(BOX, brick, 0, 0.7, 0, w, 1.4, d);
    P.box('#7a4433', 0, 1.4, 0, w * 1.12, 0.1, d * 1.12);
    P.cyl('#c97a5a', -w * 0.2, 1.5, 0, 0.12, 0.3);
    P.cyl('#c97a5a', w * 0.2, 1.5, 0, 0.12, 0.25);
  },
  skylight(P, w, d) {
    P.box('#e9e6df', 0, 0, 0, w, 0.3, d, { rough: 0.6 });
    P.mesh(BOX, mat('skyglass', () => new THREE.MeshStandardMaterial({ color: '#9fc8d8', roughness: 0.05, metalness: 0.3, emissive: '#4a7a8a', emissiveIntensity: 0.25 })), 0, 0.31, 0, w * 0.86, 0.02, d * 0.8, 0, false);
  },
  wall(P, w, d, it, o) {
    const h = it.h ?? KIT.wall.h;
    P.mesh(BOX, std(o.wallColor ?? '#e8dccb', 0.9), 0, h / 2, 0, w, h, d);
    P.box(PAL.section, 0, h, 0, w + 0.01, 0.025, d + 0.01);
  },
  counterdesk(P, w, d) {
    const h = KIT.counterdesk.h;
    P.model('kBar', { w, d, h, mode: 'stretch', o: { wood: PAL.oak, roles: { metal: 'stone' } } });
    P.model('screen', { x: -w * 0.2, y: h, w: 0.5, d: 0.25, h: 0.42, o: { roles: { metal: 'screen', metalDark: 'black' } } });
    P.prop(w * 0.3, h, 0);
  },
  waitbench(P, w, d) {
    const n = Math.max(2, Math.round(w / 1.4));
    for (let i = 0; i < n; i++) P.model('benchCushion', { x: -w / 2 + (w / n) * (i + 0.5), w: w / n - 0.06, d, mode: 'stretch', top: KIT.waitbench.h, at: [0, 0.2], o: { fabric: FABRIC.sage, wood: PAL.oak } });
  },
};

// ---------------------------------------------------------------- knockable things
const PROP_COLORS = ['#fff3df', '#3f8a86', '#e5493a', '#f6b941', '#5b87c5', '#e57fa6'];
function propMesh(kind, ci) {
  const g = new THREE.Group();
  const c = PROP_COLORS[ci % PROP_COLORS.length];
  if (kind === 0) {
    // a vase with a flower
    const pts = [[0, 0], [0.08, 0], [0.11, 0.08], [0.07, 0.22], [0.05, 0.3], [0.07, 0.34]].map(([x, y]) => new THREE.Vector2(x, y));
    g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 16), std(c, 0.25)));
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.24, 4), std(PAL.leafDark));
    st.position.y = 0.44;
    const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), std(PROP_COLORS[(ci + 2) % PROP_COLORS.length], 0.6));
    fl.position.y = 0.58;
    g.add(st, fl);
  } else if (kind === 1) {
    // a mug
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.068, 0.15, 16), std(c, 0.3));
    m.position.y = 0.075;
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 12), std(c, 0.3));
    h.position.set(0.08, 0.075, 0);
    const tea = new THREE.Mesh(new THREE.CircleGeometry(0.064, 14), std('#7a4a2a', 0.2));
    tea.rotation.x = -Math.PI / 2;
    tea.position.y = 0.14;
    g.add(m, h, tea);
  } else if (kind === 2) {
    // a little potted succulent
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.068, 0.13, 14), std(PAL.pot, 0.85));
    pot.position.y = 0.065;
    const pl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), std(PAL.leaf, 0.7));
    pl.position.y = 0.18;
    pl.scale.y = 0.8;
    g.add(pot, pl);
  } else {
    // a stack of books
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(BOX, std(BOOKS[(ci + i) % BOOKS.length], 0.8));
      b.scale.set(0.3 - i * 0.03, 0.06, 0.21);
      b.position.y = 0.03 + i * 0.06;
      b.rotation.y = i * 0.3;
      g.add(b);
    }
  }
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}

// ---------------------------------------------------------------- the room
export { isOutdoor };

let glowTex = null;
function glowTexture() {
  glowTex ??= canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,214,150,0.9)');
    gr.addColorStop(0.5, 'rgba(255,190,120,0.35)');
    gr.addColorStop(1, 'rgba(255,170,100,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
  });
  return glowTex;
}

/**
 * Builds the room. Returns { group, windows, backdrop, knock(solid, from) → { x, y, z, color, kind } | null,
 * update(t, dt), dispose() }. A knocked thing slides off the edge away from `from`, falls, bounces and stays on the floor;
 * `onLand(prop, speed)` runs when it hits the floor.
 */
export function buildRoom(room, world, { quality = 'high', onLand = null } = {}) {
  const group = new THREE.Group();
  const W = room.w, D = room.d;
  const outdoor = isOutdoor(room);
  const style = WALLS[room.wall] ?? WALLS.sage;
  const floorSpec = FLOORS[room.floor] ?? FLOORS.oak;
  const anim = [];
  const own = []; // geometries and materials made for this room only

  // ---- floor: detail texture in the palette colour, contact shadows baked under every piece
  const aoRes = Math.min(36, 1024 / Math.max(W, D));
  const ao = canvasTex(Math.round(W * aoRes), Math.round(D * aoRes), (g, cw, ch) => {
    g.fillStyle = '#fff';
    g.fillRect(0, 0, cw, ch);
    const sx = cw / W, sz = ch / D;
    const soft = (x0, z0, x1, z1, blur, alpha) => {
      g.save();
      g.globalAlpha = alpha;
      g.fillStyle = '#000';
      g.shadowColor = '#000';
      g.shadowBlur = blur;
      g.shadowOffsetX = cw * 4;
      g.fillRect(x0 * sx - cw * 4, z0 * sz, (x1 - x0) * sx, (z1 - z0) * sz);
      g.restore();
    };
    if (!outdoor || room.wall === 'brick') {
      soft(-1, -1, W + 1, 0.04, aoRes * 0.7, 0.5);
      soft(-1, -1, 0.04, D + 1, aoRes * 0.7, 0.5);
    }
    for (const s of world.solids) {
      if (s.kind === 'carrier' || s.water || s.flat) continue;
      const it = s.item;
      const k = it ? KIT[it.k] : null;
      if (k?.flat || k?.water) continue;
      const tall = (k?.h ?? 1) > 1.2;
      soft(s.x0 + 0.05, s.z0 + 0.05, s.x1 - 0.05, s.z1 - 0.05, aoRes * (tall ? 0.6 : 0.42), tall ? 0.7 : 0.62);
    }
  }, false);
  ao.colorSpace = THREE.NoColorSpace;
  ao.channel = 1;
  const fgeo = new THREE.PlaneGeometry(W, D, 1, 1);
  fgeo.rotateX(-Math.PI / 2);
  fgeo.translate(W / 2, 0, D / 2);
  {
    const p = fgeo.attributes.position;
    const uv = new Float32Array(p.count * 2), uv1 = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      uv[i * 2] = p.getX(i) / floorSpec.tile; uv[i * 2 + 1] = -p.getZ(i) / floorSpec.tile;
      uv1[i * 2] = p.getX(i) / W; uv1[i * 2 + 1] = 1 - p.getZ(i) / D;
    }
    fgeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    fgeo.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
  }
  let floorMat;
  if (floorSpec.planks) {
    const t = plankTexture(floorSpec.planks, floorSpec.rows);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    floorMat = new THREE.MeshStandardMaterial({ color: floorSpec.color, map: t, bumpMap: t, bumpScale: 1.2, roughness: floorSpec.rough, aoMap: ao, aoMapIntensity: 1 });
  } else {
    floorMat = new THREE.MeshStandardMaterial({
      color: floorSpec.color, map: surface(floorSpec.tex), normalMap: surface(floorSpec.tex, true), normalScale: new THREE.Vector2(floorSpec.n, floorSpec.n),
      roughness: floorSpec.rough, aoMap: ao, aoMapIntensity: 1,
    });
  }
  // the baked contact shadows darken the direct light as well
  floorMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <aomap_fragment>', `#include <aomap_fragment>
      reflectedLight.directDiffuse *= mix(1.0, ambientOcclusion, 0.8);
      reflectedLight.directSpecular *= ambientOcclusion;`);
  };
  floorMat.customProgramCacheKey = () => 'floorAO';
  own.push(fgeo, floorMat, ao);
  const floor = new THREE.Mesh(fgeo, floorMat);
  floor.receiveShadow = true;
  group.add(floor);

  // the slab: the cut section under the room
  const slabColor = room.sea ? '#f4f2ec' : room.floor === 'grass' ? '#6b4a35' : outdoor ? '#9a9088' : PAL.section;
  const pad = outdoor ? 0.25 : 0;
  const slabG = new THREE.BoxGeometry(W + WALL_T + pad, 0.6, D + WALL_T + pad);
  own.push(slabG);
  const slab = new THREE.Mesh(slabG, std(slabColor, 0.85));
  slab.position.set(W / 2 - WALL_T / 2 + pad / 2, -0.302, D / 2 - WALL_T / 2 + pad / 2);
  slab.receiveShadow = true;
  group.add(slab);
  if (room.sea) {
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat('sea', () => new THREE.MeshStandardMaterial({ color: '#3c87a6', roughness: 0.6, metalness: 0 })));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(W / 2, -1.0, D / 2);
    sea.receiveShadow = true;
    group.add(sea);
    const hull = new THREE.Mesh(BOX, std('#2f5f8a', 0.6));
    hull.scale.set(W + 0.8, 1.4, D + 0.8);
    hull.position.set(W / 2, -0.95, D / 2);
    group.add(hull);
  }

  // ---- walls
  const windows = [];
  const near = (axis) => world.solids
    .filter((s) => s.item && (KIT[s.item.k]?.h ?? 0) > 1.2 && (axis === 'x' ? s.z0 < 1.2 : s.x0 < 1.2))
    .map((s) => (axis === 'x' ? [s.x0, s.x1] : [s.z0, s.z1]));
  const wallH = outdoor ? (room.wall === 'brick' ? 1.1 : 0) : WALL_H;
  const paperMat = style.brick
    ? mat('brickwall', () => new THREE.MeshStandardMaterial({ color: style.paper, map: surface('brick'), normalMap: surface('brick', true), roughness: 0.9 }))
    : style.glass ? null : wallpaper(style);
  const wainsMat = style.wains ? std(style.wains, 0.7) : null;
  const trimMat = std(style.trim, 0.55);
  const sectionMat = std(PAL.section, 0.9);

  /** One wall along an axis: 'x' (north, z = 0) or 'z' (west, x = 0), with holes for windows at `spots`. */
  function buildWall(axis, len, spots, hgt) {
    const wg = new THREE.Group();
    // x0..x1 along the wall, y0..y1 up; `out` pushes the piece into the room past the wall's face
    const add = (geo, m, x0, x1, y0, y1, out = 0, depth = WALL_T, cast = true) => {
      const mesh = new THREE.Mesh(geo, m);
      const L = x1 - x0, H = y1 - y0;
      const c = out - depth / 2;
      if (axis === 'x') { mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, c); mesh.scale.set(L, H, depth); }
      else { mesh.position.set(c, (y0 + y1) / 2, (x0 + x1) / 2); mesh.scale.set(depth, H, L); }
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      wg.add(mesh);
      return mesh;
    };
    const start = axis === 'x' ? -WALL_T : 0;
    const holes = spots.map((c) => [c - WIN_W / 2, c + WIN_W / 2]).sort((a, b) => a[0] - b[0]);
    const pieces = [];
    let at = start;
    for (const [a, b] of holes) { pieces.push([at, a, 0, hgt]); pieces.push([a, b, 0, SILL]); pieces.push([a, b, WIN_TOP, hgt]); at = b; }
    pieces.push([at, len, 0, hgt]);
    for (const [x0, x1, y0, y1] of pieces) {
      if (x1 - x0 < 0.001 || y1 - y0 < 0.001) continue;
      const g = new THREE.BoxGeometry(1, 1, 1);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (x0 + uv.getX(i) * (x1 - x0)) / 2, (y0 + uv.getY(i) * (y1 - y0)) / 2);
      own.push(g);
      add(g, paperMat, x0, x1, y0, y1);
    }
    if (wainsMat && !outdoor) {
      // wainscoting: panels below a rail, a skirting board
      add(BOX, wainsMat, start, len, 0, WAINS, 0.025, WALL_T + 0.025, false);
      add(BOX, trimMat, start, len, WAINS - 0.02, WAINS + 0.05, 0.05, 0.06, false);
      add(BOX, trimMat, start, len, 0, 0.14, 0.045, 0.06, false);
      const panel = std(shade(style.wains, 0.035), 0.7);
      for (let x = 0.3; x < len - 0.7; x += 1.0) add(BOX, panel, x, Math.min(len - 0.25, x + 0.78), 0.22, WAINS - 0.12, 0.04, 0.03, false);
    }
    // the cut top of the wall
    add(BOX, sectionMat, start, len, hgt, hgt + 0.02, 0, WALL_T, false);
    for (const c of spots) {
      const x0 = c - WIN_W / 2, x1 = c + WIN_W / 2;
      const fr = 0.08;
      add(BOX, trimMat, x0 - fr, x0, SILL, WIN_TOP, 0.03, 0.08);
      add(BOX, trimMat, x1, x1 + fr, SILL, WIN_TOP, 0.03, 0.08);
      add(BOX, trimMat, x0 - fr, x1 + fr, WIN_TOP, WIN_TOP + fr, 0.03, 0.08);
      add(BOX, trimMat, x0 - fr - 0.06, x1 + fr + 0.06, SILL - 0.06, SILL + 0.02, 0.14, 0.3);
      // the sash: mullion and transom, set back in the opening
      add(BOX, trimMat, c - 0.025, c + 0.025, SILL, WIN_TOP, -0.1, 0.05);
      add(BOX, trimMat, x0, x1, WIN_TOP - 0.42, WIN_TOP - 0.37, -0.1, 0.05);
      // the view outside
      const card = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), skyCard());
      const ch = WIN_TOP - SILL;
      if (axis === 'x') { card.position.set(c, (SILL + WIN_TOP) / 2, -WALL_T - 0.1); }
      else { card.position.set(-WALL_T - 0.1, (SILL + WIN_TOP) / 2, c); card.rotation.y = Math.PI / 2; }
      card.scale.set(WIN_W + 0.4, ch + 0.2, 1);
      wg.add(card);
      windows.push({ axis, c });
    }
    return wg;
  }

  if (style.glass) {
    // a greenhouse: glass panes in white frames; roof bars stripe the sunlight
    const frameM = std(style.trim, 0.5);
    const glassM = roleMat('glass', {});
    for (const [axis, len] of [['x', W], ['z', D]]) {
      for (let x = 0; x <= len + 0.01; x += 1.6) {
        const post = new THREE.Mesh(BOX, frameM);
        post.scale.set(axis === 'x' ? 0.08 : 0.1, WALL_H, axis === 'x' ? 0.1 : 0.08);
        post.position.set(axis === 'x' ? x : -0.05, WALL_H / 2, axis === 'x' ? -0.05 : x);
        post.castShadow = true;
        group.add(post);
      }
      const pane = new THREE.Mesh(BOX, glassM);
      pane.scale.set(axis === 'x' ? len : 0.02, WALL_H, axis === 'x' ? 0.02 : len);
      pane.position.set(axis === 'x' ? len / 2 : -0.05, WALL_H / 2, axis === 'x' ? -0.05 : len / 2);
      group.add(pane);
      for (const y of [0.6, WALL_H]) {
        const rail = new THREE.Mesh(BOX, frameM);
        rail.scale.set(axis === 'x' ? len : 0.12, 0.08, axis === 'x' ? 0.12 : len);
        rail.position.set(axis === 'x' ? len / 2 : -0.05, y, axis === 'x' ? -0.05 : len / 2);
        rail.castShadow = true;
        group.add(rail);
      }
    }
    const barM = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    own.push(barM);
    for (let x = 0.8; x < W + 6; x += 1.6) {
      const b = new THREE.Mesh(BOX, barM);
      b.scale.set(0.14, 0.05, D + 8);
      b.position.set(x, WALL_H + 0.6, D / 2 + 2);
      b.castShadow = true;
      group.add(b);
    }
  } else if (wallH > 0) {
    const wins = roomWindows(room, world);
    const nSpots = wins.filter((w) => w.axis === 'x').map((w) => w.c);
    const wSpots = wins.filter((w) => w.axis === 'z').map((w) => w.c);
    group.add(buildWall('x', W, nSpots, wallH));
    group.add(buildWall('z', D, wSpots, wallH));
  } else if (room.wall === 'white') {
    // a ship's rail along the back edges
    const railM = std('#f4f2ec', 0.5);
    for (const [axis, len] of [['x', W], ['z', D]]) {
      for (let x = 0; x <= len; x += 1.2) {
        const p = new THREE.Mesh(BOX, railM);
        p.scale.set(0.06, 0.95, 0.06);
        p.position.set(axis === 'x' ? x : 0.05, 0.475, axis === 'x' ? 0.05 : x);
        p.castShadow = true;
        group.add(p);
      }
      for (const y of [0.92, 0.5]) {
        const r = new THREE.Mesh(BOX, railM);
        r.scale.set(axis === 'x' ? len : 0.05, 0.05, axis === 'x' ? 0.05 : len);
        r.position.set(axis === 'x' ? len / 2 : 0.05, y, axis === 'x' ? 0.05 : len / 2);
        r.castShadow = true;
        group.add(r);
      }
    }
  }

  // ---- pictures between the windows, curtains at some windows (indoors)
  if (!outdoor) {
    let pi = Math.round(W * 3 + D);
    for (const [axis, len] of [['x', W], ['z', D]]) {
      const taken = windows.filter((w) => w.axis === axis).map((w) => [w.c - WIN_W / 2 - 0.55, w.c + WIN_W / 2 + 0.55]);
      const tall = near(axis);
      for (let c = 1.2; c < len - 0.8; c += 0.5) {
        if (taken.some(([a, b]) => c > a - 0.4 && c < b + 0.4)) continue;
        if (tall.some(([a, b]) => c > a - 0.45 && c < b + 0.45)) continue;
        const fw = 0.5 + (pi % 3) * 0.14, fh = fw * 1.25;
        const frame = new THREE.Mesh(BOX, std(pi % 2 ? PAL.oakDark : PAL.brass, 0.45, pi % 2 ? 0 : 0.6));
        const art = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), painting(pi));
        const y = 1.62 + (pi % 2) * 0.1;
        if (axis === 'x') {
          frame.position.set(c, y, 0.03); frame.scale.set(fw + 0.09, fh + 0.09, 0.05);
          art.position.set(c, y, 0.057); art.scale.set(fw, fh, 1);
        } else {
          frame.position.set(0.03, y, c); frame.scale.set(0.05, fh + 0.09, fw + 0.09);
          art.position.set(0.057, y, c); art.rotation.y = Math.PI / 2; art.scale.set(fw, fh, 1);
        }
        frame.castShadow = true;
        art.receiveShadow = true;
        group.add(frame, art);
        taken.push([c - 1.2, c + 1.2]);
        pi++;
      }
    }
    // curtains: gathered panels either side of every other window, on a brass rod
    const rodM = std(PAL.brass, 0.35, 0.7);
    windows.forEach((w, i) => {
      if (i % 2) return;
      const cm = std(FABRIC[['mustard', 'blush', 'teal', 'sage'][(i / 2) % 4]], 0.95);
      const hold = new THREE.Group();
      const top = WIN_TOP + 0.2, bottom = 0.25, pw = 0.42;
      const g = new THREE.PlaneGeometry(pw, top - bottom, 12, 1);
      const p = g.attributes.position;
      for (let j = 0; j < p.count; j++) {
        const u = (p.getX(j) + pw / 2) / pw;
        p.setZ(j, Math.sin(u * Math.PI * 5) * 0.035 + 0.04);
      }
      g.computeVertexNormals();
      own.push(g);
      for (const s2 of [-1, 1]) {
        const panel = new THREE.Mesh(g, cm);
        panel.position.set(s2 * (WIN_W / 2 + 0.16), (top + bottom) / 2, 0.02);
        panel.castShadow = true;
        panel.receiveShadow = true;
        hold.add(panel);
      }
      const rod = new THREE.Mesh(CYL, rodM);
      rod.scale.set(0.035, WIN_W + 1.3, 0.035);
      rod.rotation.z = Math.PI / 2;
      rod.position.set(0, top + 0.03, 0.09);
      hold.add(rod);
      for (const s2 of [-1, 1]) {
        const fin = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), rodM);
        own.push(fin.geometry);
        fin.position.set(s2 * (WIN_W / 2 + 0.68), top + 0.03, 0.09);
        hold.add(fin);
      }
      if (w.axis === 'x') hold.position.set(w.c, 0, 0);
      else { hold.position.set(0, 0, w.c); hold.rotation.y = Math.PI / 2; }
      group.add(hold);
    });
  }

  // ---- sun shafts and dust (medium and high, indoors)
  if (!outdoor && quality !== 'low' && windows.length) {
    const shaftMat = mat('shaft', () => new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 } },
      vertexShader: 'attribute float aT; varying float vT; varying vec3 vP; void main(){ vT = aT; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform float uTime; varying float vT; varying vec3 vP; void main(){ float f = (1.0 - vT) * 0.06 * (0.85 + 0.15 * sin(uTime * 0.6 + vP.x * 1.3 + vP.z)); gl_FragColor = vec4(vec3(1.0, 0.8, 0.52) * f, 1.0); }',
    }));
    const pos = [], tt = [];
    for (const w of windows) {
      const corners = w.axis === 'x'
        ? [[w.c - WIN_W / 2, SILL, 0], [w.c + WIN_W / 2, SILL, 0], [w.c + WIN_W / 2, WIN_TOP, 0], [w.c - WIN_W / 2, WIN_TOP, 0]]
        : [[0, SILL, w.c - WIN_W / 2], [0, SILL, w.c + WIN_W / 2], [0, WIN_TOP, w.c + WIN_W / 2], [0, WIN_TOP, w.c - WIN_W / 2]];
      const far = corners.map(([x, y, z]) => { const t = y / -SUN_DIR.y; return [x + SUN_DIR.x * t, 0.01, z + SUN_DIR.z * t]; });
      const quad = (a, b, c, d, ta, tb, tc, td) => { pos.push(...a, ...b, ...c, ...a, ...c, ...d); tt.push(ta, tb, tc, ta, tc, td); };
      for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad(corners[i], corners[j], far[j], far[i], 0, 0, 1, 1); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aT', new THREE.Float32BufferAttribute(tt, 1));
    own.push(g);
    const shafts = new THREE.Mesh(g, shaftMat);
    shafts.renderOrder = 5;
    shafts.frustumCulled = false;
    group.add(shafts);
    // dust drifting in the light
    const N = windows.length * 70;
    const dpos = new Float32Array(N * 3);
    const seeds = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const w = windows[i % windows.length];
      const t = Math.random();
      const y = SILL + Math.random() * (WIN_TOP - SILL);
      const along = (Math.random() - 0.5) * WIN_W;
      const d = (y * t) / -SUN_DIR.y;
      const bx = w.axis === 'x' ? w.c + along : 0, bz = w.axis === 'x' ? 0 : w.c + along;
      dpos[i * 3] = bx + SUN_DIR.x * d;
      dpos[i * 3 + 1] = y + SUN_DIR.y * d;
      dpos[i * 3 + 2] = bz + SUN_DIR.z * d;
      seeds[i] = Math.random() * 100;
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
    dg.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    const dm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uScale: { value: 600 } },
      vertexShader: `attribute float aSeed; uniform float uTime; uniform float uScale; varying float vA;
        void main(){ vec3 p = position + vec3(sin(uTime*0.13+aSeed)*0.25, sin(uTime*0.09+aSeed*1.7)*0.18, cos(uTime*0.11+aSeed)*0.25);
          vec4 mv = modelViewMatrix * vec4(p,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uScale * 0.02 / -mv.z;
          vA = 0.5 + 0.5 * sin(uTime * 1.3 + aSeed * 3.0); }`,
      fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vec3(1.0,0.9,0.7) * (1.0 - d*2.0) * vA * 0.8, 1.0); }',
    });
    own.push(dg, dm);
    const dust = new THREE.Points(dg, dm);
    dust.renderOrder = 6;
    dust.frustumCulled = false;
    group.add(dust);
    anim.push((t) => { shaftMat.uniforms.uTime.value = t; dm.uniforms.uTime.value = t; });
  }

  // ---- the invisible ceiling: indoors the sun only gets in through the windows
  if (!outdoor) {
    const cm = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    own.push(cm);
    const ceil = new THREE.Mesh(BOX, cm);
    ceil.scale.set(W + 12, 0.2, D + 12);
    ceil.position.set(-WALL_T + (W + 12) / 2, WALL_H + 0.1, -WALL_T + (D + 12) / 2);
    ceil.castShadow = true;
    group.add(ceil);
  }

  // ---- furniture
  const props = [];
  const bySolid = {};
  const pieces = [];
  const accents = [FABRIC.mustard, FABRIC.blush, FABRIC.teal, FABRIC.sage, FABRIC.cream, FABRIC.red];
  const glowMat = new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(0.5, 0.42, 0.3) });
  own.push(glowMat);
  (room.items ?? []).forEach((it, idx) => {
    const k = KIT[it.k];
    const build = BUILD[it.k];
    if (!k || !build) return;
    const w = it.w ?? k.w;
    const d = it.d ?? k.d;
    const o = { fabric: FABRIC[it.c] ?? FABRIC.teal, wood: PAL.oak, accent: accents[idx % accents.length], accent2: accents[(idx + 3) % accents.length], wallColor: style.paper };
    const P = new Piece(o, own);
    build(P, w, d, it, o);
    const rot = (it.r ?? 0) * (Math.PI / 2);
    P.group.position.set(it.x, 0, it.z);
    P.group.rotation.y = rot;
    group.add(P.group);
    pieces.push({ it, group: P.group, tall: !!k.tall });
    const c = Math.cos(rot), s = Math.sin(rot);
    for (const gl of P.glows) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(gl.r * 2, gl.r * 2).rotateX(-Math.PI / 2), glowMat);
      m.position.set(it.x + gl.x * c + gl.z * s, 0.02, it.z - gl.x * s + gl.z * c);
      m.renderOrder = 2;
      own.push(m.geometry);
      group.add(m);
    }
    const solidIndex = world.solids.findIndex((so) => so.item === it);
    P.props.forEach((l, j) => {
      const x = it.x + l.x * c + l.z * s, z = it.z - l.x * s + l.z * c;
      const kind = (idx * 3 + j) % 4;
      const ci = idx + j * 2;
      const obj = propMesh(kind, ci);
      obj.position.set(x, l.y, z);
      obj.rotation.y = hash(idx, j) * 6.28;
      group.add(obj);
      const pr = { x, y: l.y, z, obj, kind, color: PROP_COLORS[ci % PROP_COLORS.length], solid: solidIndex, state: 'rest', lie: [0, 0.075, 0.09, 0][kind], home: { x, y: l.y, z, ry: obj.rotation.y } };
      props.push(pr);
      (bySolid[solidIndex] ??= []).push(pr);
    });
  });

  // a washing line (rooftop)
  if (room.line) {
    const [x0, z0, x1, z1] = room.line;
    const pole = std('#e9e2d6', 0.6);
    for (const [x, z] of [[x0, z0], [x1, z1]]) {
      const p = new THREE.Mesh(CYL, pole);
      p.scale.set(0.07, 1.9, 0.07);
      p.position.set(x, 0.95, z);
      p.castShadow = true;
      group.add(p);
    }
    const len = Math.hypot(x1 - x0, z1 - z0);
    const a = -Math.atan2(z1 - z0, x1 - x0);
    const line = new THREE.Mesh(BOX, std('#f4f2ec'));
    line.scale.set(len, 0.015, 0.015);
    line.position.set((x0 + x1) / 2, 1.85, (z0 + z1) / 2);
    line.rotation.y = a;
    group.add(line);
    const cloth = ['#e5493a', '#fff3df', '#3f7fcb', '#f6b941', '#7fa276'];
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      const hold = new THREE.Group();
      hold.position.set(x0 + (x1 - x0) * t, 1.84, z0 + (z1 - z0) * t);
      hold.rotation.y = a;
      const c = new THREE.Mesh(BOX, std(cloth[i % cloth.length], 0.9));
      c.scale.set(0.5, 0.6, 0.02);
      c.position.y = -0.3;
      c.castShadow = true;
      hold.add(c);
      group.add(hold);
      anim.push((tm) => { hold.rotation.x = Math.sin(tm * 1.7 + i * 1.3) * 0.16; });
    }
  }
  if (room.flap) {
    const f = new THREE.Group();
    const frame = new THREE.Mesh(BOX, std('#5e3d29', 0.7));
    frame.scale.set(0.8, 0.75, 0.06);
    frame.position.y = 0.375;
    const door = new THREE.Mesh(BOX, std('#efe2c8', 0.5));
    door.scale.set(0.6, 0.6, 0.04);
    door.position.set(0, 0.36, 0.04);
    f.add(frame, door);
    f.position.set(room.flap.x, 0, 0.05);
    group.add(f);
  }

  // ---- falling things: slide off the edge, fall with a spin, bounce, lie on their side (a vase breaks)
  const G = 16;
  function stepProp(p, dt) {
    if (p.state === 'slide') {
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.ang = Math.min(0.45, p.ang + dt * 3);
      const s = world.solids[p.solid];
      const off = !s || p.x < s.x0 - 0.05 || p.x > s.x1 + 0.05 || p.z < s.z0 - 0.05 || p.z > s.z1 + 0.05;
      if (off) { p.state = 'fall'; p.vy = 0.6; p.spin = 7 + hash(p.x, p.z) * 7; }
    } else if (p.state === 'fall') {
      p.vy -= G * dt;
      p.x += p.vx * dt * 0.6;
      p.z += p.vz * dt * 0.6;
      p.y += p.vy * dt;
      p.ang += p.spin * dt;
      if (p.y <= 0) {
        p.y = 0;
        const speed = -p.vy;
        if (p.kind === 0 && !p.bounced) {
          p.state = 'gone';
          p.obj.visible = false;
          onLand?.(p, speed, true);
          return;
        }
        onLand?.(p, speed, false);
        if (speed > 2.5 && !p.bounced) { p.vy = speed * 0.25; p.spin *= 0.3; p.vx *= 0.4; p.vz *= 0.4; p.bounced = true; }
        else { p.state = 'down'; p.ang = p.kind === 3 ? 0 : Math.PI / 2; }
      }
    }
    p.obj.position.set(p.x, p.y + (p.state === 'down' ? p.lie : 0), p.z);
    p.obj.rotation.set(0, p.dirA, 0);
    p.obj.rotateZ(-p.ang);
  }

  return {
    group,
    windows,
    pieces,
    backdrop: room.floor === 'grass' ? '#24301f' : room.sea ? '#2d5f78' : '#2a1c19',
    outdoor,
    /** A cat swatted something off piece `solid` from `from` {x, z}: it slides off the far edge and falls. */
    knock(solid, from = null) {
      const list = (bySolid[solid] ?? []).filter((p) => p.state === 'rest');
      if (!list.length) return null;
      // the thing nearest the cat
      if (from) list.sort((a, b) => Math.hypot(a.x - from.x, a.z - from.z) - Math.hypot(b.x - from.x, b.z - from.z));
      const p = list[0];
      let dx = from ? p.x - from.x : hash(p.x) - 0.5, dz = from ? p.z - from.z : hash(p.z) - 0.5;
      const l = Math.hypot(dx, dz) || 1;
      dx /= l; dz /= l;
      p.vx = dx * 3.2;
      p.vz = dz * 3.2;
      p.vy = 0;
      p.ang = 0;
      p.bounced = false;
      p.dirA = Math.atan2(-dz, dx);
      p.state = 'slide';
      return { x: p.x, y: p.y, z: p.z, color: p.color, kind: p.kind };
    },
    /** Put everything back (a new round in the same room). */
    tidy() {
      for (const p of props) {
        p.state = 'rest'; p.x = p.home.x; p.y = p.home.y; p.z = p.home.z;
        p.obj.visible = true;
        p.obj.position.set(p.x, p.y, p.z);
        p.obj.rotation.set(0, p.home.ry, 0);
      }
    },
    update(t, dt = 1 / 60) {
      for (const f of anim) f(t);
      for (const p of props) if (p.state === 'slide' || p.state === 'fall') stepProp(p, Math.min(dt, 0.05));
    },
    dispose() {
      group.traverse((o) => {
        if (o.isInstancedMesh) o.dispose();
        else if (o.geometry && !SHARED.has(o.geometry) && !o.userData.kit) o.geometry.dispose();
      });
      for (const r of own) r.dispose();
    },
  };
}
