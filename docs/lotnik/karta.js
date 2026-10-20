// karta.js — zawartość karty końca gry: wynik z nickiem, tabelka Magic Find, przedmiot w stylu Diablo 2.
// nakladka.js składa kartę i podpina zdarzenia; tu tylko rysowanie (DOM) z danych. Ramka przedmiotu
// (`itemBox`) jest wspólna dla dropu i panelu Ekwipunek.
import { RARITY, TYPES, TIERS, AFFIXES, AFFIX_CHAIN, LEGACY_TYPE, affixLine, affixRange, tierRange, itemName, rarityChances, mfFromMeters } from './items.js?v=55';

export const KARTA_CSS = `
.lotnik-card .lt-hero{flex:none;position:relative;margin:-18px -16px 0;padding:14px 16px 14px;isolation:isolate;overflow:hidden}
.lotnik-card .lt-who{display:flex;align-items:center;justify-content:center;gap:8px;font-size:15px;font-weight:800}
.lotnik-card .lt-who .lt-acc-nick{margin:0;min-width:0;font-size:15px}
.lotnik-card .lt-who .lt-acc-nick>a,.lotnik-card .lt-who .lt-acc-nick>span:not(.lt-av):not(.lt-ver){min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lotnik-card .lt-who .lt-av{width:30px;height:30px}
.lotnik-card .lt-guest{display:flex;align-items:center;gap:8px;color:#94a3b8;font-weight:700}
.lotnik-card .lt-guest .lt-av{display:grid;place-items:center;font-size:14px;color:#94a3b8;background:#1e293b}
.lotnik-card .lt-acc-nick:not([hidden])+.lt-guest{display:none}
.lotnik-card .lt-hscore{font-size:46px;font-weight:900;line-height:1;margin-top:10px;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:#f8fafc;white-space:nowrap}
.lotnik-card .lt-hscore small{font-size:.5em;font-weight:800;margin-left:4px;color:#94a3b8}
.lotnik-card .lt-prog{margin:12px 6px 0}
.lotnik-card .lt-prog-track{position:relative;height:8px;border-radius:99px;background:rgba(148,163,184,.18)}
.lotnik-card .lt-prog-fill{position:absolute;inset:0 auto 0 0;border-radius:99px;background:linear-gradient(90deg,#64748b,#cbd5e1)}
.lotnik-card .lt-prog-flag{position:absolute;right:-2px;top:50%;translate:0 -50%;font-size:13px}
.lotnik-card .lt-prog-lbl{display:flex;justify-content:space-between;margin-top:6px;font-size:12px;color:#94a3b8}
.lotnik-card .lt-prog-lbl b{color:#fbbf24;font-weight:800}
.lotnik-card .lt-hero.lt-rec{background:radial-gradient(120% 90% at 50% 0%,rgba(251,191,36,.28),rgba(251,191,36,.06) 55%,transparent 80%);border-bottom:1px solid rgba(251,191,36,.25)}
.lotnik-card .lt-hero.lt-rec::before{content:"";position:absolute;left:50%;top:58%;width:520px;height:520px;margin:-260px 0 0 -260px;z-index:-1;opacity:.22;pointer-events:none;
  background:repeating-conic-gradient(from 0deg,rgba(251,191,36,.9) 0 6deg,transparent 6deg 18deg);
  -webkit-mask:radial-gradient(circle,#000 0,transparent 62%);mask:radial-gradient(circle,#000 0,transparent 62%);animation:lt-spin 40s linear infinite}
@keyframes lt-spin{to{transform:rotate(360deg)}}
.lotnik-card .lt-kick{margin-top:12px;font-size:25px;font-weight:900;letter-spacing:.16em;line-height:1;text-transform:uppercase;white-space:nowrap;
  background:linear-gradient(100deg,#f59e0b 20%,#fff7d1 45%,#fde68a 52%,#f59e0b 75%);background-size:250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 2px 10px rgba(251,191,36,.45));animation:lt-shine 3.2s ease-in-out infinite,lt-hpop .55s cubic-bezier(.2,1.6,.4,1) both}
.lotnik-card .lt-kick i{font-style:normal;font-size:.62em;vertical-align:.2em;-webkit-text-fill-color:#fbbf24;margin:0 .35em}
@keyframes lt-shine{0%{background-position:120% 0}60%,100%{background-position:-30% 0}}
@keyframes lt-hpop{from{transform:scale(.6);opacity:0}}
.lotnik-card .lt-rec .lt-hscore{font-size:58px;margin-top:6px;color:#fbbf24;text-shadow:0 0 28px rgba(251,191,36,.45),0 3px 0 #92400e;animation:lt-hpop .6s .12s cubic-bezier(.2,1.5,.4,1) both}
.lotnik-card .lt-rec .lt-hscore small{color:#fcd34d}
.lotnik-card .lt-delta{display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:4px 11px;border-radius:999px;background:rgba(34,197,94,.14);border:1px solid rgba(74,222,128,.4);color:#86efac;font-size:12px;font-weight:800}
.lotnik-card .lt-delta span{color:#94a3b8;font-weight:600}
.lotnik-card .lt-hero.lt-game{background:radial-gradient(120% 95% at 50% 0%,rgba(167,139,250,.38),rgba(34,211,238,.08) 58%,transparent 82%);border-bottom-color:rgba(167,139,250,.4)}
.lotnik-card .lt-hero.lt-game::before{width:560px;height:560px;margin:-280px 0 0 -280px;opacity:.3;animation-duration:26s;
  background:repeating-conic-gradient(from 0deg,rgba(196,181,253,.95) 0 5deg,transparent 5deg 12deg,rgba(103,232,249,.7) 12deg 15deg,transparent 15deg 24deg)}
.lotnik-card .lt-game .lt-kick{font-size:27px;letter-spacing:.13em;background-image:linear-gradient(100deg,#a78bfa 18%,#f5f3ff 44%,#67e8f9 52%,#a78bfa 78%);filter:drop-shadow(0 2px 12px rgba(167,139,250,.6))}
.lotnik-card .lt-game .lt-kick i{-webkit-text-fill-color:initial;font-size:.8em;vertical-align:.08em;margin:0 .25em}
.lotnik-card .lt-game .lt-hscore{color:#e9d5ff;text-shadow:0 0 30px rgba(167,139,250,.7),0 3px 0 #5b21b6}
.lotnik-card .lt-game .lt-hscore small{color:#c4b5fd}
.lotnik-card .lt-hsub{margin-top:6px;font-size:11px;font-weight:800;letter-spacing:.14em;color:#fcd34d;text-transform:uppercase}
.lotnik-card .lt-game .lt-delta{background:rgba(167,139,250,.16);border-color:rgba(196,181,253,.5);color:#ddd6fe}
.lotnik-card .lt-rank{display:flex;flex-direction:column;align-items:center;gap:5px;margin:10px auto 0;padding:7px 12px;max-width:290px;box-sizing:border-box;border-radius:12px;background:rgba(15,23,42,.55);border:1px solid rgba(148,163,184,.25);font-size:12px;color:#cbd5e1}
.lotnik-card .lt-rank1{display:flex;align-items:center;gap:7px}
.lotnik-card .lt-rank-pl{font-size:16px;font-weight:900;color:#f8fafc;font-variant-numeric:tabular-nums}
.lotnik-card .lt-rank-up{padding:1px 7px;border-radius:999px;background:rgba(34,197,94,.16);border:1px solid rgba(74,222,128,.4);color:#86efac;font-size:11px;font-weight:800}
.lotnik-card .lt-rank2{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:5px;color:#94a3b8;max-width:100%}
.lotnik-card .lt-rank2 b{color:#e2e8f0;font-weight:800;min-width:0;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lotnik-card .lt-rank2 .lt-av{width:18px;height:18px}
.lotnik-card .lt-rank-down{color:#fca5a5;font-weight:700}
.lotnik-card .lt-rank.lt-calm{background:none;border-color:transparent;padding:2px 0 0;margin-top:6px}
.lotnik-card .lt-game .lt-rank{border-color:rgba(196,181,253,.45);background:rgba(46,16,101,.45)}
.lotnik-card .lt-game .lt-rank-pl{color:#fde68a}
.lotnik-card .lt-confetti{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:-1}
.lotnik-card .lt-confetti i{position:absolute;top:-10px;width:6px;height:10px;border-radius:1px;opacity:0;animation:lt-fall 2.6s cubic-bezier(.3,.6,.5,1) forwards}
@keyframes lt-fall{0%{opacity:1;transform:translateY(0) rotate(0)}100%{opacity:0;transform:translateY(190px) rotate(540deg)}}
.lotnik-card .lt-l1{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:6px;min-width:0}
.lotnik-card .lt-l1 .lt-who{flex:0 1 auto;min-width:0;font-size:17px}
.lotnik-card .lt-l1 .lt-who .lt-acc-nick{font-size:17px}
.lotnik-card .lt-l1 .lt-dot{flex:none;color:#64748b;font-size:22px;font-weight:900}
.lotnik-card .lt-hero .lt-l1 .lt-hscore{flex:none;margin:0;font-size:40px}
.lotnik-card .lt-hero .lt-rank{flex-direction:row;flex-wrap:wrap;justify-content:center;gap:4px 10px}
.lotnik-card .lt-hero .lt-rank-pl{font-size:22px}
.lotnik-card .lt-hero .lt-rank1{font-size:13px}
.lotnik-card .lt-drop-kick.lt-kick2{margin:16px 0 0;display:flex;align-items:center;justify-content:center;gap:8px}
.lotnik-card .lt-drop-kick.lt-kick2::before,.lotnik-card .lt-drop-kick.lt-kick2::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,transparent,rgba(182,201,214,.35))}
.lotnik-card .lt-drop-kick.lt-kick2::after{transform:scaleX(-1)}
.lotnik-card .lt-drop-kick.lt-kick2+.lt-item{margin-top:8px}
.lotnik-card .lt-eqwrap{position:relative;margin-top:11px;padding-top:11px}
.lotnik-card .lt-ribbon{position:absolute;left:50%;top:0;translate:-50% 0;z-index:2;display:flex;align-items:center;gap:6px;padding:4px 12px 4px 9px;border-radius:999px;
  background:#16a34a;border:1px solid #4ade80;color:#f0fdf4;font-size:11px;font-weight:900;letter-spacing:.12em;line-height:14px;white-space:nowrap;box-shadow:0 4px 14px rgba(22,163,74,.45);animation:lt-stamp .45s cubic-bezier(.2,1.6,.4,1) both}
.lotnik-card .lt-ribbon b{display:inline-grid;place-items:center;width:16px;height:16px;border-radius:50%;background:#f0fdf4;color:#15803d;font-size:11px;letter-spacing:0}
@keyframes lt-stamp{from{transform:scale(1.8);opacity:0}}
.lotnik-card .lt-eqwrap .lt-item{border-color:#4ade80;box-shadow:0 0 0 1px rgba(74,222,128,.25),0 0 26px rgba(74,222,128,.18)}
.lotnik-card .lt-eqnote{display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;margin-top:8px;font-size:12px;color:#94a3b8}
.lotnik-card .lt-eqnote{position:relative}
.lotnik-card .lt-eqnote .lt-old{background:none;border:0;padding:2px 2px;cursor:pointer;font:700 12px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#cbd5e1;text-decoration:underline dotted;text-decoration-color:rgba(148,163,184,.7);text-underline-offset:3px}
.lotnik-card .lt-eqnote .lt-old i{font-style:normal;margin-left:4px;display:inline-block;transition:transform .15s}
.lotnik-card .lt-eqnote.open .lt-old i{transform:rotate(180deg)}
.lotnik-card .lt-eqnote>.lt-cur-open{flex:1 0 100%;margin-top:4px}
.lotnik-card .lt-old-tip{left:0;right:0}
.lotnik-card .lt-eqnote .lt-arrow{color:#64748b}
.lotnik-card .lt-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;background:rgba(59,130,246,.15);border:1px solid rgba(96,165,250,.4);color:#bfdbfe;font-weight:700;font-size:11px}
.lotnik-card .lt-oldx{min-width:24px;height:24px;box-sizing:border-box;border-radius:12px;border:2px solid #f87171;background:#7f1d1d;color:#fef2f2;padding:0 6px;font:900 12px/1 system-ui,sans-serif;cursor:pointer;white-space:nowrap}
.lotnik-card .lt-oldx.ask{background:#dc2626;font-size:11px}
.lotnik-card .lt-oldx:disabled{opacity:.4;cursor:default}
@media (max-height:700px){
.lotnik-card .lt-hero{padding:10px 16px 10px}
.lotnik-card .lt-kick{font-size:18px;margin-top:8px}
.lotnik-card .lt-hscore,.lotnik-card .lt-rec .lt-hscore{font-size:40px;margin-top:6px}
.lotnik-card .lt-hero.lt-rec::before{display:none}
.lotnik-card .lt-delta{margin-top:6px}
.lotnik-card .lt-prog{margin-top:8px}
.lotnik-card .lt-game .lt-kick{font-size:19px}
.lotnik-card .lt-hsub{margin-top:4px;font-size:10px}
.lotnik-card .lt-rank{margin-top:7px;padding:5px 10px;gap:3px}
}
@media (orientation:landscape) and (max-height:520px){
.lotnik-card .lt-hero{margin:0;padding:6px 8px 8px;border-radius:12px}
.lotnik-card .lt-who{font-size:13px}
.lotnik-card .lt-who .lt-acc-nick{font-size:13px}
.lotnik-card .lt-who .lt-av{width:24px;height:24px}
.lotnik-card .lt-hcore{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:center;column-gap:10px}
.lotnik-card .lt-hcore>.lt-deltaw,.lotnik-card .lt-hcore>.lt-prog,.lotnik-card .lt-hcore>.lt-rank,.lotnik-card .lt-hcore>.lt-hsub{flex:1 0 100%}
.lotnik-card .lt-game .lt-kick{font-size:16px}
.lotnik-card .lt-hsub{margin-top:2px;font-size:9px}
.lotnik-card .lt-rank{margin-top:5px;padding:3px 8px;gap:2px;font-size:11px;max-width:none}
.lotnik-card .lt-kick{font-size:15px;margin-top:6px;letter-spacing:.1em}
.lotnik-card .lt-hscore,.lotnik-card .lt-rec .lt-hscore{font-size:32px;margin-top:4px}
.lotnik-card .lt-delta{margin-top:5px;padding:2px 9px;font-size:11px}
.lotnik-card .lt-prog{margin-top:6px}
.lotnik-card .lt-l1{flex:1 0 100%;margin-top:4px}
.lotnik-card .lt-hero .lt-l1 .lt-hscore{font-size:30px}
.lotnik-card .lt-l1 .lt-who,.lotnik-card .lt-l1 .lt-who .lt-acc-nick{font-size:14px}
.lotnik-card .lt-hero .lt-rank-pl{font-size:18px}
}
@media (prefers-reduced-motion:reduce){
.lotnik-card .lt-hero.lt-rec::before,.lotnik-card .lt-kick,.lotnik-card .lt-hscore,.lotnik-card .lt-ribbon{animation:none}
.lotnik-card .lt-confetti{display:none}
}
.lotnik-card .lt-mf{margin-top:12px;padding:4px 12px 6px;border:1px solid rgba(248,250,252,.18);border-radius:10px;background:rgba(255,255,255,.05);text-align:left}
.lotnik-card .lt-mf-head{display:flex;justify-content:space-between;align-items:baseline;padding:6px 0;font-size:15px;font-weight:800;color:#f8fafc}
.lotnik-card .lt-mf-head b{color:#fbbf24;font-size:17px}
.lotnik-card .lt-mfr{display:flex;justify-content:space-between;padding:5px 0;border-top:1px solid rgba(248,250,252,.09);font-size:13px}
.lotnik-card .lt-mfr span{font-weight:700;color:#cbd5e1}
.lotnik-card .lt-mfr b{color:#f8fafc;font-variant-numeric:tabular-nums}
.lotnik-card .lt-mf-low{padding:5px 0;border-top:1px solid rgba(248,250,252,.09);font-size:12px;color:#94a3b8}
.lotnik-card .lt-drop{margin-top:12px}
.lotnik-card .lt-drop-kick{font-size:10px;font-weight:800;letter-spacing:.12em;color:#b6c9d6;margin-bottom:6px}
.lotnik-card .lt-cur{position:relative;margin-top:6px}
.lotnik-card .lt-current{background:none;border:0;padding:4px 8px;cursor:pointer;font:500 12px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#94a3b8}
.lotnik-card .lt-current span{font-weight:700;text-decoration:underline dotted;text-underline-offset:3px}
.lotnik-card .lt-current i{font-style:normal;margin-left:4px;display:inline-block;transition:transform .15s}
.lotnik-card .lt-cur.open .lt-current i{transform:rotate(180deg)}
.lotnik-card .lt-cur-tip{display:none;position:absolute;left:18px;right:18px;bottom:calc(100% + 4px);z-index:2;pointer-events:none;padding:8px 6px 6px;border-radius:10px;background:#0f172a;border:1px solid rgba(251,191,36,.45);box-shadow:0 10px 30px rgba(0,0,0,.85);transform-origin:50% 100%}
@keyframes lt-tip-in{from{opacity:0;transform:translateY(10px) scale(.96)}}
.lotnik-card .lt-drop>.lt-item{transition:opacity .18s,filter .18s}
@media (hover:hover){
.lotnik-card .lt-cur:not(.open):hover .lt-cur-tip{display:block;animation:lt-tip-in .18s ease-out both}
.lotnik-card .lt-drop:has(.lt-cur:not(.open):hover)>.lt-item{opacity:.25;filter:blur(1.5px)}
.lotnik-card .lt-eqnote:not(.open):has(.lt-old:hover) .lt-old-tip{display:block;animation:lt-tip-in .18s ease-out both}
.lotnik-card .lt-drop:has(.lt-eqnote:not(.open) .lt-old:hover) .lt-eqwrap>.lt-item{opacity:.25;filter:blur(1.5px)}
}
.lotnik-card .lt-cur-open{margin-top:2px}
.lotnik-card .lt-cur-open[hidden]{display:none}
.lotnik-card .lt-sep{height:1px;margin:16px 6px 0;background:linear-gradient(90deg,transparent,rgba(251,191,36,.6),transparent);position:relative}
.lotnik-card .lt-sep::after{content:"";position:absolute;left:50%;top:-3px;width:6px;height:6px;margin-left:-3px;background:#fbbf24;transform:rotate(45deg)}
.lotnik-card .lt-drop-row{display:flex;gap:8px;margin-top:8px}
.lotnik-card .lt-drop-row .lotnik-btn{flex:1;padding:11px 6px;font-size:13px;font-weight:800;border-radius:10px}
.lotnik-card .lotnik-btn.lt-equip{background:#15803d;border-color:#22c55e;color:#f0fdf4}
.lotnik-card .lotnik-btn.lt-equip:hover{background:#16a34a}
.lotnik-card .lotnik-btn.lt-toss{background:#991b1b;border-color:#ef4444;color:#fef2f2}
.lotnik-card .lotnik-btn.lt-toss:hover{background:#b91c1c}
.lotnik-card .lotnik-btn.lt-stash{background:#1e3a5f;border-color:#3b82f6;color:#eff6ff}
.lotnik-card .lt-drop-row .lotnik-btn:disabled{opacity:.4;cursor:default}
.lotnik-card .lt-drop-msg{margin-top:6px;font-size:12px;color:#cbd5e1}
.lotnik-card .lt-drop-full{color:#fca5a5;font-weight:700}
.lotnik-card .lotnik-btn.lt-drop-inv{display:block;width:100%;margin-top:6px;padding:10px 6px;font-size:12px;border-radius:10px}
.lt-item{--c:#6c8cff;background:rgba(0,0,0,.94);border:1.5px solid var(--c);padding:12px 14px;box-sizing:border-box;text-align:center;color:#ddd;font:400 13px/1.3 "Segoe UI",system-ui,-apple-system,Roboto,sans-serif}
.lt-item-name{font-size:19px;font-weight:600;line-height:1.25;color:var(--c)}
.lt-item-type{font-size:15px;margin-top:1px;color:var(--c)}
.lt-item-rar{font-size:12px;color:#9a9a96;margin-top:3px}
.lt-item-rar b{color:#cbd5e1;font-weight:600}
.lt-item-zl{height:1px;margin:8px 6px;background:linear-gradient(90deg,transparent,var(--c) 18%,var(--c) 82%,transparent)}
.lt-item-aff{color:#7d8dff;font-size:15px;line-height:1.2}
.lt-item-desc{color:#9a9a96;font-size:12px;margin-top:7px}
.lt-afb{margin-top:7px}
.lt-afb:first-child{margin-top:0}
.lt-sl{color:#8a8a86;font-size:11.5px;margin-top:2px}
.lt-sl .lt-ok{color:#5ee65e}
.lt-pasek{display:flex;gap:3px;justify-content:center;margin:3px 0 0}
.lt-pasek i{flex:none;width:30px;height:4px;background:#2b2b2b;display:block}
.lt-pasek i.f{background:#7d8dff}
.lt-pasek i.f.part{background:linear-gradient(90deg,#7d8dff var(--p),#2b2b2b var(--p))}
.lt-pasek i.f.lt-upb{background:var(--lt-up,#facc15)}
.lt-pasek i.f.part.lt-upb{background:linear-gradient(90deg,var(--lt-up,#facc15) var(--p),#2b2b2b var(--p))}
.lt-pasek i.f.lt-upfrom{background:linear-gradient(90deg,#7d8dff var(--p),var(--lt-up,#facc15) var(--p))}
.lt-uniq{margin:2px 0 8px;padding-bottom:9px;position:relative}
.lt-uniq::after{content:"";position:absolute;left:40px;right:40px;bottom:0;height:1px;opacity:.3;background:linear-gradient(90deg,transparent,var(--c) 25%,var(--c) 75%,transparent)}
.lt-kgr{display:flex;align-items:stretch;margin-top:6px}
.lt-kaf{flex:1;min-width:0;padding:2px 0 4px}
.lt-kbok{width:26px;flex:none;position:relative}
.lt-kbok svg{position:absolute;top:0;bottom:0;right:1px;width:9px;height:100%;display:block}
.lt-kt{position:absolute;top:50%;left:0;translate:0 -50%;writing-mode:vertical-rl;transform:rotate(180deg);color:#77736a;font-size:9px;letter-spacing:1.5px;text-transform:uppercase}
.lt-kp .lt-kt{transform:none;left:auto;right:0}
.lt-kp svg{right:auto;left:1px}
.lt-locked{margin-top:10px;padding-top:8px;border-top:1px solid #2b2a27}
.lt-lk{margin-top:8px}
.lt-lk:first-child{margin-top:0}
.lt-ghost{display:inline-block;color:#7d8dff;font-size:15px;line-height:1.2;filter:blur(3.5px);opacity:.45;user-select:none;transition:filter .9s cubic-bezier(.2,.7,.3,1),opacity .9s}
.lt-ghost.near{filter:blur(1.6px);opacity:.8}
.lt-ghost.fail{animation:lt-fail .35s ease-in-out}
@keyframes lt-fail{20%{transform:translateX(-3px)}45%{transform:translateX(3px)}70%{transform:translateX(-2px)}}
.lt-lk .lt-pasek i{background:#1c1c1c}
.lt-lk .lt-pasek i.f{background:#7d8dff;opacity:.35}
.lt-tier{color:#8a8a86;font-size:11.5px;margin-top:2px;opacity:.5}
.lt-txt{color:#77736a;font-size:11.5px;margin-top:3px}
.lt-txt b{color:#9a9a96;font-weight:600}
.lt-lk.rolled .lt-txt{color:#9a9a96}
.lt-lk.rolled .lt-txt b{color:#cbd5e1}
.lt-lock{font-size:10px;margin-right:4px;filter:grayscale(1);opacity:.7}
.lt-x{display:inline-block;color:#e5484d;font-weight:700;margin-left:3px}
.lt-x.pop{animation:lt-pop .4s ease-out both}
@keyframes lt-pop{0%{transform:scale(2.2);opacity:0}60%{transform:scale(.9);opacity:1}100%{transform:none}}
.lt-mfnote{color:#6d6d6a;font-size:11px;margin-top:8px}
.lt-item .lt-hide{opacity:0}
.lt-item .lt-in{animation:lt-in .35s ease-out both}
@keyframes lt-in{from{opacity:0;transform:translateY(-4px)}}
.lt-pasek i.lt-grow{animation:lt-grow .25s ease-out both}
@keyframes lt-grow{from{background:#2b2b2b}}
.lt-afb{position:relative}
.lt-afb.lt-mfscan{animation:lt-scan .25s ease-out}
@keyframes lt-scan{50%{background:rgba(255,255,255,.05)}}
.lt-afb.lt-mfup{animation:lt-gold .8s ease-out}
@keyframes lt-gold{25%{background:rgba(242,200,75,.2);box-shadow:0 0 14px rgba(242,200,75,.5)}}
.lt-afb.lt-mfup::after{content:"🍀 MF";position:absolute;right:0;top:-4px;font-size:11px;font-weight:700;color:#f2c84b;animation:lt-mftag .9s ease-out both;pointer-events:none}
@keyframes lt-mftag{0%{opacity:0;transform:translateY(6px) scale(.7)}30%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-10px)}}
.lt-pasek i.f.lt-goldbar{animation:lt-goldbar .8s ease-out both}
@keyframes lt-goldbar{0%{background:#2b2b2b}30%{background:#f2c84b;box-shadow:0 0 8px #f2c84b}}
.lt-item-aff.lt-flip,.lt-sw.lt-flip{animation:lt-flip .6s ease-out}
@keyframes lt-flip{0%{color:#f2c84b}}
.lt-clv{color:#f2c84b;cursor:help;display:inline-block;filter:var(--lt-clvf,sepia(1) saturate(6) hue-rotate(8deg) brightness(1.15))}
.lt-clv.pop{display:inline-block;animation:lt-pop .4s ease-out both}
.lt-afb.lt-mfup::after{filter:var(--lt-clvf,sepia(1) saturate(6) hue-rotate(8deg) brightness(1.15))}
.lt-bonus .lt-item-aff{color:#e8c25a}
.lt-bonusnote{color:#b9a46a;font-size:11px;margin-top:8px;line-height:1.35}
.lt-bonusnote b{color:#e8c25a;font-weight:600}
`;

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function avatar(url) {
  const av = el('span', 'lt-av');
  av.style.backgroundImage = 'url("' + String(url).replace(/"/g, '%22') + '")';
  return av;
}

// Wynik na górze karty (makieta out/makieta-koniec.html). o = { meters, rec, prevBest, best, test }.
// Rekord: „★ NOWY REKORD ★”, złoty wynik, różnica do poprzedniego (prevBest 0 = pierwszy lot na urządzeniu).
// Zwykły: wynik i pasek do rekordu; bez paska przy braku rekordu i w partii testowej (?test=1).
// Klasa `lt-rec` idzie na rodzica (nagłówek karty z nickiem): złote tło i promienie za całą górą.
// o.acc (zalogowany, z /claim: serwer/ranking.js place): { prev, best?, place?, from?, over?{nick,url,to}, others?, gap?{nick,url,m}, game?, gamePrev? }
// — rekord liczony z konta (nie z urządzenia), linijka miejsca w rankingu, przy game „👑 Rekord gry 👑” (fiolet, klasa lt-game).
// o.would (gość, z /end): „To byłoby #N w rankingu”. o.wait: zalogowany bez znanego rekordu konta — bez rekordu, póki /claim nie odpowie.
// who (węzeł nicku z nakladka.js, stały między partiami): trafia do jednej linii z wynikiem „[av] nick · 4597 m”.
export function renderHero(node, o, who) {
  const m = Math.floor(o.meters || 0);
  const a = o.acc || null;
  if (a) {
    const prev = Math.floor(a.prev || 0);
    o = { ...o, rec: m > prev, prevBest: prev, best: Math.max(prev, m), first: 'Pierwszy wynik na koncie' };
  }
  const rec = !!o.rec && !o.test && !o.wait;
  const game = rec && !!(a && a.game);
  node.replaceChildren();
  if (node.parentNode) {
    node.parentNode.classList.toggle('lt-rec', rec);
    node.parentNode.classList.toggle('lt-game', game);
  }
  if (rec) {
    const c = el('div', 'lt-confetti');
    const cols = game ? ['#a78bfa', '#67e8f9', '#f5f3ff', '#fde68a', '#c084fc', '#22d3ee'] : ['#fbbf24', '#f472b6', '#60a5fa', '#4ade80', '#fde68a', '#c084fc'];
    for (let i = 0; i < (game ? 40 : 26); i++) {
      const p = el('i');
      p.style.left = (4 + Math.random() * 92) + '%';
      p.style.background = cols[i % cols.length];
      p.style.animationDelay = (Math.random() * 0.7) + 's';
      c.appendChild(p);
    }
    const k = el('div', 'lt-kick');
    if (game) k.append(el('i', null, '👑'), 'Rekord gry', el('i', null, '👑'));
    else k.append(el('i', null, '★'), 'Nowy rekord', el('i', null, '★'));
    node.append(c, k);
    if (game) node.appendChild(el('div', 'lt-hsub', 'Najlepszy wynik w rankingu'));
  }
  const s = el('div', 'lt-hscore', String(m));
  s.appendChild(el('small', null, 'm'));
  const l1 = el('div', 'lt-l1');
  if (who) l1.append(who, el('span', 'lt-dot', '·'));
  l1.appendChild(s);
  if (game) node.querySelector('.lt-kick').after(l1);
  else node.appendChild(l1);
  if (rec) {
    const prev = Math.floor(game ? a.gamePrev || 0 : o.prevBest || 0);
    const d = el('div', 'lt-delta');
    if (prev > 0) d.append('▲ +' + (m - prev) + ' m ', el('span', null, '· ' + (game ? 'stary rekord gry ' : 'poprzedni ') + prev + ' m'));
    else d.textContent = game ? 'Pierwszy wynik w rankingu' : o.first || 'Pierwszy wynik na tym urządzeniu';
    const w = el('div', 'lt-deltaw');
    w.appendChild(d);
    node.appendChild(w);
  } else renderProg(node, m, o);
  if (!o.test && a && a.place) node.appendChild(rankLine(a, rec));
  else if (!o.test && !a && o.would) node.appendChild(rankLine({ place: o.would, would: true }, true));
}

// Linijka miejsca: „#3 w rankingu ▲ z #7 / wyprzedzasz [av] X → #4 i 3 innych”; bez rekordu cicha „#3 w rankingu”.
function rankLine(a, rec) {
  const x = el('div', 'lt-rank' + (rec ? '' : ' lt-calm'));
  const r1 = el('div', 'lt-rank1');
  const pl = el('b', 'lt-rank-pl', '#' + a.place);
  if (a.would) r1.append(el('span', null, 'To byłoby'), pl, el('span', null, 'w rankingu'));
  else {
    r1.append(pl, el('span', null, 'w rankingu'));
    if (rec && a.from && a.from > a.place) r1.appendChild(el('span', 'lt-rank-up', '▲ z #' + a.from));
    else if (rec && a.from === a.place) r1.appendChild(el('span', null, '· bez zmian'));
  }
  x.appendChild(r1);
  if (!rec) return x;
  const r2 = el('div', 'lt-rank2');
  const who = (p) => { if (p.url) r2.appendChild(avatar(p.url)); r2.appendChild(el('b', null, p.nick)); };
  if (a.over) {
    r2.appendChild(el('span', null, a.place === 1 ? 'z tronu spada' : 'wyprzedzasz'));
    who(a.over);
    r2.appendChild(el('span', 'lt-rank-down', '→ #' + a.over.to));
    if (a.others) r2.appendChild(el('span', null, 'i ' + a.others + (a.others === 1 ? ' innego' : ' innych')));
  } else if (a.gap) {
    r2.appendChild(el('span', null, 'do #' + (a.place - 1)));
    who(a.gap);
    r2.appendChild(el('span', null, 'brakuje ' + a.gap.m + ' m'));
  } else if (a.would) r2.appendChild(el('span', null, 'Załóż konto, a następny taki lot trafi do rankingu.'));
  if (r2.childNodes.length) x.appendChild(r2);
  return x;
}

function renderProg(node, m, o) {
  const best = Math.floor(o.best || 0);
  if (o.test || o.wait || best <= 0) return;
  const pct = Math.max(0, Math.min(100, m / best * 100));
  const p = el('div', 'lt-prog');
  const track = el('div', 'lt-prog-track');
  const fill = el('div', 'lt-prog-fill');
  fill.style.width = pct.toFixed(1) + '%';
  track.append(fill, el('span', 'lt-prog-flag', '🏆'));
  const lbl = el('div', 'lt-prog-lbl');
  const r = el('span', null, 'Rekord ');
  r.appendChild(el('b', null, best + ' m'));
  lbl.append(el('span', null, Math.round(pct) + '% rekordu'), r);
  p.append(track, lbl);
  node.appendChild(p);
}

// Tabelka Magic Find, zawsze rozwinięta: szansa na drop i rzadkości z items.js (rarityChances).
// Rzadkość tylko z MF łącznego (zebrane + za dystans, items.js `totalMf`); serwer losuje tą samą funkcją.
export function renderMf(node, mf, meters) {
  node.replaceChildren();
  const head = el('div', 'lt-mf-head');
  head.appendChild(el('span', null, 'Magic Find'));
  const c = rarityChances(meters, mf);
  head.appendChild(el('b', null, String(c.mf)));
  node.appendChild(head);
  node.appendChild(el('div', 'lt-mf-low', 'zebrane ' + Math.round(mf || 0) + ' + za dystans ' + mfFromMeters(meters)));
  const pct = function (v) { const p = v * 100; return (p < 10 ? p.toFixed(1) : String(Math.round(p))) + '%'; };
  const row = function (label, v, color) {
    const r = el('div', 'lt-mfr');
    const s = el('span', null, label);
    if (color) s.style.color = color;
    r.appendChild(s);
    r.appendChild(el('b', null, pct(v)));
    node.appendChild(r);
  };
  row(RARITY.m.label, c.m, RARITY.m.color);
  row(RARITY.r.label, c.r, RARITY.r.color);
  if (c.u) row(RARITY.u.label, c.u, RARITY.u.color);
}

// --- karta przedmiotu (plakietka, makieta out/makieta-karta.html wariant B) ---
const TIER_KEYS = Object.keys(TIERS);
const KL_L = '<svg viewBox="0 0 10 100" preserveAspectRatio="none" aria-hidden="true"><path d="M9 1 Q4 1 4 8 L4 42 Q4 50 1 50 Q4 50 4 58 L4 92 Q4 99 9 99" fill="none" stroke="#6b6450" stroke-width="1.2" vector-effect="non-scaling-stroke"/></svg>';
const KL_P = '<svg viewBox="0 0 10 100" preserveAspectRatio="none" aria-hidden="true"><path d="M1 1 Q6 1 6 8 L6 42 Q6 50 9 50 Q6 50 6 58 L6 92 Q6 99 1 99" fill="none" stroke="#6b6450" stroke-width="1.2" vector-effect="non-scaling-stroke"/></svg>';
const pctRound = function (p) { return Math.round(p * 100) + '%'; };
const pctFine = function (v) { const p = v * 100; return (p < 10 ? p.toFixed(1) : String(Math.round(p))) + '%'; };

// Pasek 4 kresek = stopień afiksu (TIERS); n = liczba pełnych kresek, color = kolor kresek (unikalny).
// part (0–1] = wypełnienie ostatniej kreski z wartości w widełkach stopnia (`fillOf`).
// up (0–1] = stopień podbity przez MF: kreska starego stopnia niebieska do wypełnienia wartości przed MF,
// dalej w kolorze podbicia (`lt-upfrom`), ostatnia kreska w kolorze podbicia do nowej wartości (`lt-upb`).
// Klasy z prefiksem lt-: strona licznika ma własne (np. `.grow{flex:1}` rozciągało kreski).
function pasek(n, color, part, up) {
  const bar = el('div', 'lt-pasek');
  for (let i = 1; i <= 4; i++) bar.appendChild(el('i'));
  fillPasek(bar, n, part, up);
  if (color) bar.querySelectorAll('i.f').forEach(function (k) { k.style.background = color; });
  return bar;
}
function fillPasek(bar, n, part, up) {
  const pct = function (x) { return Math.round(100 * Math.min(1, Math.max(0, x))) + '%'; };
  bar.querySelectorAll('i').forEach(function (k, i) {
    k.className = i < n ? 'f' : '';
    k.style.removeProperty('--p');
    if (i === n - 1 && up) k.classList.add('lt-upb');
    if (i === n - 1 && typeof part === 'number') {
      k.classList.add('part');
      k.style.setProperty('--p', pct(part));
    } else if (i === n - 2 && typeof up === 'number') {
      k.classList.add('lt-upfrom');
      k.style.setProperty('--p', pct(up));
    }
  });
}

// Wypełnienie kreski: która z kolejnych wartości stopnia (1 z 1–2 = pół, 2 = pełna; min. 10%, żeby było ją widać).
// Bez widełek (stary afiks) pozycja r.
function fillOf(id, t, v, type, r) {
  const R = tierRange(id, t, type);
  if (!R) return typeof r === 'number' ? Math.max(0.1, r) : undefined;
  return Math.max(0.1, (Math.min(R[1], Math.max(R[0], v)) - R[0] + 1) / (R[1] - R[0] + 1));
}

// Słowo stopnia z pełnymi widełkami afiksu na tym typie: „solidny (3–30)”.
function tierWord(word, a, type) {
  const r = affixRange(a, type);
  return r ? word + ' (' + r[0] + '–' + r[1] + ')' : word;
}

// Stan afiksu na karcie (tekst, kreski, słowo stopnia); podbicie MF przełącza z `t0`/`v0` na `t`/`v`.
function tierParts(a, type) {
  return { text: affixLine(a).text, n: TIER_KEYS.indexOf(a.t) + 1, part: fillOf(a.id, a.t, a.v, type, a.r), up: tierUp(a, type),
    word: tierWord(TIERS[a.t].label.toLowerCase(), a, type) };
}
// Podbity przez MF: wypełnienie kreski starego stopnia wartością przed MF (`v0` w `t0`), inaczej null.
function tierUp(a, type) { return TIERS[a.t0] && a.t0 !== a.t ? fillOf(a.id, a.t0, a.v0, type, a.r) || 1 : null; }
function setTier(b, p) {
  b.querySelector('.lt-item-aff').textContent = p.text;
  fillPasek(b.querySelector('.lt-pasek'), p.n, p.part, p.up);
  b.querySelector('.lt-sw').textContent = p.word;
}

// Działający afiks: tekst, pasek, słowo stopnia z widełkami, 🎲 z dymkiem gdy wszedł z udanego rzutu (`won` = { p, nth, min }).
// Unikalny: 4 kreski w jego kolorze i słowo „unikalny”. fresh = świeży drop: podbity przez MF dostaje 🍀
// i oba stany w `b._mf` (rzut na żywo pokazuje najpierw stan przed MF, potem skok).
function affixBlock(a, won, type, fresh) {
  const line = affixLine(a);
  const b = el('div', 'lt-afb');
  const t = el('div', 'lt-item-aff', line.text);
  t.title = line.desc;
  if (line.unique) {
    t.style.color = line.color;
    b.appendChild(t);
    b.appendChild(pasek(4, line.color));
    b.appendChild(el('div', 'lt-sl', tierWord('unikalny', a, type)));
    return b;
  }
  b.appendChild(t);
  if (!TIERS[a.t]) return b;
  b.appendChild(pasek(TIER_KEYS.indexOf(a.t) + 1, null, fillOf(a.id, a.t, a.v, type, a.r), tierUp(a, type)));
  const sl = el('div', 'lt-sl');
  sl.appendChild(el('span', 'lt-sw', tierWord(TIERS[a.t].label.toLowerCase(), a, type)));
  if (fresh && TIERS[a.t0] && a.t0 !== a.t) {
    const clv = el('span', 'lt-clv', ' 🍀');
    clv.title = 'Magic Find podbił stopień: ' + TIERS[a.t0].label.toLowerCase() + ' → ' + TIERS[a.t].label.toLowerCase();
    sl.appendChild(clv);
    b._mf = { base: tierParts({ id: a.id, v: a.v0, t: a.t0 }, type), fin: tierParts(a, type) };
  }
  // Afiks ponad minimum z rzutu łańcucha: złota nazwa, wyjaśnienie w legendzie pod afiksami (itemBox).
  if (won && won.p) b.classList.add('lt-bonus');
  b.appendChild(sl);
  return b;
}

// Klamra z pionowym napisem: prefiksy po lewej, sufiksy po prawej (pusty bok po drugiej stronie dla symetrii).
function klamra(blocks, label, left) {
  const g = el('div', 'lt-kgr');
  const l = el('div', 'lt-kbok');
  const r = el('div', 'lt-kbok lt-kp');
  const side = left ? l : r;
  side.innerHTML = left ? KL_L : KL_P;
  side.appendChild(el('span', 'lt-kt', label));
  const mid = el('div', 'lt-kaf');
  blocks.forEach(function (b) { mid.appendChild(b); });
  g.appendChild(l);
  g.appendChild(mid);
  g.appendChild(r);
  return g;
}

// Zablokowany afiks: prawdziwy wylosowany, zamazany; szansa miejsca, ✗ tylko przy nieudanym rzucie.
function lockedBlock(a, p, rolled, type) {
  const line = affixLine(a);
  const b = el('div', 'lt-lk' + (rolled ? ' rolled' : ''));
  const g = el('div', 'lt-ghost', line ? line.text : '');
  g.setAttribute('aria-hidden', 'true');
  b.appendChild(g);
  if (TIERS[a.t]) {
    b.appendChild(pasek(TIER_KEYS.indexOf(a.t) + 1));
    b.appendChild(el('div', 'lt-tier', tierWord(TIERS[a.t].label.toLowerCase(), a, type)));
  }
  const txt = el('div', 'lt-txt');
  txt.appendChild(el('span', 'lt-lock', '🔒'));
  txt.appendChild(document.createTextNode('szansa '));
  txt.appendChild(el('b', null, p === undefined ? '?' : pctRound(p)));
  if (rolled) txt.appendChild(el('span', 'lt-x', '✗'));
  b.appendChild(txt);
  return b;
}

// Przedmiot jak plakietka: nazwa i baza w kolorze rzadkości, unikalne afiksy osobno, prefiksy i sufiksy w klamrach.
// chances = tylko świeży drop: szansa na rzadkość, złote wylosowane affixy z legendą, MF. Zablokowane do limitu
// (`locked`, `chain` z items.js rollItem) w dropie i w posiadanym przedmiocie (Ekwipunek, „Masz:”).
export function itemBox(item, chances) {
  const rar = RARITY[item.rarity] || RARITY.m;
  const box = el('div', 'lt-item');
  box.style.setProperty('--c', rar.color);
  box.appendChild(el('div', 'lt-item-name', itemName(item)));
  const slot = TYPES[LEGACY_TYPE[item.type] || item.type];
  box.appendChild(el('div', 'lt-item-type', slot ? slot.base : 'Przedmiot'));
  if (chances && typeof item.rp === 'number') {
    const r = el('div', 'lt-item-rar', 'Szansa na ' + rar.label.toLowerCase() + ' ');
    r.appendChild(el('b', null, pctFine(item.rp)));
    if (typeof item.mfu === 'number') r.appendChild(document.createTextNode(' (' + item.mfu + '% MF)'));
    box.appendChild(r);
  }
  const affixes = Array.isArray(item.affixes) ? item.affixes : [];
  const chain = chances && Array.isArray(item.chain) ? item.chain : [];
  const min = AFFIX_CHAIN[item.rarity] ? AFFIX_CHAIN[item.rarity].min : affixes.length;
  const uniq = [], pre = [], suf = [];
  for (let i = 0; i < affixes.length; i++) {
    const a = affixes[i];
    const def = AFFIXES[a && a.id];
    if (!def || !affixLine(a)) continue;
    // ✓ po pozycji w łańcuchu (pierwotny indeks), zanim afiksy rozejdą się do klamer.
    const b = affixBlock(a, i >= min ? { p: chain[i - min], nth: i + 1, min: min } : null, item.type, chances);
    if (def.kind === 'unique') { b.classList.add('lt-uniq'); uniq.push(b); }
    else if (def.kind === 'prefix') pre.push(b);
    else suf.push(b);
  }
  if (uniq.length || pre.length || suf.length) box.appendChild(el('div', 'lt-item-zl'));
  uniq.forEach(function (b) { box.appendChild(b); });
  if (pre.length) box.appendChild(klamra(pre, 'prefiksy', true));
  if (suf.length) box.appendChild(klamra(suf, 'sufiksy', false));
  if (item.desc) box.appendChild(el('div', 'lt-item-desc', item.desc));
  // Zablokowane także w posiadanym przedmiocie (decyzja 19.10: „był nieziemski, nie wypadł”), szanse z zapisanego `chain`.
  const locked = Array.isArray(item.locked) ? item.locked : [];
  const lchain = Array.isArray(item.chain) ? item.chain : [];
  if (locked.length && lchain.length) {
    const lw = el('div', 'lt-locked');
    const done = affixes.length - min;   // ile rzutów się udało; locked[0] = pierwszy nieudany
    for (let j = 0; j < locked.length; j++) lw.appendChild(lockedBlock(locked[j], lchain[done + j], j === 0 && done < lchain.length, item.type));
    box.appendChild(lw);
  }
  // Legenda złotych afiksów (prośba użytkownika 19.10: bez żargonu „ponad pewne”).
  const won = chain.slice(0, Math.max(0, affixes.length - min)).filter(function (p) { return p > 0; });
  if (won.length) {
    const n = el('div', 'lt-bonusnote');
    n.appendChild(el('b', null, 'Złote affixy to bonus'));
    n.appendChild(document.createTextNode(': ' + rar.label.toLowerCase() + ' przedmiot ma zawsze minimum ' + min +
      (min === 1 ? ' affix' : ' affixy') + ', złote wypadły dodatkowo (szansa ' + won.map(pctRound).join(' · ') +
      '; więcej MF = większa szansa).'));
    box.appendChild(n);
  }
  if (chances && typeof item.mfu === 'number') {
    const note = el('div', 'lt-mfnote', 'Twój MF ' + item.mfu + '%');
    if (typeof item.up === 'number') {
      note.appendChild(document.createTextNode(': każdy affix ma ' + pctRound(item.up) + ' na '));
      note.appendChild(el('span', 'lt-clv', '🍀'));   // ten sam kolor koniczynki co przy afiksach
      note.appendChild(document.createTextNode(' wyższy stopień'));
    }
    box.appendChild(note);
  }
  return box;
}

// Rzut na żywo (tylko drop): afiksy z góry na dół z rosnącym paskiem, nieudany rzut prawie się wyostrza, drży i gaśnie.
let rollTimers = [];
let rolledId = null;
let stampedId = null;
function stopRoll() {
  rollTimers.forEach(clearTimeout);
  rollTimers = [];
}
function later(ms, fn) {
  rollTimers.push(setTimeout(fn, ms));
}
function reducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function playRoll(box) {
  const blocks = Array.prototype.slice.call(box.querySelectorAll('.lt-afb'));   // kolejność na karcie
  const lks = Array.prototype.slice.call(box.querySelectorAll('.lt-lk'));
  const note = box.querySelector('.lt-mfnote');
  const show = function (b) { b.classList.remove('lt-hide'); b.classList.add('lt-in'); };
  blocks.concat(lks, note ? [note] : []).forEach(function (b) { b.classList.add('lt-hide'); });
  // Podbite przez MF wchodzą w stanie przed MF (bez 🍀); skok na końcu.
  blocks.forEach(function (b) {
    if (!b._mf) return;
    setTier(b, b._mf.base);
    b.querySelector('.lt-clv').classList.add('lt-hide');
  });
  let t = 300;
  blocks.forEach(function (b) {
    later(t, function () {
      show(b);
      b.querySelectorAll('.lt-pasek i.f').forEach(function (f, j) { f.style.animationDelay = (j * 0.08) + 's'; f.classList.add('lt-grow'); });
    });
    t += 450;
  });
  lks.forEach(function (l) {
    const g = l.querySelector('.lt-ghost');
    const x = l.querySelector('.lt-x');
    later(t, function () { show(l); });
    if (x) {
      later(t + 300, function () { g.classList.add('near'); });
      later(t + 1200, function () { g.classList.add('fail'); g.classList.remove('near'); });
      later(t + 1400, function () { x.classList.add('pop'); });
      t += 1700;
    } else t += 300;
  });
  // Faza MF: z góry na dół każdy afiks ze stopniem; bez podbicia cicha poświata, z podbiciem złoty błysk,
  // dobija kreska, słowo i wartość zmieniają się na nowe.
  if (blocks.some(function (b) { return b.querySelector('.lt-sw'); })) {
    t += 250;
    blocks.forEach(function (b) {
      if (!b.querySelector('.lt-sw') || !b.querySelector('.lt-pasek')) return;
      if (!b._mf) {
        later(t, function () { b.classList.add('lt-mfscan'); });
        t += 200;
        return;
      }
      later(t, function () { b.classList.add('lt-mfup'); });
      later(t + 220, function () {
        setTier(b, b._mf.fin);
        const f = b.querySelectorAll('.lt-pasek i.f');
        if (f.length) f[f.length - 1].classList.add('lt-goldbar');
        b.querySelector('.lt-item-aff').classList.add('lt-flip');
        b.querySelector('.lt-sw').classList.add('lt-flip');
        const c = b.querySelector('.lt-clv');
        c.classList.remove('lt-hide');
        c.classList.add('pop');
      });
      t += 900;
    });
  }
  if (note) later(t, function () { show(note); });
}

function button(text, cls, fn, disabled) {
  const b = el('button', 'lotnik-btn ' + cls, text);
  b.type = 'button';
  b.disabled = !!disabled;
  b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); fn(); });
  return b;
}

// „Masz: X” pokazuje założony przedmiot: najechanie (komputer) = podgląd nad linią, na nowym przedmiocie, bez klikania
// (pointer-events:none); klik/tap = rozwinięcie w miejscu. Nic nie wjeżdża pod kursor na Załóż/Odrzuć: rozwinięcie
// tylko na klik, a przyciski stoją pod Ekwipunkiem.
function currentLine(current) {
  const wrap = el('div', 'lt-cur');
  const line = el('button', 'lt-current');
  line.type = 'button';
  line.setAttribute('aria-expanded', 'false');
  line.appendChild(document.createTextNode('Masz: '));
  const n = el('span', null, itemName(current));
  n.style.color = (RARITY[current.rarity] || RARITY.m).color;
  line.appendChild(n);
  line.appendChild(el('i', null, '▾'));
  const tip = el('div', 'lt-cur-tip');
  tip.appendChild(el('div', 'lt-drop-kick', 'ZAŁOŻONE'));
  tip.appendChild(itemBox(current));
  const open = itemBox(current);
  open.classList.add('lt-cur-open');
  open.hidden = true;
  line.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    open.hidden = !open.hidden;
    wrap.classList.toggle('open', !open.hidden);
    line.setAttribute('aria-expanded', String(!open.hidden));
  });
  wrap.appendChild(tip);
  wrap.appendChild(line);
  wrap.appendChild(open);
  return wrap;
}

// Biernik do „Miejsce na X było puste” (serwer zakłada drop sam tylko do pustego miejsca, skrzynia.js addDrop).
const SLOT_ACC = { helm: 'hełm', armor: 'zbroję', weapon: 'broń', shield: 'tarczę', gloves: 'rękawice', boots: 'buty', belt: 'pas' };

// Założony drop: stempel „✓ ZAŁOŻONY” na ramce, pod nią skąd: puste miejsce albo „stary → 📦 w skrzyni [✗]”.
// ✗ pyta w miejscu („Na pewno?”, jak w Ekwipunku), drugie kliknięcie niszczy stary przedmiot (on.oldX).
function equippedNote(drop, s, on) {
  const n = el('div', 'lt-eqnote');
  if (s.oldMsg) { n.textContent = s.oldMsg; return n; }
  if (!s.old) {
    const slot = SLOT_ACC[LEGACY_TYPE[drop.type] || drop.type];
    n.textContent = slot ? 'Miejsce na ' + slot + ' było puste, więc masz go już na sobie.' : 'Masz go już na sobie.';
    return n;
  }
  // Nazwa starego jak „Masz: X”: najechanie = podgląd nad linią (na nowym przedmiocie), klik/tap = rozwinięcie pod spodem.
  const old = el('button', 'lt-old', itemName(s.old));
  old.type = 'button';
  old.appendChild(el('i', null, '▾'));
  const tip = el('div', 'lt-cur-tip lt-old-tip');
  tip.appendChild(el('div', 'lt-drop-kick', 'ZDJĘTY, W SKRZYNI'));
  tip.appendChild(itemBox(s.old));
  const box = itemBox(s.old);
  box.classList.add('lt-cur-open');
  const show = function (v) {
    box.hidden = !v;
    n.classList.toggle('open', v);
    old.setAttribute('aria-expanded', String(v));
    oldOpen = v ? s.old.id : null;
  };
  show(oldOpen === s.old.id);   // rysowanie od nowa (✗ → Na pewno?) nie zwija podglądu
  old.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); show(box.hidden); });
  n.append(tip, old, el('span', 'lt-arrow', '→'), el('span', 'lt-chip', '📦 w skrzyni'));
  if (on.oldX) {
    const x = button(s.oldAsk ? 'Na pewno?' : '✗', 'lt-oldx' + (s.oldAsk ? ' ask' : ''), on.oldX, s.oldBusy);
    x.className = 'lt-oldx' + (s.oldAsk ? ' ask' : '');   // bez wyglądu .lotnik-btn
    x.title = 'Zniszcz ' + itemName(s.old);
    x.setAttribute('aria-label', x.title);
    n.appendChild(x);
  }
  n.appendChild(box);
  return n;
}
let oldOpen = null;   // id starego przedmiotu z rozwiniętym podglądem

// Drop po locie (z serwera): ramka przedmiotu, „Masz: …”, Ekwipunek, na końcu Załóż / Do skrzyni / Odrzuć.
// st = { equipped (założony: od serwera albo po „Załóż”), old (zdjęty do skrzyni), oldAsk/oldBusy/oldMsg (✗ przy starym),
// done (krótka linijka po „Do skrzyni”/„Odrzuć” zamiast ramki), full (skrzynia pełna), msg };
// on = { equip, keep, toss, inv, oldX }.
export function renderDrop(node, drop, current, on, st) {
  const s = st || {};
  stopRoll();
  node.replaceChildren();
  node.hidden = !drop;
  if (!drop) return;
  node.appendChild(el('div', 'lt-drop-kick lt-kick2', 'WYPADŁ PRZEDMIOT'));
  if (s.done) {
    node.appendChild(el('div', 'lt-drop-msg', s.done));
    if (s.msg) node.appendChild(el('div', 'lt-drop-msg', s.msg));
    return;
  }
  const box = itemBox(drop, true);
  if (s.equipped) {
    const w = el('div', 'lt-eqwrap');
    const rib = el('div', 'lt-ribbon');
    rib.append(el('b', null, '✓'), 'ZAŁOŻONY');
    if (drop.id === stampedId) rib.style.animation = 'none';   // stempel wbija się raz, nie przy każdym odświeżeniu
    stampedId = drop.id;
    w.append(rib, box);
    node.appendChild(w);
  } else node.appendChild(box);
  // Rzut na żywo raz na drop: ponowne renderDrop (komunikaty) od razu rysuje stan końcowy.
  if (drop.id !== rolledId) {
    rolledId = drop.id;
    if (!reducedMotion()) playRoll(box);
  }
  if (s.equipped) {
    node.appendChild(equippedNote(drop, s, on));
    if (s.msg) node.appendChild(el('div', 'lt-drop-msg', s.msg));
    return;
  }
  if (current) node.appendChild(currentLine(current));
  if (s.full) node.appendChild(el('div', 'lt-drop-msg lt-drop-full', 'Skrzynia pełna. Zniszcz jakiś przedmiot w Ekwipunku, żeby zatrzymać ten.'));
  else if (s.msg) node.appendChild(el('div', 'lt-drop-msg', s.msg));
  node.appendChild(button('Ekwipunek', 'lt-drop-inv', on.inv));
  const row = el('div', 'lt-drop-row');
  row.appendChild(button('Załóż', 'lt-equip', on.equip, s.full));
  row.appendChild(button('Do skrzyni', 'lt-stash', on.keep, s.full));
  row.appendChild(button('Odrzuć', 'lt-toss', on.toss));
  node.appendChild(row);
}
