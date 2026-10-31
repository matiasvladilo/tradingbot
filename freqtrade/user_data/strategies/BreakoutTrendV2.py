"""Variantes de BreakoutTrend: un cambio por clase para medirlos por separado.

Ver docs/decisions/0002. Parámetros fijados antes de medir.
"""

from datetime import datetime

from pandas import DataFrame

from freqtrade.persistence import Trade
from freqtrade.strategy import informative, stoploss_from_absolute

from BreakoutTrend import BreakoutTrend
from lib.indicators import atr, ema


class BreakoutTrendV2(BreakoutTrend):
    # Combinación aceptada en 2020–2024 (docs/decisions/0002): solo el filtro de régimen.
    use_breakeven = False
    use_quality_filter = False
    use_regime = True

    breakeven_at_r = 1.0
    breakout_atr_margin = 0.25
    # SMA200 diaria necesita ~200 días = 4.800 velas de 1h
    startup_candle_count = 4900

    @informative("4h")
    def populate_indicators_4h(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe["ema50"] = ema(dataframe["close"], 50)
        dataframe["ema200"] = ema(dataframe["close"], 200)
        dataframe["ema50_rising"] = (dataframe["ema50"] > dataframe["ema50"].shift(6)).astype(int)
        return dataframe

    @informative("1d")
    def populate_indicators_1d(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe["sma200"] = dataframe["close"].rolling(200).mean()
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        cond = (
            (dataframe["trend_up"] == 1)
            & (dataframe["close"] > dataframe["breakout_level"])
            & (dataframe["volume"] > dataframe["volume_ma"])
            & (dataframe["volume"] > 0)
        )
        if self.use_quality_filter:
            cond &= dataframe["close"] > dataframe["breakout_level"] + self.breakout_atr_margin * dataframe["atr"]
            cond &= dataframe["ema50_rising_4h"] == 1
        if self.use_regime:
            cond &= dataframe["close_1d"] > dataframe["sma200_1d"]
        dataframe.loc[cond, ["enter_long", "enter_tag"]] = (1, "breakout_v2")
        return dataframe

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
            return None
        stop = max(initial_stop, (trade.max_rate or trade.open_rate) - self.trail_atr_mult * entry_atr)
        if self.use_breakeven:
            risk = trade.open_rate - initial_stop
            if risk > 0 and (trade.max_rate or 0) >= trade.open_rate + self.breakeven_at_r * risk:
                fees = trade.fee_open + (trade.fee_close or trade.fee_open)
                stop = max(stop, trade.open_rate * (1 + fees))
        return stoploss_from_absolute(stop, current_rate, is_short=False)


class V2Breakeven(BreakoutTrendV2):
    use_breakeven = True
    use_quality_filter = False
    use_regime = False


class V2Filtro(BreakoutTrendV2):
    use_breakeven = False
    use_quality_filter = True
    use_regime = False


class V2Regimen(BreakoutTrendV2):
    use_breakeven = False
    use_quality_filter = False
    use_regime = True
