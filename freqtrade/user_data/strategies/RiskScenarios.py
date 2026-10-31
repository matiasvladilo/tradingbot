"""Mismas señales de TrendDaily y DualMomentum con distintos niveles de riesgo.

Solo cambia cuánto se arriesga por operación (y el tope por activo para que ese riesgo
se pueda aplicar). Sirve para ver la relación riesgo/ganancia, no para optimizar.
Sufijo _Rxxxx = riesgo en centésimas de punto porcentual (0025 = 0,25%).
"""

from decimal import Decimal as D

from DailyCandidates import DualMomentum
from lib.sizing import RiskPolicy
from TrendDaily import TrendDaily


def policy(risk: str, cap: str) -> RiskPolicy:
    return RiskPolicy(risk_per_trade=D(risk), max_asset_fraction=D(cap))


class TrendDaily_R0025(TrendDaily):
    risk_policy = policy("0.0025", "0.20")


class TrendDaily_R0050(TrendDaily):
    risk_policy = policy("0.005", "0.30")


class TrendDaily_R0100(TrendDaily):
    risk_policy = policy("0.01", "0.50")


class TrendDaily_R0200(TrendDaily):
    risk_policy = policy("0.02", "0.50")


class DualMomentum_R0025(DualMomentum):
    risk_policy = policy("0.0025", "0.20")


class DualMomentum_R0050(DualMomentum):
    risk_policy = policy("0.005", "0.30")


class DualMomentum_R0100(DualMomentum):
    risk_policy = policy("0.01", "0.50")


class DualMomentum_R0200(DualMomentum):
    risk_policy = policy("0.02", "0.50")
