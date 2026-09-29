// Dopisuje nowe posty z forum d2jsp do docs/data.json (historia), strona liczy rankingi po stronie przeglądarki.
// Użycie: node scripts/update.mjs [dni_wstecz_przy_pierwszym_uruchomieniu=30] [forum=230]
// Zwykły Chrome z oknem (na serwerze pod xvfb-run) — przechodzi normalne sprawdzenie przeglądarki, nic nie obchodzimy.
import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const [BACKFILL = 30, F = 230] = process.argv.slice(2).map(Number);
const FILE = 'docs/data.json';
const B = 'https://forums.d2jsp.org/';
const GAP = 1200; // uprzejme tempo: niecała 1 podstrona/s
const OVERLAP = 2 * 864e5; // ponownie sprawdzamy ostatnie 2 doby (spóźnione/edytowane posty)

// data.json: { forum, updated, users: {uid: nick}, topics: {t: tytuł}, posts: [[id, t, uid, unixSekundy], ...] }
const data = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : { forum: F, users: {}, topics: {}, posts: [] };
const known = new Set(data.posts.map((p) => p[0]));
// data.complete = chwila ostatniego PEŁNEGO przebiegu; po przerwanym przebiegu następny powtarza to samo okno (duplikaty odpadają).
const START = Date.now();
if (data.complete && START - data.complete < 20 * 3600e3 && !process.env.FORCE) { console.log('dzisiejsza aktualizacja już zrobiona'); process.exit(0); }
if (!data.from) data.from = START - BACKFILL * 864e5;
const CUT = data.complete ? data.complete - OVERLAP : data.from;
console.log('od', new Date(CUT).toISOString(), 'znanych postów', known.size);

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: false, args: ['--no-sandbox', '--window-size=1280,900'] });
const page = await browser.newPage();
// Czekamy jak zwykły użytkownik: do ~3 min, z jednym przeładowaniem w połowie.
await page.goto(B + `forum.php?f=${F}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
for (let i = 0; i < 90 && !/d2jsp/i.test(await page.title().catch(() => '')); i++) {
  if (i === 45) await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2000));
}
if (!/d2jsp/i.test(await page.title())) await page.screenshot({ path: 'blad.png' });
if (!/d2jsp/i.test(await page.title())) throw new Error('Nie wpuszczono na forum: ' + (await page.title()));

let lastAt = 0;
async function get(path, kind) {
  const wait = lastAt + GAP - Date.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastAt = Date.now();
  for (let a = 0; a < 3; a++) {
    try {
      return await page.evaluate(async (url, kind, F) => {
        const r = await fetch(url, { credentials: 'include' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const d = new DOMParser().parseFromString(await r.text(), 'text/html');
        if (kind === 'list') {
          const out = {};
          for (const a of d.querySelectorAll('a[href*="topic.php?t="]')) {
            const m = a.getAttribute('href').match(new RegExp(`t=(\\d+)&f=${F}(?:&o=(\\d+))?$`)); if (!m) continue;
            const t = out[m[1]] || (out[m[1]] = { t: m[1], title: '', maxO: 0 });
            if (!m[2] && a.textContent.trim()) t.title = a.textContent.trim();
            if (m[2]) t.maxO = Math.max(t.maxO, +m[2]);
          }
          return Object.values(out);
        }
        return {
          title: (d.title || '').replace(/ - Topic - d2jsp$/, ''),
          posts: [...d.querySelectorAll('.ppc')].map((p) => {
            const u = p.querySelector('.pU a[href^="user.php"]');
            return { id: p.querySelector('.bts')?.id.slice(2), user: u?.textContent.trim(), uid: u?.getAttribute('href').split('=')[1], date: p.querySelector('[id^="td"]')?.textContent };
          }),
        };
      }, B + path, kind, F);
    } catch (e) {
      console.log('ponawiam', path, e.message);
      // Ponowne sprawdzenie przeglądarki: otwieramy stronę normalnie w karcie i czekamy, aż Chrome je przejdzie.
      await page.goto(B + path, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      for (let i = 0; i < 60 && !/d2jsp/i.test(await page.title().catch(() => '')); i++) await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('Nie udało się pobrać ' + path);
}

const save = () => { data.posts.sort((a, b) => a[3] - b[3]); data.updated = new Date().toISOString(); writeFileSync(FILE, JSON.stringify(data)); };
const pd = (s) => new Date(String(s).replace(/(am|pm)$/, ' $1')).getTime();
let added = 0;
const seen = new Set();
try {
for (let o = 0; ; o += 25) {
  const topics = (await get(`forum.php?f=${F}&o=${o}`, 'list')).filter((t) => !seen.has(t.t));
  if (!topics.length) break;
  let freshTopics = 0;
  for (const t of topics) {
    seen.add(t.t);
    let fresh = 0;
    for (let po = t.maxO; po >= 0; po -= 10) {
      const r = await get(`topic.php?t=${t.t}&f=${F}&o=${po}`, 'topic');
      const newer = r.posts.filter((p) => p.id && pd(p.date) >= CUT);
      for (const p of newer) {
        fresh++;
        data.topics[t.t] = r.title || t.title;
        if (p.uid) data.users[p.uid] = p.user;
        if (known.has(p.id)) continue;
        known.add(p.id); added++;
        data.posts.push([p.id, t.t, p.uid || p.user, Math.round(pd(p.date) / 1000)]);
      }
      if (newer.length < r.posts.length || !r.posts.length) break;
    }
    if (fresh) freshTopics++;
  }
  console.log(`lista o=${o}: ${freshTopics}/${topics.length} tematów ze świeżymi postami, nowych postów razem ${added}`);
  if (!freshTopics) break;
}
data.complete = START;
} catch (e) {
  console.log('PRZERWANO:', e.message, '— zapisuję częściowy postęp');
  save(); await browser.close(); process.exit(1);
}
await browser.close();
save();
console.log('dodano', added, 'razem', data.posts.length);
process.exit(0);
