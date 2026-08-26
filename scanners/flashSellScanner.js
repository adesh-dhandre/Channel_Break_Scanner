const {
    detectAscendingChannel
} = require("./channelScanner");


function detectFlashSells(
    candles,
    channelLookback = 12,
    minimumDropPercent = 0.7
) {

    const matches = [];


    if (
        !Array.isArray(candles) ||
        candles.length <
            channelLookback + 1
    ) {

        return matches;
    }


    for (
        let i = channelLookback;
        i < candles.length;
        i++
    ) {

        const channelCandles =
            candles.slice(
                i - channelLookback,
                i
            );


        const candidate =
            candles[i];


        const previousCandle =
            candles[i - 1];


        const channelResult =
            detectAscendingChannel(
                channelCandles,
                channelLookback
            );


        if (
            !channelResult
                .isAscendingChannel
        ) {

            continue;
        }


        const highSlope =
            Number(
                channelResult
                    .highSlopePercent
            );


        const lowSlope =
            Number(
                channelResult
                    .lowSlopePercent
            );


        const averageSlope =
            (
                highSlope +
                lowSlope
            ) / 2;


        // ==============================================
        // CLEAN MRF-STYLE CHANNEL QUALITY
        // ==============================================

        const minimumAverageSlope =
            0.04;


        const minimumRespectRatio =
            0.90;


        const channelStrongEnough =
            averageSlope >=
                minimumAverageSlope &&
            channelResult
                .respectRatio >=
                minimumRespectRatio;


        if (
            !channelStrongEnough
        ) {

            continue;
        }


        const projectedLower =
            Number(
                channelResult
                    .projectedLowerChannelValue
            );


        const projectedUpper =
            Number(
                channelResult
                    .projectedUpperChannelValue
            );


        if (
            !Number.isFinite(
                projectedLower
            ) ||
            !Number.isFinite(
                projectedUpper
            )
        ) {

            continue;
        }


        const channelWidth =
            projectedUpper -
            projectedLower;


        if (
            !Number.isFinite(
                channelWidth
            ) ||
            channelWidth <= 0
        ) {

            continue;
        }


        // ==============================================
        // PREVIOUS CANDLE STILL INSIDE CHANNEL
        // ==============================================

        const previousTolerance =
            channelWidth * 0.25;


        const previousStillValid =
            previousCandle.close >=
                channelResult
                    .lowerChannelValue -
                    previousTolerance &&
            previousCandle.close <=
                channelResult
                    .upperChannelValue +
                    previousTolerance;


        if (
            !previousStillValid
        ) {

            continue;
        }


        // ==============================================
        // STRONG BEARISH SELL
        // ==============================================

        const isBearish =
            candidate.close <
            candidate.open;


        if (
            !isBearish
        ) {

            continue;
        }


        const bodyDropPercent =
            (
                (
                    candidate.open -
                    candidate.close
                ) /
                candidate.open
            ) * 100;


        if (
            bodyDropPercent <
            minimumDropPercent
        ) {

            continue;
        }


        const candleRange =
            candidate.high -
            candidate.low;


        const candleBody =
            Math.abs(
                candidate.open -
                candidate.close
            );


        const bodyRatio =
            candleRange > 0
                ? candleBody /
                    candleRange
                : 0;


        const minimumBodyRatio =
            0.70;


        if (
            bodyRatio <
            minimumBodyRatio
        ) {

            continue;
        }


        // ==============================================
        // SELL CAN BEGIN FROM CHANNEL AREA
        // ==============================================

        const openTolerance =
            channelWidth * 0.35;


        const candidateStartedNearChannel =
            candidate.open >=
                projectedLower -
                    openTolerance &&
            candidate.open <=
                projectedUpper +
                    openTolerance;


        if (
            !candidateStartedNearChannel
        ) {

            continue;
        }


        // ==============================================
        // MUST BREAK LOWER CHANNEL
        // ==============================================

        const brokeLowerChannel =
            candidate.close <
            projectedLower;


        if (
            !brokeLowerChannel
        ) {

            continue;
        }


        // ==============================================
        // BREAK MUST BE MEANINGFUL
        // ==============================================

        const breakDepth =
            projectedLower -
            candidate.close;


        const breakDepthRatio =
            breakDepth /
            channelWidth;


        const minimumBreakDepthRatio =
            0.50;


        if (
            breakDepthRatio <
            minimumBreakDepthRatio
        ) {

            continue;
        }


        matches.push({

            index: i,

            date:
                candidate.date,

            open:
                candidate.open,

            high:
                candidate.high,

            low:
                candidate.low,

            close:
                candidate.close,


            dropPercent:
                Number(
                    bodyDropPercent
                        .toFixed(2)
                ),


            bodyRatio:
                Number(
                    bodyRatio
                        .toFixed(2)
                ),


            breakDepth:
                Number(
                    breakDepth
                        .toFixed(2)
                ),


            breakDepthRatio:
                Number(
                    breakDepthRatio
                        .toFixed(2)
                ),


            lowerChannelValue:
                projectedLower,

            upperChannelValue:
                projectedUpper,


            channelLookback,


            highSlopePercent:
                highSlope,

            lowSlopePercent:
                lowSlope,

            averageSlopePercent:
                Number(
                    averageSlope
                        .toFixed(4)
                ),


            parallelRatio:
                channelResult
                    .parallelRatio,


            channelRespectRatio:
                channelResult
                    .respectRatio
        });
    }


    return matches;
}


module.exports = {
    detectFlashSells
};