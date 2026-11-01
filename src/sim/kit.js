// The furniture kit: footprint (w along x, d along z at rotation 0), height, and what cats can do with it.
// perch: the height a cat sits at on top (it can hop up); hide: a Scaredy can get under it; tall: dithers out when it hides
// something from the camera; props: how many knockable things stand on top; flat: no collision (rugs).

export const KIT = {
  rug: { w: 3, d: 2, h: 0.02, flat: true },
  sofa: { w: 2.6, d: 1.0, h: 0.85, perch: 0.5, hide: true },
  armchair: { w: 1.1, d: 1.0, h: 0.85, perch: 0.5 },
  bed: { w: 2.2, d: 3.0, h: 0.62, perch: 0.62, hide: true },
  coffee: { w: 1.4, d: 0.8, h: 0.45, perch: 0.45, props: 2 },
  table: { w: 1.6, d: 1.0, h: 0.76, perch: 0.76, props: 2, hide: true },
  cafetable: { w: 0.9, d: 0.9, h: 0.76, perch: 0.76, props: 1 },
  chair: { w: 0.55, d: 0.55, h: 0.95 },
  sideboard: { w: 1.8, d: 0.55, h: 0.95, perch: 0.95, props: 2 },
  tvunit: { w: 1.8, d: 0.5, h: 0.6, perch: 0.6, props: 1 },
  bookshelf: { w: 1.8, d: 0.5, h: 2.1, tall: true },
  shelfrow: { w: 3.0, d: 0.6, h: 2.0, tall: true },
  wardrobe: { w: 1.8, d: 0.7, h: 2.2, tall: true },
  fridge: { w: 0.9, d: 0.8, h: 2.0, tall: true },
  counter: { w: 2.0, d: 0.7, h: 0.95, perch: 0.95, props: 2 },
  plant: { w: 0.7, d: 0.7, h: 1.3 },
  lamp: { w: 0.5, d: 0.5, h: 1.6 },
  desk: { w: 1.4, d: 0.7, h: 0.76, perch: 0.76, props: 2 },
  box: { w: 0.8, d: 0.8, h: 0.6, perch: 0.42, open: true },
  boxstack: { w: 0.9, d: 0.9, h: 1.3 },
  basket: { w: 0.7, d: 0.7, h: 0.45, perch: 0.3, open: true },
  washer: { w: 0.8, d: 0.8, h: 0.9, perch: 0.9 },
  cattree: { w: 0.9, d: 0.9, h: 1.6, perch: 1.55 },
  bench: { w: 1.8, d: 0.6, h: 0.5, perch: 0.5, hide: true },
  hedge: { w: 3.0, d: 0.8, h: 1.0 },
  pond: { w: 3.0, d: 2.0, h: 0.05, water: true },
  shed: { w: 2.2, d: 1.8, h: 2.2, tall: true },
  flowerbed: { w: 2.5, d: 0.9, h: 0.3 },
  rail: { w: 1, d: 0.16, h: 0.9 },
  lifeboat: { w: 2.6, d: 1.2, h: 0.8, perch: 0.8, hide: true },
  rope: { w: 0.8, d: 0.8, h: 0.35, perch: 0.35 },
  deckchair: { w: 0.7, d: 1.4, h: 0.6, perch: 0.45 },
  planttable: { w: 2.4, d: 0.8, h: 0.8, perch: 0.8, props: 3, hide: true },
  chimney: { w: 0.9, d: 0.9, h: 1.4 },
  skylight: { w: 1.6, d: 1.2, h: 0.35 },
  wall: { w: 1, d: 0.2, h: 2.4, tall: true },
  counterdesk: { w: 2.6, d: 0.8, h: 1.05 },
  waitbench: { w: 4.2, d: 0.7, h: 0.5 },
};

export function footprint(item) {
  const k = KIT[item.k];
  if (!k) return null;
  const w = item.w ?? k.w;
  const d = item.d ?? k.d;
  const odd = (item.r ?? 0) % 2 === 1;
  return { w: odd ? d : w, d: odd ? w : d };
}
