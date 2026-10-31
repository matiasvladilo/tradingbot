from lib.manual import PracticeRules, parse_tag, validate_entry

TAG = "m;s=95;t=110;k=ruptura"


def test_parse_tag():
    assert parse_tag(TAG) == {"stop": 95.0, "target": 110.0, "setup": "ruptura"}
    assert parse_tag("m;s=95") == {"stop": 95.0}
    assert parse_tag("m;s=abc;k=") == {}
    assert parse_tag("breakout") == {}
    assert parse_tag(None) == {}


def ok(**kw):
    args = dict(equity=1000, price=100, amount=2, tag=TAG, trades_today=0, pnl_today=0)
    args.update(kw)
    return validate_entry(**args)


def test_valid_order():
    # riesgo 2 × 5 = 10 = 1% del patrimonio
    assert ok() is None


def test_requires_stop_below_price():
    assert "stop" in ok(tag="m;t=110")
    assert "stop" in ok(tag="m;s=100")
    assert "stop" in ok(tag="m;s=105")


def test_target_must_be_above_price():
    assert "objetivo" in ok(tag="m;s=95;t=99")


def test_risk_limit():
    # 5 unidades × 5 = 25 = 2,5% > 2%
    assert "riesgo" in ok(amount=5)


def test_position_size_limit():
    # stop muy cerca: 6 × 100 = 600 > 50% del patrimonio
    assert "posición" in ok(amount=6, tag="m;s=99.9")


def test_daily_limits():
    assert "operaciones" in ok(trades_today=PracticeRules().max_trades_per_day)
    # empezó el día en 1000 y va -30 = 3%
    assert "pérdida" in ok(equity=970, pnl_today=-30)
    assert ok(equity=980, pnl_today=-20) is None
