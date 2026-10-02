// Admin kont gry „Piłeczka” (reset hasła / przejęcie nicku z rankingu po PW na d2jsp).
//   node scripts/pileczka-admin.mjs kod  <nick> [--test]   → jednorazowy kod na 24 h (gracz: Ekwipunek → Konto → „Mam kod od admina”)
//   node scripts/pileczka-admin.mjs info <nick> [--test]   → stan konta i wpisu w rankingu
// Sekret (ADMIN_SECRET funkcji) czytany z E:\Vibe coding\pileczka-admin.env — poza repo, nie commitować.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const [action, ...rest] = process.argv.slice(2);
const test = rest.includes('--test'), nick = rest.filter((x) => x !== '--test').join(' ').trim();
if (!['kod', 'info'].includes(action) || nick.length < 3) {
  console.error('Użycie: node scripts/pileczka-admin.mjs kod|info <nick> [--test]');
  process.exit(1);
}
const envFile = resolve(dirname(fileURLToPath(import.meta.url)), '../../pileczka-admin.env');
const secret = readFileSync(envFile, 'utf8').match(/^ADMIN_SECRET=(.+)$/m)?.[1]?.trim();
if (!secret) { console.error('Brak ADMIN_SECRET w ' + envFile); process.exit(1); }
const API = test ? 'https://pileczka-test-i3odn44x6q-ue.a.run.app' : 'https://pileczka-i3odn44x6q-ue.a.run.app';
const r = await fetch(API + '/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://kruszkush.github.io' }, body: JSON.stringify({ secret, action: action === 'kod' ? 'code' : 'info', nick }) });
const j = await r.json().catch(() => ({}));
if (!r.ok) { console.error(`Błąd ${r.status}: ${j.error || '?'}${r.status === 404 ? ' (konta wyłączone na tej funkcji — brak env KONTA=1)' : ''}`); process.exit(1); }
const when = (t) => t ? new Date(t * 1000).toLocaleString('pl-PL') : '—';
console.log(`${test ? '[TEST] ' : ''}Nick: ${j.nick} · konto: ${j.konto ? 'tak' : 'nie'} · zalogowane urządzenia: ${j.sesje} · blokada logowania: ${j.zablokowane ? 'tak' : 'nie'}`);
console.log(`Ranking: ${j.ranking ? `${j.ranking.nick}, rekord ${j.ranking.score} ${j.ranking.dev === 'm' ? '📱' : '🖥️'}` : 'brak wpisu'}`);
if (j.kod) {
  console.log(`\nKOD: ${j.kod}  (ważny do ${when(j.kod_wazny_do)})`);
  console.log(`Do wysłania w PW: „Kod do Piłeczki: ${j.kod} — wejdź w Ekwipunek → Konto → Mam kod od admina, wpisz nick ${j.nick}, kod i nowe hasło. Kod działa 24 h${j.konto ? ' i wyloguje wszystkie Twoje urządzenia' : ''}.”`);
} else if (j.kod_wazny_do) console.log(`Wydany kod ważny do: ${when(j.kod_wazny_do)}`);
