"""Modo práctica manual: la estrategia nunca genera entradas; las decide el usuario.

Las órdenes llegan por la API (forceenter) con su stop y objetivo en el entry_tag.
La estrategia valida las reglas de práctica, aplica el stop y el objetivo, y calcula
indicadores de apoyo para el gráfico de 5 minutos.
"""

from datetime import datetime, timezone

from pandas import DataFrame

from freqtrade.persistence import Trade
from freqtrade.strategy import IStrategy, stoploss_from_absolute

from lib.indicators import atr, ema
from lib.manual import parse_tag, validate_entry


class ManualPractice(IStrategy):
    INTERFACE_VERSION = 3

    timeframe = "5m"
    can_short = False
    process_only_new_candles = True
    startup_candle_count = 300

    minimal_roi = {"0": 100}
    stoploss = -0.20  # piso duro; el stop real es el que define el usuario
    use_custom_stoploss = True
    use_exit_signal = False

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe["ema20"] = ema(dataframe["close"], 20)
        dataframe["ema50"] = ema(dataframe["close"], 50)
        dataframe["atr"] = atr(dataframe, 14)
        dataframe["volume_ma"] = dataframe["volume"].rolling(20).mean()
        # VWAP anclado al día UTC
        day = dataframe["date"].dt.floor("D")
        typical = (dataframe["high"] + dataframe["low"] + dataframe["close"]) / 3
        pv = (typical * dataframe["volume"]).groupby(day).cumsum()
        vol = dataframe["volume"].groupby(day).cumsum()
        dataframe["vwap"] = pv / vol.where(vol > 0)
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        return dataframe

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
        opened_today = [t for t in Trade.get_trades_proxy() if t.open_date_utc >= day_start]
        closed_today = Trade.get_trades_proxy(is_open=False, close_date=day_start)
        pnl_today = sum(t.close_profit_abs or 0 for t in closed_today)
        reason = validate_entry(
            equity=self.wallets.get_total_stake_amount(),
            price=rate,
            amount=amount,
            tag=entry_tag,
            trades_today=len(opened_today),
            pnl_today=pnl_today,
        )
        if reason:
            self.dp.send_msg(f"Orden manual rechazada en {pair}: {reason}")
            return False
        return True

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
        stop = parse_tag(trade.enter_tag).get("stop")
        if not stop:
            return None
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
        target = parse_tag(trade.enter_tag).get("target")
        if target and current_rate >= target:
            return "target"
        return None
