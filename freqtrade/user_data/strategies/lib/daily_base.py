"""Base para estrategias diarias: sizing por riesgo y stop fijo desde la vela de la señal.

Cada estrategia define `stop_price` en populate_indicators y sus reglas de entrada/salida.
"""

from datetime import datetime

import pandas as pd

from freqtrade.persistence import Trade
from freqtrade.strategy import IStrategy, stoploss_from_absolute

from lib.sizing import RiskPolicy, risk_stake


class DailyRiskStrategy(IStrategy):
    INTERFACE_VERSION = 3

    timeframe = "1d"
    can_short = False
    process_only_new_candles = True
    startup_candle_count = 210

    minimal_roi = {"0": 100}
    stoploss = -0.30  # piso duro; el stop real es custom_stoploss
    use_custom_stoploss = True
    use_exit_signal = True

    risk_policy = RiskPolicy()

    @property
    def protections(self):
        return [{"method": "CooldownPeriod", "stop_duration_candles": 1}]

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
