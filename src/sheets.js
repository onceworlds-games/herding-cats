// Picture sheets for the screens, drawn with the game's own models (?poster=sheet&set=cats|wear), saved by the tools into
// public/ui as JPEGs: a portrait of every personality and coat for the Cat-alog, every hat and carrier shell for the
// wardrobe. One cell each, on a backdrop that says how rare it is.

import * as THREE from 'three';
import { createCats } from './render/cats.js';
import { makeHat } from './render/people.js';
import { makeCarrier } from './render/carriers.js';
import { S, TYPES } from './sim/tuning.js';
import { COAT_INFO } from './sim/coats.js';
import { byKind } from './meta/herder.js';
import { CELL, SHEET_COLS, SHEETS } from './ui/sheetlist.js';

const RARITY_BG = ['#f1e2c6', '#cfe3c4', '#d9cdee', '#f6d77a'];
const TYPE_COAT = { moggy: 'ginger', loaf: 'grey', zoomer: 'black', scaredy: 'siamese', glutton: 'tortie', kitten: 'calico', boss: 'grey' };

export function runSheet(params) {
  const name = (params.get('poster') ?? '').replace(/^sheet-?/, '') || params.get('set');
  const set = SHEETS[name] ? name : 'cats';
  const list = SHEETS[set];
  const cols = SHEET_COLS;
  const rows = Math.ceil(list.length / cols);
  const W = cols * CELL;
  const H = rows * CELL;
  document.documentElement.style.cssText = `width:${W}px;height:${H}px;background:#2b1d1c`;
  document.body.style.cssText = `width:${W}px;height:${H}px;margin:0;background:#2b1d1c`;
  const canvas = document.getElementById('world');
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setScissorTest(true);
  renderer.autoClear = false;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff4e0', '#8a6a50', 1.25));
  const sun = new THREE.DirectionalLight('#ffe2b8', 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight('#cfe0ff', 1.1);
  scene.add(rim, rim.target);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.ShadowMaterial({ opacity: 0.28 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const camera = new THREE.PerspectiveCamera(24, 1, 0.05, 50);

  // one subject at a time, at the origin
  const cats = createCats(scene, { quality: 'high' });
  const holder = new THREE.Group();
  scene.add(holder);
  const people = [{ x: 0, z: 4 }];

  function subject(e) {
    holder.clear();
    let catList = [];
    let look = new THREE.Vector3(0, 0.3, 0);
    let dist = 2.4;
    let bg = '#f1e2c6';
    if (e.kind === 'type' || e.kind === 'coat') {
      const type = e.kind === 'type' ? e.id : 'moggy';
      const coat = e.kind === 'coat' ? e.id : TYPE_COAT[type];
      bg = e.kind === 'type' ? '#f3d2b8' : RARITY_BG[COAT_INFO[coat].rarity];
      const size = TYPES[type]?.size ?? 1;
      catList = [{ id: 0, type, coat, x: 0, z: 0, y: 0, h: Number(params.get('h') ?? 1.3), sp: 0, st: S.content, tt: 9, size, look: 0, surprise: false }];
      look = new THREE.Vector3(-0.12 * size, Number(params.get('ly') ?? 0.26) * size, 0);
      dist = Number(params.get('dist') ?? 2.05) * size;
    } else if (e.kind === 'hat') {
      const it = byKind('hat').find((x) => x.id === e.id);
      const hat = makeHat(it.look, it.color);
      hat.scale.setScalar(0.9);
      hat.position.y = 0.1;
      hat.rotation.y = -0.5;
      hat.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      holder.add(hat);
      look = new THREE.Vector3(0, 0.36, 0);
      dist = 3.4;
      bg = '#e9dcc8';
    } else if (e.kind === 'carrier') {
      const it = byKind('carrier').find((x) => x.id === e.id);
      const k = { x: 0, z: 0, nx: 1, nz: 0, matX: 0.9, matZ: 0, count: 0, closed: false, shutT: 0 };
      const c = makeCarrier(k, null, it);
      c.root.rotation.y = -1.05;
      holder.add(c.root);
      c.update(k, 0.016, 0, 0, { reducedMotion: true });
      look = new THREE.Vector3(0.08, 0.34, 0.2);
      dist = 3.5;
      bg = it.metal ? '#f6d77a' : '#e9dcc8';
    }
    return { catList, look, dist, bg };
  }

  let t = 0;
  list.forEach((e, i) => {
    const sub = subject(e);
    // let the pose settle
    for (let f = 0; f < 70; f++) { t += 1 / 60; cats.update(sub.catList, 1 / 60, t, { people, me: null, reducedMotion: false }); }
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * CELL;
    const y = H - (row + 1) * CELL;
    renderer.setViewport(x, y, CELL, CELL);
    renderer.setScissor(x, y, CELL, CELL);
    renderer.setClearColor(sub.bg, 1);
    renderer.clear();
    const yaw = Number(params.get('yaw') ?? -0.2);
    const lift = Number(params.get('lift') ?? 0.6);
    camera.position.set(sub.look.x + Math.sin(yaw) * sub.dist, sub.look.y + sub.dist * lift, sub.look.z + Math.cos(yaw) * sub.dist);
    camera.lookAt(sub.look);
    camera.updateProjectionMatrix();
    sun.position.set(-1.5, 3.5, 2.2);
    rim.position.set(2, 1.5, -2);
    renderer.render(scene, camera);
  });
  cats.update([], 1 / 60, t, { people, me: null, reducedMotion: false });
  requestAnimationFrame(() => requestAnimationFrame(() => { document.body.dataset.ready = '1'; }));
}
