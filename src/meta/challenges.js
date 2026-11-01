// The third star of an appointment: one thing to do on the way to a full carrier. Each reads the run's stats (g.stats)
// once every cat is in; `live` says while playing whether it's still possible (false: already failed) or done (true).

export const CHALLENGES = {
  double: { label: 'A Double', icon: 'two', test: (s) => s.bestCombo >= 2 },
  triple: { label: 'A Triple', icon: 'three', test: (s) => s.bestCombo >= 3 },
  train: { label: 'A Cat Train', icon: 'train', test: (s) => s.bestCombo >= 4 },
  noclap: { label: 'No claps', icon: 'noclap', test: (s) => s.claps === 0, fails: (s) => s.claps > 0 },
  notreats: { label: 'No treats', icon: 'notreats', test: (s) => s.treats === 0, fails: (s) => s.treats > 0 },
  bank: { label: 'A bank shot', icon: 'bank', test: (s) => s.banks >= 1 },
  banks2: { label: 'Two bank shots', icon: 'bank', test: (s) => s.banks >= 2 },
  chain: { label: 'A knock-on', icon: 'chain', test: (s) => s.chains >= 1 },
  loaf: { label: 'Loaf in one clap', icon: 'loaf', test: (s) => !!s.loafShot },
  boss: { label: 'Boss first', icon: 'crown', test: (s) => s.bossFirst != null && s.bossFirst >= 0, fails: (s) => s.bossFirst != null && s.bossFirst < 0 },
  zoomies: { label: 'Zoomer mid-sprint', icon: 'bolt', test: (s) => !!s.zoomies },
  laser: { label: 'In by laser', icon: 'laser', test: (s) => s.laserIns >= 1 },
  ride: { label: 'A vacuum ride', icon: 'vacuum', test: (s) => s.rides >= 1 },
  box: { label: 'Special delivery', icon: 'box', test: (s) => s.deliveries >= 1 },
  nohide: { label: 'Nobody hides', icon: 'heart', test: (s) => (s.hides ?? 0) === 0, fails: (s) => (s.hides ?? 0) > 0 },
  nocrash: { label: 'Nothing broken', icon: 'vase', test: (s) => s.crashes === 0, fails: (s) => s.crashes > 0 },
  shots3: { label: 'Three clap shots in', icon: 'clap', test: (s) => (s.shotIns ?? 0) >= 3 },
};

/** What a level's cats and twists make possible: the challenges that make sense there. */
export function possible(id, { types = [], twists = {} } = {}) {
  const t = new Set(types);
  switch (id) {
    case 'loaf': return t.has('loaf');
    case 'boss': return t.has('boss');
    case 'zoomies': return t.has('zoomer');
    case 'nohide': return t.has('scaredy');
    case 'laser': return !!twists.laser;
    case 'ride': return !!twists.vacs?.length;
    case 'box': return !!twists.boxes?.length;
    default: return !!CHALLENGES[id];
  }
}

/** Did the run do it? Only a full carrier counts. */
export function passed(id, result) {
  const ch = CHALLENGES[id];
  if (!ch || !result?.allIn || !result.stats) return false;
  return !!ch.test(result.stats);
}

/** While playing: 1 done, -1 failed (can't be done any more this run), 0 not yet. */
export function liveState(id, stats) {
  const ch = CHALLENGES[id];
  if (!ch || !stats) return 0;
  if (ch.fails) return ch.fails(stats) ? -1 : 0;
  return ch.test(stats) ? 1 : 0;
}
