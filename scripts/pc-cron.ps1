# Pobieranie z domowego komputera (zaplanowane zadanie Windows „d2jsp-licznik”). Osobny klon repo w E:\Vibe coding\d2jsp-licznik-bot,
# żeby reset do GitHuba nie ruszał roboczej kopii. Chrome startuje poza ekranem, więc nic nie wyskakuje.
$ErrorActionPreference = 'Continue'
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'  # log w UTF-8, nie UTF-16
$dir = 'E:\Vibe coding\d2jsp-licznik-bot'
$log = 'E:\Vibe coding\d2jsp-licznik-bot.log'
if (-not (Test-Path $dir)) { git clone -q https://github.com/kruszkush/d2jsp-licznik.git $dir *>> $log }
Set-Location $dir
git config user.name 'kruszkush'; git config user.email 'kruszkush@users.noreply.github.com'
node scripts/sync.mjs prepare *>> $log
if ($LASTEXITCODE -ne 0) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') błąd synchronizacji" | Out-File -Append -Encoding utf8 $log; exit 1 }
if (-not (Test-Path node_modules/puppeteer-core)) { npm install --silent --no-save puppeteer-core *>> $log }
$env:CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:PROFILE = "$env:LOCALAPPDATA\d2jsp-licznik-profil"
$env:OFFSCREEN = '1'
$env:D2_SOURCE = 'pc'
node scripts/update.mjs *>> $log
$code = $LASTEXITCODE
node scripts/sync.mjs publish "Dane (PC): $(Get-Date -Format 'yyyy-MM-dd HH:mm')" *>> $log
if ($LASTEXITCODE -ne 0) { $code = 1 }
"$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') wynik=$code" | Out-File -Append -Encoding utf8 $log
exit $code
