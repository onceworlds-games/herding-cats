// The Cat-alog: every personality and coat you've boxed, in pages. A page filled in brings something to wear.

import { COAT_IDS, COAT_INFO, RARITY } from '../sim/coats.js';
import { TYPE_LIST } from '../sim/tuning.js';

export const TYPE_NAMES = {
  moggy: 'Moggy', loaf: 'Loaf', zoomer: 'Zoomer', scaredy: 'Scaredy', glutton: 'Glutton', kitten: 'Kitten', boss: 'Boss',
};

export const PAGES = [
  { id: 'types', name: 'Personalities', kind: 'type', entries: TYPE_LIST, reward: 'hat:ears' },
  { id: 'common', name: 'House Cats', kind: 'coat', entries: COAT_IDS.filter((c) => COAT_INFO[c].rarity === 0), reward: 'carrier:calico' },
  { id: 'fancy', name: 'Fancy Coats', kind: 'coat', entries: COAT_IDS.filter((c) => COAT_INFO[c].rarity === 1), reward: 'trail:rainbow' },
  { id: 'rare', name: 'Rare & Lucky', kind: 'coat', entries: COAT_IDS.filter((c) => COAT_INFO[c].rarity >= 2), reward: 'carrier:gold' },
];

export const entryName = (page, e) => (page.kind === 'type' ? TYPE_NAMES[e] : COAT_INFO[e]?.name) ?? e;
export const rarityOf = (coat) => RARITY[COAT_INFO[coat]?.rarity ?? 0];

/** How full a page is: { have, of, done }. book: { coats: { id: n }, types: { id: n } }. */
export function pageState(page, book) {
  const have = page.entries.filter((e) => (page.kind === 'type' ? book.types?.[e] : book.coats?.[e]) > 0).length;
  return { have, of: page.entries.length, done: have === page.entries.length };
}

/**
 * Cats into the book: [{ type, coat }]. Returns { newCoats: [ids], newTypes: [ids], pages: [page ids just completed] }.
 * Mutates book.
 */
export function addToBook(book, cats) {
  const before = PAGES.map((p) => pageState(p, book).done);
  const newCoats = [];
  const newTypes = [];
  for (const c of cats) {
    if (COAT_INFO[c.coat]) {
      if (!book.coats[c.coat]) newCoats.push(c.coat);
      book.coats[c.coat] = Math.min(1e6, (book.coats[c.coat] ?? 0) + 1);
    }
    if (TYPE_NAMES[c.type]) {
      if (!book.types[c.type]) newTypes.push(c.type);
      book.types[c.type] = Math.min(1e6, (book.types[c.type] ?? 0) + 1);
    }
  }
  const pages = PAGES.filter((p, i) => !before[i] && pageState(p, book).done).map((p) => p.id);
  return { newCoats: [...new Set(newCoats)], newTypes: [...new Set(newTypes)], pages };
}
