// sim.js — cała fizyka lotu. Deterministyczne: bez DOM, bez czasu, bez Math.random.
// Dozwolone operacje: + - * / oraz Math.sqrt/abs/floor/min/max.
// Kąty trzymamy jako wektory (stała tabela + liniowa interpolacja), bez trygonometrii.

export const DT = 1 / 120;
// Wersja fizyki: podbij przy każdej zmianie wyniku lotu (serwer odtwarza partie sim_v{N}.js).
export const SIM_VER = 2;   // v2: bomba z boku bez przyspieszenia, bomby w powietrzu, wyrzutnie, paski napędu, osobne strumienie obiektów

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
const MAX_FLY_STEPS = 120 * 600; // bezpiecznik: 10 min lotu (wcześniej 20 s — ucinało długie loty)
const MAX_SPEED = 3800;         // sufit po łańcuchu bomb i boosterów (wyżej niż moc procy +35%)

const SLING_X = 0;
const SLING_Y = 92;             // środek kulki w łyżce procy
const MAX_PULL = 140;           // pełny naciąg w jednostkach świata (= 100)
const SPEED_MIN = 150;          // słaby naciąg nadal ma lecieć, nie spadać

// Moc procy. Bomby, boostery i przedmioty mogą wynik przebić.
export const SPEED = 2970;      // +35% względem poprzednich 2200

// Magic Find: każda kuleczka łuku daje PICKUP_BASE × mnożnik właściciela (miejsce w rankingu).
// Zebranie całego łuku mnoży sumę łuku przez ARC_MULT (wynik łuku = suma × 10).
export const PICKUP_BASE = 2;
export const ARC_MULT = 10;
// Łuk bez właściciela z rankingu: zwykły gracz (×1, 4 kuleczki).
const PLAIN_OWNER = Object.freeze({ mult: 1, size: 4 });

const PUFF_UP = 900;            // klik: podrzut ustawia prędkość w górę (bez kumulacji) — 3× mocniej niż 300
const PUFF_FWD = 8;             // podrzut lekko popycha do przodu (nie jest napędem)
const PUFF_COOL = 12;           // 0,1 s między podrzutami (kroki)
const PUFF_START = 5;
const PUFF_MAX = 6;             // limit podrzutów (bomba dodaje +1)

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
const BOMB_AIR_CHANCE = 0.35;   // część bomb wisi w powietrzu (na baloniku)
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
const PICKUP_R = 12;            // promień pojedynczego Magic Find
const ARC_STEP = 26;            // odstęp kuleczek w łuku: prawie się stykają (promień 16 + 12 = 28)
const ARC_FROM = 900;           // nagrody (bomby, łuki) zaczynają się za pierwszym ekranem, nie przed procą
// Strumienie obiektów (jednostki świata, 12 = 1 m): odstęp między kolejnymi i pasmo wysokości.
const ARC_LO = 120, ARC_HI = 700, ARC_GAP_LO = 900, ARC_GAP_HI = 2400;
const BOOST_LO = 100, BOOST_HI = 600, BOOST_GAP_LO = 1500, BOOST_GAP_HI = 4500;
const PLAT_LO = 150, PLAT_HI = 560, PLAT_GAP_LO = 1200, PLAT_GAP_HI = 3600;
const SPAWN_FIRST = [300, 600, 1200, 800];   // rozrzut pierwszego obiektu każdego typu za ARC_FROM

export const TICK = 120;             // 10 m między kreskami na ziemi
export const START_TICKS_BACK = 2;   // dwie pełne kratki zapasu = start na 3. kresce

// Modyfikatory przedmiotów. Domyślne wartości = brak przedmiotów (stare zachowanie).
// Sim.js nie zna katalogu przedmiotów — dostaje gotowe liczby i tylko je przycina.
export const DEFAULT_MODS = Object.freeze({
  bombDensity: 1,
  extraBombChance: 0,
  blastRadius: 1,
  blastUp: 1,
  blastFwd: 1,
  blastPush: 1,
  bombPuff: 1
});

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
  puffStart: PUFF_START,
  puffMax: PUFF_MAX
};


function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

// Liczba z zewnątrz (przedmioty) — odrzuca NaN i inne typy, potem przycina.
function num(v, def) {
  return typeof v === 'number' && v === v ? v : def;
}

function normalizeMods(mods) {
  const m = mods && typeof mods === 'object' ? mods : {};
  return {
    bombDensity: clamp(num(m.bombDensity, 1), 0.5, 2),
    extraBombChance: clamp(num(m.extraBombChance, 0), 0, 0.9),
    blastRadius: clamp(num(m.blastRadius, 1), 1, 2.5),
    blastUp: clamp(num(m.blastUp, 1), 0.5, 2.5),
    blastFwd: clamp(num(m.blastFwd, 1), 0.5, 2.5),
    blastPush: clamp(num(m.blastPush, 1), 0.5, 2.5),
    bombPuff: clamp(Math.floor(num(m.bombPuff, 1) + 0.5), 1, 3)
  };
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
export function aimFromDrag(qx, qy) {
  const x = clamp(Number(qx) || 0, -100, 100);
  const y = clamp(Number(qy) || 0, -100, 100);
  const len = Math.sqrt(x * x + y * y);
  const pull = Math.min(1, len / 100);
  if (len < 0.0001) {
    return { qx: 0, qy: 0, pull: 0, speed: 0, dx: 1, dy: 0, vx: 0, vy: 0 };
  }
  const dx = -x / len;
  const dy = -y / len;
  const speed = SPEED_MIN + (SPEED - SPEED_MIN) * pull;
  return { qx: x, qy: y, pull: pull, speed: speed, dx: dx, dy: dy, vx: dx * speed, vy: dy * speed };
}

// Podgląd toru (tylko do rysowania): punkty co `dt` sekundy, bez kolizji.
export function previewShot(qx, qy, count, dt) {
  const aim = aimFromDrag(qx, qy);
  const pts = [];
  let x = SLING_X;
  let y = SLING_Y;
  let vx = aim.vx;
  let vy = aim.vy;
  const damp = 1 - AIR_DRAG * dt;
  for (let i = 0; i < count; i++) {
    vy -= GRAVITY * dt;
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
function rand(s) {
  const n = s.rng * 1664525 + 1013904223;
  s.rng = n - Math.floor(n / 4294967296) * 4294967296;
  return s.rng / 4294967296;
}

// Klaster Magic Find: kuleczki o równym odstępie (ARC_STEP) w prostym rzędzie.
// Kierunek od prawie poziomo do ostro w górę; lekkie wybrzuszenie (bow) daje
// delikatny łuk. Odstęp zawsze ARC_STEP, więc kuleczki nie skaczą.
// Właściciel łuku: 1. / 2. / 3. miejsce z rankingu albo zwykły gracz (-1).
// Liczba kuleczek i mnożnik zależą od miejsca (s.owners, z opcji create).
function spawnArc(s, x0) {
  const roll = rand(s);
  let pick = -1;
  if (roll < 0.3 && s.owners[0]) pick = 0;
  else if (roll < 0.55 && s.owners[1]) pick = 1;
  else if (roll < 0.75 && s.owners[2]) pick = 2;
  const owner = pick >= 0 ? s.owners[pick] : PLAIN_OWNER;
  const n = owner.size;
  const len = ARC_STEP * (n - 1);
  const y0 = ARC_LO + rand(s) * (ARC_HI - ARC_LO);
  const slope = -0.2 + rand(s) * 2.8;            // nachylenie dy/dx: lekko w dół ... ostro w górę (~70°)
  // Lekkie wybrzuszenie tylko przy prawie poziomym rzędzie; przy stromym prosto.
  const bow = len * 0.08 * Math.max(0, 1 - slope * 0.4) * (y0 > (ARC_LO + ARC_HI) / 2 ? 1 : -1);
  const dx = 1 / Math.sqrt(1 + slope * slope);   // wektor jednostkowy bez trygonometrii
  const dy = slope * dx;
  const value = PICKUP_BASE * owner.mult;
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

// Pasek napędu: jednorazowy, w powietrzu.
function spawnBoost(s, x) {
  s.boosts.push({ x: x, y: BOOST_LO + rand(s) * (BOOST_HI - BOOST_LO), r: BOOST_R, w: BOOST_W, alive: true });
}

// Wyrzutnia: działa od góry, pierwsze lądowanie wyrzuca (used), potem zwykłe odbicie.
function spawnPlat(s, x) {
  const w = 110 + rand(s) * 100;
  const py = PLAT_LO + rand(s) * (PLAT_HI - PLAT_LO);
  s.obstacles.push({
    type: 'plat', x: x - w / 2, y: py, w, h: 16,
    rest: 0.9, power: 0, used: false, cool: 0
  });
}

// Bomba: ~30% stos/para (odstęp 26–50), reszta odstęp 300–2000; gęstość (przedmiot) skraca odstępy.
// Część bomb wisi w powietrzu (12,5–60 m).
function spawnBomb(s, bx) {
  const air = rand(s) < BOMB_AIR_CHANCE;
  const by = air ? BOMB_AIR_LO + rand(s) * (BOMB_AIR_HI - BOMB_AIR_LO) : BOMB_R;
  s.bombs.push({ x: bx, y: by, r: BOMB_R, air: air, alive: true });
  if (s.mods.extraBombChance > 0 && rand(s) < s.mods.extraBombChance) {
    const ex = bx + 60 + rand(s) * 50;
    s.bombs.push({ x: ex, y: by, r: BOMB_R, air: air, alive: true });
  }
  const gap = rand(s) < 0.3 ? 26 + rand(s) * 24 : 300 + rand(s) * 1700;
  return gap / s.mods.bombDensity;
}

// Każdy typ ma własny strumień (odstęp i pasmo wysokości), więc obiekty nie chodzą „paczką” za bombą.
// Kolejność typów stała → rozkład z ziarna powtarzalny. Pierwsze obiekty za ekranem startu (ARC_FROM).
const SPAWNERS = [
  ['bomb', spawnBomb],
  ['arc', (s, x) => { spawnArc(s, x); return ARC_GAP_LO + rand(s) * (ARC_GAP_HI - ARC_GAP_LO); }],
  ['boost', (s, x) => { spawnBoost(s, x); return BOOST_GAP_LO + rand(s) * (BOOST_GAP_HI - BOOST_GAP_LO); }],
  ['plat', (s, x) => { spawnPlat(s, x); return PLAT_GAP_LO + rand(s) * (PLAT_GAP_HI - PLAT_GAP_LO); }]
];
function spawnAhead(s) {
  const limit = s.x + 2600;
  for (let k = 0; k < SPAWNERS.length; k++) {
    const name = SPAWNERS[k][0];
    if (s.next[name] === 0) s.next[name] = ARC_FROM + rand(s) * SPAWN_FIRST[k];
    while (s.next[name] < limit) s.next[name] += SPAWNERS[k][1](s, s.next[name]);
  }
}

export function create(seed, mods, opts) {
  let rng = Math.floor(Math.abs(seed));
  rng = rng - Math.floor(rng / 4294967296) * 4294967296;
  const m = normalizeMods(mods);
  const s = {
    seed: rng,
    rng: rng,
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
    puffs: PUFF_START,
    puffMax: PUFF_MAX,
    puffsUsed: 0,
    puffCool: 0,
    grounded: false,
    restCount: 0,
    flySteps: 0,
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
    owners: normalizeOwners(opts && opts.owners),
    arcBonuses: 0,
    next: { bomb: 0, arc: 0, boost: 0, plat: 0 },   // x następnego obiektu każdego typu (0 = jeszcze nie zaczęty)
    fx: []
  };
  // Rozgrzewka LCG: bliskie ziarna dają inaczej podobne pierwsze liczby (bomby by się powtarzały).
  for (let i = 0; i < 8; i++) rand(s);
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
  s.puffs = PUFF_START;
  s.puffsUsed = 0;
  s.puffCool = 0;
  s.bombsHit = 0;
  s.boostsUsed = 0;
  s.mf = 0;
  s.restCount = 0;
  s.grounded = false;
  s.flySteps = 0;
  s.fx.push({ k: 'launch', x: s.x, y: s.y, v: aim.speed });
}

function aimStep(s, actions) {
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    if (!Array.isArray(a) || a[0] !== 'shot') continue;
    const aim = aimFromDrag(a[1], a[2]);
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
    s.vy = impact * bounceRest(impact);
    s.vx *= GROUND_FRICTION;
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
function hitBomb(s, b) {
  if (!b.alive) return false;
  const blastR = b.r * s.mods.blastRadius;
  if (!segmentHit(s, b.x, b.y, PLAYER_R + blastR)) return false;

  // Bomba na ziemi, uderzenie z boku albo toczenie: podrzut na ćwierć ekranu, prędkość pozioma bez zmian.
  // Mocny wyrzut daje dopiero spadek z góry (stromo w dół: |vy| > BOMB_SIDE_STEEP × |vx|).
  // Bomba w powietrzu zawsze wybucha „mocno” (trafić ją to już celowanie).
  if (!b.air && -s.vy <= BOMB_SIDE_STEEP * Math.abs(s.vx)) {
    b.alive = false;
    s.vy = Math.max(s.vy, BOMB_SIDE_UP) * s.mods.blastUp;
    s.grounded = false;
    s.bombsHit++;
    s.puffs = Math.min(s.puffMax, s.puffs + s.mods.bombPuff);
    s.fx.push({
      k: 'boom', x: b.x, y: b.y,
      r: blastR,
      v: Math.sqrt(s.vx * s.vx + s.vy * s.vy)
    });
    return true;
  }

  const speedIn = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
  const push = s.mods.blastPush;
  // Mocniejszy impet = większy mnożnik lotu. Kąt: pion się odwraca (ostro w dół
  // → ostro w górę), poziom zostaje. Każdy wybuch daje minimum pół ekranu w górę.
  // Mnożnik rośnie coraz wolniej (sufit ×(1 + BOMB_GAIN)), żeby nie lecieć w nieskończoność.
  const mult = (1 + BOMB_GAIN * speedIn / (speedIn + BOMB_REF)) * push;
  // Słaby wlot: dodatek poziomy, bo samo mnożenie przy małej prędkości prawie nic nie daje.
  const add = BOMB_ADD * Math.max(0, 1 - speedIn / BOMB_ADD_REF) * s.mods.blastFwd;

  b.alive = false;
  // Bomba w powietrzu: pion z impetu niezależnie od kierunku (wlot od dołu też wyrzuca w górę),
  // poziom nigdy nie maleje (wlot z boku nie odpycha do tyłu).
  const vyIn = b.air ? Math.abs(s.vy) : -s.vy;
  s.vx = Math.max(80, s.vx * mult, b.air ? s.vx : 80) + add + BOMB_FWD * s.mods.blastFwd;
  s.vy = Math.max(BOMB_MIN_UP, vyIn * BOMB_KEEP * mult) * s.mods.blastUp;
  s.vx = clamp(s.vx, 80, MAX_SPEED);
  s.vy = clamp(s.vy, 0, MAX_SPEED);
  s.grounded = false;
  s.bombsHit++;
  s.puffs = Math.min(s.puffMax, s.puffs + s.mods.bombPuff);
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
    const out = Math.min(MAX_SPEED, Math.max(sp * BOOST_MUL, BOOST_MIN));
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

// Magic Find: zbieranie odcinkiem ruchu, każdy punkt tylko raz.
function collectPickups(s) {
  for (let i = 0; i < s.pickups.length; i++) {
    const p = s.pickups[i];
    if (!p.alive || p.x + p.r < s.x - 400) continue;
    if (!segmentHit(s, p.x, p.y, p.r + PLAYER_R)) continue;
    p.alive = false;
    s.mf += p.value;
    s.fx.push({ k: 'mf', x: p.x, y: p.y, v: p.value, owner: p.owner, arc: p.arc });
    // Cały łuk zebrany → suma łuku dostaje dopłatę, wynik łuku = suma × ARC_MULT.
    const arc = p.arc === undefined ? null : s.arcs[p.arc];
    if (!arc) continue;
    arc.left--;
    if (arc.left === 0) {
      const bonus = arc.total * (ARC_MULT - 1);
      s.mf += bonus;
      s.arcBonuses++;
      s.fx.push({ k: 'arc', x: p.x, y: p.y, v: arc.total, bonus: bonus, owner: arc.owner, n: arc.size, each: p.value });
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
    s.vy = Math.max(impact * o.rest, PLAT_UP);
    s.vx = Math.max(s.vx + PLAT_FWD, PLAT_FWD_MIN);
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
    s.vy = Math.max(s.vy, PUFF_UP);
    s.vx = clamp(s.vx + PUFF_FWD, -MAX_SPEED, MAX_SPEED);
    s.puffs--;
    s.puffsUsed++;
    s.puffCool = PUFF_COOL;
    s.grounded = false;
    s.fx.push({ k: 'puff', x: s.x, y: s.y, v: PUFF_UP });
  }
  if (s.puffCool > 0) s.puffCool--;

  s.grounded = false;

  // 1) grawitacja + opór powietrza
  s.vy -= GRAVITY * DT;
  const damp = 1 - AIR_DRAG * DT;
  s.vx *= damp;
  s.vy *= damp;
  s.vx = clamp(s.vx, -MAX_SPEED, MAX_SPEED);
  s.vy = clamp(s.vy, -MAX_SPEED, MAX_SPEED);

  // 2) ruch
  s.px = s.x;
  s.py = s.y;
  s.x += s.vx * DT;
  s.y += s.vy * DT;
  if (s.x > s.maxX) s.maxX = s.x;

  spawnAhead(s);

  // 3) kolizje: najpierw zbieranie, potem bomby (wybuch ma pierwszeństwo przed ziemią)
  collectPickups(s);
  hitBoosts(s);

  let boomed = false;
  for (let i = 0; i < s.bombs.length; i++) {
    const b = s.bombs[i];
    if (!b.alive || b.x + b.r < s.x - 400) continue;
    if (hitBomb(s, b)) {
      boomed = true;
      break;
    }
  }

  hitGround(s);
  for (let i = 0; i < s.obstacles.length; i++) {
    const o = s.obstacles[i];
    if (o.x + o.w < s.x - 500) continue;
    hitPlatform(s, o);
  }

  if (s.grounded && !boomed) {
    s.vx *= Math.max(0, 1 - ROLL_FRICTION * DT);
  }

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

