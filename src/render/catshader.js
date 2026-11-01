// Fur: one material per cat that paints its coat from the body's own coordinates (tabby stripes and the forehead M,
// bibs and socks, calico patches, tortie mottle, Siamese points, spots, glints), and draws the eyes (iris, a pupil that
// slits or goes round, lids that blink, a catchlight) and the mouth.

import * as THREE from 'three';
import { COAT_INFO } from '../sim/coats.js';

const hex = (h) => new THREE.Color(h);

// How each coat looks. base/second/third: fur; white: bib, socks and blaze; point: Siamese points and panda patches.
export const COAT_LOOK = {
  ginger: { base: '#e3893a', second: '#b5561c', white: '#f7e2c2', tabby: 0.9, whiteAmt: 0.14, nose: '#e58d84', iris: '#d2a429' },
  grey: { base: '#a19f9a', second: '#4f4c4b', white: '#ebe6dc', tabby: 0.95, whiteAmt: 0.12, nose: '#c98680', iris: '#a5b843' },
  tuxedo: { base: '#252122', second: '#1a1718', white: '#f7f2ea', whiteAmt: 0.4, nose: '#d88e8a', iris: '#9fc23a' },
  calico: { base: '#f4ede2', second: '#dc7f2c', third: '#2c2526', patch: 1, white: '#f8f3ea', whiteAmt: 0.5, nose: '#f0a199', iris: '#d7a42c' },
  black: { base: '#2a2627', second: '#1a1718', nose: '#2c2425', iris: '#e8b92f', sheen: '#9a9ab8' },
  white: { base: '#f6f2eb', second: '#e9e2d6', nose: '#f2a7a0', iris: '#6aa6dc', ear: '#f3b0aa' },
  tortie: { base: '#2b201c', second: '#b6612a', third: '#7a4321', patch: 0.95, mottle: 1, nose: '#3d2b27', iris: '#d79a2b' },
  siamese: { base: '#efe3cd', second: '#e2d2b7', point: '#4a3731', points: 1, nose: '#4a3731', iris: '#4b8fe0', ear: '#6d5249' },
  silver: { base: '#cdd0d3', second: '#34373c', white: '#f6f6f6', tabby: 1, whiteAmt: 0.1, nose: '#d18e8e', iris: '#76b65a', sheen: '#ffffff' },
  cream: { base: '#f1d4a6', second: '#d5a568', white: '#fcf3e3', tabby: 0.65, whiteAmt: 0.32, nose: '#ee9f96', iris: '#c88f2c' },
  bicolor: { base: '#e3893a', second: '#c0662a', white: '#f8efe2', tabby: 0.5, whiteAmt: 0.62, nose: '#f0a199', iris: '#d2a429' },
  blue: { base: '#7f8b98', second: '#6c7784', nose: '#5d6470', iris: '#3fbd6a', sheen: '#dfe9ff' },
  cow: { base: '#f5f1e9', second: '#232021', third: '#232021', patch: 1, patchHi: 0.58, white: '#f7f3ec', whiteAmt: 0.35, nose: '#e9a19b', iris: '#c9a63b' },
  smoke: { base: '#3d3c41', second: '#76757a', mottle: 0.4, tabby: 0.0, smoke: 1, nose: '#4a4448', iris: '#e3a43a', sheen: '#c9c9d6' },
  panda: { base: '#f6f3ed', point: '#1e1c1d', panda: 1, nose: '#2a2526', iris: '#8bc34a', ear: '#2a2526' },
  bengal: { base: '#d9a453', second: '#3f2717', white: '#f4e5c8', spots: 1, whiteAmt: 0.22, nose: '#c76e5f', iris: '#8bb54a', sheen: '#ffe2a0' },
  lilac: { base: '#f3eee9', second: '#e6ddd6', point: '#a497a5', points: 1, nose: '#c39fab', iris: '#7cb3f0', ear: '#b9a8b8' },
  midnight: { base: '#15161f', second: '#232a46', sparkle: 0.8, glint: '#9fc8ff', nose: '#2b2836', iris: '#59c6ff', sheen: '#5d6fb8' },
  lucky: { base: '#f2c247', second: '#d38e22', white: '#fff4cf', tabby: 0.35, whiteAmt: 0.15, sparkle: 1, glint: '#fff1b0', nose: '#f0a07a', iris: '#2fb37a', sheen: '#fff0b0' },
};

const VERT_HEAD = /* glsl */`
attribute vec3 aRest;
attribute vec3 aAux;
attribute float aPart;
varying vec3 vRest;
varying vec3 vAux;
varying float vPart;
uniform float uBreath;
`;

const FRAG_HEAD = /* glsl */`
varying vec3 vRest;
varying vec3 vAux;
varying float vPart;
uniform vec3 uBase, uSecond, uThird, uWhite, uPoint, uNose, uIris, uEar, uLid, uGlint;
uniform vec4 uPat;   // tabby, white amount, patches, mottle
uniform vec4 uPat2;  // points, spots, sparkle, seed
uniform vec4 uPat3;  // panda, smoke, patch threshold, -
uniform vec4 uFace;  // pupil (0 slit .. 1 round), blink (0 open .. 1 shut), mouth (0 .. 1 open), sleepy
uniform vec4 uFx;    // flash (white hit), glow, time, wet
uniform vec2 uLook;  // pupils' offset

float h31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { return (0.5 * vnoise(p) + 0.25 * vnoise(p * 2.03) + 0.125 * vnoise(p * 4.01)) / 0.875; }

vec3 catCoat(out float rough, out vec3 glow) {
  rough = 0.86;
  glow = vec3(0.0);
  int part = int(vPart + 0.5);
  vec3 p = vRest + vec3(uPat2.w * 7.13, uPat2.w * 3.31, uPat2.w * 5.77);
  vec3 a = vAux;
  vec3 col = uBase;
  if (part == 7) {
    // the eye
    vec2 e = a.xy;
    float front = a.z;
    float r = length(e);
    vec2 ep = e - uLook;
    float fib = vnoise(vec3(atan(ep.y, ep.x) * 6.0, length(ep) * 8.0, uPat2.w));
    vec3 iris = uIris * (0.55 + 0.6 * smoothstep(0.95, 0.15, length(ep))) * (0.85 + 0.3 * fib);
    float pw = mix(0.11, 0.6, uFace.x);
    float pupil = 1.0 - smoothstep(0.85, 1.0, length(vec2(ep.x / pw, ep.y / 0.8)));
    vec3 ec = mix(iris, vec3(0.015, 0.012, 0.01), pupil);
    ec = mix(ec, vec3(0.08, 0.05, 0.04), smoothstep(0.82, 0.97, r));
    float lidTop = mix(1.15, -0.08, max(uFace.y, uFace.w * 0.5));
    float lidBot = mix(-1.15, -0.12, uFace.y * 0.92);
    float lid = max(smoothstep(lidTop - 0.06, lidTop, e.y), smoothstep(lidBot + 0.06, lidBot, e.y));
    lid = max(lid, step(front, 0.05));
    float liner = smoothstep(0.12, 0.0, abs(e.y - lidTop)) * (1.0 - lid);
    ec = mix(ec, vec3(0.05, 0.035, 0.03), liner);
    col = mix(ec, uLid, lid);
    rough = mix(0.06, 0.85, lid);
    float catch1 = smoothstep(0.2, 0.1, length(e - vec2(-0.3, 0.36)));
    float catch2 = smoothstep(0.09, 0.04, length(e - vec2(0.25, -0.3)));
    glow = vec3(1.0, 0.98, 0.94) * (catch1 * 0.9 + catch2 * 0.5) * (1.0 - lid) * step(0.05, front);
    return col;
  }
  if (part == 8) { rough = 0.45; return uNose; }

  // tabby: stripes that wrap the body, rings on the legs and tail, the forehead M and cheek lines
  float stripe = 0.0;
  float warp = (vnoise(p * 9.0) - 0.5) * 0.9;
  if (part == 0) {
    float dorsal = a.y;
    float f = a.x * 19.0 + warp * 1.3 + abs(a.z) * 1.1 * (1.0 - a.x);
    float broken = smoothstep(0.3, 0.55, vnoise(p * vec3(6.0, 22.0, 22.0)));
    stripe = smoothstep(0.58, 0.78, 0.5 + 0.5 * sin(f * 6.2832)) * smoothstep(-0.55, 0.25, dorsal) * (0.45 + 0.55 * broken);
    stripe = max(stripe, smoothstep(0.88, 0.97, dorsal) * step(a.x, 0.72));
    stripe *= 0.6 + 0.4 * smoothstep(0.85, 0.6, a.x);
  } else if (part == 4) {
    stripe = smoothstep(0.5, 0.75, 0.5 + 0.5 * sin((a.x * 5.0 + warp * 0.3) * 6.2832)) * smoothstep(0.1, 0.3, a.x) * (1.0 - smoothstep(0.75, 0.95, a.x));
  } else if (part == 6) {
    stripe = smoothstep(0.42, 0.68, 0.5 + 0.5 * sin(a.x * 7.0 * 6.2832 + warp));
    stripe = max(stripe, smoothstep(0.86, 0.92, a.x));
  } else if (part == 1) {
    vec3 h = a;
    float top = smoothstep(0.3, 0.62, h.y) * smoothstep(-0.25, 0.25, h.x);
    float m = smoothstep(0.62, 0.82, 0.5 + 0.5 * sin(h.z * 10.0 + abs(h.z) * 3.0 + 1.57)) * top;
    float cheek = smoothstep(0.5, 0.72, abs(h.z)) * smoothstep(0.25, -0.05, h.y) * smoothstep(-0.2, 0.2, h.x)
      * smoothstep(0.55, 0.78, 0.5 + 0.5 * sin(h.y * 13.0 - h.x * 4.0));
    float back = smoothstep(-0.1, -0.55, h.x) * smoothstep(0.55, 0.78, 0.5 + 0.5 * sin(h.x * 9.0 + warp)) * smoothstep(-0.2, 0.3, h.y);
    stripe = max(max(m, cheek * 0.9), back);
  } else if (part == 2) {
    stripe = 0.35 + 0.35 * smoothstep(0.5, 0.9, a.x);
  }
  col = mix(col, uSecond, clamp(stripe, 0.0, 1.0) * uPat.x);

  // patches (calico, cow) and mottle (tortie)
  if (uPat.z > 0.0) {
    float freq = mix(6.0, 15.0, uPat.w);
    float n = fbm(p * freq);
    float hi = uPat3.z > 0.0 ? uPat3.z : 0.56;
    float pa = smoothstep(hi - 0.02, hi + 0.02, n);
    float pb = smoothstep(0.38, 0.34, n);
    if (uPat.w > 0.5) { pa = smoothstep(0.42, 0.62, n) * 0.9; pb = smoothstep(0.36, 0.26, n) * 0.6; }
    col = mix(col, uSecond, pa * uPat.z);
    col = mix(col, uThird, pb * uPat.z);
  } else if (uPat.w > 0.0) {
    col = mix(col, uSecond, smoothstep(0.55, 0.75, fbm(p * 12.0)) * uPat.w * 0.5);
  }

  // spots
  if (uPat2.y > 0.0 && (part == 0 || part == 4 || part == 6)) {
    float s = vnoise(p * vec3(13.0, 17.0, 17.0));
    float spot = smoothstep(0.6, 0.66, s) * (1.0 - smoothstep(0.76, 0.8, s) * 0.55);
    if (part == 0) spot *= smoothstep(-0.7, -0.1, a.y);
    col = mix(col, uSecond, spot * uPat2.y);
  }

  // points (Siamese): face mask, ears, lower legs, tail
  float pt = 0.0;
  if (part == 1) pt = smoothstep(0.05, 0.75, a.x) * smoothstep(0.75, 0.2, length(a.yz * vec2(1.0, 0.85))) * 1.2;
  else if (part == 2 || part == 3) pt = 1.0;
  else if (part == 4) pt = smoothstep(0.15, 0.7, a.x);
  else if (part == 5) pt = 1.0;
  else if (part == 6) pt = smoothstep(0.0, 0.45, a.x);
  else if (part == 0) pt = smoothstep(0.75, 1.0, a.y) * 0.3 + smoothstep(0.82, 1.0, a.x) * 0.3;
  if (uPat3.x > 0.0) {
    // panda: patches round the eyes, ears, legs and a saddle
    pt = 0.0;
    if (part == 1) pt = smoothstep(0.32, 0.22, min(length(a - vec3(0.78, 0.22, -0.52)), length(a - vec3(0.78, 0.22, 0.52))));
    else if (part == 2 || part == 3 || part == 4 || part == 5) pt = 1.0;
    else if (part == 0) pt = smoothstep(0.1, 0.3, a.y) * smoothstep(0.2, 0.3, a.x) * smoothstep(0.75, 0.62, a.x);
    else if (part == 6) pt = smoothstep(0.7, 0.75, a.x);
  }
  col = mix(col, uPoint, clamp(pt, 0.0, 1.0) * max(uPat2.x, uPat3.x));

  // white: belly and bib, socks, muzzle and blaze
  float w = 0.0;
  float wn = (vnoise(p * 7.0) - 0.5) * 0.16;
  if (part == 0) w = 0.5 - 0.5 * a.y + 0.38 * smoothstep(0.55, 0.85, a.x) * (0.6 - 0.4 * a.y) - 0.15 * smoothstep(0.2, 0.0, a.x);
  else if (part == 1) {
    vec3 h = a;
    w = smoothstep(-0.1, 0.9, h.x) * (0.7 - 0.5 * h.y) + 0.38 * smoothstep(0.3, 0.05, abs(h.z)) * smoothstep(0.1, 0.85, h.x) * smoothstep(0.9, 0.4, h.y);
  }
  else if (part == 4) w = 0.15 + 0.85 * a.x;
  else if (part == 5) w = 1.1;
  else if (part == 6) w = 0.62 * smoothstep(0.8, 1.0, a.x);
  float T = 1.0 - uPat.y;
  float wm = smoothstep(T - 0.035, T + 0.035, w + wn) * step(0.001, uPat.y);
  col = mix(col, uWhite, wm);

  // ears: pink inside, fur tufts
  if (part == 3) {
    float rim = smoothstep(0.55, 0.92, abs(a.y)) + smoothstep(0.75, 0.95, a.x);
    float tuft = smoothstep(0.6, 0.9, 0.5 + 0.5 * sin(a.y * 18.0 + a.x * 3.0)) * smoothstep(0.45, 0.0, a.x) * 0.6;
    col = mix(uEar, col, clamp(rim + tuft, 0.0, 1.0));
    rough = 0.7;
  }
  // smoke: a pale undercoat showing through
  if (uPat3.y > 0.0) col = mix(col, uSecond, smoothstep(0.45, 0.8, vnoise(p * vec3(60.0, 180.0, 180.0))) * 0.35 * uPat3.y);

  // the mouth: a little line under the nose, open to a dark oval
  if (part == 1) {
    vec3 h = a;
    float mx = smoothstep(0.75, 0.9, h.x);
    float line = smoothstep(0.045, 0.0, abs(h.y + 0.5 + abs(h.z) * 0.9 - 0.14 * smoothstep(0.08, 0.2, abs(h.z)))) * smoothstep(0.32, 0.22, abs(h.z)) * mx;
    float open = smoothstep(1.0, 0.75, length(vec2(h.z / (0.2 + 0.06 * uFace.z), (h.y + 0.62) / (0.02 + 0.2 * uFace.z)))) * mx * step(0.05, uFace.z);
    col = mix(col, vec3(0.12, 0.05, 0.05), max(line * 0.7, open));
    col = mix(col, vec3(0.85, 0.42, 0.45), open * smoothstep(-0.7, -0.78, h.y));
  }

  // fur: fine strands running back along the body
  float strands = vnoise(vec3(p.x * 38.0, p.y * 150.0, p.z * 150.0));
  col *= 0.9 + 0.2 * strands;
  // countershading: a touch darker along the back, lighter underneath
  if (part == 0) col *= 0.94 + 0.1 * smoothstep(0.6, -0.6, a.y);

  // glints (rare coats)
  if (uPat2.z > 0.0) {
    vec3 gp = floor(p * 140.0);
    float g = step(0.985, h31(gp));
    float tw = 0.5 + 0.5 * sin(uFx.z * 3.0 + h31(gp + 3.0) * 30.0);
    glow += uGlint * g * tw * uPat2.z * 1.6;
  }
  glow += vec3(1.0, 0.95, 0.85) * uFx.x * 0.7 + uGlint * uFx.y;
  return col;
}
`;

const uniformsFor = () => ({
  uBase: { value: hex('#e3893a') }, uSecond: { value: hex('#b5561c') }, uThird: { value: hex('#222222') },
  uWhite: { value: hex('#f7f2ea') }, uPoint: { value: hex('#4a3731') }, uNose: { value: hex('#e58d84') },
  uIris: { value: hex('#d2a429') }, uEar: { value: hex('#e8a3a0') }, uLid: { value: hex('#e3893a') }, uGlint: { value: hex('#ffffff') },
  uPat: { value: new THREE.Vector4() }, uPat2: { value: new THREE.Vector4() }, uPat3: { value: new THREE.Vector4() },
  uBreath: { value: 0 }, uFace: { value: new THREE.Vector4(0.5, 0, 0, 0) }, uFx: { value: new THREE.Vector4() }, uLook: { value: new THREE.Vector2() },
});

function patch(shader, u) {
  Object.assign(shader.uniforms, u);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${VERT_HEAD}`)
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = aRest; vAux = aAux; vPart = aPart;\nif (aPart < 0.5) transformed += objectNormal * uBreath * 0.006 * smoothstep(0.3, -0.7, aAux.y) * smoothstep(0.1, 0.35, aAux.x) * smoothstep(0.85, 0.55, aAux.x);');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${FRAG_HEAD}`)
    .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'float catRough; vec3 catGlow;\nvec4 diffuseColor = vec4( catCoat(catRough, catGlow), opacity );')
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = catRough;')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += catGlow;');
}

/** quality: 'low' | 'medium' | 'high'. */
export function createCatMaterial(quality = 'high') {
  const u = uniformsFor();
  const opts = { roughness: 0.86, metalness: 0 };
  const m = quality === 'low' ? new THREE.MeshStandardMaterial(opts) : new THREE.MeshPhysicalMaterial({ ...opts, sheen: 0.7, sheenRoughness: 0.55, sheenColor: hex('#ffffff') });
  m.userData.u = u;
  m.onBeforeCompile = (shader) => patch(shader, u);
  m.customProgramCacheKey = () => `cat-${quality}`;
  return m;
}

/** Paints a coat. seed: 0..1, so two calicos never match. */
export function setCoat(m, coat, seed = 0) {
  const L = COAT_LOOK[coat] ?? COAT_LOOK.ginger;
  const u = m.userData.u;
  u.uBase.value.set(L.base);
  u.uSecond.value.set(L.second ?? L.base);
  u.uThird.value.set(L.third ?? L.second ?? L.base);
  u.uWhite.value.set(L.white ?? '#f7f2ea');
  u.uPoint.value.set(L.point ?? L.second ?? L.base);
  u.uNose.value.set(L.nose ?? '#e58d84');
  u.uIris.value.set(L.iris ?? '#d2a429');
  u.uEar.value.set(L.ear ?? '#e9a29e');
  u.uGlint.value.set(L.glint ?? '#ffffff');
  // lids take the fur round the eye
  u.uLid.value.set(L.points || L.panda ? (L.point ?? L.base) : L.base).multiplyScalar(0.85);
  u.uPat.value.set(L.tabby ?? 0, L.whiteAmt ?? 0, L.patch ?? 0, L.mottle ?? 0);
  u.uPat2.value.set(L.points ?? 0, L.spots ?? 0, L.sparkle ?? 0, seed * 10);
  u.uPat3.value.set(L.panda ?? 0, L.smoke ?? 0, L.patchHi ?? 0, 0);
  if (m.sheenColor) m.sheenColor.set(L.sheen ?? L.white ?? L.base).lerp(new THREE.Color('#ffffff'), 0.3);
  m.userData.coat = coat;
}

export { COAT_INFO };
