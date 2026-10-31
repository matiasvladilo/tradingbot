"""Baseline: compra BTC y ETH en partes iguales al inicio y mantiene hasta el final."""

from datetime import datetime

from pandas import DataFrame

from freqtrade.strategy import IStrategy


class BuyAndHold(IStrategy):
    INTERFACE_VERSION = 3

    timeframe = "1h"
    can_short = False
    startup_candle_count = 0

    minimal_roi = {"0": 100}
    stoploss = -0.99
    use_exit_signal = False

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[dataframe["volume"] > 0, "enter_long"] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        return dataframe

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
        pairs = len(self.config["exchange"]["pair_whitelist"])
        return min(self.wallets.get_total_stake_amount() / pairs, max_stake)
