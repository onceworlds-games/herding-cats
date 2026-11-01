// Every sound is made here in Web Audio: meows, the treat bag, claps, the carrier's clank, crashes, the clock, and a little
// jazz trio (walking bass, brushes, vibraphone) that plays under it all. Nothing throws: no audio just means silence.

let ctx = null;
let master = null;
let sfx = null;
let music = null;
let verb = null;
let noiseBuf = null;
let unlocked = false;

function make() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    sfx = ctx.createGain();
    sfx.gain.value = 0.8;
    sfx.connect(master);
    music = ctx.createGain();
    music.gain.value = 0.0;
    music.connect(master);
    // a small room: generated impulse
    verb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.1);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    verb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.18;
    verb.connect(wet).connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Call from a user gesture. */
export function unlock() {
  if (!make()) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  unlocked = true;
}

export function suspend(on) {
  if (!ctx) return;
  try {
    if (on) ctx.suspend();
    else if (unlocked) ctx.resume();
  } catch { /* ignore */ }
}

const ok = () => ctx && unlocked && ctx.state !== 'closed';

function env(g, t, a, peak, d, end = 0.0001) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  g.gain.exponentialRampToValueAtTime(end, t + a + d);
}

function tone(type, freq, t, a, peak, d, { to = null, dest = sfx, wet = 0, detune = 0 } = {}) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + a + d);
  o.detune.value = detune;
  const g = ctx.createGain();
  env(g, t, a, peak, d);
  o.connect(g).connect(dest);
  if (wet) {
    const w = ctx.createGain();
    w.gain.value = wet;
    g.connect(w).connect(verb);
  }
  o.start(t);
  o.stop(t + a + d + 0.05);
  return o;
}

function noise(t, dur, { type = 'bandpass', freq = 1500, q = 1, peak = 0.4, a = 0.002, to = null, dest = sfx, wet = 0 } = {}) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  env(g, t, a, peak, dur);
  s.connect(f).connect(g).connect(dest);
  if (wet) {
    const w = ctx.createGain();
    w.gain.value = wet;
    g.connect(w).connect(verb);
  }
  s.start(t, Math.random() * 0.5);
  s.stop(t + a + dur + 0.05);
}

// ------------------------------------------------------------------ cats

/** A meow: a saw through two moving formants, with a rising-falling contour. pitch ~1 (kitten 1.6, boss 0.6). */
export function meow(pitch = 1, len = 0.45, vol = 0.22) {
  if (!ok()) return;
  const t = ctx.currentTime + 0.01;
  const f0 = 520 * pitch * (0.9 + Math.random() * 0.2);
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0 * 0.8, t);
  o.frequency.linearRampToValueAtTime(f0 * 1.25, t + len * 0.35);
  o.frequency.linearRampToValueAtTime(f0 * 0.7, t + len);
  const vib = ctx.createOscillator();
  vib.frequency.value = 6 + Math.random() * 2;
  const vg = ctx.createGain();
  vg.gain.value = f0 * 0.025;
  vib.connect(vg).connect(o.frequency);
  const f1 = ctx.createBiquadFilter();
  f1.type = 'bandpass';
  f1.Q.value = 5;
  f1.frequency.setValueAtTime(700 * pitch, t);
  f1.frequency.linearRampToValueAtTime(1400 * pitch, t + len * 0.4);
  f1.frequency.linearRampToValueAtTime(800 * pitch, t + len);
  const f2 = ctx.createBiquadFilter();
  f2.type = 'bandpass';
  f2.Q.value = 7;
  f2.frequency.setValueAtTime(1800 * pitch, t);
  f2.frequency.linearRampToValueAtTime(2600 * pitch, t + len * 0.4);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.05);
  g.gain.setValueAtTime(vol, t + len * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(f1).connect(g);
  o.connect(f2).connect(g);
  g.connect(sfx);
  const w = ctx.createGain();
  w.gain.value = 0.4;
  g.connect(w).connect(verb);
  o.start(t);
  vib.start(t);
  o.stop(t + len + 0.05);
  vib.stop(t + len + 0.05);
}

/** A short grumble when a cat is pushed. */
export function mrt(pitch = 1) {
  meow(pitch * 0.85, 0.16 + Math.random() * 0.08, 0.1);
}

/** The trill a cat makes going in. */
export function mrrp(pitch = 1) {
  if (!ok()) return;
  const t = ctx.currentTime;
  const o = tone('sawtooth', 380 * pitch, t, 0.02, 0.08, 0.22, { to: 560 * pitch });
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 28;
  const lg = ctx.createGain();
  lg.gain.value = 60;
  lfo.connect(lg).connect(o.frequency);
  lfo.start(t);
  lfo.stop(t + 0.3);
}

export function hiss() {
  if (!ok()) return;
  noise(ctx.currentTime, 0.35, { type: 'highpass', freq: 3000, peak: 0.12, a: 0.03 });
}

export function purr() {
  if (!ok()) return;
  const t = ctx.currentTime;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 260;
  const am = ctx.createGain();
  am.gain.value = 0;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 24;
  const lg = ctx.createGain();
  lg.gain.value = 0.5;
  lfo.connect(lg).connect(am.gain);
  const g = ctx.createGain();
  env(g, t, 0.1, 0.35, 0.9);
  s.connect(f).connect(am).connect(g).connect(sfx);
  s.start(t);
  lfo.start(t);
  s.stop(t + 1.1);
  lfo.stop(t + 1.1);
}

// ------------------------------------------------------------------ people and things

export function rattle() {
  if (!ok()) return;
  const t = ctx.currentTime;
  const n = 8 + Math.floor(Math.random() * 5);
  for (let i = 0; i < n; i++) noise(t + Math.random() * 0.32, 0.025, { type: 'bandpass', freq: 2500 + Math.random() * 3000, q: 4, peak: 0.25 });
}

export function clapSound() {
  if (!ok()) return;
  const t = ctx.currentTime;
  noise(t, 0.09, { type: 'bandpass', freq: 1400, q: 0.8, peak: 0.6, wet: 1 });
  noise(t + 0.012, 0.07, { type: 'bandpass', freq: 2200, q: 0.9, peak: 0.35, wet: 0.6 });
}

export function clank() {
  if (!ok()) return;
  const t = ctx.currentTime;
  for (const [f, p] of [[420, 0.12], [1130, 0.08], [1870, 0.05], [2650, 0.04]]) tone('sine', f, t, 0.002, p, 0.35, { wet: 0.4 });
  noise(t, 0.02, { type: 'highpass', freq: 4000, peak: 0.3 });
}

export function stamp() {
  if (!ok()) return;
  const t = ctx.currentTime;
  tone('sine', 110, t, 0.004, 0.5, 0.18, { to: 45 });
  noise(t, 0.05, { type: 'lowpass', freq: 900, peak: 0.25 });
}

export function knock() {
  if (!ok()) return;
  const t = ctx.currentTime;
  tone('sine', 230, t, 0.002, 0.3, 0.12, { to: 180 });
  noise(t, 0.04, { type: 'bandpass', freq: 700, q: 3, peak: 0.2 });
  setTimeout(() => meow(0.8, 0.3, 0.12), 120);
}

export function crash() {
  if (!ok()) return;
  const t = ctx.currentTime;
  noise(t, 0.25, { type: 'highpass', freq: 2500, peak: 0.4, wet: 0.8 });
  noise(t + 0.04, 0.18, { type: 'bandpass', freq: 5000, q: 2, peak: 0.25 });
  for (let i = 0; i < 6; i++) tone('sine', 2500 + Math.random() * 3500, t + Math.random() * 0.2, 0.001, 0.05, 0.12 + Math.random() * 0.2, { wet: 0.5 });
}

export function whoosh() {
  if (!ok()) return;
  const t = ctx.currentTime;
  for (let i = 0; i < 6; i++) noise(t + i * 0.035, 0.02, { type: 'bandpass', freq: 3000, q: 3, peak: 0.12 });
  noise(t + 0.2, 0.4, { type: 'bandpass', freq: 600, to: 2400, q: 1.2, peak: 0.18, a: 0.08 });
}

export function skitter() {
  if (!ok()) return;
  const t = ctx.currentTime;
  for (let i = 0; i < 7; i++) noise(t + i * 0.04, 0.015, { type: 'bandpass', freq: 3500, q: 4, peak: 0.12 });
  tone('sine', 1600, t + 0.3, 0.01, 0.06, 0.08, { to: 2300 });
}

export function squeak() {
  if (!ok()) return;
  const t = ctx.currentTime;
  tone('sine', 1700, t, 0.01, 0.08, 0.1, { to: 2500 });
  for (let i = 0; i < 5; i++) noise(t + 0.12 + i * 0.05, 0.015, { type: 'bandpass', freq: 3000, q: 4, peak: 0.08 });
}

export function hop() {
  if (!ok()) return;
  noise(ctx.currentTime, 0.05, { type: 'lowpass', freq: 600, peak: 0.12 });
}

let lastStep = 0;
export function step(floor = 'oak') {
  if (!ok()) return;
  const t = ctx.currentTime;
  if (t - lastStep < 0.12) return;
  lastStep = t;
  const f = { oak: 900, deck: 700, tile: 1400, carpet: 380, grass: 520, stone: 1100 }[floor] ?? 800;
  noise(t, 0.03, { type: 'bandpass', freq: f * (0.9 + Math.random() * 0.2), q: 2, peak: 0.05 });
}

export function tick(loud = false) {
  if (!ok()) return;
  const t = ctx.currentTime;
  tone('square', loud ? 1900 : 1500, t, 0.001, loud ? 0.06 : 0.03, 0.03);
}

export function chime() {
  if (!ok()) return;
  const t = ctx.currentTime;
  tone('sine', 1319, t, 0.003, 0.18, 1.2, { wet: 0.8 });
  tone('sine', 1047, t + 0.35, 0.003, 0.18, 1.4, { wet: 0.8 });
}

export function tap() {
  if (!ok()) return;
  const t = ctx.currentTime;
  tone('sine', 780, t, 0.002, 0.12, 0.06, { to: 600 });
  noise(t, 0.01, { type: 'bandpass', freq: 2000, q: 2, peak: 0.08 });
}

export function dull() {
  if (!ok()) return;
  tone('triangle', 160, ctx.currentTime, 0.002, 0.12, 0.08);
}

export function star(i = 0) {
  if (!ok()) return;
  const t = ctx.currentTime;
  const f = [1319, 1568, 2093][i] ?? 1568;
  tone('sine', f, t, 0.002, 0.2, 0.6, { wet: 0.7 });
  tone('sine', f * 2, t, 0.002, 0.06, 0.3);
  stamp();
}

export function count(n) {
  if (!ok()) return;
  tone('sine', n > 0 ? 880 : 1320, ctx.currentTime, 0.003, 0.2, n > 0 ? 0.25 : 0.6, { wet: 0.6 });
}

// ------------------------------------------------------------------ stingers

const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);

function vib(m, t, d = 0.8, v = 0.14, dest = sfx) {
  const f = NOTE(m);
  const o = ctx.createOscillator();
  o.frequency.value = f;
  const mod = ctx.createOscillator();
  mod.frequency.value = f * 3.5;
  const mg = ctx.createGain();
  mg.gain.setValueAtTime(f * 1.2, t);
  mg.gain.exponentialRampToValueAtTime(1, t + d);
  mod.connect(mg).connect(o.frequency);
  const g = ctx.createGain();
  env(g, t, 0.004, v, d);
  const trem = ctx.createOscillator();
  trem.frequency.value = 5.5;
  const tg = ctx.createGain();
  tg.gain.value = v * 0.25;
  trem.connect(tg).connect(g.gain);
  o.connect(g).connect(dest);
  const w = ctx.createGain();
  w.gain.value = 0.5;
  g.connect(w).connect(verb);
  o.start(t);
  mod.start(t);
  trem.start(t);
  o.stop(t + d + 0.1);
  mod.stop(t + d + 0.1);
  trem.stop(t + d + 0.1);
}

export function roundStart() {
  if (!ok()) return;
  const t = ctx.currentTime;
  [67, 70, 74, 77, 81].forEach((m, i) => vib(m, t + i * 0.07, 0.9, 0.1));
  setTimeout(chime, 380);
}

export function allIn() {
  if (!ok()) return;
  const t = ctx.currentTime;
  for (const m of [65, 69, 72, 76]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = NOTE(m);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(600, t);
    f.frequency.linearRampToValueAtTime(2400, t + 0.15);
    const g = ctx.createGain();
    env(g, t, 0.05, 0.07, 1.1);
    o.connect(f).connect(g).connect(sfx);
    o.start(t);
    o.stop(t + 1.3);
  }
  [1.3, 1.0, 1.6].forEach((p, i) => setTimeout(() => meow(p, 0.35, 0.1), 250 + i * 140));
}

export function missed() {
  if (!ok()) return;
  const t = ctx.currentTime;
  [[58, 0], [57, 0.35], [56, 0.7], [55, 1.05]].forEach(([m, dt], i) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(NOTE(m), t + dt);
    if (i === 3) o.frequency.linearRampToValueAtTime(NOTE(m) * 0.94, t + dt + 0.8);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(400, t + dt);
    f.frequency.linearRampToValueAtTime(1200, t + dt + 0.12);
    f.frequency.linearRampToValueAtTime(500, t + dt + 0.3);
    const g = ctx.createGain();
    env(g, t + dt, 0.04, 0.12, i === 3 ? 0.9 : 0.3);
    o.connect(f).connect(g).connect(sfx);
    o.start(t + dt);
    o.stop(t + dt + 1.2);
  });
}

export function fanfare() {
  if (!ok()) return;
  const t = ctx.currentTime;
  [[65, 0], [69, 0.12], [72, 0.24], [77, 0.4], [77, 0.62], [81, 0.74]].forEach(([m, dt]) => vib(m, t + dt, 0.9, 0.12));
  allIn();
}

// ------------------------------------------------------------------ music

const CHORDS = [
  { root: 43, tones: [55, 58, 62, 65] }, // Gm7
  { root: 48, tones: [52, 55, 58, 62] }, // C7
  { root: 41, tones: [57, 60, 64, 65] }, // Fmaj7
  { root: 50, tones: [54, 57, 60, 62] }, // D7
];
const SCALE = [65, 67, 69, 70, 72, 74, 76, 77, 79];

const seq = { on: false, mode: 'menu', bpm: 112, next: 0, beat: 0, timer: 0, seed: 1, phrase: [], tense: false };

function rnd() {
  seq.seed = (seq.seed * 1103515245 + 12345) & 0x7fffffff;
  return seq.seed / 0x7fffffff;
}

function makePhrase() {
  const out = [];
  let i = Math.floor(rnd() * 5) + 2;
  for (let k = 0; k < 16; k++) {
    if (rnd() < 0.42) { out.push(null); continue; }
    i = Math.max(0, Math.min(SCALE.length - 1, i + Math.floor(rnd() * 5) - 2));
    out.push(SCALE[i]);
  }
  return out;
}

function schedule() {
  if (!ok() || !seq.on) return;
  const ahead = ctx.currentTime + 0.15;
  if (seq.next < ctx.currentTime - 0.1) seq.next = ctx.currentTime + 0.05; // back from a pause: no burst of old notes
  while (seq.next < ahead) {
    const t = Math.max(seq.next, ctx.currentTime);
    const beat = seq.beat;
    const bar = Math.floor(beat / 4) % 4;
    const inBar = beat % 4;
    const ch = CHORDS[bar];
    const spb = 60 / seq.bpm;
    // walking bass, one note a beat
    const walk = [ch.root, ch.root + 7, ch.root + (inBar === 2 ? 10 : 3), CHORDS[(bar + 1) % 4].root + 1];
    const bm = walk[inBar];
    tone('triangle', NOTE(bm), t, 0.004, 0.22, spb * 0.75, { dest: music });
    tone('sine', NOTE(bm + 12), t, 0.002, 0.05, 0.05, { dest: music });
    // brushes on 2 and 4, a ride on every swung eighth
    if (inBar === 1 || inBar === 3) noise(t, spb * 0.5, { type: 'bandpass', freq: 3200, q: 0.7, peak: 0.05, a: 0.04, dest: music });
    noise(t, 0.04, { type: 'highpass', freq: 7000, peak: 0.02, dest: music });
    noise(t + spb * 0.66, 0.03, { type: 'highpass', freq: 7000, peak: 0.012, dest: music });
    if (seq.mode === 'play') {
      // comp the chord on the and of 2 sometimes
      if (inBar === 1 && rnd() < 0.7) for (const m of ch.tones) vib(m, t + spb * 0.66, spb * 0.6, 0.025, music);
      // melody: swung eighths from the phrase
      if (inBar === 0 && bar === 0 && rnd() < 0.5) seq.phrase = makePhrase();
      for (let half = 0; half < 2; half++) {
        const idx = (bar * 4 + inBar) * 2 + half;
        const m = seq.phrase[idx % seq.phrase.length];
        if (m != null) vib(m, t + (half ? spb * 0.66 : 0), spb * 0.9, 0.05, music);
      }
      if (seq.tense && (inBar === 0 || inBar === 2)) tone('square', NOTE(ch.tones[(beat >> 1) % 4] + 12), t + spb * 0.66, 0.002, 0.018, 0.07, { dest: music });
    }
    seq.beat++;
    seq.next += spb;
  }
}

export function setMusic(mode, { seed = 1, tense = false } = {}) {
  if (!ctx) return;
  seq.seed = (seed * 7919) | 1;
  if (mode !== seq.mode) seq.phrase = makePhrase();
  seq.mode = mode;
  seq.tense = tense;
  seq.bpm = tense ? 132 : 112;
  const vol = mode === 'off' ? 0 : mode === 'menu' ? 0.28 : 0.55;
  try { music.gain.setTargetAtTime(vol, ctx.currentTime, 0.4); } catch { /* ignore */ }
  if (!seq.on && mode !== 'off') {
    seq.on = true;
    seq.next = ctx.currentTime + 0.1;
    if (!seq.phrase.length) seq.phrase = makePhrase();
    clearInterval(seq.timer);
    seq.timer = setInterval(() => { try { schedule(); } catch { /* ignore */ } }, 30);
  }
}

export function setTense(on) {
  if (seq.tense === on) return;
  seq.tense = on;
  seq.bpm = on ? 132 : 112;
}
