// ekwipunek.js — panel Ekwipunek: paper doll (jak w Piłeczce, układ D2: hełm, zbroja, broń, tarcza, rękawice, buty,
// pas) i skrzynia 4×4. Klik w przedmiot = statystyki pod jego rzędem (itemBox z karta.js) + dymki przy rogach: ✓ Załóż albo ↓ Zdejmij, ✗ Zniszcz.
// Wygląd przedmiotu z Piłeczki (d2jsp-licznik/docs/gra.js, itemEl): awatar użytej piłeczki + ikona typu w kolorze rzadkości.
// Stan i akcje: inventory.js (serwer). Tu tylko DOM.
import { RARITY, TYPES, SLOT_ORDER, slotType, itemName, statSummary } from './items.js?v=53';
import { activeItems, freeCells } from './skrzynia.js?v=53';
import { itemBox } from './karta.js?v=53';

export const EKW_CSS = `
.lt-doll{position:relative;width:300px;height:258px;margin:22px auto 0}
.lt-eqs{position:absolute;box-sizing:border-box;background:#0d0d0c;border:2px solid #4a463f;box-shadow:inset 0 0 0 2px #000,inset 0 0 18px rgba(0,0,0,.9);display:grid;place-items:center;cursor:pointer;padding:0;-webkit-tap-highlight-color:transparent}
.lt-eqs.empty::after{content:attr(data-l);color:#5a564f;font:11px Georgia,serif;letter-spacing:.06em}
.lt-eqs.q-m{border-color:#4a5fb8;box-shadow:inset 0 0 0 2px #000,inset 0 0 22px rgba(80,110,255,.25)}
.lt-eqs.q-r{border-color:#b89a2c;box-shadow:inset 0 0 0 2px #000,inset 0 0 22px rgba(242,210,75,.22)}
.lt-eqs.q-u{border-color:#a8692f;box-shadow:inset 0 0 0 2px #000,inset 0 0 22px rgba(199,134,74,.28)}
.lt-eqs.sel{outline:2px solid #fbbf24;outline-offset:1px}
.lt-eqit{position:relative;width:62px;height:62px;pointer-events:none}
.lt-eqit .lt-eqav{position:absolute;inset:8%;border-radius:50%;background:#222 center/cover;border:3px solid #c8c8c8;display:grid;place-items:center;font:800 16px system-ui,sans-serif;color:#ecebe6;box-sizing:border-box}
.lt-eqit.q-m .lt-eqav{border-color:#6c8cff;box-shadow:0 0 10px rgba(108,140,255,.6)}
.lt-eqit.q-r .lt-eqav{border-color:#f2d24b;box-shadow:0 0 12px rgba(242,210,75,.7)}
.lt-eqit.q-u .lt-eqav{border-color:#c7864a;box-shadow:0 0 12px rgba(199,134,74,.7)}
.lt-eqit svg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible}
.lt-chest-head{display:flex;justify-content:space-between;width:300px;margin:12px auto 4px;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em}
.lt-chest-head b{color:#e2e8f0}
.lt-chest-head b.full{color:#fca5a5}
.lt-chest{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;width:300px;margin:0 auto}
.lt-chest .lt-eqs{position:relative;aspect-ratio:1}
.lt-chest .lt-eqit{width:58px;height:58px}
.lt-eqd{position:relative;margin:10px auto 0;width:300px;max-width:100%}
.lt-eqd .lt-item{margin-top:0}
.lt-chest .lt-eqd{grid-column:1/-1;width:auto;margin:4px 0 6px}
.lt-eqd.lt-eqd-at{margin-top:12px}
.lt-chest .lt-eqd.lt-eqd-at{margin-top:8px}
.lt-eqd.lt-eqd-at::before{content:"";position:absolute;top:-8px;left:var(--ax,50%);margin-left:-8px;border:8px solid transparent;border-top:0;border-bottom-color:#fbbf24;z-index:1}
.lt-eqd-empty{font-size:11px;color:#64748b;text-align:center;padding:6px 0}
.lt-eqs.sel{z-index:3}
.lt-eqb{position:absolute;top:-22px;min-width:30px;height:30px;box-sizing:border-box;border-radius:15px;border:2px solid;display:grid;place-items:center;padding:0 6px;font:900 15px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.7);-webkit-tap-highlight-color:transparent;white-space:nowrap}
.lt-eqb.on,.lt-eqb.off{left:-22px;background:#15803d;border-color:#4ade80;color:#f0fdf4}
.lt-eqb.off{background:#334155;border-color:#94a3b8}
.lt-eqb.del{right:-22px;background:#7f1d1d;border-color:#f87171;color:#fef2f2}
.lt-eqb.del.ask{background:#dc2626;font-size:11px}
.lt-eqb:disabled{opacity:.4;cursor:default}
.lt-eqmsg{font-size:11px;color:#fca5a5;text-align:center;margin-top:6px}
.lt-eqmsg.ok{color:#86efac}
.lt-eqmsg:empty{display:none}
`;

// Pozycje na postaci (left, top, szerokość, wysokość), 3 kolumny po 92 px.
const POS = {
  helm: [104, 0, 92, 76], weapon: [0, 30, 92, 140], armor: [104, 86, 92, 120], shield: [208, 30, 92, 140],
  gloves: [0, 180, 92, 76], belt: [104, 216, 92, 42], boots: [208, 180, 92, 76]
};
const EMPTY = { helm: 'hełm', armor: 'zbroja', weapon: 'broń', shield: 'tarcza', gloves: 'rękawice', boots: 'buty', belt: 'pas' };

// Ikony typów (viewBox 78), helm/armor/gloves/boots z Piłeczki; broń (proca), tarcza i pierścień nowe.
const ICON = {
  helm: '<path d="M8 38 C8 12 70 12 70 38 L70 34 C64 30 14 30 8 34Z" fill="currentColor"/><path d="M6 36 C6 8 72 8 72 36 L64 36 C62 18 16 18 14 36Z" fill="currentColor"/><rect x="36" y="14" width="6" height="30" rx="2" fill="currentColor"/>',
  armor: '<path d="M2 30 Q10 20 20 26 L20 40 Q8 42 2 30Z M76 30 Q68 20 58 26 L58 40 Q70 42 76 30Z" fill="currentColor"/><path d="M14 50 Q39 66 64 50 L62 76 L16 76Z" fill="currentColor"/><path d="M26 58 L39 72 L52 58" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="2"/>',
  gloves: '<g fill="currentColor"><path d="M0 44 q0-10 6-12 l1-10 q2-3 4 0 l1 8 1-10 q2-3 4 0 l0 10 1-8 q2-3 4 0 l0 12 q2 10-6 18 l-12 0z"/><path d="M78 44 q0-10-6-12 l-1-10 q-2-3-4 0 l-1 8-1-10 q-2-3-4 0 l0 10-1-8 q-2-3-4 0 l0 12 q-2 10 6 18 l12 0z"/></g>',
  boots: '<g fill="currentColor"><path d="M14 56 h14 v10 q0 4 4 5 l4 1 v5 h-24 q-2 0-2-3z"/><path d="M50 56 h14 v19 q0 3-2 3 h-24 v-5 l4-1 q4-1 4-5z"/></g>',
  weapon: '<path d="M2 40 L11 56 L20 40" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><rect x="8.5" y="54" width="5" height="22" rx="2" fill="currentColor"/>',
  shield: '<path d="M56 42 h20 v14 q0 14-10 21 q-10-7-10-21z" fill="currentColor"/><path d="M66 46 v26" stroke="#000" stroke-opacity=".35" stroke-width="2"/>',
  belt: '<rect x="14" y="64" width="50" height="9" rx="2" fill="currentColor"/><rect x="33" y="61" width="12" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="3"/>'
};

// opts: { inv (inventory.js), el, avatars() → D.avatars strony, body (kontener panelu) }.
export function createEkwipunek(opts) {
  const inv = opts.inv, el = opts.el, body = opts.body;
  let sel = null;                              // { at: 'slot'|'chest', key }
  let msg = '', msgOk = false;
  let ask = '';                                // id przedmiotu czekającego na potwierdzenie zniszczenia

  function itemEl(it) {
    const box = el('div', 'lt-eqit q-' + it.rarity);
    const av = el('div', 'lt-eqav');
    const url = it.ball && it.ball.uid ? (opts.avatars() || {})[it.ball.uid] : '';
    if (url) av.style.backgroundImage = 'url("' + String(url).replace(/"/g, '%22') + '")';
    else av.textContent = ((it.ball && it.ball.nick) || '?').charAt(0).toUpperCase();
    box.appendChild(av);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 78 78');
    svg.style.color = (RARITY[it.rarity] || RARITY.m).color;
    svg.innerHTML = ICON[it.type] || '';
    box.appendChild(svg);
    return box;
  }

  // Kratka to div z role=button (dymki ✓/✗ to przyciski w środku, a przycisk w przycisku jest niedozwolony).
  function cell(it, cls, label, onClick, isSel, at) {
    const b = el('div', 'lt-eqs ' + (it ? 'q-' + it.rarity : 'empty') + (isSel ? ' sel' : '') + (cls ? ' ' + cls : ''));
    b.setAttribute('role', 'button');
    b.tabIndex = 0;
    if (label) b.setAttribute('data-l', label);
    b.setAttribute('aria-label', it ? itemName(it) : 'puste: ' + (label || 'kratka'));
    if (it) b.appendChild(itemEl(it));
    if (it && isSel) bubbles(b, it, at);
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); onClick(); });
    b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } });
    return b;
  }

  // Dymki przy rogach zaznaczonego przedmiotu: lewy ✓ Załóż (ze skrzyni) albo ↓ Zdejmij (z postaci), prawy ✗ Zniszcz
  // (pierwsze dotknięcie pyta „Na pewno?”). Pierścień przy dwóch zajętych miejscach zastępuje 1. pierścień.
  function bubbles(box, it, at) {
    if (opts.readOnly) return;                     // podgląd cudzego ekwipunku (ranking): bez akcji
    const sure = ask === it.id;                    // przy „Na pewno?” lewy dymek znika (szeroki dymek by na niego wjechał)
    if (!sure && at === 'chest') box.appendChild(btn('✓', 'lt-eqb on', 'Załóż', function () { run('equip', it); }));
    if (!sure && at === 'slot') box.appendChild(btn('↓', 'lt-eqb off', 'Zdejmij do skrzyni', function () { run('unequip', it); }, freeCells(inv.doc()) === 0));
    box.appendChild(btn(sure ? 'Na pewno?' : '✗', 'lt-eqb del' + (sure ? ' ask' : ''), 'Zniszcz', function () {
      if (sure) { run('destroy', it); return; }
      ask = it.id;
      render();
    }));
  }

  function pick(at, key) {
    sel = sel && sel.at === at && sel.key === key ? null : { at: at, key: key };
    ask = '';
    msg = '';
    render();
    // Rozwinięte statystyki w kadrze panelu (telefon: dół skrzyni bywa poza ekranem).
    const d = sel && body.querySelector('.lt-eqd-at');
    if (d && d.scrollIntoView) d.scrollIntoView({ block: 'nearest' });
  }

  function selected(doc) {
    if (!sel) return null;
    return sel.at === 'slot' ? doc.slots[sel.key] : doc.chest[sel.key];
  }

  function run(action, it, to) {
    msg = '';
    ask = '';
    inv.act(action, it.id, to).then(function (r) {
      if (r.error) { msg = r.error; msgOk = false; }
      else {
        msgOk = true;
        msg = action === 'destroy' ? 'Zniszczono: ' + itemName(it) : (action === 'unequip' ? 'Zdjęto: ' + itemName(it) : 'Założono: ' + itemName(it));
        sel = null;
      }
      render();
    });
  }

  function btn(text, cls, title, fn, disabled) {
    const b = el('button', cls, text);
    b.type = 'button';
    b.title = title;
    b.setAttribute('aria-label', title);
    b.disabled = !!disabled;
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); fn(); });
    return b;
  }

  // Statystyki rozwijane zaraz pod rzędem klikniętego przedmiotu (skrzynia: wiersz siatki na całą szerokość,
  // postać: pod postacią), strzałka nad ramką wskazuje kolumnę klikniętej kratki. Bez zaznaczenia: podpowiedź pod postacią.
  function details(doc) {
    const box = el('div', 'lt-eqd' + (sel ? ' lt-eqd-at' : ''));
    if (sel) {
      const p = POS[sel.key];
      const ax = sel.at === 'slot' && p ? (p[0] + p[2] / 2) / 300 : ((sel.key % 4) + 0.5) / 4;
      box.style.setProperty('--ax', (ax * 100).toFixed(1) + '%');
    }
    const it = selected(doc);
    if (!it) {
      box.appendChild(el('div', 'lt-eqd-empty', sel && sel.at === 'slot'
        ? 'Puste miejsce: ' + TYPES[slotType(sel.key)].label.toLowerCase() + (opts.readOnly ? '.' : '. Załóż coś ze skrzyni.')
        : 'Kliknij przedmiot, żeby zobaczyć statystyki.'));
      return box;
    }
    box.appendChild(itemBox(it));
    if (sel.at === 'slot' && freeCells(doc) === 0) box.appendChild(el('div', 'lt-eqmsg', 'Skrzynia pełna, nie ma gdzie zdjąć.'));
    return box;
  }

  function render() {
    const doc = inv.doc();
    body.replaceChildren();
    const doll = el('div', 'lt-doll');
    for (let i = 0; i < SLOT_ORDER.length; i++) {
      const s = SLOT_ORDER[i], p = POS[s];
      const c = cell(doc.slots[s], '', EMPTY[s], function () { pick('slot', s); }, sel && sel.at === 'slot' && sel.key === s, 'slot');
      c.style.cssText = 'left:' + p[0] + 'px;top:' + p[1] + 'px;width:' + p[2] + 'px;height:' + p[3] + 'px';
      if (s === 'belt') {
        const ie = c.querySelector('.lt-eqit');
        if (ie) { ie.style.width = '38px'; ie.style.height = '38px'; }
      }
      doll.appendChild(c);
    }
    body.appendChild(doll);
    if (!sel || sel.at === 'slot') body.appendChild(details(doc));
    if (opts.readOnly) {
      const sums = statSummary(activeItems(doc));
      body.appendChild(el('div', 'lt-inv-mods', sums.length ? sums.map(function (l) { return l.text; }).join(' · ') : 'Bez przedmiotów.'));
      return;
    }
    const free = freeCells(doc), size = doc.chest.length;
    const head = el('div', 'lt-chest-head');
    head.appendChild(el('span', null, 'Skrzynia'));
    head.appendChild(el('b', free ? '' : 'full', (size - free) + '/' + size));
    body.appendChild(head);
    const grid = el('div', 'lt-chest');
    const rowEnd = sel && sel.at === 'chest' ? Math.min(size - 1, sel.key - sel.key % 4 + 3) : -1;
    for (let i = 0; i < size; i++) {
      grid.appendChild(cell(doc.chest[i], '', '', (function (k) { return function () { pick('chest', k); }; })(i), sel && sel.at === 'chest' && sel.key === i, 'chest'));
      if (i === rowEnd) grid.appendChild(details(doc));
    }
    body.appendChild(grid);
    const m = el('div', 'lt-eqmsg' + (msgOk ? ' ok' : ''), msg || inv.note());
    body.appendChild(m);
    const sums = statSummary(activeItems(doc));
    body.appendChild(el('div', 'lt-inv-mods', sums.length
      ? sums.map(function (l) { return l.text; }).join(' · ')
      : 'Bez przedmiotów: zwykła piłeczka.'));
  }

  return {
    render: render,
    // Otwarcie panelu: najpierw stan z pamięci, potem świeży z serwera.
    open: function () {
      sel = null; msg = ''; ask = '';
      render();
      inv.load().then(function (r) {
        if (r && r.error) { msg = r.error; msgOk = false; }
        render();
      });
    }
  };
}
