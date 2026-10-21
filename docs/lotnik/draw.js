// draw.js — całe rysowanie nakładki. Tylko canvas 2D, bez fizyki.
// Canvas jest przezroczysty: rysujemy postać, procę, bomby, platformy i HUD,
// a przyciemniona strona licznika przebija z pod spodu (jeden div w nakladka.js).
import { GEOM, TICK, PICKUP_BASE, arcMult, arcPuffs, previewShot } from './sim.js?v=73';
import { mfFromMeters } from './items.js?v=73';

const TAU = Math.PI * 2;
// Jeden pasek na środku u góry: dystans, MF za dystans, rekord, podrzuty. MF na żywo: równanie po lewej (drawMfLine).
export const HUD = { y: 10, w: 240, h: 124 };

export const COLORS = {
  woodDark: '#2a1608',
  wood: '#8a5a2b',
  woodLight: '#c08a4a',
  bandDark: '#5f1414',
  band: '#b91c1c',
  pouch: '#3f2a14',
  bomb: '#111827',
  bombEdge: '#64748b',
  spark: '#fbbf24',
  platBody: '#0ea5e9',
  platTop: '#bae6fd',
  ring: '#fbbf24',
  text: '#f8fafc',
  dim: '#b6c9d6',
  accent: '#fbbf24',
  green: '#22c55e',
  distMf: '#86efac',     // MF za dystans (HUD i wpisy w równaniu)
  red: '#ef4444',
  panel: 'rgba(15,23,42,0.9)',
  ground: 'rgba(255,255,255,0.55)',
  groundFill: 'rgba(255,255,255,0.08)',
  boom1: '#fbbf24',
  boom2: '#f97316',
  boom3: '#ef4444',
  puff: '#bae6fd',
  gray: '#e5e7eb',
  mf10: '#38bdf8',
  mf15: '#fbbf24',
  mf20: '#f87171',
  boost: '#22d3ee'
};

function label(ctx, text, x, y, size, color, align, weight) {
  ctx.font = (weight || 600) + ' ' + size +
    'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

// Liczby o stałej szerokości cyfr (monospace): słupek i wynik nie skaczą przy zmianie wartości.
function mono(ctx, text, x, y, size, color, align, weight) {
  ctx.font = (weight || 700) + ' ' + size +
    'px Consolas, "Cascadia Mono", "Courier New", monospace';
  ctx.fillStyle = color;
  ctx.textAlign = align || 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

// Tekst z ciemnym obrysem, czytelny na każdym tle (bez gradientów).
function outlined(ctx, text, x, y, size, weight, align, fill) {
  ctx.font = (weight || 600) + ' ' + size +
    'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(15,23,42,0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function panel(ctx, x, y, w, h, r, fill) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fill();
}

// r = { ctx, W, H, scale, sx, sy, groundY, cam, view, sim, p, pull, drag,
//       particles, best, nick, img, imgOk, shake, now }
export function drawScene(r) {
  const { ctx, W, H, sim, shake, sx, sy, groundY, cam, view, scale, p } = r;
  if (r.bg) {   // ?tlo=1: nieprzezroczysty canvas (game.js OPAQUE)
    ctx.fillStyle = r.bg;
    ctx.fillRect(0, 0, W, H);
  } else ctx.clearRect(0, 0, W, H);

  const ox = shake > 0 ? (Math.random() - 0.5) * shake * 0.4 : 0;
  const oy = shake > 0 ? (Math.random() - 0.5) * shake * 0.7 : 0;
  ctx.save();
  ctx.translate(ox, oy);

  drawParallax(r);
  drawGround(r);
  drawPlatforms(r);
  drawTramps(r);
  drawPickups(r);
  drawBrackets(r);
  drawBoosts(r);
  drawBombs(r);
  drawDyns(r);
  drawBirds(r);
  drawMfBalloons(r);
  drawSling(r);
  drawAimGuide(r);
  drawParticles(r);
  drawPlayer(r);
  drawZoneLabels(r);
  drawHitLabels(r);
  drawPouchFront(r);
  ctx.restore();

  if (r.sim.phase !== 'over') drawHud(r);   // pod kartą końca gry bez HUD
  drawMfLine(r);
  drawHint(r);
  drawBigGain(r);
  // błysk ekranu przy zebraniu łuku (płaska warstwa, zanika w ~0,4 s)
  if (r.flash > 0) {
    ctx.fillStyle = 'rgba(251,191,36,' + (0.22 * r.flash).toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);
  }
}

// Kolor stref (kosmos, czerwień) nie jest rysowany na canvasie: pełnoekranowa półprzezroczysta warstwa co klatkę
// zacinała telefony. game.js przekazuje poziomy do nakladka.js, która zmienia tło przyciemnienia (tylko przy zmianie kroku).
// Wysokość piłki: 0–2400 = niebo z chmurami, 2400–3600 = przejście, wyżej = kosmos (strefy MF w sim.js `ZONE_*`);
// 4800–6000 niebo czerwieje do pełnej czerwieni. Kroki co 1/20, żeby tło zmieniało się rzadko.
export function zoneLevels(py) {
  const q = (v) => Math.round(Math.min(1, Math.max(0, v)) * 20) / 20;
  return { space: q((py - 2400) / 1200), hell: q((py - 4800) / 1200) };
}

// Gwiazdy: pozycje w kaflu liczone raz (ułamki 0–1), rysowane jedną ścieżką.
const STARS = [];
for (let j = 0; j < 60; j++) {
  const frac = (v) => v - Math.floor(v);
  STARS.push([frac(Math.sin(j * 12.9898) * 43758.5453), frac(Math.sin(j * 78.233) * 43758.5453)]);
}
const CLOUDS = [[120, 70, 90], [430, 110, 70], [700, 60, 110]];

// Tło paralaksy: gwiazdy i chmury w dwóch warstwach o różnym tempie przesuwu.
// Każda warstwa to powtarzalny kafel (szerokość P px), więc przewijanie jest bez końca. Jeden `fill` na warstwę.
function drawParallax(r) {
  const { ctx, W, scale, cam, groundY, p } = r;
  const gy = groundY;
  const layer = (f, P, fn) => {
    const off = ((-cam.x * scale * f) % P + P) % P;
    for (let x0 = off - P; x0 < W + P; x0 += P) fn(x0, P);
  };
  const space = zoneLevels(p.y).space;

  // gwiazdy (najdalej, prawie stoją); w kosmosie wyraźniejsze
  ctx.fillStyle = 'rgba(248,250,252,' + (0.25 + 0.5 * space).toFixed(3) + ')';
  ctx.beginPath();
  layer(0.02, 1200, (x0, P) => {
    for (let j = 0; j < STARS.length; j++) {
      const x = x0 + STARS[j][0] * P;
      const y = STARS[j][1] * gy * 0.75;
      ctx.moveTo(x + 1.1, y);
      ctx.arc(x, y, 1.1, 0, TAU);
    }
  });
  ctx.fill();

  // chmury (zanikają w kosmosie)
  if (space < 1) {
    ctx.fillStyle = 'rgba(226,232,240,' + (0.07 * (1 - space)).toFixed(3) + ')';
    ctx.beginPath();
    layer(0.12, 900, (x0) => {
      for (const c of CLOUDS) {
        ctx.moveTo(x0 + c[0] + c[2], c[1]);
        ctx.ellipse(x0 + c[0], c[1], c[2], c[2] * 0.3, 0, 0, TAU);
      }
    });
    ctx.fill();
  }
}

function drawGround(r) {
  const { ctx, W, H, sx, sy, cam, view } = r;
  const gy = sy(0);     // poziom ziemi przesuwa się z kamerą: gdy piłka leci wysoko, ziemia wypada z kadru
  ctx.fillStyle = COLORS.groundFill;
  ctx.fillRect(0, gy, W, Math.max(0, H - gy));
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(0, gy - 1, W, 2);

  // Kratki co 10 m (TICK = 10 m). Start na 3. kresce, więc za procą są dwie
  // przygaszone kratki. Co 50 m wyższa kreska z numerem metrów.
  const first = Math.floor(cam.x / TICK) * TICK;
  const right = cam.x + view.w + TICK;
  for (let k = first; k < right; k += TICK) {
    const x = sx(k);
    const start = k === GEOM.slingX;
    const back = k < GEOM.slingX;
    const mid = k % (TICK * 5) === 0;
    if (start) {
      ctx.fillStyle = COLORS.accent;
      ctx.fillRect(x - 1, gy + 2, 3, 12);
      label(ctx, '0 m', x + 5, gy + 24, 9, 'rgba(251,191,36,0.9)', 'left', 700);
      continue;
    }
    ctx.fillStyle = back
      ? 'rgba(255,255,255,0.3)'
      : (mid ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.28)');
    ctx.fillRect(x, gy + 2, mid ? 2 : 1.5, mid ? 9 : 6);
    if (back) {
      label(ctx, String(Math.round(k / 12)), x + 4, gy + 18, 8,
        'rgba(248,250,252,0.26)', 'left', 600);
    } else if (mid) {
      label(ctx, String(Math.round(k / 12)), x + 4, gy + 20, 9,
        'rgba(248,250,252,0.42)', 'left', 600);
    }
  }
}

function drawPlatforms(r) {
  const { ctx, sx, sy, scale, cam, view, sim, now } = r;
  for (let i = 0; i < sim.obstacles.length; i++) {
    const ob = sim.obstacles[i];
    if (ob.x + ob.w < cam.x - 80 || ob.x > cam.x + view.w + 80) continue;
    const x = sx(ob.x);
    const top = sy(ob.y + ob.h);
    const w = Math.max(6, ob.w * scale);
    const h = Math.max(4, ob.h * scale);
    if (ob.type !== 'plat') {
      panel(ctx, x, top, w, h, Math.min(4, h / 2), COLORS.platBody);
      continue;
    }
    drawLaunchpad(ctx, x, top, w, h, scale, ob.used, now + ob.x);
  }
}

// Wyrzutnia: blat na dwóch sprężynach. Nieużyta jasna, ze strzałką w górę; użyta przygaszona,
// sprężyny ściśnięte (działa już tylko jak zwykłe odbicie).
function drawLaunchpad(ctx, x, top, w, h, scale, used, t) {
  ctx.save();
  if (used) ctx.globalAlpha = 0.4;
  const springH = (used ? 6 : 14) * Math.max(0.6, scale);
  const base = top + h + springH;
  // podstawa
  panel(ctx, x + w * 0.12, base, w * 0.76, Math.max(3, h * 0.45), 2, '#0c4a6e');
  // sprężyny (zygzak)
  ctx.strokeStyle = used ? '#94a3b8' : '#e2e8f0';
  ctx.lineWidth = Math.max(1.5, 2 * scale);
  ctx.lineJoin = 'round';
  for (const fx of [0.28, 0.72]) {
    const sxp = x + w * fx;
    const zz = Math.max(3, 5 * scale);
    ctx.beginPath();
    ctx.moveTo(sxp, base);
    for (let k = 1; k <= 4; k++) {
      ctx.lineTo(sxp + (k % 2 ? zz : -zz), base - (springH * k) / 4);
    }
    ctx.lineTo(sxp, top + h);
    ctx.stroke();
  }
  // blat
  panel(ctx, x, top, w, h, Math.min(4, h / 2), used ? '#475569' : COLORS.platBody);
  ctx.fillStyle = used ? '#94a3b8' : COLORS.platTop;
  ctx.fillRect(x + 1, top, w - 2, Math.max(2, h * 0.34));
  if (!used) {
    // pulsująca strzałka w górę nad blatem
    const bob = Math.sin(t / 200) * 3;
    const ax = x + w / 2;
    const ay = top - 10 * Math.max(0.6, scale) + bob;
    const a = Math.max(6, 11 * scale);
    ctx.fillStyle = COLORS.accent;
    ctx.beginPath();
    ctx.moveTo(ax, ay - a * 1.6);
    ctx.lineTo(ax + a, ay - a * 0.5);
    ctx.lineTo(ax + a * 0.38, ay - a * 0.5);
    ctx.lineTo(ax + a * 0.38, ay);
    ctx.lineTo(ax - a * 0.38, ay);
    ctx.lineTo(ax - a * 0.38, ay - a * 0.5);
    ctx.lineTo(ax - a, ay - a * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(31,19,0,0.8)';
    ctx.stroke();
  }
  ctx.restore();
}

// Trampolina na ziemi: rama na nóżkach, napięta mata. Nieużyta jasna z falującymi szewronami,
// użyta przygaszona (dalej odbija, ale bez zysku).
function drawTramps(r) {
  const { ctx, sx, sy, scale, cam, view, sim, now } = r;
  for (let i = 0; i < sim.tramps.length; i++) {
    const t = sim.tramps[i];
    if (t.x + t.w / 2 < cam.x - 80 || t.x - t.w / 2 > cam.x + view.w + 80) continue;
    const x0 = sx(t.x - t.w / 2), x1 = sx(t.x + t.w / 2);
    const top = sy(t.h), base = sy(0);
    const w = x1 - x0;
    ctx.save();
    if (t.used) ctx.globalAlpha = 0.45;
    // nóżki (skośne, jak w ogrodowej trampolinie)
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = Math.max(2, 3 * scale);
    ctx.lineCap = 'round';
    for (const f of [0.08, 0.92]) {
      ctx.beginPath();
      ctx.moveTo(x0 + w * f, top);
      ctx.lineTo(x0 + w * (f < 0.5 ? f - 0.05 : f + 0.05), base);
      ctx.stroke();
    }
    // mata: lekko ugięta linia między ramą (fala, gdy nieużyta)
    const sag = (t.used ? 3 : 2 + Math.sin(now / 160 + t.x) * 1.5) * Math.max(0.6, scale);
    ctx.beginPath();
    ctx.moveTo(x0, top);
    ctx.quadraticCurveTo(x0 + w / 2, top + sag * 2, x1, top);
    ctx.lineWidth = Math.max(3, 5 * scale);
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();
    // rama: kolorowe końce
    ctx.lineWidth = Math.max(2, 3 * scale);
    ctx.strokeStyle = t.used ? '#94a3b8' : '#22d3ee';
    ctx.beginPath();
    ctx.moveTo(x0, top);
    ctx.quadraticCurveTo(x0 + w / 2, top + sag * 2, x1, top);
    ctx.stroke();
    if (!t.used) {
      // dwa szewrony w górę nad matą
      const a = Math.max(6, 9 * scale);
      const cx = x0 + w / 2;
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = Math.max(2, 2.5 * scale);
      for (let k = 0; k < 2; k++) {
        const ph = ((now / 600 + k * 0.5) % 1);
        const y = top - a - ph * a * 3;
        ctx.globalAlpha = 1 - ph;
        ctx.beginPath();
        ctx.moveTo(cx - a, y + a * 0.6);
        ctx.lineTo(cx, y);
        ctx.lineTo(cx + a, y + a * 0.6);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

// Dynamit: trzy czerwone laski związane taśmą, lont z iskrą. W powietrzu na baloniku jak bomba.
function drawDyns(r) {
  const { ctx, sx, sy, scale, cam, view, sim, now } = r;
  for (let i = 0; i < sim.dyns.length; i++) {
    const d = sim.dyns[i];
    if (!d.alive) continue;
    if (d.x + d.r < cam.x - 80 || d.x - d.r > cam.x + view.w + 80) continue;
    const x = sx(d.x), y = sy(d.y);
    const rad = Math.max(6, d.r * scale);
    if (d.air) drawBalloon(ctx, x, y, rad, now, d.x * 0.011);
    const sw = rad * 0.62, sh = rad * 2;
    for (let k = -1; k <= 1; k++) {
      const lx = x + k * sw - sw / 2;
      panel(ctx, lx, y - sh / 2, sw, sh, sw / 2.5, '#dc2626');
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(lx + sw * 0.2, y - sh / 2 + 2, sw * 0.18, sh - 4);
    }
    ctx.fillStyle = '#facc15';
    ctx.fillRect(x - sw * 1.5, y - rad * 0.12, sw * 3, rad * 0.3);
    // lont ze środkowej laski i pulsująca iskra
    const tx = x + rad * 0.5, ty = y - sh / 2 - rad * 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y - sh / 2);
    ctx.quadraticCurveTo(x + rad * 0.1, ty, tx, ty);
    ctx.lineWidth = Math.max(1.5, 2 * scale);
    ctx.strokeStyle = '#a16207';
    ctx.stroke();
    const pulse = 1 + 0.4 * Math.sin(now / 70 + d.x);
    ctx.beginPath();
    ctx.arc(tx, ty, Math.max(3, rad * 0.32 * pulse), 0, TAU);
    ctx.fillStyle = 'rgba(251,146,60,0.45)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(tx, ty, Math.max(1.5, rad * 0.14 * pulse), 0, TAU);
    ctx.fillStyle = '#fff7d6';
    ctx.fill();
  }
}

// Magic Find: awatar właściciela (owner 0/1/2 = 1.–3. miejsce w rankingu) albo
// szara sylwetka zwykłego gracza (owner -1). Pod kuleczką wartość, a na pierwszej
// kuleczce właściciela czerwona naklejka x mnożnik.
const OWNER_FALLBACK = ['#fbbf24', '#cbd5e1', '#d97706'];

// Awatar przycięty do koła, gotowy obrazek na rozmiar (w px urządzenia, co 16): w klatce jeden drawImage bez clip().
// Animowany GIF staje na pierwszej klatce (inaczej przeglądarka dekoduje i przerysowuje go co klatkę).
const circCache = new WeakMap();
function circleImg(img, d) {
  const s = Math.max(16, Math.ceil(d / 16) * 16);
  let e = circCache.get(img);
  if (!e) { e = {}; circCache.set(img, e); }
  if (!e[s]) {
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    g.beginPath();
    g.arc(s / 2, s / 2, s / 2, 0, TAU);
    g.clip();
    g.drawImage(img, 0, 0, s, s);
    e[s] = c;
  }
  return e[s];
}

function drawPickups(r) {
  const { ctx, sx, sy, scale, cam, view, sim, now, ownerImgs } = r;
  for (let i = 0; i < sim.pickups.length; i++) {
    const p = sim.pickups[i];
    if (!p.alive) continue;
    if (p.x + p.r < cam.x - 80 || p.x - p.r > cam.x + view.w + 80) continue;
    const x = sx(p.x);
    const y = sy(p.y);
    // Rysunek = kolizja (p.r); puls tylko zmniejsza (0,92–1), więc kulka nigdy nie wychodzi poza obszar zbierania.
    const rad = p.r * scale;
    const pulse = 1 - 0.04 * (1 + Math.sin(now / 170 + p.x * 0.05));
    const R = rad * pulse - 2;   // + 2 px ciemnej obwódki (R + 2) = brzeg obszaru zbierania

    ctx.beginPath();
    ctx.arc(x, y, R + 2, 0, TAU);
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.fill();

    const oi = p.owner >= 0 && ownerImgs ? ownerImgs[p.owner] : null;
    if (oi && oi.ok) {
      ctx.drawImage(circleImg(oi.img, R * 2 * (r.dpr || 1)), x - R, y - R, R * 2, R * 2);
    } else {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, R, 0, TAU);
      ctx.clip();
      if (p.owner >= 0) {
        ctx.fillStyle = OWNER_FALLBACK[p.owner];
        ctx.fillRect(x - R, y - R, R * 2, R * 2);
      } else {
        ctx.fillStyle = '#64748b';
        ctx.fillRect(x - R, y - R, R * 2, R * 2);
        ctx.fillStyle = 'rgba(241,245,249,0.85)';
        ctx.beginPath();
        ctx.arc(x, y - R * 0.2, R * 0.36, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y + R * 0.95, R * 0.6, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.stroke();

    outlined(ctx, String(p.value).replace('.', ',') + '% MF', x, y + R + 13, 11, 800, 'center', COLORS.accent);

    if (p.owner >= 0) {
      const cx = x + R * 0.8;
      const cy = y - R * 0.8;
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, TAU);
      ctx.fillStyle = COLORS.red;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#fee2e2';
      ctx.stroke();
      label(ctx, 'x' + Math.round(p.value / PICKUP_BASE), cx, cy + 3.5, 9,   // ile razy więcej niż zwykła (x4/x3/x2)
        COLORS.text, 'center', 800);
    }
  }
}

// Klamra z odznaką nad każdym łukiem (bonus za cały łuk). Znika, gdy łuk zebrany.
// Klamra obraca się wg nachylenia łuku, odznaka zostaje pozioma (czytelna).
function drawBrackets(r) {
  const { ctx, sx, sy, sim, scale, cam, view, now } = r;
  const first = new Map();
  const last = new Map();
  const live = new Set();
  for (let i = 0; i < sim.pickups.length; i++) {
    const p = sim.pickups[i];
    if (p.arc === undefined) continue;
    if (!first.has(p.arc)) first.set(p.arc, p);
    last.set(p.arc, p);
    if (p.alive) live.add(p.arc);
  }
  live.forEach(function (k) {
    const a = first.get(k);
    const b = last.get(k);
    if (a.x > cam.x + view.w + 80 || b.x < cam.x - 80) return;
    const x1 = sx(a.x), y1 = sy(a.y), x2 = sx(b.x), y2 = sy(b.y);
    const L = Math.hypot(x2 - x1, y2 - y1);
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const R = Math.max(16, a.r * 2 * scale);
    const h = R + 18;                       // odległość klamry od rzędu
    const ux = Math.sin(ang);               // jednostkowa normalna „w górę”
    const uy = -Math.cos(ang);
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const bulge = 26;                       // wybicie środka klamry w górę → łuk
    // końce nad pierwszą i ostatnią kuleczką, środek wyżej (krzywa kwadratowa)
    const cx = mx + ux * (h + 2 * bulge);
    const cy = my + uy * (h + 2 * bulge);
    // szczyt krzywej (t = 0,5) — tu siedzi odznaka
    const bx = mx + ux * (h + bulge);
    const by = my + uy * (h + bulge);

    ctx.beginPath();
    ctx.moveTo(x1 + ux * (h - 8), y1 + uy * (h - 8));
    ctx.lineTo(x1 + ux * h, y1 + uy * h);
    ctx.quadraticCurveTo(cx, cy, x2 + ux * h, y2 + uy * h);
    ctx.lineTo(x2 + ux * (h - 8), y2 + uy * (h - 8));
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = COLORS.accent;
    ctx.stroke();

    // odznaka delikatnie pulsuje (sygnał „cały łuk = ×N”, N wg miejsca), bez zmiany położenia
    const badge = 13 * (1 + 0.06 * Math.sin(now / 220 + a.x * 0.01));
    ctx.beginPath();
    ctx.arc(bx, by, badge, 0, TAU);
    ctx.fillStyle = COLORS.accent;
    ctx.fill();
    label(ctx, '×' + arcMult(a.owner), bx, by + 4.5, 11, '#1f1300', 'center', 800);
    // Druga, zielona klamra pod rzędem (lustro złotej): pasek podrzutów jak w HUD = ile podrzutów daje pełny łuk (v10).
    const hd = R * 0.5 + 40, bd = 14;     // pod napisami „N MF” pod kulkami
    ctx.beginPath();
    ctx.moveTo(x1 - ux * (hd - 8), y1 - uy * (hd - 8));
    ctx.lineTo(x1 - ux * hd, y1 - uy * hd);
    ctx.quadraticCurveTo(mx - ux * (hd + 2 * bd), my - uy * (hd + 2 * bd), x2 - ux * hd, y2 - uy * hd);
    ctx.lineTo(x2 - ux * (hd - 8), y2 - uy * (hd - 8));
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = COLORS.green;
    ctx.stroke();
    // pasek siedzi na szczycie klamry, wzdłuż rzędu; kropki = ile podrzutów daje pełny łuk (sim.js arcPuffs)
    drawLukPuffs(ctx, arcPuffs(a.owner), mx - ux * (hd + bd), my - uy * (hd + bd), ang);
  });
}

// Pasek podrzutów jak w HUD (puffDots), pełne kropki = ile podrzutów daje łuk.
function drawLukPuffs(ctx, n, x, y, ang) {
  const gap = 19, rad = 7, w = (n - 1) * gap + rad * 2 + 10;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.roundRect(-w / 2, -rad - 4, w, rad * 2 + 8, rad + 4);
  ctx.fillStyle = 'rgba(15,23,42,0.9)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = COLORS.green;
  ctx.stroke();
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.arc(-((n - 1) * gap) / 2 + i * gap, 0, rad, 0, TAU);
    ctx.fillStyle = COLORS.green;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(187,247,208,0.7)';
    ctx.stroke();
  }
  ctx.restore();
}

function drawBoosts(r) {
  const { ctx, sx, sy, scale, cam, view, sim, now } = r;
  for (let i = 0; i < sim.boosts.length; i++) {
    const b = sim.boosts[i];
    if (!b.alive) continue;
    const half = b.w / 2;
    if (b.x + half < cam.x - 80 || b.x - half > cam.x + view.w + 80) continue;
    // Pasek poziomy (środek b.x, długość b.w), świeci; strzałki płyną w kierunku wylotu (30° w górę).
    const x0 = sx(b.x - half);
    const x1 = sx(b.x + half);
    const y = sy(b.y);
    const th = Math.max(5, 11 * scale);
    const glow = 0.55 + 0.25 * Math.sin(now / 160 + b.x * 0.02);

    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(34,211,238,' + (0.22 * glow).toFixed(3) + ')';
    ctx.lineWidth = th * 2.6;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(8,47,73,0.9)';
    ctx.lineWidth = th + 3;
    ctx.stroke();
    ctx.strokeStyle = COLORS.boost;
    ctx.lineWidth = th;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(236,254,255,0.85)';
    ctx.lineWidth = Math.max(1, th * 0.25);
    ctx.beginPath();
    ctx.moveTo(x0, y - th * 0.18);
    ctx.lineTo(x1, y - th * 0.18);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // strzałki-szewrony nad paskiem, skierowane jak wylot (GEOM.boostDir), płyną w prawo
    const dx = GEOM.boostDir[0], dy = -GEOM.boostDir[1];   // ekran: y w dół
    const nx = -dy, ny = dx;                                 // prostopadła do kierunku
    const n = 3;
    const step = (x1 - x0) / n;
    const shift = ((now / 600) % 1) * step;
    const a = Math.max(5, 9 * scale);
    ctx.lineWidth = Math.max(2, 3 * scale);
    ctx.lineJoin = 'round';
    for (let j = 0; j < n; j++) {
      const cx = x0 + ((j * step + shift) % (x1 - x0));
      const cy = y - th * 2.2;
      const fade = Math.sin(Math.PI * (cx - x0) / (x1 - x0));
      ctx.strokeStyle = 'rgba(251,191,36,' + (0.95 * fade).toFixed(3) + ')';
      // strzałka „↗” pod kątem wylotu: trzon + grot
      const tx = cx + dx * a, ty = cy + dy * a;
      const h = a * 0.7;
      ctx.beginPath();
      ctx.moveTo(cx - dx * a, cy - dy * a);
      ctx.lineTo(tx, ty);
      ctx.moveTo(tx - dx * h + nx * h, ty - dy * h + ny * h);
      ctx.lineTo(tx, ty);
      ctx.lineTo(tx - dx * h - nx * h, ty - dy * h - ny * h);
      ctx.stroke();
    }
  }
}

// Kula bomby rysowana raz na osobnym canvasie (sprite): cieniowanie, metalowa opaska, szyjka.
// Promień kuli w sprite = BOMB_SPR px; rysujemy go przeskalowanego do promienia bomby.
const BOMB_SPR = 48;
let bombSprite = null;
function getBombSprite() {
  if (bombSprite || typeof document === 'undefined') return bombSprite;
  const c = document.createElement('canvas');
  const R = BOMB_SPR;
  c.width = c.height = R * 3;
  const g = c.getContext('2d');
  const cx = R * 1.5, cy = R * 1.6;
  // cień pod spodem (lekko w dół i w prawo)
  g.beginPath();
  g.arc(cx + R * 0.06, cy + R * 0.08, R * 1.04, 0, TAU);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fill();
  // kula: światło z lewej góry
  const body = g.createRadialGradient(cx - R * 0.4, cy - R * 0.45, R * 0.1, cx, cy, R);
  body.addColorStop(0, '#64748b');
  body.addColorStop(0.35, '#273449');
  body.addColorStop(1, '#05070d');
  g.beginPath();
  g.arc(cx, cy, R, 0, TAU);
  g.fillStyle = body;
  g.fill();
  // metalowa opaska (pas przez środek, wygięty jak na kuli)
  g.save();
  g.beginPath();
  g.arc(cx, cy, R, 0, TAU);
  g.clip();
  const band = g.createLinearGradient(0, cy - R * 0.2, 0, cy + R * 0.2);
  band.addColorStop(0, '#94a3b8');
  band.addColorStop(0.5, '#e2e8f0');
  band.addColorStop(1, '#475569');
  g.beginPath();
  g.ellipse(cx, cy - R * 0.05, R * 1.1, R * 0.42, 0, 0, Math.PI);
  g.ellipse(cx, cy - R * 0.05 + R * 0.26, R * 1.1, R * 0.42, 0, Math.PI, 0, true);
  g.closePath();
  g.fillStyle = band;
  g.fill();
  // nity na opasce
  g.fillStyle = 'rgba(30,41,59,0.8)';
  for (let k = -2; k <= 2; k++) {
    g.beginPath();
    const u = k * 0.36 / 1.1;
    g.arc(cx + k * R * 0.36, cy + R * (0.08 + 0.42 * Math.sqrt(1 - u * u)), R * 0.05, 0, TAU);
    g.fill();
  }
  g.restore();
  // połysk
  g.beginPath();
  g.ellipse(cx - R * 0.38, cy - R * 0.5, R * 0.26, R * 0.15, -0.6, 0, TAU);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fill();
  g.beginPath();
  g.arc(cx, cy, R - 1, 0, TAU);
  g.lineWidth = 2;
  g.strokeStyle = 'rgba(148,163,184,0.55)';
  g.stroke();
  // szyjka na lont (prawa góra)
  g.save();
  g.translate(cx + R * 0.5, cy - R * 0.78);
  g.rotate(0.55);
  const neck = g.createLinearGradient(-R * 0.22, 0, R * 0.22, 0);
  neck.addColorStop(0, '#475569');
  neck.addColorStop(0.5, '#cbd5e1');
  neck.addColorStop(1, '#334155');
  g.fillStyle = neck;
  g.fillRect(-R * 0.22, -R * 0.24, R * 0.44, R * 0.3);
  g.restore();
  bombSprite = { c: c, cx: cx, cy: cy };
  return bombSprite;
}

// Balonik nad bombą w powietrzu (sznurek do szyjki, delikatne kołysanie).
// Ptak (125–250 m) = makieta-ptaki wariant 2: awatar w złotej obwódce, skrzydła 3,1× z błękitnymi końcówkami
// (5 piór), dziób w prawo, ogon. Awatar: place 0–2 → r.ownerImgs[place] (#1–#3 z biletu), inaczej losowy gracz
// z r.birdImgs (stały dla ptaka) bez twarzy #1–#3; bez wczytanego awatara szara kulka.
const BIRD_SPAN = 3.1, BIRD_AMP = 1.3, BIRD_FEATHERS = 5, BIRD_LINE = '#1e293b';
function birdImg(r, b) {
  const own = r.ownerImgs || [];
  if (b.place >= 0) return own[b.place] || null;
  const imgs = r.birdImgs || [];
  const k = Math.floor(Math.abs(b.x * 0.37 + b.y));
  for (let n = 0; n < imgs.length; n++) {
    const rec = imgs[(k + n) % imgs.length];
    if (own.indexOf(rec) < 0) return rec;
  }
  return null;
}
function drawBirdAvatar(r, rec, x, y, rad) {
  const ctx = r.ctx;
  ctx.beginPath();
  ctx.arc(x, y, rad + 2, 0, TAU);
  ctx.fillStyle = '#fbbf24';
  ctx.fill();
  if (rec && rec.ok) {
    ctx.drawImage(circleImg(rec.img, rad * 2 * (r.dpr || 1)), x - rad, y - rad, rad * 2, rad * 2);
  } else {
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, TAU);
    ctx.fillStyle = '#94a3b8';
    ctx.fill();
  }
}
function drawWing(ctx, x, y, rad, side, flap) {
  const root = x + side * rad * 0.8;
  const tipX = x + side * rad * BIRD_SPAN, tipY = y - rad * 1.2 * flap * BIRD_AMP;
  ctx.beginPath();
  ctx.moveTo(root, y - rad * 0.35);
  ctx.quadraticCurveTo(x + side * rad * BIRD_SPAN * 0.7, y - rad * (0.5 + 0.9 * flap * BIRD_AMP), tipX, tipY);
  // dolna krawędź w „piórach”
  for (let k = 1; k <= BIRD_FEATHERS; k++) {
    const t = k / BIRD_FEATHERS;
    const fx = tipX + (root - tipX) * t, fy = tipY + (y + rad * 0.35 - tipY) * t;
    ctx.quadraticCurveTo(fx + side * rad * 0.05, fy + rad * 0.4, fx, fy);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(root, 0, tipX, 0);
  g.addColorStop(0, '#f8fafc');
  g.addColorStop(1, '#7dd3fc');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.stroke();
}
function drawBirds(r) {
  const { ctx, sx, sy, scale, cam, view, sim, now } = r;
  for (let i = 0; i < sim.birds.length; i++) {
    const b = sim.birds[i];
    if (!b.alive) continue;
    if (b.x + b.r * BIRD_SPAN < cam.x - 80 || b.x - b.r * BIRD_SPAN > cam.x + view.w + 80) continue;
    const rad = Math.max(10, b.r * scale);
    const flap = Math.sin(now / 110 + b.x * 0.05);
    const x = sx(b.x), y = sy(b.y) + flap * rad * 0.12;
    ctx.lineWidth = 1;
    ctx.strokeStyle = BIRD_LINE;
    // ogon z lewej (ptak patrzy w prawo, w stronę lotu)
    ctx.beginPath();
    ctx.moveTo(x - rad * 0.8, y + rad * 0.2);
    ctx.lineTo(x - rad * 1.55, y - rad * 0.05);
    ctx.lineTo(x - rad * 1.45, y + rad * 0.45);
    ctx.lineTo(x - rad * 1.6, y + rad * 0.75);
    ctx.closePath();
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1.5;
    drawWing(ctx, x, y, rad, -1, flap);
    drawWing(ctx, x, y, rad, 1, flap);
    drawBirdAvatar(r, birdImg(r, b), x, y, rad);
    ctx.beginPath();
    ctx.moveTo(x + rad * 0.95, y - rad * 0.18);
    ctx.lineTo(x + rad * 1.4, y + rad * 0.02);
    ctx.lineTo(x + rad * 0.95, y + rad * 0.22);
    ctx.closePath();
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#78350f';
    ctx.stroke();
    // ile daje ptak (y bez machania, napis nie skacze); #1–#3 złoty jak „% MF” przy kulkach
    outlined(ctx, b.value + ' MF', x, sy(b.y) + rad + 13, 11, 800, 'center', b.place >= 0 ? COLORS.accent : '#f8fafc');
  }
}

// Zestrzelony ptak: sam awatar spada z obrotem (efekty.js fx.falls, ~0,8 s), jeden drawImage na klatkę.
function drawFalls(r) {
  const { ctx, sx, sy, scale } = r;
  const falls = r.falls || [];
  for (let i = 0; i < falls.length; i++) {
    const f = falls[i];
    const rad = Math.max(10, GEOM.birdRadius * scale);
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - f.age / 0.8);
    ctx.translate(sx(f.x), sy(f.y));
    ctx.rotate(f.rot);
    drawBirdAvatar(r, birdImg(r, f.b), 0, 0, rad);
    ctx.restore();
  }
}

// Balon MF (kosmos/czerwień) = balon na ogrzane powietrze (makieta-ptaki wariant C): czasza w pasy, koszyk,
// wartość na czaszy (min. 13 px); 30 złoto-biały, 50 fiolet-złoty. Girlanda: lina łukiem między koszykami
// sąsiednich balonów (sim.js spawnMfBal, krok x 110; kolejne girlandy dalej niż 1000).
function mfBalPos(r, b) {
  const rad = Math.max(16, b.r * r.scale);
  return { x: r.sx(b.x) + Math.sin(r.now / 600 + b.y * 0.01) * rad * 0.1, y: r.sy(b.y), rad: rad };
}
function mfEnvelope(ctx, x, y, rad) {
  const top = y - rad, bot = y + rad * 0.75;
  ctx.beginPath();
  ctx.moveTo(x - rad * 0.32, bot);
  ctx.bezierCurveTo(x - rad * 1.15, y + rad * 0.1, x - rad * 0.95, top, x, top);
  ctx.bezierCurveTo(x + rad * 0.95, top, x + rad * 1.15, y + rad * 0.1, x + rad * 0.32, bot);
  ctx.closePath();
}
function drawMfBalloons(r) {
  const { ctx, cam, view, sim, scale } = r;
  const bals = sim.mfbals;
  // liny girland pod balonami
  ctx.beginPath();
  for (let i = 0; i + 1 < bals.length; i++) {
    const a = bals[i], b = bals[i + 1];
    if (!a.alive || !b.alive || b.x - a.x > 200) continue;
    if (b.x + b.r < cam.x - 80 || a.x - a.r > cam.x + view.w + 80) continue;
    const pa = mfBalPos(r, a), pb = mfBalPos(r, b);
    const ya = pa.y + pa.rad * 1.42, yb = pb.y + pb.rad * 1.42;
    ctx.moveTo(pa.x, ya);
    ctx.quadraticCurveTo((pa.x + pb.x) / 2, Math.max(ya, yb) + pa.rad * 0.6, pb.x, yb);
  }
  ctx.lineWidth = Math.max(1, 1.5 * scale);
  ctx.strokeStyle = 'rgba(226,232,240,0.7)';
  ctx.stroke();
  for (let i = 0; i < bals.length; i++) {
    const b = bals[i];
    if (!b.alive) continue;
    if (b.x + b.r < cam.x - 80 || b.x - b.r > cam.x + view.w + 80) continue;
    const { x, y, rad } = mfBalPos(r, b);
    const hell = b.value >= 50;
    mfEnvelope(ctx, x, y, rad);
    ctx.fillStyle = hell ? '#7e22ce' : '#f59e0b';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = hell ? '#facc15' : '#fef3c7';
    ctx.beginPath();
    for (let k = -1; k <= 1; k++) {
      ctx.moveTo(x + k * 0.62 * rad + rad * 0.16, y);
      ctx.ellipse(x + k * 0.62 * rad, y, rad * 0.16, rad * 1.2, 0, 0, TAU);
    }
    ctx.fill();
    ctx.restore();
    mfEnvelope(ctx, x, y, rad);
    ctx.lineWidth = Math.max(1.5, 2 * scale);
    ctx.strokeStyle = '#f8fafc';
    ctx.stroke();
    // liny i koszyk
    const bot = y + rad * 0.75, kb = y + rad * 1.18, kw = rad * 0.34;
    ctx.beginPath();
    ctx.moveTo(x - rad * 0.3, bot);
    ctx.lineTo(x - kw / 2, kb);
    ctx.moveTo(x + rad * 0.3, bot);
    ctx.lineTo(x + kw / 2, kb);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(226,232,240,0.8)';
    ctx.stroke();
    ctx.fillStyle = '#92400e';
    ctx.fillRect(x - kw / 2, kb, kw, rad * 0.24);
    const px = Math.max(13, Math.round(rad * 0.6));
    outlined(ctx, String(b.value), x, y - rad * 0.12 + px * 0.36, px, 800, 'center', '#ffffff');
  }
}

function drawBalloon(ctx, x, y, rad, now, seed) {
  const sway = Math.sin(now / 520 + seed) * rad * 0.25;
  const bx = x + sway;
  const by = y - rad * 3.1;
  const br = rad * 0.9;
  ctx.beginPath();
  ctx.moveTo(x, y - rad * 0.95);
  ctx.quadraticCurveTo(x - rad * 0.3, y - rad * 1.8, bx, by + br * 1.15);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(226,232,240,0.75)';
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(bx, by, br * 0.85, br, 0, 0, TAU);
  ctx.fillStyle = '#e11d48';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(76,5,25,0.6)';
  ctx.stroke();
  // supełek i połysk
  ctx.beginPath();
  ctx.moveTo(bx - br * 0.16, by + br * 1.12);
  ctx.lineTo(bx + br * 0.16, by + br * 1.12);
  ctx.lineTo(bx, by + br * 0.95);
  ctx.closePath();
  ctx.fillStyle = '#be123c';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(bx - br * 0.32, by - br * 0.38, br * 0.18, br * 0.3, -0.5, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fill();
}

function drawBombs(r) {
  const { ctx, sx, sy, scale, cam, view, sim, now } = r;
  const groundY = sy(0);
  const spr = getBombSprite();
  // Rysujemy promień trafienia (b.r × blastRadius, jak hitBomb), żeby afiks „Rozmiar bomb” było widać.
  const grow = sim.mods && sim.mods.blastRadius > 0 ? sim.mods.blastRadius : 1;
  for (let i = 0; i < sim.bombs.length; i++) {
    const b = sim.bombs[i];
    if (!b.alive) continue;
    const br = b.r * grow;
    if (b.x + br < cam.x - 80 || b.x - br > cam.x + view.w + 80) continue;
    const x = sx(b.x);
    const y = sy(b.y);
    const rad = Math.max(5, br * scale);

    if (b.air) {
      drawBalloon(ctx, x, y, rad, now, b.x * 0.013);
    } else {
      // delikatny pierścień na ziemi: bomba ma być widoczna na ciemnym tle
      ctx.beginPath();
      ctx.ellipse(x, groundY, rad * 1.25, Math.max(2, rad * 0.34), 0, 0, TAU);
      ctx.strokeStyle = 'rgba(251,191,36,0.42)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (spr) {
      const k = rad / BOMB_SPR;
      ctx.drawImage(spr.c, x - spr.cx * k, y - spr.cy * k, spr.c.width * k, spr.c.height * k);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, TAU);
      ctx.fillStyle = COLORS.bomb;
      ctx.fill();
    }

    // lont z iskrami (animacja tylko kosmetyczna, nie wpływa na fizykę)
    const fx0 = x + rad * 0.6, fy0 = y - rad * 0.95;
    const tx = x + rad * 1.35, ty = y - rad * 1.45;
    ctx.beginPath();
    ctx.moveTo(fx0, fy0);
    ctx.quadraticCurveTo(x + rad * 1.2, y - rad * 0.9, tx, ty);
    ctx.lineWidth = Math.max(1.5, 2.2 * scale);
    ctx.strokeStyle = '#a16207';
    ctx.stroke();

    const ph = now / 90 + b.x * 0.08;
    const pulse = 1 + 0.35 * Math.sin(ph);
    ctx.beginPath();
    ctx.arc(tx, ty, Math.max(3.5, rad * 0.34 * pulse), 0, TAU);
    ctx.fillStyle = 'rgba(251,146,60,0.35)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(tx, ty, Math.max(2, rad * 0.17 * pulse), 0, TAU);
    ctx.fillStyle = '#fff7d6';
    ctx.fill();
    // iskry: krótkie promienie w losowych (ale zależnych od czasu) kierunkach
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = COLORS.spark;
    for (let j = 0; j < 4; j++) {
      const a = ph * 1.7 + j * 1.9;
      const len = rad * (0.35 + 0.3 * (0.5 + 0.5 * Math.sin(ph * 3 + j)));
      ctx.beginPath();
      ctx.moveTo(tx + Math.cos(a) * rad * 0.15, ty + Math.sin(a) * rad * 0.15);
      ctx.lineTo(tx + Math.cos(a) * len, ty + Math.sin(a) * len);
      ctx.stroke();
    }
  }
}

// Proca większa niż dotąd (1,6×), żeby było widać łyżkę i kołysanie piłeczki.
const SLING_SCALE = 1.6;

// Łyżka (koszyk) na gumach: rozmiar względem piłeczki, środek w punkcie łyżki.
function pouchGeom(scale, x, y) {
  return { x: x, y: y, rx: GEOM.radius * scale * 1.1, ry: GEOM.radius * scale * 0.62 };
}

// Piłeczka kołysze się w łyżce losowo (suma kilku różnych fal, bez rytmu).
function pouchSway(now, scale) {
  const t = now / 1000;
  const a = GEOM.radius * scale * 0.22;
  return {
    x: a * (Math.sin(t * 2.3) * 0.55 + Math.sin(t * 3.9 + 1.1) * 0.3 + Math.sin(t * 6.1 + 2.7) * 0.15),
    y: a * 0.6 * (Math.sin(t * 1.9 + 0.5) * 0.5 + Math.sin(t * 4.3 + 2.0) * 0.3 + Math.sin(t * 5.7) * 0.2)
  };
}

// Przednia część łyżki: rysowana po piłeczce, więc piłeczka wygląda jak siedząca w koszyku.
function drawPouchFront(r) {
  const { ctx, sx, sy, scale, sim, pull } = r;
  const aiming = sim.phase === 'aim';
  const pg = pouchGeom(scale,
    sx(GEOM.slingX + (aiming ? pull.x : 6)),
    sy(GEOM.slingY + (aiming ? pull.y : -18)));
  ctx.beginPath();
  ctx.ellipse(pg.x, pg.y, pg.rx, pg.ry, 0, 0, Math.PI);
  ctx.closePath();
  ctx.fillStyle = COLORS.pouch;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, 2 * scale);
  ctx.strokeStyle = 'rgba(15,23,42,0.5)';
  ctx.stroke();
}

// Prawdziwa proca: rączka, dwa wygięte widełki i dwie gumy do łyżki.
function drawSling(r) {
  const { ctx, sx, sy, scale, groundY, sim, pull } = r;
  const k = Math.max(0.45, scale) * SLING_SCALE;
  const bx = sx(GEOM.slingX);
  const gy = groundY;
  const forkY = sy(GEOM.slingY - 30);
  const tipY = sy(GEOM.slingY + 38);
  const tipL = { x: bx - 25 * k, y: tipY };
  const tipR = { x: bx + 25 * k, y: tipY };
  const midY = sy(GEOM.slingY + 4);

  // rączka
  ctx.lineCap = 'round';
  ctx.strokeStyle = COLORS.woodDark;
  ctx.lineWidth = Math.max(7, 12 * k);
  ctx.beginPath();
  ctx.moveTo(bx, gy);
  ctx.lineTo(bx, forkY);
  ctx.stroke();
  ctx.strokeStyle = COLORS.wood;
  ctx.lineWidth = Math.max(4, 8 * k);
  ctx.beginPath();
  ctx.moveTo(bx, gy);
  ctx.lineTo(bx, forkY);
  ctx.stroke();

  // owijka na rączce
  ctx.strokeStyle = COLORS.woodDark;
  ctx.lineWidth = Math.max(1.5, 2 * k);
  for (let i = 0; i < 3; i++) {
    const yy = gy - (10 + i * 8) * k;
    ctx.beginPath();
    ctx.moveTo(bx - 7 * k, yy);
    ctx.lineTo(bx + 7 * k, yy);
    ctx.stroke();
  }

  // widełki (Y)
  ctx.strokeStyle = COLORS.woodDark;
  ctx.lineWidth = Math.max(7, 11 * k);
  ctx.beginPath();
  ctx.moveTo(tipL.x, tipL.y);
  ctx.quadraticCurveTo(bx - 20 * k, midY, bx, forkY);
  ctx.quadraticCurveTo(bx + 20 * k, midY, tipR.x, tipR.y);
  ctx.stroke();
  ctx.strokeStyle = COLORS.wood;
  ctx.lineWidth = Math.max(4, 7 * k);
  ctx.beginPath();
  ctx.moveTo(tipL.x, tipL.y);
  ctx.quadraticCurveTo(bx - 20 * k, midY, bx, forkY);
  ctx.quadraticCurveTo(bx + 20 * k, midY, tipR.x, tipR.y);
  ctx.stroke();
  ctx.strokeStyle = COLORS.woodLight;
  ctx.lineWidth = Math.max(1, 2 * k);
  ctx.beginPath();
  ctx.moveTo(tipL.x, tipL.y);
  ctx.quadraticCurveTo(bx - 20 * k, midY, bx, forkY);
  ctx.stroke();

  // łyżka: przy celowaniu w dłoni, po strzale zwisa między widełkami
  const aiming = sim.phase === 'aim';
  const pvx = aiming ? pull.x : 6;
  const pvy = aiming ? pull.y : -18;
  const px = sx(GEOM.slingX + pvx);
  const py = sy(GEOM.slingY + pvy);
  const taut = aiming && (pull.x !== 0 || pull.y !== 0);
  const sag = taut ? 0 : 3 * k;

  function band(tip) {
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.quadraticCurveTo((tip.x + px) / 2, (tip.y + py) / 2 + sag, px, py);
    ctx.stroke();
  }
  ctx.strokeStyle = COLORS.bandDark;
  ctx.lineWidth = Math.max(3.5, 5 * k);
  band(tipL);
  band(tipR);
  ctx.strokeStyle = COLORS.band;
  ctx.lineWidth = Math.max(2, 3 * k);
  band(tipL);
  band(tipR);

  // tylna część łyżki (przednia rysowana po piłeczce w drawPouchFront)
  const pg = pouchGeom(scale, px, py);
  ctx.beginPath();
  ctx.ellipse(pg.x, pg.y, pg.rx, pg.ry, 0, 0, TAU);
  ctx.fillStyle = COLORS.pouch;
  ctx.fill();
  ctx.lineCap = 'butt';
}

function drawParticles(r) {
  const { ctx, scale, sx, sy, particles } = r;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (p.f) {   // pióro: elipsa z obrotem (efekty.js 'bird')
      const s = Math.max(1.2, p.size * scale);
      ctx.beginPath();
      ctx.ellipse(sx(p.x), sy(p.y), s * 2.2, s * 0.8, p.rot, 0, TAU);
      ctx.fillStyle = p.col;
      ctx.fill();
    } else if (p.ring) {   // rozbłysk: białe kółko rośnie i znika
      const k = 1 - p.life / p.ring;
      ctx.beginPath();
      ctx.arc(sx(p.x), sy(p.y), Math.max(8, p.size * scale) * (0.6 + k), 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,' + (0.8 * (1 - k)).toFixed(3) + ')';
      ctx.fill();
    } else {
      const s = Math.max(1, p.size * scale);
      ctx.fillStyle = p.col;
      ctx.fillRect(sx(p.x) - s, sy(p.y) - s, s * 2, s * 2);
    }
  }
  drawFalls(r);
}

function drawPlayer(r) {
  const { ctx, scale, sx, sy, sim, p, nick, img, imgOk, now } = r;
  const groundY = sy(0);
  const rad = Math.max(11, GEOM.radius * scale);        // rysunek = kolizja (GEOM.radius = PLAYER_R)
  let x = sx(p.x);
  let y = sy(p.y);
  if (sim.phase === 'aim') {          // w łyżce: kołysanie tylko wizualne
    const sw = pouchSway(now, scale);
    x += sw.x;
    y += sw.y;
  }
  const spin = sim.phase === 'aim' ? 0 : -sim.x * 0.012;

  // cień na ziemi
  if (groundY - y < 400) {
    ctx.beginPath();
    ctx.ellipse(x, groundY, rad * 0.9, Math.max(2, rad * 0.28), 0, 0, TAU);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(x, y, rad + 2, 0, TAU);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();

  ctx.save();
  if (imgOk) {
    ctx.translate(x, y);
    ctx.rotate(spin);
    ctx.drawImage(circleImg(img, rad * 2 * (r.dpr || 1)), -rad, -rad, rad * 2, rad * 2);
  } else {
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, TAU);
    ctx.clip();
    ctx.fillStyle = '#334155';
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    ctx.translate(x, y);
    ctx.rotate(spin);
    label(ctx, nick ? nick.charAt(0).toUpperCase() : '?', 0, rad * 0.36,
      rad * 1.1, COLORS.text, 'center', 800);
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(x, y, rad, 0, TAU);
  ctx.lineWidth = 2;
  ctx.strokeStyle = COLORS.ring;
  ctx.stroke();
}


function drawAimGuide(r) {
  const { ctx, sx, sy, sim, drag, pull } = r;
  if (sim.phase !== 'aim' || !drag) return;
  const len = Math.sqrt(pull.x * pull.x + pull.y * pull.y);
  if (len / GEOM.maxPull < 0.04) return;
  const pts = previewShot((pull.x / GEOM.maxPull) * 100,
    (pull.y / GEOM.maxPull) * 100, 18, 0.06, sim.mods);
  for (let i = 0; i < pts.length; i++) {
    const t = (i + 1) / pts.length;
    ctx.beginPath();
    ctx.arc(sx(pts[i].x), sy(pts[i].y), Math.max(1.5, 4.5 - t * 2.5), 0, TAU);
    ctx.fillStyle = 'rgba(251,191,36,' + (0.85 - t * 0.6).toFixed(2) + ')';
    ctx.fill();
  }
}

// „+1 MF” (kosmos) / „+2 MF” (czerwień) z piłeczki (efekty.js `labels`), żółte jak MF w równaniu (prośba użytkownika 19.10).
// Względem piłeczki na ekranie, bo w szybkim locie etykieta w świecie znika z widoku w ułamku sekundy.
function drawZoneLabels(r) {
  const { ctx, sx, sy, p, labels, W, H } = r;
  if (!labels || !labels.length) return;
  ctx.save();
  ctx.font = '900 ' + Math.round(22 * uiK(W, H)) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 5;
  for (let i = 0; i < labels.length; i++) {
    const l = labels[i];
    const txt = '+' + l.v + ' MF';
    ctx.globalAlpha = l.age > 0.5 ? Math.max(0, 1 - (l.age - 0.5) / 0.4) : 1;
    const x = sx(p.x) - 30 - l.age * 70;
    const y = sy(p.y) - 40 - l.age * 90;
    ctx.strokeStyle = '#1f1300';
    ctx.strokeText(txt, x, y);
    ctx.fillStyle = COLORS.accent;
    ctx.fillText(txt, x, y);
  }
  ctx.restore();
}

// „+N MF” za ptaka/balon MF (efekty.js `hits`, makieta out/makieta-mf-trafienie.html wariant B): nad piłeczką, w górę
// ~70 px, gaśnie w 0,8 s od ostatniego doliczenia. Zwykły ptak biały 22 px, balon złoty 26, ptak #1–#3 złoty 30 (× uiK).
function drawHitLabels(r) {
  const { ctx, sx, sy, p, hits, W, H } = r;
  if (!hits || !hits.length) return;
  const k = uiK(W, H), bx = sx(p.x) + 30 * k, by = sy(p.y);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i];
    const pop = h.bump < 0.12 ? 1 + 0.45 * (1 - h.bump / 0.12) : 1;
    ctx.globalAlpha = h.idle > 0.5 ? Math.max(0, 1 - (h.idle - 0.5) / 0.3) : 1;
    // Stały rozmiar czcionki, podskok przez scale (inny rozmiar co klatkę = nowe glify, skoki czasu klatki).
    ctx.font = '900 ' + Math.round((h.big ? 30 : h.gold ? 26 : 22) * k) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.lineWidth = h.gold ? 5 : 4;
    ctx.strokeStyle = h.gold ? '#1f1300' : 'rgba(15,23,42,0.9)';
    ctx.fillStyle = h.gold ? COLORS.accent : '#f8fafc';
    const txt = '+' + h.v + ' MF', y = by - (34 + 70 * Math.min(1, h.age / 0.8)) * k;
    if (pop === 1) { ctx.strokeText(txt, bx, y); ctx.fillText(txt, bx, y); continue; }
    ctx.save();
    ctx.translate(bx, y);
    ctx.scale(pop, pop);
    ctx.strokeText(txt, 0, 0);
    ctx.fillText(txt, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

// Duży zysk MF na środku, jak liczba w kasynie: wyskakuje, potem gaśnie.
function drawBigGain(r) {
  const { ctx, W, H, gain } = r;
  if (!gain) return;
  const t = gain.age;
  const pop = t < 0.15 ? 1 + 0.6 * (1 - t / 0.15) : 1;
  const fade = t > 1.0 ? Math.max(0, 1 - (t - 1.0) / 0.4) : 1;
  const txt = '+' + Math.round(gain.v);
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(W / 2, H * 0.38);
  const k = uiK(W, H);   // mały ekran: mniejsza liczba
  ctx.scale(pop * k, pop * k);
  ctx.font = '900 56px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#1f1300';
  ctx.strokeText(txt, 0, 0);
  ctx.fillStyle = COLORS.accent;
  ctx.fillText(txt, 0, 0);
  ctx.restore();
}

// Mały ekran (telefon w pionie albo w poziomie): HUD w jednym pasku u góry zamiast panelu 240×116.
export const HUD_COMPACT = { y: 8, h: 30 };
export function isCompact(W, H) { return W < 520 || H < 520; }
// Skala napisów nakładki (równanie MF, duży „+N”, napisy stref) na małym ekranie.
function uiK(W, H) { return Math.max(0.6, Math.min(1, W / 1000, H / 700)); }
function hudBottom(W, H) { return isCompact(W, H) ? HUD_COMPACT.y + HUD_COMPACT.h : HUD.y + HUD.h; }

// Kropki podrzutów; pierwsza pusta kropka napełnia się jak zegar do odnowienia.
function puffDots(ctx, sim, cx, dy, gap, rad) {
  const dots = sim.puffMax;
  const regen = sim.regenPeriod > 0 ? sim.regen / sim.regenPeriod : 0;
  for (let i = 0; i < dots; i++) {
    const dx = cx - ((dots - 1) * gap) / 2 + i * gap;
    ctx.beginPath();
    ctx.arc(dx, dy, rad, 0, TAU);
    ctx.fillStyle = i < sim.puffs ? COLORS.green : 'rgba(148,163,184,0.28)';
    ctx.fill();
    if (i === sim.puffs && regen > 0) {
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.arc(dx, dy, rad, -Math.PI / 2, -Math.PI / 2 + TAU * regen);
      ctx.closePath();
      ctx.fillStyle = 'rgba(74,222,128,0.55)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(dx, dy, rad, 0, TAU);
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = i < sim.puffs ? 'rgba(187,247,208,0.7)' : 'rgba(148,163,184,0.35)';
    ctx.stroke();
  }
}

function drawHudCompact(r) {
  const { ctx, W, sim } = r;
  const dmf = mfFromMeters(sim.meters);
  const dist = sim.meters + ' m';
  const mf = dmf > 0 ? '+' + dmf + ' MF' : '';
  ctx.font = '800 16px Consolas, "Cascadia Mono", "Courier New", monospace';
  const wd = ctx.measureText(dist).width;
  ctx.font = '800 11px Consolas, "Cascadia Mono", "Courier New", monospace';
  const wm = mf ? ctx.measureText(mf).width + 10 : 0;
  const gap = 15;
  const wp = sim.puffMax * gap;
  const pw = 14 + wd + wm + 12 + wp + 8;
  // na środku, ale nie pod przyciskami ⛶ ✕ w prawym górnym rogu (nakladka.js .lotnik-top, ~90 px)
  const px = Math.round(Math.max(8, Math.min((W - pw) / 2, W - 100 - pw)));
  const y = HUD_COMPACT.y;
  const mid = y + HUD_COMPACT.h / 2;
  panel(ctx, px, y, pw, HUD_COMPACT.h, HUD_COMPACT.h / 2, COLORS.panel);
  mono(ctx, dist, px + 14, mid + 6, 16, COLORS.text, 'left', 800);
  if (mf) mono(ctx, mf, px + 14 + wd + 8, mid + 4, 11, COLORS.distMf, 'left', 800);
  const dotsX = px + 14 + wd + wm + 12;
  puffDots(ctx, sim, dotsX + wp / 2, mid, gap, 5.5);
}

function drawHud(r) {
  const { ctx, W, H, sim, best } = r;
  if (isCompact(W, H)) { drawHudCompact(r); return; }
  const pw = HUD.w;
  const px = (W - pw) / 2;
  const py = HUD.y;
  const cx = px + pw / 2;
  panel(ctx, px, py, pw, HUD.h, 10, COLORS.panel);

  // dystans, rekord
  label(ctx, 'DYSTANS', cx, py + 16, 8, COLORS.dim, 'center', 700);
  mono(ctx, sim.meters + ' m', cx, py + 42, 24, COLORS.text, 'center', 800);
  // MF za dystans (items.js `mfFromMeters`): rośnie z metrami, przyrosty dopisują się do równania po lewej
  const dmf = mfFromMeters(sim.meters);
  mono(ctx, dmf > 0 ? '+' + dmf + ' MF' : '', cx, py + 58, 12, COLORS.distMf, 'center', 800);
  label(ctx, 'Rekord ' + best + ' m', cx, py + 74, 9, COLORS.dim, 'center', 600);

  // podrzuty: liczba i kropki; pierwsza pusta kropka napełnia się jak zegar do odnowienia
  label(ctx, 'PODRZUTY ' + sim.puffs + '/' + sim.puffMax, cx, py + 92, 8,
    sim.puffs > 0 ? COLORS.dim : COLORS.red, 'center', 700);
  puffDots(ctx, sim, cx, py + 109, Math.min(19, (pw - 30) / sim.puffMax), 6.5);
}

// Równanie MF na żywo (efekty.js `fx.eq`): jedna linia przy lewej krawędzi na środku wysokości, nowy znak zawsze
// przy prawej krawędzi okienka, starsza część wyjeżdża w lewo i blaknie. Świecący tusz, odręczna czcionka.
// Linia rysowana do osobnego canvasa tylko przy zmianie (`eq.ver`), w klatce jeden drawImage.
const MFL_FONT = '"Segoe Print", "Ink Free", "Bradley Hand", "Comic Sans MS", cursive';
const MFL_COL = { '': '#e0f2fe', sum: '#fbbf24', mf: '#fbbf24', x: '#fb923c', d: '#86efac', dm: '#86efac',
  z1: '#e9d5ff', z2: '#fca5a5' };
const MFL_GLOW = { '': 'rgba(56,189,248,0.65)', sum: 'rgba(251,191,36,0.65)', mf: 'rgba(251,191,36,0.65)',
  x: 'rgba(251,146,60,0.5)', d: 'rgba(34,197,94,0.6)', dm: 'rgba(34,197,94,0.6)',
  z1: 'rgba(168,85,247,0.7)', z2: 'rgba(239,68,68,0.7)' };
const mfl = { canvas: null, ver: -1, w: 0, h: 0, key: '' };
function drawMfLine(r) {
  const { ctx, W, H, eq } = r;
  if (!eq || !eq.on || !eq.shown) return;
  // Mały ekran: linia mniejsza (k), to samo miejsce co na komputerze.
  const compact = isCompact(W, H);
  const k = uiK(W, H);
  const bw = Math.round(compact ? Math.min(380 * k, W * 0.6) : Math.min(380, W * 0.45));
  const bh = Math.round(56 * k);
  const lw = bw / k;   // szerokość w jednostkach rysunku (czcionki jak na komputerze, skala k w transformacji)
  const LH = 56;
  const dpr = r.dpr || 1;
  const key = bw + 'x' + bh + 'x' + dpr + (r.lite ? 'l' : '');
  if (!mfl.canvas && typeof document !== 'undefined') mfl.canvas = document.createElement('canvas');
  if (!mfl.canvas) return;
  if (mfl.ver !== eq.ver || mfl.key !== key) {
    mfl.ver = eq.ver;
    mfl.key = key;
    const c = mfl.canvas;
    c.width = Math.round(bw * dpr);
    c.height = Math.round(bh * dpr);
    const g = c.getContext('2d');
    g.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
    g.clearRect(0, 0, lw, LH);
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(0,0,0,0.8)';
    // od prawej: znaki od końca, aż wyjdą za lewą krawędź
    let x = lw - 6;
    for (let i = eq.shown - 1; i >= 0 && x > -40; i--) {
      const e = eq.list[i];
      const size = e.c === 'mf' ? 27 : (e.c === 'dm' ? 13 : 19);
      g.font = (e.c === 'mf' || e.c === 'sum' ? '700 ' : '400 ') + size + 'px ' + MFL_FONT;
      const w = g.measureText(e.ch).width;
      x -= w;
      g.fillStyle = MFL_COL[e.c] || MFL_COL[''];
      if (r.lite) {
        // telefon: obrys zamiast dwóch rozmyć (linia przerysowuje się przy każdym nowym znaku)
        g.strokeText(e.ch, x, LH / 2 + 2);
        g.fillText(e.ch, x, LH / 2 + 2);
        continue;
      }
      g.shadowColor = 'rgba(0,0,0,0.8)';
      g.shadowBlur = 4;
      g.fillText(e.ch, x, LH / 2 + 2);
      g.shadowColor = MFL_GLOW[e.c] || MFL_GLOW[''];
      g.shadowBlur = 8;
      g.fillText(e.ch, x, LH / 2 + 2);
    }
    // blaknięcie w lewo: maska tylko na obrazie linii (nie na ekranie)
    g.shadowBlur = 0;
    g.globalCompositeOperation = 'destination-in';
    const grad = g.createLinearGradient(0, 0, lw, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.45, 'rgba(0,0,0,1)');
    g.fillStyle = grad;
    g.fillRect(0, 0, lw, LH);
    g.globalCompositeOperation = 'source-over';
  }
  const y = Math.round(H / 2 - bh / 2);   // po lewej, w połowie wysokości (telefon: dolne rogi zasłaniają kciuki)
  ctx.drawImage(mfl.canvas, Math.round(W * 0.025), y, bw, bh);
}

// Podpowiedź dla nowego gracza (makieta out/makieta-podpowiedz.html, warianty B+C): przy procy dymek „Pociągnij i puść”
// z ręką, dopóki gracz ani razu nie strzelił; w locie duży napis „Klikaj, żeby podrzucić!”, dopóki ani razu nie podrzucił.
// Nauczone zapamiętuje localStorage, więc stały gracz tego już nie widzi.
const UMIE_KEY = 'lotnik.umie';
let umie = null;
function learned(what) {
  if (!umie) {
    try { umie = JSON.parse(localStorage.getItem(UMIE_KEY)) || {}; } catch (e) { umie = {}; }
  }
  return !!umie[what];
}
function learn(what) {
  if (learned(what)) return;
  umie[what] = 1;
  try { localStorage.setItem(UMIE_KEY, JSON.stringify(umie)); } catch (e) { /* ignoruj */ }
}

function plPuffs(n) {
  const d = n % 10, dd = n % 100;
  if (n === 1) return '1 podrzut';
  return n + (d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? ' podrzuty' : ' podrzutów');
}

// B: żółty dymek obok piłeczki w procy i ręka, która pokazuje ruch (pociągnij w tył i puść).
function drawShotHint(r) {
  const { ctx, W, sx, sy, p, scale, now } = r;
  const rad = Math.max(11, GEOM.radius * scale);
  const bx = sx(p.x), by = sy(p.y);
  const t1 = 'Pociągnij i puść', t2 = 'W locie klikaj, żeby podrzucić';
  ctx.font = '800 14px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const w1 = ctx.measureText(t1).width;
  ctx.font = '600 11px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const bw = Math.max(w1, ctx.measureText(t2).width) + 24, bh = 44;
  let x = bx + rad + 22;
  if (x + bw > W - 8) x = Math.max(8, W - 8 - bw);
  const y = by - rad - bh - 6;
  panel(ctx, x + 2, y + 5, bw, bh, 12, 'rgba(0,0,0,0.3)');
  panel(ctx, x, y, bw, bh, 12, '#fbbf24');
  ctx.beginPath();   // ogonek w stronę piłeczki
  ctx.moveTo(x + 14, y + bh - 1);
  ctx.lineTo(x + 6, y + bh + 10);
  ctx.lineTo(x + 28, y + bh - 1);
  ctx.fill();
  label(ctx, t1, x + 12, y + 20, 14, '#111827', 'left', 800);
  label(ctx, t2, x + 12, y + 36, 11, '#422006', 'left', 600);
  // Ręka: od piłeczki w tył i w dół (jak naciąganie), chwila, znika; pętla 1,6 s.
  const k = Math.max(0.6, Math.min(1.2, scale * 1.4));
  const t = (now / 1600) % 1;
  const e = t < 0.15 ? 0 : t < 0.6 ? (t - 0.15) / 0.45 : 1;
  const ease = e * e * (3 - 2 * e);
  const a = t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = Math.round(30 * k) + 'px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('👆', bx - 56 * k * ease, by + rad + 16 * k + 34 * k * ease);
  ctx.restore();
}

// C: duży napis w locie i pulsujące kółko wokół piłeczki.
function drawPuffHint(r) {
  const { ctx, W, H, sx, sy, p, scale, sim, now } = r;
  const narrow = W < 640;
  const rad = Math.max(11, GEOM.radius * scale);
  const by = sy(p.y);
  let top = Math.max(hudBottom(W, H) + (narrow ? 44 : 60), H * 0.26);
  if (Math.abs(by - top) < rad + 50) top = by + rad + 60;   // piłeczka na wysokości napisu: napis pod nią
  outlined(ctx, 'Klikaj, żeby podrzucić!', W / 2, top, narrow ? 22 : 30, 900, 'center', '#f8fafc');
  const t = 'Masz ' + plPuffs(sim.puffs);
  ctx.font = '600 12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const w = ctx.measureText(t).width + 26;
  panel(ctx, (W - w) / 2, top + 12, w, 26, 13, COLORS.panel);
  label(ctx, t, W / 2, top + 30, 12, '#cbd5e1', 'center', 600);
  const ph = (now / 1200) % 1;
  ctx.save();
  ctx.globalAlpha = 1 - ph;
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(sx(p.x), by, rad + 6 + ph * 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawHint(r) {
  const { ctx, W, H, sim } = r;
  if (r.watch) return;   // odtwarzacz: bez podpowiedzi i bez zapisu „umie” widza
  if (sim.phase === 'fly') learn('strzal');
  if (sim.phase === 'fly' && sim.puffsUsed > 0) learn('podrzut');
  if (sim.phase === 'aim' && !r.drag && !learned('strzal')) drawShotHint(r);
  if (sim.phase === 'fly' && sim.puffs > 0 && !learned('podrzut')) { drawPuffHint(r); return; }
  // Telefon w pionie na celowaniu: podpowiedź, że w poziomie widać dalej.
  if (sim.phase === 'aim' && r.portrait) {
    const t = 'Obróć telefon, zobaczysz dalej';
    ctx.font = '600 12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    const w = ctx.measureText(t).width + 26;
    const hy = hudBottom(W, H) + 8;
    panel(ctx, (W - w) / 2, hy, w, 26, 13, COLORS.panel);
    label(ctx, '⟳ ' + t, W / 2, hy + 18, 12, COLORS.accent, 'center', 600);
    return;
  }
  if (sim.phase !== 'fly') return;
  if (r.lite && sim.puffsUsed >= 3) return;   // telefon: po 3 podrzutach podpowiedź już niepotrzebna, zasłania lot
  const narrow = W < 640;
  let text = sim.puffs > 0
    ? 'Klik / tap / spacja: podrzut w górę · trafiaj w bomby'
    : 'Brak podrzutów · wracają w locie';
  if ((W < 520 || r.lite) && sim.puffs > 0) text = r.lite ? 'Tap: podrzut · trafiaj w bomby' : 'Klik / tap: podrzut · trafiaj w bomby';
  let fs = narrow ? 11 : 12;
  const font = function (size) {
    return '600 ' + size + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  };
  ctx.font = font(fs);
  let tw = ctx.measureText(text).width;
  while (tw > W - 40 && fs > 9) {
    fs -= 1;
    ctx.font = font(fs);
    tw = ctx.measureText(text).width;
  }
  const w = Math.min(W - 20, tw + 26);
  const hy = narrow || isCompact(W, H) ? hudBottom(W, H) + 8 : 12;
  panel(ctx, (W - w) / 2, hy, w, 26, 13, COLORS.panel);
  label(ctx, text, W / 2, hy + 18, fs, COLORS.text, 'center', 600);
}

