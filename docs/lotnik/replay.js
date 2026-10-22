// replay.js — odtworzenie partii z ziarna, modów, właścicieli łuków i listy wejść.
// Wspólne dla testu (Node), gry (limit celowania) i serwera. Bez DOM i bez czasu.
import { create, step, SIM_VER } from './sim.js';

export const STEPS_PER_SEC = 120;
export const AIM_MAX_STEPS = STEPS_PER_SEC * 120;   // strzał najpóźniej po 2 min celowania
// Lot nie ma limitu (v13). Sufit kroków podaje wywołujący (serwer: czas od /start), nie reguły gry.
export const MAX_INPUTS = 2000000;                  // ochrona przed absurdem; zapis wejść jest zwarty (serwer/wejscia.js)
const Q_MAX = 100;                                  // zakres naciągu procy

// Sprawdza listę [[krok, akcja], ...]. Zwraca null (dobra) albo opis błędu.
export function validateInputs(inputs) {
  if (!Array.isArray(inputs)) return 'wejścia nie są listą';
  if (inputs.length > MAX_INPUTS) return 'za dużo wejść: ' + inputs.length;
  let prev = 0;
  for (let i = 0; i < inputs.length; i++) {
    const it = inputs[i];
    if (!Array.isArray(it) || it.length !== 2) return 'wejście ' + i + ': zły format';
    const k = it[0];
    const a = it[1];
    if (!Number.isInteger(k) || k < 0) return 'wejście ' + i + ': zły krok';
    if (k < prev) return 'wejście ' + i + ': kroki maleją';
    prev = k;
    if (!Array.isArray(a)) return 'wejście ' + i + ': zła akcja';
    if (a[0] === 'puff') {
      if (a.length !== 1) return 'wejście ' + i + ': zły podrzut';
    } else if (a[0] === 'shot') {
      if (a.length !== 3) return 'wejście ' + i + ': zły strzał';
      for (let j = 1; j < 3; j++) {
        const q = a[j];
        if (typeof q !== 'number' || !Number.isFinite(q) || q < -Q_MAX || q > Q_MAX) {
          return 'wejście ' + i + ': naciąg poza zakresem';
        }
      }
      if (k > AIM_MAX_STEPS) return 'wejście ' + i + ': strzał po 2 min celowania';
    } else {
      return 'wejście ' + i + ': nieznana akcja';
    }
  }
  return null;
}

// Puszcza partię do fazy 'over'. Wynik: { ok, error?, state?, stats? }.
// `simVer` opcjonalny: inna wersja fizyki niż ta = błąd (serwer wybierze wtedy sim_v{N}.js).
// `maxSteps` opcjonalny: sufit kosztu powtórki podany przez wywołującego (serwer: czas od /start); brak = bez sufitu.
export function replay(seed, mods, owners, inputs, simVer, maxSteps) {
  if (simVer !== undefined && simVer !== SIM_VER) {
    return { ok: false, error: 'inna wersja fizyki: ' + simVer + ' (jest ' + SIM_VER + ')' };
  }
  const bad = validateInputs(inputs);
  if (bad) return { ok: false, error: bad };
  const s = create(seed, mods, { owners: owners });
  let i = 0;
  let maxY = s.y;
  while (s.phase !== 'over') {
    if (s.phase === 'aim' && s.step > AIM_MAX_STEPS) {
      return { ok: false, error: 'brak strzału przez 2 min' };
    }
    if (maxSteps !== undefined && s.step > maxSteps) return { ok: false, error: 'partia dłuższa niż czas od startu' };
    let acts = null;
    while (i < inputs.length && inputs[i][0] === s.step) {
      (acts || (acts = [])).push(inputs[i][1]);
      i++;
    }
    step(s, acts);
    if (s.y > maxY) maxY = s.y;
  }
  if (i < inputs.length) return { ok: false, error: 'wejścia po końcu partii' };
  return {
    ok: true,
    state: s,
    stats: {
      meters: s.meters,
      maxY: Math.floor(maxY),
      flySteps: s.flySteps,
      steps: s.step,
      bombsHit: s.bombsHit,
      boostsUsed: s.boostsUsed,
      puffsUsed: s.puffsUsed,
      mf: s.mf,
      arcBonuses: s.arcBonuses,
      simVer: SIM_VER
    }
  };
}
