// efekty.js — efekty gry bez wpływu na fizykę: cząstki, wstrząs, błysk po łuku, duży zysk „+N”,
// równanie MF na żywo. game.js woła on(f) dla każdego sim.fx, tick(dt), flight(sim, dt) i update(dt) co klatkę; draw.js czyta pola.
// Jak dodać efekt: nowa gałąź `f.k` w on() (sim.js wypluwa zdarzenie w s.fx), pola rysuje draw.js.
import { mfFromMeters, MF_PER_KM } from './items.js?v=79';
import { COLORS } from './draw.js?v=79';

export function createEfekty() {
  const fx = {
    particles: [],
    labels: [],       // „+1”/„+2” za strefy MF, lecą z piłeczki: { v, age } (draw.js rysuje względem piłeczki)
    hits: [],         // „+N MF” za ptaka/balon MF, lecą nad piłeczką (max 4): { v, gold, big, bal, age, idle, bump }; girlanda sumuje się w jednym
    falls: [],        // spadające awatary zestrzelonych ptaków (max 4): { x, y, vx, vy, rot, vr, age, b: {x, y, place} }
    // Równanie MF na żywo (lewa krawędź, jedna linia): znaki { ch, c } (c: '' | 'sum' | 'mf' | 'x' | 'd' | 'dm' | 'z1' | 'z2'),
    // `shown` = ile już „napisane”, `ver` rośnie przy każdej zmianie widoku (draw.js trzyma podręczny obraz).
    eq: { list: [], shown: 0, ver: 0, on: false },
    shake: 0,
    flash: 0,         // błysk ekranu przy zebraniu łuku (1 → 0)
    gain: null        // duży zysk MF na środku: { v, age } (sumuje zdarzenia w krótkim oknie)
  };
  let gainSum = 0;    // suma zysku w bieżącym oknie
  let gainWin = 0;    // pozostały czas okna (s); po wygaśnięciu suma startuje od zera

  // Równanie: suma = zebrane + wpisany dystans (to samo, co items.js `totalMf` na końcu lotu).
  let eqTotal = 0, openArc = null, distDone = 0, distT = 0, eqPen = 0, ended = false;
  let parenN = 0, arcIdle = 0;   // kulki w otwartym nawiasie łuku, czas od ostatniej z nich
  const ARC_IDLE = 0.8;          // s bez kulki łuku → nawias się zamyka
  function put(text, c) { for (const ch of text) fx.eq.list.push({ ch: ch, c: c || '' }); }
  // Kulka zwykłego łuku = 0,5 MF: ułamki z przecinkiem.
  function num(v) { return String(Math.round(v * 10) / 10).replace('.', ','); }
  function putSum() { put(' = '); put(num(eqTotal), 'sum'); put(' MF', 'mf'); zoneOpen = false; zoneAge = 0; }
  function closeArc() {
    if (openArc === null) return;
    put(')');
    putSum();
    openArc = null;
  }
  function distWrite(meters, min) {
    const d = mfFromMeters(meters) - distDone;
    if (d < min || openArc !== null) return;
    distDone += d;
    eqTotal += d;
    if (fx.eq.list.length) put(' + ', 'd');
    put(String(d), 'd');
    put(' za ' + Math.round(d * 1000 / MF_PER_KM) + ' m', 'dm');
    putSum();
  }
  // MF za strefy (kosmos = 1, czerwień = 2) wpisuje się na bieżąco, każdy osobno: „+ 2 + 2 + 2” (prośba użytkownika 19.10);
  // suma „= N MF” po nich co ~2 s albo po wyjściu ze strefy. W otwartym nawiasie łuku czekają (zonePend) do jego zamknięcia.
  let zonePend = { 1: 0, 2: 0 }, zoneOpen = false, zoneAge = 0, zoneIdle = 0;
  function zonePut(z) {
    eqTotal += z;
    if (fx.eq.list.length) put(' + ', 'z' + z);
    put(String(z), 'z' + z);
    zoneOpen = true;
  }
  function zoneFlush() {
    for (const z of [1, 2]) {
      for (; zonePend[z] > 0; zonePend[z] -= z) zonePut(z);
    }
  }
  function zoneWrite() {
    zoneFlush();
    if (zoneOpen) putSum();
  }

  // Nowa partia (błysk wygasa sam).
  fx.reset = function () {
    fx.particles.length = 0;
    fx.labels.length = 0;
    fx.hits.length = 0;
    fx.falls.length = 0;
    fx.eq ={ list: [], shown: 0, ver: 0, on: false };
    eqTotal = 0; openArc = null; distDone = 0; distT = 0; eqPen = 0; ended = false; parenN = 0; arcIdle = 0;
    zonePend = { 1: 0, 2: 0 }; zoneOpen = false; zoneAge = 0; zoneIdle = 0;
    fx.shake = 0;
    fx.gain = null;
    gainSum = 0;
    gainWin = 0;
  };

  // Co klatkę przed krokami fizyki: mnożnik tempa (zawsze 1; zwolnienie po łuku usunięte 21.10).
  fx.tick = function (dt) {
    fx.flash = Math.max(0, fx.flash - dt * 2.5);
    gainWin = Math.max(0, gainWin - dt);
    if (fx.gain) {
      fx.gain.age += dt;
      if (fx.gain.age > 1.4) fx.gain = null;
    }
    // „Pisanie” równania ~30 znaków/s
    if (fx.eq.shown < fx.eq.list.length) {
      eqPen += dt * 30;
      const n = Math.min(fx.eq.list.length - fx.eq.shown, Math.floor(eqPen));
      if (n > 0) { fx.eq.shown += n; eqPen -= n; fx.eq.ver++; }
    } else eqPen = 0;
    return 1;
  };

  // Co klatkę: przyrost MF za dystans dopisuje się co ≥ 1,5 s (gdy ≥ 3 MF i żaden łuk nie jest otwarty);
  // strefy: składniki od razu (czekające w nawiasie łuku zaraz po jego zamknięciu), suma co ~2 s albo po wyjściu ze strefy;
  // koniec lotu domyka łuk i dopisuje resztę stref i dystansu.
  fx.flight = function (sim, dt) {
    if (sim.phase === 'fly') {
      distT += dt;
      if (distT >= 1.5) { distT = 0; distWrite(sim.meters, 3); }
      if (openArc !== null && (arcIdle += dt) >= ARC_IDLE) closeArc();   // przerwa w kulkach łuku: nawias nie blokuje stref i dystansu
      if (openArc === null) zoneFlush();
      if (zoneOpen) {
        zoneAge += dt;
        zoneIdle += dt;
        if ((zoneAge >= 2 || zoneIdle >= 0.5) && openArc === null) putSum();
      }
    } else if (sim.phase === 'over' && fx.eq.on && !ended) {
      ended = true;
      closeArc();
      zoneWrite();
      distWrite(sim.meters, 1);
    }
  };

  fx.on = function (f) {
    if (f.k === 'boom') {
      const cols = [COLORS.boom1, COLORS.boom2, COLORS.boom3];
      for (let i = 0; i < 18; i++) {
        if (fx.particles.length > 120) break;
        fx.particles.push({
          x: f.x,
          y: f.y,
          vx: (Math.random() - 0.5) * 520,
          vy: 80 + Math.random() * 420,
          life: 0.4 + Math.random() * 0.45,
          size: 2 + Math.random() * 3,
          col: cols[i % cols.length]
        });
      }
      fx.shake = Math.min(12, fx.shake + 9);
    } else if (f.k === 'puff') {
      for (let i = 0; i < 6; i++) {
        if (fx.particles.length > 120) break;
        fx.particles.push({
          x: f.x,
          y: f.y,
          vx: (Math.random() - 0.5) * 120,
          vy: -80 - Math.random() * 120,
          life: 0.2 + Math.random() * 0.2,
          size: 1.5 + Math.random() * 2,
          col: COLORS.puff
        });
      }
    } else if (f.k === 'bounce') {
      for (let i = 0; i < 4; i++) {
        if (fx.particles.length > 120) break;
        fx.particles.push({
          x: f.x,
          y: f.y,
          vx: (Math.random() - 0.5) * 220,
          vy: 40 + Math.random() * 160,
          life: 0.25 + Math.random() * 0.25,
          size: 1.5 + Math.random() * 2,
          col: COLORS.gray
        });
      }
      fx.shake = Math.min(10, fx.shake + 2);
    } else if (f.k === 'boost') {
      for (let i = 0; i < 12; i++) {
        if (fx.particles.length > 120) break;
        fx.particles.push({
          x: f.x,
          y: f.y,
          vx: 120 + Math.random() * 260,
          vy: (Math.random() - 0.5) * 260,
          life: 0.22 + Math.random() * 0.22,
          size: 1.5 + Math.random() * 2,
          col: COLORS.boost
        });
      }
      fx.shake = Math.min(8, fx.shake + 3);
    } else if (f.k === 'launchpad') {
      // Wyrzutnia: wachlarz iskier w górę z blatu + mocniejszy wstrząs.
      const cols = [COLORS.platTop, COLORS.accent, COLORS.boost];
      for (let i = 0; i < 16; i++) {
        if (fx.particles.length > 120) break;
        fx.particles.push({
          x: f.x + (Math.random() - 0.5) * 60,
          y: f.y,
          vx: (Math.random() - 0.3) * 260,
          vy: 260 + Math.random() * 420,
          life: 0.3 + Math.random() * 0.3,
          size: 1.5 + Math.random() * 2.5,
          col: cols[i % cols.length]
        });
      }
      fx.shake = Math.min(10, fx.shake + 5);
    } else if (f.k === 'tramp') {
      // Trampolina: niebieskie iskry w górę z maty.
      for (let i = 0; i < 14; i++) {
        if (fx.particles.length > 120) break;
        fx.particles.push({
          x: f.x + (Math.random() - 0.5) * 120,
          y: f.y,
          vx: (Math.random() - 0.5) * 160,
          vy: 300 + Math.random() * 400,
          life: 0.3 + Math.random() * 0.3,
          size: 1.5 + Math.random() * 2.5,
          col: i % 2 ? '#22d3ee' : '#67e8f9'
        });
      }
      fx.shake = Math.min(10, fx.shake + 4);
    } else if (f.k === 'dynamite') {
      // Dynamit: duży wybuch, słup ognia w górę, mocny wstrząs.
      const cols = [COLORS.boom1, COLORS.boom2, COLORS.boom3, '#dc2626'];
      for (let i = 0; i < 40; i++) {
        if (fx.particles.length > 200) break;
        fx.particles.push({
          x: f.x + (Math.random() - 0.5) * 30,
          y: f.y,
          vx: (Math.random() - 0.5) * 700,
          vy: 200 + Math.random() * 900,
          life: 0.5 + Math.random() * 0.6,
          size: 2.5 + Math.random() * 4,
          col: cols[i % cols.length]
        });
      }
      fx.shake = 14;
    } else if (f.k === 'bird') {
      // Ptak zestrzelony: rozbłysk, ~14 piór (wolno opadają i się kołyszą, fx.update `p.f`), spadający awatar.
      if (fx.particles.length <= 200) fx.particles.push({ x: f.x, y: f.y, vx: 0, vy: 0, life: 0.2, ring: 0.2, size: 40 });
      for (let i = 0; i < 14; i++) {
        if (fx.particles.length > 200) break;
        const a = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 260;
        fx.particles.push({
          x: f.x,
          y: f.y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp + 120,
          life: 1.1 + Math.random() * 0.7,
          size: 3 + Math.random() * 2.5,
          col: i % 3 ? '#f8fafc' : '#7dd3fc',
          f: true,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 8,
          ph: Math.random() * 6
        });
      }
      if (fx.falls.length >= 4) fx.falls.shift();
      fx.falls.push({ x: f.x, y: f.y, vx: 60 + Math.random() * 80, vy: 150, rot: 0, vr: (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 3),
        age: 0, b: { x: f.x, y: f.y, place: f.place === undefined ? -1 : f.place } });
      fx.shake = Math.min(8, fx.shake + 2);
    } else if (f.k === 'arc') {
      // Fajerwerk: rozbłysk iskier + napis „łuk 30 × 5 = 150” (suma łuku × f.mult, sim.js arcMult).
      const cols = [COLORS.mf10, COLORS.mf15, COLORS.mf20, COLORS.boost, COLORS.text];
      for (let i = 0; i < 36; i++) {
        if (fx.particles.length > 200) break;
        const a = (i / 36) * Math.PI * 2;
        const sp = 120 + Math.random() * 180;
        fx.particles.push({
          x: f.x,
          y: f.y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp + 60,
          life: 0.7 + Math.random() * 0.4,
          size: 1.8 + Math.random() * 1.6,
          col: cols[i % cols.length]
        });
      }
      // Równanie: „(…) × 10 = N MF”, gdy w nawiasie stoją wszystkie kulki łuku (kulki już dopisane przy 'mf').
      // Nawias zamknięty wcześniej (przerwa w zbieraniu) → dopłata osobno: „+ N za łuk”.
      if (openArc !== null && parenN === f.n) {
        eqTotal += f.bonus;
        put(')');
        put(' × ' + f.mult, 'x');
        putSum();
        openArc = null;
      } else {
        closeArc();
        eqTotal += f.bonus;
        put(' + ');
        put(num(f.bonus) + ' za łuk', 'x');
        putSum();
      }
      addGain(f.bonus, true);   // kulki łuku już doliczone przy 'mf', tu tylko dopłata (razem = suma × f.mult)
      // Słupek na środku ekranu: wiersze dodawane po kolei, potem × mnożnik i wynik.
      fx.shake = Math.min(8, fx.shake + 2);
      fx.flash = 1;            // błysk bez zwolnienia czasu (21.10: piłka nie może wyglądać na hamującą)
    } else if (f.k === 'launch') {
      fx.eq.on = true;
    } else if (f.k === 'zone') {
      // Kosmos / czerwień: etykieta z piłeczki od razu, w równaniu osobny składnik (fx.flight, ta sama klatka).
      zonePend[f.v] = (zonePend[f.v] || 0) + f.v;
      zoneIdle = 0;
      addGain(f.v);
      if (fx.labels.length < 8) fx.labels.push({ v: f.v, age: 0 });
    } else if (f.k === 'mf') {
      // Równanie: kulka łuku otwiera nawias (inny łuk zamyka poprzedni bez × 10), kulka bez łuku to zwykłe „+ v”.
      const arc = f.arc === undefined ? null : f.arc;
      if (f.bal || f.bird) zoneFlush();   // balon MF / ptak w strefie: zaległe „+ 1/+ 2” stref przed „+ 30”
      if (arc !== openArc) {
        closeArc();   // suma przy „)” bez tej kulki, więc doliczamy ją dopiero niżej
        if (arc !== null) { put(fx.eq.list.length ? ' + (' : '('); openArc = arc; parenN = 0; }
        else if (fx.eq.list.length) put(' + ');
      } else if (fx.eq.list.length) put(' + ');
      if (arc !== null) { parenN++; arcIdle = 0; }
      eqTotal += f.v;
      put(num(f.v));
      addGain(f.v);
      if (f.bird || f.bal) {
        // Napis „+N MF” nad piłeczką; kolejny balon girlandy (≤ 0,3 s) dolicza się do poprzedniego z podskokiem.
        const last = fx.hits[fx.hits.length - 1];
        if (f.bal && last && last.bal && last.idle < 0.3) { last.v += f.v; last.idle = 0; last.bump = 0; }
        else {
          if (fx.hits.length >= 4) fx.hits.shift();
          const top = !!f.bird && f.v > 10;   // ptak #1–#3 (zwykły 10 MF)
          fx.hits.push({ v: f.v, gold: top || !!f.bal, big: top, bal: !!f.bal, age: 0, idle: 0, bump: 0 });
        }
      }
      const col = f.v >= 20 ? COLORS.mf20 : (f.v >= 15 ? COLORS.mf15 : COLORS.mf10);
      for (let i = 0; i < 5; i++) {
        if (fx.particles.length > 120) break;
        fx.particles.push({
          x: f.x,
          y: f.y,
          vx: (Math.random() - 0.5) * 160,
          vy: 60 + Math.random() * 140,
          life: 0.3 + Math.random() * 0.25,
          size: 1.5 + Math.random() * 1.5,
          col: col
        });
      }
    }
  };

  fx.update = function (dt) {
    for (let i = fx.labels.length - 1; i >= 0; i--) {
      fx.labels[i].age += dt;
      if (fx.labels[i].age > 0.9) fx.labels.splice(i, 1);
    }
    for (let i = fx.hits.length - 1; i >= 0; i--) {
      const h = fx.hits[i];
      h.age += dt; h.idle += dt; h.bump += dt;
      if (h.idle > 0.8) fx.hits.splice(i, 1);
    }
    for (let i = fx.particles.length - 1; i >= 0; i--) {
      const p = fx.particles[i];
      p.life -= dt;
      if (p.life <= 0) { fx.particles.splice(i, 1); continue; }
      if (p.ring) continue;   // rozbłysk stoi w miejscu
      if (p.f) {   // pióro: opór powietrza, wolne opadanie, kołysanie
        const k = Math.max(0, 1 - 3 * dt);
        p.vx *= k;
        p.vy = Math.max(-110, p.vy * k - 250 * dt);
        p.rot += p.vr * dt;
        p.x += (p.vx + Math.sin(p.life * 5 + p.ph) * 50) * dt;
        p.y += p.vy * dt;
        continue;
      }
      p.vy -= 900 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y < 2) { p.y = 2; p.vy *= -0.35; p.vx *= 0.7; }
    }
    for (let i = fx.falls.length - 1; i >= 0; i--) {
      const a = fx.falls[i];
      a.age += dt;
      if (a.age > 0.8) { fx.falls.splice(i, 1); continue; }
      a.vy -= 900 * dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.rot += a.vr * dt;
    }
    if (fx.shake > 0) fx.shake = Math.max(0, fx.shake - dt * 40);
  };

  // Duży zysk: zebrania w oknie 1,5 s sumują się; od progu 50 MF pokazujemy „+N” na środku.
  // Pełny łuk (force) pokazuje napis zawsze: od v5 zwykły łuk to tylko 8 MF, łuk 3. miejsca 36.
  function addGain(v, force) {
    if (gainWin <= 0) gainSum = 0;
    gainSum += v;
    gainWin = 1.5;
    if (force || gainSum >= 50) fx.gain = { v: gainSum, age: 0 };
  }

  return fx;
}
