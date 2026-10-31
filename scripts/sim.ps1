# Arranca una simulación (dry-run) de Freqtrade sin Docker.
# Lee credenciales de API/Telegram desde .env y las pasa como variables FREQTRADE__*.
#   scripts\sim.ps1                → BreakoutTrend en 1h, API 127.0.0.1:8080
#   scripts\sim.ps1 -Bot daily     → TrendDaily en 1d,   API 127.0.0.1:8081
#   scripts\sim.ps1 -Bot dual      → DualMomentum en 1d, API 127.0.0.1:8082
param([ValidateSet('breakout', 'daily', 'dual')][string]$Bot = 'breakout')

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$bots = @{
    breakout = @{ Strategy = 'BreakoutTrend'; Config = 'config.sim.json'; Name = 'sim'; Telegram = $true }
    daily    = @{ Strategy = 'TrendDaily'; Config = 'config.sim.daily.json'; Name = 'sim-daily'; Telegram = $false }
    dual     = @{ Strategy = 'DualMomentum'; Config = 'config.sim.dual.json'; Name = 'sim-dual'; Telegram = $false }
}
$b = $bots[$Bot]

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
# Un token de Telegram solo admite un bot escuchando: se usa en la simulación principal
if ($b.Telegram) {
    $env:FREQTRADE__TELEGRAM__ENABLED = $envVars['TELEGRAM_ENABLED']
    $env:FREQTRADE__TELEGRAM__TOKEN = $envVars['TELEGRAM_TOKEN']
    $env:FREQTRADE__TELEGRAM__CHAT_ID = $envVars['TELEGRAM_CHAT_ID']
}

New-Item -ItemType Directory -Force "$root\freqtrade\user_data\logs" | Out-Null
& "$root\.venv\Scripts\freqtrade.exe" trade `
    --userdir freqtrade/user_data `
    --config freqtrade/user_data/config.base.json `
    --config "freqtrade/user_data/$($b.Config)" `
    --db-url "sqlite:///freqtrade/user_data/tradesv3.$($b.Name).sqlite" `
    --logfile "freqtrade/user_data/logs/freqtrade-$($b.Name).log" `
    --strategy $b.Strategy
exit $LASTEXITCODE
