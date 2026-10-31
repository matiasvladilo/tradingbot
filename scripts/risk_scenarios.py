"""Resume un backtest de RiskScenarios (+ BuyAndHold) para la página Riesgo del dashboard.

Uso: .venv/Scripts/python scripts/risk_scenarios.py <backtest-result-...zip>
Escribe apps/web/data/risk.json.
"""

import io
import json
import re
import sys
import zipfile
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RESULTS = ROOT / "freqtrade" / "user_data" / "backtest_results"
OUT = ROOT / "apps" / "web" / "data" / "risk.json"
SPLIT = pd.Timestamp("2025-01-01", tz="UTC")
NAME = re.compile(r"^(?P<base>\w+?)_R(?P<risk>\d{4})$")


def equity_series(z: zipfile.ZipFile, stem: str, strategy: str) -> pd.Series:
    wallet = pd.read_feather(io.BytesIO(z.read(f"{stem}_{strategy}_wallet.feather")))
    return wallet.groupby("date")["total_quote"].sum().resample("1D").last().dropna()


def summarize(equity: pd.Series, start: float) -> dict:
    peak = equity.cummax()
    dd = equity / peak - 1
    years = (equity.index[-1] - equity.index[0]).days / 365.25
    before = equity[equity.index < SPLIT]
    after = equity[equity.index >= SPLIT]
    yearly = equity.groupby(equity.index.year).last()
    prev = yearly.shift(1)
    prev.iloc[0] = start
    yearly_ret = yearly / prev - 1
    weekly = equity.resample("1W").last().dropna()
    return {
        "final": float(equity.iloc[-1]),
        "total_return": float(equity.iloc[-1] / start - 1),
        "cagr": float((equity.iloc[-1] / start) ** (1 / years) - 1) if years > 0 else None,
        "max_drawdown": float(-dd.min()),
        "lowest_equity": float(equity.min()),
        "worst_peak_to_trough": {
            "peak": float(peak[dd.idxmin()]),
            "trough": float(equity[dd.idxmin()]),
            "date": dd.idxmin().strftime("%Y-%m-%d"),
        },
        "return_2020_2024": float(before.iloc[-1] / start - 1) if len(before) else None,
        "return_2025_now": float(after.iloc[-1] / before.iloc[-1] - 1) if len(after) and len(before) else None,
        "yearly": [{"year": int(y), "return": float(r)} for y, r in yearly_ret.items()],
        "curve": [{"t": d.strftime("%Y-%m-%d"), "equity": round(float(v), 2)} for d, v in weekly.items()],
    }


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__)
        return 1
    path = Path(argv[1]) if Path(argv[1]).exists() else RESULTS / argv[1]
    stem = path.stem
    with zipfile.ZipFile(path) as z:
        data = json.loads(z.read(f"{stem}.json"))["strategy"]
        rows = []
        for name, s in data.items():
            m = NAME.match(name)
            base, risk = (m["base"], int(m["risk"]) / 10000) if m else (name, None)
            rows.append(
                {
                    "strategy": name,
                    "base": base,
                    "risk": risk,
                    "trades": s["total_trades"],
                    "start": s["backtest_start"],
                    "end": s["backtest_end"],
                    **summarize(equity_series(z, stem, name), s["starting_balance"]),
                }
            )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"source": stem, "scenarios": rows}), encoding="utf-8")
    for r in rows:
        risk = f"{r['risk']:.2%}" if r["risk"] else "100%"
        print(
            f"{r['base']:<13} riesgo={risk:<6} final={r['final']:>8.0f} total={r['total_return']:+.0%} "
            f"CAGR={r['cagr']:+.1%} DD={r['max_drawdown']:.1%} 20-24={r['return_2020_2024']:+.0%} "
            f"25-hoy={r['return_2025_now']:+.1%} peor año={min(y['return'] for y in r['yearly']):+.1%}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
