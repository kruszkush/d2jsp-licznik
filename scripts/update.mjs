// Dopisuje nowe posty z forum d2jsp do docs/data.json; strona liczy rankingi i puchary w przeglądarce.
// Oszczędnie dla Cloudflare: lista tematów podaje liczbę odpowiedzi i ostatniego piszącego — otwieramy tylko
// tematy, w których coś się zmieniło, i tylko nowe strony. Stan tematów w state.json (poza stroną), zapis po
// każdym temacie, więc przerwany przebieg następny kończy. Przy pierwszej blokadzie stop i przerwa 2/4/8 h.
// Użycie: node scripts/update.mjs [forum=230]    Zwykły Chrome z oknem (na serwerze pod xvfb-run), nic nie obchodzimy.
import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const F = Number(process.argv[2] || 230);
const FILE = 'docs/data.json', STATE = 'state.json';
const B = 'https://forums.d2jsp.org/';
const GAP = 2000;           // odstęp między podstronami
const MAX_PAGES = 70;       // limit podstron na przebieg (reszta w następnym)
const FLOOR_OVERLAP = 6 * 3600e3; // dla tematów bez stanu: posty od (ostatni pełny przebieg − 6 h)

const data = JSON.parse(readFileSync(FILE, 'utf8'));
const st = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { topics: {} };
const START = Date.now();
if (st.blockedUntil && START < st.blockedUntil && !process.env.FORCE) {
  console.log('przerwa po blokadzie do', new Date(st.blockedUntil).toLocaleString('pl-PL')); process.exit(0);
}
const known = new Set(data.posts.map((p) => p[0]));
const num = (id) => Number(id) || 0;
// ostatnie znane id posta w każdym temacie (z danych) — dla tematów bez stanu
const lastInData = {};
for (const [id, t] of data.posts) if (num(id) > (lastInData[t] || 0)) lastInData[t] = num(id);
const FLOOR = (data.complete || data.from) - FLOOR_OVERLAP;
// "26 minutes ago" / "3 hours ago" / "2 days ago" → przybliżona chwila ostatniego posta (null = nie wiadomo → traktuj jako świeży)
const UNIT = { second: 1e3, minute: 6e4, hour: 36e5, day: 864e5, week: 6048e5, month: 2592e6, year: 31536e6 };
const agoMs = (txt) => { const m = String(txt).match(/(\d+)\s*(second|minute|hour|day|week|month|year)s?\s+ago/i); if (m) return START - m[1] * UNIT[m[2].toLowerCase()]; const d = pd(txt); return isNaN(d) ? null : d; };
// d2jsp pokazuje daty w strefie zależnej od profilu/ciasteczka — kalibrujemy przesunięcie z „x minutes ago” na liście
let OFFSET = null; // ms do dodania do sparsowanej daty
const ts = (s) => pd(s) + (OFFSET || 0);
const pd = (s) => new Date(String(s).replace(/(am|pm)$/, ' $1')).getTime();

let pages = 0, added = 0;
const save = () => {
  data.posts.sort((a, b) => a[3] - b[3]); data.updated = new Date().toISOString();
  writeFileSync(FILE, JSON.stringify(data)); writeFileSync(STATE, JSON.stringify(st));
};
process.on('SIGTERM', () => { console.log('SIGTERM — zapisuję'); save(); process.exit(1); });

class Blocked extends Error {}
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: false, userDataDir: process.env.PROFILE || undefined, args: ['--no-sandbox', '--window-size=1280,900'] });
const page = await browser.newPage();
let lastAt = 0;
async function open(path) {
  const wait = lastAt + GAP - Date.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastAt = Date.now(); pages++;
  let res;
  try { res = await page.goto(B + path, { waitUntil: 'domcontentloaded', timeout: 60000 }); }
  catch (e) { res = null; }
  // „Just a moment...” to sprawdzenie przeglądarki — czekamy jak człowiek (do ~90 s); liczy się to, co się ostatecznie załadowało
  for (let i = 0; i < 45 && !/d2jsp/i.test(await page.title().catch(() => '')); i++) await new Promise((r) => setTimeout(r, 2000));
  const title = await page.title().catch(() => '');
  if (!/d2jsp/i.test(title) || /access denied|attention required/i.test(title))
    throw new Blocked(`blokada na ${path}: HTTP ${res && res.status()} „${title}”`);
}
async function list(o) {
  await open(`forum.php?f=${F}&o=${o}`);
  // główny link tematu: topic.php?t=N&f=F bez dodatków (klasa "ta" oznacza tylko nieprzeczytane, więc na niej nie polegamy)
  const rows = await page.evaluate((F) => [...document.querySelectorAll('tr')].map((tr) => [tr, [...tr.querySelectorAll('a[href*="topic.php?t="]')].find((l) => new RegExp(`^topic\\.php\\?t=\\d+&f=${F}$`).test(l.getAttribute('href')))]).filter(([, a]) => a).map(([tr, a]) => {
    const td = tr.querySelectorAll('td');
    const t = (a.getAttribute('href').match(/t=(\d+)/) || [])[1];
    let maxO = 0; for (const l of tr.querySelectorAll('a[href*="topic.php?t="]')) { const m = l.getAttribute('href').match(new RegExp(`t=${t}&f=${F}&o=(\\d+)`)); if (m) maxO = Math.max(maxO, +m[1]); }
    const r = td[3] ? td[3].textContent.replace(/\D/g, '') : '';
    const lp = td[4]?.querySelector('a[href^="user.php"]')?.getAttribute('href').split('=')[1] || '';
    const ago = td[4]?.querySelector('.desc')?.textContent.trim() || '';
    return { t, title: a.textContent.trim(), maxO, r: r === '' ? null : +r, lp, ago };
  }).filter((x) => x.t), F);
  if (!rows.length) throw new Blocked(`pusta lista tematów (o=${o})`);
  return rows;
}
async function topicPage(t, o) { // o === 'last' → ostatnia strona (link „Goto last post”)
  await open(o === 'last' ? `topic.php?t=${t}&f=${F}&v=1` : `topic.php?t=${t}&f=${F}&o=${o}`);
  return page.evaluate((t) => ({
    pager: [...new Set([...document.querySelectorAll(`a[href*="topic.php?t=${t}&"]`)].map((a) => (a.getAttribute('href').match(/&o=(\d+)/) || [])[1]).filter(Boolean).map(Number))].sort((a, b) => a - b),
    title: (document.title || '').replace(/ - Topic - d2jsp$/, ''),
    posts: [...document.querySelectorAll('.ppc')].map((p) => {
      const u = p.querySelector('.pU a[href^="user.php"]');
      return { id: p.querySelector('.bts')?.id.slice(2), user: u?.textContent.trim(), uid: u?.getAttribute('href').split('=')[1], date: p.querySelector('[id^="td"]')?.textContent, av: p.querySelector('.pU img.av')?.getAttribute('src') || '' };
    }).filter((p) => p.id),
  }), t);
}

// Pobiera nowe posty tematu: od ostatniej strony w dół, dopóki na stronie są posty nowsze od granicy.
async function doTopic(row) {
  const s = st.topics[row.t];
  const lastId = s ? s.last : (lastInData[row.t] || 0);
  const isNew = (p) => lastId ? num(p.id) > lastId : ts(p.date) >= FLOOR;
  const cap = s && row.r != null && s.r != null ? Math.ceil(Math.max(1, row.r - s.r) / 10) + 2 : 40;
  let maxId = lastId, title = row.title;
  // start od prawdziwej ostatniej strony; cofamy się o rozmiar strony wyliczony z odnośników stron (zwykle 20)
  let o = 'last', step = 20;
  for (let n = 0; n < cap; n++) {
    if (pages >= MAX_PAGES) return false;
    const r = await topicPage(row.t, o); title = r.title || title;
    if (o === 'last') {
      const ps = r.pager, diffs = ps.slice(1).map((x, i) => x - ps[i]).filter((d) => d > 0);
      step = diffs.length ? Math.min(...diffs) : 20;
      o = ps.length ? Math.max(...ps) + step : 0; // na ostatniej stronie odnośniki prowadzą tylko do wcześniejszych
    }
    const fresh = r.posts.filter(isNew);
    for (const p of fresh) {
      if (p.uid) { data.users[p.uid] = p.user; if (p.av) (data.avatars ||= {})[p.uid] = p.av; }
      maxId = Math.max(maxId, num(p.id));
      if (known.has(p.id)) continue;
      known.add(p.id); added++;
      data.posts.push([p.id, row.t, p.uid || p.user, Math.round(ts(p.date) / 1000)]);
    }
    if (fresh.length < r.posts.length || !r.posts.length) break; // doszliśmy do starszych postów
    o -= step; if (o < 0) break;
  }
  if (!maxId) for (const [id, t] of data.posts) if (t === row.t) maxId = Math.max(maxId, num(id));
  data.topics[row.t] = title;
  st.topics[row.t] = { r: row.r, lp: row.lp, last: maxId };
  return true;
}

let complete = false, reason = '';
try {
  for (let o = 0; o < 1000; o += 25) {
    const rows = await list(o);
    if (OFFSET === null) { // kalibracja strefy: najświeższy temat „x minutes ago” vs godzina jego ostatniego posta
      const c = rows.find((x) => /(second|minute)s? ago/i.test(x.ago));
      if (c) {
        const r = await topicPage(c.t, 'last'), last = r.posts[r.posts.length - 1];
        OFFSET = st.offset = Math.round((agoMs(c.ago) - pd(last.date)) / 36e5) * 36e5;
      } else OFFSET = st.offset || 0; // cisza na forum — bierzemy ostatnio zmierzone
      console.log('przesunięcie stref:', OFFSET / 36e5, 'h');
    }
    // temat bez stanu, którego ostatni post jest wyraźnie starszy niż granica → tylko zapamiętaj stan, nie otwieraj
    for (const x of rows) {
      const a = agoMs(x.ago);
      if (!st.topics[x.t] && a != null && a < FLOOR - 864e5) st.topics[x.t] = { r: x.r, lp: x.lp, last: lastInData[x.t] || 0 };
    }
    const changed = rows.filter((x) => { const s = st.topics[x.t]; return !s || x.r == null || s.r !== x.r || s.lp !== x.lp; });
    console.log(`lista o=${o}: zmienionych ${changed.length}/${rows.length}`);
    if (!changed.length) { complete = true; break; }
    for (const row of changed) {
      if (!(await doTopic(row))) { reason = `limit ${MAX_PAGES} podstron`; break; }
      save();
    }
    if (reason) break;
  }
  if (complete) { data.complete = START; st.backoff = 0; st.blockedUntil = 0; }
} catch (e) {
  if (!(e instanceof Blocked)) throw e;
  st.backoff = Math.min(8, (st.backoff || 1) * 2); st.blockedUntil = Date.now() + st.backoff * 3600e3;
  reason = `${e.message} — przerwa ${st.backoff} h`;
}
const day = new Date().toISOString().slice(0, 10); (st.pagesByDay ||= {})[day] = (st.pagesByDay[day] || 0) + pages;
save(); await browser.close();
console.log(`${complete ? 'KOMPLET' : 'NIEDOKOŃCZONE: ' + reason} · podstron ${pages} · dodano ${added} · razem ${data.posts.length}`);
process.exit(complete ? 0 : 1);
