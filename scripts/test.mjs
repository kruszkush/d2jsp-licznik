// Test: czy zwykły Chrome (z oknem, na wirtualnym ekranie) dostaje stronę forum d2jsp z serwera GitHuba.
import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('out', { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: false, args: ['--no-sandbox', '--window-size=1280,900'] });
const page = await browser.newPage();
await page.goto('https://forums.d2jsp.org/forum.php?f=230', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => console.log('goto:', e.message));
let title = '';
for (let i = 0; i < 45; i++) {
  title = await page.title().catch(() => '');
  if (title && !/just a moment|attention required/i.test(title)) break;
  await new Promise((r) => setTimeout(r, 2000));
}
const html = await page.content();
const topics = (html.match(/topic\.php\?t=\d+&amp;f=230/g) || []).length;
writeFileSync('out/page.html', html);
await page.screenshot({ path: 'out/page.png' });
console.log(JSON.stringify({ title, topics, ok: topics > 0 }));
await browser.close();
process.exit(topics > 0 ? 0 : 1);
