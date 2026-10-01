// Stan blokady należy do źródła pobierania, nie do wspólnego zbioru postów.
export function sourceState(st, source) {
  st.sources ||= {};
  if (st.blockedUntil || st.backoff) {
    st.sources.server ||= { blockedUntil: st.blockedUntil || 0, backoff: st.backoff || 0 };
  }
  delete st.blockedUntil; delete st.backoff;
  return st.sources[source] ||= { blockedUntil: 0, backoff: 0 };
}

// PC jest głównym źródłem; serwer (IP chmury, częste wyzwania Cloudflare) rusza tylko, gdy PC
// nie miał udanej próby bez blokady w ciągu `within` ms albo jest teraz w przerwie po blokadzie.
export function pcHealthy(st, now = Date.now(), within = 4 * 3600e3) {
  const pc = st.sources?.pc;
  return !!pc && !(pc.blockedUntil > now) && now - (pc.okAt || 0) < within;
}

export function canFinish(rows, topics, floor, agoMs) {
  return rows.every((r) => topics[r.t] && !topics[r.t].pending && agoMs(r.ago) != null && agoMs(r.ago) < floor);
}

export function topicChanged(row, previous, agoMs) {
  if (!previous || previous.pending || row.r == null || previous.r !== row.r || previous.lp !== row.lp) return true;
  // "8.1k" jest zaokrąglone: pojedyncza odpowiedź tego samego autora może nie
  // zmienić licznika. Wtedy sprawdzamy również czas ostatniej aktywności.
  if (/[km]$/i.test(String(row.r))) {
    const lastActivity = agoMs(row.ago, row.seenAt);
    return lastActivity == null || lastActivity >= (previous.checkedAt || 0);
  }
  return false;
}

// Przy limicie stron zapamiętujemy brakujący starszy fragment tematu. Nie przesuwamy
// ukończonego last do najnowszego posta, zanim ten fragment zostanie odczytany.
export async function collectTopic(row, { st, lastInData, floor, timestamp, read, consume, exhausted, save, started }) {
  const old = st.topics[row.t], p = old?.pending;
  const last = p ? p.last : (old?.last ?? lastInData[row.t] ?? 0);
  const generation = old?.recoveryAt ? { recoveryAt: old.recoveryAt } : {};
  let max = p?.max || last, o = p?.o ?? 'last', step = p?.step || 20, title = p?.title || row.title;
  const target = { r: p ? p.r : row.r, lp: p ? p.lp : row.lp };
  while (!exhausted()) {
    const result = await read(row.t, o); title = result.title || title;
    if (o === 'last') {
      const diffs = result.pager.slice(1).map((x, i) => x - result.pager[i]).filter((x) => x > 0);
      step = diffs.length ? Math.min(...diffs) : 20;
      o = result.pager.length ? Math.max(...result.pager) + step : 0;
    }
    const fresh = result.posts.filter((x) => last ? Number(x.id) > last : timestamp(x.date) >= floor);
    for (const post of fresh) { consume(post, row.t); max = Math.max(max, Number(post.id)); }
    o -= step;
    if (fresh.length < result.posts.length || !result.posts.length || o < 0) {
      st.topics[row.t] = { ...generation, ...target, last: max, checkedAt: started };
      save();
      return { done: true, current: target.r === row.r && target.lp === row.lp };
    }
    st.topics[row.t] = { ...generation, r: old?.r ?? null, lp: old?.lp ?? null, last, checkedAt: started,
      pending: { o, step, last, max, ...target, title } };
    save();
  }
  return { done: false, current: false };
}

const newest = (a = {}, b = {}) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (!out[k] || (v.lastAttempt || 0) >= (out[k].lastAttempt || 0)) out[k] = v;
  }
  return out;
};

export function mergeData(a, b) {
  const [older, newer] = Date.parse(a.updated) > Date.parse(b.updated) ? [b, a] : [a, b];
  const posts = new Map([...older.posts, ...newer.posts].map((p) => [String(p[0]), p]));
  return { ...older, ...newer, posts: [...posts.values()].sort((x, y) => x[3] - y[3]),
    from: Math.min(a.from || Infinity, b.from || Infinity), complete: Math.max(a.complete || 0, b.complete || 0),
    users: { ...older.users, ...newer.users }, topics: { ...older.topics, ...newer.topics },
    avatars: { ...older.avatars, ...newer.avatars },
    collection: { sources: newest(a.collection?.sources, b.collection?.sources) } };
}

export function mergeState(a, b) {
  a = structuredClone(a); b = structuredClone(b);
  sourceState(a, 'server'); sourceState(b, 'server');
  const topics = { ...a.topics };
  for (const [id, v] of Object.entries(b.topics || {})) {
    const old = topics[id];
    const newerRecovery = (v.recoveryAt || 0) > (old?.recoveryAt || 0);
    const sameRecovery = (v.recoveryAt || 0) === (old?.recoveryAt || 0);
    if (!old || newerRecovery || (sameRecovery && (Number(v.last || 0) > Number(old.last || 0) ||
        (Number(v.last || 0) === Number(old.last || 0) && (v.checkedAt || 0) >= (old.checkedAt || 0))))) topics[id] = v;
  }
  const pagesByDay = { ...a.pagesByDay };
  for (const [d, n] of Object.entries(b.pagesByDay || {})) pagesByDay[d] = Math.max(pagesByDay[d] || 0, n);
  return { ...a, ...b, topics, pagesByDay, sources: newest(a.sources, b.sources) };
}
