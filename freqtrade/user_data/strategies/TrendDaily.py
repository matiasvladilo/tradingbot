"""Tendencia lenta en velas diarias: pocas operaciones, posiciones de semanas.

Ruptura del máximo de 20 días con el precio sobre la SMA200; salida al perder el mínimo
de 10 días o la SMA200. Stop inicial 2×ATR(20). Parámetros fijos (ver docs/decisions/0002).
"""

from datetime import datetime

import pandas as pd
from pandas import DataFrame

from freqtrade.persistence import Trade
from freqtrade.strategy import IStrategy, stoploss_from_absolute

from lib.indicators import atr
from lib.sizing import RiskPolicy, risk_stake


class TrendDaily(IStrategy):
    INTERFACE_VERSION = 3

    timeframe = "1d"
    can_short = False
    process_only_new_candles = True
    startup_candle_count = 210

    minimal_roi = {"0": 100}
    stoploss = -0.25  # piso duro; el stop real es custom_stoploss
    use_custom_stoploss = True
    use_exit_signal = True

    entry_lookback = 20
    exit_lookback = 10
    atr_period = 20
    stop_atr_mult = 2.0

    risk_policy = RiskPolicy()

    @property
    def protections(self):
        return [{"method": "CooldownPeriod", "stop_duration_candles": 1}]

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

    def _last_candle(self, pair: str):
        dataframe, _ = self.dp.get_analyzed_dataframe(pair, self.timeframe)
        if dataframe is None or dataframe.empty:
            return None
        return dataframe.iloc[-1]

    def custom_stake_amount(
        self,
        pair: str,
        current_time: datetime,
        current_rate: float,
        proposed_stake: float,
        min_stake: float | None,
        max_stake: float,
        leverage: float,
        entry_tag: str | None,
        side: str,
        **kwargs,
    ) -> float:
        candle = self._last_candle(pair)
        if candle is None or pd.isna(candle["stop_price"]):
            return 0
        return float(
            risk_stake(
                equity=self.wallets.get_total_stake_amount(),
                entry_price=current_rate,
                stop_price=candle["stop_price"],
                free_cash=max_stake,
                min_stake=min_stake,
                policy=self.risk_policy,
            )
        )

    def order_filled(self, pair: str, trade: Trade, order, current_time: datetime, **kwargs) -> None:
        if order.ft_order_side != trade.entry_side or trade.get_custom_data("initial_stop"):
            return
        candle = self._last_candle(pair)
        if candle is not None:
            trade.set_custom_data("initial_stop", float(candle["stop_price"]))

    def custom_stoploss(
        self,
        pair: str,
        trade: Trade,
        current_time: datetime,
        current_rate: float,
        current_profit: float,
        after_fill: bool,
        **kwargs,
    ) -> float | None:
        initial_stop = trade.get_custom_data("initial_stop")
        if not initial_stop:
            return None
        return stoploss_from_absolute(initial_stop, current_rate, is_short=False)
