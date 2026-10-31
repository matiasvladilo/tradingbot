# trading-lab

Laboratorio de estrategias cripto spot (BTC/ETH) sobre Freqtrade. **Solo simulación**: no hay
claves de exchange ni configuración real; `scripts/check_configs.py` lo impide.

## Uso diario (Windows, sin Docker)

```powershell
# simulación en vivo (dry-run), API en 127.0.0.1:8080
powershell -ExecutionPolicy Bypass -File scripts\sim.ps1

# dashboard en http://localhost:3000
npm --prefix apps/web run dev
```

## Backtests

```powershell
.\.venv\Scripts\freqtrade backtesting --userdir freqtrade/user_data --config freqtrade/user_data/config.base.json `
  --strategy-list BreakoutTrend BuyAndHold --timerange 20200101-20250101 --timeframe-detail 5m --fee 0.001 --export trades
.\.venv\Scripts\python scripts\export_backtests.py   # actualiza la página Simulación
```

Actualizar datos: `freqtrade download-data --userdir freqtrade/user_data --config freqtrade/user_data/config.base.json --timeframes 5m 1h 4h`.

## Tests

```powershell
.\.venv\Scripts\python -m pytest tests
```

## Estructura
- `freqtrade/user_data/strategies/` · `BreakoutTrend` (v1), `BuyAndHold` (baseline), `lib/sizing.py`
- `apps/web/` · dashboard Next.js; las credenciales de la API viven solo en `apps/web/.env.local`
- `docs/decisions/` · decisiones y su motivo
- `docker-compose.yml` · mismo stack con Postgres, para cuando WSL2 esté instalado

## Robustez (Monte Carlo)

```powershell
.\.venv\Scripts\python scripts\monte_carlo.py <backtest-result-...zip> TrendDaily [<zip> <estrategia> ...]
```
Actualiza la página Robustez del dashboard.
