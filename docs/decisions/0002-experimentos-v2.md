# 0002 · Experimentos v2 y estrategia diaria (2026-10-30)

Escrito **antes** de correr los backtests, para no ajustar las reglas al resultado.

## Diagnóstico de v1 (2020–2024, fee 0,1%)
- Bruto +271 USDT, comisiones −227, neto +44 (822 operaciones).
- 261 de 533 perdedoras estuvieron > +1% antes de cerrar en pérdida.
- 2022 (bajista): −61 USDT, acierto 25%.

## Variantes (un cambio cada una, parámetros fijos)
| Variante | Cambio |
|---|---|
| `V2Breakeven` | Al llegar a +1R, el stop sube a entrada + comisiones |
| `V2Filtro` | Cierre > nivel de ruptura + 0,25×ATR y EMA50 4h subiendo (vs. 24 h antes) |
| `V2Regimen` | Solo compra si el cierre diario > SMA200 diaria |
| `BreakoutTrendV2` | Combinación de los cambios aceptados |
| `TrendDaily` | Estrategia distinta: velas diarias, ruptura de 20 días sobre SMA200, salida bajo el mínimo de 10 días, stop 2×ATR(20) |

Todas usan el mismo sizing (0,25% de riesgo por operación) y las mismas protecciones de pérdida.

## Reglas de aceptación (ventana 2020–2024)
Un cambio se acepta solo si cumple las tres:
1. Resultado neto mayor que v1 con fee 0,1%.
2. Drawdown máximo del patrimonio no peor que v1 + 2 puntos.
3. Con fee 0,2% su resultado neto es mayor que el de v1 con fee 0,2%.

`BreakoutTrendV2` combina solo los cambios aceptados. Después se corre **una sola vez** en
2025-01-01 → hoy. Si ahí el resultado neto no supera a v1, no se sigue ajustando: se registra y se
pasa a otra idea.

## Resultados

Desarrollo 2020-07-23 → 2025-01-01 (ventana común por la SMA200 diaria), capital 1.000 USDT:

| Estrategia | Ops. | Neto fee 0,1% | Drawdown | Neto fee 0,2% | Decisión |
|---|---|---|---|---|---|
| BreakoutTrend (v1) | 729 | +23,8 | 10,9% | −152,4 | referencia |
| V2Breakeven | 759 | +22,3 | 10,1% | — | rechazada (regla 1); sube acierto 35→37% pero gana menos |
| V2Filtro | 520 | +6,6 | 6,8% | — | rechazada (regla 1) |
| V2Regimen | 618 | +70,8 | 6,9% | −86,7 | **aceptada** → BreakoutTrendV2 |
| TrendDaily (2020-01-01 →) | 40 | +333,0 | 0,6% op. / 5,9% patrimonio | +329,2 | candidata; comisiones 3 USDT vs. bruto 336 |

Validación única 2025-01-01 → 2026-10-30 (fee 0,1%):

| Estrategia | Ops. | Neto | Drawdown |
|---|---|---|---|
| BreakoutTrend (v1) | 267 | −44,0 (−4,4%) | 7,8% |
| BreakoutTrendV2 | 165 | −28,8 (−2,9%) | 5,0% |
| TrendDaily | 14 | +0,9 (+0,1%) | 0,8% |
| BuyAndHold | 2 | −258,9 (−25,9%) | 25,9% |

Conclusiones:
- La familia de rupturas en 1h queda **descartada**: v2 mejora a v1, pero sigue negativa en
  evaluación y con fee 0,2%. No se ajusta más (regla fijada arriba).
- TrendDaily cumple el criterio de viabilidad, por poco en evaluación (+0,1%). Protege capital en
  caídas, pero su ganancia de 2020–2024 se concentra en dos operaciones del mercado alcista de
  2020–21 (224 de 333 USDT). Con 0,25% de riesgo usa en promedio solo ~3,6% del capital por operación.
- Siguiente paso: correr TrendDaily en paper en vivo y estudiar su sensibilidad (variando
  ±25% los parámetros) en 2020–2024, sin tocar la ventana de evaluación.

Criterio de "estrategia viable" (para cualquier candidata): neto positivo en ambas ventanas,
ganancia bruta ≥ 2× comisiones, y neto positivo con fee 0,2% en 2020–2024.
