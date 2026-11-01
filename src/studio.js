// The cat studio: every personality and coat lined up under soft light, posed in a chosen state. Used to look at the
// cats while building them (?poster=studio&st=walk&sp=1.5&coat=calico&cam=side).

import * as THREE from 'three';
import { createCats } from './render/cats.js';
import { S, TYPES, TYPE_LIST } from './sim/tuning.js';
import { COAT_IDS } from './sim/coats.js';

export function runStudio(params) {
  const canvas = document.getElementById('world');
  const W = innerWidth, H = innerHeight;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.setSize(W, H);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d9c6a8');
  scene.add(new THREE.HemisphereLight('#fff4e0', '#8a6a50', 1.2));
  const sun = new THREE.DirectionalLight('#ffe0b0', 2.8);
  sun.position.set(-4, 7, -3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#bcd3ff', 0.8);
  rim.position.set(3, 3, 6);
  scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: '#c99a68', roughness: 0.8 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const stName = params.get('st') ?? 'idle';
  const st = S[stName] ?? 0;
  const sp = Number(params.get('sp') ?? 0);
  const coatP = params.get('coat');
  const typeP = params.get('type');
  const list = typeP ? [typeP] : TYPE_LIST;
  const coats = coatP === 'all' ? COAT_IDS : null;
  const cats = [];
  const n = coats ? coats.length : list.length;
  const cols = coats ? 7 : n;
  for (let i = 0; i < n; i++) {
    const type = coats ? (typeP ?? 'moggy') : list[i];
    const col = i % cols, row = Math.floor(i / cols);
    cats.push({
      id: i, type, coat: coats ? coats[i] : (coatP ?? ['ginger', 'grey', 'tuxedo', 'calico', 'tortie', 'siamese', 'black'][i % 7]),
      x: (col - (cols - 1) / 2) * 1.25, z: row * 1.3 - (coats ? 1.3 : 0), y: 0, h: Number(params.get('h') ?? Math.PI / 2 - 0.55),
      sp, st, tt: 1, size: TYPES[type]?.size ?? 1, look: -1, surprise: false,
    });
  }
  const view = createCats(scene, { quality: 'high' });
  const cam = params.get('cam') ?? 'front';
  const camera = new THREE.PerspectiveCamera(cam === 'close' ? 20 : 28, W / H, 0.1, 100);
  const span = ((cols - 1) * 1.25 + 1.5) * Number(params.get('zoom') ?? 1);
  if (cam === 'side') { camera.position.set(0, 1.2, span * 1.6); camera.lookAt(0, 0.3, 0); for (const c of cats) c.h = 0; }
  else if (cam === 'top') { camera.position.set(0, span * 1.5, span * 0.9); camera.lookAt(0, 0, 0); }
  else if (cam === 'game') {
    // the game's camera: 50° down, from the south-east, about 13 units across
    const pitch = (50 * Math.PI) / 180, yaw = Math.PI / 4, dist = 13 / (2 * Math.tan((30 * Math.PI) / 360) * (W / H)) * Number(params.get('zoom') ?? 1);
    camera.fov = 30;
    camera.updateProjectionMatrix();
    camera.position.set(Math.cos(pitch) * Math.sin(yaw) * dist, Math.sin(pitch) * dist, Math.cos(pitch) * Math.cos(yaw) * dist);
    camera.lookAt(0, 0, 0);
  }
  else if (cam === 'close') { camera.position.set(1.4, 0.9, 2.2); camera.lookAt(0, 0.35, 0); }
  else { camera.position.set(0, span * 0.55, span * 1.25); camera.lookAt(0, 0.3, coats ? 0 : 0); }
  const people = [{ x: 0, z: 6 }];
  for (const c of cats) if (params.has('look')) c.look = 0;
  let last = performance.now();
  const t0 = last;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - t0) / 1000;
    if (params.has('spin')) for (const c of cats) c.h += dt * 0.6;
    view.update(cats, dt, t, { people, me: null, reducedMotion: false });
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  setTimeout(() => { document.body.dataset.ready = '1'; }, 600);
}

/** Every model in the furniture file in a grid, natural size, a red marker on each one's +z side (?poster=kit). */
export async function runKit(params) {
  const { loadAssets, kitModel } = await import('./render/assets.js');
  const A = await loadAssets();
  const canvas = document.getElementById('world');
  const W = innerWidth, H = innerHeight;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(W, H);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d9c6a8');
  scene.add(new THREE.HemisphereLight('#ffffff', '#806050', 2.2));
  const dl = new THREE.DirectionalLight('#ffffff', 1.5);
  dl.position.set(3, 6, 5);
  scene.add(dl);
  const names = [...A.kit.keys()];
  const page = Number(params.get('page') ?? 0);
  const per = 12;
  const list = names.slice(page * per, page * per + per);
  const cols = 4;
  list.forEach((name, i) => {
    const m = kitModel(name);
    const S = m.userData.size;
    const s = 1.6 / Math.max(S.x, S.y, S.z);
    m.scale.setScalar(s);
    const col = i % cols, row = Math.floor(i / cols);
    m.position.set((col - (cols - 1) / 2) * 3.2, 0, row * 3.4 - 3.4);
    scene.add(m);
    const mk = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 8), new THREE.MeshBasicMaterial({ color: '#ff0000' }));
    mk.rotation.x = Math.PI / 2;
    mk.position.set(m.position.x, 0.05, m.position.z + 1.0);
    scene.add(mk);
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 48;
    const g = cv.getContext('2d');
    g.font = 'bold 30px sans-serif';
    g.fillStyle = '#000';
    g.fillText(`${name} ${S.x.toFixed(2)}x${S.y.toFixed(2)}x${S.z.toFixed(2)}`.slice(0, 22), 4, 34);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false }));
    sp.scale.set(2.2, 0.42, 1);
    sp.position.set(m.position.x, 0, m.position.z + 1.45);
    scene.add(sp);
  });
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 200);
  camera.position.set(0, 9, 17);
  camera.lookAt(0, 0, 0.6);
  renderer.render(scene, camera);
  document.body.dataset.ready = '1';
}
