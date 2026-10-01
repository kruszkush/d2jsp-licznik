import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceState, canFinish, collectTopic, mergeData, mergeState } from './collector.mjs';

test('blokada serwera nie zatrzymuje komputera; migracja zachowuje przerwę', () => {
  const st = { topics: {}, blockedUntil: 123456, backoff: 8 };
  assert.equal(sourceState(st, 'pc').blockedUntil, 0);
  assert.equal(sourceState(st, 'server').blockedUntil, 123456);
  st.sources.pc.blockedUntil = 123;
  assert.equal(st.sources.server.blockedUntil, 123456);
});

test('niezmieniona świeża strona nie kończy skanowania starszego zaległego fragmentu', () => {
  const rows = [{ t: 'a', ago: 'fresh' }], topics = { a: { last: 1 } };
  assert.equal(canFinish(rows, topics, 100, () => 200), false);
  assert.equal(canFinish(rows, topics, 100, () => 50), true);
  topics.a.pending = { o: 20 };
  assert.equal(canFinish(rows, topics, 100, () => 50), false);
});

test('limit stron zapisuje starszą lukę i następny przebieg ją kończy', async () => {
  const st = { topics: { a: { last: 10, r: 1, lp: 'u' } } }, consumed = [], calls = [];
  let pages = 0, budget = 1;
  const page = (ids, pager = []) => ({ title: 'A', posts: ids.map((id) => ({ id: String(id), date: 1 })), pager });
  const opts = { st, lastInData: {}, floor: 0, timestamp: Number, started: 1000, save() {},
    exhausted: () => pages >= budget, consume: (p) => consumed.push(Number(p.id)),
    read: async (t, o) => { calls.push(o); pages++; return o === 'last' ? page([31, 32], [0, 20]) : o === 20 ? page([21, 22]) : page([10, 11, 12]); } };
  const row = { t: 'a', r: 8, lp: 'u', title: 'A' };
  assert.equal((await collectTopic(row, opts)).done, false);
  assert.equal(st.topics.a.last, 10);
  assert.equal(st.topics.a.pending.o, 20);
  pages = 0; budget = 3;
  assert.deepEqual(await collectTopic(row, opts), { done: true, current: true });
  assert.equal(st.topics.a.last, 32);
  assert.equal(st.topics.a.pending, undefined);
  assert.deepEqual(calls, ['last', 20, 0]);
  assert.deepEqual(consumed, [31, 32, 21, 22, 11, 12]);
});

test('nowe posty podczas kończenia luki wymagają kolejnego odczytu tematu', async () => {
  const st = { topics: { a: { last: 1, pending: { last: 1, max: 20, o: 0, step: 20, r: 9, lp: 'old' } } } };
  const r = await collectTopic({ t: 'a', r: 11, lp: 'new' }, { st, lastInData: {}, floor: 0,
    timestamp: Number, started: 1, save() {}, consume() {}, exhausted: () => false,
    read: async () => ({ posts: [{ id: '1' }, { id: '2' }], pager: [] }) });
  assert.equal(r.done, true); assert.equal(r.current, false); assert.equal(st.topics.a.r, 9);
});

test('równoczesne wyniki zachowują wszystkie posty i niezależne źródła', () => {
  const data = (ids, updated, sources) => ({ posts: ids.map((id) => [String(id), 't', 'u', id]),
    users: { u: 'nick' }, topics: {}, avatars: {}, from: 1, complete: 1, updated, collection: { sources } });
  const merged = mergeData(data([1, 2], '2026-10-01T10:00:00Z', { pc: { lastAttempt: 2 } }),
    data([1, 3], '2026-10-01T11:00:00Z', { server: { lastAttempt: 3 } }));
  assert.deepEqual(merged.posts.map((p) => p[0]), ['1', '2', '3']);
  assert.deepEqual(Object.keys(merged.collection.sources).sort(), ['pc', 'server']);
  const state = mergeState({ topics: { t: { last: 3 } }, sources: { pc: { lastAttempt: 2, blockedUntil: 0 } } },
    { topics: { t: { last: 2 } }, sources: { server: { lastAttempt: 3, blockedUntil: 99 } } });
  assert.equal(state.topics.t.last, 3); assert.equal(state.sources.pc.blockedUntil, 0); assert.equal(state.sources.server.blockedUntil, 99);
});
