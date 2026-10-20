// game.js — gra-nakładka: pętla, wejście, kamera. Fizyka w sim.js, rysowanie w draw.js.
// Canvas jest przezroczysty (clearRect) — przyciemniona strona licznika przebija spod spodu.
import { create, step, DT, GEOM, START_TICKS_BACK, TICK, SPEED, SIM_VER, MAX_FLY_STEPS } from './sim.js?v=57';
import { AIM_MAX_STEPS, STEPS_PER_SEC } from './replay.js?v=57';
import { drawScene, COLORS, zoneLevels } from './draw.js?v=57';
import { createEfekty } from './efekty.js?v=57';
import { modsFor } from './items.js?v=57';

const GROUND_MARGIN = 56;        // ile px zostawiamy pod linią ziemi
const BEST_KEY = 'lotnik.best';
// Strona z ?test=1: łańcuch bomb (trampoliny i dynamit w zwykłej gęstości, sim.js TEST_DENSE), gra tylko lokalnie (bez biletu i rekordu).
const TEST = typeof location !== 'undefined' && new URLSearchParams(location.search).get('test') === '1';
// ?fps=1: licznik klatek po lewej (z 2 s: mediana klatki, najgorsza, czas JS, zacięcia), do pomiaru
// na telefonie. Porównania A/B na telefonie: ?dpr=1 / ?dpr=1.5 (gęstość pikseli canvasa, domyślnie 2),
// ?strefy=0 (przyciemnienie bez koloru stref, czyli bez zmian tła).
const PARAMS = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams('');
const FPS = PARAMS.get('fps') === '1';
const DPR_FORCE = Number(PARAMS.get('dpr')) || 0;
const ZONES_ON = PARAMS.get('strefy') !== '0';
// ?tlo=1: nieprzezroczysty canvas z kolorem przyciemnienia malowanym co klatkę (o.bg), bez mieszania z warstwami
// pod spodem. Próba na rwanie kolorów na telefonie (strona i tak ukryta).
const OPAQUE = PARAMS.get('tlo') === '1';
const TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches;
// Tempo lotu: dotyk 0,8 (wybór użytkownika po próbie A/B 20.10; mały ekran, palec zasłania, wolniejszy dotyk),
// mysz 1; ?tempo=0.5–1 nadpisuje. Mnoży tylko czas rzeczywisty, kroki fizyki stałe DT, więc wynik, MF
// i powtórka bez zmian; serwer sprawdza tylko grę za szybką.
const TEMPO = Math.min(1, Math.max(0.5, Number(PARAMS.get('tempo')) || (TOUCH ? 0.8 : 1)));

function newSeed() {
  return Math.floor(Math.random() * 4294967296);
}

export function createGame(opts) {
  const o = opts || {};
  const canvas = o.canvas;
  const ctx = canvas.getContext('2d', { alpha: !OPAQUE });
  const bg = OPAQUE && o.bg ? o.bg : null;   // () => kolor tła (nieprzezroczysty)
  const nick = String(o.nick || '');
  const onEnd = o.onEnd || function () {};
  const onClose = o.onClose || function () {};
  const onZone = o.onZone || function () {};   // poziomy stref (kosmos, czerwień) 0–1 co 1/20 → tło przyciemnienia

  const bestKey = (o.lsPrefix || '') + BEST_KEY;   // prod „p.”: osobny rekord niż na /test/
  let best = 0;
  try { best = Number(localStorage.getItem(bestKey)) || 0; } catch (e) { best = 0; }

  let W = 1, H = 1, dpr = 1, scale = 1;
  // Oddalenie kamery w szybkim/wysokim locie: mnoży tylko rysowanie (sx/sy, view, draw), nie `scale`
  // naciągu procy. Celowanie zawsze przy 1.
  let zoom = 1;
  const view = { w: 1, h: 1 };
  const cam = { x: 0, y: 0 };

  // Ekwipunek wpływa na fizykę tylko przez `mods`; pusty loadout = stare zachowanie.
  let loadout = Array.isArray(o.loadout) ? o.loadout.slice() : [];
  let mods = modsFor(loadout);
  let runLoadout = loadout.slice();

  // Magic Find: właściciele łuków (top 3 rankingu, z nakladka.js) z awatarami.
  const owners = Array.isArray(o.owners) ? o.owners : [];
  const imgCache = {};
  function ownerImg(url) {
    if (!url) return { img: new Image(), ok: false };
    if (imgCache[url]) return imgCache[url];
    const rec = { img: new Image(), ok: false };
    rec.img.onload = function () { rec.ok = true; };
    rec.img.src = url;
    imgCache[url] = rec;
    return rec;
  }

  // Bilet partii {seed, mods, owners, simVer}: z serwera (o.ticket, potem o.nextTicket()).
  // Bez biletu: plansza lokalna, proca czeka na bilet (lateTicket); tylko tryb testowy gra bez biletu.
  let firstTicket = o.ticket || null;
  const nextTicket = typeof o.nextTicket === 'function' ? o.nextTicket : null;
  let ticket = null;
  let runMods = mods;
  let runOwners = owners;
  let ownerImgs = [];
  // Odtwarzacz (out/odtworz.html): o.watch = { seed, mods, owners, inputs } z /partia. Wejścia z listy, klik i klawisze nic
  // nie robią; bez biletu, bez restartu po 2 min celowania i bez zapisu rekordu w localStorage.
  const watch = o.watch || null;
  let speed = 1;
  function takeTicket() {
    if (watch) {
      ticket = null;
      seed = watch.seed;
      runMods = watch.mods || {};
      runOwners = Array.isArray(watch.owners) ? watch.owners : [];
      ownerImgs = runOwners.map(function (ow) { return ownerImg(ow && ow.url); });
      return;
    }
    let t = firstTicket;
    firstTicket = null;
    if (!t && nextTicket) t = nextTicket();
    useTicket(t);
  }
  function useTicket(t) {
    if (t && t.simVer !== SIM_VER) t = null;   // stara karta / inna fizyka: gramy lokalnie
    if (TEST) t = null;
    ticket = t || null;
    seed = ticket ? ticket.seed : newSeed();
    runMods = ticket && ticket.mods ? ticket.mods : testMods(mods);
    runOwners = ticket && Array.isArray(ticket.owners) ? ticket.owners : owners;
    ownerImgs = runOwners.map(function (ow) { return ownerImg(ow && ow.url); });
  }

  function testMods(m) { return TEST ? Object.assign({}, m, { chainBlast: 1 }) : m; }

  let seed = 0;
  let sim = create(seed, runMods, { owners: runOwners, dense: TEST });   // zastępcza; bilet bierze restart(true) na starcie
  let acc = 0;
  let last = 0;
  let raf = 0;
  let pending = [];
  let log = [];
  let finished = false;
  let dead = false;
  const fx = createEfekty();   // cząstki, wstrząs, błysk, „+N”, lista na żywo (efekty.js)
  let notice = null;    // komunikat na środku ekranu: { text, t } (t = sekundy do zniknięcia)
  let drag = null;      // trwające naciąganie procy: { id, x0, y0, x, y } w px ekranu
  let cursor = '';

  // Ptaki = awatary losowych graczy ze skrzydłami (najwyżej 24, ładowane raz; tylko wygląd, fizyka bez zmian).
  const birdUrls = (o.birdUrls || []).filter(Boolean);
  for (let i = birdUrls.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = birdUrls[i]; birdUrls[i] = birdUrls[j]; birdUrls[j] = t; }
  const birdImgs = birdUrls.slice(0, 24).map(ownerImg);

  // Awatar gracza (okrągła postać). Bez crossOrigin — tylko rysujemy, nie czytamy pikseli.
  const img = new Image();
  let imgOk = false;
  if (o.avatarUrl) {
    img.onload = function () { imgOk = true; };
    img.onerror = function () { imgOk = false; };
    img.src = o.avatarUrl;
  }

  // --- rozmiar i współrzędne -------------------------------------------------

  function resize() {
    // Max 2 px na punkt, też na telefonie. Pomiar na Mi Note 10 (20.10, ślad GPU przez adb): niecałkowite 1,5
    // dawało 3× więcej klatek GPU > 10 ms niż 2 albo 1 (koszt zależy od skalowania, nie od liczby pikseli).
    dpr = DPR_FORCE ? Math.min(3, DPR_FORCE) : Math.min(2, window.devicePixelRatio || 1);
    // Rozmiar z samego canvasa (CSS 100% sceny), nie z okna: na telefonie pasek adresu zmienia innerHeight
    // inaczej niż warstwę fixed, a wtedy obraz się rozciągał albo dół wychodził pod pasek.
    W = Math.max(1, canvas.clientWidth || window.innerWidth);
    H = Math.max(1, canvas.clientHeight || window.innerHeight);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Mała skala = małe przeszkody i cienka ziemia (gra jest nakładką, nie pełnym światem).
    // Pion (telefon): skala z szerokości tak, żeby widać było ~950 jednostek do przodu (było 620), piłeczka ~15 px.
    scale = H > W
      ? Math.max(0.4, Math.min(1.1, Math.min(W / 950, H / 760)))
      : Math.max(0.45, Math.min(1.1, Math.min(W / 620, H / 760)));
    updateView();
  }

  function viewScale() { return scale * zoom; }
  function updateView() {
    view.w = W / viewScale();
    view.h = H / viewScale();
  }
  function groundY() { return H - GROUND_MARGIN; }
  function sx(x) { return (x - cam.x) * viewScale(); }
  function sy(y) { return groundY() - (y - cam.y) * viewScale(); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function startCamX() { return GEOM.slingX - START_TICKS_BACK * TICK; }

  // --- sterowanie ------------------------------------------------------------

  function pushAction(action) {
    if (sim.phase === 'over' || watch) return;
    pending.push([sim.step, action]);
    log.push([sim.step, action]);
  }

  function takeActions(at) {
    let list = null;
    while (pending.length > 0 && pending[0][0] <= at) {
      const item = pending.shift();
      if (item[0] === at) (list || (list = [])).push(item[1]);
    }
    return list;
  }

  // Klik / tap / spacja w locie = jeden podrzut awatara w górę.
  function puff() {
    if (sim.phase !== 'fly' || sim.puffs <= 0 || sim.puffCool > 0) return;
    pushAction(['puff']);
  }

  // Nowa partia = nowy bilet. Bez nowego ziarna (freshSeed false) ta sama plansza, ale już
  // lokalnie (bilet serwera jest jednorazowy).
  function restart(freshSeed) {
    runLoadout = loadout.slice();
    if (freshSeed || watch) takeTicket();
    else { ticket = null; runMods = testMods(mods); }
    lateAt = freshSeed && !ticket && nextTicket && !TEST ? 0 : -1;
    sim = create(seed, runMods, { owners: runOwners, dense: TEST });
    pending = watch ? watch.inputs.slice() : [];
    log = [];
    finished = false;
    drag = null;
    acc = 0;
    fx.reset();
    zoom = 1;
    updateView();
    cam.x = startCamX();
    cam.y = 0;
  }

  // Partia bez biletu (zapas przeterminowany w tle, zmiana ekwipunku, brak sieci): proca zablokowana (waitingTicket),
  // co 1/4 s pytamy o bilet i po jego przyjściu zaczynamy tę partię od nowa z ziarnem serwera. Bez biletu nie ma
  // strzału, więc każdy rozegrany wynik ma bilet i idzie do serwera.
  let lateAt = -1;
  function waitingTicket() { return lateAt >= 0; }
  function lateTicket() {
    if (sim.step < lateAt) return;
    lateAt = sim.step + STEPS_PER_SEC / 4;
    const t = nextTicket();
    if (!t || t.simVer !== SIM_VER) return;
    useTicket(t);
    lateAt = -1;
    sim = create(seed, runMods, { owners: runOwners, dense: TEST });
    pending = [];
    acc = 0;
  }

  // Ekwipunek ustawiany z zewnątrz (przyszły panel przedmiotów). Wpływa na
  // następną partię; nie przerywa trwającego lotu.
  function setLoadout(ids) {
    loadout = Array.isArray(ids) ? ids.slice() : [];
    mods = modsFor(loadout);
  }

  // --- pętla -----------------------------------------------------------------

  function frame(now) {
    if (dead) return;
    const t0 = FPS ? performance.now() : 0;
    if (!last) last = now;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    // zwolnienie po łuku: wolniej tyka symulacja (kroki stałe DT, więc tor lotu się nie zmienia)
    const ts = fx.tick(dt);

    if (lateAt >= 0) lateTicket();
    if (sim.phase !== 'over') {
      acc += dt * ts * speed * (sim.phase === 'fly' && !watch ? TEMPO : 1);
      let guard = 0;
      while (acc >= DT && guard < 40) {
        const acts = takeActions(sim.step);
        step(sim, acts);
        for (let i = 0; i < sim.fx.length; i++) fx.on(sim.fx[i]);
        acc -= DT;
        guard++;
      }
      if (guard >= 40) acc = 0;
      // 2 min celowania bez strzału: serwer takiej partii nie przyjmie → nowy bilet.
      if (sim.phase === 'aim' && sim.step >= AIM_MAX_STEPS && !watch) {
        restart(true);
        notice = { text: 'Minęły 2 minuty bez strzału — nowa partia', t: 3 };
      }
    } else {
      acc = 0;
    }
    if (sim.phase === 'over' && !finished) finishRun();

    fx.flight(sim, dt);
    fx.update(dt);
    render(acc / DT, dt, now);
    if (FPS) workMs = performance.now() - t0;
    raf = requestAnimationFrame(frame);
  }

  function finishRun() {
    finished = true;
    if (watch) { onEnd({ meters: sim.meters, steps: sim.step, watch: true }); return; }
    const prevBest = best;   // rekord sprzed partii (0 = pierwszy lot na tym urządzeniu), karta pokazuje różnicę
    const isRecord = !TEST && sim.meters > best;
    if (isRecord) {
      best = Math.floor(sim.meters);
      try { localStorage.setItem(bestKey, String(best)); } catch (e) { /* ignoruj */ }
    }
    // Zapis partii (ziarno + lista wejść) — przyda się do odtworzenia wyniku.
    window.lotnikLastRun = {
      seed: sim.seed,
      mods: sim.mods,
      owners: sim.owners.map(function (ow) { return { mult: ow.mult, size: ow.size, uid: ow.uid }; }),
      simVer: SIM_VER,
      saved: !!ticket,
      ticket: ticket,
      loadout: runLoadout.slice(),
      inputs: log,
      meters: sim.meters,
      bombsHit: sim.bombsHit,
      boostsUsed: sim.boostsUsed,
      mf: sim.mf
    };
    onEnd({
      meters: sim.meters,
      best: best,
      prevBest: prevBest,
      newRecord: isRecord,
      test: TEST,
      beaten: sim.flySteps > MAX_FLY_STEPS,   // lot do bezpiecznika 10 min = koniec gry
      nick: nick,
      seed: sim.seed,
      bombsHit: sim.bombsHit,
      puffsUsed: sim.puffsUsed,
      boostsUsed: sim.boostsUsed,
      mf: sim.mf,
      loadout: runLoadout.slice(),
      mods: sim.mods,
      saved: !!ticket
    });
  }

  // --- kamera ----------------------------------------------------------------

  function playerPos(alpha) {
    if (sim.phase === 'aim') {
      const pull = drag ? pullFromDrag(drag) : { x: 0, y: 0 };
      return { x: GEOM.slingX + pull.x, y: GEOM.slingY + pull.y };
    }
    return { x: lerp(sim.px, sim.x, alpha), y: lerp(sim.py, sim.y, alpha) };
  }

  function updateCamera(dt, p) {
    // Start: proca na 3. kresce (dwie kratki zapasu). Potem kamera prowadzi
    // postać, ale nigdy nie cofa się przed start — brak skoku na początku lotu.
    // W pionie piłeczka bliżej lewej krawędzi: więcej widać przed nią.
    const lead = Math.max(view.w * (H > W ? 0.22 : 0.32), -startCamX());
    const tx = sim.phase === 'aim'
      ? startCamX()
      : Math.max(startCamX(), p.x - lead);
    // Ziemia stoi na dole ekranu, dopóki postać nie dojdzie w górę kadru (ćwiartka od góry);
    // dopiero wtedy kamera idzie za nią. Dzięki temu widać, że lecimy w powietrzu.
    const ty = Math.max(0, p.y - (groundY() - H * 0.25) / viewScale());
    const kx = 1 - Math.exp(-16 * dt);
    const ky = 1 - Math.exp(-9 * dt);
    cam.x += (tx - cam.x) * kx;
    cam.y += (ty - cam.y) * ky;
  }

  // Oddalenie: od 1500 jedn./s albo 40 m wysokości płynnie do 0,6 (pełne przy 3500 / 250 m);
  // efektywna skala nie schodzi poniżej 0,35. Oddala się szybciej, niż wraca.
  const ZOOM_MIN = 0.6, ZOOM_SCALE_MIN = 0.35;
  function updateZoom(dt, p) {
    if (sim.phase === 'aim') {
      zoom = 1;
    } else {
      const sp = Math.sqrt(sim.vx * sim.vx + sim.vy * sim.vy);
      const fs = Math.min(1, Math.max(0, (sp - 1500) / 2000));
      const fh = Math.min(1, Math.max(0, (p.y - 500) / 2500));
      const lo = Math.min(1, Math.max(ZOOM_MIN, ZOOM_SCALE_MIN / scale));
      const target = 1 - (1 - lo) * Math.max(fs, fh);
      const k = 1 - Math.exp(-(target < zoom ? 1.6 : 0.8) * dt);
      zoom += (target - zoom) * k;
    }
    updateView();
  }


  // --- rysowanie -------------------------------------------------------------

  let zoneKey = '';
  // JS = symulacja + rysowanie jednej klatki (poprzedniej). Długa klatka przy krótkim JS = koszt po stronie
  // przeglądarki (kompozycja warstw, wielkość canvasa), nie kodu gry. Zacięcia = klatki > 1,5 × mediana.
  const fpsBuf = [];
  const workBuf = [];
  let workMs = 0;
  let fpsText = '';
  let fpsT = 0;
  function drawFps(dt) {
    fpsBuf.push(dt * 1000);
    workBuf.push(workMs);
    fpsT += dt;
    if (fpsT >= 2) {
      const s = fpsBuf.slice().sort(function (a, b) { return a - b; });
      const w = workBuf.slice().sort(function (a, b) { return a - b; });
      const med = s[Math.floor(s.length / 2)];
      let jank = 0;
      for (let i = 0; i < s.length; i++) if (s[i] > med * 1.5) jank++;
      fpsText = Math.round(1000 / med) + ' kl./s · klatka ' + med.toFixed(1) + ' ms, najgorsza ' + s[s.length - 1].toFixed(0) +
        ' · JS ' + w[Math.floor(w.length / 2)].toFixed(1) + ' ms, max ' + w[w.length - 1].toFixed(0) +
        ' · zacięcia ' + jank + ' · dpr ' + dpr + (ZONES_ON ? '' : ' · strefy 0');
      fpsBuf.length = 0;
      workBuf.length = 0;
      fpsT = 0;
    }
    if (!fpsText) return;
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    const fy = Math.round(H / 2 - 56);   // po lewej nad równaniem MF: poza HUD-em i poza kciukami
    ctx.fillRect(6, fy, ctx.measureText(fpsText).width + 12, 18);
    ctx.fillStyle = '#86efac';
    ctx.fillText(fpsText, 12, fy + 13);
  }

  function setCursor(c) {
    if (c !== cursor) {
      cursor = c;
      canvas.style.cursor = c;
    }
  }

  function render(alpha, dt, now) {
    const p = playerPos(alpha);
    updateZoom(dt, p);
    updateCamera(dt, p);
    const pull = drag ? pullFromDrag(drag) : { x: 0, y: 0 };
    drawScene({
      ctx: ctx,
      W: W,
      H: H,
      scale: viewScale(),
      sx: sx,
      sy: sy,
      groundY: groundY(),
      cam: cam,
      view: view,
      sim: sim,
      p: p,
      pull: pull,
      drag: drag,
      particles: fx.particles,
      labels: fx.labels,
      falls: fx.falls,
      ownerImgs: ownerImgs,
      birdImgs: birdImgs,
      best: best,
      nick: nick,
      img: img,
      imgOk: imgOk,
      shake: fx.shake,
      flash: fx.flash,
      eq: fx.eq,
      gain: fx.gain,
      now: now,
      dpr: dpr,
      lite: TOUCH,   // telefon: tańsze efekty (draw.js drawMfLine) i podpowiedź tylko na początku lotu
      portrait: TOUCH && H > W,
      bg: bg ? bg() : ''
    });
    const z = zoneLevels(p.y);
    const zk = z.space + ',' + z.hell;
    if (zk !== zoneKey && ZONES_ON) {
      zoneKey = zk;
      onZone(z.space, z.hell);
    }
    if (FPS) drawFps(dt);
    if (waitingTicket()) notice = { text: 'Łączenie z serwerem…', t: 0.3 };
    if (notice) {
      notice.t -= dt;
      if (notice.t <= 0) notice = null;
      else {
        ctx.font = '700 15px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.text;
        ctx.fillText(notice.text, W / 2, H * 0.42);
      }
    }
    setCursor(drag ? 'grabbing' : (sim.phase === 'aim' ? (waitingTicket() ? 'wait' : 'grab') : 'pointer'));
  }

  // --- wejście ---------------------------------------------------------------

  function canvasPoint(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // Przeciągnięcie palca/myszy → wektor naciągu procy w jednostkach świata (y w górę).
  function pullFromDrag(d) {
    let px = (d.x - d.x0) / scale;
    let py = -(d.y - d.y0) / scale;
    const len = Math.sqrt(px * px + py * py);
    const max = GEOM.maxPull;
    if (len > max) {
      px = (px / len) * max;
      py = (py / len) * max;
    }
    if (px > 0) px = 0;                          // naciąg tylko w tył (nie strzelamy w lewo)
    const minY = GEOM.radius - GEOM.slingY;      // kulka nie schodzi pod ziemię
    if (py < minY) py = minY;
    return { x: px, y: py };
  }

  function fireDrag() {
    const d = drag;
    drag = null;
    if (!d) return;
    const pull = pullFromDrag(d);
    const len = Math.sqrt(pull.x * pull.x + pull.y * pull.y);
    if (len / GEOM.maxPull < 0.08 || waitingTicket()) return;   // za krótkie pociągnięcie = kulka wraca
    const qx = Math.round((pull.x / GEOM.maxPull) * 100);
    const qy = Math.round((pull.y / GEOM.maxPull) * 100);
    pushAction(['shot', qx, qy]);
  }

  function onPointerDown(e) {
    e.preventDefault();
    if (watch) return;
    if (sim.phase === 'aim') {
      if (drag || waitingTicket()) return;
      const p = canvasPoint(e);
      drag = { id: e.pointerId, x0: p.x, y0: p.y, x: p.x, y: p.y };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignoruj */ }
      return;
    }
    puff();
  }

  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    e.preventDefault();
    const p = canvasPoint(e);
    drag.x = p.x;
    drag.y = p.y;
  }

  function onPointerUp(e) {
    e.preventDefault();
    if (drag && e.pointerId === drag.id) fireDrag();
  }

  function onPointerCancel(e) {
    if (drag && (!e || e.pointerId === drag.id)) drag = null;
  }

  function onContextMenu(e) { e.preventDefault(); }

  function onKeyDown(e) {
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;   // pisanie w formularzu konta
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      if (!e.repeat) puff();
    } else if (e.code === 'KeyR') {
      e.preventDefault();
      if (sim.phase !== 'over' && !watch) restart(true);   // po końcu restart tylko z karty („Zagraj jeszcze raz”)
    } else if (e.code === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }


  function onResize() { resize(); }
  function onOrientation() { setTimeout(resize, 150); }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onOrientation);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
  document.addEventListener('fullscreenchange', onOrientation);

  function destroy() {
    dead = true;
    drag = null;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerCancel);
    canvas.removeEventListener('contextmenu', onContextMenu);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onOrientation);
    if (window.visualViewport) window.visualViewport.removeEventListener('resize', onResize);
    document.removeEventListener('fullscreenchange', onOrientation);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  resize();
  restart(true);
  raf = requestAnimationFrame(frame);

  return {
    restart: restart,
    setSpeed: function (k) { speed = k > 0 ? k : 1; },   // odtwarzacz: 1× / 4×
    setLoadout: setLoadout,
    getLoadout: function () { return loadout.slice(); },
    // Podgląd stanu do testów w konsoli (nie wpływa na symulację).
    info: function () {
      let aliveBombs = 0;
      for (let i = 0; i < sim.bombs.length; i++) {
        if (sim.bombs[i].alive) aliveBombs++;
      }
      return {
        phase: sim.phase,
        meters: sim.meters,
        seed: sim.seed,
        saved: !!ticket,
        waiting: waitingTicket(),
        simVer: SIM_VER,
        shotSpeedMax: SPEED,
        loadout: loadout.slice(),
        mods: Object.assign({}, sim.mods),
        puffs: sim.puffs,
        puffMax: sim.puffMax,
        puffsUsed: sim.puffsUsed,
        puffCool: sim.puffCool,
        bombsHit: sim.bombsHit,
        boostsUsed: sim.boostsUsed,
        mf: sim.mf,
        aliveBoosts: (function () {
          let n = 0;
          for (let i = 0; i < sim.boosts.length; i++) if (sim.boosts[i].alive) n++;
          return n;
        })(),
        aliveBombs: aliveBombs,
        vx: Math.round(sim.vx),
        vy: Math.round(sim.vy),
        pulling: !!drag,
        sling: { x: Math.round(sx(GEOM.slingX)), y: Math.round(sy(GEOM.slingY)) },
        scale: scale,
        zoom: Math.round(zoom * 1000) / 1000,
        viewW: Math.round(view.w),
        ahead: Math.round(cam.x + view.w - sim.x),   // jednostki świata widoczne przed piłeczką
        tempo: TEMPO,
        tickPx: TICK * scale,
        startTicksBack: START_TICKS_BACK
      };
    },
    destroy: destroy
  };
}

