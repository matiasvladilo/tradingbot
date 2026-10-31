from decimal import Decimal

from lib.sizing import RiskPolicy, daily_loss_breached, risk_stake

NO_FEES = RiskPolicy(fee_rate=Decimal("0"))


def test_stake_by_risk():
    # riesgo 0,25% de 1000 = 2,5; distancia al stop 2% -> 125 de importe
    stake = risk_stake(1000, 100, 98, free_cash=1000, min_stake=5, policy=NO_FEES)
    assert stake == Decimal("125.00")


def test_capped_by_asset_limit():
    # stop muy cercano: por riesgo serían 2500, tope 20% = 200
    stake = risk_stake(1000, 100, 99.9, free_cash=1000, min_stake=5, policy=NO_FEES)
    assert stake == Decimal("200.00")


def test_capped_by_free_cash():
    stake = risk_stake(1000, 100, 98, free_cash=50, min_stake=5, policy=NO_FEES)
    assert stake == Decimal("50.00")


def test_fees_reduce_stake():
    with_fees = risk_stake(1000, 100, 98, free_cash=1000, min_stake=5)
    assert with_fees < Decimal("125.00")


def test_rounds_down():
    stake = risk_stake(1000, 100, 97, free_cash=1000, min_stake=5, policy=NO_FEES)
    # 2,5 / 3 * 100 = 83,333... -> 83,33
    assert stake == Decimal("83.33")


def test_below_minimum_skips_trade():
    # 10 de patrimonio: por riesgo 1,25 < mínimo 5 -> no opera, no sube el riesgo
    assert risk_stake(10, 100, 98, free_cash=10, min_stake=5, policy=NO_FEES) == 0


def test_invalid_stop_skips_trade():
    assert risk_stake(1000, 100, 100, free_cash=1000, min_stake=5) == 0
    assert risk_stake(1000, 100, 101, free_cash=1000, min_stake=5) == 0
    assert risk_stake(1000, 100, 0, free_cash=1000, min_stake=5) == 0


def test_none_min_stake():
    assert risk_stake(1000, 100, 98, free_cash=1000, min_stake=None, policy=NO_FEES) > 0


def test_daily_loss():
    # día empezó en 1000, va -10 -> 1% -> bloquea
    assert daily_loss_breached(990, -10) is True
    assert daily_loss_breached(995, -5) is False
    assert daily_loss_breached(1020, 20) is False
