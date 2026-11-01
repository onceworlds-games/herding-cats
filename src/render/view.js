// One simulation on screen: its room, carriers, people and cats, plus the effects and sounds its events make. Solo runs,
// match rounds, the lobby and the attract mode all draw through this.

import * as THREE from 'three';
import { buildRoom } from './room.js';
import { createCats } from './cats.js';
import { makePerson } from './people.js';
import { makeCarrier } from './carriers.js';
import { createFx, SHAPE } from './fx.js';
import { createGuides } from './guides.js';
import { createTwists } from './twists.js';
import { COAT_LOOK } from './catshader.js';
import { TREATS, CLAP, S } from '../sim/tuning.js';
import { TRICKS } from '../sim/game.js';
import { COAT_INFO } from '../sim/coats.js';
import * as sfx from '../audio.js';

const PITCH = { kitten: 1.6, boss: 0.62, glutton: 0.8, scaredy: 1.3, zoomer: 1.15, loaf: 0.9, moggy: 1 };

// the cooldown ring under the player's feet: gold half for treats, cream half for clap
function cooldownRing() {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { tr: { value: 1 }, cl: { value: 1 }, seat: { value: new THREE.Color('#fff3df') }, flash: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float tr; uniform float cl; uniform vec3 seat; uniform float flash;
      void main(){
        vec2 p = vUv * 2.0 - 1.0; float r = length(p);
        if (r > 1.0 || r < 0.62) discard;
        float a = atan(p.x, p.y); // 0 at the top, + to the right
        vec3 ink = vec3(0.17, 0.11, 0.11);
        if (r > 0.93 || r < 0.68) { gl_FragColor = vec4(ink, 0.85); return; }
        float side = a < 0.0 ? 0.0 : 1.0; // left = treats, right = clap
        float t = abs(a) / 3.14159;      // 0 top → 1 bottom
        float fill = side < 0.5 ? tr : cl;
        vec3 on = side < 0.5 ? vec3(0.965, 0.725, 0.255) : vec3(1.0, 0.953, 0.875);
        vec3 c = t < fill ? on : mix(ink, seat, 0.35);
        if (abs(a) < 0.06 || abs(abs(a) - 3.14159) < 0.06) c = ink;
        c = mix(c, vec3(1.0, 0.3, 0.25), flash);
        gl_FragColor = vec4(c, 0.92);
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), mat);
  m.rotation.set(-Math.PI / 2, 0, Math.PI / 4); // treats on the screen's left, clap on its right
  m.renderOrder = 4;
  return m;
}

export function createView(stage, { onStamp = null } = {}) {
  const scene = stage.scene;
  const root = new THREE.Group();
  scene.add(root);
  const cats = createCats(scene);
  const fx = createFx(scene);
  const guides = createGuides(scene);
  const twists = createTwists(scene);
  const ring = cooldownRing();
  ring.visible = false;
  scene.add(ring);
  // a reach preview: a faint dotted circle the size of the treats reach, shown while learning
  const v = {
    g: null, room: null, carriers: [], persons: [], meIndex: -1, looks: [], totalMode: 'solo', lastSeq: 0, catSt: [],
    pushT: 0, stepT: 0, flashT: 0, floor: 'oak', local: true,
  };

  function clearScene() {
    if (v.room) { root.remove(v.room.group); v.room.dispose(); v.room = null; }
    for (const k of v.carriers) { root.remove(k.root); root.remove(k.sign); k.dispose(); }
    for (const p of v.persons) root.remove(p.root);
    v.carriers = [];
    v.persons = [];
    cats.reset();
    fx.clear();
    guides.clear();
    twists.clear();
  }

  /**
   * g: the simulation. opts: { looks: [look per carrier] | null, people: [{ avatar, seed, look }], me: index of my person,
   * total: 'solo' | 'versus' | 'together', local: events come from g itself (solo, host) }
   */
  v.show = (g, opts = {}) => {
    clearScene();
    v.g = g;
    v.floor = g.room.floor;
    v.dustColor = g.room.floor === 'grass' ? '#c9d9a8' : g.room.floor === 'carpet' ? '#e6d6c4' : '#efe2c8';
    v.room = buildRoom(g.room, g.world, { quality: stage.quality, onLand });
    root.add(v.room.group);
    stage.setRoom(g.room.w, g.room.d);
    stage.backdrop.set(v.room.backdrop);
    stage.setOutdoor(v.room.outdoor);
    v.looks = opts.looks ?? [];
    v.totalMode = opts.total ?? 'solo';
    v.local = opts.local !== false;
    g.carriers.forEach((k, i) => {
      const c = makeCarrier(k, v.looks[i] ?? null, opts.skins?.[i] ?? null);
      root.add(c.root);
      root.add(c.sign);
      v.carriers.push(c);
    });
    v.setPeople(opts.people ?? [], opts.me ?? -1);
    twists.show(g);
    v.lastSeq = g.evSeq;
    v.catSt = g.cats.map((c) => c.st);
    hasPrev = false;
  };

  v.setPeople = (list, me = -1) => {
    for (const p of v.persons) root.remove(p.root);
    v.persons = list.map((spec, i) => {
      const hat = spec.wear?.hat?.look ? { hat: spec.wear.hat.look, hatColor: spec.wear.hat.color } : {};
      const p = makePerson(spec.avatar ?? null, spec.seed ?? i + 1, hat);
      p.setSeat(spec.look ?? null);
      p.wear = spec.wear ?? null;
      p.stepD = 0;
      p.side = 1;
      root.add(p.root);
      return p;
    });
    v.meIndex = me;
    ring.visible = me >= 0;
    if (me >= 0) ring.material.uniforms.seat.value.set(list[me]?.look?.color ?? '#fff3df');
  };

  v.hide = () => {
    clearScene();
    v.g = null;
    ring.visible = false;
  };

  // a knocked thing hits the floor
  function onLand(p, speed, broke) {
    if (broke) {
      fx.shards(p.x, 0.12, p.z, p.color);
      sfx.crash();
      stage.shake(0.3);
    } else {
      fx.dust(p.x, p.z, 4);
      if (speed > 1.5) { sfx.knock(); stage.shake(0.1); }
    }
  }

  function catAt(id) {
    return v.g?.cats[id] ?? null;
  }

  /** One event from the simulation (or the host's snapshot). */
  v.event = (e, { quiet = false } = {}) => {
    const g = v.g;
    if (!g) return;
    const c = e.c != null && e.c >= 0 ? catAt(e.c) : null;
    const pitch = c ? PITCH[c.type] ?? 1 : 1;
    switch (e.k) {
      case 'in': {
        const k = g.carriers[e.ki];
        const view = v.carriers[e.ki];
        if (view) view.gulp();
        if (k) {
          fx.dust(k.matX, k.matZ, 8, v.dustColor);
          fx.gulp(k.matX, k.matZ, v.looks[e.ki]?.color ?? '#f6b941');
          onStamp?.('in', k.x, 1.2, k.z, { carrier: e.ki });
        }
        sfx.clank();
        setTimeout(() => sfx.mrrp(pitch), 90);
        stage.shake(0.18);
        if (c) fx.tufts(k?.doorX ?? c.x, 0.35, k?.doorZ ?? c.z, COAT_LOOK[c.coat]?.base ?? '#e8a060', 4);
        break;
      }
      case 'combo': {
        const k = g.carriers[e.ki];
        if (k) {
          onStamp?.('combo', k.x, 1.5, k.z, { n: e.c, carrier: e.ki });
          fx.confetti(k.matX, k.matZ, ['#f6b941', '#e5493a', '#fff3df', '#3f7fcb'], 0.6, 10 + e.c * 6);
          fx.wave(k.matX, k.matZ, 1.2 + e.c * 0.4, 0.5, '#f6b941');
        }
        break;
      }
      case 'trick': {
        const k = g.carriers.find((kk) => Math.hypot(kk.matX - e.x, kk.matZ - e.z) < 0.5) ?? g.carriers[0];
        if (k) onStamp?.('trick', k.x, 2.1, k.z, { trick: TRICKS[e.ki] ?? '' });
        break;
      }
      case 'knock': {
        fx.stars(e.x, e.z, 0.45, 5);
        if (c) fx.tufts(e.x, 0.4, e.z, COAT_LOOK[c.coat]?.base ?? '#e8a060', 5);
        fx.wave(e.x, e.z, 0.7, 0.25, '#fff3df');
        sfx.knock();
        setTimeout(() => sfx.mrt(pitch * 1.15), 40);
        stage.shake(0.12);
        onStamp?.('knock', e.x, 0.9, e.z, {});
        break;
      }
      case 'bounce': {
        fx.dust(e.x, e.z, 3, v.dustColor);
        sfx.hop();
        break;
      }
      case 'laser': {
        const who = e.p ?? e.c;
        if (e.ki === 1) { sfx.chime(); fx.sparkle?.(e.x, 0.3, e.z); onStamp?.('laser', e.x, 1, e.z, { who }); }
        else if (e.ki === 0) sfx.tap();
        else sfx.dull();
        break;
      }
      case 'ding': {
        onStamp?.('ding', e.x, 1.6, e.z, {});
        sfx.doorKnock();
        break;
      }
      case 'bell': {
        fx.wave(e.x, e.z, 6, 0.9, '#ff6a55');
        stage.shake(0.2);
        onStamp?.('bell', e.x, 1.6, e.z, {});
        sfx.doorbell();
        setTimeout(() => sfx.hiss(), 700);
        break;
      }
      case 'ride': { sfx.mrrp(pitch * 0.9); if (c) onStamp?.('ride', c.x, 1.0, c.z, {}); break; }
      case 'boxsit': { sfx.mrrp(pitch * 1.1); break; }
      case 'nap': { sfx.purr(); break; }
      case 'vbump': { sfx.tin(); break; }
      case 'bump': {
        v.carriers[e.ki]?.bump();
        sfx.knock();
        break;
      }
      case 'crash': {
        const from = c ? { x: c.x, z: c.z } : null;
        let spot = null;
        if (Number.isInteger(e.s)) spot = v.room?.knock(e.s, from);
        if (!spot) {
          const i = g.world.solids.findIndex((s) => s.perch && e.x >= s.x0 - 1 && e.x <= s.x1 + 1 && e.z >= s.z0 - 1 && e.z <= s.z1 + 1);
          if (i >= 0) spot = v.room?.knock(i, from);
        }
        if (!spot) {
          fx.shards(e.x ?? 0, 0.15, e.z ?? 0, '#fff3df');
          sfx.crash();
          stage.shake(0.3);
        }
        break;
      }
      case 'hide': case 'scared': {
        sfx.squeak();
        if (c) fx.tufts(c.x, 0.45, c.z, COAT_LOOK[c.coat]?.base ?? '#e8a060', e.k === 'scared' ? 7 : 3);
        break;
      }
      case 'zoom': {
        sfx.whoosh();
        if (c) fx.dust(c.x, c.z, 6, v.dustColor);
        break;
      }
      case 'slip': sfx.skitter(); break;
      case 'hop': sfx.hop(); break;
      case 'surprise': {
        if (c) onStamp?.('surprise', c.x, 1.0, c.z, {});
        sfx.meow(pitch * 1.1, 0.55, 0.22);
        break;
      }
      case 'arrive': sfx.meow(pitch, 0.4, 0.14); break;
      case 'treats': {
        fx.treats(e.x, e.z);
        if (!quiet) sfx.rattle();
        break;
      }
      case 'clap': {
        fx.clap(e.x, e.z, v.persons[e.p]?.wear?.clap ?? null);
        if (!quiet) sfx.clapSound();
        stage.shake(0.08);
        const near = g.cats.some((o) => o.st !== S.boxed && Math.hypot(o.x - e.x, o.z - e.z) < CLAP.radius);
        if (near) setTimeout(() => sfx.hiss(), 120);
        break;
      }
      default: break;
    }
  };

  /** Events the local simulation made since last time (solo, host, attract). */
  v.drain = (filter = null) => {
    const g = v.g;
    if (!g) return;
    for (const e of g.events) {
      if (e.seq <= v.lastSeq) continue;
      if (!filter || filter(e)) v.event(e);
    }
    v.lastSeq = g.evSeq;
  };

  /** A cooldown press that did nothing: the ring flashes. */
  v.dud = () => { v.flashT = 0.25; sfx.dull(); };

  /**
   * Per frame. opts: { offsets (prediction), me: my person (sim), away: Set of person indexes, reducedMotion, audio: true }
   */
  v.update = (dt, t, opts = {}) => {
    const g = v.g;
    if (!g) return;
    const me = opts.me ?? null;
    const back = 1 - Math.max(0, Math.min(1, opts.alpha ?? 1));
    const interp = hasPrev && back > 0 && prevCats.length === g.cats.length;
    g.cats.forEach((c, i) => {
      const o = (drawOff[i] ??= { x: 0, z: 0 });
      const pred = opts.offsets?.[i];
      o.x = pred ? pred.x : 0;
      o.z = pred ? pred.z : 0;
      if (interp) {
        const q = prevCats[i];
        const dx = q.x - c.x;
        const dz = q.z - c.z;
        if (dx * dx + dz * dz < 1) { o.x += dx * back; o.z += dz * back; }
      }
    });
    cats.update(g.cats, dt, t, { offset: (i) => drawOff[i], people: g.people, me, reducedMotion: opts.reducedMotion });
    const total = v.totalMode === 'versus' ? 0 : g.total;
    g.carriers.forEach((k, i) => v.carriers[i]?.update(k, dt, t, total, { reducedMotion: opts.reducedMotion }));
    g.people.forEach((p, i) => {
      const view = v.persons[i];
      if (!view) return;
      const q = (proxies[i] ??= {});
      q.x = p.x; q.z = p.z; q.h = p.h; q.sp = p.sp; q.treatsSeq = p.treatsSeq; q.clapSeq = p.clapSeq; q.active = p.active;
      const pq = prevPeople[i];
      if (hasPrev && back > 0 && pq && (pq.x - p.x) ** 2 + (pq.z - p.z) ** 2 < 1) { q.x += (pq.x - p.x) * back; q.z += (pq.z - p.z) * back; }
      view.update(q, dt, t, { away: opts.away?.has(i), reducedMotion: opts.reducedMotion });
      // a trail of prints where the feet come down
      const trail = view.wear?.trail;
      if (trail?.fx && q.active !== false) {
        const lx = view.lastX ?? q.x;
        const lz = view.lastZ ?? q.z;
        const d = Math.hypot(q.x - lx, q.z - lz);
        if (d < 1) view.stepD += d;
        if (view.stepD > (trail.fx === 'dot' ? 0.32 : 0.55)) { view.stepD = 0; view.side = -view.side; fx.print(q.x, q.z, q.h ?? 0, trail, view.side); }
      }
      view.lastX = q.x;
      view.lastZ = q.z;
    });
    v.drawn = proxies;
    // cats and people kick the toys on the floor along
    movers.length = 0;
    for (const c of g.cats) if (c.st !== S.boxed && c.st !== S.enter && c.st !== S.hidden && !(c.y > 0.05)) movers.push({ x: c.x, z: c.z, r: 0.24 * (c.size || 1), sp: c.sp ?? 0 });
    for (const q of proxies) if (q && q.active !== false) movers.push({ x: q.x, z: q.z, r: 0.28, sp: q.sp ?? 0 });
    v.room?.update(t, dt, movers, stage.camera);
    twists.update(dt, t, proxies, opts.reducedMotion);
    guides.update(g, { me: opts.guides === false ? null : me, clapReady: !!me && me.clapCd <= 0, t, reduced: opts.reducedMotion });
    fx.update(dt, t);
    fx.setScale((Math.min(stage.w, stage.h) * stage.dpr) / stage.span, stage.dist ?? 14);
    // dust behind anything running fast
    if (!opts.reducedMotion) {
      kickT -= dt;
      if (kickT <= 0) {
        kickT = 0.09;
        for (const c of g.cats) {
          if (c.st === S.boxed || c.surprise || (c.y ?? 0) > 0.05 || (c.sp ?? 0) < 3) continue;
          fx.kick(c.x, c.z, Math.cos(c.h), Math.sin(c.h), v.dustColor);
        }
        for (const p of v.drawn ?? []) if ((p.sp ?? 0) > 3.2 && p.active !== false) fx.kick(p.x, p.z, Math.cos(p.h), Math.sin(p.h), v.dustColor);
      }
      // a rare coat glints, so you spot it across the room and want it in the box
      glintT -= dt;
      if (glintT <= 0) {
        glintT = 0.16;
        for (const c of g.cats) {
          const r = COAT_INFO[c.coat]?.rarity ?? 0;
          if (r < 2 || c.st === S.boxed || c.st === S.enter || Math.random() > (r === 3 ? 0.9 : 0.4)) continue;
          const sz = c.size ?? 1;
          fx.emit(c.x + (Math.random() - 0.5) * 0.5 * sz, (c.y ?? 0) + (0.25 + Math.random() * 0.4) * sz, c.z + (Math.random() - 0.5) * 0.5 * sz, 1, {
            color: r === 3 ? ['#ffe08a', '#fff3df'] : ['#e9d4ff', '#fff3df'], shape: SHAPE.spark, glow: true, speed: 0.15, up: 0.5, life: 0.55, size: 0.16, gravity: 0, drag: 2,
          });
        }
      }
    }
    // my ring
    if (me && ring.visible) {
      const mq = proxies[v.meIndex] ?? me;
      ring.position.set(mq.x, 0.025, mq.z);
      ring.material.uniforms.tr.value = 1 - me.treatsCd / TREATS.cooldown;
      ring.material.uniforms.cl.value = 1 - me.clapCd / CLAP.cooldown;
      v.flashT = Math.max(0, v.flashT - dt);
      ring.material.uniforms.flash.value = opts.reducedMotion ? 0 : v.flashT * 3;
      ring.visible = me.active !== false;
      // footsteps
      if (me.sp > 1) {
        v.stepT -= dt * me.sp;
        if (v.stepT <= 0) { v.stepT = 1.4; sfx.step(v.floor); }
      }
    }
    // grumbles when a cat near me gets pushed
    v.pushT = Math.max(0, v.pushT - dt);
    g.cats.forEach((c, i) => {
      const was = v.catSt[i];
      if (c.st !== was) {
        if (c.st === S.flee && (was === S.idle || was === S.walk || was === S.alert) && v.pushT <= 0 && me && Math.hypot(c.x - me.x, c.z - me.z) < 4) {
          sfx.mrt(PITCH[c.type] ?? 1);
          v.pushT = 0.6;
        }
        if (c.st === S.lured && was !== S.lured && v.pushT <= 0) { sfx.purr(); v.pushT = 0.5; }
        v.catSt[i] = c.st;
      }
    });
  };

  // positions at the last step, to draw between steps (the simulation runs at 30 Hz, the screen faster)
  const prevCats = [];
  const prevPeople = [];
  const drawOff = [];
  const proxies = [];
  let hasPrev = false;
  let kickT = 0;
  const movers = [];
  let glintT = 0;
  v.capture = () => {
    const g = v.g;
    if (!g) return;
    g.cats.forEach((c, i) => { const q = (prevCats[i] ??= { x: 0, z: 0 }); q.x = c.x; q.z = c.z; });
    g.people.forEach((p, i) => { const q = (prevPeople[i] ??= { x: 0, z: 0 }); q.x = p.x; q.z = p.z; });
    prevCats.length = g.cats.length;
    prevPeople.length = g.people.length;
    hasPrev = true;
  };
  /** Positions jumped (a snapshot, a restart): draw where things are. */
  v.invalidate = () => { hasPrev = false; };

  v.refreshSigns = () => { for (const c of v.carriers) c.redraw(); };

  v.hints = fx;
  v.screen = (x, y, z, out) => stage.toScreen(x, y, z, out);
  return v;
}
