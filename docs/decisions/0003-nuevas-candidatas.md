# 0003 · Nuevas candidatas (2026-10-30)

Escrito **antes** de correr los backtests.

## Qué dice la evidencia
- Momentum de serie temporal en cripto: evidencia fuerte, concentrada en mercados alcistas
  (Liu & Tsyvinski 2018, NBER w24877; Han, Kang & Ryu; Rozario et al. 2020). El momentum
  transversal (rankear muchas monedas) tiene evidencia más débil y sesgo de supervivencia.
- "Bots de IA", grid y DCA en 2026: casi todo contenido de proveedores, sin resultados auditados.
  Grid/DCA ganan en rangos y sufren en tendencias; un LLM agrega varianza, no ventaja.
- Arbitraje de funding (spot largo + perpetuo corto): de lo más consistente en cripto, pero requiere
  derivados, fuera del alcance spot del plan. Se anota para el futuro.

## Candidatas (velas diarias, BTC/USDT y ETH/USDT, parámetros fijos)
| Estrategia | Entrada | Salida | Stop inicial |
|---|---|---|---|
| `MomentumVotes` | ≥ 3 de 4 retornos positivos (20, 50, 100, 200 días) | ≤ 1 de 4 positivos | 3×ATR(20) |
| `DualMomentum` | retorno 30 d > 0 y mayor que el del otro par | retorno 30 d ≤ 0 o el otro par lo supera | 3×ATR(20) |
| `RSI2Reversion` | RSI(2) < 10 con cierre > SMA200 | cierre > SMA(5) o 10 días | 3×ATR(20) |
| `TrendDaily` | (referencia, ver 0002) | | 2×ATR(20) |

Mismo sizing para todas: 0,25% de riesgo hasta el stop, máx. 20% por activo, 2 posiciones.

## Referencias de comparación
- `BuyAndHold`: 100% invertido.
- `BuyAndHold40`: 20% por activo (40% total), la misma exposición máxima que las candidatas.

## Reglas (fijadas antes de medir)
Desarrollo 2020-01-01 → 2025-01-01. Una candidata pasa a validación si cumple **todas**:
1. Neto > 0 con fee 0,1% y con fee 0,2%.
2. Ganancia bruta ≥ 2× comisiones.
3. Monte Carlo: P(pérdida) < 10% y mediana > 0 sin sus 2 mejores operaciones.
4. Retorno / drawdown máximo del patrimonio ≥ el de `BuyAndHold40`.

Las que pasan se corren **una vez** en 2025-01-01 → hoy. No se ajustan parámetros después.

## Resultados

Desarrollo 2020-01-01 → 2025-01-01 (capital 1.000 USDT):

| Estrategia | Ops. | Neto 0,1% | Neto 0,2% | Bruto/fees | DD patrimonio | Ret/DD | MC P(pérdida) | Mediana sin top 2 | Reglas |
|---|---|---|---|---|---|---|---|---|---|
| TrendDaily | 40 | +33,3% | +32,9% | 104 | 5,9% | 5,7 | 0,0% | +9,2% | 1✓ 2✓ 3✓ 4✗ |
| MomentumVotes | 35 | +20,8% | +20,7% | 121 | 13,0% | 1,6 | 0,9% | +5,3% | 1✓ 2✓ 3✓ 4✗ |
| DualMomentum | 143 | +7,1% | +6,5% | 13,5 | 2,0% | 3,5 | 0,3% | +4,2% | 1✓ 2✓ 3✓ 4✗ |
| RSI2Reversion | 100 | +1,0% | +0,7% | 3,9 | 0,9% | 1,1 | 15,4% | +0,7% | 1✓ 2✓ 3✗ 4✗ |
| BuyAndHold | 2 | +1.806% | — | — | 77,8% | 23,2 | — | — | referencia |
| BuyAndHold40 | 2 | +722% | — | — | 73,0% | 9,9 | — | — | referencia |

**Ninguna pasa la regla 4.** En un período en que BTC/ETH subieron ~18×, mantener tiene mejor
retorno/caída que cualquier estrategia con 0,25% de riesgo por operación.
Defecto detectado en la regla 4 (no se corrige a posteriori): `BuyAndHold40` no rebalancea; su
exposición crece con la subida y termina con 73% de drawdown, no la de 40%.

Evaluación 2025-01-01 → 2026-10-30, corrida **solo como información** (no hubo ajustes):

| Estrategia | Ops. | Neto | DD patrimonio |
|---|---|---|---|
| TrendDaily | 14 | +0,1% | 1,4% |
| MomentumVotes | 15 | −0,2% | 1,7% |
| DualMomentum | 48 | **+1,8%** | 1,1% |
| RSI2Reversion | 26 | +0,4% | 0,4% |
| BuyAndHold | 2 | −25,2% | 59,5% |
| BuyAndHold40 | 2 | −10,1% | 28,2% |

Conclusiones:
- Las estrategias de tendencia diaria sobreviven comisiones y Monte Carlo, y protegen capital en
  caídas, pero con 0,25% de riesgo usan ~2–4% del capital por operación: el retorno absoluto es bajo.
- DualMomentum es la más consistente: positiva en ambas ventanas, P(pérdida) 0,3%.
- RSI2Reversion: 71% de acierto y casi sin ganancia (más verdes ≠ más ganancia).
- La palanca principal ya no es la señal sino cuánto capital se arriesga, decisión del usuario.
