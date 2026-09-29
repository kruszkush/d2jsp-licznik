// Jednorazowe zasilenie historii danymi pobranymi lokalnie (D2jsp Wiadomosci/dane/licz.mjs -> posty_<f>_<dni>d.json).
// Użycie: node scripts/import.mjs ścieżka/posty_230_30d.json <dni> <chwila_pobrania_ISO>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const [src, days, at] = process.argv.slice(2);
const FILE = 'docs/data.json';
const data = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : { forum: 230, users: {}, topics: {}, posts: [] };
const known = new Set(data.posts.map((p) => p[0]));
const pd = (s) => new Date(String(s).replace(/(am|pm)$/, ' $1')).getTime();
let added = 0;
for (const t of JSON.parse(readFileSync(src, 'utf8'))) {
  data.topics[t.t] = t.title;
  for (const p of t.posts) {
    if (!p.id || known.has(p.id)) continue;
    if (p.uid) data.users[p.uid] = p.user;
    known.add(p.id); added++;
    data.posts.push([p.id, t.t, p.uid || p.user, Math.round(pd(p.date) / 1000)]);
  }
}
const t = new Date(at).getTime();
data.from = Math.min(data.from || Infinity, t - days * 864e5);
data.complete = Math.max(data.complete || 0, t);
data.posts.sort((a, b) => a[3] - b[3]);
data.updated = new Date().toISOString();
writeFileSync(FILE, JSON.stringify(data));
console.log('dodano', added, 'razem', data.posts.length);
