// nakladka.js — gra „Lotnik” jako nakładka na stronie licznika postów d2jsp.
// Wejście: strona/index.html (ładuje ../nakladka.js). Czeka na globalne D, sypie
// awatarami graczy, a po kliknięciu awatara przyciemnia stronę i uruchamia grę.
// Importy UI z ?v= (ta sama wartość wszędzie, podbijana razem z ?v= w strona/index.html), żeby
// przeglądarka nie mieszała nowych i starych modułów. Moduły UI importują też sim.js i replay.js z ?v=;
// tylko replay.js importuje './sim.js' bez ?v= (deploy.sh podmienia ten import na serwerze).
import { createGame } from './game.js?v=59';
import { itemName, SLOT_ORDER, slotAccepts } from './items.js?v=59';
import { createInventory } from './inventory.js?v=59';
import { createEkwipunek, EKW_CSS } from './ekwipunek.js?v=59';
import { createKonto, KONTO_CSS } from './konto.js?v=59';
import { createRanking, mountPageRanking, RANKING_CSS } from './ranking.js?v=59';
import { KARTA_CSS, renderHero, renderMf, renderDrop, itemBox } from './karta.js?v=59';

export const CSS = `;   // eksport tylko dla out/karta-stany.html (zrzuty stanów karty)
.lotnik-fall{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:80}
.lotnik-fall button{position:absolute;top:-80px;pointer-events:auto;touch-action:manipulation;width:var(--s,42px);height:var(--s,42px);padding:0;border:2px solid rgba(255,255,255,.45);border-radius:50%;background-color:#334155;background-position:center;background-size:cover;background-repeat:no-repeat;box-shadow:0 3px 10px rgba(0,0,0,.35);cursor:pointer;animation:lotnikFall var(--t,10s) linear forwards;will-change:transform;-webkit-tap-highlight-color:transparent;color:#fff;font:700 15px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.lotnik-fall button:focus-visible{outline:3px solid #fbbf24;outline-offset:2px}
@keyframes lotnikFall{from{transform:translate3d(0,0,0) rotate(0)}to{transform:translate3d(var(--dx,0px),calc(100vh + 100px),0) rotate(var(--r,40deg))}}
.lotnik-tip{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:81;pointer-events:none;background:rgba(15,23,42,.86);color:#f8fafc;font:600 12px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:9px 14px;border-radius:999px;border:1px solid rgba(248,250,252,.22);white-space:nowrap;max-width:calc(100vw - 24px);overflow:hidden;text-overflow:ellipsis}
.lotnik-dim{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:90}
.lotnik-stage{position:fixed;inset:0;z-index:91}
.lotnik-canvas{display:block;width:100%;height:100%;touch-action:none;background:transparent;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;cursor:pointer}
.lotnik-top{position:absolute;top:10px;right:10px;display:flex;gap:8px;align-items:flex-start;z-index:2}
.lotnik-btn{font:600 12px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#f8fafc;background:rgba(15,23,42,.86);border:1px solid rgba(248,250,252,.25);border-radius:999px;padding:10px 14px;cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent}
.lotnik-btn:hover{border-color:rgba(251,191,36,.85)}
.lotnik-x,.lotnik-fs{width:35px;height:35px;padding:0;font-size:15px;line-height:1}
.lotnik-card{position:absolute;left:50%;top:calc(50% + 24px);transform:translate(-50%,-50%);width:min(340px,calc(100vw - 32px));max-height:calc(100vh - 72px);max-height:calc(100dvh - 72px);overflow:auto;display:flex;flex-direction:column;box-sizing:border-box;background:rgba(15,23,42,.985);border:1px solid rgba(248,250,252,.22);border-radius:16px;padding:18px 16px 16px;text-align:center;color:#f8fafc;box-shadow:0 18px 50px rgba(0,0,0,.5);z-index:3;font:500 13px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.lotnik-card .lt-win{margin-top:6px;font-size:15px;font-weight:700;color:#facc15;line-height:1.35}
.lotnik-card .lt-win small{display:block;font-size:12px;font-weight:600;color:#fde68a}
.lotnik-card .lt-meta{font-size:11px;color:#94a3b8;margin-top:4px;white-space:pre-line}
.lotnik-card .lt-meta:empty{display:none}
.lotnik-card .lt-meta-err{color:#fca5a5}
.lotnik-card .lt-new:not([hidden]){display:flex;align-items:center;justify-content:center;gap:8px;margin-top:8px;font-size:12px;font-weight:700;color:#fbbf24}
.lotnik-card .lt-new button{padding:5px 10px;font-size:12px}
.lotnik-card .lt-row{display:flex;gap:8px;margin-top:14px}
.lotnik-card .lt-btn{flex:1;padding:13px 8px;border-radius:10px;font-size:14px}
.lotnik-card .lt-primary{background:#22c55e;border-color:#22c55e;color:#052e16;font-weight:800}
.lotnik-card .lt-primary:hover{background:#4ade80}
.lotnik-card .lt-row2{display:flex;gap:8px;margin-top:8px}
.lotnik-card .lt-row2 .lotnik-btn{flex:1;padding:9px 8px;font-size:11px}
.lotnik-inv{position:absolute;left:50%;top:7%;transform:translateX(-50%);box-sizing:border-box;width:min(420px,calc(100vw - 24px));max-height:86vh;overflow:auto;background:rgba(15,23,42,.98);border:1px solid rgba(248,250,252,.22);border-radius:16px;padding:14px;color:#f8fafc;box-shadow:0 18px 50px rgba(0,0,0,.55);z-index:4;font:500 12px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.lotnik-inv h3{font-size:15px;margin:0 0 10px;padding-right:34px}
.lotnik-inv .lt-slot{border-top:1px solid rgba(248,250,252,.12);padding:8px 0}
.lotnik-inv .lt-slot:first-child{border-top:0;padding-top:0}
.lotnik-inv .lt-slot-label{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em}
.lotnik-inv .lt-item{margin-top:5px}
.lotnik-inv .lt-slot-empty{font-size:11px;color:#64748b;margin-top:2px}
.lotnik-inv .lt-inv-mods{margin-top:10px;padding-top:8px;border-top:1px solid rgba(248,250,252,.12);font-size:10px;color:#94a3b8;line-height:1.5}
.lotnik-inv .lt-inv-close{position:absolute;right:8px;top:8px;width:30px;height:30px;padding:0;font-size:13px;line-height:1}
.lotnik-ekwv{position:fixed;inset:0;z-index:95;background:rgba(0,0,0,.45)}
.lotnik-ekwv[hidden]{display:none!important}
.lotnik-ekwv h3 a{color:inherit}
.lotnik-ekwv .lt-eqv-note{margin-top:8px;font-size:10px;color:#94a3b8;line-height:1.45}
.lotnik-ekwv .lotnik-inv{padding-top:0}
.lotnik-ekwv .lotnik-inv h3{margin:0}
.lt-eqv-head{position:sticky;top:0;z-index:5;background:rgba(15,23,42,.98);padding:14px 0 0;margin:0 0 4px}
.lt-eqv-head .lt-inv-close{right:-6px}
.lt-eqv-tabs{display:flex;gap:4px;margin-top:10px;border-bottom:1px solid rgba(248,250,252,.18)}
.lt-eqv-tab{flex:1;background:none;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;padding:7px 4px 8px;color:#94a3b8;font:700 12px system-ui,sans-serif;cursor:pointer;line-height:1.2;-webkit-tap-highlight-color:transparent}
.lt-eqv-tab small{display:block;font-weight:500;font-size:10px;color:#64748b;margin-top:2px}
.lt-eqv-tab.on{color:#fbbf24;border-bottom-color:#fbbf24}
.lt-eqv-tab.on small{color:#cbd5e1}
@media (hover:hover){.lt-eqv-tab:not(.on):hover{color:#e2e8f0}}
.lotnik-card .lt-side{flex:0 1 auto;min-height:0;overflow:auto;scrollbar-gutter:stable both-edges;scrollbar-width:thin}
@media (orientation:landscape) and (max-height:520px){
.lotnik-card{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:16px;align-content:start;width:min(760px,calc(100vw - 24px));top:50%;max-height:calc(100vh - 16px);max-height:calc(100dvh - 16px);padding:12px 14px}
.lotnik-card>*{grid-column:1}
.lotnik-card .lt-side{display:block;grid-column:2;grid-row:1/span 14;overflow:auto;max-height:calc(100dvh - 42px);min-height:0}
.lotnik-card .lt-side>.lt-mf{margin-top:0}
.lotnik-card .lt-row{margin-top:10px}
.lotnik-card .lt-btn{padding:10px 8px}
.lotnik-stage .lotnik-card .lt-sep{margin-top:10px}
.lotnik-stage .lotnik-inv,.lotnik-stage .lotnik-rank{top:8px;max-height:calc(100vh - 16px);max-height:calc(100dvh - 16px)}
}
/* Komputer (wariant A z out/makieta-uklad.html, 20.10; zwężony do 380 px, piramida 1 z out/makieta-mf.html):
   środek bez własnego przewijania (przy braku miejsca przewija się cała karta), MF jako piramida:
   „Magic Find 210”, pod nim „zebrane + za dystans”, pod spodem kolumny Magiczny / Rzadki / Unikat. */
@media (min-width:600px) and (min-height:521px){
.lotnik-stage .lotnik-card{width:min(380px,calc(100vw - 32px))}
.lotnik-stage .lotnik-card .lt-side{flex:none;overflow:visible;scrollbar-gutter:auto}
.lotnik-stage .lotnik-card .lt-mf{display:flex;flex-wrap:wrap;padding:8px 10px 6px;text-align:center}
.lotnik-stage .lotnik-card .lt-mf-head{flex:1 0 100%;justify-content:center;gap:8px;padding:0}
.lotnik-stage .lotnik-card .lt-mf-low{flex:1 0 100%;border:0;padding:1px 0 7px;font-size:11px;text-align:center}
.lotnik-stage .lotnik-card .lt-mfr{flex:1 1 0;flex-direction:column;align-items:center;gap:1px;padding:6px 0 0;border-top:1px solid rgba(248,250,252,.09);font-size:12px}
.lotnik-stage .lotnik-card .lt-mfr+.lt-mfr{border-left:1px solid rgba(248,250,252,.09)}
}
body.playing>:not(.lotnik-stage),body.playing>:not(.lotnik-stage) *,body.playing>:not(.lotnik-stage) ::before,body.playing>:not(.lotnik-stage) ::after{animation-play-state:paused!important}
body.playing .lavadrop{display:none!important}
.lotnik-off{position:fixed;left:10px;bottom:10px;z-index:81;cursor:pointer;background:rgba(15,23,42,.78);color:#cbd5e1;font:600 11px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:7px 10px;border-radius:999px;border:1px solid rgba(248,250,252,.2)}
.lotnik-off:hover{color:#f8fafc;border-color:rgba(248,250,252,.45)}
body.playing .lotnik-off{display:none}
body.lt-hide>:not(.lotnik-stage):not(.lotnik-dim){visibility:hidden!important}
.lotnik-fall[hidden],.lotnik-tip[hidden],.lotnik-dim[hidden],.lotnik-stage[hidden],.lotnik-card[hidden],.lotnik-inv[hidden]{display:none!important}
`;

const TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches;   // telefon / tablet
const SPAWN_MS = 700;        // co ile pojawia się nowy awatar
const MAX_FALLING = 10;      // ile awatarów naraz na ekranie
const POOL_MAX = 32;

let pool = [];

// Top 3 rankingu (kolejność `pool` = wg liczby postów) to właściciele łuków Magic Find.
const OWNER_PLACES = [{ mult: 4, size: 10 }, { mult: 3, size: 8 }, { mult: 2, size: 6 }];
function topOwners(list) {
  return list.slice(0, OWNER_PLACES.length).map(function (it, i) {
    return { mult: OWNER_PLACES[i].mult, size: OWNER_PLACES[i].size, uid: it.uid, url: it.url };
  });
}

let layer = null, tip = null, dim = null, stage = null, canvas = null;
let card = null, cardHero = null, cardWho = null, cardWin = null, cardMeta = null, cardMf = null;
let curItem = null;
let cardDrop = null, cardInv = null, konto = null, ranking = null, cardStatus = null;
let pageRank = null, eqView = null, eqTitle = null, eqBody = null, eqNote = null, eqTabs = null, eqDoc = null, eqUi = null, eqSeq = 0;   // karta rankingu na stronie, podgląd ekwipunku
let invPanel = null, invBody = null;
let inventory = null, ekw = null;            // inventory.js (serwer) i panel ekwipunek.js
let pendingDrop = null, dropState = null;    // drop z /end i jego stan na karcie
let eqVer = 0;                               // zmiana założonych przedmiotów unieważnia bilet w zapasie (stare mody)
let spawnTimer = 0;
let game = null;
let active = false;
let opening = false;
const TIP_TEXT = 'Kliknij spadający awatar, żeby zagrać';
const OFF_KEY = 'lotnik.awatary.off';
let avOff = false, offBtn = null;
try { avOff = localStorage.getItem(OFF_KEY) === '1'; } catch (err) { /* domyślnie włączone */ }

// --- serwer: bilet partii (/start) i zapis wyniku (/end) ----------------------
// Bez biletu gra pokazuje planszę, ale proca czeka na bilet (game.js lateTicket); wynik ponawiany (sendResult).
// Serwer wg strony: strona główna licznika = prod `lotnik` (bez hasła); /test/ i localhost = `lotnik-test` (hasło testerów).
const SERWER_TEST = !(location.hostname === 'kruszkush.github.io' && !/\/test\//.test(location.pathname));
const API = 'https://us-east1-rich-chimera-344319.cloudfunctions.net/' + (SERWER_TEST ? 'lotnik-test' : 'lotnik');
const LS_PREFIX = SERWER_TEST ? '' : 'p.';   // prod ma osobne konto/klucz gościa/rekord (ta sama domena co /test/)
const TICKET_FRESH_MS = 90 * 1000;   // starszy bilet w zapasie pobieramy od nowa (serwer liczy czas od /start)
let spare = null;                    // { t: bilet, at: ms } — zapas na „Zagraj jeszcze raz”
let fetching = null;
let spareTimer = 0;
let endSeq = 0;

// Serwer testowy od 20.10 bez hasła testerów (jak prod).
function apiPost(path, body, ms) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const tm = ctl ? setTimeout(function () { ctl.abort(); }, ms) : 0;
  return fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
    signal: ctl ? ctl.signal : undefined
  }).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (j) {
      return { ok: r.ok, status: r.status, j: j || {} };
    });
  }).catch(function () {
    return { ok: false, status: 0, j: { error: 'brak połączenia' } };
  }).finally(function () { clearTimeout(tm); });
}

// Serwer podaje top 3 jako uid (z licznika, /sync) — obrazki łuków bierzemy z awatarów strony.
function withOwnerUrls(t) {
  const data = readData(), av = (data && data.avatars) || {};
  if (Array.isArray(t.owners)) t.owners = t.owners.map(function (o) { return Object.assign({}, o, { url: av[o.uid] || '' }); });
  return t;
}

// Bilet niesie mody z założonych przedmiotów (serwer liczy je z ekwipunku token|key).
// Po nieudanym pobraniu przerwa (2 s, limit serwera 10 s): czekająca proca pyta 4×/s i bez przerwy sama wpadała w limit.
let fetchAfter = 0;
function fetchTicket() {
  if (fetching) return fetching;
  if (Date.now() < fetchAfter) return Promise.resolve(spare);
  const ver = eqVer;
  fetching = apiPost('/start', inventory ? inventory.ident() : {}, 4000).then(function (r) {
    fetching = null;
    if (ver !== eqVer) return fetchTicket();   // w międzyczasie zmiana ekwipunku: ten bilet ma stare mody
    if (r.ok && typeof r.j.g === 'string' && Number.isInteger(r.j.seed)) {
      r.j.at = Date.now();   // od tej chwili liczymy ważność biletu przy ponawianiu zapisu (zegar przeglądarki, nie serwera)
      spare = { t: withOwnerUrls(r.j), at: r.j.at };
      fetchAfter = 0;
    } else {
      fetchAfter = Date.now() + (r.status === 429 ? 10000 : 2000);
    }
    return spare;
  });
  return fetching;
}

function onEquipChange(slotsChanged) {
  if (!slotsChanged) return;
  eqVer++;
  spare = null;
  if (game) game.setLoadout(inventory.equipped());   // partia lokalna (bez biletu) gra z tym, co założone
  if (active) fetchTicket();
}

function freshSpare() {
  return spare && Date.now() - spare.at < TICKET_FRESH_MS ? spare.t : null;
}

// Dla game.js (restart): bilet z zapasu albo null (= partia lokalna); od razu pobiera kolejny.
function takeTicket() {
  const t = freshSpare();
  spare = null;
  fetchTicket();
  return t;
}

// Bilet na pierwszą partię: czekamy krótko na serwer (plansza powstaje z ziarna przy starcie gry).
function firstTicket() {
  const t = freshSpare();
  if (t) return Promise.resolve(takeTicket());
  return new Promise(function (res) {
    let done = false;
    const tm = setTimeout(function () { done = true; res(null); }, 3000);
    fetchTicket().then(function () {
      if (done) return;              // za późno: bilet zostaje w zapasie na restart
      done = true;
      clearTimeout(tm);
      res(takeTicket());
    });
  });
}

// Zapas biletu odświeżany, póki gra jest otwarta (żeby restart nie czekał na serwer).
function keepSpare() {
  if (active && !freshSpare()) fetchTicket();
}

// Wynik partii z biletem idzie do serwera; serwer sam odtwarza lot i odsyła metry.
// Brak sieci / błąd serwera / limit = ponawiamy, póki bilet ważny. Wynik czeka w localStorage (po gid), więc
// zamknięcie gry albo odświeżenie strony go nie gubi (resendPending przy starcie). Drugi /end tej samej partii
// serwer odsyła jako zapisany (zgubiona odpowiedź), więc ponawianie jest bezpieczne.
const PENDING_KEY = LS_PREFIX + 'lotnik.doWyslania';
const TICKET_TTL_MS = 13 * 60 * 1000;    // serwer: 2 min celowania + 10 min lotu + 2 min zapasu (minuta luzu na zegary)
const RETRY_S = [1, 2, 4, 8, 15, 30];    // dalej co 30 s
function pendingAll() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '{}') || {}; } catch (err) { return {}; }
}
function pendingSet(gid, p) {
  const all = pendingAll();
  if (p) all[gid] = p; else delete all[gid];
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(all)); } catch (err) { /* bez zapisu: ponawiamy tylko do zamknięcia strony */ }
}

function sendResult(onDone, onRetry) {
  const run = window.lotnikLastRun;
  if (!run || !run.saved || !run.ticket || !run.ticket.g) { onDone({ saved: false, why: 'partia testowa' }); return; }
  const body = Object.assign({ g: run.ticket.g, inputs: run.inputs, ball: curItem ? { uid: curItem.uid, nick: curItem.nick } : null,
    dev: TOUCH ? 'm' : 'd' },
    inventory ? inventory.ident() : {});
  const p = { body: body, until: (run.ticket.at || Date.now()) + TICKET_TTL_MS, meters: Math.floor(run.meters) };
  pendingSet(run.ticket.gid, p);
  postPending(run.ticket.gid, p, 0, onDone, onRetry);
}

function postPending(gid, p, n, onDone, onRetry) {
  apiPost('/end', p.body, 15000).then(function (r) {
    const again = !r.status || r.status >= 500 || r.status === 429;
    const wait = RETRY_S[Math.min(n, RETRY_S.length - 1)] * 1000;
    if (again && Date.now() + wait < p.until) {
      if (onRetry) onRetry(n + 1);
      setTimeout(function () { postPending(gid, p, n + 1, onDone, onRetry); }, wait);
      return;
    }
    pendingSet(gid, null);
    if (r.ok && typeof r.j.r === 'string') {
      onDone({ saved: true, meters: r.j.meters, r: r.j.r, gid: r.j.gid, przedmiot: r.j.przedmiot || null, dup: !!r.j.dup });
    } else if (r.status === 409) onDone({ saved: true, meters: p.meters, r: null, gid: gid, przedmiot: null, dup: true });   // stary serwer bez `dup`
    else onDone({ saved: false, why: again ? 'brak połączenia z serwerem' : r.j.stale ? 'odśwież stronę' : (r.j.error || 'błąd serwera') });
  });
}

// Wyniki niewysłane przed zamknięciem strony: wysyłamy po cichu (ekwipunek z dropem odświeży się przy otwarciu).
function resendPending() {
  const all = pendingAll();
  Object.keys(all).forEach(function (gid) {
    const p = all[gid];
    if (!p || !p.body || !(p.until > Date.now())) { pendingSet(gid, null); return; }
    postPending(gid, p, 0, function () { /* wynik już na serwerze albo odrzucony */ }, null);
  });
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function injectCss() {
  const style = el('style');
  style.textContent = CSS + KARTA_CSS + KONTO_CSS + RANKING_CSS + EKW_CSS;
  document.head.appendChild(style);
}

// --- spadające awatary -------------------------------------------------------

function build() {
  layer = el('div', 'lotnik-fall');
  tip = el('div', 'lotnik-tip', TIP_TEXT);
  dim = el('div', 'lotnik-dim');
  dim.hidden = true;

  stage = el('div', 'lotnik-stage');
  stage.hidden = true;
  canvas = el('canvas', 'lotnik-canvas');

  const top = el('div', 'lotnik-top');
  const closeBtn = el('button', 'lotnik-btn lotnik-x', '✕');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Zamknij grę');
  if (FS_OK) {
    const fsBtn = el('button', 'lotnik-btn lotnik-fs', '⛶');
    fsBtn.type = 'button';
    fsBtn.setAttribute('aria-label', 'Pełny ekran');
    fsBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (document.fullscreenElement) exitFullscreen();
      else enterFullscreen();
    });
    top.appendChild(fsBtn);
  }
  top.appendChild(closeBtn);

  card = el('div', 'lotnik-card');
  card.hidden = true;
  cardHero = el('div', 'lt-hcore');
  // Lot do bezpiecznika 10 min: koniec gry, dalej się nie da.
  cardWin = el('div', 'lt-win');
  cardWin.appendChild(document.createTextNode('Koniec gry! Pokonałeś grę, gratulacje!'));
  cardWin.appendChild(el('small', null, 'Doleciałeś do granicy 10 minut lotu, dalej się już nie da.'));
  cardWin.hidden = true;
  cardMeta = el('div', 'lt-meta');
  cardMf = el('div', 'lt-mf');
  cardDrop = el('div', 'lt-drop');
  cardDrop.hidden = true;
  // Jeden główny przycisk („Zagraj jeszcze raz”), reszta drugorzędna w rzędzie pod nim.
  const row = el('div', 'lt-row');
  const again = el('button', 'lotnik-btn lt-btn lt-primary', 'Zagraj jeszcze raz');
  again.type = 'button';
  row.appendChild(again);
  konto = createKonto(apiPost, el, function () { const d = readData(); return d && d.avatars; }, function (msg, err) {
    if (cardStatus) cardStatus(msg, err);
  }, function (loggedIn) {
    // Logowanie/rejestracja: /inv z tokenem i kluczem scala przedmioty gościa; wylogowanie: nowy klucz gościa.
    if (!loggedIn) inventory.rotateKey();
    inventory.load();
  }, LS_PREFIX);
  inventory = createInventory(apiPost, konto.token, LS_PREFIX);
  inventory.onChange(onEquipChange);
  // Góra karty (makieta out/makieta-koniec.html): kto grał (nick z konta albo „Gość”: przełącza sam CSS, więc
  // logowanie przy otwartej karcie też), wynik z rekordem albo paskiem do rekordu (karta.js renderHero; nick w jednej linii z wynikiem), status.
  const hero = el('div', 'lt-hero');
  const who = cardWho = el('div', 'lt-who');
  const guest = el('div', 'lt-guest');
  guest.append(el('span', 'lt-av', '?'), el('span', null, 'Gość'));
  who.append(konto.player, guest);
  hero.append(cardHero, cardMeta);
  cardHero.appendChild(who);
  card.appendChild(hero);
  card.appendChild(cardWin);
  cardNew = el('div', 'lt-new', 'Jest nowa wersja gry.');
  cardNew.hidden = true;
  const reload = el('button', 'lotnik-btn', 'Odśwież');
  reload.type = 'button';
  reload.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); location.reload(); });
  cardNew.appendChild(reload);
  card.appendChild(cardNew);
  // Magic Find + drop + konto w jednym bloku z własnym przewijaniem: w pionie środek karty, który kurczy się,
  // gdy brakuje wysokości (telefon), w poziomie na telefonie prawa kolumna; wynik i przyciski zawsze widoczne.
  const cardSide = el('div', 'lt-side');
  cardSide.appendChild(cardMf);
  cardSide.appendChild(cardDrop);
  cardSide.appendChild(konto.node);
  card.appendChild(cardSide);
  card.appendChild(el('div', 'lt-sep'));
  card.appendChild(row);
  const row2 = el('div', 'lt-row2');
  cardInv = el('button', 'lotnik-btn lt-inv', 'Ekwipunek');
  cardInv.type = 'button';
  const cardRank = el('button', 'lotnik-btn lt-rank-btn', 'Ranking');
  cardRank.type = 'button';
  const quit = el('button', 'lotnik-btn lt-quit', 'Zamknij');
  quit.type = 'button';
  row2.appendChild(cardInv);
  row2.appendChild(cardRank);
  row2.appendChild(quit);
  card.appendChild(row2);
  card.appendChild(konto.out);
  const avatarsNow = function () { const d = readData(); return d && d.avatars; };
  ranking = createRanking(apiPost, el, konto.token, avatarsNow, showRecordEq);
  pageRank = mountPageRanking(apiPost, el, konto.token, avatarsNow, showRecordEq, function () { return false; });

  // Podgląd ekwipunku z rekordowego lotu (klik w gracza w rankingu; jak w Piłeczce): okno nad stroną i nad grą.
  eqView = el('div', 'lotnik-ekwv');
  eqView.hidden = true;
  const eqPanel = el('div', 'lotnik-inv');
  eqTitle = el('h3');
  const eqClose = el('button', 'lotnik-btn lotnik-x lt-inv-close', '✕');
  eqClose.type = 'button';
  eqClose.setAttribute('aria-label', 'Zamknij podgląd ekwipunku');
  eqTabs = el('div', 'lt-eqv-tabs');
  const eqHead = el('div', 'lt-eqv-head');
  eqHead.append(eqTitle, eqClose, eqTabs);   // przypięte przy przewijaniu: nick, ✕ i zakładki
  eqBody = el('div');
  eqNote = el('div', 'lt-eqv-note');
  eqPanel.append(eqHead, eqBody, eqNote);
  eqView.appendChild(eqPanel);
  eqClose.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); eqView.hidden = true; });
  eqView.addEventListener('click', function (e) { if (e.target === eqView) eqView.hidden = true; });
  eqPanel.addEventListener('click', function (e) { e.stopPropagation(); });
  eqDoc = { slots: {}, chest: [] };
  eqUi = createEkwipunek({ readOnly: true,
    inv: { doc: function () { return eqDoc; }, note: function () { return ''; }, load: function () { return Promise.resolve(null); } },
    el: el, body: eqBody, avatars: avatarsNow });

  invPanel = el('div', 'lotnik-inv');
  invPanel.hidden = true;
  const invTitle = el('h3', null, 'Ekwipunek');
  const invClose = el('button', 'lotnik-btn lotnik-x lt-inv-close', '✕');
  invClose.type = 'button';
  invClose.setAttribute('aria-label', 'Zamknij ekwipunek');
  invBody = el('div');
  invPanel.appendChild(invTitle);
  invPanel.appendChild(invClose);
  invPanel.appendChild(invBody);
  ekw = createEkwipunek({ inv: inventory, el: el, body: invBody, avatars: function () { const d = readData(); return d && d.avatars; } });
  inventory.onChange(function () { if (!invPanel.hidden) ekw.render(); if (pendingDrop) showDrop(pendingDrop); });

  stage.appendChild(canvas);
  stage.appendChild(top);
  stage.appendChild(card);
  stage.appendChild(invPanel);
  stage.appendChild(ranking.node);

  document.body.appendChild(layer);
  document.body.appendChild(tip);
  // Wyłącznik spadających awatarów (jak „❄ wyłącz awatary” w Piłeczce), zapamiętany w przeglądarce.
  offBtn = el('button', 'lotnik-off');
  offBtn.type = 'button';
  const setOff = function () { offBtn.textContent = avOff ? 'Włącz awatary' : 'Wyłącz awatary'; };
  setOff();
  offBtn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    avOff = !avOff;
    try { localStorage.setItem(OFF_KEY, avOff ? '1' : '0'); } catch (err) { /* tylko do zamknięcia strony */ }
    setOff();
    if (avOff) {
      stopSpawning();
      layer.replaceChildren();
      layer.hidden = true;
      tip.hidden = true;
    } else startSpawning();
  });
  document.body.appendChild(offBtn);
  document.body.appendChild(dim);
  document.body.appendChild(stage);
  document.body.appendChild(eqView);               // po scenie: pierwsze .lotnik-x / .lotnik-inv w DOM to dalej gra

  closeBtn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    closeGame();
  });
  again.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    card.hidden = true;
    showDrop(null);
    invPanel.hidden = true;
    ranking.hide();
    pendingDrop = null;
    dropState = null;
    if (game) game.restart(true);
  });
  quit.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    closeGame();
  });
  cardInv.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    ranking.hide();
    openInventory();
  });
  cardRank.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    invPanel.hidden = true;
    ranking.open();
  });
  invClose.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    invPanel.hidden = true;
    if (pendingDrop) showDrop(pendingDrop);   // po zniszczeniu czegoś drop da się już zatrzymać
  });
}

function spawnOne(delay) {
  if (active || !layer || layer.childElementCount >= MAX_FALLING || pool.length === 0) return;
  const item = pool[Math.floor(Math.random() * pool.length)];
  const btn = el('button');
  btn.type = 'button';
  btn.title = item.nick;
  btn.setAttribute('aria-label', 'Zagraj awatarem ' + item.nick);
  const size = 42 + Math.random() * 23;   // 42–65 px (20.10: +25% względem 34–52)
  btn.style.setProperty('--s', size.toFixed(0) + 'px');
  btn.style.setProperty('--t', (7 + Math.random() * 5).toFixed(2) + 's');
  btn.style.setProperty('--dx', ((Math.random() - 0.5) * 120).toFixed(0) + 'px');
  btn.style.setProperty('--r', ((Math.random() - 0.5) * 160).toFixed(0) + 'deg');
  btn.style.left = (4 + Math.random() * 88).toFixed(1) + '%';
  btn.style.backgroundImage = 'url("' + item.url.replace(/"/g, '%22') + '")';
  // Ujemne opóźnienie = awatar zaczyna lot w środku ekranu (pierwsze sztuki).
  if (delay) btn.style.animationDelay = '-' + delay + 's';
  btn.addEventListener('animationend', function () { btn.remove(); });
  btn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    openGame(item);
  });
  layer.appendChild(btn);
}

function startSpawning() {
  if (avOff || spawnTimer || active || !layer || pool.length === 0) return;
  layer.hidden = false;
  tip.hidden = false;
  spawnOne(2.5);
  spawnOne(6);
  spawnTimer = setInterval(spawnOne, SPAWN_MS);
}

function stopSpawning() {
  if (spawnTimer) {
    clearInterval(spawnTimer);
    spawnTimer = 0;
  }
}

// --- start / koniec gry ------------------------------------------------------


// Pełny ekran w poziomie na telefonie: znika pasek adresu i przyciski przeglądarki. Cała strona idzie na pełny
// ekran, więc przyciemniona strona dalej prześwituje. Wymaga gestu (tap w awatar / ⛶). iPhone (Safari) nie ma
// tego API dla stron: tam przycisk się nie pokazuje, a gra działa w zwykłym oknie.
const FS_OK = TOUCH && typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;
function enterFullscreen() {
  if (!FS_OK || document.fullscreenElement) return;
  try {
    document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(function () {
      try {
        const lock = screen.orientation && screen.orientation.lock ? screen.orientation.lock('landscape') : null;
        if (lock && lock.catch) lock.catch(function () { /* bez blokady obrotu */ });
      } catch (err) { /* bez blokady obrotu */ }
    }).catch(function () { /* przeglądarka odmówiła: gra w zwykłym oknie */ });
  } catch (err) { /* stara przeglądarka */ }
}
function exitFullscreen() {
  try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (err) { /* nic */ }
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () { /* nic */ });
}

function openGame(item) {
  if (active || opening || !item) return;
  enterFullscreen();   // tu, w geście tapu (startGame jest już po odpowiedzi serwera)
  opening = true;
  tip.textContent = 'Łączenie z serwerem…';
  firstTicket().then(function (ticket) {
    opening = false;
    tip.textContent = TIP_TEXT;
    startGame(item, ticket);
  });
}

function startGame(item, ticket) {
  if (active) return;
  active = true;
  curItem = item;
  clearInterval(spareTimer);
  spareTimer = setInterval(keepSpare, 30 * 1000);
  stopSpawning();
  layer.hidden = true;
  // Czyścimy spadające awatary: ich animacje i tak są wstrzymane, a po powrocie
  // do strony startSpawning() od razu wpuszcza nowe.
  layer.replaceChildren();
  tip.hidden = true;
  card.hidden = true;
  showDrop(null);
  invPanel.hidden = true;
  ranking.hide();
  pendingDrop = null;
  dropState = null;
  if (!inventory.loaded()) inventory.load();
  setDimZone(0, 0);
  dim.hidden = false;
  stage.hidden = false;
  // Strona pod spodem stoi (bez przewijania i animacji), ranking prześwituje. Telefon: strona całkiem ukryta
  // (visibility, układ i przewinięcie zostają), bo na małym ekranie nicki rankingu myliły się z grą.
  document.body.classList.add('playing');
  if (TOUCH) document.body.classList.add('lt-hide');
  document.documentElement.style.overflow = 'hidden';

  game = createGame({
    canvas: canvas,
    avatarUrl: item.url,
    birdUrls: pool.map(function (p) { return p.url; }),
    owners: topOwners(pool),
    nick: item.nick,
    loadout: inventory.equipped(),
    lsPrefix: LS_PREFIX,
    ticket: ticket,
    nextTicket: takeTicket,
    onEnd: showResult,
    onClose: closeGame,
    onZone: setDimZone,
    bg: function () { return dimOpaque; }
  });
  // Podgląd partii w konsoli (faza, dystans, ziarno) — do sprawdzania bez UI.
  window.lotnikInfo = function () { return game ? game.info() : null; };
}

// Tło przyciemnienia = czarna warstwa + kolor stref (kosmos, czerwień) złożone w jeden kolor. Zmieniane tylko
// przy zmianie kroku stref (game.js onZone), więc canvas nie maluje pełnoekranowych warstw co klatkę.
// Telefon: ciemniej (0,82), żeby prześwitujący ranking strony nie mylił się z grą.
const DIM_BASE = TOUCH ? 0.82 : 0.6;
function setDimZone(space, hell) {
  let a = DIM_BASE, c = [0, 0, 0];
  const over = function (col, a2) {
    if (a2 <= 0) return;
    const na = a2 + a * (1 - a2);
    c = c.map(function (v, i) { return (col[i] * a2 + v * a * (1 - a2)) / na; });
    a = na;
  };
  over([2, 3, 14], 0.85 * space);
  over([140, 12, 12], 0.6 * hell);
  dim.style.background = 'rgba(' + c.map(Math.round).join(',') + ',' + a.toFixed(3) + ')';
  // Ten sam kolor złożony z tłem strony, bez przezroczystości (game.js ?tlo=1 maluje go na canvasie).
  const pg = (getComputedStyle(document.body).backgroundColor.match(/\d+/g) || [0, 0, 0]).map(Number);
  dimOpaque = 'rgb(' + c.map(function (v, i) { return Math.round(v * a + pg[i] * (1 - a)); }).join(',') + ')';
}
let dimOpaque = '#000';

// Nowa wersja na stronie (publikacja w trakcie gry): po końcu partii, najwyżej raz na 5 min, czytamy HTML strony
// i porównujemy ?v= nakladka.js z własnym. Trwająca partia gra dalej starym kodem (serwer trzyma stare fizyki).
const MY_V = Number((import.meta.url.match(/[?&]v=(\d+)/) || [])[1]) || 0;
let cardNew = null;
let verAt = 0;
let newVer = false;
function checkVersion() {
  if (!MY_V || newVer || Date.now() - verAt < 5 * 60 * 1000) return Promise.resolve(newVer);
  verAt = Date.now();
  return fetch(location.href.split('#')[0], { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (t) {
    const m = t.match(/nakladka\.js\?v=(\d+)/);
    newVer = !!m && Number(m[1]) > MY_V;
    return newVer;
  }).catch(function () { return false; });
}

function showResult(result) {
  const hero = { meters: result.meters, rec: result.newRecord, prevBest: result.prevBest, best: result.best, test: result.test };
  // Zalogowany: rekord liczy konto (/claim), nie to urządzenie; do odpowiedzi rekord konta zapamiętany tutaj albo bez rekordu.
  if (konto.token() && result.saved) {
    const kb = konto.best();
    if (kb == null) hero.wait = true; else hero.acc = { prev: kb };
  }
  renderHero(cardHero, hero, cardWho);
  cardWin.hidden = !result.beaten;
  renderMf(cardMf, result.mf || 0, result.meters);
  pendingDrop = null;
  dropState = null;
  showDrop(null);
  card.hidden = false;
  const seq = ++endSeq;
  // Linia statusu (bez statystyk lotu): zapis na serwerze, potem komunikat konta (konto.js) w jej miejscu; błąd na czerwono.
  // Pusty msg = linia znika (wynik na koncie widać po nicku obok metrów).
  const status = function (msg, err) {
    cardMeta.textContent = '';
    if (msg) cardMeta.appendChild(el('span', err ? 'lt-meta-err' : null, msg));
  };
  cardStatus = function (msg, err) { if (seq === endSeq) status(msg, err); };
  konto.hide();
  cardNew.hidden = !newVer;
  checkVersion().then(function (v) { if (v && seq === endSeq) cardNew.hidden = false; });
  status(result.saved ? 'Zapisywanie wyniku…' : 'Wynik niezapisany (partia testowa)');
  if (!result.saved) return;
  const retry = function () { if (seq === endSeq && active) status('Zapisywanie wyniku… (brak połączenia, ponawiam)'); };
  sendResult(function (res) {
    if (seq !== endSeq || !active) return;   // w międzyczasie nowa partia albo zamknięta gra
    if (res.saved) {
      // Serwer odtworzył partię: inny wynik (w praktyce się nie zdarza) = delta i pasek z jego metrów.
      if (Number.isFinite(res.meters) && Math.floor(res.meters) !== Math.floor(hero.meters)) {
        hero.meters = res.meters;
        renderHero(cardHero, hero, cardWho);
      }
      status('Wynik zapisany na serwerze');
      const p = res.przedmiot;
      if (res.dup) inventory.load();   // ponowiony zapis: drop (jeśli był) już w ekwipunku na serwerze
      if (p && p.inv) inventory.set(p.inv);
      if (p && p.drop) {
        pendingDrop = p.drop;
        dropState = { equipped: !!p.equipped, old: null, msg: p.lost ? 'Poprzedni nierozstrzygnięty przedmiot przepadł (pełna skrzynia).' : '' };
        showDrop(pendingDrop);
      } else if (p && p.limit) {   // straż: dzienny limit przedmiotów (serwer), sama partia się liczy
        cardDrop.textContent = '';
        cardDrop.appendChild(el('div', 'lt-drop-msg', 'Dzienny limit przedmiotów, wróć jutro. Wynik się liczy.'));
        cardDrop.hidden = false;
      }
      if (res.would && !hero.acc) { hero.would = res.would; renderHero(cardHero, hero, cardWho); }
    } else {
      status('Wynik niezapisany (' + res.why + ')');
    }
    konto.onResult(res, function (rank) {
      if (seq !== endSeq) return;
      const av = (readData() || {}).avatars || {};
      const url = function (p) { return p ? { ...p, url: p.uid ? av[p.uid] || '' : '' } : null; };
      hero.acc = { ...rank, over: url(rank.over), gap: url(rank.gap) };
      hero.wait = false;
      renderHero(cardHero, hero, cardWho);
    });
  }, retry);
}

// --- drop i ekwipunek --------------------------------------------------------

// Drop na karcie (karta.js); póki czeka na decyzję, „Ekwipunek” jest pod Załóż/Odrzuć, nie w dolnym rzędzie.
// „Masz” = założony przedmiot tego typu.
function currentFor(type) {
  const doc = inventory.doc();
  for (let i = 0; i < SLOT_ORDER.length; i++) {
    const s = SLOT_ORDER[i];
    if (slotAccepts(s, type) && doc.slots[s]) return doc.slots[s];
  }
  return null;
}

function showDrop(drop) {
  const decided = !!(dropState && (dropState.equipped || dropState.done));
  const st = drop ? Object.assign({}, dropState, { full: !decided && inventory.free() === 0 }) : null;
  renderDrop(cardDrop, drop, drop && !decided ? currentFor(drop.type) : null, {
    equip: function () { dropAct('equip'); },
    keep: function () { dropAct('keep'); },
    toss: function () { dropAct('destroy'); },
    inv: function () { ranking.hide(); openInventory(); },
    oldX: oldX
  }, st);
  cardInv.hidden = !!drop && !decided;
}

// Decyzja o dropie: stan na karcie ustawiony PRZED inventory.act (onChange z nowym ekwipunkiem rysuje już ten stan,
// bez chwilowego „Masz: ten sam przedmiot”), błąd serwera przywraca przyciski z komunikatem.
// Załóż = ramka zostaje ze stemplem, stary przedmiot (jeśli był) w skrzyni z ✗; Do skrzyni / Odrzuć = krótka linijka.
// Stempel nie śledzi późniejszych zmian w Ekwipunku: karta to podsumowanie partii.
function dropAct(action) {
  const drop = pendingDrop;
  const before = dropState || {};
  if (!drop || before.equipped || before.done) return;
  dropState = action === 'equip'
    ? { equipped: true, old: currentFor(drop.type), msg: before.msg }
    : { done: (action === 'keep' ? 'Do skrzyni: ' : 'Odrzucono: ') + itemName(drop), msg: before.msg };
  showDrop(drop);
  inventory.act(action, drop.id).then(function (r) {
    if (pendingDrop !== drop || !r.error) return;
    dropState = Object.assign({}, before, { msg: r.error });
    showDrop(drop);
  });
}

// ✗ przy starym przedmiocie (zdjętym do skrzyni po „Załóż”): pierwsze kliknięcie pyta „Na pewno?”, drugie niszczy.
function oldX() {
  const drop = pendingDrop, s = dropState;
  if (!drop || !s || !s.old || s.oldBusy || s.oldMsg) return;
  if (!s.oldAsk) {
    dropState = Object.assign({}, s, { oldAsk: true });
    showDrop(drop);
    return;
  }
  const old = s.old;
  dropState = Object.assign({}, s, { oldBusy: true });
  showDrop(drop);
  inventory.act('destroy', old.id).then(function (r) {
    if (pendingDrop !== drop) return;
    dropState = Object.assign({}, dropState, r.error ? { oldBusy: false, oldAsk: false, msg: r.error }
      : { oldBusy: false, oldMsg: 'Zniszczono: ' + itemName(old) });
    showDrop(drop);
  });
}

function openInventory() {
  ekw.open();
  invPanel.hidden = false;
}

function closeGame() {
  if (!active) return;
  if (game) {
    game.destroy();
    game = null;
  }
  active = false;
  clearInterval(spareTimer);
  endSeq++;
  window.lotnikInfo = null;
  pendingDrop = null;
  dropState = null;
  card.hidden = true;
  showDrop(null);
  invPanel.hidden = true;
  ranking.hide();
  stage.hidden = true;
  dim.hidden = true;
  dim.style.background = '';
  exitFullscreen();
  document.body.classList.remove('playing', 'lt-hide');
  document.documentElement.style.overflow = '';
  setTimeout(startSpawning, 400);
}

// --- podgląd ekwipunku z rankingu ----------------------------------------------
// e = wiersz rankingu { nick, verified, uid, gid, dev, meters }. POST /ekw: `now` = założone teraz na koncie,
// `slots` = z rekordowego lotu. Zakładki „Teraz” (domyślna) i „Z rekordu”.
function eqTabsShow(tabs, cur) {
  eqTabs.replaceChildren();
  tabs.forEach(function (t) {
    const b = el('button', 'lt-eqv-tab' + (t === cur ? ' on' : ''), t.name);
    b.type = 'button';
    b.appendChild(el('small', null, t.sub));
    b.addEventListener('click', function (ev) { ev.preventDefault(); eqTabsShow(tabs, t); });
    eqTabs.appendChild(b);
  });
  eqDoc = { slots: cur.slots || {}, chest: [] };
  eqUi.open();
  eqNote.textContent = cur.note;
}

function showRecordEq(e) {
  const my = ++eqSeq;
  eqTitle.replaceChildren();
  if (e.verified && /^\d{1,12}$/.test(String(e.uid || ''))) {
    const a = el('a', null, e.nick);
    a.href = 'https://forums.d2jsp.org/user.php?i=' + e.uid;
    a.target = '_blank';
    a.rel = 'noopener';
    a.title = 'Profil na d2jsp';
    eqTitle.appendChild(a);
  } else {
    eqTitle.textContent = e.nick;
  }
  eqTabs.replaceChildren();
  eqDoc = { slots: {}, chest: [] };
  eqUi.open();
  eqNote.textContent = 'Ładowanie…';
  eqView.hidden = false;
  apiPost('/ekw', { gid: e.gid }, 8000).then(function (r) {
    if (my !== eqSeq) return;
    if (!r.ok) { eqNote.textContent = r.j.error || 'Brak połączenia'; return; }
    const dev = r.j.dev === 'm' ? ' (📱 telefon)' : r.j.dev === 'd' ? ' (🖥️ komputer)' : '';
    const d = r.j.ts ? new Date(r.j.ts * 1000) : null;   // serwer: sekundy
    const day = d ? ' · ' + String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') : '';
    const tabs = [
      { name: 'Teraz', sub: 'założone obecnie', slots: r.j.now, note: 'Przedmioty założone teraz.' },
      { name: 'Z rekordu', sub: r.j.meters + ' m' + day, slots: r.j.slots,
        note: r.j.slots ? 'Ekwipunek z rekordowego lotu: ' + r.j.meters + ' m' + dev + '.' : 'Brak zapisu ekwipunku dla tego lotu' + dev + '.' }
    ];
    eqTabsShow(tabs, r.j.now ? tabs[0] : tabs[1]);   // stary serwer bez `now`: od razu rekord
  });
}

// --- dane strony -------------------------------------------------------------

// Strona licznika trzyma dane w globalnym `let D` (klasyczny <script>).
// Moduł czyta ten sam globalny zasięg; w razie TDZ/braku danych po prostu czekamy.
function readData() {
  try {
    if (typeof D !== 'undefined' && D && Array.isArray(D.posts)) return D;
  } catch (err) { /* D jeszcze nie istnieje */ }
  return null;
}

function buildPool(data) {
  const avatars = data.avatars || {};
  const users = data.users || {};
  const counts = new Map();
  for (let i = 0; i < data.posts.length; i++) {
    const uid = String(data.posts[i][2]);
    counts.set(uid, (counts.get(uid) || 0) + 1);
  }
  const list = [];
  const seen = new Set();
  const sorted = Array.from(counts.entries()).sort(function (a, b) { return b[1] - a[1]; });
  for (let i = 0; i < sorted.length && list.length < POOL_MAX; i++) {
    const uid = sorted[i][0];
    const url = avatars[uid];
    if (!url || seen.has(url)) continue;
    seen.add(url);
    list.push({ uid: uid, url: url, nick: users[uid] || uid });
  }
  if (list.length === 0) {
    // Gdyby nikt z piszących nie miał awatara — bierzemy wszystkich, którzy mają.
    const keys = Object.keys(avatars);
    for (let i = 0; i < keys.length && list.length < POOL_MAX; i++) {
      list.push({ uid: keys[i], url: avatars[keys[i]], nick: users[keys[i]] || keys[i] });
    }
  }
  return list;
}

function init() {
  let tries = 0;
  const timer = setInterval(function () {
    tries++;
    const data = readData();
    if (!data) {
      if (tries > 600) clearInterval(timer);   // ~60 s czekania i koniec
      return;
    }
    clearInterval(timer);
    pool = buildPool(data);
    if (pool.length === 0) return;             // brak awatarów — nie ma czego uruchamiać
    injectCss();
    build();
    startSpawning();
    resendPending();
    // Powrót na kartę (np. z innego okna): przeglądarka spowalniała timer zapasu, więc od razu świeży bilet.
    document.addEventListener('visibilitychange', function () { if (!document.hidden) keepSpare(); });
  }, 100);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
