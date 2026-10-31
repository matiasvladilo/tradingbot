# Arranca la simulación (dry-run) de Freqtrade sin Docker.
# Lee credenciales de API/Telegram desde .env y las pasa como variables FREQTRADE__*.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

& "$root\.venv\Scripts\python.exe" "$root\scripts\check_configs.py"
if ($LASTEXITCODE -ne 0) { exit 1 }

$envVars = @{}
Get-Content "$root\.env" | Where-Object { $_ -match '^\s*([A-Z_]+)=(.*)$' } | ForEach-Object {
    $envVars[$Matches[1]] = $Matches[2]
}
$env:FREQTRADE__API_SERVER__USERNAME = $envVars['FT_API_USERNAME']
$env:FREQTRADE__API_SERVER__PASSWORD = $envVars['FT_API_PASSWORD']
$env:FREQTRADE__API_SERVER__JWT_SECRET_KEY = $envVars['FT_JWT_SECRET']
$env:FREQTRADE__API_SERVER__WS_TOKEN = $envVars['FT_WS_TOKEN']
$env:FREQTRADE__TELEGRAM__ENABLED = $envVars['TELEGRAM_ENABLED']
$env:FREQTRADE__TELEGRAM__TOKEN = $envVars['TELEGRAM_TOKEN']
$env:FREQTRADE__TELEGRAM__CHAT_ID = $envVars['TELEGRAM_CHAT_ID']

New-Item -ItemType Directory -Force "$root\freqtrade\user_data\logs" | Out-Null
& "$root\.venv\Scripts\freqtrade.exe" trade `
    --userdir freqtrade/user_data `
    --config freqtrade/user_data/config.base.json `
    --config freqtrade/user_data/config.sim.json `
    --db-url "sqlite:///freqtrade/user_data/tradesv3.sim.sqlite" `
    --logfile freqtrade/user_data/logs/freqtrade-sim.log `
    --strategy BreakoutTrend
exit $LASTEXITCODE
