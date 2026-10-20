// inventory.js — ekwipunek z serwera (E5): /inv, /act; przedmioty żyją tylko na serwerze.
// W localStorage jest wyłącznie losowy klucz gościa (jak eqKey w Piłeczce); zalogowany gra tokenem konta,
// a /inv z tokenem i kluczem scala przedmioty gościa z kontem (raz na klucz). Logika akcji: skrzynia.js.
import { normalize, activeItems, freeCells, countItems } from './skrzynia.js?v=63';

const KEY_STORE = 'lotnik.eqkey.v1';
const OLD_STORE = 'lotnik.inventory.v1';     // lokalny ekwipunek sprzed E5 (do podrobienia) — znika
const KEY_ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function newKey() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  let k = '';
  for (let i = 0; i < b.length; i++) k += KEY_ABC[b[i] & 63];
  return k;
}

function storeGet(k) {
  try { return localStorage.getItem(k); } catch (e) { return null; }
}
function storeSet(k, v) {
  try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* tryb prywatny */ }
}

// apiPost(path, body, ms) → Promise<{ ok, j }>; token() → token konta albo null.
// lsPrefix: przedrostek klucza w localStorage (prod „p.”, osobny gość niż na /test/).
export function createInventory(apiPost, token, lsPrefix) {
  const KS = (lsPrefix || '') + KEY_STORE;
  storeSet(OLD_STORE, null);
  let key = storeGet(KS);
  if (!key || !/^[A-Za-z0-9_-]{32}$/.test(key)) { key = newKey(); storeSet(KS, key); }
  let doc = normalize(null);
  let loaded = false;
  let note = '';                               // komunikat po scaleniu (resztki gościa)
  const subs = [];
  let queue = Promise.resolve();

  function rotateKey() {
    key = newKey();
    storeSet(KS, key);
  }
  // Tożsamość do /start, /end, /act: token konta ma pierwszeństwo; klucz gościa zawsze obok, bo /end przy wylogowanej
  // sesji daje drop na klucz (po ponownym zalogowaniu /inv go scali), zamiast go zgubić.
  function ident() {
    const t = token();
    return t ? { token: t, key: key } : { key: key };
  }
  function set(raw) {
    const before = JSON.stringify(activeItems(doc).map(function (x) { return x.id; }));
    doc = normalize(raw);
    loaded = true;
    const slotsChanged = before !== JSON.stringify(activeItems(doc).map(function (x) { return x.id; }));
    for (let i = 0; i < subs.length; i++) subs[i](slotsChanged);
  }

  // Wczytanie (i scalenie po zalogowaniu). Klucz przypięty do konta → nowy klucz i ponowne wczytanie.
  function load() {
    const t = token();
    const body = t ? { token: t, key: key } : { key: key };
    return apiPost('/inv', body, 8000).then(function (r) {
      if (r.j.owned && !t) { rotateKey(); return load(); }
      if (!r.ok) return { error: r.j.error || 'błąd serwera' };
      if (r.j.newKey) rotateKey();
      note = r.j.left ? 'Zostało ' + r.j.left + ' przedmiotów z gry bez konta. Zrób miejsce w skrzyni, a dojdą przy następnym otwarciu.' : '';
      set(r.j);
      return { merged: r.j.merged || 0, left: r.j.left || 0 };
    });
  }

  // Akcje po kolei (szybkie kliki nie wysyłają starego stanu). Wynik: { ok } albo { error }.
  function act(action, id, to) {
    const run = function () {
      const body = Object.assign({ action: action, id: id }, to ? { to: to } : {}, ident());
      return apiPost('/act', body, 8000).then(function (r) {
        if (r.j.owned) { rotateKey(); return load().then(function () { return { error: 'Te przedmioty są już na koncie. Zaloguj się.' }; }); }
        if (r.j.inv) set(r.j.inv);
        if (!r.ok) return { error: r.j.error || 'błąd serwera' };
        return { ok: true, slot: r.j.slot || '' };
      });
    };
    queue = queue.then(run, run);
    return queue;
  }

  return {
    ident: ident,
    load: load,
    act: act,
    set: set,
    rotateKey: rotateKey,
    doc: function () { return doc; },
    loaded: function () { return loaded; },
    note: function () { return note; },
    equipped: function () { return activeItems(doc); },
    free: function () { return freeCells(doc); },
    count: function () { return countItems(doc); },
    // fn(slotsChanged) po każdej zmianie stanu.
    onChange: function (fn) { subs.push(fn); }
  };
}
