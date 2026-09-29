// Jednorazowo: awatary piszących od startu pobrane przez lokalny Chrome (openrouter-delegate/d2jsp.mjs), dopisane do docs/data.json.
// Użycie (z folderu repo): node scripts/awatary-lokalnie.mjs
import { browserEval } from '../../openrouter-delegate/d2jsp.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const FILE = new URL('../docs/data.json', import.meta.url), B = 'https://forums.d2jsp.org/', F = 230;
const data = JSON.parse(readFileSync(FILE, 'utf8'));
const since = (data.from || 0) / 1000, want = new Set(data.posts.filter((p) => p[3] >= since).map((p) => p[1]));

const LIST = String.raw`(html)=>{const d=new DOMParser().parseFromString(html,'text/html');const out={};
 for(const a of d.querySelectorAll('a[href*="topic.php?t="]')){const m=a.getAttribute('href').match(/t=(\d+)&f=230(?:&o=(\d+))?$/);if(!m)continue;
  const t=out[m[1]]||(out[m[1]]={t:m[1],maxO:0});if(m[2])t.maxO=Math.max(t.maxO,+m[2]);}
 return Object.values(out)}`;
const AV = String.raw`(html)=>{const d=new DOMParser().parseFromString(html,'text/html');
 return [...d.querySelectorAll('.ppc')].map(p=>{const u=p.querySelector('.pU a[href^="user.php"]');return {uid:u?.getAttribute('href').split('=')[1],user:u?.textContent.trim(),av:p.querySelector('.pU img.av')?.getAttribute('src')||''}})}`;
const ev = async (u, f) => (await browserEval(B + u, f)).data;

const av = data.avatars ||= {};
for (let o = 0; o < 600 && want.size; o += 25) {
  const list = (await ev(`forum.php?f=${F}&o=${o}`, LIST)).filter((t) => want.has(t.t));
  for (let i = 0; i < list.length; i += 3) {
    await Promise.all(list.slice(i, i + 3).map(async (t) => {
      want.delete(t.t);
      for (const po of [t.maxO, t.maxO - 10].filter((x) => x >= 0))
        for (const p of await ev(`topic.php?t=${t.t}&f=${F}&o=${po}`, AV).catch(() => []))
          if (p.uid && p.av) { av[p.uid] = p.av; if (!data.users[p.uid]) data.users[p.uid] = p.user; }
    }));
  }
  console.log(`lista o=${o}: awatarów ${Object.keys(av).length}, zostało tematów ${want.size}`);
}
writeFileSync(FILE, JSON.stringify(data));
console.log('gotowe, awatarów:', Object.keys(av).length);
process.exit(0);
