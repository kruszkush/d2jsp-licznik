// Spadające awatary + gra w podbijanie awatara. Ranking wspólny (funkcja w Google Cloud).
(() => {
  const API = 'https://pileczka-i3odn44x6q-ue.a.run.app';
  const COLORS = ['#e0a526', '#5b8def', '#d9667a', '#4fb286', '#9b5de5', '#e07a3f'];
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const css = document.createElement('style');
  css.textContent = `
  #snow{position:fixed;inset:0;pointer-events:none;z-index:40;overflow:hidden}
  .flake{position:absolute;top:0;left:0;border-radius:50%;background:var(--card) center/cover no-repeat;border:2px solid;display:grid;place-items:center;font-weight:700;color:var(--ink);pointer-events:auto;cursor:pointer;user-select:none;opacity:.85;will-change:transform;box-shadow:0 2px 8px rgba(0,0,0,.2)}
  .flake:hover{opacity:1}
  .flake.ball{opacity:1;z-index:2;box-shadow:0 8px 20px rgba(0,0,0,.35)}
  #hud{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:60;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:6px 18px;font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;box-shadow:0 6px 18px rgba(0,0,0,.25);pointer-events:none}
  #hud small{font-size:12px;font-weight:500;color:var(--mute);margin-left:6px}
  #over{position:fixed;inset:0;z-index:70;display:grid;place-items:center;background:rgba(0,0,0,.45)}
  #over .box{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;width:min(320px,calc(100vw - 32px));text-align:center}
  #over h3{margin:0 0 4px;font-size:18px}#over .sc{font-size:44px;font-weight:800;margin:4px 0 12px}
  #over input{width:100%;margin-bottom:10px;text-align:center}
  #over .row{display:flex;gap:8px;justify-content:center}
  #over button.pri{background:var(--acc);border-color:var(--acc);color:#fff}
  #over .msg{font-size:12px;color:var(--mute);min-height:16px;margin-top:8px}
  #snowBtn{position:fixed;left:12px;bottom:12px;z-index:45;font-size:12px;padding:4px 10px;opacity:.75}
  body.playing{user-select:none;-webkit-user-select:none}
  body.playing .wrap{pointer-events:none}
  .pil li{list-style:none;display:flex;gap:8px;padding:5px 0;border-bottom:1px solid var(--line);font-size:14px}
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
  card.innerHTML = '<h3>Piłeczka · ranking</h3><ul class="pil" id="pil"><li class="empty">Ładowanie…</li></ul>';
  fameCard?.after(card);
  function showRank(top) {
    card.hidden = false;
    const me = (ls.get('pilNick') || '').toLowerCase();
    document.getElementById('pil').innerHTML = top.length ? top.map((r, i) => `<li class="${r.nick.toLowerCase() === me ? 'me' : ''}"><span style="width:22px;color:var(--mute)">${i + 1}.</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.nick)}</span><b>${r.score}</b></li>`).join('') : '<li class="empty">Jeszcze nikt nie zagrał.</li>';
  }
  const loadRank = () => fetch(API).then((r) => r.json()).then((j) => showRank(j.top || [])).catch(() => {});
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
    const size = 80;
    const f = { u, size, x: Math.random() * (W - size), y: -size - 10, vy: 28 + Math.random() * 30, sway: 20 + Math.random() * 30, ph: Math.random() * 6.28, rot: 0, vr: (Math.random() - .5) * 40 };
    f.el = makeEl(u, size);
    f.el.addEventListener('pointerdown', (e) => { e.preventDefault(); game ? hit(f, e) : startGame(f, e); });
    flakes.add(f);
  }
  const clearFlakes = () => { for (const f of flakes) f.el.remove(); flakes.clear(); };

  // --- gra ---
  const G = 1500, JUMP = 720;
  const hud = document.createElement('div'); hud.id = 'hud'; hud.hidden = true; document.body.appendChild(hud);
  function startGame(f, e) {
    for (const o of flakes) if (o !== f) o.el.remove();
    flakes.clear(); flakes.add(f);
    game = { f, score: 0 }; f.el.classList.add('ball');
    document.body.classList.add('playing'); getSelection()?.removeAllRanges(); const pie = document.getElementById('pie'); if (pie) pie.hidden = true; f.vx = 0; f.vy = 0;
    hit(f, e);
  }
  function hit(f, e) {
    if (!game || game.f !== f) return;
    game.score++;
    const r = f.el.getBoundingClientRect(), off = ((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) || 0;
    f.vy = -(JUMP + Math.min(game.score * 6, 240));
    f.vx = Math.max(-420, Math.min(420, -off * 320 + (Math.random() - .5) * 120));
    f.vr = -off * 360;
    hud.hidden = false; hud.innerHTML = `${game.score}<small>podbić</small>`;
  }
  function endGame() {
    const score = game.score, f = game.f; game = null; document.body.classList.remove('playing');
    f.el.remove(); flakes.clear(); hud.hidden = true;
    const ov = document.createElement('div'); ov.id = 'over';
    ov.innerHTML = `<div class="box"><h3>Koniec gry!</h3><div class="sc">${score}</div>
      <input id="pilNick" maxlength="20" placeholder="Twój nick" value="${esc(ls.get('pilNick') || '')}">
      <div class="row"><button class="pri" id="pilSave">Zapisz wynik</button><button id="pilClose">Zamknij</button></div><div class="msg" id="pilMsg"></div></div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.querySelector('#pilClose').onclick = close;
    const save = () => {
      const nick = ov.querySelector('#pilNick').value.trim();
      if (!nick) { ov.querySelector('#pilMsg').textContent = 'Wpisz nick.'; return; }
      ls.set('pilNick', nick); ls.set('pilGral', '1');
      ov.querySelector('#pilMsg').textContent = 'Zapisuję…';
      fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nick, score }) })
        .then((r) => r.json()).then((j) => { if (j.top) { showRank(j.top); close(); card.scrollIntoView({ behavior: 'smooth', block: 'center' }); } else ov.querySelector('#pilMsg').textContent = j.error || 'Błąd zapisu.'; })
        .catch(() => { ov.querySelector('#pilMsg').textContent = 'Nie udało się zapisać, spróbuj jeszcze raz.'; });
    };
    ov.querySelector('#pilSave').onclick = save;
    ov.querySelector('#pilNick').addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    setTimeout(() => ov.querySelector('#pilNick').focus(), 50);
  }

  // --- pętla ---
  let last = performance.now(), acc = 0;
  function loop(t) {
    const dt = Math.min(.05, (t - last) / 1000); last = t;
    acc += dt; if (acc > 2.2) { acc = 0; spawn(); }
    for (const f of flakes) {
      if (game && game.f === f) {
        f.vy += G * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
        if (f.x < 0) { f.x = 0; f.vx = Math.abs(f.vx) * .8; }
        if (f.x > W - f.size) { f.x = W - f.size; f.vx = -Math.abs(f.vx) * .8; }
        if (f.y < 0) { f.y = 0; f.vy = Math.abs(f.vy) * .3; }
        if (f.y > H + 10) { endGame(); break; }
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
