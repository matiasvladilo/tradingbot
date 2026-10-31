"""Dimensionamiento por riesgo. Sin dependencias de Freqtrade para poder testearlo aislado."""

from dataclasses import dataclass
from decimal import ROUND_DOWN, Decimal

CENT = Decimal("0.01")


@dataclass(frozen=True)
class RiskPolicy:
    risk_per_trade: Decimal = Decimal("0.0025")  # 0,25% del patrimonio hasta el stop
    max_asset_fraction: Decimal = Decimal("0.20")  # 20% del patrimonio por activo
    fee_rate: Decimal = Decimal("0.001")  # comisión por lado, conservadora


def _d(value) -> Decimal:
    return value if isinstance(value, Decimal) else Decimal(str(value))


def risk_stake(
    equity,
    entry_price,
    stop_price,
    free_cash,
    min_stake,
    policy: RiskPolicy = RiskPolicy(),
) -> Decimal:
    """Importe en moneda de cotización a invertir, o 0 si la operación no cabe.

    El menor de: riesgo hasta el stop (incluidas comisiones de entrada y salida),
    tope por activo y efectivo libre. Redondea hacia abajo; nunca sube el riesgo
    para alcanzar el mínimo del exchange.
    """
    equity, entry, stop = _d(equity), _d(entry_price), _d(stop_price)
    free_cash = _d(free_cash)
    min_stake = _d(min_stake or 0)

    if equity <= 0 or entry <= 0 or stop <= 0 or stop >= entry:
        return Decimal("0")

    loss_per_unit = (entry - stop) + entry * policy.fee_rate + stop * policy.fee_rate
    quantity = equity * policy.risk_per_trade / loss_per_unit
    by_risk = quantity * entry

    stake = min(by_risk, equity * policy.max_asset_fraction, free_cash)
    stake = stake.quantize(CENT, rounding=ROUND_DOWN)

    if stake <= 0 or stake < min_stake:
        return Decimal("0")
    return stake


def daily_loss_breached(equity_now, pnl_today, limit=Decimal("0.01")) -> bool:
    """True si la pérdida del día UTC (realizada + no realizada) supera `limit`
    del patrimonio al inicio del día."""
    equity_now, pnl_today = _d(equity_now), _d(pnl_today)
    day_start = equity_now - pnl_today
    if day_start <= 0:
        return True
    return pnl_today < 0 and -pnl_today / day_start >= _d(limit)
