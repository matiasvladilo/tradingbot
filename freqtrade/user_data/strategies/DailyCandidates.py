"""Candidatas diarias de docs/decisions/0003. Parámetros fijados antes de medir."""

from datetime import datetime, timedelta

import pandas as pd
from pandas import DataFrame

from freqtrade.persistence import Trade

from BuyAndHold import BuyAndHold
from lib.daily_base import DailyRiskStrategy
from lib.indicators import atr

PAIRS = ["BTC/USDT", "ETH/USDT"]


def rsi(series: pd.Series, period: int) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0).ewm(alpha=1 / period, adjust=False).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1 / period, adjust=False).mean()
    return 100 - 100 / (1 + gain / loss.replace(0, 1e-12))


class MomentumVotes(DailyRiskStrategy):
    """Momentum de serie temporal: vota con retornos de 4 horizontes."""

    lookbacks = (20, 50, 100, 200)
    stop_atr_mult = 3.0

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        votes = sum((dataframe["close"] > dataframe["close"].shift(n)).astype(int) for n in self.lookbacks)
        dataframe["votes"] = votes
        dataframe["atr"] = atr(dataframe, 20)
        dataframe["stop_price"] = dataframe["close"] - self.stop_atr_mult * dataframe["atr"]
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[(dataframe["votes"] >= 3) & (dataframe["volume"] > 0), ["enter_long", "enter_tag"]] = (
            1,
            "momentum_votes",
        )
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[dataframe["votes"] <= 1, ["exit_long", "exit_tag"]] = (1, "momentum_lost")
        return dataframe


class DualMomentum(DailyRiskStrategy):
    """Momentum relativo + absoluto: mantener el par más fuerte solo si sube."""

    lookback = 30
    stop_atr_mult = 3.0

    def informative_pairs(self):
        return [(p, self.timeframe) for p in PAIRS]

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        other = next(p for p in PAIRS if p != metadata["pair"])
        other_df = self.dp.get_pair_dataframe(other, self.timeframe)[["date", "close"]].rename(
            columns={"close": "other_close"}
        )
        dataframe = dataframe.merge(other_df, on="date", how="left")
        dataframe["mom"] = dataframe["close"] / dataframe["close"].shift(self.lookback) - 1
        dataframe["other_mom"] = dataframe["other_close"] / dataframe["other_close"].shift(self.lookback) - 1
        dataframe["atr"] = atr(dataframe, 20)
        dataframe["stop_price"] = dataframe["close"] - self.stop_atr_mult * dataframe["atr"]
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (dataframe["mom"] > 0) & (dataframe["mom"] > dataframe["other_mom"]) & (dataframe["volume"] > 0),
            ["enter_long", "enter_tag"],
        ] = (1, "dual_momentum")
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (dataframe["mom"] <= 0) | (dataframe["other_mom"] > dataframe["mom"]), ["exit_long", "exit_tag"]
        ] = (1, "momentum_rotated")
        return dataframe


class RSI2Reversion(DailyRiskStrategy):
    """Comprar caídas fuertes de corto plazo dentro de una tendencia alcista."""

    stop_atr_mult = 3.0
    max_hold = timedelta(days=10)

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe["rsi2"] = rsi(dataframe["close"], 2)
        dataframe["sma200"] = dataframe["close"].rolling(200).mean()
        dataframe["sma5"] = dataframe["close"].rolling(5).mean()
        dataframe["atr"] = atr(dataframe, 20)
        dataframe["stop_price"] = dataframe["close"] - self.stop_atr_mult * dataframe["atr"]
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (dataframe["rsi2"] < 10) & (dataframe["close"] > dataframe["sma200"]) & (dataframe["volume"] > 0),
            ["enter_long", "enter_tag"],
        ] = (1, "rsi2_dip")
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[dataframe["close"] > dataframe["sma5"], ["exit_long", "exit_tag"]] = (1, "rsi2_rebound")
        return dataframe

    def custom_exit(self, pair: str, trade: Trade, current_time: datetime, current_rate: float, current_profit: float, **kwargs):
        if current_time - trade.open_date_utc >= self.max_hold:
            return "max_hold"
        return None


class BuyAndHold40(BuyAndHold):
    """Comprar y mantener con la misma exposición máxima que las candidatas (20% por activo)."""

    def custom_stake_amount(self, pair, current_time, current_rate, proposed_stake, min_stake, max_stake, leverage, entry_tag, side, **kwargs) -> float:
        return min(self.wallets.get_total_stake_amount() * 0.20, max_stake)
