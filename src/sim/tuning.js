// Every number that decides how herding feels, in one place. Units: u (world units, a cat is ~0.75 u long), seconds.

export const STEP = 1 / 30;

export const PERSON = {
  speed: 4.6,
  accel: 42, // reaches full speed in ~0.11 s
  decel: 56, // stops in ~0.08 s
  radius: 0.35,
};

export const TREATS = { radius: 6, lure: 2.2, speed: 2.2, stopAt: 1.0, content: 1.4, cooldown: 3.2 };
// The clap is a shot: every cat in reach runs dead straight away from you, off walls and furniture (keeping `keep` of its
// speed per bounce) and into other cats, which take the hit and run on along the line between them.
export const CLAP = { radius: 4, bolt: 6.8, boltTime: 0.72, trot: 3.0, trotTime: 0.55, cooldown: 2.4, keep: 0.86, minKeep: 0.35 };

export const DOOR = {
  matW: 1.5, // across the door
  matD: 1.1, // out from the door
  cosEntry: 0.34, // moving within ~70° of straight in
  minSpeed: 0.5,
  pull: 0.3,
};

// Cats in one after another (within `window` s of the last) chain: Double, Triple, then a Cat Train.
export const COMBO = { window: 2.2, names: ['', '', 'Double', 'Triple', 'Cat Train'] };

// Twists a room can have.
export const LASER = { reach: 2.9, time: 7, radius: 5.5, speed: 4.6, pick: 0.75, respawn: 14, near: 1.4 };
export const VAC = { speed: 1.25, radius: 0.42, scare: 2.0, turn: 0.75, rideChance: 0.35 };
export const BELL = { warn: 1.8, radius: 11 };
export const BOX = { radius: 0.45, sitRange: 4, sitChance: 0.55, deliver: 0.4 };
export const SUN = { range: 7, chance: 0.4, nap: [18, 30], lazy: { loaf: 1, glutton: 1, moggy: 0.5, kitten: 0.3, scaredy: 0.4, zoomer: 0.15, boss: 0.6 } };

export const CARRIER = { len: 1.1, wid: 0.82, height: 0.78 };

export const CAT = {
  radius: 0.26,
  separation: 0.62,
  calmSpeed: 1.5,
  calmTurn: 4.2, // rad/s
  fleeTurn: 11, // rad/s: cats pivot fast when they mean it
  accel: 12,
  carrierAvoid: 1.5,
  wobble: 0.1, // rad, slow drift so they read alive but never random
  linger: 0.5, // keeps going after the push is gone
  settle: 0.4,
  cornerTime: 0.4,
  crouch: 0.35,
  slipSpeed: 4.5,
  slipTime: 0.8,
  perchChance: 0.04, // per second, when idle near a low piece
  perchMin: 6,
  perchMax: 15,
  swatChance: 0.15,
  crashScare: 6,
  hop: 0.4,
};

// Per personality. tell = the pause-and-glance before a push turns into a walk (s).
export const TYPES = {
  moggy: { flee: 3.0, fleeMin: 2.0, fleeMax: 4.0, calm: 1.5, tell: [0.11, 0.15], lure: 6, lureSpeed: 2.2, lureTime: 2.2, size: 1 },
  loaf: { flee: 0, fleeMin: 0, fleeMax: 0, calm: 0, tell: [0.2, 0.2], lure: 0, lureSpeed: 0, lureTime: 0, size: 1.05, scoot: 3.6, scootTime: 0.8 },
  zoomer: { flee: 3.0, fleeMin: 2.2, fleeMax: 4.4, calm: 2.0, tell: [0.1, 0.12], lure: 6, lureSpeed: 2.4, lureTime: 2.2, size: 0.95,
    zoomEvery: [5, 9], wiggle: 0.7, sprint: 7, sprintTime: 1.2, aimRadius: 4 },
  scaredy: { flee: 5.0, fleeMin: 2.0, fleeMax: 4.6, calm: 1.4, tell: [0.1, 0.12], lure: 6.5, lureSpeed: 2.0, lureTime: 2.4, size: 0.82,
    hideClap: 8, creep: 1.2, emerge: 15 },
  glutton: { flee: 2.6, fleeMin: 1.2, fleeMax: 2.8, calm: 1.0, tell: [0.16, 0.18], lure: 14, lureSpeed: 2.8, lureTime: 3.0, size: 1.22 },
  kitten: { flee: 2.0, fleeMin: 1.8, fleeMax: 3.4, calm: 1.6, tell: [0.1, 0.14], lure: 6, lureSpeed: 2.4, lureTime: 2.2, size: 0.6,
    followRange: 6, followGap: 1.0, followIn: 4, followDelay: 0.8 },
  boss: { flee: 3.0, fleeMin: 1.4, fleeMax: 2.4, calm: 1.1, tell: [0.18, 0.18], lure: 0, lureSpeed: 0, lureTime: 0, size: 1.25,
    stalk: 2.5, stalkTime: 1.0, gangRange: 6, march: 1.8 },
};

export const TYPE_LIST = ['moggy', 'loaf', 'zoomer', 'scaredy', 'glutton', 'kitten', 'boss'];

export const COATS = ['ginger', 'grey', 'tuxedo', 'calico', 'black', 'white', 'tortie', 'siamese'];

// State codes (also the wire format).
export const S = {
  idle: 0, walk: 1, alert: 2, flee: 3, settle: 4, lured: 5, content: 6, bolt: 7, trot: 8, crouch: 9, slip: 10,
  enter: 11, boxed: 12, bump: 13, hop: 14, perch: 15, runhide: 16, hidden: 17, creep: 18, sleep: 19, scoot: 20,
  wiggle: 21, sprint: 22, follow: 23, march: 24, snub: 25, stalk: 26, hold: 27, arrive: 28,
  chase: 29, ride: 30, boxsit: 31, seek: 32, nap: 33,
};
export const STATE_COUNT = 34;

export const ROUND = {
  versus: 120,
  together: 150,
  catsPerSeatVersus: 4,
  togetherBase: 6,
  togetherPerSeat: 2,
  togetherStars: [30, 60], // seconds left for two and three stars
};

export const CATLADY = { start: 60, bonus: 8, bonusDrop: 0.1, bonusMin: 4.5, loose: 6, looseEvery: 8, looseMax: 10 };

export const SEATS = [
  { color: '#e5493a', name: 'Red', symbol: 'fish' },
  { color: '#3f7fcb', name: 'Blue', symbol: 'yarn' },
  { color: '#f6b941', name: 'Gold', symbol: 'bell' },
  { color: '#4f9a5e', name: 'Green', symbol: 'paw' },
  { color: '#8c5bc4', name: 'Violet', symbol: 'mouse' },
  { color: '#e57fa6', name: 'Pink', symbol: 'moon' },
];
