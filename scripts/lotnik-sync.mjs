// Lotnik (gra na stronie, repo lotnik): weryfikacja nicku kodem LOT-xxxx + top 3 wg postów → jedno zgłoszenie /sync na przebieg.
// Włączane zmienną LOTNIK_SYNC (adres funkcji, np. https://us-east1-rich-chimera-344319.cloudfunctions.net/lotnik-test);
// bez niej update.mjs działa jak dawniej (nie czyta treści postów). Sekret: HMAC z LOTNIK_SECRET z pliku poza repo
// (LOTNIK_ENV, domyślnie E:\Vibe coding\lotnik-serwer.env). Kody czekają w state.json (st.lotnik.pending), dopóki serwer
// nie potwierdzi — przerwa w sieci niczego nie gubi; serwer i tak liczy każdy post raz.
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';

export const VERIFY_T = '110398796';                    // temat weryfikacji (sekcja Polska, f=230)
const KOD_RE = /(?<![A-Z0-9])LOT-[A-HJ-NP-Z2-9]{4}(?![A-Z0-9])/gi;
const KEEP_S = 7 * 86400, MAX_PENDING = 300;

// Kody z treści posta (bez cytatów — tekst bierze update.mjs), wielkie litery, bez powtórzeń, max 3.
export const extractCodes = (text) => [...new Set((String(text || '').match(KOD_RE) || []).map((x) => x.toUpperCase()))].slice(0, 3);

// Top 3 uid wg liczby postów — dokładnie jak nakladka.js buildPool (pomija bez awatara i powtórzony awatar).
export function top3(data) {
  const counts = new Map(), avatars = data.avatars || {};
  for (const p of data.posts) { const uid = String(p[2]); counts.set(uid, (counts.get(uid) || 0) + 1); }
  const out = [], seen = new Set();
  for (const [uid] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    const url = avatars[uid];
    if (!url || seen.has(url)) continue;
    seen.add(url); out.push(uid);
    if (out.length === 3) break;
  }
  return out.filter((x) => /^\d+$/.test(x));
}

export const syncKey = (lotnikSecret) => crypto.createHmac('sha256', lotnikSecret).update('lotnik-sync').digest('hex');
export function signed(key, payload, ts = Math.floor(Date.now() / 1000)) {
  const data = JSON.stringify(payload);
  return { ts, data, sig: crypto.createHmac('sha256', key).update(ts + '.' + data).digest('hex') };
}

// Post z tematu weryfikacji → kody do kolejki (st.lotnik.pending).
export function queueCodes(st, post, dateS) {
  const L = (st.lotnik ||= { pending: [], verified: [] });
  for (const kod of extractCodes(post.text)) {
    if (!post.uid || L.pending.some((x) => x.post === post.id && x.kod === kod)) continue;
    L.pending.push({ uid: String(post.uid), nick: post.user, kod, post: String(post.id), date: dateS });
  }
}

// Jedno zgłoszenie po przebiegu. Zwraca opis do logu; błąd nie przerywa licznika.
export async function lotnikSync(st, data, { url, envFile, fetchFn = fetch } = {}) {
  const L = (st.lotnik ||= { pending: [], verified: [] });
  const cut = Date.now() / 1000 - KEEP_S;
  L.pending = L.pending.filter((x) => x.date > cut).slice(-MAX_PENDING);
  const secret = readFileSync(envFile || process.env.LOTNIK_ENV || 'E:/Vibe coding/lotnik-serwer.env', 'utf8')
    .match(/^LOTNIK_SECRET=(.+)$/m)?.[1]?.trim();
  if (!secret) return 'lotnik: brak LOTNIK_SECRET';
  const nicks = {};
  for (const uid of L.verified || []) if (data.users[uid]) nicks[uid] = data.users[uid];
  const sent = L.pending.slice();
  const r = await fetchFn(url.replace(/\/$/, '') + '/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(signed(syncKey(secret), { codes: sent, top3: top3(data), nicks })), signal: AbortSignal.timeout(20000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return `lotnik: /sync ${r.status} ${j.error || ''}`;
  L.pending = L.pending.filter((x) => !sent.includes(x));
  if (Array.isArray(j.verified)) L.verified = j.verified.map(String);
  const w = (j.wyniki || []).map((x) => `${x.kod}: ${x.wynik}`).join(', ');
  return `lotnik: kodów ${sent.length}${w ? ' (' + w + ')' : ''}, top3 ${(j.owners || []).join(',')}, nowe nicki ${j.renamed || 0}`;
}
