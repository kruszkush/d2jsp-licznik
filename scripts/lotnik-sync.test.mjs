import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import crypto from 'node:crypto';
import { extractCodes, top3, queueCodes, lotnikSync, syncKey } from './lotnik-sync.mjs';

test('kody LOT: wielkie litery, bez powtórzeń, bez mylących znaków i sklejonych słów', () => {
  assert.deepEqual(extractCodes('moj kod lot-ab2c\nLOT-AB2C i LOT-XYZ9'), ['LOT-AB2C', 'LOT-XYZ9']);
  assert.deepEqual(extractCodes('LOT-AB0C LOT-ABCI xLOT-ABCD LOT-ABCDE'), []);
  assert.deepEqual(extractCodes(''), []);
});

test('top 3 jak nakladka.js: wg postów, pomija bez awatara i powtórzony awatar', () => {
  const data = { posts: [[1, 't', '5'], [2, 't', '5'], [3, 't', '6'], [4, 't', '6'], [5, 't', '7'], [6, 't', '8'], [7, 't', '9']],
    avatars: { 5: 'a', 6: 'a', 7: 'b', 9: 'c' } };
  assert.deepEqual(top3(data), ['5', '7', '9']);
});

test('sync: podpis, kolejka czyszczona po sukcesie, zostaje po błędzie, nicki zweryfikowanych', async () => {
  const env = join(tmpdir(), 'lotnik-sync-test.env');
  writeFileSync(env, 'LOTNIK_SECRET=abc\n');
  const st = { lotnik: { pending: [], verified: ['5'] } };
  const now = Math.floor(Date.now() / 1000);
  queueCodes(st, { id: '100', uid: '5', user: 'Ala', text: 'LOT-AB2C' }, now);
  queueCodes(st, { id: '100', uid: '5', user: 'Ala', text: 'LOT-AB2C' }, now);
  queueCodes(st, { id: '1', uid: '6', user: 'Stary', text: 'LOT-XYZ9' }, now - 8 * 86400);
  assert.equal(st.lotnik.pending.length, 2);
  const data = { posts: [[1, 't', '5']], avatars: { 5: 'a' }, users: { 5: 'Ala Nowa' } };
  let got = null, status = 500;
  const fetchFn = async (url, o) => { got = { url, body: JSON.parse(o.body) }; return { ok: status === 200, status, json: async () => ({ verified: ['5', '8'], wyniki: [] }) }; };
  assert.match(await lotnikSync(st, data, { url: 'https://x/', envFile: env, fetchFn }), /500/);
  assert.equal(st.lotnik.pending.length, 1, 'stary kod (8 dni) usunięty, nowy czeka');
  status = 200;
  await lotnikSync(st, data, { url: 'https://x/', envFile: env, fetchFn });
  assert.equal(got.url, 'https://x/sync');
  const { ts, data: d, sig } = got.body;
  assert.equal(sig, crypto.createHmac('sha256', syncKey('abc')).update(ts + '.' + d).digest('hex'));
  const p = JSON.parse(d);
  assert.deepEqual(p.top3, ['5']);
  assert.deepEqual(p.nicks, { 5: 'Ala Nowa' });
  assert.equal(p.codes[0].kod, 'LOT-AB2C');
  assert.equal(st.lotnik.pending.length, 0);
  assert.deepEqual(st.lotnik.verified, ['5', '8']);
});
