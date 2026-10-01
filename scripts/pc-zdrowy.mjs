// Wyjście 0, gdy PC jest sprawny (serwer może pominąć przebieg); 1 — serwer ma pobierać.
import { readFileSync } from 'node:fs';
import { pcHealthy } from './collector.mjs';
const st = JSON.parse(readFileSync('state.json', 'utf8').replace(/^﻿/, ''));
const ok = pcHealthy(st);
console.log(ok ? `PC sprawny (ostatnia udana próba ${new Date(st.sources.pc.okAt).toLocaleString('pl-PL')}) — serwer pomija przebieg` : 'PC niesprawny lub nieaktualny — serwer pobiera');
process.exit(ok ? 0 : 1);
