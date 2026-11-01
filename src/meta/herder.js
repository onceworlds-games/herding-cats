// The herder's level: XP from everything you do, and something to wear or show off at every level. The items themselves
// are drawn by render/people.js (hats), render/carriers.js (carrier shells) and render/fx.js (claps and trails).

export const XP = {
  cat: 10, // each cat into your carrier
  combo: 15, // each extra cat in a combo (a Double is +15, a Triple +30 more)
  trick: 20, // a bank shot, a knock-on, a laser, a ride, a delivery
  finish: 25, // an appointment with every cat in
  star: 60, // each star the first time
  rosette: 120, // beating an appointment's expert time the first time
  challenge: 30, // the challenge done again (no new star)
  daily: 150, // today's Daily, all in
  goal: 60, // a daily goal
  goals: 120, // all three goals of a day
  round: 25, // a Versus or Together round played
  win: 80, // a match won
  coat: 40, // a coat new to the Cat-alog
  page: 200, // a Cat-alog page complete
};

export const MAX_LEVEL = 30;

/** XP from level L to L + 1. */
export const need = (L) => 120 + 60 * (L - 1);

/** { level, into, next, total } from total XP: `into` XP into this level, `next` what the level takes. */
export function levelOf(xp) {
  let L = 1;
  let left = Math.max(0, Math.floor(xp) || 0);
  while (L < MAX_LEVEL && left >= need(L)) { left -= need(L); L++; }
  return { level: L, into: L >= MAX_LEVEL ? 0 : left, next: L >= MAX_LEVEL ? 0 : need(L), total: Math.max(0, Math.floor(xp) || 0) };
}

// Everything to wear. kind: hat | carrier | clap | trail. `id` is what the save keeps; `n` is its index in presence.
export const ITEMS = [
  // hats (on top of the avatar)
  { id: 'hat:none', kind: 'hat', name: 'No hat', free: true },
  { id: 'hat:beanie', kind: 'hat', name: 'Beanie', look: 'beanie', color: '#e5493a' },
  { id: 'hat:bucket', kind: 'hat', name: 'Bucket Hat', look: 'bucket', color: '#4f9a5e' },
  { id: 'hat:party', kind: 'hat', name: 'Party Hat', look: 'party', color: '#3f7fcb' },
  { id: 'hat:chef', kind: 'hat', name: 'Chef', look: 'chef', color: '#fffaf0' },
  { id: 'hat:flower', kind: 'hat', name: 'Daisy Chain', look: 'flower', color: '#fff3df' },
  { id: 'hat:cowboy', kind: 'hat', name: 'Cowpoke', look: 'cowboy', color: '#a8673a' },
  { id: 'hat:propeller', kind: 'hat', name: 'Propeller', look: 'propeller', color: '#f6b941' },
  { id: 'hat:witch', kind: 'hat', name: 'Witch', look: 'witch', color: '#4b3a6b' },
  { id: 'hat:top', kind: 'hat', name: 'Top Hat', look: 'top', color: '#2b1d1c' },
  { id: 'hat:ears', kind: 'hat', name: 'Cat Ears', look: 'ears', color: '#2b1d1c' },
  { id: 'hat:crown', kind: 'hat', name: 'Crown', look: 'crown', color: '#f6b941' },
  // carrier shells
  { id: 'carrier:red', kind: 'carrier', name: 'Vet Red', free: true, shell: '#e5493a' },
  { id: 'carrier:teal', kind: 'carrier', name: 'Teal', shell: '#2f9c95' },
  { id: 'carrier:sun', kind: 'carrier', name: 'Sunflower', shell: '#f2b632' },
  { id: 'carrier:dots', kind: 'carrier', name: 'Polka Dots', shell: '#7fc7a4', pattern: 'dots', ink: '#fff3df' },
  { id: 'carrier:stripes', kind: 'carrier', name: 'Lilac Stripes', shell: '#b79ad6', pattern: 'stripes', ink: '#fff3df' },
  { id: 'carrier:tartan', kind: 'carrier', name: 'Tartan', shell: '#b8353a', pattern: 'tartan', ink: '#2f5d46' },
  { id: 'carrier:leopard', kind: 'carrier', name: 'Leopard', shell: '#e0b46a', pattern: 'spots', ink: '#4a2f1c' },
  { id: 'carrier:stars', kind: 'carrier', name: 'Starry Night', shell: '#26346b', pattern: 'stars', ink: '#f6d36b' },
  { id: 'carrier:calico', kind: 'carrier', name: 'Calico', shell: '#f4ede2', pattern: 'patches', ink: '#dc7f2c', ink2: '#2c2526' },
  { id: 'carrier:gold', kind: 'carrier', name: 'Lucky Gold', shell: '#f2c247', metal: true },
  // what a clap throws out
  { id: 'clap:dust', kind: 'clap', name: 'Dust', free: true },
  { id: 'clap:hearts', kind: 'clap', name: 'Hearts', fx: 'heart', colors: ['#e57fa6', '#f29bb9'] },
  { id: 'clap:stars', kind: 'clap', name: 'Stars', fx: 'star', colors: ['#f6b941', '#ffe08a'] },
  { id: 'clap:confetti', kind: 'clap', name: 'Confetti', fx: 'square', colors: ['#e5493a', '#3f7fcb', '#f6b941', '#4f9a5e'] },
  { id: 'clap:bubbles', kind: 'clap', name: 'Bubbles', fx: 'ring', colors: ['#bfe6ff', '#ffffff'] },
  { id: 'clap:notes', kind: 'clap', name: 'Notes', fx: 'note', colors: ['#2b1d1c', '#8c5bc4'] },
  { id: 'clap:fish', kind: 'clap', name: 'Fish', fx: 'fish', colors: ['#7fb2d8', '#f29b54'] },
  // what you leave on the floor as you walk
  { id: 'trail:none', kind: 'trail', name: 'None', free: true },
  { id: 'trail:paws', kind: 'trail', name: 'Paw Prints', fx: 'paw', colors: ['#6b4a3a'] },
  { id: 'trail:hearts', kind: 'trail', name: 'Hearts', fx: 'heart', colors: ['#e57fa6'] },
  { id: 'trail:flowers', kind: 'trail', name: 'Flowers', fx: 'flower', colors: ['#f6b941', '#fff3df', '#e57fa6'] },
  { id: 'trail:sparkle', kind: 'trail', name: 'Sparkle', fx: 'spark', colors: ['#ffe9a8'], glow: true },
  { id: 'trail:fish', kind: 'trail', name: 'Fishbones', fx: 'fish', colors: ['#fff3df'] },
  { id: 'trail:stars', kind: 'trail', name: 'Stars', fx: 'star', colors: ['#f6b941'] },
  { id: 'trail:rainbow', kind: 'trail', name: 'Rainbow', fx: 'dot', colors: ['#e5493a', '#f29b54', '#f6d36b', '#4f9a5e', '#3f7fcb', '#8c5bc4'], glow: true },
];
ITEMS.forEach((it) => { it.n = ITEMS.filter((o) => o.kind === it.kind).indexOf(it); });
export const ITEM = Object.fromEntries(ITEMS.map((it) => [it.id, it]));
export const KINDS = ['hat', 'carrier', 'clap', 'trail'];
export const byKind = (kind) => ITEMS.filter((it) => it.kind === kind);
export const itemAt = (kind, n) => byKind(kind)[n] ?? null;

// what each herder level brings (levels 2 to 30); the Cat-alog's pages bring the rest (catalog.js)
export const LEVEL_ITEMS = {
  2: 'hat:beanie', 3: 'trail:paws', 4: 'carrier:teal', 5: 'clap:hearts', 6: 'hat:bucket', 7: 'carrier:sun',
  8: 'trail:hearts', 9: 'clap:stars', 10: 'hat:party', 11: 'carrier:dots', 12: 'trail:flowers', 13: 'clap:confetti',
  14: 'hat:chef', 15: 'carrier:stripes', 16: 'clap:bubbles', 17: 'hat:flower', 18: 'trail:sparkle', 19: 'carrier:tartan',
  20: 'hat:cowboy', 21: 'clap:notes', 22: 'carrier:leopard', 23: 'hat:propeller', 24: 'trail:fish', 25: 'clap:fish',
  26: 'hat:witch', 27: 'carrier:stars', 28: 'hat:top', 29: 'trail:stars', 30: 'hat:crown',
};

/** The item a level brings, or null. */
export const levelItem = (L) => (LEVEL_ITEMS[L] ? ITEM[LEVEL_ITEMS[L]] : null);

/** The next level that brings something, from level L: { level, item } or null at the top. */
export function nextUnlock(L) {
  for (let k = L + 1; k <= MAX_LEVEL; k++) if (LEVEL_ITEMS[k]) return { level: k, item: ITEM[LEVEL_ITEMS[k]] };
  return null;
}

/** XP for a run's events: cats in, combos, tricks. stats from g.stats; mine = cats into my carrier. */
export function runXp({ mine = 0, stats = null } = {}) {
  let xp = mine * XP.cat;
  if (stats) {
    xp += (stats.comboCats ?? 0) * XP.combo;
    xp += ((stats.banks ?? 0) + (stats.chains ?? 0) + (stats.laserIns ?? 0) + (stats.rides ?? 0) + (stats.deliveries ?? 0)) * XP.trick;
  }
  return xp;
}
