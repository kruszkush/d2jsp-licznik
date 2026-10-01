import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { mergeData, mergeState } from './collector.mjs';
const files = ['docs/data.json', 'state.json'];
function git(args, allowed = [0], quiet = false) {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  if (!quiet) { if (r.stdout) process.stdout.write(r.stdout); if (r.stderr) process.stderr.write(r.stderr); }
  if (r.error || !allowed.includes(r.status)) throw new Error(`git ${args[0]}: ${r.error?.message || r.stderr || r.status}`);
  return r;
}
function commit(message) {
  const dirty = git(['diff', '--name-only', 'HEAD'], [0], true).stdout.trim().split('\n').filter(Boolean);
  if (dirty.some((p) => !files.includes(p.trim()))) throw new Error('Zmiany poza danymi — automat nie będzie ich nadpisywał.');
  git(['add', '--', ...files]);
  if (git(['diff', '--cached', '--quiet'], [0, 1], true).status) git(['commit', '-qm', message]);
}
function mergeRemote() {
  const local = files.map((p) => JSON.parse(readFileSync(p, 'utf8')));
  const remote = files.map((p) => JSON.parse(git(['show', `origin/main:${p}`], [0], true).stdout));
  const merged = [mergeData(local[0], remote[0]), mergeState(local[1], remote[1])];
  const result = git(['merge', '--no-edit', 'origin/main'], [0, 1]);
  if (result.status) {
    const conflicts = git(['diff', '--name-only', '--diff-filter=U'], [0], true).stdout.trim().split('\n').filter(Boolean);
    if (!conflicts.length || conflicts.some((p) => !files.includes(p.trim()))) {
      git(['merge', '--abort'], [0, 1]); throw new Error('Nie udało się bezpiecznie scalić repozytorium.');
    }
  }
  files.forEach((p, i) => writeFileSync(p, JSON.stringify(merged[i])));
  git(['add', '--', ...files]);
  if (result.status) git(['commit', '-qm', 'Scalenie danych automatów bez utraty postów']);
  else commit('Scalenie stanu źródeł pobierania');
}
try {
  const mode = process.argv[2];
  if (mode === 'prepare') {
    commit('Odzyskany postęp automatycznego pobierania');
    git(['fetch', '-q', 'origin']); mergeRemote();
  } else if (mode === 'publish') {
    commit(process.argv[3] || 'Dane automatyczne');
    let pushed = false;
    for (let i = 0; i < 3; i++) {
      const push = git(['push', '-q'], [0, 1, 128]);
      if (!push.status) { pushed = true; break; }
      git(['fetch', '-q', 'origin']); mergeRemote();
    }
    if (!pushed) throw new Error('Publikacja nie powiodła się po 3 próbach; lokalny postęp zachowany.');
  } else throw new Error('Użycie: node scripts/sync.mjs prepare|publish [opis]');
} catch (e) { console.error(e.message); process.exitCode = 1; }
