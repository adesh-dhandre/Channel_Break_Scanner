// ======================================================
// ASCENDING CHANNEL DETECTOR
//
// Shared by:
// - NSE F&O
// - Binance Crypto Futures
//
// Detects a rising, reasonably parallel price channel
// and PROJECTS that channel one candle forward so
// the next candle can be tested for a real breakdown.
// ======================================================


function linearRegression(values) {

    const n = values.length;

    if (n < 2) {
        return {
            slope: 0,
            intercept: values[0] || 0
        };
    }

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {

        sumX += i;
        sumY += values[i];
        sumXY += i * values[i];
        sumXX += i * i;
    }

    const denominator =
        n * sumXX -
        sumX * sumX;

    if (denominator === 0) {
        return {
            slope: 0,
            intercept: sumY / n
        };
    }

    const slope =
        (
            n * sumXY -
            sumX * sumY
        ) /
        denominator;

    const intercept =
        (
            sumY -
            slope * sumX
        ) /
        n;

    return {
        slope,
        intercept
    };
}


function lineValue(
    line,
    index
) {

    return (
        line.intercept +
        line.slope * index
    );
}


function detectAscendingChannel(
    candles,
    lookback = 12
) {

    if (
        !Array.isArray(candles) ||
        candles.length < lookback
    ) {

        return {
            isAscendingChannel: false,
            reason: "NOT_ENOUGH_CANDLES"
        };
    }


    const recentCandles =
        candles.slice(-lookback);


    const highs =
        recentCandles.map(
            candle =>
                Number(candle.high)
        );


    const lows =
        recentCandles.map(
            candle =>
                Number(candle.low)
        );


    const closes =
        recentCandles.map(
            candle =>
                Number(candle.close)
        );


    const highLine =
        linearRegression(highs);


    const lowLine =
        linearRegression(lows);


    const averagePrice =
        closes.reduce(
            (total, value) =>
                total + value,
            0
        ) /
        closes.length;


    if (
        !Number.isFinite(averagePrice) ||
        averagePrice <= 0
    ) {

        return {
            isAscendingChannel: false,
            reason: "INVALID_PRICE_DATA"
        };
    }


    const highSlopePercent =
        (
            highLine.slope /
            averagePrice
        ) * 100;


    const lowSlopePercent =
        (
            lowLine.slope /
            averagePrice
        ) * 100;


    const minimumSlopePercent =
        0.015;


    const bothRising =
        highSlopePercent >=
            minimumSlopePercent &&
        lowSlopePercent >=
            minimumSlopePercent;


    const maximumSlope =
        Math.max(
            Math.abs(highSlopePercent),
            Math.abs(lowSlopePercent)
        );


    const slopeDifference =
        Math.abs(
            highSlopePercent -
            lowSlopePercent
        );


    const parallelRatio =
        maximumSlope > 0
            ? slopeDifference /
                maximumSlope
            : 1;


    const roughlyParallel =
        parallelRatio <= 0.70;


    const firstIndex = 0;

    const lastIndex =
        recentCandles.length - 1;

    const nextIndex =
        recentCandles.length;


    const startUpper =
        lineValue(
            highLine,
            firstIndex
        );


    const startLower =
        lineValue(
            lowLine,
            firstIndex
        );


    const endUpper =
        lineValue(
            highLine,
            lastIndex
        );


    const endLower =
        lineValue(
            lowLine,
            lastIndex
        );


    const projectedUpper =
        lineValue(
            highLine,
            nextIndex
        );


    const projectedLower =
        lineValue(
            lowLine,
            nextIndex
        );


    const startWidth =
        startUpper -
        startLower;


    const endWidth =
        endUpper -
        endLower;


    const widthRatio =
        startWidth > 0
            ? endWidth /
                startWidth
            : 0;


    const widthStable =
        widthRatio >= 0.65 &&
        widthRatio <= 1.45;


    let respectedCandles = 0;


    for (
        let i = 0;
        i < recentCandles.length;
        i++
    ) {

        const upper =
            lineValue(
                highLine,
                i
            );


        const lower =
            lineValue(
                lowLine,
                i
            );


        const width =
            upper - lower;


        if (width <= 0) {
            continue;
        }


        const tolerance =
            width * 0.25;


        const close =
            recentCandles[i].close;


        if (
            close >=
                lower -
                tolerance &&
            close <=
                upper +
                tolerance
        ) {

            respectedCandles++;
        }
    }


    const respectRatio =
        respectedCandles /
        recentCandles.length;


    const channelRespected =
        respectRatio >= 0.65;


    const lastCandle =
        recentCandles[
            recentCandles.length - 1
        ];


    const endWidthSafe =
        Math.max(
            endWidth,
            averagePrice * 0.001
        );


    const lastTolerance =
        endWidthSafe * 0.30;


    const lastCandleStillInChannel =
        lastCandle.close >=
            endLower -
            lastTolerance &&
        lastCandle.close <=
            endUpper +
            lastTolerance;


    const isAscendingChannel =
        bothRising &&
        roughlyParallel &&
        widthStable &&
        channelRespected &&
        lastCandleStillInChannel;


    return {

        isAscendingChannel,

        reason:
            isAscendingChannel
                ? "VALID_ASCENDING_CHANNEL"
                : "CHANNEL_FILTER_FAILED",


        highSlopePercent:
            Number(
                highSlopePercent
                    .toFixed(4)
            ),

        lowSlopePercent:
            Number(
                lowSlopePercent
                    .toFixed(4)
            ),

        slopeDifference:
            Number(
                slopeDifference
                    .toFixed(4)
            ),

        parallelRatio:
            Number(
                parallelRatio
                    .toFixed(3)
            ),


        respectRatio:
            Number(
                respectRatio
                    .toFixed(2)
            ),


        startWidth:
            Number(
                startWidth
                    .toFixed(2)
            ),

        endWidth:
            Number(
                endWidth
                    .toFixed(2)
            ),

        widthRatio:
            Number(
                widthRatio
                    .toFixed(2)
            ),


        upperChannelValue:
            Number(
                endUpper
                    .toFixed(2)
            ),

        lowerChannelValue:
            Number(
                endLower
                    .toFixed(2)
            ),


        projectedUpperChannelValue:
            Number(
                projectedUpper
                    .toFixed(2)
            ),

        projectedLowerChannelValue:
            Number(
                projectedLower
                    .toFixed(2)
            ),


        lastCandleStillInChannel
    };
}


module.exports = {
    detectAscendingChannel,
    linearRegression
};