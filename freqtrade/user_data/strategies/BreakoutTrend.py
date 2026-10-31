"""Estrategia v1: ruptura en 1h con filtro de tendencia en 4h.

Parámetros fijados antes de medir (ver docs/decisions/0001). No se optimizan
sobre la ventana de evaluación.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pandas as pd
from pandas import DataFrame

from freqtrade.persistence import Trade
from freqtrade.strategy import IStrategy, informative, stoploss_from_absolute

from lib.indicators import atr, ema
from lib.sizing import RiskPolicy, daily_loss_breached, risk_stake


class BreakoutTrend(IStrategy):
    INTERFACE_VERSION = 3

    timeframe = "1h"
    can_short = False
    process_only_new_candles = True
    # EMA200 en 4h necesita ~200 velas de 4h = 800 de 1h
    startup_candle_count = 850

    # Salidas gestionadas por stop/custom_exit, no por ROI
    minimal_roi = {"0": 100}
    stoploss = -0.15  # piso duro; el stop real es custom_stoploss
    use_custom_stoploss = True
    use_exit_signal = False

    breakout_lookback = 20
    volume_lookback = 20
    atr_period = 14
    stop_atr_mult = 2.0
    trail_atr_mult = 3.0
    max_hold = timedelta(hours=72)
    daily_loss_limit = Decimal("0.01")

    risk_policy = RiskPolicy()

    @property
    def protections(self):
        return [
            {"method": "CooldownPeriod", "stop_duration_candles": 2},
            {
                "method": "StoplossGuard",
                "lookback_period_candles": 24,
                "trade_limit": 3,
                "stop_duration_candles": 12,
                "only_per_pair": False,
            },
            {
                "method": "MaxDrawdown",
                "lookback_period_candles": 24 * 7,
                "trade_limit": 2,
                "stop_duration_candles": 24,
                "max_allowed_drawdown": 0.05,
            },
        ]

    @informative("4h")
    def populate_indicators_4h(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe["ema50"] = ema(dataframe["close"], 50)
        dataframe["ema200"] = ema(dataframe["close"], 200)
        return dataframe

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe["atr"] = atr(dataframe, self.atr_period)
        # máximo de las N velas anteriores, sin incluir la actual
        dataframe["breakout_level"] = dataframe["high"].rolling(self.breakout_lookback).max().shift(1)
        dataframe["volume_ma"] = dataframe["volume"].rolling(self.volume_lookback).mean()
        dataframe["stop_price"] = dataframe["close"] - self.stop_atr_mult * dataframe["atr"]
        dataframe["trend_up"] = (dataframe["ema50_4h"] > dataframe["ema200_4h"]).astype(int)
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (dataframe["trend_up"] == 1)
            & (dataframe["close"] > dataframe["breakout_level"])
            & (dataframe["volume"] > dataframe["volume_ma"])
            & (dataframe["volume"] > 0),
            ["enter_long", "enter_tag"],
        ] = (1, "breakout_1h_trend_4h")
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
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
        stake = risk_stake(
            equity=self.wallets.get_total_stake_amount(),
            entry_price=current_rate,
            stop_price=candle["stop_price"],
            free_cash=max_stake,
            min_stake=min_stake,
            policy=self.risk_policy,
        )
        return float(stake)

    def confirm_trade_entry(
        self,
        pair: str,
        order_type: str,
        amount: float,
        rate: float,
        time_in_force: str,
        current_time: datetime,
        entry_tag: str | None,
        side: str,
        **kwargs,
    ) -> bool:
        day_start = current_time.astimezone(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        realized = sum(
            t.close_profit_abs or 0 for t in Trade.get_trades_proxy(is_open=False, close_date=day_start)
        )
        unrealized = 0.0
        for t in Trade.get_trades_proxy(is_open=True):
            candle = self._last_candle(t.pair)
            if candle is not None:
                unrealized += t.calc_profit(candle["close"])
        equity = self.wallets.get_total_stake_amount()
        if daily_loss_breached(equity, realized + unrealized, self.daily_loss_limit):
            return False
        return True

    def order_filled(self, pair: str, trade: Trade, order, current_time: datetime, **kwargs) -> None:
        # Fija el stop inicial con la vela de la señal, una sola vez
        if order.ft_order_side != trade.entry_side or trade.get_custom_data("initial_stop"):
            return
        candle = self._last_candle(pair)
        if candle is None:
            return
        trade.set_custom_data("initial_stop", float(candle["stop_price"]))
        trade.set_custom_data("entry_atr", float(candle["atr"]))

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
        entry_atr = trade.get_custom_data("entry_atr")
        if not initial_stop or not entry_atr:
            return None  # usa el piso duro
        trailing = (trade.max_rate or trade.open_rate) - self.trail_atr_mult * entry_atr
        stop = max(initial_stop, trailing)
        return stoploss_from_absolute(stop, current_rate, is_short=False)

    def custom_exit(
        self,
        pair: str,
        trade: Trade,
        current_time: datetime,
        current_rate: float,
        current_profit: float,
        **kwargs,
    ):
        if current_time - trade.open_date_utc >= self.max_hold:
            return "max_hold"
        candle = self._last_candle(pair)
        if candle is not None and candle["trend_up"] == 0:
            return "trend_invalidated"
        return None
