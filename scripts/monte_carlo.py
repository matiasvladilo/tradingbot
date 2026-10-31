"""Monte Carlo sobre las operaciones de un backtest: ¿qué tan robusto es el resultado?

Uso:
  .venv/Scripts/python scripts/monte_carlo.py <zip> <estrategia> [<zip> <estrategia> ...]

Para cada estrategia:
- Bootstrap: arma 10.000 historias remuestreando sus operaciones (con reemplazo) y mide
  resultado final, caída máxima y probabilidad de terminar en pérdida.
- Sin las mejores: resultado si no hubieran existido las K mejores operaciones.
Escribe apps/web/data/montecarlo.json.

Limitaciones: trata las operaciones como independientes, ignora el solapamiento entre
posiciones y mide la caída entre cierres de operaciones (no dentro de una operación).
"""

import json
import sys
import zipfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
RESULTS = ROOT / "freqtrade" / "user_data" / "backtest_results"
OUT = ROOT / "apps" / "web" / "data" / "montecarlo.json"

SIMS = 10_000
SEED = 42
PCTS = [5, 25, 50, 75, 95]


def trade_returns(trades: list[dict], starting_balance: float) -> np.ndarray:
    """Retorno de cada operación sobre el patrimonio realizado antes de su cierre."""
    ordered = sorted(trades, key=lambda t: t["close_timestamp"])
    equity = starting_balance
    returns = []
    for t in ordered:
        returns.append(t["profit_abs"] / equity)
        equity += t["profit_abs"]
    return np.array(returns)


def equity_paths(returns: np.ndarray, sims: int = SIMS, seed: int = SEED) -> np.ndarray:
    """Matriz sims × (n+1) de patrimonio relativo (empieza en 1) remuestreando operaciones."""
    rng = np.random.default_rng(seed)
    idx = rng.integers(0, len(returns), size=(sims, len(returns)))
    growth = np.cumprod(1 + returns[idx], axis=1)
    return np.hstack([np.ones((sims, 1)), growth])


def max_drawdowns(paths: np.ndarray) -> np.ndarray:
    peaks = np.maximum.accumulate(paths, axis=1)
    return (paths / peaks - 1).min(axis=1)


def without_best(returns: np.ndarray, k: int) -> float:
    """Resultado total compuesto quitando las k operaciones de mayor retorno."""
    kept = np.sort(returns)[: len(returns) - k] if k else returns
    return float(np.prod(1 + kept) - 1)


def analyze(trades: list[dict], starting_balance: float) -> dict:
    r = trade_returns(trades, starting_balance)
    paths = equity_paths(r)
    final = paths[:, -1] - 1
    dd = max_drawdowns(paths)
    hist, edges = np.histogram(final * 100, bins=40)
    bands = np.percentile(paths, PCTS, axis=0)
    step = max(1, len(r) // 60)
    return {
        "trades": len(r),
        "actual_return": float(np.prod(1 + r) - 1),
        "actual_max_drawdown": float(max_drawdowns(np.cumprod(np.r_[1, 1 + r])[None, :])[0]),
        "win_rate": float((r > 0).mean()),
        "prob_loss": float((final < 0).mean()),
        "final_pct": {str(p): float(v) for p, v in zip(PCTS, np.percentile(final, PCTS))},
        "drawdown_pct": {str(p): float(v) for p, v in zip(PCTS, np.percentile(dd, PCTS))},
        "histogram": [
            {"from": round(float(a), 2), "to": round(float(b), 2), "count": int(c)}
            for a, b, c in zip(edges[:-1], edges[1:], hist)
        ],
        "bands": [
            {"trade": int(i), **{f"p{p}": round(float(bands[j, i]), 4) for j, p in enumerate(PCTS)}}
            for i in range(0, paths.shape[1], step)
        ],
        "without_best": [{"k": k, "return": without_best(r, k)} for k in (0, 1, 2, 3, 5)],
        # versión dura: el futuro no repite las 2 mejores operaciones
        "prob_loss_without_top2": float((equity_paths(np.sort(r)[:-2])[:, -1] < 1).mean()) if len(r) > 2 else None,
        "median_without_top2": float(np.median(equity_paths(np.sort(r)[:-2])[:, -1]) - 1) if len(r) > 2 else None,
    }


def load(zip_name: str, strategy: str) -> dict:
    path = Path(zip_name) if Path(zip_name).exists() else RESULTS / zip_name
    with zipfile.ZipFile(path) as z:
        name = next(n for n in z.namelist() if n.endswith(f"{path.stem}.json"))
        s = json.loads(z.read(name))["strategy"][strategy]
    return {
        "strategy": strategy,
        "source": path.stem,
        "start": s["backtest_start"],
        "end": s["backtest_end"],
        "fee": s["trades"][0]["fee_open"] if s["trades"] else None,
        **analyze(s["trades"], s["starting_balance"]),
    }


def main(argv: list[str]) -> int:
    pairs = argv[1:]
    if not pairs or len(pairs) % 2:
        print(__doc__)
        return 1
    results = [load(z, s) for z, s in zip(pairs[::2], pairs[1::2])]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"sims": SIMS, "results": results}), encoding="utf-8")
    for r in results:
        print(
            f"{r['strategy']:<15} {r['start'][:10]}→{r['end'][:10]} ops={r['trades']:<4} "
            f"real={r['actual_return']:+.1%} p5={r['final_pct']['5']:+.1%} p50={r['final_pct']['50']:+.1%} "
            f"p95={r['final_pct']['95']:+.1%} P(pérdida)={r['prob_loss']:.1%} "
            f"DD p95={r['drawdown_pct']['5']:.1%} sin_top2={r['without_best'][2]['return']:+.1%} "
            f"P(pérdida sin top2)={r['prob_loss_without_top2']:.1%} p50 sin top2={r['median_without_top2']:+.1%}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
