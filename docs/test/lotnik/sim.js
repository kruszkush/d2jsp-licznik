// sim.js — cała fizyka lotu. Deterministyczne: bez DOM, bez czasu, bez Math.random.
// Dozwolone operacje: + - * / oraz Math.sqrt/abs/floor/min/max.
// Kąty trzymamy jako wektory (stała tabela + liniowa interpolacja), bez trygonometrii.

export const DT = 1 / 120;
// Wersja fizyki: podbij przy każdej zmianie wyniku lotu (serwer odtwarza partie sim_v{N}.js).
// v2: bomba z boku bez przyspieszenia, bomby w powietrzu, wyrzutnie, paski napędu, osobne strumienie obiektów.
// v3: mody afiksów, generator na strumień (mapa nie zależy od ruchu piłki), osobne strumienie bomb
// na ziemi i w powietrzu, odnawianie podrzutów, wyższa proca.
// v4: strefy MF wyżej (kosmos od 3000, czerwień od 5400).
// v5: kuleczki łuków 4/3/2 MF (1.–3. miejsce) i 1 MF (zwykły) zamiast 8/6/4/2; pełny łuk ×5/×4/×3/×2 zamiast ×10.
// v6: dynamit wyrzuca też mocno w prawo; bomba z boku i trampolina dają minimalny pęd do przodu; ptaki i balony MF.
// v7: ptaki wyżej (125–250 m) i większe, dają MF wg miejsca awatara; balony MF większe, w poziomej girlandzie.
export const SIM_VER = 7;

const GRAVITY = 1500;
const AIR_DRAG = 0.22;          // opór powietrza (1/s)
const PLAYER_R = 36;            // promień piłeczki = rysowany (dawniej 42; −15%)
const GROUND_REST = 0.5;        // odbicie od ziemi przy małym upadku
const BOUNCE_MAX = 0.8;         // odbicie przy dużym upadku (jak piłka koszykowa)
const IMPACT_REF = 1500;        // impet, przy którym odbicie osiąga BOUNCE_MAX
const GROUND_FRICTION = 0.9;    // strata poziomej prędkości przy odbiciu
const ROLL_FRICTION = 2.4;      // tarcie toczenia (1/s)
const REST_SPEED = 36;          // poniżej tej prędkości uznajemy, że postać stoi
const REST_STEPS = 48;          // 0,4 s stania = koniec partii
export const MAX_FLY_STEPS = 120 * 600; // bezpiecznik: 10 min lotu = koniec gry, „Pokonałeś grę” na karcie
const MAX_SPEED = 3800;         // sufit po łańcuchu bomb i boosterów (wyżej niż moc procy +35%)
// MF w strefach (decyzja 19.10): kosmos +1, czerwień +2 co 0,3 s lotu w strefie (progi = połowa przejścia tła w draw.js).
// Wyżej od v4 (prośba użytkownika 19.10: kosmos tam, gdzie była czerwień, czerwień dużo wyżej).
const ZONE_SPACE_Y = 3000;
const ZONE_HELL_Y = 5400;
const ZONE_EVERY = 36;          // kroków (0,3 s)

const SLING_X = 0;
const SLING_Y = 190;            // środek kulki w łyżce procy (pełny naciąg w dół: 190 − 140 > PLAYER_R)
const MAX_PULL = 140;           // pełny naciąg w jednostkach świata (= 100)
const SPEED_MIN = 150;          // słaby naciąg nadal ma lecieć, nie spadać

// Moc procy. Bomby, boostery i przedmioty mogą wynik przebić.
export const SPEED = 2970;      // +35% względem poprzednich 2200

// Magic Find: kuleczka łuku zwykłego gracza = PICKUP_BASE, 1./2./3. miejsca = PICKUP_PLACES
// (od v5; owner.mult zostaje w danych tylko dla starych wersji fizyki).
// Zebranie całego łuku mnoży sumę łuku: 1./2./3. miejsce ×5/×4/×3, zwykły ×2 (od v5; wcześniej każdy ×10).
export const PICKUP_BASE = 1;
const PICKUP_PLACES = [4, 3, 2];   // = ×4/×3/×2 zwykłej (plakietka na kuleczce)
export const ARC_MULT = 2;
const ARC_PLACES = [5, 4, 3];
export function arcMult(owner) { return owner >= 0 ? ARC_PLACES[owner] : ARC_MULT; }
// Łuk bez właściciela z rankingu: zwykły gracz (×1, 4 kuleczki).
const PLAIN_OWNER = Object.freeze({ mult: 1, size: 4 });

const PUFF_UP = 900;            // klik: podrzut ustawia prędkość w górę (bez kumulacji) — 3× mocniej niż 300
const PUFF_FWD = 8;             // podrzut lekko popycha do przodu (nie jest napędem)
const PUFF_COOL = 12;           // 0,1 s między podrzutami (kroki)
const PUFF_START = 5;
const PUFF_MAX = 6;             // limit podrzutów (bomba dodaje +1)
const PUFF_REGEN = 120 * 15;    // bez przedmiotów: 1 podrzut wraca co 15 s lotu (kroki)

const BOMB_R = 13;
const BOMB_KEEP = 0.8;          // ile pionowej prędkości zostaje po odbiciu (kąt odbicia = kąt wlotu)
const BOMB_GAIN = 2;            // największy dodatek mnożnika za impet (sufit ×3, rośnie coraz wolniej)
const BOMB_REF = 1000;          // prędkość, przy której dodatek mnożnika jest połowiczny
const BOMB_ADD = 400;           // dodatek poziomy przy słabym wlocie (malejący do zera przy BOMB_ADD_REF)
const BOMB_ADD_REF = 1000;
const BOMB_HALF_SCREEN = 380;   // najniższy wyrzut: pół ekranu w górę (jednostki świata, ~760 = wysokość)
const BOMB_MIN_UP = Math.sqrt(2 * GRAVITY * BOMB_HALF_SCREEN); // prędkość startu na tę wysokość (bez oporu)
const BOMB_FWD = 60;            // stały dodatek do przodu (przedmioty go skalują)
const BOMB_SIDE_STEEP = 0.5;    // wlot z góry: |vy| większe niż 0,5 × |vx| (inaczej uderzenie z boku/toczenie)
// Uderzenie z boku: bez przyspieszenia (v1 mnożyło ×1,15 → z przedmiotami nieskończony łańcuch
// przy ziemi), za to podrzut na ćwierć ekranu, żeby piłka wyszła z warstwy bomb.
const BOMB_SIDE_UP = Math.sqrt(2 * GRAVITY * BOMB_HALF_SCREEN / 2);
const BOMB_SIDE_FWD = 500;      // bomba z boku: dodatek poziomy, malejący do zera przy BOMB_ADD_REF (piłka bez pędu nie skacze
                                // w miejscu); bez blastFwd i bez zysku powyżej BOMB_ADD_REF, więc łańcuch przy ziemi nie rozpędza
// Bomby na ziemi i w powietrzu (na baloniku) to osobne strumienie. Średnio ta sama łączna gęstość
// co v2 (odstęp ~816, z tego 35% w powietrzu): ziemia ~1256 (30% stos/para), powietrze ~2333.
// MAP_DENSITY: bomby, paski i wyrzutnie rzadziej niż w v2 (decyzja użytkownika 19.10: bez przedmiotów było
// wszystkiego za dużo); odstępy tych strumieni dzielone przez 0,7. Chmary piłeczek bez zmian.
const MAP_DENSITY = 0.7;
const BOMB_GAP_LO = 300, BOMB_GAP_HI = 3256;
const AIRBOMB_GAP_LO = 600, AIRBOMB_GAP_HI = 4066;
const BOMB_AIR_LO = 150;        // 12,5 m
const BOMB_AIR_HI = 720;        // 60 m

// Pasek napędu (dawny pierścień): przelot w dowolnym kierunku wyrzuca do przodu i w górę (~30°).
const BOOST_R = 26;             // pół grubości strefy trafienia (rysowany pasek jest cieńszy)
const BOOST_W = 120;            // długość paska
const BOOST_MUL = 1.3;          // prędkość po przelocie = max(×1,3, BOOST_MIN)
const BOOST_MIN = 1800;
const BOOST_DX = 0.866;         // kierunek wylotu: cos 30°, sin 30° (stałe, bez trygonometrii)
const BOOST_DY = 0.5;

// Wyrzutnia (dawna platforma): lądowanie z góry wyrzuca w górę i w przód, raz; potem zwykłe odbicie.
const PLAT_UP = BOMB_MIN_UP;    // pół ekranu w górę
const PLAT_FWD = 250;           // dodatek do przodu
const PLAT_FWD_MIN = 700;       // poziomo co najmniej tyle (zjeżdża z wyrzutni)
const PICKUP_R = 24;            // promień pojedynczego Magic Find = rysowany (v5; wcześniej 12 przy rysunku 24)
const ARC_STEP = 26;            // odstęp kuleczek w łuku (rysunek nachodzi na siebie jak dotąd)
const ARC_FROM = 900;           // nagrody (bomby, łuki) zaczynają się za pierwszym ekranem, nie przed procą
// Strumienie obiektów (jednostki świata, 12 = 1 m): odstęp między kolejnymi i pasmo wysokości.
const ARC_LO = 120, ARC_HI = 700, ARC_GAP_LO = 900, ARC_GAP_HI = 2400;
const BOOST_LO = 100, BOOST_HI = 600, BOOST_GAP_LO = 1500, BOOST_GAP_HI = 4500;
const PLAT_LO = 150, PLAT_HI = 560, PLAT_GAP_LO = 1200, PLAT_GAP_HI = 3600;
// Trampolina (ziemia): odbicie bez straty poziomej, w górę max(uderzenie × TRAMP_GAIN, pół ekranu).
// Zysk tylko przy pierwszym odbiciu z danej trampoliny; kolejne ×TRAMP_AGAIN (piłka z vx≈0 nie skacze w miejscu).
const TRAMP_W = 140, TRAMP_H = 18;
const TRAMP_GAIN = 1.15, TRAMP_AGAIN = 0.8;
const TRAMP_GAP_LO = 6000, TRAMP_GAP_HI = 14000;     // bazowo ~1 na 830 m
const TRAMP_FWD = 500;          // poziomo co najmniej tyle po każdym odbiciu od trampoliny
// Dynamit (ziemia albo powietrze): wystrzał w górę na ~500 m i jednocześnie pełną prędkością w prawo
// (bez tego opór powietrza w długim locie zatrzymywał piłkę w miejscu). Pionowy sufit
// podniesiony do DYN_UP (s.capUp), dopóki vy nie spadnie poniżej zwykłego sufitu.
const DYN_R = 16;
const DYN_UP = 5150;
const DYN_FWD = MAX_SPEED;      // poziomo co najmniej tyle (przycięte do s.maxV)
const DYN_GAP_LO = 24000, DYN_GAP_HI = 48000;        // bazowo ~1 na 3 km
const DYN_AIR_LO = 150, DYN_AIR_HI = 600;
// Łańcuch (chainBlast): trafiona bomba odpala bomby w promieniu CHAIN_R (przechodnio).
const CHAIN_R = 80;
// Ptaki (100–250 m, pojedynczo, każdy na losowej wysokości): przelot = tylko MF (bez podrzutu i pchnięcia;
// z podrzutem gracz skakał z ptaka na ptaka).
// Od v7 ptak to awatar: 1./2./3. miejsce (BIRD_PLACE_P każde, gdy jest w s.owners) daje BIRD_MF, reszta BIRD_MF_BASE.
const BIRD_R = 30;
const BIRD_LO = 1200, BIRD_HI = 3000;
const BIRD_PLACE_P = 0.1;
const BIRD_MF = [40, 25, 15], BIRD_MF_BASE = 10;
const BIRD_GAP_LO = 300, BIRD_GAP_HI = 1100;   // odstęp ptaków wprost (bez MAP_DENSITY)
// Balony MF (kosmos i czerwień): girlanda prawie poziomo, lekko w dół w prawo (od v7; v6 pionowy sznur),
// każdy balon wart MFBAL_SPACE albo MFBAL_HELL wg wysokości.
// Górna granica pod szczytem dynamitu (~6240), żeby nie było martwych balonów.
const MFBAL_R = 40;
const MFBAL_LO = 3000, MFBAL_HI = 6000;
const MFBAL_DX = 110, MFBAL_DY_LO = -45, MFBAL_DY_HI = 10;   // krok girlandy (y losowy na każdy balon)
const MFBAL_GAP_LO = 600, MFBAL_GAP_HI = 1500;
const MFBAL_SPACE = 30, MFBAL_HELL = 50;
// Tylko do testów lokalnych (opts.dense, strona ?test=1): trampoliny i dynamit TEST_DENSE razy gęściej.
// Serwer nigdy nie przekazuje dense, więc taka partia nie przejdzie powtórki.
const TEST_DENSE = 1;   // 19.10: ?test=1 w zwykłej gęstości; zostawione na przyszłe testy
// Rozrzut pierwszego obiektu każdego strumienia za ARC_FROM (kolejność jak SPAWNERS).
const SPAWN_FIRST = { bomb: 300, airbomb: 900, arc: 600, boost: 1200, plat: 800, tramp: 4000, dyn: 12000, bird: 2000, mfbal: 2000 };

export const TICK = 120;             // 10 m między kreskami na ziemi
export const START_TICKS_BACK = 2;   // dwie pełne kratki zapasu = start na 3. kresce

// Modyfikatory przedmiotów: [wartość bez przedmiotów, min, max, całkowita?]. Klucze jak NEUTRAL_MODS
// w items.js (bez `better`, to nie fizyka). Sim.js nie zna afiksów — dostaje gotowe liczby i je przycina.
// Nowy mod = wpis tutaj + użycie w kroku + SIM_VER+1. Freq = dzielnik odstępu strumienia.
const MOD_RANGES = {
  groundBombFreq: [1, 1, 3], airBombFreq: [1, 1, 3], blastRadius: [1, 1, 2.5],
  blastUp: [1, 1, 2.5], blastFwd: [1, 1, 2.5], blastSide: [1, 1, 3],
  boostFreq: [1, 1, 3], boostSize: [1, 1, 2.5], boostPower: [1, 1, 2],
  platFreq: [1, 1, 3], platPower: [1, 1, 2], arcFreq: [1, 1, 3],
  sling: [1, 1, 1.5], puffUp: [1, 1, 2], puffFwd: [0, 0, 0.8], puffRegen: [1, 1, 3], freePuff: [0, 0, 0.6],
  gravity: [1, 0.5, 1], airDrag: [1, 0.5, 1], maxSpeed: [1, 1, 1.6],
  groundBounce: [1, 1, 1.6], bounceBrake: [1, 0.3, 1], rollLength: [1, 1, 2.5], pickupRange: [1, 1, 2],
  trampFreq: [1, 1, 6], dynamiteFreq: [1, 1, 6], chainBlast: [0, 0, 1, true], puffDelta: [0, -5, 0, true]
};
const DEFAULTS = {};
for (const k in MOD_RANGES) DEFAULTS[k] = MOD_RANGES[k][0];
export const DEFAULT_MODS = Object.freeze(DEFAULTS);

// Geometria procy, kulki, bomb, pierścieni i Magic Find — do rysowania w draw.js.
export const GEOM = {
  slingX: SLING_X,
  slingY: SLING_Y,
  maxPull: MAX_PULL,
  radius: PLAYER_R,
  bombRadius: BOMB_R,
  boostRadius: BOOST_R,
  boostMul: BOOST_MUL,
  boostW: BOOST_W,
  boostDir: [BOOST_DX, BOOST_DY],
  pickupRadius: PICKUP_R,
  trampW: TRAMP_W,
  trampH: TRAMP_H,
  dynRadius: DYN_R,
  birdRadius: BIRD_R,
  mfBalRadius: MFBAL_R,
  puffStart: PUFF_START,
  puffMax: PUFF_MAX,
  puffRegen: PUFF_REGEN
};


function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

// Liczba z zewnątrz (przedmioty) — odrzuca NaN i inne typy, potem przycina.
function num(v, def) {
  return typeof v === 'number' && v === v ? v : def;
}

// Jeden mod z zewnątrz (też dla aimFromDrag/previewShot, które dostają surowe mody).
function modVal(m, key) {
  const r = MOD_RANGES[key];
  let v = num(m && typeof m === 'object' ? m[key] : undefined, r[0]);
  if (r[3]) v = Math.floor(v + 0.5);
  return clamp(v, r[1], r[2]);
}

function normalizeMods(mods) {
  const out = {};
  for (const k in MOD_RANGES) out[k] = modVal(mods, k);
  return out;
}

// Właściciele łuków z rankingu: max 3 (1.–3. miejsce), mnożnik 1–8, kuleczki 2–12.
function normalizeOwners(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (let i = 0; i < list.length && i < 3; i++) {
    const o = list[i] || {};
    out.push({
      mult: clamp(num(o.mult, 1), 1, 8),
      size: clamp(Math.floor(num(o.size, 4)), 2, 12),
      uid: o.uid
    });
  }
  return out;
}

// Naciąg procy: qx,qy = wektor ciągnięcia w setnych pełnego naciągu (-100..100).
// Kierunek strzału jest przeciwny do naciągu, moc rośnie z długością. Bez trygonometrii.
// mods (opcjonalne): `sling` mnoży moc procy.
export function aimFromDrag(qx, qy, mods) {
  const x = clamp(Number(qx) || 0, -100, 100);
  const y = clamp(Number(qy) || 0, -100, 100);
  const len = Math.sqrt(x * x + y * y);
  const pull = Math.min(1, len / 100);
  if (len < 0.0001) {
    return { qx: 0, qy: 0, pull: 0, speed: 0, dx: 1, dy: 0, vx: 0, vy: 0 };
  }
  const dx = -x / len;
  const dy = -y / len;
  const speed = (SPEED_MIN + (SPEED - SPEED_MIN) * pull) * modVal(mods, 'sling');
  return { qx: x, qy: y, pull: pull, speed: speed, dx: dx, dy: dy, vx: dx * speed, vy: dy * speed };
}

// Podgląd toru (tylko do rysowania): punkty co `dt` sekundy, bez kolizji. mods jak w aimFromDrag
// (proca, grawitacja, opór powietrza).
export function previewShot(qx, qy, count, dt, mods) {
  const aim = aimFromDrag(qx, qy, mods);
  const pts = [];
  let x = SLING_X;
  let y = SLING_Y;
  let vx = aim.vx;
  let vy = aim.vy;
  const g = GRAVITY * modVal(mods, 'gravity');
  const damp = 1 - AIR_DRAG * modVal(mods, 'airDrag') * dt;
  for (let i = 0; i < count; i++) {
    vy -= g * dt;
    vx *= damp;
    vy *= damp;
    x += vx * dt;
    y += vy * dt;
    if (y < PLAYER_R) break;
    pts.push({ x: x, y: y });
  }
  return pts;
}

// LCG na liczbach całkowitych mieszczących się w double (bez operacji bitowych).
function lcg(v) {
  const n = v * 1664525 + 1013904223;
  return n - Math.floor(n / 4294967296) * 4294967296;
}

// Każdy strumień ma własny generator (ziarno = seed + nazwa strumienia), więc mapa zależy tylko
// od ziarna i modów, nie od tego, jak piłka się porusza. `play` = szanse gracza (freePuff):
// nic zależnego od kliknięć nie bierze liczb z generatorów mapy.
function streamSeed(seed, name) {
  let h = seed;
  for (let i = 0; i < name.length; i++) h = lcg(h + name.charCodeAt(i) * 7919);
  for (let i = 0; i < 8; i++) h = lcg(h);   // rozgrzewka: bliskie ziarna dają różne pierwsze liczby
  return h;
}

function rand(s, name) {
  const v = lcg(s.rngs[name]);
  s.rngs[name] = v;
  return v / 4294967296;
}

// Klaster Magic Find: kuleczki o równym odstępie (ARC_STEP) w prostym rzędzie.
// Kierunek od prawie poziomo do ostro w górę; lekkie wybrzuszenie (bow) daje
// delikatny łuk. Odstęp zawsze ARC_STEP, więc kuleczki nie skaczą.
// Właściciel łuku: 1. / 2. / 3. miejsce z rankingu albo zwykły gracz (-1).
// Liczba kuleczek i mnożnik zależą od miejsca (s.owners, z opcji create).
function spawnArc(s, x0) {
  const roll = rand(s, 'arc');
  let pick = -1;
  if (roll < 0.3 && s.owners[0]) pick = 0;
  else if (roll < 0.55 && s.owners[1]) pick = 1;
  else if (roll < 0.75 && s.owners[2]) pick = 2;
  const owner = pick >= 0 ? s.owners[pick] : PLAIN_OWNER;
  const n = owner.size;
  const len = ARC_STEP * (n - 1);
  const y0 = ARC_LO + rand(s, 'arc') * (ARC_HI - ARC_LO);
  const slope = -0.2 + rand(s, 'arc') * 2.8;           // nachylenie dy/dx: lekko w dół ... ostro w górę (~70°)
  // Lekkie wybrzuszenie tylko przy prawie poziomym rzędzie; przy stromym prosto.
  const bow = len * 0.08 * Math.max(0, 1 - slope * 0.4) * (y0 > (ARC_LO + ARC_HI) / 2 ? 1 : -1);
  const dx = 1 / Math.sqrt(1 + slope * slope);   // wektor jednostkowy bez trygonometrii
  const dy = slope * dx;
  const value = pick >= 0 ? PICKUP_PLACES[pick] : PICKUP_BASE;
  s.arcs.push({ left: n, size: n, total: value * n, owner: pick });
  const arc = s.arcs.length - 1;
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0.5;
    const bend = bow * 4 * t * (1 - t);          // 0 na końcach, max w środku
    s.pickups.push({
      x: x0 + len * t * dx - bend * dy,
      y: y0 + len * t * dy + bend * dx,
      r: PICKUP_R,
      value: value,
      owner: pick,
      arc: arc,
      alive: true
    });
  }
}

// Pasek napędu: jednorazowy, w powietrzu. boostSize wydłuża pasek.
function spawnBoost(s, x) {
  const y = BOOST_LO + rand(s, 'boost') * (BOOST_HI - BOOST_LO);
  s.boosts.push({ x: x, y: y, r: BOOST_R, w: BOOST_W * s.mods.boostSize, alive: true });
}

// Wyrzutnia: działa od góry, pierwsze lądowanie wyrzuca (used), potem zwykłe odbicie.
function spawnPlat(s, x) {
  const w = 110 + rand(s, 'plat') * 100;
  const py = PLAT_LO + rand(s, 'plat') * (PLAT_HI - PLAT_LO);
  s.obstacles.push({
    type: 'plat', x: x - w / 2, y: py, w, h: 16,
    rest: 0.9, power: 0, used: false, cool: 0
  });
}

// Bomba na ziemi: ~30% stos/para (odstęp 26–50), reszta odstęp BOMB_GAP_LO..HI.
function spawnBomb(s, bx) {
  s.bombs.push({ x: bx, y: BOMB_R, r: BOMB_R, air: false, alive: true });
  const gap = rand(s, 'bomb') < 0.3 ? 26 + rand(s, 'bomb') * 24 :
    BOMB_GAP_LO + rand(s, 'bomb') * (BOMB_GAP_HI - BOMB_GAP_LO);
  return gap / (s.mods.groundBombFreq * MAP_DENSITY);
}

// Bomba w powietrzu (na baloniku, 12,5–60 m).
function spawnAirBomb(s, bx) {
  const by = BOMB_AIR_LO + rand(s, 'airbomb') * (BOMB_AIR_HI - BOMB_AIR_LO);
  s.bombs.push({ x: bx, y: by, r: BOMB_R, air: true, alive: true });
  return (AIRBOMB_GAP_LO + rand(s, 'airbomb') * (AIRBOMB_GAP_HI - AIRBOMB_GAP_LO)) / (s.mods.airBombFreq * MAP_DENSITY);
}

// Trampolina na ziemi (x = środek). trampFreq dzieli odstęp.
function spawnTramp(s, x) {
  s.tramps.push({ x: x, w: TRAMP_W, h: TRAMP_H, used: false });
  return (TRAMP_GAP_LO + rand(s, 'tramp') * (TRAMP_GAP_HI - TRAMP_GAP_LO)) / (s.mods.trampFreq * s.dense);
}

// Dynamit: połowa na ziemi, połowa w powietrzu. dynamiteFreq dzieli odstęp.
function spawnDyn(s, x) {
  const air = rand(s, 'dyn') < 0.5;
  const y = air ? DYN_AIR_LO + rand(s, 'dyn') * (DYN_AIR_HI - DYN_AIR_LO) : DYN_R;
  s.dyns.push({ x: x, y: y, r: DYN_R, air: air, alive: true });
  return (DYN_GAP_LO + rand(s, 'dyn') * (DYN_GAP_HI - DYN_GAP_LO)) / (s.mods.dynamiteFreq * s.dense);
}

// Ptak: pojedynczo, każdy na własnej losowej wysokości w BIRD_LO–BIRD_HI (rozsypane po całym paśmie, bez szyku).
function spawnBird(s, x) {
  const y = BIRD_LO + rand(s, 'bird') * (BIRD_HI - BIRD_LO);
  const roll2 = rand(s, 'bird');   // losowane zawsze, więc mapa nie zależy od listy właścicieli
  let place = roll2 < BIRD_PLACE_P ? 0 : (roll2 < 2 * BIRD_PLACE_P ? 1 : (roll2 < 3 * BIRD_PLACE_P ? 2 : -1));
  const ow = place >= 0 ? s.owners[place] : null;
  if (!ow || ow.uid === undefined || ow.uid === null || ow.uid === '') place = -1;
  s.birds.push({ x: x, y: y, r: BIRD_R, place: place, value: place >= 0 ? BIRD_MF[place] : BIRD_MF_BASE, alive: true });
  return BIRD_GAP_LO + rand(s, 'bird') * (BIRD_GAP_HI - BIRD_GAP_LO);
}

// Girlanda balonów MF: 5–6 balonów na jednej linie, krok x stały, y losowy (prawie poziomo, częściej w dół).
// Zakres y0 z najgorszego przypadku, więc cała girlanda mieści się w MFBAL_LO–MFBAL_HI.
function spawnMfBal(s, x) {
  const n = rand(s, 'mfbal') < 0.5 ? 5 : 6;
  const lo = MFBAL_LO - MFBAL_DY_LO * (n - 1), hi = MFBAL_HI - MFBAL_DY_HI * (n - 1);
  let y = lo + rand(s, 'mfbal') * (hi - lo);
  for (let i = 0; i < n; i++) {
    if (i > 0) y += MFBAL_DY_LO + rand(s, 'mfbal') * (MFBAL_DY_HI - MFBAL_DY_LO);
    s.mfbals.push({ x: x + i * MFBAL_DX, y: y, r: MFBAL_R, value: y >= ZONE_HELL_Y ? MFBAL_HELL : MFBAL_SPACE, alive: true });
  }
  return MFBAL_GAP_LO + rand(s, 'mfbal') * (MFBAL_GAP_HI - MFBAL_GAP_LO);
}

// Każdy typ ma własny strumień (odstęp, pasmo wysokości, generator), więc obiekty nie chodzą „paczką”.
// Spawner zwraca odstęp do następnego obiektu (mod częstości go dzieli). Pierwsze obiekty za ARC_FROM.
// Nowy obiekt = nowy strumień + wpis w SPAWN_FIRST + SIM_VER+1.
const SPAWNERS = [
  ['bomb', spawnBomb],
  ['airbomb', spawnAirBomb],
  ['arc', (s, x) => { spawnArc(s, x); return (ARC_GAP_LO + rand(s, 'arc') * (ARC_GAP_HI - ARC_GAP_LO)) / s.mods.arcFreq; }],
  ['boost', (s, x) => { spawnBoost(s, x); return (BOOST_GAP_LO + rand(s, 'boost') * (BOOST_GAP_HI - BOOST_GAP_LO)) / (s.mods.boostFreq * MAP_DENSITY); }],
  ['plat', (s, x) => { spawnPlat(s, x); return (PLAT_GAP_LO + rand(s, 'plat') * (PLAT_GAP_HI - PLAT_GAP_LO)) / (s.mods.platFreq * MAP_DENSITY); }],
  ['tramp', spawnTramp],
  ['dyn', spawnDyn],
  // v6: dopisane do jeszcze niewdrożonej v6 (wyjątek od „nowy obiekt = SIM_VER+1”); na końcu, stare strumienie bez zmian.
  ['bird', spawnBird],
  ['mfbal', spawnMfBal]
];
const STREAMS = SPAWNERS.map((sp) => sp[0]).concat(['play']);
for (let k = 0; k < SPAWNERS.length; k++) {
  if (!SPAWN_FIRST[SPAWNERS[k][0]]) throw new Error('sim.js: brak SPAWN_FIRST dla ' + SPAWNERS[k][0]);
}
function spawnAhead(s) {
  const limit = s.x + 2600;
  for (let k = 0; k < SPAWNERS.length; k++) {
    const name = SPAWNERS[k][0];
    if (s.next[name] === 0) {
      const dense = name === 'tramp' || name === 'dyn' ? s.dense : 1;
      s.next[name] = ARC_FROM + rand(s, name) * SPAWN_FIRST[name] / dense;
    }
    while (s.next[name] < limit) s.next[name] += SPAWNERS[k][1](s, s.next[name]);
  }
}

export function create(seed, mods, opts) {
  let rng = Math.floor(Math.abs(seed));
  rng = rng - Math.floor(rng / 4294967296) * 4294967296;
  const m = normalizeMods(mods);
  const s = {
    seed: rng,
    rngs: null,
    step: 0,
    phase: 'aim',
    // Modyfikatory przedmiotów są częścią stanu — replay potrzebuje seed + mody + wejścia.
    mods: m,
    x: SLING_X,
    y: SLING_Y,
    px: SLING_X,
    py: SLING_Y,
    vx: 0,
    vy: 0,
    puffs: Math.max(0, PUFF_START + m.puffDelta),
    puffMax: Math.max(1, PUFF_MAX + m.puffDelta),
    puffsUsed: 0,
    puffCool: 0,
    regen: 0,                                            // kroki od ostatniego odnowienia (HUD: pasek)
    regenPeriod: Math.floor(PUFF_REGEN / m.puffRegen),   // co ile kroków wraca 1 podrzut
    maxV: MAX_SPEED * m.maxSpeed,
    capUp: 0,                                            // podniesiony sufit vy po dynamicie (0 = brak)
    dense: opts && opts.dense ? TEST_DENSE : 1,           // tylko testy lokalne (?test=1)
    grounded: false,
    restCount: 0,
    flySteps: 0,
    zoneT: 0,                                            // kroki w strefie MF od ostatniej nagrody
    maxX: 0,
    dist: 0,
    meters: 0,
    bounces: 0,
    bombsHit: 0,
    boostsUsed: 0,
    mf: 0,
    bombs: [],
    obstacles: [],
    boosts: [],
    pickups: [],
    arcs: [],
    tramps: [],
    dyns: [],
    birds: [],
    mfbals: [],
    birdsHit: 0,
    owners: normalizeOwners(opts && opts.owners),
    arcBonuses: 0,
    next: { bomb: 0, airbomb: 0, arc: 0, boost: 0, plat: 0, tramp: 0, dyn: 0, bird: 0, mfbal: 0 },   // x następnego obiektu każdego typu (0 = jeszcze nie zaczęty)
    fx: []
  };
  s.rngs = {};
  for (let i = 0; i < STREAMS.length; i++) s.rngs[STREAMS[i]] = streamSeed(rng, STREAMS[i]);
  spawnAhead(s);
  return s;
}

function toActions(input) {
  if (input === null || input === undefined) return [];
  if (typeof input === 'string') return [input];
  return input;
}

function launch(s, aim) {
  s.x = SLING_X;
  s.y = SLING_Y;
  s.px = s.x;
  s.py = s.y;
  s.vx = aim.vx;
  s.vy = aim.vy;
  s.phase = 'fly';
  s.puffMax = Math.max(1, PUFF_MAX + s.mods.puffDelta);
  s.puffs = Math.max(0, PUFF_START + s.mods.puffDelta);
  s.puffsUsed = 0;
  s.puffCool = 0;
  s.regen = 0;
  s.capUp = 0;
  s.bombsHit = 0;
  s.birdsHit = 0;
  s.boostsUsed = 0;
  s.mf = 0;
  s.restCount = 0;
  s.grounded = false;
  s.flySteps = 0;
  s.zoneT = 0;
  s.fx.push({ k: 'launch', x: s.x, y: s.y, v: aim.speed });
}

function aimStep(s, actions) {
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    if (!Array.isArray(a) || a[0] !== 'shot') continue;
    const aim = aimFromDrag(a[1], a[2], s.mods);
    if (aim.pull <= 0) continue;   // za krótki naciąg = brak strzału
    launch(s, aim);
    return;
  }
}

// Im mocniejsze uderzenie, tym wyższe odbicie (do BOUNCE_MAX).
function bounceRest(impact) {
  return GROUND_REST + (BOUNCE_MAX - GROUND_REST) * Math.min(1, impact / IMPACT_REF);
}

function hitGround(s) {
  if (s.y - PLAYER_R >= 0) return;
  s.y = PLAYER_R;
  if (s.vy < 0) {
    const impact = -s.vy;
    // groundBounce: wyżej (≤ 0,95); bounceBrake: mniejsza strata poziomej prędkości.
    s.vy = impact * Math.min(0.95, bounceRest(impact) * s.mods.groundBounce);
    s.vx *= 1 - (1 - GROUND_FRICTION) * s.mods.bounceBrake;
    s.grounded = true;
    if (impact > 90) {
      s.bounces++;
      s.fx.push({ k: 'bounce', x: s.x, y: s.y, v: impact });
    }
  } else {
    s.grounded = true;
  }
}



// Czy odcinek ruchu (px,py)→(x,y) dotknął okręgu (cx,cy,r)?
// Dzięki temu przy 3800 j/s kulka nie przeskakuje cienkich obiektów.
function segmentHit(s, cx, cy, rr) {
  const ex = s.x - s.px;
  const ey = s.y - s.py;
  const len2 = ex * ex + ey * ey;
  let t = 0;
  if (len2 > 0.0001) {
    t = ((cx - s.px) * ex + (cy - s.py) * ey) / len2;
    t = clamp(t, 0, 1);
  }
  const dx = s.px + ex * t - cx;
  const dy = s.py + ey * t - cy;
  return dx * dx + dy * dy <= rr * rr;
}

// Bomba leży na ziemi. Wybuch jest proporcjonalny do impetu wejścia:
// - szybki, poziomy wlot → mocny, poziomy wylot,
// - spadanie na bombę → bardzo wysoki wyrzut w górę,
// - wolne toczenie → tylko minimalny podrzut.
// Kierunek wylotu to kierunek lotu (z odbiciem pionu), nie odbicie od ściany.
// Sufit prędkości w górę: zwykły albo podniesiony przez dynamit.
function upCap(s) {
  return Math.max(s.maxV, s.capUp);
}

// Łańcuch: bomby w promieniu CHAIN_R od wybuchającej wybuchają też (przechodnio). Zwraca ich liczbę.
function chainBombs(s, b) {
  const reach = CHAIN_R * s.mods.blastRadius;
  const queue = [b];
  let n = 0;
  while (queue.length) {
    const c = queue.pop();
    for (let i = 0; i < s.bombs.length; i++) {
      const o = s.bombs[i];
      if (!o.alive || o === b || Math.abs(o.x - c.x) > reach) continue;
      const dx = o.x - c.x, dy = o.y - c.y;
      if (dx * dx + dy * dy > reach * reach) continue;
      o.alive = false;
      n++;
      queue.push(o);
      s.fx.push({ k: 'boom', x: o.x, y: o.y, r: o.r * s.mods.blastRadius, v: 0, chain: n });
    }
  }
  return n;
}

function hitBomb(s, b) {
  if (!b.alive) return false;
  const blastR = b.r * s.mods.blastRadius;
  if (!segmentHit(s, b.x, b.y, PLAYER_R + blastR)) return false;
  // Łańcuch: każda dodatkowa bomba +100% do dodatku z wybuchu i +1 podrzut (sufit jak zwykle).
  b.alive = false;
  const k = 1 + (s.mods.chainBlast > 0 ? chainBombs(s, b) : 0);

  // Bomba na ziemi, uderzenie z boku albo toczenie: podrzut na ćwierć ekranu i dodatek poziomy BOMB_SIDE_FWD (malejący z prędkością).
  // Mocny wyrzut daje dopiero spadek z góry (stromo w dół: |vy| > BOMB_SIDE_STEEP × |vx|).
  // Bomba w powietrzu zawsze wybucha „mocno” (trafić ją to już celowanie).
  // blastSide (siła przy toczeniu) mnoży ten podrzut.
  if (!b.air && -s.vy <= BOMB_SIDE_STEEP * Math.abs(s.vx)) {
    s.vy = Math.min(upCap(s), Math.max(s.vy, BOMB_SIDE_UP * s.mods.blastSide * k) * s.mods.blastUp);
    s.vx = Math.min(s.maxV, s.vx + BOMB_SIDE_FWD * Math.max(0, 1 - s.vx / BOMB_ADD_REF));
    s.grounded = false;
    s.bombsHit += k;
    s.puffs = Math.min(s.puffMax, s.puffs + k);
    s.fx.push({
      k: 'boom', x: b.x, y: b.y,
      r: blastR,
      v: Math.sqrt(s.vx * s.vx + s.vy * s.vy)
    });
    return true;
  }

  const speedIn = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
  // Mocniejszy impet = większy mnożnik lotu. Kąt: pion się odwraca (ostro w dół
  // → ostro w górę), poziom zostaje. Każdy wybuch daje minimum pół ekranu w górę.
  // Mnożnik rośnie coraz wolniej (sufit ×(1 + BOMB_GAIN)), żeby nie lecieć w nieskończoność.
  const mult = 1 + k * BOMB_GAIN * speedIn / (speedIn + BOMB_REF);
  // Słaby wlot: dodatek poziomy, bo samo mnożenie przy małej prędkości prawie nic nie daje.
  const add = k * BOMB_ADD * Math.max(0, 1 - speedIn / BOMB_ADD_REF) * s.mods.blastFwd;

  // Bomba w powietrzu: pion z impetu niezależnie od kierunku (wlot od dołu też wyrzuca w górę),
  // poziom nigdy nie maleje (wlot z boku nie odpycha do tyłu).
  const vyIn = b.air ? Math.abs(s.vy) : -s.vy;
  s.vx = Math.max(80, s.vx * mult, b.air ? s.vx : 80) + add + k * BOMB_FWD * s.mods.blastFwd;
  s.vy = Math.max(BOMB_MIN_UP, vyIn * BOMB_KEEP * mult) * s.mods.blastUp;
  s.vx = clamp(s.vx, 80, s.maxV);
  s.vy = clamp(s.vy, 0, upCap(s));
  s.grounded = false;
  s.bombsHit += k;
  s.puffs = Math.min(s.puffMax, s.puffs + k);
  s.fx.push({
    k: 'boom', x: b.x, y: b.y,
    r: blastR,
    v: Math.sqrt(s.vx * s.vx + s.vy * s.vy)
  });
  return true;
}

// Czy piłka (w punkcie x,y) dotyka poziomego paska o środku (cx,cy), długości w i pół grubości r?
function nearBar(x, y, cx, cy, w, r) {
  const dx = Math.max(0, Math.abs(x - cx) - w / 2);
  const dy = y - cy;
  const rr = r + PLAYER_R;
  return dx * dx + dy * dy <= rr * rr;
}

// Pasek napędu: przelot w dowolnym kierunku (z góry, z dołu, z boku) wyrzuca do przodu
// i w górę pod stałym kątem, z prędkością max(×BOOST_MUL, BOOST_MIN). Jednorazowy.
// Krok ruchu ≤ 32 jedn. < promień piłki, więc wystarczą trzy punkty odcinka.
function hitBoosts(s) {
  for (let i = 0; i < s.boosts.length; i++) {
    const o = s.boosts[i];
    if (!o.alive || o.x + o.w < s.x - 400) continue;
    if (!nearBar(s.x, s.y, o.x, o.y, o.w, o.r) &&
      !nearBar((s.x + s.px) / 2, (s.y + s.py) / 2, o.x, o.y, o.w, o.r) &&
      !nearBar(s.px, s.py, o.x, o.y, o.w, o.r)) continue;
    o.alive = false;
    const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
    const p = s.mods.boostPower;
    const out = Math.min(s.maxV, Math.max(sp * BOOST_MUL * p, BOOST_MIN * p));
    s.vx = out * BOOST_DX;
    s.vy = out * BOOST_DY;
    s.grounded = false;
    s.boostsUsed++;
    s.fx.push({
      k: 'boost', x: o.x, y: o.y,
      v: Math.sqrt(s.vx * s.vx + s.vy * s.vy)
    });
  }
}

// Dynamit: trafienie z dowolnej strony wystrzeliwuje w górę na ~500 m i pełną prędkością w prawo.
function hitDyns(s) {
  for (let i = 0; i < s.dyns.length; i++) {
    const d = s.dyns[i];
    if (!d.alive || d.x + d.r < s.x - 400) continue;
    if (!segmentHit(s, d.x, d.y, PLAYER_R + d.r)) continue;
    d.alive = false;
    s.capUp = DYN_UP;
    s.vy = Math.max(s.vy, DYN_UP);
    s.vx = Math.min(s.maxV, Math.max(s.vx, DYN_FWD));
    s.grounded = false;
    s.puffs = Math.min(s.puffMax, s.puffs + 1);
    s.fx.push({ k: 'dynamite', x: d.x, y: d.y, v: Math.sqrt(s.vx * s.vx + s.vy * s.vy) });
  }
}

// Ptak: przelot przez ptaka (z dowolnej strony) daje tylko MF, bez wpływu na ruch i podrzuty (od 20.10).
function hitBirds(s) {
  for (let i = 0; i < s.birds.length; i++) {
    const b = s.birds[i];
    if (!b.alive || b.x + b.r < s.x - 400) continue;
    if (!segmentHit(s, b.x, b.y, PLAYER_R + b.r)) continue;
    b.alive = false;
    s.birdsHit++;
    s.mf += b.value;
    s.fx.push({ k: 'bird', x: b.x, y: b.y, v: Math.sqrt(s.vx * s.vx + s.vy * s.vy), place: b.place });
    s.fx.push({ k: 'mf', x: b.x, y: b.y, v: b.value, bird: true });
  }
}

// Balon MF: zbierany jak kuleczka (pickupRange), bez wpływu na ruch.
function collectMfBals(s) {
  for (let i = 0; i < s.mfbals.length; i++) {
    const b = s.mfbals[i];
    if (!b.alive || b.x + b.r < s.x - 400) continue;
    if (!segmentHit(s, b.x, b.y, b.r * s.mods.pickupRange + PLAYER_R)) continue;
    b.alive = false;
    s.mf += b.value;
    s.fx.push({ k: 'mf', x: b.x, y: b.y, v: b.value, bal: true });
  }
}

// Trampolina: od góry albo wtoczenie się na nią. Pierwsze odbicie max(uderzenie × TRAMP_GAIN,
// pół ekranu), kolejne na tej samej ×TRAMP_AGAIN. Poziomo co najmniej TRAMP_FWD. Przed hitGround.
function hitTramps(s) {
  if (s.vy > 0) return;
  for (let i = 0; i < s.tramps.length; i++) {
    const t = s.tramps[i];
    if (Math.abs(s.x - t.x) > t.w / 2) continue;
    if (s.y - PLAYER_R > t.h) continue;
    const impact = -s.vy;
    s.y = t.h + PLAYER_R;
    s.vx = Math.min(s.maxV, Math.max(s.vx, TRAMP_FWD));
    if (!t.used) {
      t.used = true;
      s.bounces++;
      s.vy = Math.min(upCap(s), Math.max(impact * TRAMP_GAIN, BOMB_MIN_UP));
      s.fx.push({ k: 'tramp', x: t.x, y: t.h, v: s.vy });
      return;
    }
    s.vy = impact * TRAMP_AGAIN;
    s.grounded = true;
    if (impact > 90) {
      s.bounces++;
      s.fx.push({ k: 'bounce', x: s.x, y: s.y, v: impact });
    }
    return;
  }
}

// Magic Find: zbieranie odcinkiem ruchu, każdy punkt tylko raz.
function collectPickups(s) {
  for (let i = 0; i < s.pickups.length; i++) {
    const p = s.pickups[i];
    if (!p.alive || p.x + p.r < s.x - 400) continue;
    if (!segmentHit(s, p.x, p.y, p.r * s.mods.pickupRange + PLAYER_R)) continue;
    p.alive = false;
    s.mf += p.value;
    s.fx.push({ k: 'mf', x: p.x, y: p.y, v: p.value, owner: p.owner, arc: p.arc });
    // Cały łuk zebrany → suma łuku dostaje dopłatę, wynik łuku = suma × arcMult(miejsce).
    const arc = p.arc === undefined ? null : s.arcs[p.arc];
    if (!arc) continue;
    arc.left--;
    if (arc.left === 0) {
      const mult = arcMult(arc.owner);
      const bonus = arc.total * (mult - 1);
      s.mf += bonus;
      s.arcBonuses++;
      s.fx.push({ k: 'arc', x: p.x, y: p.y, v: arc.total, bonus: bonus, mult: mult, owner: arc.owner, n: arc.size, each: p.value });
    }
  }
}

// Czyszczenie list (wydajność powtórki na serwerze: 10 min lotu = tysiące bomb i kulek).
// Bez zmiany wyniku: vx raz nieujemne już nigdy nie spada poniżej zera (podrzut dodaje,
// bomba daje ≥ 80, pozostałe zmiany tylko mnożą przez dodatnie), więc x już nie maleje,
// a obiekty dalej niż PRUNE_BACK za piłką i tak są pomijane (pętle: 400–500 jedn. za nią).
// Kolejność pozostałych zostaje (pętla bomb kończy się na pierwszym trafieniu).
const PRUNE_EVERY = 120;
const PRUNE_BACK = 3000;        // z zapasem także dla rysowania (widok sięga ~1400 jedn.)
function pruneList(list, limit, wide) {
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    const o = list[i];
    if (o.x + (wide ? o.w : o.r) >= limit) list[n++] = o;
  }
  list.length = n;
}
function pruneBehind(s) {
  if (s.vx < 0) return;
  const limit = s.x - PRUNE_BACK;
  pruneList(s.bombs, limit, false);
  pruneList(s.pickups, limit, false);
  pruneList(s.boosts, limit, false);
  pruneList(s.obstacles, limit, true);
  pruneList(s.tramps, limit, true);
  pruneList(s.dyns, limit, false);
  pruneList(s.birds, limit, false);
  pruneList(s.mfbals, limit, false);
}

// Platformy działają tylko od góry (one-way): ląduje się na nich, lecąc w dół,
// a spod spodu przelatuje się swobodnie. Zero teleportacji na górę.
function hitPlatform(s, o) {
  if (s.vy >= 0) return;                   // rośnie → nie dotyka góry platformy
  const top = o.y + o.h;
  if (s.x + PLAYER_R < o.x || s.x - PLAYER_R > o.x + o.w) return;
  if (s.py - PLAYER_R < top) return;       // w poprzednim kroku był pod spodem → ignoruj
  if (s.y - PLAYER_R > top) return;        // jeszcze nie dotarł do góry
  const impact = -s.vy;
  s.y = top + PLAYER_R;
  if (!o.used) {
    // Wyrzutnia: pierwsze lądowanie wyrzuca w górę (min. pół ekranu) i w przód. Jednorazowa,
    // żeby szereg wyrzutni nie niósł piłki bez grania.
    o.used = true;
    const p = s.mods.platPower;
    s.vy = Math.min(s.maxV, Math.max(impact * o.rest, PLAT_UP * p));
    s.vx = Math.min(s.maxV, Math.max(s.vx + PLAT_FWD * p, PLAT_FWD_MIN));
    s.bounces++;
    s.fx.push({ k: 'launchpad', x: s.x, y: top, v: Math.sqrt(s.vx * s.vx + s.vy * s.vy) });
    return;
  }
  s.vy = impact * o.rest;
  s.vx *= 0.96;
  s.grounded = true;
  if (impact > 90) {
    s.bounces++;
    s.fx.push({ k: 'bounce', x: s.x, y: s.y, v: impact });
  }
}

function flyStep(s, actions) {
  // 0) wejście: tylko podrzut (klik / tap / spacja). Bez trzymania i puszczania.
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    if (!Array.isArray(a) || a[0] !== 'puff') continue;
    if (s.puffs <= 0 || s.puffCool > 0) continue;
    const up = PUFF_UP * s.mods.puffUp;
    s.vy = Math.min(upCap(s), Math.max(s.vy, up));
    // puffFwd = ułamek bazowej siły podrzutu w górę (samo PUFF_FWD to prawie zero).
    s.vx = clamp(s.vx + PUFF_FWD + PUFF_UP * s.mods.puffFwd, -s.maxV, s.maxV);
    // freePuff: szansa z generatora `play` (nie z mapy), że ładunek zostaje.
    const free = s.mods.freePuff > 0 && rand(s, 'play') < s.mods.freePuff;
    if (!free) s.puffs--;
    s.puffsUsed++;
    s.puffCool = PUFF_COOL;
    s.grounded = false;
    s.fx.push({ k: 'puff', x: s.x, y: s.y, v: up, free: free });
  }
  if (s.puffCool > 0) s.puffCool--;

  // Odnawianie: 1 podrzut co regenPeriod kroków lotu, do puffMax.
  if (s.puffs < s.puffMax) {
    s.regen++;
    if (s.regen >= s.regenPeriod) {
      s.regen = 0;
      s.puffs++;
      s.fx.push({ k: 'regen', x: s.x, y: s.y, v: s.puffs });
    }
  } else {
    s.regen = 0;
  }

  s.grounded = false;

  // 1) grawitacja + opór powietrza
  s.vy -= GRAVITY * s.mods.gravity * DT;
  const damp = 1 - AIR_DRAG * s.mods.airDrag * DT;
  s.vx *= damp;
  s.vy *= damp;
  s.vx = clamp(s.vx, -s.maxV, s.maxV);
  s.vy = clamp(s.vy, -s.maxV, upCap(s));
  if (s.capUp > 0 && s.vy < s.maxV) s.capUp = 0;   // po dynamicie: zwykły sufit wraca, gdy vy spadnie

  // 2) ruch
  s.px = s.x;
  s.py = s.y;
  s.x += s.vx * DT;
  s.y += s.vy * DT;
  if (s.x > s.maxX) s.maxX = s.x;

  spawnAhead(s);

  // 3) kolizje: najpierw zbieranie, potem bomby (wybuch ma pierwszeństwo przed ziemią)
  collectPickups(s);
  collectMfBals(s);
  hitBoosts(s);
  hitDyns(s);
  hitBirds(s);

  let boomed = false;
  for (let i = 0; i < s.bombs.length; i++) {
    const b = s.bombs[i];
    if (!b.alive || b.x + b.r < s.x - 400) continue;
    if (hitBomb(s, b)) {
      boomed = true;
      break;
    }
  }

  hitTramps(s);
  hitGround(s);
  for (let i = 0; i < s.obstacles.length; i++) {
    const o = s.obstacles[i];
    if (o.x + o.w < s.x - 500) continue;
    hitPlatform(s, o);
  }

  if (s.grounded && !boomed) {
    s.vx *= Math.max(0, 1 - ROLL_FRICTION / s.mods.rollLength * DT);
  }

  // 3b) MF w strefach: co ZONE_EVERY kroków w strefie; wyjście ze strefy zeruje licznik.
  const zone = s.y >= ZONE_HELL_Y ? 2 : (s.y >= ZONE_SPACE_Y ? 1 : 0);
  if (zone) {
    s.zoneT++;
    if (s.zoneT >= ZONE_EVERY) {
      s.zoneT = 0;
      s.mf += zone;
      s.fx.push({ k: 'zone', x: s.x, y: s.y, v: zone });
    }
  } else s.zoneT = 0;

  // 4) koniec partii
  const sp2 = s.vx * s.vx + s.vy * s.vy;
  if (s.grounded && sp2 < REST_SPEED * REST_SPEED) s.restCount++;
  else s.restCount = 0;

  s.flySteps++;
  s.dist = s.maxX;
  s.meters = Math.floor(s.dist / 12);
  if (s.flySteps % PRUNE_EVERY === 0) pruneBehind(s);

  if (s.restCount > REST_STEPS || s.flySteps > MAX_FLY_STEPS) {
    s.phase = 'over';
  }
}

export function step(state, input) {
  const s = state;
  s.fx.length = 0;
  const actions = toActions(input);
  if (s.phase === 'aim') aimStep(s, actions);
  else if (s.phase === 'fly') flyStep(s, actions);
  s.step++;
  return s;
}

