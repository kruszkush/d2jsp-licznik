// Telemark na stronie licznika d2jsp (docs/zasady_d2jsp.md, plan docs/plan_d2jsp.md krok 4): przycisk „Telemark”,
// gra w dużym oknie na wierzchu strony (jak okno nagrań Lotnika, lotnik/nakladka.js showReplay), tabele bieżącego
// i poprzedniego tygodnia i miesiąca z serwera Lotnika (/tm/tabele), puchary symbolami strony (#cup, #cupM), ▶ odtwarza
// skok w tym samym oknie (gra z ?ogladaj=gid). Kopiowane do docs[/test]/telemark/ przez scripts/d2jsp-publikuj.sh.
(function () {
  const SLOT = document.getElementById('telemark');
  if (!SLOT) return;
  const PROD = location.hostname === 'kruszkush.github.io' && !location.pathname.includes('/test/');
  const API = 'https://us-east1-rich-chimera-344319.cloudfunctions.net/' + (PROD ? 'lotnik' : 'lotnik-test');
  const GAME = new URL('telemark/index.html', document.baseURI).href;
  const ODSWIEZ_MS = 60000;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const pts = (p) => p.toFixed(1).replace('.', ',');
  const haslo = () => { try { return localStorage.getItem('lotnik.haslo') || ''; } catch (e) { return ''; } };

  const css = document.createElement('style');
  css.textContent = `
#telemark .tm-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px}
#telemark .tm-head h2{margin:0}
#telemark .tm-play{background:var(--acc);color:#fff;border-color:var(--acc);font-weight:600;padding:8px 18px}
#telemark .tm-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media (max-width:760px){#telemark .tm-cols{grid-template-columns:1fr}}
#telemark h3{font-size:14px;margin:8px 0 4px}
#telemark .tm-prev{font-size:13px;color:var(--mute);margin:0 0 6px}
#telemark .tm-prev b{color:var(--ink)}
#telemark .tm-prev svg.cup{width:26px;height:26px;vertical-align:-7px}
#telemark svg.cup{width:16px;height:16px;vertical-align:-3px;margin:0 1px}
#telemark td.n,#telemark th.n{text-align:right}
#telemark .tm-best{white-space:nowrap;font-size:13px;color:var(--mute)}
#telemark .tm-w{padding:2px 7px;margin-left:4px;font-size:12px;line-height:1.2}
#telemark .tm-w[disabled]{opacity:.45;cursor:default}
#telemark .tm-empty{color:var(--mute);font-size:13px;padding:6px 0}
#telemark .tm-scroll{max-height:420px;overflow:auto}
.tm-okno{position:fixed;inset:0;z-index:97;background:#020617;display:flex;align-items:center;justify-content:center}
.tm-okno[hidden]{display:none!important}
.tm-okno .tm-box{position:relative;width:min(97vw,2200px);height:min(94vh,1300px);background:#000;border-radius:10px;overflow:hidden}
.tm-okno iframe{width:100%;height:100%;border:0;display:block}
.tm-okno .tm-x{position:absolute;top:8px;right:8px;z-index:2;background:rgba(15,23,42,.85);color:#e2e8f0;border:1px solid rgba(248,250,252,.35);font-size:18px;line-height:1;padding:8px 12px}
body.tm-on>:not(.tm-okno){visibility:hidden!important}
body.tm-on *,body.tm-on ::before,body.tm-on ::after{animation-play-state:paused!important}
@media (max-width:760px){.tm-okno .tm-box{width:100vw;height:100%;border-radius:0}}
`;
  document.head.appendChild(css);

  // --- okno gry -----------------------------------------------------------------------------------------------
  let okno = null, frame = null, last = null;
  function open(query) {
    if (!okno) {
      okno = document.createElement('div');
      okno.className = 'tm-okno';
      okno.hidden = true;
      okno.innerHTML = '<div class="tm-box"><iframe title="Telemark" allow="fullscreen; gamepad"></iframe>' +
        '<button type="button" class="tm-x" aria-label="Zamknij Telemark">✕</button></div>';
      frame = okno.querySelector('iframe');
      okno.querySelector('.tm-x').addEventListener('click', close);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && okno && !okno.hidden && document.activeElement !== frame) close(); });
      document.body.appendChild(okno);
    }
    last = document.activeElement;
    frame.src = GAME + (query || '');
    okno.hidden = false;
    document.body.classList.add('tm-on');
    frame.focus();
  }
  function close() {
    if (!okno || okno.hidden) return;
    okno.hidden = true;
    frame.src = 'about:blank';
    document.body.classList.remove('tm-on');
    if (last && last.focus) last.focus();
    load(true);
  }

  // --- tabele -------------------------------------------------------------------------------------------------
  SLOT.className = 'card';
  SLOT.innerHTML = '<div class="tm-head"><h2>Telemark: Skocznie dnia</h2>' +
    '<button type="button" class="tm-play">Telemark</button></div>' +
    '<p class="note" style="margin:0 0 8px;color:var(--mute);font-size:13px">Codziennie 3 nowe skocznie, 10 skoków na każdej, ten sam wiatr dla wszystkich. ' +
    'Tydzień: suma 5 najlepszych dni, miesiąc: 20 najlepszych. ▶ odtwarza skok (dzisiejsze od jutra).</p>' +
    '<div class="tm-cols"><div id="tm-w"></div><div id="tm-m"></div></div>';
  SLOT.querySelector('.tm-play').addEventListener('click', () => open(''));
  SLOT.addEventListener('click', (e) => {
    const b = e.target.closest('[data-gid]');
    if (b && !b.disabled) open('?ogladaj=' + encodeURIComponent(b.dataset.gid));
  });

  const NAZWA = { w: 'Tydzień', m: 'Miesiąc' };
  const cups = (keys) => (keys || []).map((k) => `<svg class="cup"><use href="#${k[0] === 'm' ? 'cupM' : 'cup'}"/></svg>`).join('');
  const who = (r) => (/^\d{1,12}$/.test(String(r.uid || ''))
    ? `<a href="https://forums.d2jsp.org/user.php?i=${r.uid}" target="_blank" rel="noopener">${esc(r.nick)}</a>` : esc(r.nick)) + cups(r.puchary);
  const label = (key) => {
    const w = /^w(\d{4})-(\d{2})$/.exec(key);
    if (w) return `tydzień ${+w[2]}. ${w[1]}`;
    const m = /^m(\d{4})-(\d{2})$/.exec(key);
    const MIES = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
    return m ? `${MIES[+m[2] - 1]} ${m[1]}` : key;
  };
  function best(b, day) {
    if (!b) return '';
    const later = b.day >= day;
    return `<span class="tm-best">${b.m.toFixed(1).replace('.', ',')} m · ${pts(b.p)}</span>` +
      `<button type="button" class="tm-w" data-gid="${esc(b.gid)}"${later ? ' disabled title="Dzisiejsze skoki można obejrzeć od jutra"' : ' title="Obejrzyj skok"'} aria-label="Obejrzyj skok">▶</button>`;
  }
  function period(o, day) {
    const prev = o.prev && o.prev.podium || [];
    const win = prev.filter((r) => r.place === 1 && r.suma > 0);
    const prevLine = win.length
      ? `Poprzedni ${NAZWA[o.k].toLowerCase()} (${label(o.prev.key)}): <svg class="cup"><use href="#${o.k === 'm' ? 'cupM' : 'cup'}"/></svg> <b>${win.map((r) => esc(r.nick)).join(' i ')}</b>, ${pts(win[0].suma)} pkt` +
        (o.prev.zamkniety ? '' : ' (puchar po 0:15)')
      : `Poprzedni ${NAZWA[o.k].toLowerCase()} (${label(o.prev ? o.prev.key : '')}): bez zwycięzcy.`;
    const rows = o.rows.map((r) => `<tr><td>${r.place}</td><td>${who(r)}</td><td class="n">${pts(r.suma)}</td><td class="n">${r.dni}</td><td class="n">${best(r.best, day)}</td></tr>`).join('');
    return `<h3>${NAZWA[o.k]}: ${label(o.key)}</h3><p class="tm-prev">${prevLine}</p>` +
      (rows ? `<div class="tm-scroll"><table><thead><tr><th>#</th><th>Gracz</th><th class="n">Punkty</th><th class="n">Dni</th><th class="n">Najlepszy skok</th></tr></thead><tbody>${rows}</tbody></table></div>`
        : '<p class="tm-empty">Jeszcze nikt nie skakał.</p>');
  }
  let timer = 0;
  async function load(fresh) {
    clearTimeout(timer);
    timer = setTimeout(() => load(false), ODSWIEZ_MS);
    const headers = { 'Content-Type': 'application/json' };
    if (!PROD && haslo()) headers['X-Lotnik-Haslo'] = haslo();
    let j = null;
    try {
      const r = await fetch(API + '/tm/tabele', { method: 'POST', headers, body: JSON.stringify(fresh && !PROD ? { fresh: true } : {}) });
      j = await r.json();
      if (!r.ok) throw new Error(j && j.error);
    } catch (e) {
      const msg = j && j.haslo ? 'Tabele: strona testowa wymaga hasła testerów (wpisz je w grze albo w Lotniku).' : 'Tabele chwilowo niedostępne.';
      document.getElementById('tm-w').innerHTML = `<p class="tm-empty">${esc(msg)}</p>`;
      document.getElementById('tm-m').innerHTML = '';
      return;
    }
    for (const o of j.okresy) document.getElementById('tm-' + o.k).innerHTML = period(o, j.day);
  }
  load(false);
})();
