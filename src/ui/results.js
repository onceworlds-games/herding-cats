// The results of a solo run, told in order: the verdict stamped on, the time, the three stars lighting one by one, the
// XP counting into the herder's bar (and a level-up with what it brings), new faces for the Cat-alog, goals ticked.
// A tap anywhere on it skips to the end. main.js gives the data and the buttons.

import { el, esc, button } from './ui.js';
import { icon, challengeIcon } from './icons.js';
import { itemPicture, catPicture } from './screens.js';
import { CHALLENGES } from '../meta/challenges.js';
import { STAR } from '../meta/progress.js';
import { levelOf } from '../meta/herder.js';
import { COAT_INFO } from '../sim/coats.js';
import { TYPE_NAMES } from '../meta/catalog.js';

/**
 * o: { title, good (bool), sub, big: { label, value }, lines: [[label, value]], stars: { mask, had, challenge, parText } | null,
 *      rosette, newRosette, newBest, report, actions: [button], onWear(item), sfx, reduced, tops: element | null }
 */
export function resultPanel(o) {
  const root = el('div', `results live${o.good ? ' good' : ' bad'}`);

  const head = el('div', 'rh');
  head.innerHTML = `<div class="sub"></div><h2></h2>`;
  head.querySelector('.sub').textContent = o.sub ?? '';
  head.querySelector('h2').textContent = o.title;
  root.appendChild(head);

  const big = el('div', 'big');
  big.innerHTML = `<span class="l"></span><span class="v num"></span>${o.newBest ? '<span class="nb">New best</span>' : ''}`;
  big.querySelector('.l').textContent = o.big.label;
  big.querySelector('.v').textContent = o.big.value;
  root.appendChild(big);
  for (const [l, v] of o.lines ?? []) {
    const row = el('div', 'line');
    row.innerHTML = '<span></span><span class="num"></span>';
    row.children[0].textContent = l;
    row.children[1].textContent = v;
    root.appendChild(row);
  }

  // the three stars
  let starEls = [];
  if (o.stars) {
    const ch = CHALLENGES[o.stars.challenge];
    const row = el('div', 'stars3');
    const defs = [
      { bit: STAR.allIn, pic: (f) => icon('carrier', { fill: f, size: 40 }), label: 'All in' },
      { bit: STAR.par, pic: (f) => icon('clockface', { fill: f, size: 40 }), label: o.stars.parText },
      { bit: STAR.challenge, pic: (f) => challengeIcon(ch?.icon, { fill: f, size: 40 }), label: ch?.label ?? '' },
    ];
    starEls = defs.map((d) => {
      const got = (o.stars.mask & d.bit) !== 0;
      const had = (o.stars.had & d.bit) !== 0;
      const s = el('div', `st${had && !got ? ' had' : ''}`);
      s.innerHTML = `<span class="sock">${d.pic(had && !got ? '#b89a5a' : '#6b5550')}</span><span class="sl"></span>`;
      s.querySelector('.sl').textContent = d.label;
      row.appendChild(s);
      return { s, d, got, isNew: got && !had };
    });
    root.appendChild(row);
    if (o.rosette) {
      const r = el('div', `rosette${o.newRosette ? ' new' : ''}`);
      r.innerHTML = `${icon('xp', { fill: '#f6b941', size: 26 })}<span>Expert time</span>`;
      root.appendChild(r);
    }
  }

  // XP into the bar
  const rep = o.report;
  let xpBox = null;
  if (rep) {
    xpBox = el('div', 'xp');
    xpBox.innerHTML = `<div class="xh"><span class="lvb">${icon('xp', { fill: '#f6b941', size: 34 })}<b class="num">${rep.before.level}</b></span><span class="bar"><i></i></span><span class="gain num">+0</span></div><div class="xl"></div><div class="extra"></div>`;
    root.appendChild(xpBox);
    const bar = xpBox.querySelector('.bar i');
    bar.style.width = `${rep.before.next ? (rep.before.into / rep.before.next) * 100 : 100}%`;
  }
  if (o.tops) root.appendChild(o.tops);
  const acts = el('div', 'acts');
  for (const b of o.actions ?? []) acts.appendChild(b);
  root.appendChild(acts);

  // ---------------------------------------------------------------- the telling: steps on a clock; a tap runs the rest at once
  const sfx = o.sfx;
  const steps = [];
  let quiet = false;
  const at = (ms, f) => steps.push({ t: ms, f, done: false });
  const play = (name, ...a) => { if (!quiet) sfx?.[name]?.(...a); };
  at(0, () => { head.classList.add('in'); play('stamp'); });
  at(260, () => big.classList.add('in'));
  let t = 520;
  starEls.forEach((e, i) => {
    if (!e.got) return;
    at(t, () => {
      e.s.classList.add('on');
      if (e.isNew) e.s.classList.add('new');
      e.s.querySelector('.sock').innerHTML = e.d.pic('#f6b941');
      play('star', i);
    });
    t += 300;
  });
  if (rep) {
    const xl = xpBox.querySelector('.xl');
    const gain = xpBox.querySelector('.gain');
    const bar = xpBox.querySelector('.bar i');
    const lvb = xpBox.querySelector('.lvb b');
    let sum = 0;
    t += 120;
    for (const x of rep.xp) {
      at(t, () => {
        const row = el('div', 'xr');
        row.innerHTML = '<span></span><span class="num"></span>';
        row.children[0].textContent = x.label;
        row.children[1].textContent = `+${x.n}`;
        xl.appendChild(row);
        sum += x.n;
        gain.textContent = `+${sum}`;
        // the bar follows the running total, across level-ups
        const now = levelOf(rep.after.total - rep.xpGained + sum);
        lvb.textContent = String(now.level);
        bar.style.width = `${now.next ? (now.into / now.next) * 100 : 100}%`;
        play('coin', xl.children.length);
      });
      t += 140;
    }
    if (rep.after.level > rep.before.level) {
      at(t, () => {
        xpBox.classList.add('up');
        xpBox.querySelector('.xh').appendChild(el('div', 'levelup', `<span>Level ${rep.after.level}</span>`));
        play('fanfare');
      });
      t += 380;
    }
    const extra = xpBox.querySelector('.extra');
    for (const it of rep.unlocks ?? []) {
      at(t, () => {
        const u = el('div', 'unlock');
        u.innerHTML = `${itemPicture(it, 64)}<span class="ut"><span class="k">New to wear</span><b></b></span>`;
        u.querySelector('b').textContent = it.id === 'hat:none' ? 'Your own' : it.name;
        if (o.onWear) {
          const w = button('Wear', { cls: 'gold small', onClick: () => { o.onWear(it); w.disabled = true; w.querySelector('span').textContent = 'On'; } });
          u.appendChild(w);
        }
        extra.appendChild(u);
        play('unlockItem');
      });
      t += 260;
    }
    const faces = [...(rep.book?.newTypes ?? []).map((id) => ['type', id]), ...(rep.book?.newCoats ?? []).map((id) => ['coat', id])];
    if (faces.length) {
      at(t, () => {
        const f = el('div', 'newcats');
        f.innerHTML = `<span class="k">New in the Cat-alog</span><span class="row">${faces.slice(0, 6).map(([k, id]) => `<span class="nf${k === 'coat' && COAT_INFO[id].rarity > 1 ? ' rare' : ''}">${catPicture(k, id, 54)}<span class="fn">${esc(k === 'type' ? TYPE_NAMES[id] : COAT_INFO[id].name)}</span></span>`).join('')}</span>`;
        extra.appendChild(f);
        play(faces.some(([k, id]) => k === 'coat' && COAT_INFO[id].rarity > 1) ? 'rare' : 'page');
      });
      t += 300;
    }
    if (rep.book?.pages?.length) {
      at(t, () => {
        const f = el('div', 'pagedone');
        f.innerHTML = `${icon('catalog', { fill: '#f6b941', size: 26 })}<span>Cat-alog page complete</span>`;
        extra.appendChild(f);
        play('pageDone');
      });
    }
  }
  const timers = [];
  const run = (st) => { if (st.done) return; st.done = true; st.f(); };
  function finish() {
    quiet = true;
    for (const id of timers.splice(0)) clearTimeout(id);
    for (const st of steps) run(st);
  }
  if (o.reduced) finish();
  else for (const st of steps) timers.push(setTimeout(() => run(st), st.t));
  root.addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) finish(); });
  return { root, finish };
}
