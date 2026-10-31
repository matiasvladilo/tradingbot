import numpy as np

from monte_carlo import analyze, equity_paths, max_drawdowns, trade_returns, without_best


def trade(close_ts, profit):
    return {"close_timestamp": close_ts, "profit_abs": profit}


def test_returns_compound_on_realized_equity():
    r = trade_returns([trade(2, -50), trade(1, 100)], starting_balance=1000)
    # ordena por cierre: +100 sobre 1000, luego -50 sobre 1100
    assert np.allclose(r, [0.1, -50 / 1100])


def test_paths_start_at_one_and_are_reproducible():
    r = np.array([0.1, -0.05, 0.02])
    a, b = equity_paths(r, sims=100, seed=1), equity_paths(r, sims=100, seed=1)
    assert a.shape == (100, 4)
    assert np.all(a[:, 0] == 1)
    assert np.array_equal(a, b)


def test_max_drawdown():
    paths = np.array([[1.0, 1.2, 0.9, 1.1]])
    assert np.isclose(max_drawdowns(paths)[0], 0.9 / 1.2 - 1)


def test_without_best_removes_largest():
    r = np.array([0.5, 0.1, -0.1])
    assert np.isclose(without_best(r, 0), 1.5 * 1.1 * 0.9 - 1)
    assert np.isclose(without_best(r, 1), 1.1 * 0.9 - 1)


def test_all_losers_always_lose():
    trades = [trade(i, -10) for i in range(10)]
    out = analyze(trades, 1000)
    assert out["prob_loss"] == 1.0
    assert out["actual_return"] < 0
