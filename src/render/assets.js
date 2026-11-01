// The game's files: the furniture kit (CC0 Quaternius and Kenney models in one file), the people (CC0 Quaternius
// animated characters) and the surface textures (CC0 ambientCG). Loaded once before the first room.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

const BASE = './assets/';
export const PEOPLE_FILES = ['a', 'b', 'c', 'd'];
const SURFACES = ['wood', 'planks', 'carpet', 'tile', 'checker', 'bigtile', 'grass', 'brick', 'plaster', 'fabric'];

const A = {
  ready: false,
  kit: new Map(), // name → { object, size: Vector3, min: Vector3 }
  people: new Map(), // key → { scene, animations }
  tex: new Map(),
};

let loading = null;
const texLoader = new THREE.TextureLoader();

/** Loads everything once; resolves when the rooms and people can be built. */
export function loadAssets() {
  if (loading) return loading;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const get = (url) => new Promise((res, rej) => loader.load(url, res, undefined, rej));
  loading = Promise.all([
    get(BASE + 'furniture.glb').then((gltf) => {
      for (const node of gltf.scene.children) {
        node.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(node);
        const size = box.getSize(new THREE.Vector3());
        A.kit.set(node.name, { object: node, size, min: box.min.clone(), center: box.getCenter(new THREE.Vector3()) });
      }
    }),
    ...PEOPLE_FILES.map((k) => get(`${BASE}person-${k}.glb`).then((gltf) => {
      A.people.set(k, { scene: gltf.scene, animations: gltf.animations });
    })),
    // surfaces load up front: a room drawn before its floor arrives would show black
    ...SURFACES.flatMap((n) => [false, true].map((normal) => new Promise((res) => {
      const key = normal ? `${n}-n` : n;
      texLoader.load(`${BASE}tex/${key}.jpg`, (t) => { prepTex(t, normal); A.tex.set(key, t); res(); }, undefined, () => res());
    }))),
  ]).then(() => { A.ready = true; return A; });
  return loading;
}

export function assetsReady() { return A.ready; }

/** A copy of a kit model, its base on the floor and centred on its footprint, with its natural size. */
export function kitModel(name) {
  const k = A.kit.get(name);
  if (!k) return null;
  const inner = k.object.clone(true);
  inner.position.sub(new THREE.Vector3(k.center.x, k.min.y, k.center.z));
  const g = new THREE.Group();
  g.add(inner);
  g.userData.size = k.size.clone();
  return g;
}

export function kitSize(name) { return A.kit.get(name)?.size ?? null; }

const surfCache = new Map();
const down = new THREE.Vector3(0, -1, 0);
/** Height of a model's top surface at (fx, fz) (fractions of its footprint from the centre), as a fraction of its height. */
export function kitSurface(name, fx = 0, fz = 0) {
  const key = `${name}:${fx}:${fz}`;
  if (surfCache.has(key)) return surfCache.get(key);
  const m = kitModel(name);
  if (!m) return 1;
  m.updateMatrixWorld(true);
  const S = m.userData.size;
  const rc = new THREE.Raycaster(new THREE.Vector3(fx * S.x, S.y + 1, fz * S.z), down);
  const hit = rc.intersectObject(m, true)[0];
  const f = hit ? Math.max(0.05, Math.min(1, hit.point.y / S.y)) : 1;
  surfCache.set(key, f);
  return f;
}

/** A person: a skinned clone and its clips. */
export function personModel(key) {
  const p = A.people.get(key) ?? A.people.get('a');
  if (!p) return null;
  return { scene: SkeletonUtils.clone(p.scene), animations: p.animations };
}

function prepTex(t, normal) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (!normal) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** A tiling surface map: `name` (detail, colour data) or `name-n` (normal map). */
export function surface(name, normal = false) {
  const key = normal ? `${name}-n` : name;
  if (A.tex.has(key)) return A.tex.get(key);
  const t = prepTex(texLoader.load(`${BASE}tex/${key}.jpg`), normal);
  A.tex.set(key, t);
  return t;
}
