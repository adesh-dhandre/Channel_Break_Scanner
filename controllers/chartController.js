const {
    getCachedCandles
  } = require("../services/marketDataCache");
  
  
  const TIMEFRAME_MINUTES = {
    "5m": 5,
    "15m": 15,
    "30m": 30,
    "45m": 45,
    "1h": 60,
    "2h": 120
  };
  
  
  function aggregateCandles(
    candles,
    minutes
  ) {
  
    const candlesPerGroup =
      minutes / 5;
  
    const result = [];
  
  
    for (
      let i = 0;
      i < candles.length;
      i += candlesPerGroup
    ) {
  
      const group =
        candles.slice(
          i,
          i + candlesPerGroup
        );
  
  
      if (
        group.length <
        candlesPerGroup
      ) {
        continue;
      }
  
  
      result.push({
  
        date:
          group[0].date,
  
        open:
          group[0].open,
  
        high:
          Math.max(
            ...group.map(
              candle =>
                candle.high
            )
          ),
  
        low:
          Math.min(
            ...group.map(
              candle =>
                candle.low
            )
          ),
  
        close:
          group[
            group.length - 1
          ].close
  
      });
  
    }
  
  
    return result;
  }
  
  
  function getChartData(
    req,
    res
  ) {
  
    try {
  
      const symbol =
        req.params.symbol;
  
      const timeframe =
        req.query.timeframe ||
        "1h";
  
  
      const minutes =
        TIMEFRAME_MINUTES[
          timeframe
        ];
  
  
      if (!minutes) {
  
        return res
          .status(400)
          .json({
  
            success: false,
  
            message:
              "Invalid timeframe. Use 5m, 15m, 30m, 45m, 1h or 2h."
  
          });
  
      }
  
  
      const cachedCandles =
        getCachedCandles(
          symbol
        );
  
  
      if (
        !cachedCandles ||
        cachedCandles.length === 0
      ) {
  
        return res
          .status(404)
          .json({
  
            success: false,
  
            message:
              `No cached candles found for ${symbol}. Run the scanner first.`
  
          });
  
      }
  
  
      const candles =
        minutes === 5
  
          ? cachedCandles
  
          : aggregateCandles(
              cachedCandles,
              minutes
            );
  
  
      const chartCandles =
        candles.slice(-300);
  
  
      return res.json({
  
        success: true,
  
        data: {
  
          symbol,
  
          timeframe,
  
          candles:
            chartCandles
  
        }
  
      });
  
  
    } catch (error) {
  
      console.error(
        "Chart API error:",
        error
      );
  
  
      return res
        .status(500)
        .json({
  
          success: false,
  
          message:
            "Unable to load chart data."
  
        });
  
    }
  
  }
  
  
  module.exports = {
    getChartData
  };