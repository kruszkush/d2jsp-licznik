// Dopisuje nowe posty z forum d2jsp do docs/data.json (historia), strona liczy rankingi po stronie przeglądarki.
// Użycie: node scripts/update.mjs [dni_wstecz_przy_pierwszym_uruchomieniu=30] [forum=230]
// Zwykły Chrome z oknem (na serwerze pod xvfb-run) — przechodzi normalne sprawdzenie przeglądarki, nic nie obchodzimy.
import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const [BACKFILL = 30, F = 230] = process.argv.slice(2).map(Number);
const FILE = 'docs/data.json';
const B = 'https://forums.d2jsp.org/';
const GAP = process.env.AVATARS ? 3000 : 1500; // uprzejme tempo: niecała 1 podstrona/s
const OVERLAP = 6 * 3600e3; // zakładka 6 h (mało podstron = mniejsza szansa na blokadę)

// data.json: { forum, updated, users: {uid: nick}, topics: {t: tytuł}, posts: [[id, t, uid, unixSekundy], ...] }
const data = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : { forum: F, users: {}, topics: {}, posts: [] };
const known = new Set(data.posts.map((p) => p[0]));
// data.complete = chwila ostatniego PEŁNEGO przebiegu; po przerwanym przebiegu następny powtarza to samo okno (duplikaty odpadają).
const START = Date.now();
// (bez pomijania: serwer uruchamia co 3 h i za każdym razem dopisuje nowe posty)
if (!data.from) data.from = START - BACKFILL * 864e5;
const CUT = data.complete ? data.complete - OVERLAP : data.from;
console.log('od', new Date(CUT).toISOString(), 'znanych postów', known.size);

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: false, userDataDir: process.env.PROFILE || undefined, args: ['--no-sandbox', '--window-size=1280,900'] });
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
  for (let a = 0; a < 4; a++) {
    try {
      // Zwykłe otwarcie strony w karcie (jak człowiek), a nie zapytanie w tle — Cloudflare to przepuszcza.
      const res = await page.goto(B + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
      for (let i = 0; i < 45 && !/d2jsp/i.test(await page.title().catch(() => '')); i++) await new Promise((r) => setTimeout(r, 2000));
      if (!/d2jsp/i.test(await page.title()) || (res && res.status() >= 400 && res.status() !== 403)) throw new Error('HTTP ' + (res && res.status()));
      return await page.evaluate(async (url, kind, F) => {
        const d = document;
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
            return { id: p.querySelector('.bts')?.id.slice(2), user: u?.textContent.trim(), uid: u?.getAttribute('href').split('=')[1], date: p.querySelector('[id^="td"]')?.textContent, av: p.querySelector('.pU img.av')?.getAttribute('src') || '' };
          }),
        };
      }, B + path, kind, F);
    } catch (e) {
      console.log('ponawiam', path, e.message);
      await new Promise((r) => setTimeout(r, 30000 * 2 ** a)); // 30 s, 60 s, 120 s, 240 s
    }
  }
  throw new Error('Nie udało się pobrać ' + path);
}

const save = () => { data.posts.sort((a, b) => a[3] - b[3]); data.updated = new Date().toISOString(); writeFileSync(FILE, JSON.stringify(data)); };
// Tryb jednorazowy AVATARS=1: zbiera awatary z ostatnich stron tematów, w których pisano od startu (bez liczenia postów).
if (process.env.AVATARS) {
  const since = (data.from || 0) / 1000, want = new Set(data.posts.filter((p) => p[3] >= since).map((p) => p[1]));
  let got = 0;
  for (let o = 0; o < 500 && want.size; o += 25) {
    const list = await get(`forum.php?f=${F}&o=${o}`, 'list');
    if (!list.length) break;
    for (const t of list.filter((t) => want.has(t.t))) {
      want.delete(t.t);
      for (const po of [t.maxO, t.maxO - 10].filter((x) => x >= 0)) {
        const r = await get(`topic.php?t=${t.t}&f=${F}&o=${po}`, 'topic').catch((e) => (console.log('pomijam', e.message), { posts: [] }));
        for (const p of r.posts)
          if (p.uid && p.av && (data.avatars ||= {})[p.uid] !== p.av) { data.avatars[p.uid] = p.av; got++; }
      }
    }
    console.log(`lista o=${o}: awatarów ${Object.keys(data.avatars || {}).length}`);
  }
  await browser.close();
  writeFileSync(FILE, JSON.stringify(data)); console.log('awatary: nowych', got); process.exit(0);
}
const pd = (s) => new Date(String(s).replace(/(am|pm)$/, ' $1')).getTime();
let added = 0;
const seen = new Set(), skipped = [];
try {
for (let o = 0; ; o += 25) {
  const topics = (await get(`forum.php?f=${F}&o=${o}`, 'list')).filter((t) => !seen.has(t.t));
  if (!topics.length) break;
  let freshTopics = 0;
  for (const t of topics) {
    seen.add(t.t);
    let fresh = 0;
    try {
    for (let po = t.maxO; po >= 0; po -= 10) {
      const r = await get(`topic.php?t=${t.t}&f=${F}&o=${po}`, 'topic');
      const newer = r.posts.filter((p) => p.id && pd(p.date) >= CUT);
      for (const p of newer) {
        fresh++;
        data.topics[t.t] = r.title || t.title;
        if (p.uid) data.users[p.uid] = p.user;
        if (p.uid && p.av) (data.avatars ||= {})[p.uid] = p.av;
        if (known.has(p.id)) continue;
        known.add(p.id); added++;
        data.posts.push([p.id, t.t, p.uid || p.user, Math.round(pd(p.date) / 1000)]);
      }
      if (newer.length < r.posts.length || !r.posts.length) break;
    }
    } catch (e) {
      // pojedynczy temat nie przerywa całości; przy wielu blokadach z rzędu kończymy
      skipped.push(t.t); fresh++; console.log('pomijam temat', t.t, e.message);
      if (skipped.length > 5) throw new Error('za dużo blokad');
    }
    if (fresh) freshTopics++;
  }
  console.log(`lista o=${o}: ${freshTopics}/${topics.length} tematów ze świeżymi postami, nowych postów razem ${added}`);
  if (!freshTopics) break;
}
if (skipped.length <= 3) data.complete = START; // kilka pominiętych tematów nie blokuje postępu
console.log('pominięte tematy:', skipped.length);
} catch (e) {
  console.log('PRZERWANO:', e.message, '— zapisuję częściowy postęp');
  save(); await browser.close(); process.exit(1);
}
await browser.close();
save();
console.log('dodano', added, 'razem', data.posts.length);
process.exit(0);
