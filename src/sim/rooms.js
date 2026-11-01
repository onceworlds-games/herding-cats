// Rooms: size, floor, walls, furniture, the carrier(s), where the person comes in.
// Coordinates: x runs east, z runs south; the north (z = 0) and west (x = 0) walls stand, the others are cut away.
// Carrier dir is the way its door faces: n (-z), s (+z), e (+x), w (-x).

import { KIT, footprint } from './kit.js';

const R = (id, name, w, d, floor, wall, items, carrier, entry, extra = {}) => ({ id, name, w, d, floor, wall, items, carriers: carrier ? [carrier] : [], entry, ...extra });

export const ROOMS = {
  studio: R('studio', 'Studio Flat', 14, 12, 'oak', 'sage', [
    { k: 'rug', x: 4.2, z: 3.4, w: 4.2, d: 2.8, c: 'mustard' },
    { k: 'sofa', x: 3.6, z: 0.6, c: 'teal' },
    { k: 'coffee', x: 3.8, z: 2.7 },
    { k: 'plant', x: 0.5, z: 0.5 },
    { k: 'bookshelf', x: 0.3, z: 4.2, r: 1 },
    { k: 'lamp', x: 6.0, z: 0.4 },
    { k: 'fridge', x: 7.6, z: 0.45 },
    { k: 'counter', x: 9.3, z: 0.4 },
    { k: 'bed', x: 12.6, z: 1.7, c: 'blush' },
    { k: 'armchair', x: 12.4, z: 9.6, r: 3, c: 'mustard' },
    { k: 'plant', x: 13.4, z: 11.4 },
  ], { x: 0.65, z: 8.5, dir: 'e' }, { x: 6.7, z: 0.9 }),

  living: R('living', 'Living Room', 16, 14, 'oak', 'blush', [
    { k: 'rug', x: 6, z: 2.2, w: 4.4, d: 2.6, c: 'teal' },
    { k: 'tvunit', x: 6, z: 0.3 },
    { k: 'coffee', x: 6, z: 2.0 },
    { k: 'sofa', x: 6, z: 3.7, r: 2, c: 'mustard' },
    { k: 'bookshelf', x: 0.3, z: 6, r: 1 },
    { k: 'armchair', x: 1.2, z: 2.4, r: 1, c: 'teal' },
    { k: 'sideboard', x: 11.5, z: 0.3 },
    { k: 'plant', x: 15.4, z: 0.6 },
    { k: 'plant', x: 0.5, z: 0.5 },
    { k: 'table', x: 12, z: 7 },
    { k: 'chair', x: 12, z: 6.1 },
    { k: 'chair', x: 12, z: 7.9 },
    { k: 'plant', x: 15.4, z: 13.4 },
  ], { x: 0.65, z: 11, dir: 'e' }, { x: 14, z: 0.9 }),

  bedroom: R('bedroom', 'Bedroom', 16, 14, 'carpet', 'butter', [
    { k: 'bed', x: 3, z: 1.7, c: 'sage' },
    { k: 'wardrobe', x: 8, z: 0.36 },
    { k: 'desk', x: 13, z: 0.4 },
    { k: 'chair', x: 13, z: 1.25 },
    { k: 'plant', x: 15.4, z: 0.6 },
    { k: 'rug', x: 8, z: 6, w: 4, d: 3, c: 'blush' },
    { k: 'basket', x: 0.5, z: 6 },
    { k: 'armchair', x: 12, z: 10, r: 3, c: 'teal' },
  ], { x: 0.65, z: 10.5, dir: 'e' }, { x: 10.8, z: 0.9 }),

  bedroom2: R('bedroom2', 'Big Bedroom', 18, 14, 'carpet', 'sage', [
    { k: 'bed', x: 3, z: 1.7, c: 'blush' },
    { k: 'bed', x: 14.5, z: 1.7, c: 'mustard' },
    { k: 'wardrobe', x: 8.2, z: 0.36 },
    { k: 'rug', x: 9, z: 7, w: 5, d: 3, c: 'teal' },
    { k: 'sofa', x: 9.5, z: 10.5, r: 0, c: 'teal' },
    { k: 'desk', x: 16.6, z: 7, r: 1 },
    { k: 'plant', x: 0.5, z: 5.2 },
    { k: 'basket', x: 11.4, z: 0.5 },
  ], { x: 0.65, z: 11.5, dir: 'e' }, { x: 10.6, z: 0.9 }),

  kitchen: R('kitchen', 'Kitchen', 16, 12, 'tile', 'sage', [
    { k: 'counter', x: 3, z: 0.36 },
    { k: 'counter', x: 5, z: 0.36 },
    { k: 'fridge', x: 6.6, z: 0.42 },
    { k: 'counter', x: 9, z: 0.36 },
    { k: 'counter', x: 0.36, z: 3, r: 1 },
    { k: 'table', x: 7, z: 5.5 },
    { k: 'chair', x: 6.4, z: 6.5 },
    { k: 'chair', x: 7.6, z: 6.5 },
    { k: 'plant', x: 15.4, z: 0.5 },
    { k: 'rug', x: 12, z: 6.5, w: 3, d: 2, c: 'mustard' },
  ], { x: 11.6, z: 0.65, dir: 's' }, { x: 0.9, z: 9 }),

  hallway: R('hallway', 'Hallway', 24, 8, 'oak', 'blush', [
    { k: 'rug', x: 12, z: 4, w: 11, d: 2.4, c: 'teal' },
    { k: 'sideboard', x: 8, z: 0.3 },
    { k: 'lamp', x: 12, z: 0.3 },
    { k: 'bench', x: 16, z: 0.35 },
    { k: 'plant', x: 23.4, z: 0.5 },
    { k: 'plant', x: 0.5, z: 0.5 },
    { k: 'boxstack', x: 20, z: 7.4 },
    { k: 'chair', x: 4, z: 7.5 },
  ], { x: 0.65, z: 4, dir: 'e' }, { x: 21, z: 0.9 }),

  laundry: R('laundry', 'Laundry', 14, 14, 'tile', 'butter', [
    { k: 'washer', x: 2, z: 0.45 },
    { k: 'washer', x: 3, z: 0.45 },
    { k: 'basket', x: 5, z: 0.5 },
    { k: 'basket', x: 0.5, z: 4 },
    { k: 'basket', x: 9.5, z: 6.5 },
    { k: 'sideboard', x: 11, z: 0.3 },
    { k: 'rug', x: 6.5, z: 7, w: 3, d: 3, c: 'sage' },
    { k: 'plant', x: 13.4, z: 0.6 },
    { k: 'boxstack', x: 13.4, z: 12 },
  ], { x: 0.65, z: 10, dir: 'e' }, { x: 7.6, z: 0.9 }),

  garden: R('garden', 'Back Garden', 22, 18, 'grass', 'brick', [
    { k: 'pond', x: 11, z: 9, w: 4, d: 3 },
    { k: 'hedge', x: 4, z: 5 },
    { k: 'hedge', x: 17, z: 13.5 },
    { k: 'flowerbed', x: 6, z: 0.5, w: 4 },
    { k: 'flowerbed', x: 15.5, z: 0.5, w: 4 },
    { k: 'bench', x: 11, z: 0.4 },
    { k: 'shed', x: 20.6, z: 1.4 },
    { k: 'plant', x: 0.6, z: 0.6 },
    { k: 'table', x: 17, z: 6.5 },
    { k: 'chair', x: 16.2, z: 7.5 },
    { k: 'chair', x: 17.8, z: 7.5 },
  ], { x: 0.65, z: 14, dir: 'e' }, { x: 0.9, z: 2.6 }),

  cafe: R('cafe', 'Cat Café', 22, 18, 'tile', 'sage', [
    { k: 'counter', x: 4, z: 0.36 },
    { k: 'counter', x: 6, z: 0.36 },
    { k: 'fridge', x: 7.8, z: 0.42 },
    { k: 'sideboard', x: 14, z: 0.3 },
    { k: 'bookshelf', x: 17, z: 0.26 },
    { k: 'cafetable', x: 5, z: 5.5 },
    { k: 'cafetable', x: 9.5, z: 5.5 },
    { k: 'cafetable', x: 14, z: 5.5 },
    { k: 'cafetable', x: 7, z: 10.5 },
    { k: 'cafetable', x: 12, z: 10.5 },
    { k: 'cafetable', x: 17, z: 9.5 },
    { k: 'chair', x: 5.8, z: 5.5 },
    { k: 'chair', x: 13.2, z: 5.5 },
    { k: 'chair', x: 12.8, z: 10.5 },
    { k: 'cattree', x: 0.6, z: 6.5 },
    { k: 'cattree', x: 20.5, z: 13.5 },
    { k: 'sofa', x: 21, z: 3.2, r: 1, c: 'blush' },
    { k: 'rug', x: 11, z: 14.5, w: 5, d: 3, c: 'mustard' },
    { k: 'plant', x: 21.4, z: 0.6 },
    { k: 'plant', x: 0.6, z: 0.6 },
    { k: 'armchair', x: 15.5, z: 15.5, r: 3, c: 'teal' },
  ], { x: 0.65, z: 13.5, dir: 'e' }, { x: 11, z: 0.9 }),

  library: R('library', 'Library', 22, 18, 'carpet', 'burgundy', [
    { k: 'bookshelf', x: 3, z: 0.26 },
    { k: 'bookshelf', x: 9, z: 0.26 },
    { k: 'bookshelf', x: 16, z: 0.26 },
    { k: 'bookshelf', x: 20, z: 0.26 },
    { k: 'shelfrow', x: 5, z: 4.2 },
    { k: 'shelfrow', x: 11, z: 4.2 },
    { k: 'shelfrow', x: 5, z: 8.2 },
    { k: 'shelfrow', x: 11, z: 8.2 },
    { k: 'table', x: 17, z: 6 },
    { k: 'table', x: 17, z: 11 },
    { k: 'desk', x: 11, z: 13 },
    { k: 'armchair', x: 3.5, z: 13, r: 0, c: 'mustard' },
    { k: 'rug', x: 11, z: 15.3, w: 6, d: 2.4, c: 'teal' },
    { k: 'plant', x: 21.4, z: 17.4 },
  ], { x: 0.65, z: 15.5, dir: 'e' }, { x: 12.6, z: 0.9 }),

  movingday: R('movingday', 'Moving Day', 20, 16, 'oak', 'cream', [
    { k: 'sofa', x: 10, z: 0.6, c: 'sage' },
    { k: 'box', x: 4, z: 4 },
    { k: 'box', x: 8, z: 3.5 },
    { k: 'box', x: 12.5, z: 9 },
    { k: 'box', x: 15.5, z: 4 },
    { k: 'box', x: 7, z: 12 },
    { k: 'boxstack', x: 6, z: 8 },
    { k: 'boxstack', x: 10, z: 6 },
    { k: 'boxstack', x: 14, z: 12.5 },
    { k: 'boxstack', x: 3, z: 11 },
    { k: 'boxstack', x: 17.5, z: 9 },
    { k: 'lamp', x: 0.4, z: 0.4 },
    { k: 'rug', x: 10, z: 10, w: 3, d: 2, c: 'blush' },
  ], { x: 0.65, z: 13.5, dir: 'e' }, { x: 16, z: 0.9 }),

  boat: R('boat', 'Boat Deck', 24, 10, 'deck', 'white', [
    { k: 'lifeboat', x: 12, z: 0.75 },
    { k: 'boxstack', x: 6, z: 6.5 },
    { k: 'boxstack', x: 18, z: 6.5 },
    { k: 'skylight', x: 9, z: 4.6 },
    { k: 'skylight', x: 15, z: 4.6 },
    { k: 'rope', x: 3.5, z: 0.6 },
    { k: 'rope', x: 21, z: 8.8 },
    { k: 'deckchair', x: 4, z: 8.6, r: 1 },
    { k: 'deckchair', x: 12, z: 8.8, r: 1 },
    { k: 'plant', x: 23.4, z: 0.5 },
  ], { x: 0.65, z: 5, dir: 'e' }, { x: 20, z: 0.9 }, { sea: true }),

  greenhouse: R('greenhouse', 'Greenhouse', 20, 16, 'stone', 'glass', [
    { k: 'planttable', x: 5, z: 4 },
    { k: 'planttable', x: 5, z: 8 },
    { k: 'planttable', x: 5, z: 12 },
    { k: 'planttable', x: 13, z: 4 },
    { k: 'planttable', x: 13, z: 8 },
    { k: 'planttable', x: 13, z: 12 },
    { k: 'plant', x: 9, z: 0.6 },
    { k: 'plant', x: 19.4, z: 0.6 },
    { k: 'plant', x: 19.4, z: 15.4 },
    { k: 'bench', x: 3, z: 0.4 },
  ], { x: 0.65, z: 8, dir: 'e' }, { x: 17.2, z: 0.9 }),

  rooftop: R('rooftop', 'Rooftop', 22, 18, 'stone', 'brick', [
    { k: 'chimney', x: 5, z: 5 },
    { k: 'chimney', x: 14, z: 3 },
    { k: 'chimney', x: 17, z: 11 },
    { k: 'skylight', x: 9, z: 9 },
    { k: 'skylight', x: 12.5, z: 14 },
    { k: 'bench', x: 11, z: 0.4 },
    { k: 'deckchair', x: 19.5, z: 15, r: 1 },
    { k: 'plant', x: 0.6, z: 0.6 },
    { k: 'plant', x: 21.4, z: 0.6 },
    { k: 'flowerbed', x: 6, z: 0.5, w: 3 },
    { k: 'lamp', x: 3, z: 12.5 },
    { k: 'lamp', x: 8.5, z: 12.5 },
  ], { x: 0.65, z: 9, dir: 'e' }, { x: 2.6, z: 0.9 }, { line: [3, 12.5, 8.5, 12.5] }),

  flat: R('flat', 'The Whole Flat', 26, 20, 'oak', 'sage', [
    { k: 'wall', x: 9, z: 3.9, w: 0.2, d: 7.8, h: 1.1 },
    { k: 'wall', x: 9, z: 15.6, w: 0.2, d: 8.8, h: 1.1 },
    { k: 'wall', x: 12.6, z: 10, w: 7, d: 0.2, h: 1.1 },
    { k: 'wall', x: 22.6, z: 10, w: 6.8, d: 0.2, h: 1.1 },
    { k: 'sofa', x: 4, z: 0.6, c: 'teal' },
    { k: 'rug', x: 4.2, z: 3.2, w: 4, d: 2.4, c: 'mustard' },
    { k: 'coffee', x: 4, z: 2.7 },
    { k: 'plant', x: 0.5, z: 0.5 },
    { k: 'armchair', x: 6, z: 12, r: 3, c: 'blush' },
    { k: 'counter', x: 12.5, z: 0.36 },
    { k: 'counter', x: 14.5, z: 0.36 },
    { k: 'fridge', x: 16.2, z: 0.42 },
    { k: 'table', x: 21, z: 5 },
    { k: 'chair', x: 21, z: 4.1 },
    { k: 'chair', x: 21, z: 5.9 },
    { k: 'plant', x: 25.4, z: 0.5 },
    { k: 'bed', x: 24.4, z: 14.6, c: 'sage' },
    { k: 'desk', x: 14, z: 19.5 },
    { k: 'basket', x: 10, z: 19.4 },
    { k: 'bookshelf', x: 0.3, z: 7, r: 1 },
  ], { x: 0.65, z: 17, dir: 'e' }, { x: 6.6, z: 0.9 }),

  parlour: R('parlour', "The Cat Lady's Parlour", 18, 14, 'carpet', 'blush', [
    { k: 'sofa', x: 5, z: 0.6, c: 'sage' },
    { k: 'rug', x: 5, z: 3, w: 4.4, d: 2.6, c: 'teal' },
    { k: 'coffee', x: 5, z: 2.6 },
    { k: 'armchair', x: 1.2, z: 4.2, r: 1, c: 'mustard' },
    { k: 'sideboard', x: 10.5, z: 0.3 },
    { k: 'cattree', x: 16.6, z: 4 },
    { k: 'basket', x: 1, z: 8.4 },
    { k: 'plant', x: 17.4, z: 0.5 },
    { k: 'plant', x: 0.5, z: 0.5 },
    { k: 'cafetable', x: 12, z: 9 },
  ], { x: 0.65, z: 11.5, dir: 'e' }, { x: 9, z: 7 }, { flap: { x: 14, z: 0.6 } }),

  waiting: R('waiting', 'Waiting Room', 16, 10, 'tile', 'sage', [
    { k: 'waitbench', x: 4.3, z: 0.45 },
    { k: 'waitbench', x: 9.3, z: 0.45 },
    { k: 'counterdesk', x: 14, z: 2.4, r: 1 },
    { k: 'plant', x: 0.5, z: 0.5 },
    { k: 'plant', x: 12, z: 0.5 },
    { k: 'rug', x: 7, z: 5, w: 6, d: 3, c: 'teal' },
  ], null, { x: 7, z: 6 }),
};

// Versus and Together arenas: furniture as fractions of the room, carriers spread round the walls.
const ARENAS = {
  loft: { name: 'The Loft', floor: 'oak', wall: 'sage', items: [
    { k: 'sofa', fx: 0.5, fz: 0.5, r: 0, c: 'teal' }, { k: 'rug', fx: 0.5, fz: 0.62, w: 5, d: 3, c: 'mustard' },
    { k: 'coffee', fx: 0.5, fz: 0.62 }, { k: 'table', fx: 0.25, fz: 0.3 }, { k: 'cattree', fx: 0.78, fz: 0.3 },
    { k: 'bookshelf', fx: 0.3, fz: 0.0, r: 0 }, { k: 'plant', fx: 0.0, fz: 0.0 }, { k: 'armchair', fx: 0.25, fz: 0.75, r: 3, c: 'blush' },
    { k: 'box', fx: 0.75, fz: 0.75 }, { k: 'sideboard', fx: 0.72, fz: 0.0 }, { k: 'plant', fx: 1, fz: 0 },
  ] },
  gardenparty: { name: 'Garden Party', floor: 'grass', wall: 'brick', items: [
    { k: 'pond', fx: 0.5, fz: 0.5, w: 4, d: 3 }, { k: 'hedge', fx: 0.25, fz: 0.32 }, { k: 'hedge', fx: 0.75, fz: 0.7 },
    { k: 'table', fx: 0.73, fz: 0.3 }, { k: 'bench', fx: 0.27, fz: 0.72 }, { k: 'flowerbed', fx: 0.3, fz: 0.0, w: 3 },
    { k: 'shed', fx: 1.0, fz: 0.0 }, { k: 'plant', fx: 0, fz: 0 },
  ] },
  grandcafe: { name: 'Grand Café', floor: 'tile', wall: 'sage', items: [
    { k: 'cafetable', fx: 0.3, fz: 0.3 }, { k: 'cafetable', fx: 0.5, fz: 0.42 }, { k: 'cafetable', fx: 0.7, fz: 0.3 },
    { k: 'cafetable', fx: 0.3, fz: 0.7 }, { k: 'cafetable', fx: 0.5, fz: 0.58 }, { k: 'cafetable', fx: 0.7, fz: 0.7 },
    { k: 'cattree', fx: 0.15, fz: 0.5 }, { k: 'cattree', fx: 0.85, fz: 0.5 }, { k: 'counter', fx: 0.36, fz: 0.0 },
    { k: 'sideboard', fx: 0.64, fz: 0.0 }, { k: 'rug', fx: 0.5, fz: 0.5, w: 4, d: 2, c: 'teal' }, { k: 'plant', fx: 0, fz: 0 },
  ] },
  readingroom: { name: 'Reading Room', floor: 'carpet', wall: 'burgundy', items: [
    { k: 'shelfrow', fx: 0.3, fz: 0.35 }, { k: 'shelfrow', fx: 0.7, fz: 0.35 }, { k: 'shelfrow', fx: 0.3, fz: 0.65 },
    { k: 'shelfrow', fx: 0.7, fz: 0.65 }, { k: 'table', fx: 0.5, fz: 0.5 }, { k: 'armchair', fx: 0.5, fz: 0.2, r: 2, c: 'mustard' },
    { k: 'bookshelf', fx: 0.2, fz: 0.0 }, { k: 'bookshelf', fx: 0.8, fz: 0.0 }, { k: 'rug', fx: 0.5, fz: 0.8, w: 5, d: 2.2, c: 'teal' },
    { k: 'plant', fx: 0, fz: 0 },
  ] },
};
export const ARENA_IDS = Object.keys(ARENAS);

const DIR = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
export const dirVec = (dir) => DIR[dir] ?? DIR.e;

function carrierSpots(w, d, n) {
  const m = 0.65;
  const four = [
    { x: w / 2, z: m, dir: 's' }, { x: m, z: d / 2, dir: 'e' }, { x: w / 2, z: d - m, dir: 'n' }, { x: w - m, z: d / 2, dir: 'w' },
  ];
  const six = [
    { x: w * 0.3, z: m, dir: 's' }, { x: w * 0.7, z: m, dir: 's' }, { x: m, z: d / 2, dir: 'e' },
    { x: w * 0.7, z: d - m, dir: 'n' }, { x: w * 0.3, z: d - m, dir: 'n' }, { x: w - m, z: d / 2, dir: 'w' },
  ];
  if (n <= 4) return four.slice(0, Math.max(1, n));
  if (n === 5) return [six[0], six[1], six[2], six[3], six[5]].map((s, i) => (i === 3 ? { x: w / 2, z: d - m, dir: 'n' } : s));
  return six.slice(0, 6);
}

/** A versus/together room for `seats` carriers (together: 1 carrier, sized by seats). */
export function arena(id, seats, together = false) {
  const a = ARENAS[id] ?? ARENAS.loft;
  const big = seats >= 5;
  const w = big ? 30 : 24;
  const d = big ? 24 : 20;
  const carriers = together ? [{ x: 0.65, z: d / 2, dir: 'e' }] : carrierSpots(w, d, seats);
  const items = [];
  for (const it of a.items) {
    const fp = footprint(it);
    if (!fp) continue;
    const x = Math.min(w - fp.w / 2 - 0.05, Math.max(fp.w / 2 + 0.05, it.fx * w));
    const z = Math.min(d - fp.d / 2 - 0.05, Math.max(fp.d / 2 + 0.05, it.fz * d));
    const item = { ...it, x, z };
    delete item.fx;
    delete item.fz;
    const clear = carriers.every((c) => {
      const dx = Math.max(0, Math.abs(c.x - x) - fp.w / 2);
      const dz = Math.max(0, Math.abs(c.z - z) - fp.d / 2);
      return Math.hypot(dx, dz) > 3.2;
    });
    if (clear || KIT[it.k].flat) items.push(item);
  }
  const [nx, nz] = dirVec(carriers[0].dir);
  const entry = { x: carriers[0].x + nx * 3, z: carriers[0].z + nz * 3 };
  return { id: `${id}-${seats}${together ? 't' : ''}`, arena: id, name: a.name, w, d, floor: a.floor, wall: a.wall, items, carriers, entry };
}

export function getRoom(id) {
  return ROOMS[id] ?? null;
}
