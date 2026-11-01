// What the rendered picture sheets hold, in order (sheets.js draws them; the screens find a picture by its place here).

import { TYPE_LIST } from '../sim/tuning.js';
import { COAT_IDS } from '../sim/coats.js';
import { byKind } from '../meta/herder.js';

export const CELL = 192;
export const SHEET_COLS = 8;
export const SHEETS = {
  cats: [...TYPE_LIST.map((t) => ({ kind: 'type', id: t })), ...COAT_IDS.map((c) => ({ kind: 'coat', id: c }))],
  wear: [...byKind('hat').filter((it) => it.look).map((it) => ({ kind: 'hat', id: it.id })), ...byKind('carrier').map((it) => ({ kind: 'carrier', id: it.id }))],
};
export const sheetIndex = (set, kind, id) => SHEETS[set].findIndex((e) => e.kind === kind && e.id === id);
