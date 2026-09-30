# Pobieranie z domowego komputera (zaplanowane zadanie Windows „d2jsp-licznik”). Osobny klon repo w E:Vibe codingd2jsp-licznik-bot,
# żeby reset do GitHuba nie ruszał roboczej kopii. Chrome startuje poza ekranem, więc nic nie wyskakuje.
$ErrorActionPreference = 'Continue'
$dir = 'E:Vibe codingd2jsp-licznik-bot'
$log = 'E:Vibe codingd2jsp-licznik-bot.log'
if (-not (Test-Path $dir)) { git clone -q https://github.com/kruszkush/d2jsp-licznik.git $dir *>> $log }
Set-Location $dir
git fetch -q origin *>> $log; git reset -q --hard origin/main *>> $log
if (-not (Test-Path node_modules/puppeteer-core)) { npm install --silent --no-save puppeteer-core *>> $log }
$env:CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:PROFILE = "$env:LOCALAPPDATA\d2jsp-licznik-profil"
$env:OFFSCREEN = '1'
node scripts/update.mjs *>> $log
$code = $LASTEXITCODE
git add docs/data.json state.json
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  git commit -qm "Dane (PC): $(Get-Date -Format 'yyyy-MM-dd HH:mm')" *>> $log
  foreach ($i in 1..3) {
    git push -q *>> $log; if ($LASTEXITCODE -eq 0) { break }
    git pull -q --rebase -X theirs *>> $log
    if ($LASTEXITCODE -ne 0) { git rebase --abort; git reset -q --hard origin/main; break }
  }
}
"$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') wynik=$code" | Out-File -Append -Encoding utf8 $log
