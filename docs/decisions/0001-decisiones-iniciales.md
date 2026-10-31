# 0001 · Decisiones iniciales (2026-10-30)

## Freqtrade como núcleo
Backtesting, dry-run, ejecución real, stoploss en exchange, protecciones, REST API y Telegram ya
resueltos y probados. Se reemplazan las secciones 4, 6, 7 y 9 del plan original (ledger, ejecutor,
reconciliación, paper) por Freqtrade; esas secciones quedan como criterios de verificación.
Versión fijada: 2026.9. Licencia GPLv3: uso privado sin problema; distribuir implica obligaciones GPL.

## Exchange de datos: Binance spot
Mejor soporte en Freqtrade e historial OHLCV completo. Kraken entrega solo 720 velas por llamada;
Buda.com no está soportado oficialmente. El exchange real se decide en la fase 4, tras verificar
la cuenta desde Chile.

## Estrategia v1 (parámetros fijos antes de medir)
Ruptura del máximo de 20 velas 1h + volumen sobre su media de 20, con EMA50 > EMA200 en 4h.
Stop inicial 2×ATR(14), trailing 3×ATR desde el máximo, salida a las 72 h o al perderse la tendencia.
Sizing: 0,25% de riesgo por operación, 20% máximo por activo, 2 posiciones, -1% diario UTC bloquea entradas.

## Ventanas de evaluación
Desarrollo 2020-01-01 → 2025-01-01. Evaluación 2025-01-01 → hoy; no se optimiza sobre ella.

## Sesgo de los LLM
TradingAgents no se evalúa con backtest histórico: el modelo conoce el pasado. Solo A/B hacia
adelante en dry-run (instancia sin IA vs. con IA).

## Docker pendiente
Docker Desktop instalado, pero requiere WSL2 (admin + reinicio). Mientras tanto Freqtrade corre
nativo en `.venv` con SQLite (`scripts/sim.ps1`). `docker-compose.yml` queda listo con Postgres.
