"""Tendencia lenta en velas diarias: pocas operaciones, posiciones de semanas.

Ruptura del máximo de 20 días con el precio sobre la SMA200; salida al perder el mínimo
de 10 días o la SMA200. Stop inicial 2×ATR(20). Parámetros fijos (ver docs/decisions/0002).
"""

from pandas import DataFrame

from lib.daily_base import DailyRiskStrategy
from lib.indicators import atr


class TrendDaily(DailyRiskStrategy):
    stoploss = -0.25

    entry_lookback = 20
    exit_lookback = 10
    atr_period = 20
    stop_atr_mult = 2.0

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe["sma200"] = dataframe["close"].rolling(200).mean()
        dataframe["atr"] = atr(dataframe, self.atr_period)
        dataframe["breakout_level"] = dataframe["high"].rolling(self.entry_lookback).max().shift(1)
        dataframe["exit_level"] = dataframe["low"].rolling(self.exit_lookback).min().shift(1)
        dataframe["stop_price"] = dataframe["close"] - self.stop_atr_mult * dataframe["atr"]
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (dataframe["close"] > dataframe["breakout_level"])
            & (dataframe["close"] > dataframe["sma200"])
            & (dataframe["volume"] > 0),
            ["enter_long", "enter_tag"],
        ] = (1, "daily_breakout")
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (dataframe["close"] < dataframe["exit_level"]) | (dataframe["close"] < dataframe["sma200"]),
            ["exit_long", "exit_tag"],
        ] = (1, "daily_trend_exit")
        return dataframe
