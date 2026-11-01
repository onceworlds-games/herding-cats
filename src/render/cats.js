// Every cat in the room: a skinned model per cat (one build per personality, one fur material per cat), posed each
// frame by its animator from the simulation, with a soft contact shadow and a symbol overhead when it matters.

import * as THREE from 'three';
import { S } from '../sim/tuning.js';
import { buildCat, makeSkeleton } from './catmesh.js';
import { createCatMaterial, setCoat } from './catshader.js';
import { createAnimator } from './catanim.js';
import { drawSymbol } from '../ui/symbols.js';

export const VIS = 1.16; // a drawn cat is a little bigger than its footprint

const builds = new Map();
export function catBuild(type) {
  if (!builds.has(type)) builds.set(type, buildCat(type));
  return builds.get(type);
}

function symbolTexture(name, fill) {
  const cv = document.createElement('canvas');
  cv.width = 96;
  cv.height = 96;
  const g = cv.getContext('2d');
  g.lineJoin = 'round';
  if (name === 'z' || name === '!') {
    g.font = name === 'z' ? '900 50px Fraunces, Georgia, serif' : '900 72px Fraunces, Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 10;
    g.strokeStyle = '#2b1d1c';
    g.fillStyle = name === 'z' ? '#fff3df' : fill;
    if (name === 'z') {
      g.strokeText('z', 36, 60); g.fillText('z', 36, 60);
      g.font = '900 36px Fraunces, Georgia, serif';
      g.strokeText('z', 66, 30); g.fillText('z', 66, 30);
    } else { g.strokeText('!', 48, 52); g.fillText('!', 48, 52); }
  } else drawSymbol(g, name, 48, 48, 72, fill, '#2b1d1c', 2.4);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// a soft round shadow texture
let blobTex = null;
export function blobTexture() {
  if (blobTex) return blobTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.8)');
  gr.addColorStop(0.45, 'rgba(0,0,0,0.45)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  blobTex = new THREE.CanvasTexture(cv);
  return blobTex;
}

export function createCats(scene, { quality = 'high' } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  const pool = [];
  const sym = {};
  const tex = (name, fill = '#fff3df') => (sym[name + fill] ??= symbolTexture(name, fill));
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, color: '#2a1810', opacity: 0.6 });
  const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  let q = quality;

  function makeEntry(type) {
    const build = catBuild(type);
    const { bones, skeleton } = makeSkeleton(build);
    const mat = createCatMaterial(q);
    const mesh = new THREE.SkinnedMesh(build.geometry, mat);
    mesh.add(bones[0]);
    mesh.bind(skeleton);
    mesh.castShadow = q !== 'low';
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    const seed = Math.random();
    const anim = createAnimator(build, bones, seed);
    const blob = new THREE.Mesh(blobGeo, blobMat);
    blob.renderOrder = 1;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
    spr.visible = false;
    spr.renderOrder = 10;
    group.add(mesh, blob, spr);
    return { type, mesh, mat, bones, anim, blob, spr, coat: null, seed };
  }

  function entryFor(i, c) {
    let e = pool[i];
    if (e && e.type !== c.type) {
      group.remove(e.mesh, e.blob, e.spr);
      e.mat.dispose();
      e = null;
    }
    if (!e) e = pool[i] = makeEntry(c.type);
    if (e.coat !== c.coat) { setCoat(e.mat, c.coat, (c.id * 0.6180339) % 1); e.coat = c.coat; }
    return e;
  }

  function hide(e) {
    e.mesh.visible = false;
    e.blob.visible = false;
    e.spr.visible = false;
  }

  /**
   * cats: the simulation's cats. offset(i) → {x, z} drawing correction (prediction easing). people: for glances.
   * me: the local person (symbols show up close). fx: per-cat { flash, glow } by id (optional).
   */
  function update(cats, dt, t, { offset, people, me, reducedMotion, fx } = {}) {
    for (let i = 0; i < cats.length; i++) {
      const c = cats[i];
      const e = entryFor(i, c);
      if (c.st === S.boxed || c.surprise) { hide(e); e.anim.st.last = -1; continue; }
      e.mesh.visible = true;
      const o = offset ? offset(i) : null;
      const x = c.x + (o ? o.x : 0);
      const z = c.z + (o ? o.z : 0);
      const scale = (c.size || 1) * VIS;
      const face = e.anim.update(c, dt, t, { people, scale, reducedMotion });
      const m = e.mesh;
      // squeezing through the carrier door: narrower, then gone
      let sx = 1, sy = 1, sz = 1;
      if (c.st === S.enter) {
        const k = Math.max(0, Math.min(1, c.tt / 0.35));
        sz = 0.55 + 0.45 * k;
        sy = 0.7 + 0.3 * k;
        sx = 1.15 - 0.15 * k;
      }
      const sq = e.anim.st.squash;
      if (sq > 0 && !reducedMotion) { sx *= 1 + sq * 0.12; sy *= 1 - sq * 0.16; sz *= 1 + sq * 0.12; }
      m.position.set(x, c.y || 0, z);
      m.rotation.set(0, -e.anim.st.h, 0);
      if (c.st === S.hidden) m.rotation.y = -(e.anim.st.h + Math.PI); // under the furniture, facing in: the tail shows
      m.scale.set(scale * sx, scale * sy, scale * sz);
      const u = e.mat.userData.u;
      u.uFace.value.set(face.pupil, face.blink, face.mouth, face.sleepy);
      u.uLook.value.set(face.lookX, face.lookY);
      u.uBreath.value = face.breath;
      const f = fx ? fx[c.id] : null;
      u.uFx.value.set(f ? f.flash : 0, f ? f.glow : 0, t, 0);
      // contact shadow
      const y = c.y || 0;
      e.blob.visible = c.st !== S.hidden;
      const sh = 0.82 * scale * (1 + Math.min(0.6, y * 0.6));
      e.blob.scale.set(sh * 1.1, 1, sh * 0.62);
      e.blob.rotation.y = -e.anim.st.h;
      e.blob.position.set(x, (c.st === S.perch ? y : 0) + 0.012, z);

      // a symbol above some cats when it matters
      const spr = e.spr;
      let symName = null;
      let fill = '#fff3df';
      const dMe = me ? Math.hypot(me.x - x, me.z - z) : 0;
      const sleeping = c.st === S.sleep || (c.type === 'loaf' && (c.st === S.idle || c.st === S.settle));
      if (c.type === 'boss') { symName = 'crown'; fill = '#f6b941'; }
      else if (c.type === 'loaf' && sleeping && dMe < 7) symName = 'z';
      else if (c.type === 'zoomer' && (c.st === S.wiggle || c.st === S.sprint)) { symName = 'bolt'; fill = c.st === S.wiggle && Math.sin(t * 30) > 0 ? '#f6b941' : '#fff3df'; }
      else if (c.type === 'scaredy' && (c.st === S.hidden || c.st === S.runhide)) { symName = '!'; fill = '#f6b941'; }
      else if (c.type === 'glutton' && c.st === S.lured) { symName = 'fish'; fill = '#f6b941'; }
      if (symName && c.st !== S.enter) {
        spr.visible = true;
        spr.material.map = tex(symName, fill);
        const bobS = reducedMotion ? 0 : Math.sin(t * 3 + i) * 0.04;
        spr.position.set(x, y + 0.95 * scale + bobS + (c.st === S.hidden ? -0.3 : 0), z);
        const big = c.type === 'boss' ? 0.42 : 0.36;
        spr.scale.set(big, big, 1);
      } else spr.visible = false;
    }
    for (let i = cats.length; i < pool.length; i++) if (pool[i]) hide(pool[i]);
  }

  function reset() {
    for (const e of pool) if (e) { hide(e); e.anim.st.last = -1; e.anim.st.h = null; }
  }

  function setQuality(nq) {
    if (nq === q) return;
    q = nq;
    for (let i = 0; i < pool.length; i++) {
      const e = pool[i];
      if (!e) continue;
      group.remove(e.mesh, e.blob, e.spr);
      e.mat.dispose();
      pool[i] = null;
    }
  }

  /** world position of a cat's head (for effects), or null */
  function headOf(i, out = new THREE.Vector3()) {
    const e = pool[i];
    if (!e || !e.mesh.visible) return null;
    e.bones[5].getWorldPosition(out);
    return out;
  }

  return { group, update, reset, setQuality, headOf, pool };
}
