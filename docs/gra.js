// Spadające awatary + gra w podbijanie awatara. Ranking wspólny (funkcja w Google Cloud).
(() => {
  // Wersja testowa (/test/): osobna funkcja i kolekcje; ekwipunek włączony tylko tam
  const TEST = location.pathname.includes('/test/');
  const API = TEST ? 'https://pileczka-test-i3odn44x6q-ue.a.run.app' : 'https://pileczka-i3odn44x6q-ue.a.run.app';
  const COLORS = ['#e0a526', '#5b8def', '#d9667a', '#4fb286', '#9b5de5', '#e07a3f'];
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const css = document.createElement('style');
  css.textContent = `
  #snow{position:fixed;inset:0;pointer-events:none;z-index:40;overflow:hidden}
  .flake{position:absolute;top:0;left:0;border-radius:50%;background:var(--card) center/cover no-repeat;border:2px solid;display:grid;place-items:center;font-weight:700;color:var(--ink);pointer-events:auto;cursor:pointer;user-select:none;opacity:.85;will-change:transform;contain:layout}
  .flake:hover{opacity:1}
  .flake .badge{position:absolute;right:-6px;top:-6px;background:#e0a526;color:#141413;font-weight:800;border-radius:999px;padding:1px 6px;font-size:12px;box-shadow:0 2px 6px rgba(0,0,0,.4);border:2px solid #141413;line-height:1.3;pointer-events:none}
  .flake .b2{background:#ff8a3d}.flake .b3{background:#ff5a3d;color:#fff}.flake .b4{background:#d9264a;color:#fff}
  .flake.ball .badge{display:none}
  .flake.ball{opacity:1;z-index:2}
  #hud{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:60;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:6px 18px;font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;box-shadow:0 6px 18px rgba(0,0,0,.25);pointer-events:none}
  #hud{white-space:nowrap;max-width:calc(100vw - 24px)}
  @media (pointer:coarse){#hud{top:6px;font-size:17px;padding:3px 12px;opacity:.8}#lvlup{top:40px;font-size:16px}}
  body.playing #snow{z-index:62}
  #hud small{font-size:12px;font-weight:500;color:var(--mute);margin-left:6px}
  #over{position:fixed;inset:0;z-index:70;display:grid;place-items:center;background:rgba(0,0,0,.45)}
  #over .box{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;width:min(320px,calc(100vw - 32px));text-align:center}
  #over h3{margin:0 0 4px;font-size:18px}#over .sc{font-size:44px;font-weight:800;margin:4px 0 12px}
  #over .ball{width:80px;height:80px;border-radius:50%;border:3px solid;margin:6px auto 6px;background:var(--card) center/cover no-repeat;display:grid;place-items:center;font-size:32px;font-weight:800}
  #over .who{font-weight:700;font-size:16px}
  #over .txt{color:var(--mute);font-size:14px;margin-top:2px}
  #over .sc small{font-size:16px;color:var(--mute);font-weight:600}
  #over .eq{display:flex;align-items:center;justify-content:center;gap:6px;margin:-4px 0 14px}
  #over .ch{display:flex;flex-direction:column;align-items:center;border:1px solid var(--line);border-radius:10px;padding:4px 10px;min-width:58px;line-height:1.15}
  #over .ch b{font-size:17px}#over .ch i{font-style:normal;font-size:10.5px;opacity:.8}
  #over .ch.tot{border-color:var(--acc);color:var(--acc)}
  #over .op{color:var(--mute);font-weight:700;font-size:16px}
  #over details.mf summary{cursor:pointer;list-style:none;color:var(--mute)}#over details.mf summary::-webkit-details-marker{display:none}
  #over .mf{font-size:12.5px;color:var(--mute);margin:-6px auto 12px;line-height:1.45;max-width:260px}
  #over .mfh{font-weight:600;color:var(--ink);margin-bottom:3px}
  #over .mfr{display:flex;justify-content:center;gap:6px}#over .mfr span{min-width:70px;text-align:right;font-weight:700}#over .mfr i{font-style:normal;opacity:.6}#over .mfr b{min-width:40px;text-align:left;color:var(--ink)}
  #over .mft{margin-top:6px;color:var(--ink)}#over .mft span{color:var(--mute);font-size:11.5px}#over .mfs{font-size:11.5px}
  #over .closebig{display:block;width:100%;margin-top:14px;padding:10px;font-weight:700;background:var(--acc);border-color:var(--acc);color:#fff;border-radius:12px}
  #over input{width:100%;margin-bottom:10px;text-align:center}
  #over .row{display:flex;gap:8px;justify-content:center}
  #over button.pri{background:var(--acc);border-color:var(--acc);color:#fff}
  #over .msg{font-size:12px;color:var(--mute);min-height:16px;margin-top:8px}
  #mult{will-change:transform,opacity;position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:39;pointer-events:none;font-weight:900;font-size:min(20vw,220px);white-space:nowrap;line-height:1;opacity:0;transition:opacity .4s,color .6s;font-variant-numeric:tabular-nums;letter-spacing:-.04em}
  #mult.on{opacity:.13}
  #mult .bs{display:inline-block;font-size:.3em;color:#fff;border-radius:999px;padding:.05em .45em;margin-left:.15em;vertical-align:-.1em;letter-spacing:0;opacity:.9}
  #mult.pulse{animation:mpulse .9s ease-out}
  @keyframes mpulse{0%{opacity:.13;transform:translate(-50%,-50%) scale(1)}25%{opacity:.4;transform:translate(-50%,-50%) scale(1.12)}100%{opacity:.13;transform:translate(-50%,-50%) scale(1)}}
  #edge{position:fixed;inset:0;z-index:38;pointer-events:none;opacity:0;transition:opacity .6s;will-change:opacity;background:radial-gradient(ellipse at center,transparent 55%,rgba(255,90,20,.45) 100%)}
  #arenaEdges{display:none;position:fixed;top:0;bottom:0;z-index:38;pointer-events:none;border-left:2px dashed rgba(255,140,60,.25);border-right:2px dashed rgba(255,140,60,.25)}
  .savefx{position:fixed;left:0;right:0;bottom:0;height:40vh;z-index:61;pointer-events:none;background:linear-gradient(transparent,rgba(199,134,74,.55));animation:svf .9s ease-out forwards}
  @keyframes svf{from{opacity:1}to{opacity:0}}
  #lvlup{position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:60;font-weight:800;font-size:20px;color:#ff7a1a;text-shadow:0 0 10px rgba(255,120,30,.6);opacity:0;pointer-events:none}
  #lvlup.go{animation:lvl 1.1s ease-out}
  @keyframes lvl{0%{opacity:0;transform:translate(-50%,10px) scale(.8)}20%{opacity:1;transform:translate(-50%,0) scale(1.1)}100%{opacity:0;transform:translate(-50%,-18px) scale(1)}}
  #snowBtn{position:fixed;left:12px;bottom:12px;z-index:45;font-size:12px;padding:4px 10px;opacity:.75}
  body.playing{user-select:none;-webkit-user-select:none}
  body.playing .wrap{pointer-events:none}
  .pil li{list-style:none;display:flex;gap:8px;padding:5px 0;border-bottom:1px solid var(--line);font-size:14px}
  .pil .pn{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.25}
  .pil .pn>span,.pil .pn small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .pil .pn small{color:var(--mute);font-size:11.5px;display:flex;align-items:center;gap:4px}
  .pil .pn small i{width:14px;height:14px;border-radius:50%;background:center/cover;flex:none}
  .pil .dev{font-size:12px;margin-right:5px;opacity:.8;font-weight:400}
  .pil .plays{display:block;font-size:10.5px;color:var(--mute);font-weight:400;text-align:right}
  .pil li:last-child{border:0}.pil{margin:0;padding:0}.pil .me{color:var(--acc);font-weight:700}`;
  document.head.appendChild(css);

  const snow = document.createElement('div'); snow.id = 'snow'; document.body.appendChild(snow);
  const btn = document.createElement('button'); btn.id = 'snowBtn'; document.body.appendChild(btn);
  let on = ls.get('snieg') !== '0' && !reduce;
  const setBtn = () => { btn.textContent = on ? '❄ wyłącz awatary' : '❄ włącz awatary'; };
  btn.onclick = () => { on = !on; ls.set('snieg', on ? '1' : '0'); setBtn(); if (!on && !game) clearFlakes(); };
  setBtn();

  // Karta rankingu pod galerią sław: widoczna dopiero dla kogoś, kto już zagrał
  const fameCard = document.getElementById('fame')?.closest('.card');
  const card = document.createElement('div'); card.className = 'card'; card.hidden = true;
  card.innerHTML = `<h3 style="display:flex;justify-content:space-between;align-items:center">Piłeczka · ranking${TEST ? '<a href="#" id="pilLeg" style="font-size:11px;letter-spacing:0;text-transform:none;color:var(--acc)">Legenda</a>' : ''}</h3><ul class="pil" id="pil"><li class="empty">Ładowanie…</li></ul>`;
  if (TEST) card.querySelector('#pilLeg').onclick = (e) => { e.preventDefault(); openLegend(); };
  fameCard?.after(card);
  const ballAv = (r) => { const a = r.ballUid && D?.avatars?.[r.ballUid]; return a ? `<i style="background-image:url('${esc(a)}')"></i>` : ''; };
  function showRank(top) {
    card.hidden = false;
    const me = (ls.get('pilNick') || '').toLowerCase();
    document.getElementById('pil').innerHTML = top.length ? top.map((r, i) => `<li class="${r.nick.toLowerCase() === me ? 'me' : ''}${TEST && r.eq ? ' clk' : ''}"${TEST && r.eq ? ` data-eq="${esc(r.eq)}" data-nick="${esc(r.nick)}" title="Zobacz ekwipunek"` : ''}><span style="width:22px;color:var(--mute)">${i + 1}.</span><span class="pn"><span>${esc(r.nick)}</span>${r.hits ? `<small>${ballAv(r)}${r.hits}× ${esc(r.ball || '')}</small>` : ''}</span><b>${r.dev ? `<span class="dev" title="${r.dev === 'm' ? 'telefon' : 'komputer'}">${r.dev === 'm' ? '📱' : '🖥️'}</span>` : ''}${r.score}${TEST && r.plays ? `<small class="plays">${r.plays} ${r.plays === 1 ? 'gra' : r.plays % 10 >= 2 && r.plays % 10 <= 4 && (r.plays % 100 < 12 || r.plays % 100 > 14) ? 'gry' : 'gier'}</small>` : ''}</b></li>`).join('') : '<li class="empty">Jeszcze nikt nie zagrał.</li>';
  }
  const loadRank = (n = 0) => fetch(API).then((r) => { if (!r.ok) throw 0; return r.json(); }).then((j) => showRank(j.top || []))
    .catch(() => { card.hidden = false; document.getElementById('pil').innerHTML = '<li class="empty">Ranking chwilowo niedostępny, ponawiam…</li>'; if (n < 5) setTimeout(() => loadRank(n + 1), 15000); });
  if (ls.get('pilGral')) loadRank();

  // --- płatki ---
  const flakes = new Set();
  let game = null, W = innerWidth, H = innerHeight;
  addEventListener('resize', () => { W = innerWidth; H = innerHeight; });
  const pickUser = () => {
    const withAv = Object.keys(D.avatars || {}).filter((u) => D.users[u]);
    const pool = withAv.length ? withAv : Object.keys(D.users || {});
    return pool[Math.floor(Math.random() * pool.length)];
  };
  function makeEl(u, size) {
    const el = document.createElement('div'); el.className = 'flake';
    const av = D.avatars?.[u], col = COLORS[Math.floor(Math.random() * COLORS.length)];
    el.style.cssText = `width:${size}px;height:${size}px;border-color:${col};font-size:${size * .42}px;${av ? `background-image:url('${esc(av)}')` : ''}`;
    if (!av) el.textContent = (D.users[u] || '?')[0].toUpperCase();
    el.title = D.users[u] || '';
    snow.appendChild(el); return el;
  }
  function spawn() {
    if (!on || game || document.hidden || flakes.size >= 7 || !D?.users) return;
    const u = pickUser(); if (!u) return;
    const kind = pickKind(), size = Math.round(80 * kind.p * scaleK() * (TOUCH ? 1.2 : 1) * (1 + B.olb)); // na telefonie o 20% większe
    const f = { u, size, x: (TOUCH ? 0 : arena().l) + Math.random() * ((TOUCH ? W : arena().r - arena().l) - size), y: -size - 10, vy: (28 + Math.random() * 30) * scaleK(), sway: 20 + Math.random() * 30, ph: Math.random() * 6.28, rot: 0, vr: (Math.random() - .5) * 40 };
    f.el = makeEl(u, size); f.base = kind.m;
    if (kind.m > 1) { const b = document.createElement('span'); b.className = 'badge ' + kind.cls; b.textContent = 'x' + kind.m; f.el.appendChild(b); }
    f.el.addEventListener('pointerdown', (e) => { e.preventDefault(); game ? hit(f, e) : startGame(f, e); });
    flakes.add(f);
  }
  const clearFlakes = () => { for (const f of flakes) f.el.remove(); flakes.clear(); };

  // --- gra ---
  // Co 8 podbić poziom w górę: awatar leci szybciej (cały ruch przyspiesza), a mnożnik punktów rośnie o 0,1
  // Rozmiar i fizyka liczone względem wielkości okna — przybliżenie strony (Ctrl +) nie ułatwia gry
  // Rozmiary piłeczek: mniejsza = trudniej, ale większy mnożnik bazowy (mnoży się z mnożnikiem poziomu)
  const KINDS = [{ p: 1, m: 1, w: 25 }, { p: .8, m: 1.3, w: 25, cls: 'b2' }, { p: .65, m: 1.7, w: 25, cls: 'b3' }, { p: .5, m: 2.2, w: 25, cls: 'b4' }];
  const pickKind = () => { let r = Math.random() * 100; for (const k of KINDS) { if ((r -= k.w) < 0) return k; } return KINDS[0]; };
  const BADGE = { 1.3: '#ff8a3d', 1.7: '#ff5a3d', 2.2: '#d9264a' }; // kolory jak plakietki na piłeczkach
  // Bonusy z założonych przedmiotów (tylko TEST; bez przedmiotów wszystko jest zerem i gra liczy jak dotąd)
  const zeroB = () => ({ setN: 0, setUid: '', setMult: 0, impl: 0, ostry: 0, stlum: 0, ciezki: 0, zreczny: 0, rozp: 0, wytrw: 0, olb: 0, mrozu: 0, lowcy: 0, serii: 0, brawur: 0, zuch: 0, echa: 0, guardian: 0, lucky: 0, korona: 0, kapcie: 0 });
  let B = zeroB();
  const r3 = (x) => Math.round(x * 1000) / 1000;
  function calcB(slots) {
    const b = zeroB();
    for (const it of Object.values(slots || {})) {
      if (!it) continue;
      b.impl += it.implicit?.mult || 0;
      if (it.rarity === 'u' && it.slot === 'helm') b.korona = 1; // Korona Króla Forum
      if (it.rarity === 'u' && it.slot === 'boots') b.kapcie = 1; // Kapcie Moderatora
      for (const a of it.affixes || []) {
        const v = a.v || 0;
        if (a.id === 'ostry') b.ostry += v; else if (a.id === 'stlumiony') b.stlum += v / 100; else if (a.id === 'ciezki') b.ciezki += v / 100;
        else if (a.id === 'zreczny') b.zreczny += v / 100; else if (a.id === 'szczesliwy') b.lucky += v; else if (a.id === 'rozpedzony') b.rozp += v / 100;
        else if (a.id === 'wytrwalosci') b.wytrw = Math.max(b.wytrw, v); else if (a.id === 'olbrzyma') b.olb += v / 100;
        else if (a.id === 'mrozu') b.mrozu += v; else if (a.id === 'lowcy') b.lowcy += v; else if (a.id === 'serii') b.serii += v;
        else if (a.id === 'brawurowy') b.brawur += v; else if (a.id === 'zuchwaly') b.zuch += v; else if (a.id === 'echa') b.echa += v / 100; else if (a.id === 'stroza') b.guardian += v;
      }
    }
    // zestaw: przedmioty z awatarem tej samej osoby — 2 szt. +0.2x, 3 szt. +0.5x, 4 szt. +0.5x i jedno odbicie od dołu
    const cnt = {}; for (const it of Object.values(slots || {})) if (it?.uid) if (it.rarity === 'r' || it.rarity === 'u') cnt[it.uid] = (cnt[it.uid] || 0) + 1; // do zestawu liczą się tylko rzadkie i unikaty
    const top = Object.entries(cnt).sort((a, c) => c[1] - a[1])[0];
    b.setN = top && top[1] >= 2 ? top[1] : 0; b.setUid = b.setN ? top[0] : '';
    b.setMult = b.setN >= 3 ? .5 : b.setN === 2 ? .2 : 0; if (b.setN === 4) b.guardian++;
    for (const k of Object.keys(b)) if (typeof b[k] === 'number') b[k] = r3(b[k]);
    // limity łączne (afiksy mogą się powtarzać, ale suma ma sufit)
    const CAP = { stlum: .3, ciezki: .25, zreczny: .6, olb: .25, rozp: .6, lowcy: 1.5, lucky: 25, brawur: .5, zuch: .08, echa: .25 };
    for (const k in CAP) b[k] = Math.min(CAP[k], b[k]);
    return b;
  }
  const RP = TEST ? 100 : 10; // dokładność mnożnika: w produkcji 0.1, w teście 0.01 (seria)
  const fm = (n) => { const r = Math.round(n * 100) / 100; return Math.abs(r * 10 - Math.round(r * 10)) < 1e-9 ? r.toFixed(1) : r.toFixed(2); };
  // (piłeczka + łowcy gdy mniejsza niż duża) × mnożnik poziomu (start 1 + rozpędzony) + przedmioty (implicit + ostry + seria × floor(podbicia/10))
  const partsOf = (g) => {
    const b = g.base + (g.base > 1 ? g.B.lowcy : 0) + (g.crown || 0), lv = multOf(g.lvl, g.B), items = r3(g.B.impl + g.B.ostry + g.B.setMult + (g.zuchAcc || 0) + g.B.serii * Math.floor(g.hits / 10));
    return { b, lv, items, total: Math.round((b * lv + items) * RP) / RP };
  };
  const totalMult = () => game ? partsOf(game).total : 1;
  // liczone od wysokości okna: na telefonie (wąski, wysoki ekran) awatary nie są malutkie, a wysokość podbicia jest proporcjonalna
  const scaleK = () => Math.max(.5, Math.min(1.4, innerHeight / 950));
  const G = 1500, JUMP = 610, PER_LEVEL = 8;
  const TOUCH = matchMedia('(pointer: coarse)').matches; // na dotyku gra się łatwiej (kciuk, cały ekran w zasięgu) — +20% prędkości
  const speedOf = (lvl) => (1 + lvl * 0.07) * (TOUCH ? 1.2 : 1), multOf = (lvl, b = B) => Math.round((1 + b.rozp + lvl * 0.1) * 100) / 100;
  const hud = document.createElement('div'); hud.id = 'hud'; hud.hidden = true; document.body.appendChild(hud);
  const multEl = document.createElement('div'); multEl.id = 'mult'; document.body.appendChild(multEl);
  const edgeEl = document.createElement('div'); edgeEl.id = 'edge'; document.body.appendChild(edgeEl);
  // Duży, półprzezroczysty mnożnik w tle + poświata na brzegach ekranu rosnąca z poziomem
  function showMult(lvl, pulse) {
    const m = totalMult(), heat = Math.min(1, (m - 1) / 3);
    const lv = fm(multOf(lvl, game ? game.B : B)), b = game ? game.base : 1, bEff = game ? partsOf(game).b : 1;
    multEl.innerHTML = `<span class="lv">x${lv}</span>` + (b > 1 ? `<span class="bs" style="background:${BADGE[b]}">×${fm(bEff)}</span>` : '');
    multEl.style.color = `hsl(${45 - heat * 45}, 95%, ${60 - heat * 10}%)`;
    if (!TOUCH) { const A = arena(); edgesEl.style.cssText = `display:block;left:${A.l}px;width:${A.r - A.l}px`; }
    multEl.classList.add('on'); edgeEl.style.opacity = String(heat * .9);
    if (pulse) { multEl.classList.remove('pulse'); void multEl.offsetWidth; multEl.classList.add('pulse'); }
  }
  const edgesEl = document.createElement('div'); edgesEl.id = 'arenaEdges'; document.body.appendChild(edgesEl);
  const hideMult = () => { edgesEl.style.display = 'none'; multEl.classList.remove('on', 'pulse'); edgeEl.style.opacity = '0'; };
  // błysk przy zużyciu odbicia od dołu
  function saveFx() { const e = document.createElement('div'); e.className = 'savefx'; document.body.appendChild(e); setTimeout(() => e.remove(), 900); }
  const flashEl = document.createElement('div'); flashEl.id = 'lvlup'; document.body.appendChild(flashEl);
  let lastFlash = 0; const BRAV_MAX = 1.5, ZUCH_MAX = 0.6; // sufity premii z serii Brawurowego i nabitego Zuchwałego
  function flash(t) { lastFlash = performance.now(); flashEl.textContent = t; flashEl.classList.remove('go'); void flashEl.offsetWidth; flashEl.classList.add('go'); }
  // Na komputerze gra tylko w dużym oknie — w małym/wąskim oknie jest dużo łatwiej (mało miejsca na ucieczkę piłeczki)
  // Pole gry ma stałe proporcje (szerokość = 1,5 × wysokość, wyśrodkowane), więc na każdym monitorze jest tak samo trudno
  const ASPECT = 1.5, MIN_H = 600;
  const arena = () => { const aw = Math.min(W, H * ASPECT); return { l: (W - aw) / 2, r: (W + aw) / 2 }; };
  function startGame(f, e) {
    if (!TOUCH && (innerHeight < MIN_H || innerWidth < innerHeight * ASPECT)) {
      flash(`Powiększ lub poszerz okno, żeby zagrać`);
      return;
    }
    for (const o of flakes) if (o !== f) o.el.remove();
    flakes.clear(); flakes.add(f);
    game = { f, score: 0, hits: 0, lvl: 0, k: scaleK(), base: f.base || 1, B, per: B.wytrw || PER_LEVEL, saves: B.guardian, lowRun: 0, zuchAcc: 0, bans: B.kapcie, crown: B.korona && window.crownOf ? window.crownOf(f.u) : 0 }; f.el.classList.add('ball'); showMult(0, false);
    document.body.classList.add('playing'); getSelection()?.removeAllRanges(); const pie = document.getElementById('pie'); if (pie) pie.hidden = true; f.vx = 0; f.vy = 0;
    hit(f, e);
  }
  // Kapcie Moderatora: raz na grę pudło (kliknięcie obok piłeczki) liczy się jako podbicie
  document.addEventListener('pointerdown', (e) => {
    if (!game || !game.bans || e.target.closest?.('.ball, button, a, input, #over')) return;
    game.bans--; flash('🔨 Ban! Kapcie Moderatora uratowały piłeczkę'); hit(game.f, { clientX: game.f.el.getBoundingClientRect().left + game.f.size / 2 });
  });
  function hit(f, e) {
    if (!game || game.f !== f) return;
    game.hits++;
    const up = game.hits % game.per === 0 && game.hits > 0;
    // Brawurowy: podbicie w dolnych 15% ekranu daje dodatkowy mnożnik; Echa: szansa, że podbicie liczy się podwójnie
    // podbicie tuż nad dołem (dolne 15%): Brawurowy — premia rosnąca z każdym kolejnym takim podbiciem z rzędu (wyższe podbicie zeruje serię),
    // Zuchwały — stały przyrost mnożnika do końca gry; Echa — szansa, że punkty za podbicie liczą się podwójnie
    const low = (game.B.brawur || game.B.zuch) && f.y + f.size / 2 > H * .85, echo = game.B.echa && Math.random() < game.B.echa;
    game.lowRun = low ? game.lowRun + 1 : 0;
    const brav = low ? Math.min(BRAV_MAX, game.B.brawur * game.lowRun) : 0;
    game.score += (totalMult() + brav) * (echo ? 2 : 1);
    if (low && game.B.zuch && game.lvl > 0) game.zuchAcc = r3(Math.min(ZUCH_MAX, game.zuchAcc + game.B.zuch));
    if (!up && performance.now() - lastFlash > 1200) if (echo) flash('Echo! x2'); else if (brav) flash(`Brawura x${game.lowRun}! +${fm(brav)}x`);
    if (up) { game.lvl++; flash(`Szybciej! x${fm(totalMult())}`); showMult(game.lvl, true); }
    const r = f.el.getBoundingClientRect(), off = ((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) || 0;
    // podbicie nie wyrzuca ponad górną krawędź: siła ograniczona tak, żeby szczyt lotu był ok. 12 px pod górą ekranu
    const room = Math.max(0, f.y - 12), vMax = Math.sqrt(2 * G * (1 - game.B.ciezki) * game.k * room), jump = JUMP * (1 - game.B.stlum);
    f.vy = -Math.max(jump * game.k * .3, Math.min(jump * game.k, vMax));
    f.vx = Math.max(-420, Math.min(420, -off * 320 + (Math.random() - .5) * 120)) * game.k * (1 - game.B.zreczny);
    f.vr = -off * 360;
    const P = partsOf(game);
    hud.hidden = false; hud.innerHTML = `${game.saves ? `<span title="odbicia od dołu" style="margin-right:8px">🛡${game.saves}</span>` : ''}${game.bans ? `<span title="Kapcie Moderatora: pudło liczy się jako podbicie" style="margin-right:8px">🔨${game.bans}</span>` : ''}${Math.round(game.score)}<small>pkt${TOUCH ? ` · x${fm(P.total)}` : ` · ${P.b > 1 ? `x${fm(P.b)} more · ` : ''}+${Math.round((P.lv - 1) * 100)}% increased${P.items ? ` + ${fm(P.items)} przedmioty` : ''} = x${fm(P.total)} · ${game.hits} podbić`}</small>`;
  }
  function endGame() {
    const gLvlN = game.lvl + 1, score = Math.round(game.score), f = game.f, gHits = game.hits, P = partsOf(game); game = null; document.body.classList.remove('playing'); hideMult();
    f.el.remove(); flakes.clear(); hud.hidden = true;
    const ov = document.createElement('div'); ov.id = 'over';
    const av = D.avatars?.[f.u], who = D.users[f.u] || '?', hits = gHits;
    ov.innerHTML = `<div class="box"><h3>Koniec gry!</h3>
      <div class="ball" style="border-color:${f.el.style.borderColor};${av ? `background-image:url('${esc(av)}')` : ''}">${av ? '' : esc(who[0].toUpperCase())}</div>
      <div class="txt"><b style="color:var(--ink)">${esc(who)}</b> · ${hits} ${hits === 1 ? 'podbicie' : hits % 10 >= 2 && hits % 10 <= 4 && (hits % 100 < 12 || hits % 100 > 14) ? 'podbicia' : 'podbić'}</div>
      <div class="sc">${score}<small> pkt</small></div>
      <div class="eq">${P.b > 1 ? `<span class="ch" style="background:${BADGE[f.base] || '#d9264a'};color:#fff"><b>×${fm(P.b)}</b><i>piłeczka</i></span><span class="op">×</span>` : ''}<span class="ch"><b>×${fm(P.lv)}</b><i>poziom ${gLvlN}</i></span>${P.items ? `<span class="op">+</span><span class="ch"><b>+${fm(P.items)}</b><i>przedmioty</i></span>` : ''}<span class="op">=</span><span class="ch tot"><b>×${fm(P.total)}</b><i>na koniec</i></span></div>
      ${TEST ? chancesHtml(score) : ''}
      <input id="pilNick" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Twój nick" value="${esc(ls.get('pilNick') || '')}">
      <div class="row"><button class="pri" id="pilSave">Zapisz wynik</button></div><div class="msg" id="pilMsg"></div><div id="pilDrop"></div><button id="pilClose" class="closebig">Zamknij</button></div>`;
    document.body.appendChild(ov);
    // decyzja o przedmiocie tylko tutaj: zamknięcie okna bez wyboru = przedmiot przepada (nie da się odłożyć i porównać później)
    let pendId = null;
    const close = () => {
      if (dropOpen && pendId) { if (!confirm('Nie wybrałeś — nowy przedmiot przepadnie. Zamknąć?')) return; eqPost('/equip', { key: getKey(), id: pendId, action: 'discard' }); }
      ov.remove();
    };
    let dropOpen = false; // nierozstrzygnięty przedmiot: okno zamyka się tylko przyciskiem
    if (TEST && score >= 15) { // drop idzie od razu, niezależnie od zapisu wyniku
      eqPost('/drop', { key: getKey(), gameId: rndHex().slice(0, 16), score, ballUid: /^\d+$/.test(f.u) ? f.u : '', ballNick: D.users[f.u] || '' })
        .then((r) => { if (r.ok && r.j.reason === 'pech') ov.querySelector('#pilDrop').innerHTML = `<div class="msg">Tym razem nic nie wypadło (szansa ${r.j.chance}%).</div>`; if (r.ok && r.j.drop) { pendId = r.j.autoDiscard ? null : r.j.drop.id; ov.querySelector('.box').classList.add('wide'); showDrop(ov.querySelector('#pilDrop'), r.j, (o) => { dropOpen = o; }); } }).catch(() => {});
    }
    ov.querySelector('#pilClose').onclick = close;
    const save = (auto) => {
      const nick = ov.querySelector('#pilNick').value.trim();
      if (!nick) { ov.querySelector('#pilMsg').textContent = 'Wpisz nick.'; return; }
      ls.set('pilNick', nick); ls.set('pilGral', '1');
      ov.querySelector('#pilMsg').textContent = 'Zapisuję…';
      fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nick, score, dev: TOUCH ? 'm' : 'd', hits: gHits, ball: D.users[f.u] || '', ballUid: /^\d+$/.test(f.u) ? f.u : '', ...(TEST ? { key: getKey() } : {}) }) })
        .then((r) => r.json()).then((j) => { if (j.top) { showRank(j.top); const m = j.me; if (TEST && m) { ov.querySelector('#pilMsg').innerHTML = `✔ <b>${esc(nick)}</b> · ${m.record ? '<b style="color:var(--acc)">nowy rekord!</b>' : `rekord ${m.best}`} · gra nr ${m.plays} · <a href="#" data-a="chg">zmień nick</a>`; const ch = ov.querySelector('#pilMsg [data-a="chg"]'); if (ch) ch.onclick = (e) => { e.preventDefault(); window.__chgNick?.(); }; return; } if (dropOpen) ov.querySelector('#pilMsg').textContent = 'Wynik zapisany. Rozstrzygnij przedmiot poniżej.'; else { close(); card.scrollIntoView({ behavior: 'smooth', block: 'center' }); } } else ov.querySelector('#pilMsg').textContent = j.error || 'Błąd zapisu.'; })
        .catch(() => { ov.querySelector('#pilMsg').textContent = 'Nie udało się zapisać, spróbuj jeszcze raz.'; });
    };
    ov.querySelector('#pilSave').onclick = save;
    ov.querySelector('#pilNick').addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    // Wersja testowa: zapamiętany nick → zapis automatyczny (serwer i tak trzyma najlepszy wynik), z opcją zmiany nicku
    const saved = ls.get('pilNick');
    if (TEST && saved) {
      const nickEl = ov.querySelector('#pilNick'), btn = ov.querySelector('#pilSave');
      nickEl.style.display = 'none'; btn.style.display = 'none';
      const chgNick = () => { ov.querySelector('#pilMsg').textContent = ''; nickEl.style.display = ''; btn.style.display = ''; btn.textContent = 'Zapisz pod nowym nickiem'; nickEl.value = ''; nickEl.focus(); };
      window.__chgNick = chgNick;
      save(true);
    } else setTimeout(() => ov.querySelector('#pilNick').focus(), 50);
  }

  // --- ekwipunek (tylko wersja testowa: /test/) ---
  const COL = { n: '#c8c8c8', m: '#6c8cff', r: '#f2d24b', u: '#c7864a' }, RAR = { n: 'Normalny', m: 'Magiczny', r: 'Rzadki', u: 'Unikat' };
  const SLOT = { helm: ['Hełm', 0, 'hełm'], armor: ['Zbroja', 1, 'zbroja'], gloves: ['Rękawice', 2, 'rękawice'], boots: ['Buty', 2, 'buty'] }; // nazwa, rodzaj (m/ż/lm), etykieta pustego slotu
  const UNIQ = { helm: 'Korona Króla Forum', armor: 'Zbroja Anioła Stróża', gloves: 'Rękawice Anioła Stróża', boots: 'Kapcie Moderatora' };
  // afiksy: [typ p/s, nazwa, min, max, krok, przymiotnik m/ż/lm albo dopełniacz, opis(v)]
  const AFF = {
    ostry: ['p', 'Ostry', 0.4, 1.0, 0.1, ['Ostry', 'Ostra', 'Ostre'], (v) => `+${v.toFixed(1)}x mnożnika`],
    stlumiony: ['p', 'Stłumiony', 5, 15, 1, ['Stłumiony', 'Stłumiona', 'Stłumione'], (v) => `Niższe podbicie o ${v}%`],
    ciezki: ['p', 'Ciężki', 5, 10, 1, ['Ciężki', 'Ciężka', 'Ciężkie'], (v) => `Grawitacja słabsza o ${v}%`],
    zreczny: ['p', 'Zręczny', 10, 30, 1, ['Zręczny', 'Zręczna', 'Zręczne'], (v) => `Odbicie w bok mniejsze o ${v}%`],
    szczesliwy: ['p', 'Szczęśliwy', 3, 10, 1, ['Szczęśliwy', 'Szczęśliwa', 'Szczęśliwe'], (v) => `+${v}% szansy na rzadszy przedmiot`],
    brawurowy: ['p', 'Brawurowy', 0.15, 0.25, 0.01, ['Brawurowy', 'Brawurowa', 'Brawurowe'], (v) => `+${v.toFixed(2)}x mnożnika za każde kolejne podbicie z rzędu tuż nad dołem ekranu`],
    zuchwaly: ['p', 'Zuchwały', 0.02, 0.04, 0.01, ['Zuchwały', 'Zuchwała', 'Zuchwałe'], (v) => `+${v.toFixed(2)}x mnożnika na stałe za każde podbicie tuż nad dołem ekranu (od 2. poziomu)`],
    rozpedzony: ['p', 'Rozpędzony', 10, 20, 1, ['Rozpędzony', 'Rozpędzona', 'Rozpędzone'], (v) => `Rozpocznij z mnożnikiem ogólnym zwiększonym o ${v}%`],
    wytrwalosci: ['s', 'Wytrwałości', 9, 10, 1, 'Wytrwałości', (v) => `Nowy poziom co ${v} podbić`],
    olbrzyma: ['s', 'Olbrzyma', 5, 10, 1, 'Olbrzyma', (v) => `Większa piłeczka o ${v}%`],
    lowcy: ['s', 'Łowcy', 0.2, 0.5, 0.1, 'Łowcy', (v) => `+${v.toFixed(1)} do mnożnika piłeczki`],
    echa: ['s', 'Echa', 10, 20, 1, 'Echa', (v) => `+${v}% szansy na podwójne punkty za podbicie`],
    stroza: ['s', 'Stróża', 1, 1, 1, 'Stróża', () => 'Raz na grę: odbicie od dołu zamiast końca gry'],
    serii: ['s', 'Serii', 0.10, 0.25, 0.01, 'Serii', (v) => `+${v.toFixed(2)}x mnożnika za każde 10 podbić`],
  };
  const itemName = (it) => {
    const s = SLOT[it.slot]; if (it.rarity === 'u') return UNIQ[it.slot];
    const af = (it.affixes || []).filter((a) => AFF[a.id]);
    return [...af.filter((a) => AFF[a.id][0] === 'p').map((a) => AFF[a.id][5][s[1]]), s[0], ...af.filter((a) => AFF[a.id][0] === 's').map((a) => AFF[a.id][5])].join(' ');
  };
  const coloured = (it) => `<b style="color:${COL[it.rarity]}">${esc(itemName(it))}</b>`;
  // Dymek w stylu D2 (najechanie; na telefonie dotknięcie pokazuje/ukrywa)
  const ITEMS = {};
  // klasa afiksu (jak na serwerze): im wyższa, tym rzadsza
  const TIER = { stlumiony: 'slaby', zreczny: 'slaby', olbrzyma: 'slaby', lowcy: 'dobry',  ciezki: 'dobry', wytrwalosci: 'dobry', rozpedzony: 'znakomity', szczesliwy: 'dobry', brawurowy: 'znakomity', zuchwaly: 'znakomity', echa: 'znakomity', ostry: 'boski', serii: 'boski', stroza: 'boski' };
  const TIERN = { slaby: 'słaby', dobry: 'dobry', znakomity: 'znakomity', boski: 'boski' };
  const tipHtml = (it) => `<div class="tn" style="color:${COL[it.rarity]}">${esc(itemName(it))}</div><div class="ts">${SLOT[it.slot][0]} · ${RAR[it.rarity]}</div><div class="ts">Poziom przedmiotu: ${it.ilvl ?? 0}</div>
    <div class="tg">+${(it.implicit?.mult ?? 0.1).toFixed(1)}x mnożnika</div>${(it.affixes || []).filter((a) => AFF[a.id]).map((a) => `<div class="tb">${esc(AFF[a.id][6](a.v))}<small class="tier t-${TIER[a.id]}">(${TIERN[TIER[a.id]]})</small></div>`).join('')}${it.rarity === 'u' && it.slot === 'boots' ? '<div class="tb">Raz na grę: kliknięcie w dowolne miejsce ekranu liczy się jako podbicie</div>' : ''}${it.rarity === 'u' && it.slot === 'helm' ? '<div class="tb">Piłeczka z awatarem kogoś z top 10 ostatnich 24 h: +1.0x (1. miejsce), +0.6x (2–3), +0.3x (4–10)</div>' : ''}`;
  const sumHtml = (b) => {
    const L = [], pct = (x) => Math.round(x * 100);
    const mult = r3(b.impl + b.ostry); if (mult) L.push(`+${fm(mult)}x mnożnika`);
    if (b.setN) L.push(`Zestaw ${D.users[b.setUid] || ''} (${b.setN}/4): +${fm(b.setMult)}x mnożnika${b.setN === 4 ? ' i odbicie od dołu' : ''}`);
    if (b.serii) L.push(`+${b.serii.toFixed(2)}x za każde 10 podbić`);
    if (b.brawur) L.push(`+${b.brawur.toFixed(2)}x mnożnika za każde kolejne podbicie z rzędu tuż nad dołem ekranu`);
    if (b.zuch) L.push(`+${b.zuch.toFixed(2)}x mnożnika na stałe za każde podbicie tuż nad dołem ekranu (od 2. poziomu)`);
    if (b.echa) L.push(`+${pct(b.echa)}% szansy na podwójne punkty za podbicie`);
    if (b.lowcy) L.push(`+${b.lowcy.toFixed(1)} do mnożnika piłeczki`);
    if (b.rozp) L.push(`Rozpocznij z mnożnikiem ogólnym zwiększonym o ${pct(b.rozp)}%`);
    if (b.wytrw) L.push(`Nowy poziom co ${b.wytrw} podbić`);
    if (b.stlum) L.push(`Niższe podbicie o ${pct(b.stlum)}%`);
    if (b.ciezki) L.push(`Grawitacja słabsza o ${pct(b.ciezki)}%`);
    if (b.zreczny) L.push(`Odbicie w bok mniejsze o ${pct(b.zreczny)}%`);
    if (b.olb) L.push(`Większa piłeczka o ${pct(b.olb)}%`);
    if (b.lucky) L.push(`+${b.lucky}% szansy na rzadszy przedmiot`);
    if (b.kapcie) L.push('Kapcie Moderatora: raz na grę kliknięcie w dowolne miejsce ekranu liczy się jako podbicie');
    if (b.korona) L.push('Korona: piłeczka z awatarem kogoś z top 10 ostatnich 24 h dostaje +1.0x (1. miejsce), +0.6x (2–3), +0.3x (4–10)');
    if (b.guardian) L.push(`Anioł Stróż: ${b.guardian}× ratunek na grę`);
    return `<div class="eqsum"><h4>Łączne bonusy</h4>${L.length ? L.map((x) => `<div>${esc(x)}</div>`).join('') : '<div class="mute">brak</div>'}</div>`;
  };
  // Szanse na przedmiot (kopia wzoru z serwera): płynny wzrost do 1000 pkt; szczęśliwy przesuwa % z Normalnego (70% → M, 30% → R)
  function chances(score, luck = 0) {
    const cv = (P) => { const x = Math.max(P[0][0], Math.min(score, P[P.length - 1][0])); for (let i = 1; i < P.length; i++) if (x <= P[i][0]) return P[i - 1][1] + (P[i][1] - P[i - 1][1]) * (x - P[i - 1][0]) / (P[i][0] - P[i - 1][0]); return P[P.length - 1][1]; };
    const r0 = cv([[15, 1], [100, 5], [300, 12], [600, 20], [1000, 50]]), m0 = cv([[15, 14], [100, 25], [300, 35], [600, 42], [1000, 45]]);
    const n0 = Math.max(5, 100 - m0 - r0), s = Math.min(luck, n0);
    const n = n0 - s, m = m0 + .7 * s, r = r0 + .3 * s, u = score < 50 ? 0 : .3 + .5 * Math.min(1, (score - 50) / 100), k = (100 - u) / (n + m + r);
    return { n: n * k, m: m * k, r: r * k, u, mf: Math.round(((m + r) / 15 - 1) * 100) };
  }
  function chancesHtml(score) {
    if (score < 15) return `<div class="mf">Przedmiot wypada od 15 pkt — im więcej punktów, tym większa szansa na rzadszy.</div>`;
    const c = chances(score, B.lucky || 0), c0 = chances(score, 0), p = (v) => v < 10 ? v.toFixed(1) : Math.round(v);
    const mfPts = Math.round(c0.m + c0.r - 15), mfIt = B.lucky || 0; // magic find: zwykła suma — z punktów + z przedmiotów
    const row = (k, name, v) => `<div class="mfr"><span style="color:${COL[k]}">${name}</span><i>·</i><b>${p(v)}%</b></div>`;
    return `<details class="mf"><summary>Magic find <b>+${mfPts + mfIt}%</b> ▾</summary>
      <div class="mfr"><span>Szansa na drop</span><i>·</i><b>${Math.round(Math.min(1, score / 80) * 100)}%</b></div>
      ${row('n', 'Normalny', c.n)}${row('m', 'Magiczny', c.m)}${row('r', 'Rzadki', c.r)}${c.u ? row('u', 'Unikat', c.u) : ''}
      ${mfIt ? `<div class="mft"><span>z punktów +${mfPts}%, z przedmiotów +${mfIt}%</span></div>` : ''}</details>`;
  }
  const rndHex = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  const getKey = () => { let k = ls.get('eqKey'); if (!/^[0-9a-f]{32}$/.test(k || '')) { k = rndHex(); ls.set('eqKey', k); } return k; };
  const eqPost = (path, body) => fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then((r) => r.json().then((j) => { if (path !== '/view' && j && j.slots) B = calcB(j.slots); return { ok: r.ok, status: r.status, j }; }));
  // Przedmiot = awatar podbitej osoby + nakładka slotu w kolorze rzadkości
  function itemEl(it) {
    const av = it.uid && D?.avatars?.[it.uid];
    ITEMS[it.id] = it;
    return `<div class="eqit q-${it.rarity}" data-tid="${esc(it.id)}"><div class="eqav" style="${av ? `background-image:url('${esc(av)}')` : ''}">${av ? '' : esc((it.unick || '?')[0].toUpperCase())}</div><svg class="eqov" style="color:${COL[it.rarity]}"><use href="#eq-${it.slot}"/></svg></div>`;
  }
  // Porównanie „założone → nowy” z przyciskami; done(stan) po rozstrzygnięciu (albo done(null) gdy przedmiot już przepadł)
  function decideUI(host, item, cur, done) {
    host.innerHTML = `<div class="eqcmp">${cur ? `<div class="eqc q-${cur.rarity}"><span class="tag">założone</span>${itemEl(cur)}<div class="eqname" style="color:${COL[cur.rarity]}">${esc(itemName(cur))}</div></div><div class="arr">→</div>` : ''}<div class="eqc q-${item.rarity}"><span class="tag">nowy</span>${itemEl(item)}<div class="eqname" style="color:${COL[item.rarity]}">${esc(itemName(item))}</div></div></div>
      <div class="row"><button class="pri" data-a="equip">Załóż nowy</button><button data-a="discard">Zostaw stary</button></div><div class="msg"></div>`;
    const msg = host.querySelector('.msg');
    host.querySelectorAll('button').forEach((b) => b.onclick = () => {
      const a = b.dataset.a;
      if (a === 'equip' && cur && !confirm(`Po zamianie ${itemName(cur)} przepadnie na zawsze. Na pewno?`)) return;
      host.querySelectorAll('button').forEach((x) => x.disabled = true);
      eqPost('/equip', { key: getKey(), id: item.id, action: a }).then((r) => {
        if (r.status === 409) { host.innerHTML = '<div class="msg">Ten przedmiot już przepadł.</div>'; done(null); }
        else if (r.ok) { host.innerHTML = `<div class="eqres">${a === 'equip' ? 'Założono' : cur ? 'Zostawiono stary' : 'Odrzucono'}: ${coloured(a === 'equip' || !cur ? item : cur)}</div>`; done(r.j); }
        else throw 0;
      }).catch(() => { msg.textContent = 'Błąd sieci, spróbuj jeszcze raz.'; host.querySelectorAll('button').forEach((x) => x.disabled = false); });
    });
  }
  // Sekcja dropu w oknie końca gry; setOpen(true) dopóki czeka na decyzję (okno się wtedy nie zamyka po zapisie wyniku)
  function showDrop(host, j, setOpen) {
    const it = j.drop;
    host.innerHTML = `<div class="eqdrop">${j.equipped || j.autoDiscard ? '' : `<div>Wypadł przedmiot! <b style="color:${COL[it.rarity]}">${RAR[it.rarity]}</b></div>`}<div class="eqbody"></div><a href="#" data-a="seeinv" class="seeinv">Ekwipunek ›</a></div>`;
    host.querySelector('[data-a="seeinv"]').onclick = (e) => { e.preventDefault(); openInv(); };
    const body = host.querySelector('.eqbody');
    if (j.autoDiscard) { body.innerHTML = `<div class="eqres">${itemEl(it)}<span>Wypadł ${coloured(it)} (normalny)<br><small style="color:var(--mute)">gorszy od założonego — odrzucony</small></span></div>`; setOpen(false); return; }
    if (j.equipped) { body.innerHTML = `<div class="eqres">${itemEl(it)}<span>Nowy przedmiot: ${coloured(it)}<br><small style="color:var(--mute)">założony</small></span></div>`; setOpen(false); return; }
    setOpen(true);
    decideUI(body, it, j.current, () => setOpen(false));
  }
  const SLOT_POS = { helm: 'left:160px;top:46px;width:100px;height:100px', armor: 'left:150px;top:186px;width:120px;height:150px', gloves: 'left:22px;top:252px;width:100px;height:100px', boots: 'left:298px;top:252px;width:100px;height:100px' };
  function invPanel(st, title = 'EKWIPUNEK') {
    const bb = calcB(st.slots);
    return `<div class="eqinv"><h3>${esc(title)}</h3>${Object.keys(SLOT).map((s) => { const it = st.slots?.[s]; return `<div class="eqslot ${it ? 'q-' + it.rarity : 'empty'}${it && bb.setN && it.uid === bb.setUid ? ' setg' : ''}" data-l="${SLOT[s][2]}" style="${SLOT_POS[s]}">${it ? `${itemEl(it)}<div class="eqname" data-tid="${esc(it.id)}" style="color:${COL[it.rarity]}">${esc(itemName(it))}</div>` : ''}</div>`; }).join('')}</div>${sumHtml(calcB(st.slots))}`;
  }
  // Podgląd cudzego ekwipunku (z rankingu): tylko do oglądania
  function openView(eq, nick) {
    const ov = document.createElement('div'); ov.className = 'eqo';
    const z = Math.min(1, (innerWidth - 48) / 420);
    ov.innerHTML = `<div class="eqbox" style="width:${Math.round(420 * z)}px"><div class="eqz" style="zoom:${z}"><div class="eqmain">Ładowanie…</div></div><div class="row" style="margin-top:12px"><button data-a="close">Zamknij</button></div></div>`;
    document.body.appendChild(ov);
    ov.onclick = (e) => { if (e.target === ov || e.target.dataset?.a === 'close') ov.remove(); };
    eqPost('/view', { eq }).then((r) => { if (!r.ok) throw 0; ov.querySelector('.eqmain').innerHTML = invPanel(r.j, 'Ekwipunek: ' + nick); })
      .catch(() => { ov.querySelector('.eqmain').textContent = 'Nie udało się pobrać ekwipunku.'; });
  }
  // Legenda gry: rzadkości przedmiotów i klas afiksów (bez listy samych afiksów)
  function openLegend() {
    const ov = document.createElement('div'); ov.className = 'eqo';
    const r = (c, n, d) => `<div class="lgr"><b style="color:${c}">${n}</b><span>${d}</span></div>`;
    ov.innerHTML = `<div class="eqbox" style="width:min(380px,calc(100vw - 32px))"><h3 style="margin:0 0 10px">Legenda · przedmioty</h3>
      <h4>Rzadkość przedmiotów</h4>
      ${r(COL.n, 'Normalny', '+0.1x mnożnika')}${r(COL.m, 'Magiczny', '+0.1x mnożnika i 1 afiks')}${r(COL.r, 'Rzadki', '+0.1x mnożnika i 2 afiksy')}${r(COL.u, 'Unikat', '+0.3x mnożnika, 3 losowe afiksy (w tym gwarantowany boski) i unikatowa cecha')}${r(COL.u, 'Korona Króla Forum', 'unikatowy hełm: piłeczka z awatarem kogoś z top 10 ostatnich 24 h dostaje +1.0x (1. miejsce), +0.6x (2–3), +0.3x (4–10)')}${r(COL.u, 'Kapcie Moderatora', 'unikatowe buty: raz na grę kliknięcie w dowolne miejsce ekranu liczy się jako podbicie')}
      <h4>Klasy afiksów</h4>
      <div class="lgr"><b class="t-slaby">słaby</b><span>55%</span></div><div class="lgr"><b class="t-dobry">dobry</b><span>35%</span></div><div class="lgr"><b class="t-znakomity">znakomity</b><span>7%</span></div><div class="lgr"><b class="t-boski">boski</b><span>3%</span></div>
      <h4>Zestaw</h4><div class="lgr"><b style="color:#3fd13f">2 / 3 / 4</b><span>rzadkie lub unikaty z awatarem tej samej osoby: +0.2x / +0.5x / +0.5x</span></div>
      <h4>Magic find</h4><div class="lgr"><span>Zwiększa szansę na magiczne i rzadkie kosztem normalnych. Rośnie z wynikiem gry, a do tego dochodzi „szansa na rzadszy przedmiot” z przedmiotów (wartości się sumują).</span></div>
      <p class="mute" style="font-size:12px;margin:10px 0 0">Przedmiot może wypaść po grze od 15 pkt — im więcej punktów, tym częściej i tym rzadszy.</p>
      <div class="row" style="margin-top:12px"><button data-a="close">Zamknij</button></div></div>`;
    document.body.appendChild(ov);
    ov.onclick = (e) => { if (e.target === ov || e.target.dataset?.a === 'close') ov.remove(); };
  }
  const fmtKey = (k) => k.match(/.{4}/g).join('-');
  function openInv() {
    const ov = document.createElement('div'); ov.className = 'eqo';
    const z = Math.min(1, (innerWidth - 48) / 420);
    ov.innerHTML = `<div class="eqbox" style="width:${Math.round(420 * z)}px"><div class="eqz" style="zoom:${z}"><div class="eqmain">Ładowanie…</div></div>
      <div class="eqpend"></div>
      <div class="eqtool"><h4>Narzędzie testowe</h4></div>
      <div class="eqcode"><h4>Kod przenoszenia</h4><div class="kc"><code></code><button data-a="copy">Kopiuj</button></div>
      <div class="warn">Nie pokazuj nikomu — kto zna kod, ma Twój ekwipunek. Wyczyszczenie przeglądarki bez zapisanego kodu = utrata.</div>
      <div class="kc"><input autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Wklej kod z innego urządzenia" maxlength="60"><button data-a="load">Wczytaj</button></div><div class="msg"></div></div>
      <div class="row"><button data-a="close">Zamknij</button></div></div>`;
    document.body.appendChild(ov);
    const $q = (s) => ov.querySelector(s), msg = $q('.eqcode .msg'); let state = null;
    const show = (st) => {
      state = st; $q('.eqmain').innerHTML = invPanel(st);
      { const k = fmtKey(getKey()), h = Math.ceil(k.length / 2); $q('.eqcode code').textContent = k.slice(0, h) + k.slice(h).replace(/[0-9a-f]/g, '•'); } // druga połowa ukryta; „Kopiuj” kopiuje całość
      const pe = $q('.eqpend');
      pe.innerHTML = ''; // nierozstrzygnięty przedmiot nie trafia do ekwipunku — decyzja tylko w oknie końca gry
    };
    const load = () => eqPost('/inv', { key: getKey() }).then((r) => { if (!r.ok) throw 0; show(r.j); }).catch(() => { $q('.eqmain').textContent = 'Nie udało się pobrać ekwipunku.'; });
    load();
    // narzędzie testowe: zakłada dowolny przedmiot (endpoint /grant działa tylko na funkcji testowej)
    const tool = $q('.eqtool'), opt = (v, t) => `<option value="${v}">${esc(t)}</option>`;
    const affOpts = Object.entries(AFF).map(([id, a]) => opt(id, `${a[0] === 'p' ? 'prefiks' : 'sufiks'}: ${a[1]}`)).join('');
    const valOpts = (id) => { const [, , lo, hi, st] = AFF[id]; let o = ''; for (let i = 0, n = Math.round((hi - lo) / st); i <= n; i++) { const v = +(lo + i * st).toFixed(2); o += opt(v, String(v)); } return o; };
    tool.insertAdjacentHTML('beforeend', `<div class="kc"><select data-t="slot">${Object.entries(SLOT).map(([k, v]) => opt(k, v[0])).join('')}</select><select data-t="rar">${Object.entries(RAR).map(([k, v]) => opt(k, v)).join('')}</select></div>
      ${[1, 2].map((n) => `<div class="kc" data-r="${n}"><select data-t="a${n}">${affOpts}</select><select data-t="v${n}"></select></div>`).join('')}
      <div class="kc"><button data-t="go">Załóż</button></div><div class="msg"></div>`);
    const tq = (k) => tool.querySelector(`[data-t="${k}"]`), nAff = () => ({ n: 0, m: 1, r: 2, u: 0 }[tq('rar').value]);
    const syncTool = () => { tool.querySelectorAll('[data-r]').forEach((r) => { r.hidden = +r.dataset.r > nAff(); }); };
    [1, 2].forEach((n) => { tq('a' + n).onchange = () => { tq('v' + n).innerHTML = valOpts(tq('a' + n).value); }; tq('a' + n).value = n === 1 ? 'ostry' : 'serii'; tq('a' + n).onchange(); });
    tq('rar').onchange = syncTool; syncTool();
    tq('go').onclick = () => {
      const affixes = [1, 2].slice(0, nAff()).map((n) => ({ id: tq('a' + n).value, v: +tq('v' + n).value }));
      if (new Set(affixes.map((a) => a.id)).size < affixes.length) { tool.querySelector('.msg').textContent = 'Afiksy muszą być różne.'; return; }
      tool.querySelector('.msg').textContent = 'Zakładam…';
      eqPost('/grant', { key: getKey(), slot: tq('slot').value, rarity: tq('rar').value, affixes })
        .then((r) => { if (!r.ok) throw r.j?.error || 0; tool.querySelector('.msg').textContent = 'Założono.'; show(r.j); }).catch((e) => { tool.querySelector('.msg').textContent = typeof e === 'string' ? e : 'Błąd sieci.'; });
    };
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    ov.querySelectorAll('button[data-a]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.a === 'close') ov.remove();
      else if (b.dataset.a === 'copy') { navigator.clipboard?.writeText(fmtKey(getKey())).then(() => msg.textContent = 'Skopiowano.', () => msg.textContent = 'Nie udało się skopiować — zaznacz kod ręcznie.'); }
      else if (b.dataset.a === 'load') {
        const k = $q('.eqcode input').value.toLowerCase().replace(/[\s-]/g, '');
        if (!/^[0-9a-f]{32}$/.test(k)) { msg.textContent = 'Zły kod (32 znaki 0-9, a-f).'; return; }
        if (k === getKey()) { msg.textContent = 'To już ten sam kod.'; return; }
        if (state && (state.pending || Object.values(state.slots || {}).some(Boolean)) && !confirm('Ten ekwipunek ma przedmioty — po wczytaniu kodu przepadną (chyba że masz zapisany jego kod). Na pewno?')) return;
        ls.set('eqKey', k); $q('.eqcode input').value = ''; msg.textContent = 'Wczytano.'; $q('.eqmain').textContent = 'Ładowanie…'; load();
      }
    }));
  }
  if (TEST) {
    const eqCss = document.createElement('style');
    eqCss.textContent = `
    #over .box.wide{width:min(380px,calc(100vw - 32px));max-height:calc(100vh - 16px);overflow:auto}
    .eqdrop{margin-top:14px;padding-top:12px;border-top:1px solid var(--line);font-size:14px}.eqdrop .eqbody{margin-top:6px}
    .seeinv{display:inline-block;margin-top:4px;font-size:12.5px;color:var(--acc)}
    .eqres{display:flex;align-items:center;justify-content:center;gap:8px;margin:6px 0;font-size:14px}.eqres .eqit{width:54px;height:54px}
    .eqit{position:relative;width:78px;height:78px}
    .eqav{position:absolute;inset:8%;border-radius:50%;background:#222 center/cover;border:3px solid;display:grid;place-items:center;font-weight:800;color:#ecebe6}
    .eqit .eqav{border-color:#c8c8c8}.eqit.q-m .eqav{border-color:#6c8cff;box-shadow:0 0 10px rgba(108,140,255,.6)}.eqit.q-r .eqav{border-color:#f2d24b;box-shadow:0 0 12px rgba(242,210,75,.7)}
    .eqov{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible}
    .eqname{font-size:11.5px;font-weight:700;text-align:center;line-height:1.2}
    .eqcmp{display:flex;gap:10px;align-items:center;justify-content:center;margin:8px 0 12px}.eqcmp .arr{font-size:22px;color:var(--mute)}
    .eqc{background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:8px;display:flex;flex-direction:column;align-items:center;width:120px}
    .eqc .tag{font-size:10.5px;color:var(--mute);margin-bottom:4px}
    .eqdrop .row,.eqbox>.row{display:flex;gap:8px;justify-content:center}
    .eqdrop .pri{background:var(--acc);border-color:var(--acc);color:#fff}
    .eqdrop .msg,.eqcode .msg{font-size:12px;color:var(--mute);min-height:16px;margin-top:6px;text-align:center}
    .eqo{position:fixed;inset:0;z-index:71;display:grid;place-items:center;background:rgba(0,0,0,.45);overflow:auto}
    .eqbox{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;max-width:calc(100vw - 34px);max-height:calc(100vh - 34px);overflow:auto;box-sizing:content-box}
    .eqbox .eqpend{margin-bottom:6px}
    .eqcode{margin:14px 0 12px;font-size:13px}.eqcode h4{margin:0 0 6px;font-size:13px;color:var(--mute);text-transform:uppercase;letter-spacing:.05em}
    .eqcode .kc{display:flex;gap:6px;align-items:center;margin:6px 0}.eqcode code{flex:1;min-width:0;font-size:13px;user-select:all;word-break:break-all;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:5px 8px}
    .eqcode input{flex:1;min-width:0}
    .eqcode .warn{font-size:12px;color:#e0764f}
    .eqinv{position:relative;width:420px;height:400px;border-radius:6px;background:radial-gradient(ellipse at 30% 20%,rgba(255,255,255,.05),transparent 60%),repeating-linear-gradient(115deg,rgba(255,255,255,.015) 0 2px,transparent 2px 7px),linear-gradient(#3a3835,#2a2826);border:3px solid #56514a;box-shadow:inset 0 0 0 2px #1b1a18,inset 0 0 40px rgba(0,0,0,.6);box-sizing:border-box;color:#ecebe6}
    .eqinv h3{margin:0;padding:12px 0 6px;text-align:center;font:600 20px Georgia,'Times New Roman',serif;letter-spacing:.28em;color:#c9b98f;text-shadow:0 1px 0 #000}
    .lgr{display:flex;gap:10px;align-items:baseline;padding:3px 0;font-size:13px}.lgr b{min-width:80px}.lgr span{color:var(--mute)}.eqbox h4{margin:12px 0 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--mute)}
    .tier{display:block;font-size:10px;opacity:.85;margin:-1px 0 3px}.t-slaby{color:#9a9892}.t-dobry{color:#8fb3ff}.t-znakomity{color:#c38bff;text-shadow:0 0 6px rgba(160,90,255,.9)}.t-boski{color:#ff5a4a;text-shadow:0 0 7px rgba(255,40,30,.95)}
    .eqslot.setg{outline:2px solid #3fd13f;outline-offset:2px;box-shadow:inset 0 0 0 2px #000,0 0 14px rgba(63,209,63,.7)!important}
    .eqslot{position:absolute;box-sizing:border-box;background:#0d0d0c;border:2px solid #4a463f;box-shadow:inset 0 0 0 2px #000,inset 0 0 18px rgba(0,0,0,.9);display:grid;place-items:center}
    .eqslot .eqit{width:86px;height:86px}
    .eqslot .eqname{position:absolute;top:100%;margin-top:3px;left:50%;transform:translateX(-50%);width:130px;text-shadow:0 1px 2px #000}
    .eqslot.empty::after{content:attr(data-l);color:#5a564f;font:12px Georgia,serif;letter-spacing:.1em}
    .eqit.q-u .eqav{border-color:#c7864a;box-shadow:0 0 12px rgba(199,134,74,.75)}
    .eqslot.q-u{border-color:#a8692f;box-shadow:inset 0 0 0 2px #000,inset 0 0 22px rgba(199,134,74,.28)}
    .eqsum{margin-top:10px;padding:8px 12px;border:1px solid var(--line);border-radius:10px;font-size:12.5px;background:var(--bg)}.eqsum h4,.eqtool h4{margin:0 0 4px;font-size:12px;color:var(--mute);text-transform:uppercase;letter-spacing:.05em}.eqsum .mute{color:var(--mute)}
    .eqtool{margin:12px 0;font-size:13px}.eqtool .kc{display:flex;gap:6px;margin:5px 0}.eqtool select{flex:1;min-width:0;font:inherit;padding:4px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink)}.eqtool .msg{font-size:12px;color:var(--mute);min-height:16px}
    .pil li.clk{cursor:pointer;border-radius:6px}.pil li.clk:hover{background:var(--bg)}
    #eqtip{position:fixed;z-index:95;pointer-events:none;background:rgba(10,10,9,.95);border:1px solid #56514a;border-radius:4px;padding:8px 12px;font-size:12.5px;line-height:1.4;color:#ecebe6;max-width:260px;text-align:center;box-shadow:0 4px 16px rgba(0,0,0,.6)}
    #eqtip .tn{font:700 14px Georgia,serif}#eqtip .ts{color:#9a9892}#eqtip .tg{color:#9a9892;margin-top:4px}#eqtip .tb{color:#8f9bff}
    .eqslot.q-n{border-color:#6d6a64}.eqslot.q-m{border-color:#4a5fb8;box-shadow:inset 0 0 0 2px #000,inset 0 0 22px rgba(80,110,255,.25)}.eqslot.q-r{border-color:#b89a2c;box-shadow:inset 0 0 0 2px #000,inset 0 0 22px rgba(242,210,75,.22)}`;
    document.head.appendChild(eqCss);
    const defs = document.createElement('div');
    defs.innerHTML = `<svg width="0" height="0" style="position:absolute"><defs>
      <symbol id="eq-helm" viewBox="0 0 78 78"><path d="M8 38 C8 12 70 12 70 38 L70 34 C64 30 14 30 8 34Z" fill="currentColor"/><path d="M6 36 C6 8 72 8 72 36 L64 36 C62 18 16 18 14 36Z" fill="currentColor"/><rect x="36" y="14" width="6" height="30" rx="2" fill="currentColor"/><path d="M14 36 C16 18 62 18 64 36" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="2"/></symbol>
      <symbol id="eq-armor" viewBox="0 0 78 78"><path d="M2 30 Q10 20 20 26 L20 40 Q8 42 2 30Z M76 30 Q68 20 58 26 L58 40 Q70 42 76 30Z" fill="currentColor"/><path d="M14 50 Q39 66 64 50 L62 76 L16 76Z" fill="currentColor"/><path d="M26 58 L39 72 L52 58" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="2"/></symbol>
      <symbol id="eq-gloves" viewBox="0 0 78 78"><g fill="currentColor"><path d="M0 44 q0-10 6-12 l1-10 q2-3 4 0 l1 8 1-10 q2-3 4 0 l0 10 1-8 q2-3 4 0 l0 12 q2 10-6 18 l-12 0z"/><path d="M78 44 q0-10-6-12 l-1-10 q-2-3-4 0 l-1 8-1-10 q-2-3-4 0 l0 10-1-8 q-2-3-4 0 l0 12 q-2 10 6 18 l12 0z"/></g></symbol>
      <symbol id="eq-boots" viewBox="0 0 78 78"><g fill="currentColor"><path d="M14 56 h14 v10 q0 4 4 5 l4 1 v5 h-24 q-2 0-2-3z"/><path d="M50 56 h14 v19 q0 3-2 3 h-24 v-5 l4-1 q4-1 4-5z"/></g><path d="M14 66 h14 M50 66 h14" stroke="#000" stroke-opacity=".35" stroke-width="2"/></symbol>
    </defs></svg>`;
    document.body.appendChild(defs.firstChild);
    // Przycisk pod kartą rankingu (karta rankingu pojawia się dopiero po pierwszej grze, przycisk jest zawsze)
    const eqCard = document.createElement('div'); eqCard.className = 'card';
    eqCard.innerHTML = '<button id="eqBtn" style="width:100%">Ekwipunek</button>';
    card.after(eqCard);
    eqCard.querySelector('#eqBtn').onclick = openInv;
    const tip = document.createElement('div'); tip.id = 'eqtip'; tip.hidden = true; document.body.appendChild(tip);
    let tipFor = null;
    const hideTip = () => { tip.hidden = true; tipFor = null; };
    const showTip = (el) => {
      const it = ITEMS[el.dataset.tid]; if (!it) return;
      tip.innerHTML = tipHtml(it); tip.hidden = false; tipFor = el;
      const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
      let x = r.right + 8; if (x + w > innerWidth - 6) x = r.left - w - 8; if (x < 6) x = Math.max(6, Math.min(innerWidth - w - 6, r.left + r.width / 2 - w / 2));
      tip.style.left = x + 'px'; tip.style.top = Math.max(6, Math.min(innerHeight - h - 6, r.top)) + 'px';
    };
    const tidEl = (e) => e.target.closest?.('[data-tid]');
    if (!TOUCH) { // komputer: najechanie; telefon: dotknięcie pokazuje/ukrywa
      document.addEventListener('mouseover', (e) => { const el = tidEl(e); if (el) showTip(el); else if (!tip.hidden) hideTip(); });
    } else {
      document.addEventListener('click', (e) => { const el = tidEl(e); if (el && el !== tipFor) showTip(el); else hideTip(); }, true);
    }
    document.getElementById('pil')?.addEventListener('click', (e) => { const li = e.target.closest('li[data-eq]'); if (li) openView(li.dataset.eq, li.dataset.nick); });
    eqPost('/inv', { key: getKey() }).catch(() => {}); // bonusy z założonych przedmiotów od razu po wejściu na stronę
  }

  // --- pętla ---
  let last = performance.now(), acc = 0;
  function loop(t) {
    const dt = Math.min(.05, (t - last) / 1000); last = t;
    acc += dt; if (acc > 2.2) { acc = 0; spawn(); }
    for (const f of flakes) {
      if (game && game.f === f) {
        const sd = dt * speedOf(game.lvl) * (game.slow > t ? .45 : 1); // po odbiciu od dołu chwilowe spowolnienie
        f.vy += G * (1 - game.B.ciezki) * game.k * sd; f.x += f.vx * sd; f.y += f.vy * sd; f.rot += f.vr * sd;
        const A = TOUCH ? { l: 0, r: W } : arena();
        if (f.x < A.l) { f.x = A.l; f.vx = Math.abs(f.vx) * .8; }
        if (f.x > A.r - f.size) { f.x = A.r - f.size; f.vx = -Math.abs(f.vx) * .8; }
        if (f.y < 0) { f.y = 0; f.vy = Math.abs(f.vy) * .3; }
        if (!TOUCH && (H < MIN_H || W < H * ASPECT)) { game = null; document.body.classList.remove('playing'); hideMult(); hud.hidden = true; f.el.remove(); flakes.clear(); flash('Okno za małe — gra przerwana'); break; }
        if (f.y > H + 10) {
          if (game.saves > 0) { game.saves--; f.y = H - f.size; f.vx = 0; f.vy = -Math.sqrt(2 * G * (1 - game.B.ciezki) * game.k * H * .55); game.slow = t + 1600; // wysoko, prosto w górę i wolniej — łatwo kliknąć
            flash(`🛡 Odbicie od dołu zużyte! Zostało w tej grze: ${game.saves}`); saveFx(); }
          else { endGame(); break; }
        }
      } else {
        f.ph += dt; f.y += f.vy * dt; f.rot += f.vr * dt;
        if (f.y > H + 20) { f.el.remove(); flakes.delete(f); continue; }
      }
      const sx = game && game.f === f ? 0 : Math.sin(f.ph) * f.sway;
      f.el.style.transform = `translate(${f.x + sx}px,${f.y}px) rotate(${f.rot}deg)`;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
