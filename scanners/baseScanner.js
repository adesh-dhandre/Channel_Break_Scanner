function detectBaseAfterFlashSell(
    candles,
    flashSellDate,
    maxCandlesAfter = 4,
    maxBodyPercent = 0.25,
    maxBearishClosePercent = 0.35
) {
    if (!candles || candles.length === 0) {
        return {
            isBaseForming: false,
            reason: "No candles"
        };
    }

    const flashIndex = candles.findIndex(
        candle =>
            new Date(candle.date).getTime() ===
            new Date(flashSellDate).getTime()
    );

    if (flashIndex === -1) {
        return {
            isBaseForming: false,
            reason: "Flash sell candle not found"
        };
    }

    const candlesAfter = candles.slice(
        flashIndex + 1,
        flashIndex + 1 + maxCandlesAfter
    );

    if (candlesAfter.length === 0) {
        return {
            isBaseForming: false,
            reason: "No candles after flash sell"
        };
    }

    const analyzedCandles = candlesAfter.map(candle => {

        const open = candle.open;
        const high = candle.high;
        const low = candle.low;
        const close = candle.close;

        const bodySize =
            Math.abs(close - open);

        const candleRange =
            high - low;

        const lowerBody =
            Math.min(open, close);

        const upperBody =
            Math.max(open, close);

        const lowerWick =
            lowerBody - low;

        const upperWick =
            high - upperBody;

        const bodyPercent =
            (bodySize / open) * 100;

        const bearishClosePercent =
            close < open
                ? ((open - close) / open) * 100
                : 0;

        const bodyRatio =
            candleRange > 0
                ? bodySize / candleRange
                : 0;

        const lowerWickRatio =
            candleRange > 0
                ? lowerWick / candleRange
                : 0;

        const upperWickRatio =
            candleRange > 0
                ? upperWick / candleRange
                : 0;


        // -----------------------------------
        // DOJI / VERY SMALL BODY
        // -----------------------------------

        const isDoji =
            bodyPercent <= maxBodyPercent &&
            bodyRatio <= 0.30;


        // -----------------------------------
        // HAMMER
        // -----------------------------------

        const isHammer =
            bodyRatio <= 0.40 &&
            lowerWick >= bodySize * 2 &&
            lowerWickRatio >= 0.50;


        // -----------------------------------
        // LONG LOWER-WICK REJECTION
        // -----------------------------------

        const hasLongLowerWick =
            lowerWickRatio >= 0.45 &&
            lowerWick >= bodySize * 1.5;


        // -----------------------------------
        // BEARISH MOMENTUM REDUCED
        // -----------------------------------

        const bearishMomentumReduced =
            bearishClosePercent <=
            maxBearishClosePercent;


        // -----------------------------------
        // VALID BASE / REJECTION CANDLE
        // -----------------------------------

        const isBaseCandle =
            bearishMomentumReduced &&
            (
                isDoji ||
                isHammer ||
                hasLongLowerWick
            );


        return {
            date: candle.date,

            open,
            high,
            low,
            close,

            bodyPercent:
                Number(
                    bodyPercent.toFixed(2)
                ),

            bodyRatio:
                Number(
                    bodyRatio.toFixed(2)
                ),

            lowerWick:
                Number(
                    lowerWick.toFixed(4)
                ),

            upperWick:
                Number(
                    upperWick.toFixed(4)
                ),

            lowerWickRatio:
                Number(
                    lowerWickRatio.toFixed(2)
                ),

            upperWickRatio:
                Number(
                    upperWickRatio.toFixed(2)
                ),

            isDoji,

            isHammer,

            hasLongLowerWick,

            bearishMomentumReduced,

            isBaseCandle
        };
    });


    const baseCandles =
        analyzedCandles.filter(
            candle =>
                candle.isBaseCandle
        );


    const isBaseForming =
        baseCandles.length >= 1;


    return {
        isBaseForming,

        candlesChecked:
            analyzedCandles.length,

        baseCandlesFound:
            baseCandles.length,

        candles:
            analyzedCandles
    };
}


module.exports = {
    detectBaseAfterFlashSell
};