"""Resume los backtests de Freqtrade en un JSON compacto para el dashboard.

Uso: .venv/Scripts/python scripts/export_backtests.py
Lee freqtrade/user_data/backtest_results/*.zip y escribe apps/web/data/backtests.json
con métricas y curva de patrimonio diaria por estrategia.
"""

import io
import json
import sys
import zipfile
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RESULTS = ROOT / "freqtrade" / "user_data" / "backtest_results"
OUT = ROOT / "apps" / "web" / "data" / "backtests.json"

METRICS = [
    "total_trades",
    "profit_total",
    "profit_total_abs",
    "cagr",
    "max_drawdown_account",
    "max_drawdown_abs",
    "winrate",
    "profit_factor",
    "expectancy",
    "sharpe",
    "starting_balance",
    "final_balance",
    "market_change",
    "holding_avg",
    "trades_per_day",
]


def _member(z: zipfile.ZipFile, suffix: str) -> str | None:
    return next((n for n in z.namelist() if n.endswith(suffix)), None)


def equity_curve(z: zipfile.ZipFile, strategy: str) -> list[dict]:
    name = _member(z, f"_{strategy}_wallet.feather")
    if not name:
        return []
    wallet = pd.read_feather(io.BytesIO(z.read(name)))
    equity = wallet.groupby("date")["total_quote"].sum().resample("1D").last().dropna()
    peak = equity.cummax()
    return [
        {"t": d.strftime("%Y-%m-%d"), "equity": round(v, 2), "drawdown": round(v / p - 1, 4)}
        for d, v, p in zip(equity.index, equity.values, peak.values)
    ]


def summarize(path: Path) -> dict:
    with zipfile.ZipFile(path) as z:
        data = json.loads(z.read(_member(z, f"{path.stem}.json")))
        strategies = []
        for name, s in data["strategy"].items():
            trades = s["trades"]
            curve = equity_curve(z, name)
            metrics = {k: s.get(k) for k in METRICS}
            # max_drawdown_account solo mira operaciones cerradas; el de la curva incluye lo no realizado
            metrics["equity_max_drawdown"] = -min((p["drawdown"] for p in curve), default=0)
            strategies.append(
                {
                    "name": name,
                    "metrics": metrics,
                    "fee": trades[0]["fee_open"] if trades else None,
                    "equity": curve,
                    "trades": [
                        {
                            "trade_id": i + 1,
                            "pair": t["pair"],
                            "open_timestamp": t["open_timestamp"],
                            "close_timestamp": t["close_timestamp"],
                            "open_rate": t["open_rate"],
                            "close_rate": t["close_rate"],
                            "stake_amount": t["stake_amount"],
                            "profit_abs": t["profit_abs"],
                            "profit_ratio": t["profit_ratio"],
                            "exit_reason": t["exit_reason"],
                        }
                        for i, t in enumerate(trades)
                    ],
                    "exit_reasons": [
                        {"reason": r["key"], "trades": r["trades"], "profit_abs": r["profit_total_abs"]}
                        for r in s.get("exit_reason_summary", [])
                        if r.get("key") != "TOTAL"
                    ],
                }
            )
        first = next(iter(data["strategy"].values()))
        return {
            "id": path.stem,
            "start": first["backtest_start"],
            "end": first["backtest_end"],
            "timerange": first.get("timerange"),
            "strategies": strategies,
        }


def main() -> int:
    runs = [summarize(p) for p in sorted(RESULTS.glob("backtest-result-*.zip"))]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"runs": runs}, default=str), encoding="utf-8")
    print(f"{len(runs)} backtests -> {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
