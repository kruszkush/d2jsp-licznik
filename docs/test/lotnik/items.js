// items.js — katalog przedmiotów, afiksy, losowanie i składanie modyfikatorów dla sim.js.
// Czyste dane + funkcje (bez DOM, bez fizyki). Sim.js nie importuje items.js:
// gra liczy `modsFor(loadout)` i przekazuje gotowe liczby do create(seed, mods).
//
// Jak dodać afiks: wpis w AFFIXES (kind, fx, max, text, desc, forms/name), jego mod w MODS
// (jeśli nowy; wtedy też obsługa w sim.js normalizeMods i SIM_VER+1) i id w SLOT_POOLS.
// Id afiksów NIGDY się nie zmieniają (siedzą w zapisanych przedmiotach).

// Wartości bez przedmiotów (sim.js ma te same w DEFAULT_MODS). `better` nie jest modem fizyki
// (sim go ignoruje): szansa na lepsze tiery przy dropie, niesiona w bilecie.
export const NEUTRAL_MODS = Object.freeze({
  groundBombFreq: 1, airBombFreq: 1, blastRadius: 1, blastUp: 1, blastFwd: 1, blastSide: 1,
  boostFreq: 1, boostSize: 1, boostPower: 1, platFreq: 1, platPower: 1, arcFreq: 1,
  sling: 1, puffUp: 1, puffFwd: 0, puffRegen: 1, freePuff: 0,
  gravity: 1, airDrag: 1, maxSpeed: 1, groundBounce: 1, bounceBrake: 1, rollLength: 1, pickupRange: 1,
  trampFreq: 1, dynamiteFreq: 1, chainBlast: 0, puffDelta: 0,
  better: 0
});

// Statystyki: suma procentów z afiksów (zwykłe dodawanie, bez sufitu, decyzja 19.10) → liczba dla sim.js.
// out: plus = 1 + E/100, minus = 1 − E/100, frac = E/100, pct = E, add = suma, flag = 0/1.
const MODS = {
  groundBombFreq: { out: 'plus', text: 'Częstotliwość bomb na ziemi +{v}%' },
  airBombFreq: { out: 'plus', text: 'Częstotliwość bomb w powietrzu +{v}%' },
  blastRadius: { out: 'plus', text: 'Rozmiar bomb +{v}%' },
  blastUp: { out: 'plus', text: 'Siła wybuchu w górę +{v}%' },
  blastFwd: { out: 'plus', text: 'Siła wybuchu w prawo +{v}%' },
  blastSide: { out: 'plus', text: 'Siła wybuchu przy toczeniu +{v}%' },
  boostFreq: { out: 'plus', text: 'Częstotliwość pasków napędu +{v}%' },
  boostSize: { out: 'plus', text: 'Rozmiar pasków napędu +{v}%' },
  boostPower: { out: 'plus', text: 'Siła pasków napędu +{v}%' },
  platFreq: { out: 'plus', text: 'Częstotliwość wyrzutni +{v}%' },
  platPower: { out: 'plus', text: 'Siła wyrzutni +{v}%' },
  arcFreq: { out: 'plus', text: 'Chmary piłeczek gęściej o +{v}%' },
  sling: { out: 'plus', text: 'Siła wystrzału z procy +{v}%' },
  puffUp: { out: 'plus', text: 'Siła podrzutu w górę +{v}%' },
  puffFwd: { out: 'frac', text: 'Siła podrzutu w prawo +{v}%' },
  puffRegen: { out: 'plus', text: 'Szybkość odnowienia podrzutu +{v}%' },
  freePuff: { out: 'frac', text: 'Szansa na podbicie za darmo +{v}%' },
  gravity: { out: 'minus', text: 'Grawitacja −{v}%' },
  airDrag: { out: 'minus', text: 'Opór powietrza −{v}%' },
  maxSpeed: { out: 'plus', text: 'Prędkość maksymalna +{v}%' },
  groundBounce: { out: 'plus', text: 'Odbicie od ziemi +{v}%' },
  bounceBrake: { out: 'minus', text: 'Hamowanie przy odbiciu od ziemi −{v}%' },
  rollLength: { out: 'plus', text: 'Długość toczenia +{v}%' },
  pickupRange: { out: 'plus', text: 'Zasięg zbierania piłeczek +{v}%' },
  better: { out: 'pct', text: 'Szansa na lepsze affixy +{v}%' },
  trampFreq: { out: 'plus', text: 'Szansa na trampoliny +{v}%' },
  dynamiteFreq: { out: 'plus', text: 'Szansa na dynamit na mapie +{v}%' },
  chainBlast: { out: 'flag', text: 'Bomba wybuchająca obok innej odpala wszystkie sąsiednie' },
  puffDelta: { out: 'add', min: -5, text: 'Podrzuty {v}' }
};

// Tiery afiksów (klucz tekstowy zapisany w przedmiocie). Kolor linii na karcie.
export const TIERS = {
  slaby: { label: 'Słaby', w: 60, color: '#9db0ff' },
  solidny: { label: 'Solidny', w: 28, color: '#6c8cff' },
  znakomity: { label: 'Znakomity', w: 10, color: '#b483ff' },
  nieziemski: { label: 'Nieziemski', w: 2, color: '#ff9b3d' }
};
const TIER_ORDER = ['slaby', 'solidny', 'znakomity', 'nieziemski'];
// Górne granice stopni jako ułamki górnej granicy znakomitego (decyzja 19.10; pierwsza liczba = dół słabego).
// Środki rosną ×1,66, ×1,76, ×2,0: rzadszy stopień daje względnie więcej. Stopnie się stykają, każdy ≥ 1 wartość.
const TIER_EDGES = [0.2, 0.33, 0.55, 1, 2.1];
function tierRanges(top) {
  const out = {};
  let lo = Math.max(1, Math.round(top * TIER_EDGES[0]));
  for (let i = 0; i < TIER_ORDER.length; i++) {
    const edge = top * TIER_EDGES[i + 1];
    // nieziemski w dół: komplet nieziemskich nie przekracza 2,1 × max (≤ granica sim.js)
    const hi = Math.max(lo, i === TIER_ORDER.length - 1 ? Math.floor(edge) : Math.round(edge));
    out[TIER_ORDER[i]] = [lo, hi];
    lo = hi + 1;
  }
  return out;
}
const BELT_SCALE = 0.6;   // pas ma wszystkie afiksy, ale z mniejszymi widełkami
export const UNIQUE_COLOR = '#d9a066';

export const RARITY = {
  n: { label: 'Normalny', color: '#c8c8c8' },
  m: { label: 'Magiczny', color: '#6c8cff' },
  r: { label: 'Rzadki', color: '#f2d24b' },
  u: { label: 'Unikat', color: '#c7864a' }
};
// Ile prefiksów/sufiksów może mieć przedmiot danej rzadkości (unikalny afiks poza limitem).
export const LIMITS = {
  m: { prefix: 1, suffix: 1 },
  r: { prefix: 3, suffix: 3 },
  u: { prefix: 3, suffix: 3 }
};

// Typy przedmiotów (paper doll jak w Piłeczce + broń, tarcza, pas). `gender` wybiera formę przymiotnika.
export const TYPES = {
  helm: { label: 'Hełm', base: 'Hełm', gender: 0 },
  armor: { label: 'Zbroja', base: 'Zbroja', gender: 1 },
  weapon: { label: 'Broń', base: 'Proca', gender: 1 },
  shield: { label: 'Tarcza', base: 'Tarcza', gender: 1 },
  gloves: { label: 'Rękawice', base: 'Rękawice', gender: 2 },
  boots: { label: 'Buty', base: 'Buty', gender: 2 },
  belt: { label: 'Pas', base: 'Pas', gender: 0 }
};
export const TYPE_ORDER = ['helm', 'armor', 'weapon', 'shield', 'gloves', 'boots', 'belt'];
export const SLOT_ORDER = TYPE_ORDER;
// Stare przedmioty (dwa pierścienie przed 19.10) → pas.
export const LEGACY_TYPE = { ring: 'belt' };
export function slotType(slot) {
  return TYPES[slot] ? slot : '';
}
export function slotAccepts(slot, type) {
  return !!type && slotType(slot) === type;
}
export const CHEST_SIZE = 16;   // decyzja użytkownika 18.10

// Afiksy. fx: lista efektów { mod, k (skala v, domyślnie 1) | val (stała) }.
// text: linia na karcie ({v} = wartość); bez text = text moda z MODS. desc: rozwijany opis.
// max: suma kompletu znakomitych na wszystkich slotach afiksu (+ pas ×0,6), z niej widełki stopni (RANGES).
// max ≤ granica moda w sim.js MOD_RANGES / 2,1, więc komplet nieziemskich nigdy nie jest przycinany.
// Liczby tymczasowe (dawne sufity „C” z 19.10). legacy: stare id (tylko odczyt, nie losują się).
export const AFFIXES = {
  // --- prefiksy (świat) ---
  saperski: { kind: 'prefix', fx: [{ mod: 'groundBombFreq' }], max: 50, forms: ['Saperski', 'Saperska', 'Saperskie'], desc: 'Na ziemi leży więcej bomb.' },
  balonowy: { kind: 'prefix', fx: [{ mod: 'airBombFreq' }], max: 50, forms: ['Balonowy', 'Balonowa', 'Balonowe'], desc: 'W powietrzu wisi więcej bomb na balonikach.' },
  wybuchowy: { kind: 'prefix', fx: [{ mod: 'blastRadius' }], max: 50, forms: ['Wybuchowy', 'Wybuchowa', 'Wybuchowe'], desc: 'Bomby są większe, łatwiej w nie trafić.' },
  wznoszacy: { kind: 'prefix', fx: [{ mod: 'blastUp' }], max: 40, forms: ['Wznoszący', 'Wznosząca', 'Wznoszące'], desc: 'Bomba wyrzuca piłeczkę mocniej w górę.' },
  rozpedzony: { kind: 'prefix', fx: [{ mod: 'blastFwd' }], max: 40, forms: ['Rozpędzony', 'Rozpędzona', 'Rozpędzone'], desc: 'Bomba wyrzuca piłeczkę mocniej do przodu.' },
  toczacy: { kind: 'prefix', fx: [{ mod: 'blastSide' }], max: 60, forms: ['Toczący', 'Tocząca', 'Toczące'], desc: 'Mocniejszy wybuch, gdy wjeżdżasz w bombę nisko albo tocząc się.' },
  napedowy: { kind: 'prefix', fx: [{ mod: 'boostFreq' }], max: 40, forms: ['Napędowy', 'Napędowa', 'Napędowe'], desc: 'Paski napędu ze strzałkami pojawiają się częściej.' },
  szeroki: { kind: 'prefix', fx: [{ mod: 'boostSize' }], max: 40, forms: ['Szeroki', 'Szeroka', 'Szerokie'], desc: 'Paski napędu są dłuższe, łatwiej w nie trafić.' },
  turbinowy: { kind: 'prefix', fx: [{ mod: 'boostPower' }], max: 20, forms: ['Turbinowy', 'Turbinowa', 'Turbinowe'], desc: 'Pasek napędu wystrzeliwuje mocniej.' },
  sprezynowy: { kind: 'prefix', fx: [{ mod: 'platFreq' }], max: 50, forms: ['Sprężynowy', 'Sprężynowa', 'Sprężynowe'], desc: 'Wyrzutnie na sprężynach pojawiają się częściej.' },
  katapultowy: { kind: 'prefix', fx: [{ mod: 'platPower' }], max: 40, forms: ['Katapultowy', 'Katapultowa', 'Katapultowe'], desc: 'Wyrzutnia wyrzuca piłeczkę mocniej.' },
  chmarny: { kind: 'prefix', fx: [{ mod: 'arcFreq' }], max: 95, forms: ['Chmarny', 'Chmarna', 'Chmarne'], desc: 'Chmary piłeczek Magic Find pojawiają się częściej.' },
  // --- sufiksy (piłeczka) ---
  procarza: { kind: 'suffix', fx: [{ mod: 'sling' }], max: 23, name: 'Procarza', desc: 'Proca wystrzeliwuje piłeczkę mocniej.' },
  wzlotu: { kind: 'suffix', fx: [{ mod: 'puffUp' }], max: 47, name: 'Wzlotu', desc: 'Podrzut wybija piłeczkę mocniej w górę.' },
  pchniecia: { kind: 'suffix', fx: [{ mod: 'puffFwd' }], max: 38, name: 'Pchnięcia', desc: 'Podrzut pcha piłeczkę też do przodu: liczba to część siły podrzutu w górę.' },
  oddechu: { kind: 'suffix', fx: [{ mod: 'puffRegen' }], max: 95, name: 'Oddechu', desc: 'Zużyte podrzuty wracają szybciej. Bez affixu wraca 1 podrzut co 15 s lotu.' },
  szczescia: { kind: 'suffix', fx: [{ mod: 'freePuff' }], max: 28, name: 'Szczęścia', desc: 'Szansa, że podrzut nie zużyje ładunku.' },
  lekkosci: { kind: 'suffix', fx: [{ mod: 'gravity' }], max: 20, name: 'Lekkości', desc: 'Słabsza grawitacja: piłeczka wolniej spada.' },
  wiatru: { kind: 'suffix', fx: [{ mod: 'airDrag' }], max: 20, name: 'Wiatru', desc: 'Mniejszy opór powietrza: piłeczka wolniej traci prędkość.' },
  pedu: { kind: 'suffix', fx: [{ mod: 'maxSpeed' }], max: 25, name: 'Pędu', desc: 'Wyższy sufit prędkości piłeczki.' },
  sprezystosci: { kind: 'suffix', fx: [{ mod: 'groundBounce' }], max: 20, name: 'Sprężystości', desc: 'Piłeczka odbija się od ziemi wyżej.' },
  slizgu: { kind: 'suffix', fx: [{ mod: 'bounceBrake' }], max: 30, name: 'Ślizgu', desc: 'Przy uderzeniu w ziemię piłeczka mniej zwalnia w poziomie.' },
  toczenia: { kind: 'suffix', fx: [{ mod: 'rollLength' }], max: 50, name: 'Toczenia', desc: 'Piłeczka toczy się po ziemi dalej.' },
  zbieracza: { kind: 'suffix', fx: [{ mod: 'pickupRange' }], max: 47, name: 'Zbieracza', desc: 'Zbierasz piłeczki Magic Find z większej odległości.' },
  mistrza: { kind: 'suffix', fx: [{ mod: 'better' }], max: 100, name: 'Mistrza', desc: 'Affixy na znalezionych przedmiotach częściej wypadają w lepszych tierach.' },
  // --- unikalne (po jednym na unikat, poza limitem prefiksów/sufiksów) ---
  trampoliny: { kind: 'unique', fx: [{ mod: 'trampFreq' }], desc: 'Na mapie częściej pojawiają się trampoliny.' },
  dynamit: { kind: 'unique', fx: [{ mod: 'dynamiteFreq' }], desc: 'Na mapie częściej pojawia się dynamit, który wystrzeliwuje bardzo wysoko.' },
  lancuch: { kind: 'unique', fx: [{ mod: 'chainBlast', val: 1 }], text: 'Bomba wybuchająca obok innej odpala wszystkie sąsiednie', desc: 'Wybuch odpala bomby leżące tuż obok, a każda z nich dodaje siły wyrzutu.' },
  kompromis: { kind: 'unique', fx: [{ mod: 'blastUp' }, { mod: 'blastFwd' }, { mod: 'puffDelta', val: -3 }], text: 'Siła wybuchu +{v}%, Podrzuty −3', desc: 'Mocniejsze bomby w górę i w prawo kosztem trzech podrzutów.' },
  // --- stare id (przedmioty z serwera testowego sprzed 19.10) ---
  gesty: { kind: 'prefix', legacy: true, fx: [{ mod: 'groundBombFreq' }, { mod: 'airBombFreq' }], text: 'Częstotliwość bomb +{v}%', forms: ['Gęsty', 'Gęsta', 'Gęste'], desc: 'Więcej bomb na ziemi i w powietrzu.' },
  bombowy: { kind: 'prefix', legacy: true, fx: [{ mod: 'groundBombFreq' }], forms: ['Bombowy', 'Bombowa', 'Bombowe'], desc: 'Na ziemi leży więcej bomb.' },
  odpychajacy: { kind: 'suffix', legacy: true, fx: [{ mod: 'blastFwd' }], name: 'Podmuchu', desc: 'Bomba wyrzuca piłeczkę mocniej do przodu.' },
  powietrzny: { kind: 'suffix', legacy: true, fx: [], name: 'Powietrza', text: 'Affix wycofany', desc: 'Ten affix już nie działa.' }
};

// Pule afiksów na typ przedmiotu (≥ 6 prefiksów i 6 sufiksów, żeby 3 z puli dawały różnorodność).
// Pas: wszystkie (pusta lista = cała kategoria).
export const SLOT_POOLS = {
  helm: { prefix: ['saperski', 'balonowy', 'wybuchowy', 'napedowy', 'sprezynowy', 'chmarny'], suffix: ['oddechu', 'szczescia', 'lekkosci', 'wiatru', 'zbieracza', 'mistrza'] },
  armor: { prefix: ['wybuchowy', 'wznoszacy', 'rozpedzony', 'toczacy', 'turbinowy', 'katapultowy'], suffix: ['lekkosci', 'wiatru', 'pedu', 'sprezystosci', 'slizgu', 'toczenia'] },
  weapon: { prefix: ['rozpedzony', 'napedowy', 'szeroki', 'turbinowy', 'sprezynowy', 'katapultowy'], suffix: ['procarza', 'pedu', 'wzlotu', 'pchniecia', 'zbieracza', 'mistrza'] },
  shield: { prefix: ['saperski', 'balonowy', 'wybuchowy', 'wznoszacy', 'rozpedzony', 'toczacy'], suffix: ['sprezystosci', 'slizgu', 'toczenia', 'szczescia', 'lekkosci', 'oddechu'] },
  gloves: { prefix: ['wznoszacy', 'toczacy', 'szeroki', 'chmarny', 'balonowy', 'katapultowy'], suffix: ['wzlotu', 'pchniecia', 'oddechu', 'szczescia', 'procarza', 'zbieracza'] },
  boots: { prefix: ['toczacy', 'sprezynowy', 'katapultowy', 'saperski', 'szeroki', 'chmarny'], suffix: ['sprezystosci', 'slizgu', 'toczenia', 'pchniecia', 'wiatru', 'pedu'] },
  belt: { prefix: [], suffix: [] }
};

// Widełki stopni każdego afiksu: górna granica znakomitego = max / (liczba slotów z puli + pas 0,6).
export const AFFIX_RANGES = {};
for (const id in AFFIXES) {
  const def = AFFIXES[id];
  if (!def.max) continue;
  let slots = BELT_SCALE;
  for (const type in SLOT_POOLS) {
    const p = SLOT_POOLS[type][def.kind];
    if (p && p.indexOf(id) >= 0) slots++;
  }
  AFFIX_RANGES[id] = tierRanges(def.max / slots);
}

// Unikaty: własna nazwa, typ, jeden unikalny afiks (+6 losowych z puli typu, 3 prefiksy i 3 sufiksy). Nazwy z Piłeczki, do zmiany.
export const UNIQUES = {
  kapcie_moderatora: { name: 'Kapcie Moderatora', type: 'boots', unique: { id: 'trampoliny', range: [100, 200] } },
  proca_admina: { name: 'Proca Admina', type: 'weapon', unique: { id: 'dynamit', range: [100, 200] } },
  helm_weterana: { name: 'Hełm Weterana', type: 'helm', unique: { id: 'lancuch', range: [1, 1] } },
  tarcza_krola: { name: 'Tarcza Króla Forum', type: 'shield', unique: { id: 'kompromis', range: [30, 30] } }
};
const UNIQUE_IDS = Object.keys(UNIQUES);
const UNIQUE_RANDOM = 6;   // decyzja 19.10: 3 prefiksy + 3 sufiksy + unikalny = 7
// Stare unikaty (bez uid) dostają nazwę unikatu swojego typu, jeśli taki jest.
const UNIQUE_BY_TYPE = {};
for (let i = 0; i < UNIQUE_IDS.length; i++) UNIQUE_BY_TYPE[UNIQUES[UNIQUE_IDS[i]].type] = UNIQUE_IDS[i];

function poolOf(type, kind) {
  const p = SLOT_POOLS[type] && SLOT_POOLS[type][kind];
  if (p && p.length) return p;
  const all = [];
  for (const id in AFFIXES) if (AFFIXES[id].kind === kind && !AFFIXES[id].legacy) all.push(id);
  return all;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

export function affixesOf(item) {
  return item && Array.isArray(item.affixes) ? item.affixes : [];
}

// Sumy procentów z listy przedmiotów, klucz = mod.
function sumStats(items) {
  const sums = {};
  const list = Array.isArray(items) ? items : [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item || typeof item !== 'object') continue;
    const affixes = affixesOf(item);
    for (let j = 0; j < affixes.length; j++) {
      const a = affixes[j];
      const def = a && AFFIXES[a.id];
      const v = a && Number(a.v);
      if (!def || !isFinite(v)) continue;
      for (let k = 0; k < def.fx.length; k++) {
        const f = def.fx[k];
        if (!MODS[f.mod]) continue;
        const amount = f.val !== undefined ? f.val : v * (f.k || 1);
        sums[f.mod] = (sums[f.mod] || 0) + amount;
      }
    }
  }
  return sums;
}

// Wartość skuteczna statystyki w jednostkach z linii afiksu (%, podrzuty, flaga).
function effective(mod, sum) {
  const m = MODS[mod];
  if (m.out === 'flag') return sum > 0 ? 1 : 0;
  if (m.out === 'add') return Math.max(m.min, Math.round(sum));
  return Math.round(Math.max(0, sum) * 10) / 10;
}

// Lista przedmiotów → gotowe mody dla sim.js (+ `better` dla dropu).
export function computeMods(items) {
  const out = Object.assign({}, NEUTRAL_MODS);
  const sums = sumStats(items);
  for (const mod in sums) {
    const e = effective(mod, sums[mod]);
    const kind = MODS[mod].out;
    if (kind === 'plus') out[mod] = 1 + e / 100;
    else if (kind === 'minus') out[mod] = 1 - e / 100;
    else if (kind === 'frac') out[mod] = e / 100;
    else out[mod] = e;
  }
  return out;
}

// loadout = tablica obiektów przedmiotów (nieznane wpisy są ignorowane). Zwraca świeże mody.
export function modsFor(loadout) {
  const items = [];
  const list = Array.isArray(loadout) ? loadout : [];
  for (let i = 0; i < list.length; i++) if (list[i] && typeof list[i] === 'object') items.push(list[i]);
  return computeMods(items);
}

function fill(text, v) {
  return text.replace('{v}', String(v));
}

// Grupa moda na karcie: 'prefix' | 'suffix' wg pierwszego zwykłego afiksu z tym modem, inaczej 'unique'.
const MOD_KIND = {};
for (const id in AFFIXES) {
  const def = AFFIXES[id];
  if (def.legacy || def.kind === 'unique') continue;
  for (const f of def.fx) if (!MOD_KIND[f.mod]) MOD_KIND[f.mod] = def.kind;
}

// Sumy skuteczne na karcie postaci: [{ mod, text, kind }], tylko niezerowe, w kolejności MODS.
export function statSummary(items) {
  const sums = sumStats(items);
  const lines = [];
  for (const mod in MODS) {
    if (!sums[mod]) continue;
    const e = effective(mod, sums[mod]);
    if (!e) continue;
    lines.push({ mod: mod, text: fill(MODS[mod].text, e), kind: MOD_KIND[mod] || 'unique', v: Math.abs(e) });
  }
  return lines;
}

// Jedna linia afiksu do karty: tekst, opis, kolor (tier albo unikat).
export function affixLine(a) {
  const def = a && AFFIXES[a.id];
  if (!def) return null;
  const text = def.text || (def.fx[0] && MODS[def.fx[0].mod] ? MODS[def.fx[0].mod].text : '{v}');
  const color = def.kind === 'unique' ? UNIQUE_COLOR : (TIERS[a.t] ? TIERS[a.t].color : TIERS.solidny.color);
  return { text: fill(text, a.v), desc: def.desc || '', color: color, tier: a.t || '', unique: def.kind === 'unique' };
}

// --- seedowany generator i losowanie przedmiotów (bez Math.random) ----------------

export function makeRng(seed) {
  let s = Math.floor(Math.abs(Number(seed) || 0));
  if (!isFinite(s)) s = 0;
  s = s - Math.floor(s / 4294967296) * 4294967296;
  return function () {
    const n = s * 1664525 + 1013904223;
    s = n - Math.floor(n / 4294967296) * 4294967296;
    return s / 4294967296;
  };
}

// Wszystko zależy TYLKO od Magic Find (decyzje użytkownika 19.10): przedmiot co grę, bez krzywych z dystansu
// (żadnych liczb ze starej Piłeczki). Dystans daje jawne MF: 4 na 100 m. Liczby tymczasowe, kalibracja out/pomiar-mf.mjs.
export const MF_PER_KM = 40;
export function mfFromMeters(meters) {
  return Math.floor(Math.max(0, Number(meters) || 0) * MF_PER_KM / 1000);
}
// MF partii = zebrane w locie (sim.mf) + za dystans. Jedyne miejsce sumowania (karta, HUD, losowanie).
export function totalMf(meters, mf) {
  return Math.max(0, Number(mf) || 0) + mfFromMeters(meters);
}

// Mnożnik (1 + MF/100)^2 na wagę rzadkiego: szybciej niż liniowo, bo MF rośnie z czasem lotu,
// a dobra (długa) gra ma dać więcej na godzinę niż wiele krótkich.
// Unikat (decyzja 19.10): esowata do sufitu 10%, połowa przy 1200 MF (0,12% przy 133, 3,3% przy 845);
// pomiar: bez sprzętu ~1 na 5 h, średni ~1 na 2,5 h, pełny ~1 na 40 min.
const W_MAGIC = 26, W_RARE = 0.6, MF_POW = 2, U_TOP = 0.1, U_K = 1200;
export function rarityByMf(mfTotal) {
  const mf = Math.max(0, Number(mfTotal) || 0);
  const k = Math.pow(1 + mf / 100, MF_POW);
  const u = U_TOP * mf * mf / (mf * mf + U_K * U_K);
  const wr = W_RARE * k;
  return { m: (1 - u) * W_MAGIC / (W_MAGIC + wr), r: (1 - u) * wr / (W_MAGIC + wr), u: u };
}

// Szanse rzadkości (0..1) z MF łącznego; `mf` = zebrane (bez dystansu). Przedmiot wypada co grę.
// Jedno źródło dla karty i losowania na serwerze. Na razie bez normalnych przedmiotów (18.10).
export function rarityChances(meters, mf) {
  const c = rarityByMf(totalMf(meters, mf));
  c.mf = totalMf(meters, mf);
  return c;
}

// Podbicie stopnia: afiks losuje stopień bez MF, potem jeden rzut o stopień wyżej (karta pokazuje skok).
// Krzywa esowata (decyzja 19.10, out/mf_podbicie_krzywe.html): mało przy małym MF, połowa sufitu przy MF `k`.
const TIER_UP = { top: 0.75, k: 800, n: 1.5 };
export function tierUpChance(mfTotal) {
  const v = Math.pow(Math.max(0, Number(mfTotal) || 0), TIER_UP.n);
  return TIER_UP.top * v / (v + Math.pow(TIER_UP.k, TIER_UP.n));
}

// Afiksy łańcuchem: pewne minimum, potem rzut na każdy kolejny (udany → rzut na następny).
// p = baza + (sufit − baza)·MF/(MF + K): rośnie z MF, wyższe afiksy trudniejsze i wolniej rosną. Liczby tymczasowe.
// Pierwszy rzut (2. magicznego, 4. rzadkiego) o połowę słabszy (decyzja użytkownika 20.10): baza 0,2, sufit 0,45
// zamiast 0,4 / 0,9 → szanse na 4/5/6 rzadkiego dokładnie ×0,5 przy każdym MF.
// Magiczny osobno, łatwiej niż 4. rzadkiego (decyzja użytkownika 20.10): 30% bez MF, ~65% przy 1000 MF.
const CHAIN_TOP = 0.9;
export const AFFIX_CHAIN = {
  m: { min: 1, next: [{ base: 0.3, k: 150, top: 0.7 }] },
  r: { min: 3, next: [{ base: 0.2, k: 150, top: 0.45 }, { base: 0.25, k: 400 }, { base: 0.12, k: 1000 }] }
};
export function nextAffixChances(rarity, mfTotal) {
  const ch = AFFIX_CHAIN[rarity];
  if (!ch) return [];
  const v = Math.max(0, Number(mfTotal) || 0);
  return ch.next.map((s) => s.base + ((s.top || CHAIN_TOP) - s.base) * v / (v + s.k));
}
// Rozkład liczby afiksów { n: szansa } z łańcucha (karta, testy).
export function affixCountChances(rarity, mfTotal) {
  const ch = AFFIX_CHAIN[rarity];
  const p = nextAffixChances(rarity, mfTotal);
  const out = {};
  let reach = 1;
  for (let i = 0; i <= p.length; i++) {
    const stop = i < p.length ? 1 - p[i] : 1;
    out[ch.min + i] = reach * stop;
    if (i < p.length) reach *= p[i];
  }
  return out;
}

// Wagi tierów; „Szansa na lepsze afiksy” (better, %) mnoży wyższe tiery coraz mocniej.
export function tierChances(better) {
  const b = Math.max(0, Number(better) || 0) / 100;
  const out = {};
  let sum = 0;
  for (let i = 0; i < TIER_ORDER.length; i++) {
    const w = TIERS[TIER_ORDER[i]].w * (1 + b * i);
    out[TIER_ORDER[i]] = w;
    sum += w;
  }
  for (const k in out) out[k] /= sum;
  return out;
}

function pickWeighted(rng, chances, order) {
  let x = rng();
  for (let i = 0; i < order.length; i++) {
    x -= chances[order[i]];
    if (x < 0) return order[i];
  }
  return order[order.length - 1];
}

function pickRarity(rng, c) {
  const x = rng();
  if (x < c.u) return 'u';
  return x < c.u + c.r ? 'r' : 'm';
}

// Losowa pozycja r ∈ [0,1) w widełkach → wartość całkowita (v = prawda dla gry, r = do przyszłej migracji).
function rollRange(range, rng, scale) {
  const r = rng();
  return { v: valueAt(range, r, scale), r: Math.floor(r * 1000) / 1000 };   // floor: r < 1
}
function valueAt(range, r, scale) {
  const lo = Math.max(1, Math.round(range[0] * scale));
  const hi = Math.max(lo, Math.round(range[1] * scale));
  return lo + Math.floor(r * (hi - lo + 1));
}

// Pełne widełki afiksu na danym typie (od najniższej wartości słabego do najwyższej nieziemskiego), te same
// zaokrąglenia co rollRange. Unikalny: widełki z UNIQUES. null = stała wartość albo stary afiks.
export function affixRange(a, type) {
  const def = a && AFFIXES[a.id];
  if (!def || def.legacy) return null;
  let lo, hi;
  if (def.kind === 'unique') {
    let range = null;
    for (const uid in UNIQUES) if (UNIQUES[uid].unique.id === a.id) range = UNIQUES[uid].unique.range;
    if (!range) return null;
    lo = range[0];
    hi = range[1];
  } else {
    const R = AFFIX_RANGES[a.id];
    if (!R) return null;
    const scale = (LEGACY_TYPE[type] || type) === 'belt' ? BELT_SCALE : 1;
    lo = Math.max(1, Math.round(R[TIER_ORDER[0]][0] * scale));
    hi = Math.max(lo, Math.round(R[TIER_ORDER[TIER_ORDER.length - 1]][1] * scale));
  }
  return lo < hi ? [lo, hi] : null;
}

// Widełki wartości stopnia `t` afiksu na danym typie (te same zaokrąglenia co valueAt). null = brak stopnia.
export function tierRange(id, t, type) {
  const R = AFFIX_RANGES[id];
  if (!R || !R[t]) return null;
  const scale = (LEGACY_TYPE[type] || type) === 'belt' ? BELT_SCALE : 1;
  const lo = Math.max(1, Math.round(R[t][0] * scale));
  return [lo, Math.max(lo, Math.round(R[t][1] * scale))];
}

// Stopień bez MF, potem rzut `up` o stopień wyżej (ta sama pozycja r w nowych widełkach).
// Podbity afiks pamięta stan przed MF (`t0`, `v0`) dla animacji karty; gra czyta tylko `t` i `v`.
function rollAffix(rng, id, type, tiers, up) {
  const R = AFFIX_RANGES[id];
  const scale = type === 'belt' ? BELT_SCALE : 1;
  const t0 = pickWeighted(rng, tiers, TIER_ORDER);
  const x = rng();
  const r = Math.floor(x * 1000) / 1000;
  const v0 = valueAt(R[t0], x, scale);
  const i0 = TIER_ORDER.indexOf(t0);
  if (!(up > 0) || i0 >= TIER_ORDER.length - 1 || rng() >= up) return { id: id, v: v0, t: t0, r: r };
  const t = TIER_ORDER[i0 + 1];
  return { id: id, v: valueAt(R[t], x, scale), t: t, r: r, t0: t0, v0: v0 };
}

// Losuje `count` afiksów z puli typu: najwyżej limit prefiksów i sufiksów, każdy afiks raz; `up` = szansa podbicia.
function rollAffixes(rng, type, rarity, count, tiers, up) {
  const lim = LIMITS[rarity];
  const left = {};
  const pools = {};
  for (const kind in lim) {
    left[kind] = lim[kind];
    pools[kind] = poolOf(type, kind).slice();
  }
  const out = [];
  while (out.length < count) {
    let total = 0;
    for (const kind in pools) if (left[kind] > 0) total += pools[kind].length;
    if (total <= 0) break;
    let x = Math.floor(rng() * total);
    for (const kind in pools) {
      if (left[kind] <= 0) continue;
      if (x < pools[kind].length) {
        const id = pools[kind].splice(x, 1)[0];
        left[kind]--;
        out.push(rollAffix(rng, id, type, tiers, up));
        break;
      }
      x -= pools[kind].length;
    }
  }
  return out;
}

// Serwer nadpisuje `id` (HMAC partii) i dopisuje `src` oraz `ball`.
function makeItem(rng, type, rarity, affixes, ilvl, uid) {
  const it = {
    v: 2,
    id: 'it-' + Math.floor(rng() * 1679616).toString(36) + '-' + ilvl,
    type: type,
    rarity: rarity,
    ilvl: ilvl,
    affixes: affixes
  };
  if (uid) it.uid = uid;
  return it;
}

// Unikat o danym uid: unikalny afiks + 6 losowych z puli typu (komplet 3/3).
// `up` = szansa podbicia stopnia losowych afiksów (z MF partii; grant bez MF = 0).
export function rollUnique(rng, uid, better, ilvl, up) {
  const u = UNIQUES[uid];
  if (!u) return null;
  const tiers = tierChances(better);
  const rv = rollRange(u.unique.range, rng, 1);
  const affixes = [{ id: u.unique.id, v: rv.v, r: rv.r }].concat(rollAffixes(rng, u.type, 'u', UNIQUE_RANDOM, tiers, up));
  return makeItem(rng, u.type, 'u', affixes, ilvl || 0, uid);
}

// rng + kontekst { meters, mf, better } → przedmiot. Ten sam rng i kontekst = ten sam przedmiot.
export function rollItem(seedOrRng, ctx) {
  const rng = typeof seedOrRng === 'function' ? seedOrRng : makeRng(seedOrRng);
  const c = ctx || {};
  const meters = Math.max(0, Number(c.meters) || 0);
  const ilvl = Math.floor(meters / 100);
  const mfu = totalMf(meters, c.mf);
  const up = tierUpChance(mfu);
  const rarity = pickRarity(rng, rarityByMf(mfu));
  if (rarity === 'u') {
    const uid = UNIQUE_IDS[Math.floor(rng() * UNIQUE_IDS.length)];
    const u = rollUnique(rng, uid, c.better, ilvl, up);
    if (u) { u.mfu = mfu; u.rp = round3(rarityByMf(mfu).u); u.up = round3(up); }
    return u;
  }
  const type = TYPE_ORDER[Math.floor(rng() * TYPE_ORDER.length)];
  const tiers = tierChances(c.better);
  // Łańcuch: rzut na każdy kolejny afiks aż do pierwszego nieudanego. Losuję od razu komplet do limitu:
  // pierwsze `count` działają (`affixes`), reszta to `locked` (karta pokazuje je zamazane; gra ich nie czyta).
  // `locked[0]` = afiks z nieudanego rzutu, dalsze bez rzutu. `chain` = szanse kolejnych miejsc przy tym MF.
  const p = nextAffixChances(rarity, mfu);
  let count = AFFIX_CHAIN[rarity].min;
  for (let i = 0; i < p.length; i++) {
    if (rng() >= p[i]) break;
    count++;
  }
  const all = rollAffixes(rng, type, rarity, AFFIX_CHAIN[rarity].min + p.length, tiers, up);
  const it = makeItem(rng, type, rarity, all.slice(0, count), ilvl);
  const locked = all.slice(count);
  if (locked.length) it.locked = locked;   // pula wyczerpana = krótsze albo brak
  it.chain = p.map(round3);
  it.rp = round3(rarityByMf(mfu)[rarity]);
  it.mfu = mfu;
  it.up = round3(up);
  return it;
}

function round3(v) {
  return Math.round(v * 1000) / 1000;
}

// Drop po locie (tylko serwer): zawsze przedmiot; rng z tajnej losowości partii, kontekst { meters, mf, better, mode }.
export function rollDrop(rng, ctx) {
  return rollItem(rng, ctx);
}

function uniqueOf(item) {
  if (!item || item.rarity !== 'u') return null;
  return UNIQUES[item.uid] || UNIQUES[UNIQUE_BY_TYPE[LEGACY_TYPE[item.type] || item.type]] || null;
}

export function itemName(item) {
  if (!item) return '';
  const slot = TYPES[LEGACY_TYPE[item.type] || item.type];
  if (!slot) return item.name || 'Przedmiot';
  const u = uniqueOf(item);
  if (u) return u.name;
  let prefix = '';
  let suffix = '';
  const affixes = affixesOf(item);
  for (let i = 0; i < affixes.length; i++) {
    const def = AFFIXES[affixes[i].id];
    if (!def) continue;
    if (def.kind === 'prefix' && !prefix) prefix = def.forms ? def.forms[slot.gender] || def.forms[0] : '';
    if (def.kind === 'suffix' && !suffix) suffix = def.name || '';
  }
  if (!prefix && !suffix) return item.name || slot.base;
  return [prefix, slot.base, suffix].filter(Boolean).join(' ');
}

// Linie tekstowe (bez kolorów) — do aria i prostych podglądów.
export function itemLines(item) {
  if (!item) return [];
  const slot = TYPES[LEGACY_TYPE[item.type] || item.type];
  const lines = [];
  lines.push((slot ? slot.label : 'Przedmiot') + ' · ' + ((RARITY[item.rarity] || RARITY.n).label));
  if (item.ilvl) lines.push('Poziom przedmiotu: ' + item.ilvl);
  const affixes = affixesOf(item);
  for (let i = 0; i < affixes.length; i++) {
    const line = affixLine(affixes[i]);
    if (line) lines.push(line.text);
  }
  if (item.desc) lines.push(item.desc);
  return lines;
}
