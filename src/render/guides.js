// What your next move will do, drawn on the floor: while your clap is ready, a dotted path for every cat it would shoot
// (gold when it goes in, through a bounce and on through the cats it knocks); a chevron in front of each cat you're
// pushing (gold when it's lined up with the door); a red ring under a Scaredy a clap would send into hiding; and, while the
// doorbell is about to ring, where it will scatter everyone.

import * as THREE from 'three';
import { clapPreview, pushPreview } from '../sim/motion.js';
import { BELL, S } from '../sim/tuning.js';

const MAX_DOTS = 900;
const MAX_RINGS = 60;
const MAX_ARROWS = 24;
const GOLD = new THREE.Color('#ffc94a');
const CREAM = new THREE.Color('#fff3df');
const RED = new THREE.Color('#ff5a4a');
const SPACING = 0.3;

function flatMat() {
  return new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false, vertexColors: false });
}

export function createGuides(scene) {
  const group = new THREE.Group();
  group.renderOrder = 6;
  scene.add(group);
  const flat = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

  // dots: one instanced disc with an ink rim, coloured per instance
  const dotGeo = new THREE.CircleGeometry(1, 14).applyMatrix4(flat);
  const dotMat = flatMat();
  dotMat.opacity = 0.92;
  const dots = new THREE.InstancedMesh(dotGeo, dotMat, MAX_DOTS);
  dots.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  dots.setColorAt(0, CREAM);
  dots.renderOrder = 6;
  dots.frustumCulled = false;
  const rimMat = new THREE.MeshBasicMaterial({ color: '#2b1c1c', transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false });
  const rims = new THREE.InstancedMesh(dotGeo, rimMat, MAX_DOTS);
  rims.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  rims.renderOrder = 5;
  rims.frustumCulled = false;
  group.add(rims, dots);

  // rings: bounces, knocks, the door a shot goes in at, a spooked Scaredy, the doorbell
  const ringGeo = new THREE.RingGeometry(0.78, 1, 32).applyMatrix4(flat);
  const ringMat = flatMat();
  const rings = new THREE.InstancedMesh(ringGeo, ringMat, MAX_RINGS);
  rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  rings.setColorAt(0, CREAM);
  rings.renderOrder = 6;
  rings.frustumCulled = false;
  group.add(rings);

  // chevrons for pushes
  const sh = new THREE.Shape();
  sh.moveTo(0, 0.5);
  sh.lineTo(0.42, 0);
  sh.lineTo(0, -0.5);
  sh.lineTo(-0.2, -0.5);
  sh.lineTo(0.2, 0);
  sh.lineTo(-0.2, 0.5);
  sh.closePath();
  const chevGeo = new THREE.ShapeGeometry(sh).applyMatrix4(flat);
  const chevMat = flatMat();
  chevMat.opacity = 0.95;
  const chevs = new THREE.InstancedMesh(chevGeo, chevMat, MAX_ARROWS * 3);
  chevs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  chevs.setColorAt(0, CREAM);
  chevs.renderOrder = 7;
  chevs.frustumCulled = false;
  const chevRim = new THREE.InstancedMesh(chevGeo, rimMat, MAX_ARROWS * 3);
  chevRim.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  chevRim.renderOrder = 6;
  chevRim.frustumCulled = false;
  group.add(chevRim, chevs);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  let nd = 0;
  let nr = 0;
  let na = 0;
  let cache = null;
  let cacheT = -1;

  function dot(x, z, r, col) {
    if (nd >= MAX_DOTS) return;
    m.makeScale(r, 1, r).setPosition(x, 0.03, z);
    dots.setMatrixAt(nd, m);
    dots.setColorAt(nd, col);
    m.makeScale(r * 1.35, 1, r * 1.35).setPosition(x, 0.028, z);
    rims.setMatrixAt(nd, m);
    nd++;
  }
  function ring(x, z, r, col, y = 0.032) {
    if (nr >= MAX_RINGS) return;
    m.makeScale(r, 1, r).setPosition(x, y, z);
    rings.setMatrixAt(nr, m);
    rings.setColorAt(nr, col);
    nr++;
  }
  function chevron(x, z, a, s, col) {
    if (na >= MAX_ARROWS * 3) return;
    q.setFromAxisAngle(up, -a);
    p.set(x, 0.035, z);
    sc.set(s, 1, s);
    m.compose(p, q, sc);
    chevs.setMatrixAt(na, m);
    chevs.setColorAt(na, col);
    sc.set(s * 1.25, 1, s * 1.25);
    p.y = 0.033;
    m.compose(p, q, sc);
    chevRim.setMatrixAt(na, m);
    na++;
  }

  /** Dots along a path's points, marching toward its end. */
  function trail(pts, col, r, phase, upTo = Infinity) {
    let carry = phase;
    let bounces = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if (b.bounce) bounces++;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const L = Math.hypot(dx, dz);
      let t = carry;
      while (t < L) {
        dot(a.x + (dx * t) / L, a.z + (dz * t) / L, r, col);
        t += SPACING;
      }
      carry = t - L;
      if (b.bounce) ring(b.x, b.z, 0.16, col);
      if (bounces >= upTo) break;
    }
  }

  /**
   * Per frame. opts: { me (sim person or null), clapReady, t, reduced, push: bool }.
   */
  function update(g, opts) {
    nd = 0;
    nr = 0;
    na = 0;
    const me = opts.me;
    const t = opts.t ?? 0;
    const phase = opts.reduced ? 0 : (t * 0.9) % SPACING;
    const pulse = opts.reduced ? 1 : 0.85 + Math.sin(t * 7) * 0.15;
    if (g && !g.over) {
      // the clap's shots (recomputed ten times a second; the cats barely move between)
      const B = g.bell;
      const bellSoon = B && B.warned && g.started;
      if (me && me.active !== false && (opts.clapReady || bellSoon)) {
        if (!cache || t - cacheT > 0.1 || t < cacheT) {
          cache = bellSoon ? clapPreview(g, B.x, B.z, BELL.radius) : clapPreview(g, me.x, me.z);
          cacheT = t;
        }
        for (const e of cache) {
          const c = e.c;
          if (e.kind === 'hide') {
            if (c.st !== S.hidden) ring(c.x, c.z, 0.5 * pulse, RED);
            continue;
          }
          const gold = e.path.end === 'in';
          const col = gold ? GOLD : CREAM;
          const r = gold ? 0.075 : e.path.chain > 0 ? 0.045 : 0.055;
          trail(e.path.pts, col, r, phase, gold ? Infinity : 2);
          for (const k of e.path.knocks) ring(k.x, k.z, 0.24 * pulse, col);
          if (gold) {
            const end = e.path.pts[e.path.pts.length - 1];
            ring(end.x, end.z, 0.42 * pulse, GOLD);
          }
        }
        if (bellSoon) ring(B.x, B.z, (0.6 + ((t * 2) % 1) * 1.4), RED);
      } else cache = null;
      // pushes
      if (me && me.active !== false && opts.push !== false) {
        for (const c of g.cats) {
          if (c.st !== S.alert && c.st !== S.flee) continue;
          const pv = pushPreview(g, c, me);
          if (!pv) continue;
          const col = pv.gold ? GOLD : CREAM;
          const ux = Math.cos(pv.a);
          const uz = Math.sin(pv.a);
          const n = pv.gold ? 3 : 2;
          const s = (pv.gold ? 0.26 : 0.2) * (c.size || 1);
          const start = 0.55 * (c.size || 1);
          for (let i = 0; i < n; i++) {
            const d = start + i * s * 1.05 + (opts.reduced ? 0 : ((t * 2.2) % 1) * s * 0.5);
            chevron(c.x + ux * d, c.z + uz * d, pv.a, s, col);
          }
        }
      }
    } else cache = null;
    dots.count = nd;
    rims.count = nd;
    rings.count = nr;
    chevs.count = na;
    chevRim.count = na;
    for (const im of [dots, rims, rings, chevs, chevRim]) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }

  function clear() {
    for (const im of [dots, rims, rings, chevs, chevRim]) im.count = 0;
    cache = null;
  }

  return { group, update, clear };
}
