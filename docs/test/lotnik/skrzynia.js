// skrzynia.js — ekwipunek jako czyste dane: 7 miejsc na postaci, skrzynia (kratki), nierozstrzygnięty drop.
// Wspólny dla klienta i serwera (deploy.sh kopiuje go do serwer/gra/). Każda akcja zwraca NOWY dokument
// i listę `displaced` (przedmioty przesunięte w inne miejsce), albo { error }. Bez DOM, bez sieci.
//
// Dokument: { v, slots: {helm..belt: item|null}, chest: [item|null], pending: [item] }.
// Logika liczy na chest.length, nie na stałej (większa skrzynia = dłuższa tablica).
import { SLOT_ORDER, CHEST_SIZE, LEGACY_TYPE, slotAccepts, modsFor } from './items.js?v=70';

export const ERR = {
  full: 'Skrzynia pełna. Zniszcz jakiś przedmiot, żeby zrobić miejsce.',
  missing: 'Tego przedmiotu już nie ma. Odśwież ekwipunek.',
  slot: 'Ten przedmiot nie pasuje do tego miejsca.'
};

function validItem(it) {
  return !!it && typeof it === 'object' && typeof it.id === 'string' && typeof it.type === 'string';
}

export function emptyDoc() {
  const slots = {};
  for (let i = 0; i < SLOT_ORDER.length; i++) slots[SLOT_ORDER[i]] = null;
  const chest = [];
  for (let i = 0; i < CHEST_SIZE; i++) chest.push(null);
  return { v: 1, slots: slots, chest: chest, pending: [] };
}

// Kopia przedmiotu ze starym typem zamienionym na nowy (pierścień → pas).
function copyItem(it) {
  const c = JSON.parse(JSON.stringify(it));
  if (LEGACY_TYPE[c.type]) c.type = LEGACY_TYPE[c.type];
  return c;
}

// Stare miejsca (dwa pierścienie przed 19.10): przedmioty z nich trafiają do skrzyni.
const LEGACY_SLOTS = ['ring1', 'ring2'];

// Dowolne wejście (Firestore, stary format, śmieci) → poprawny dokument (kopia).
export function normalize(raw) {
  const out = emptyDoc();
  if (!raw || typeof raw !== 'object') return out;
  const s = raw.slots && typeof raw.slots === 'object' ? raw.slots : {};
  for (let i = 0; i < SLOT_ORDER.length; i++) {
    const it = s[SLOT_ORDER[i]];
    if (validItem(it)) {
      const c = copyItem(it);
      if (slotAccepts(SLOT_ORDER[i], c.type)) out.slots[SLOT_ORDER[i]] = c;
    }
  }
  const c = Array.isArray(raw.chest) ? raw.chest : [];
  while (out.chest.length < c.length) out.chest.push(null);
  for (let i = 0; i < c.length; i++) if (validItem(c[i])) out.chest[i] = copyItem(c[i]);
  // Migracja pierścieni: do wolnej kratki, a bez miejsca skrzynia rośnie (nic nie przepada).
  for (let i = 0; i < LEGACY_SLOTS.length; i++) {
    const it = s[LEGACY_SLOTS[i]];
    if (!validItem(it)) continue;
    const cell = firstFree(out);
    if (cell >= 0) out.chest[cell] = copyItem(it);
    else out.chest.push(copyItem(it));
  }
  const p = Array.isArray(raw.pending) ? raw.pending : [];
  for (let i = 0; i < p.length; i++) if (validItem(p[i])) out.pending.push(copyItem(p[i]));
  return out;
}

// Przedmioty, które działają na lot (dziś: założone). Jedno miejsce do rozszerzenia (np. charmy ze skrzyni).
export function activeItems(doc) {
  const d = normalize(doc), out = [];
  for (let i = 0; i < SLOT_ORDER.length; i++) if (d.slots[SLOT_ORDER[i]]) out.push(d.slots[SLOT_ORDER[i]]);
  return out;
}

export function activeMods(doc) {
  return modsFor(activeItems(doc));
}

export function freeCells(doc) {
  let n = 0;
  for (let i = 0; i < doc.chest.length; i++) if (!doc.chest[i]) n++;
  return n;
}

function firstFree(doc) {
  for (let i = 0; i < doc.chest.length; i++) if (!doc.chest[i]) return i;
  return -1;
}

// Gdzie leży przedmiot o danym id: { at: 'slot'|'chest'|'pending', key }.
export function locate(doc, id) {
  for (let i = 0; i < SLOT_ORDER.length; i++) {
    const it = doc.slots[SLOT_ORDER[i]];
    if (it && it.id === id) return { at: 'slot', key: SLOT_ORDER[i], item: it };
  }
  for (let i = 0; i < doc.chest.length; i++) if (doc.chest[i] && doc.chest[i].id === id) return { at: 'chest', key: i, item: doc.chest[i] };
  for (let i = 0; i < doc.pending.length; i++) if (doc.pending[i].id === id) return { at: 'pending', key: i, item: doc.pending[i] };
  return null;
}

function take(doc, loc) {
  if (loc.at === 'slot') doc.slots[loc.key] = null;
  else if (loc.at === 'chest') doc.chest[loc.key] = null;
  else doc.pending.splice(loc.key, 1);
}

// Miejsce dla typu: wskazane (gdy pasuje), inaczej pierwsze puste pasujące, inaczej pierwsze pasujące.
function targetSlot(doc, type, to) {
  if (to) return slotAccepts(to, type) ? to : '';
  let first = '';
  for (let i = 0; i < SLOT_ORDER.length; i++) {
    const s = SLOT_ORDER[i];
    if (!slotAccepts(s, type)) continue;
    if (!doc.slots[s]) return s;
    if (!first) first = s;
  }
  return first;
}

// Załóż przedmiot ze skrzyni albo z dropu. Stary wraca w zwolnioną kratkę (ze skrzyni) albo w pierwszą wolną.
export function equip(raw, id, to) {
  const doc = normalize(raw);
  const loc = locate(doc, id);
  if (!loc || loc.at === 'slot') return { error: ERR.missing };
  const slot = targetSlot(doc, loc.item.type, to);
  if (!slot) return { error: ERR.slot };
  const old = doc.slots[slot];
  take(doc, loc);
  const displaced = [];
  if (old) {
    const cell = loc.at === 'chest' ? loc.key : firstFree(doc);
    if (cell < 0) return { error: ERR.full };
    doc.chest[cell] = old;
    displaced.push(old);
  }
  doc.slots[slot] = loc.item;
  return { doc: doc, displaced: displaced, slot: slot };
}

// Drop do skrzyni.
export function keep(raw, id) {
  const doc = normalize(raw);
  const loc = locate(doc, id);
  if (!loc || loc.at !== 'pending') return { error: ERR.missing };
  const cell = firstFree(doc);
  if (cell < 0) return { error: ERR.full };
  take(doc, loc);
  doc.chest[cell] = loc.item;
  return { doc: doc, displaced: [] };
}

// Zdejmij z postaci do pierwszej wolnej kratki.
export function unequip(raw, id) {
  const doc = normalize(raw);
  const loc = locate(doc, id);
  if (!loc || loc.at !== 'slot') return { error: ERR.missing };
  const cell = firstFree(doc);
  if (cell < 0) return { error: ERR.full };
  take(doc, loc);
  doc.chest[cell] = loc.item;
  return { doc: doc, displaced: [loc.item] };
}

// Zniszcz (z postaci, skrzyni albo dropu).
export function destroy(raw, id) {
  const doc = normalize(raw);
  const loc = locate(doc, id);
  if (!loc) return { error: ERR.missing };
  take(doc, loc);
  return { doc: doc, displaced: [], destroyed: loc.item };
}

// Nowy drop: wolne pasujące miejsce na postaci → od razu założony; inaczej czeka w `pending`.
// Stary nierozstrzygnięty drop idzie do skrzyni, a bez miejsca przepada (`lost`).
export function addDrop(raw, item) {
  const doc = normalize(raw);
  const lost = [];
  while (doc.pending.length) {
    const old = doc.pending.shift();
    const cell = firstFree(doc);
    if (cell < 0) lost.push(old);
    else doc.chest[cell] = old;
  }
  const slot = targetSlot(doc, item.type, '');
  if (slot && !doc.slots[slot]) {
    doc.slots[slot] = item;
    return { doc: doc, displaced: [], equipped: slot, lost: lost };
  }
  doc.pending.push(item);
  return { doc: doc, displaced: [], equipped: '', lost: lost };
}

// Scalenie gościa z kontem: przedmioty gościa w puste miejsca konta, potem w wolne kratki.
// Co się nie mieści, zostaje u gościa (`left` > 0). Drop gościa przechodzi, gdy konto nie ma swojego.
export function merge(rawAcc, rawGuest) {
  const acc = normalize(rawAcc), guest = normalize(rawGuest);
  let moved = 0;
  for (let i = 0; i < SLOT_ORDER.length; i++) {
    const s = SLOT_ORDER[i], it = guest.slots[s];
    if (!it) continue;
    const t = targetSlot(acc, it.type, '');
    if (t && !acc.slots[t]) { acc.slots[t] = it; guest.slots[s] = null; moved++; continue; }
    const cell = firstFree(acc);
    if (cell >= 0) { acc.chest[cell] = it; guest.slots[s] = null; moved++; }
  }
  for (let i = 0; i < guest.chest.length; i++) {
    const it = guest.chest[i];
    if (!it) continue;
    const cell = firstFree(acc);
    if (cell < 0) break;
    acc.chest[cell] = it;
    guest.chest[i] = null;
    moved++;
  }
  if (guest.pending.length && !acc.pending.length) {
    acc.pending = guest.pending;
    guest.pending = [];
  }
  return { acc: acc, guest: guest, moved: moved, left: countItems(guest) };
}

export function countItems(raw) {
  const d = normalize(raw);
  let n = d.pending.length + (d.chest.length - freeCells(d));
  for (let i = 0; i < SLOT_ORDER.length; i++) if (d.slots[SLOT_ORDER[i]]) n++;
  return n;
}
