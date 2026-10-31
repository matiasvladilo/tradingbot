"""Reglas del modo práctica manual. Sin dependencias de Freqtrade para poder testearlas.

Cada orden manual lleva su plan en el entry_tag: "m;s=<stop>;t=<objetivo>;k=<setup>".
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class PracticeRules:
    max_risk_per_trade: float = 0.02  # 2% del patrimonio hasta el stop
    max_trades_per_day: int = 6
    max_daily_loss: float = 0.03  # 3% del patrimonio al inicio del día UTC
    max_position_fraction: float = 0.5  # 50% del patrimonio en una posición


def parse_tag(tag: str | None) -> dict:
    """Lee stop (s), objetivo (t) y setup (k) del entry_tag; ignora lo que no entiende."""
    out: dict = {}
    if not tag or not tag.startswith("m;"):
        return out
    for part in tag.split(";")[1:]:
        key, _, value = part.partition("=")
        if key in ("s", "t"):
            try:
                out["stop" if key == "s" else "target"] = float(value)
            except ValueError:
                continue
        elif key == "k" and value:
            out["setup"] = value
    return out


def validate_entry(
    equity: float,
    price: float,
    amount: float,
    tag: str | None,
    trades_today: int,
    pnl_today: float,
    rules: PracticeRules = PracticeRules(),
) -> str | None:
    """Motivo de rechazo, o None si la orden cumple las reglas de práctica."""
    plan = parse_tag(tag)
    stop = plan.get("stop")
    if stop is None:
        return "falta el stop"
    if stop <= 0 or stop >= price:
        return "el stop debe estar bajo el precio de entrada"
    target = plan.get("target")
    if target is not None and target <= price:
        return "el objetivo debe estar sobre el precio de entrada"
    if equity <= 0 or amount <= 0:
        return "importe inválido"
    if amount * price > equity * rules.max_position_fraction:
        return f"la posición supera el {rules.max_position_fraction:.0%} del patrimonio"
    if amount * (price - stop) > equity * rules.max_risk_per_trade:
        return f"el riesgo supera el {rules.max_risk_per_trade:.0%} del patrimonio"
    if trades_today >= rules.max_trades_per_day:
        return f"límite de {rules.max_trades_per_day} operaciones por día"
    day_start = equity - pnl_today
    if day_start > 0 and pnl_today < 0 and -pnl_today / day_start >= rules.max_daily_loss:
        return f"pérdida del día ≥ {rules.max_daily_loss:.0%}: se acabó la sesión"
    return None
