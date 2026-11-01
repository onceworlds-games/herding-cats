// Every coat a cat can have: the names the Cat-alog shows and how often each turns up.

export const RARITY = ['common', 'uncommon', 'rare', 'legendary'];

export const COAT_INFO = {
  ginger: { name: 'Ginger Tabby', rarity: 0 },
  grey: { name: 'Grey Tabby', rarity: 0 },
  tuxedo: { name: 'Tuxedo', rarity: 0 },
  calico: { name: 'Calico', rarity: 0 },
  black: { name: 'Black', rarity: 0 },
  white: { name: 'White', rarity: 0 },
  tortie: { name: 'Tortoiseshell', rarity: 0 },
  siamese: { name: 'Siamese', rarity: 0 },
  silver: { name: 'Silver Tabby', rarity: 1 },
  cream: { name: 'Cream', rarity: 1 },
  bicolor: { name: 'Ginger & White', rarity: 1 },
  blue: { name: 'Russian Blue', rarity: 1 },
  cow: { name: 'Cow Print', rarity: 1 },
  smoke: { name: 'Smoke', rarity: 1 },
  panda: { name: 'Panda', rarity: 2 },
  bengal: { name: 'Bengal', rarity: 2 },
  lilac: { name: 'Lilac Point', rarity: 2 },
  midnight: { name: 'Midnight', rarity: 2 },
  lucky: { name: 'Lucky Gold', rarity: 3 },
};

export const COAT_IDS = Object.keys(COAT_INFO);
export const COMMON = COAT_IDS.filter((c) => COAT_INFO[c].rarity === 0);
const BY_RARITY = RARITY.map((_, r) => COAT_IDS.filter((c) => COAT_INFO[c].rarity === r));

// chance a cat wears a coat above common: uncommon 1 in 7, rare 1 in 30, legendary 1 in 150
const ODDS = [0, 1 / 7, 1 / 30, 1 / 150];

/** A coat for a cat from a seeded rng: `wanted` (a level's pick) unless the dice turn up something rarer. */
export function rollCoat(rng, wanted = null) {
  const x = rng.next();
  let acc = 0;
  for (let r = 3; r >= 1; r--) {
    acc += ODDS[r];
    if (x < acc) return rng.pick(BY_RARITY[r]);
  }
  return wanted && COAT_INFO[wanted] ? wanted : rng.pick(COMMON);
}
