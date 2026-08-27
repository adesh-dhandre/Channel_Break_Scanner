const {
    detectFlashSells
} = require("./flashSellScanner");

const {
    detectBaseAfterFlashSell
} = require("./baseScanner");


// ======================================================
// TIMEFRAME DURATION
// ======================================================
//
// Candle.date represents candle OPEN time.
//
// Example:
//
// TradingView 30m candle:
// open      -> 01:30 IST
// close     -> 02:00 IST
//
// PRE_PHASE cannot be confirmed until the candle closes.
//
// Therefore:
//
// baseStartedAt   = candle OPEN time
// baseConfirmedAt = candle CLOSE time
//
// This works for both Crypto and NSE.
// ======================================================

function getTimeframeMilliseconds(
    timeframe
) {

    const durations = {

        "5m":
            5 * 60 * 1000,

        "15m":
            15 * 60 * 1000,

        "30m":
            30 * 60 * 1000,

        "45m":
            45 * 60 * 1000,

        "1h":
            60 * 60 * 1000,

        "2h":
            2 * 60 * 60 * 1000

    };


    return (
        durations[
            timeframe
        ] ||
        60 * 60 * 1000
    );
}


// ======================================================
// CANDLE CLOSE TIME
// ======================================================

function getCandleCloseTime(
    candleOpenTime,
    timeframe
) {

    if (
        !candleOpenTime
    ) {

        return null;
    }


    const openTime =
        new Date(
            candleOpenTime
        ).getTime();


    if (
        Number.isNaN(
            openTime
        )
    ) {

        return null;
    }


    return new Date(
        openTime +
        getTimeframeMilliseconds(
            timeframe
        )
    );
}


// ======================================================
// BASE TYPE
// ======================================================

function getBaseType(
    baseResult
) {

    const candles =
        Array.isArray(
            baseResult?.candles
        )
            ? baseResult.candles
            : [];


    const baseCandle =
        candles.find(
            candle =>
                candle?.isBaseCandle === true
        );


    if (!baseCandle) {

        return {
            type: null,
            date: null,
            candle: null
        };
    }


    let type =
        "BASE";


    if (
        baseCandle.isHammer === true
    ) {

        type =
            "HAMMER";

    } else if (
        baseCandle.isDoji === true
    ) {

        type =
            "DOJI";

    } else if (
        baseCandle.hasLongLowerWick === true
    ) {

        type =
            "LONG_LOWER_WICK";

    } else if (
        baseCandle.bearishMomentumReduced === true
    ) {

        type =
            "MOMENTUM_REDUCTION";
    }


    return {

        type,

        date:
            baseCandle.date ||
            null,

        candle:
            baseCandle

    };
}


// ======================================================
// LIFECYCLE
// ======================================================

function getLifecycle(
    isSetup,
    isRecent,
    candlesSinceFlashSell,
    maxCandlesSinceFlashSell
) {

    if (!isRecent) {

        return {
            lifecycle:
                "EXPIRED",

            lifecycleLabel:
                "Expired",

            lifecycleTone:
                "expired"
        };
    }


    if (!isSetup) {

        return {
            lifecycle:
                "WAITING",

            lifecycleLabel:
                "Waiting",

            lifecycleTone:
                "waiting"
        };
    }


    const ratio =
        maxCandlesSinceFlashSell > 0
            ? (
                candlesSinceFlashSell /
                maxCandlesSinceFlashSell
            )
            : 0;


    if (
        ratio >=
        0.7
    ) {

        return {
            lifecycle:
                "AGING",

            lifecycleLabel:
                "Aging",

            lifecycleTone:
                "aging"
        };
    }


    return {
        lifecycle:
            "LIVE",

        lifecycleLabel:
            "Live",

        lifecycleTone:
            "live"
    };
}


// ======================================================
// PRE-PHASE DETECTOR
// ======================================================

function detectPrePhaseSetup(
    candles,
    timeframe = "1h"
) {

    if (
        !Array.isArray(candles) ||
        candles.length === 0
    ) {

        return {

            timeframe,

            isSetup: false,

            status:
                "NO_DATA",

            lifecycle:
                "WAITING",

            lifecycleLabel:
                "Waiting",

            lifecycleTone:
                "waiting",

            ascendingChannel:
                false,

            flashSell:
                false,

            baseForming:
                false,

            baseType:
                null,

            baseStartedAt:
                null,

            baseConfirmedAt:
                null,

            prePhaseConfirmedAt:
                null,

            detectedAt:
                null

        };
    }


    // ==================================================
    // ASCENDING CHANNEL BREAKS
    // ==================================================

    const flashSellResults =
        detectFlashSells(
            candles
        );


    if (
        !Array.isArray(
            flashSellResults
        ) ||
        flashSellResults.length === 0
    ) {

        return {

            timeframe,

            isSetup:
                false,

            status:
                "NO_CHANNEL_BREAK",

            lifecycle:
                "WAITING",

            lifecycleLabel:
                "Waiting",

            lifecycleTone:
                "waiting",

            ascendingChannel:
                false,

            flashSell:
                false,

            baseForming:
                false,

            baseType:
                null,

            baseStartedAt:
                null,

            baseConfirmedAt:
                null,

            prePhaseConfirmedAt:
                null,

            detectedAt:
                null

        };
    }


    // ==================================================
    // LATEST VALID FLASH SELL
    // ==================================================

    const latestFlashSell =
        flashSellResults[
            flashSellResults.length - 1
        ];


    // ==================================================
    // FLASH INDEX
    // ==================================================

    let flashIndex =
        latestFlashSell.index;


    if (
        !Number.isInteger(
            flashIndex
        )
    ) {

        const flashTime =
            new Date(
                latestFlashSell.date
            ).getTime();


        flashIndex =
            candles.findIndex(
                candle =>
                    new Date(
                        candle.date
                    ).getTime() ===
                    flashTime
            );
    }


    if (
        flashIndex <
        0
    ) {

        return {

            timeframe,

            isSetup:
                false,

            status:
                "FLASH_SELL_NOT_FOUND",

            lifecycle:
                "WAITING",

            lifecycleLabel:
                "Waiting",

            lifecycleTone:
                "waiting",

            ascendingChannel:
                true,

            flashSell:
                true,

            baseForming:
                false,

            baseType:
                null,

            baseStartedAt:
                null,

            baseConfirmedAt:
                null,

            prePhaseConfirmedAt:
                null,

            detectedAt:
                null

        };
    }


    // ==================================================
    // RECENCY
    // ==================================================
    //
    // 5m added here.
    //
    // This controls how long a detected structure remains
    // visible as a current setup.
    //
    // It does NOT delay detection.
    //
    // Detection happens immediately when the valid base
    // candle closes.
    // ==================================================

    const recencyLimits = {

        "5m":
            12,

        "15m":
            8,

        "30m":
            6,

        "45m":
            5,

        "1h":
            4,

        "2h":
            3

    };


    const maxCandlesSinceFlashSell =
        recencyLimits[
            timeframe
        ] ||
        4;


    const candlesSinceFlashSell =
        candles.length -
        1 -
        flashIndex;


    const isRecent =
        candlesSinceFlashSell <=
        maxCandlesSinceFlashSell;


    // ==================================================
    // FLASH SELL TIMES
    // ==================================================
    //
    // flashSellAt:
    // TradingView candle OPEN timestamp.
    //
    // flashSellConfirmedAt:
    // Timestamp when flash-sell candle actually closed.
    // ==================================================

    const flashSellAt =
        latestFlashSell.date;


    const flashSellConfirmedAt =
        getCandleCloseTime(
            latestFlashSell.date,
            timeframe
        );


    // ==================================================
    // BASE
    // ==================================================

    const baseResult =
        detectBaseAfterFlashSell(
            candles,
            latestFlashSell.date
        );


    const baseForming =
        baseResult
            ?.isBaseForming === true;


    const baseInfo =
        getBaseType(
            baseResult
        );


    // ==================================================
    // BASE TIMES
    // ==================================================
    //
    // baseStartedAt:
    // same timestamp as TradingView candle label.
    //
    // baseConfirmedAt:
    // actual moment candle finishes.
    //
    // PRE_PHASE is actionable at baseConfirmedAt.
    // ==================================================

    const baseStartedAt =
        baseInfo.date;


    const baseConfirmedAt =
        baseForming
            ? getCandleCloseTime(
                baseInfo.date,
                timeframe
            )
            : null;


    // ==================================================
    // PRE-PHASE
    // ==================================================

    const isSetup =
        isRecent &&
        baseForming;


    const prePhaseConfirmedAt =
        isSetup
            ? baseConfirmedAt
            : null;


    // detectedAt represents the earliest moment this
    // structure could legally be detected using a CLOSED
    // candle.
    //
    // The actual email/API scan may execute a few seconds
    // or minutes after this depending on scan schedule.

    const detectedAt =
        isSetup
            ? baseConfirmedAt
            : null;


    let status;


    if (!isRecent) {

        status =
            "OLD_SETUP";

    } else if (!baseForming) {

        status =
            "NO_BASE";

    } else {

        status =
            "PRE_PHASE";
    }


    // ==================================================
    // LIFECYCLE
    // ==================================================

    const lifecycleInfo =
        getLifecycle(
            isSetup,
            isRecent,
            candlesSinceFlashSell,
            maxCandlesSinceFlashSell
        );


    // ==================================================
    // RETURN
    // ==================================================

    return {

        timeframe,

        isSetup,

        status,

        lifecycle:
            lifecycleInfo.lifecycle,

        lifecycleLabel:
            lifecycleInfo.lifecycleLabel,

        lifecycleTone:
            lifecycleInfo.lifecycleTone,

        ascendingChannel:
            true,

        channelLookback:
            latestFlashSell.channelLookback,

        highSlopePercent:
            latestFlashSell.highSlopePercent,

        lowSlopePercent:
            latestFlashSell.lowSlopePercent,

        parallelRatio:
            latestFlashSell.parallelRatio,

        channelRespectRatio:
            latestFlashSell.channelRespectRatio,

        flashSell:
            true,

        // TradingView candle OPEN time
        flashSellDate:
            latestFlashSell.date,

        flashSellAt,

        // Actual flash candle CLOSE time
        flashSellConfirmedAt,

        flashSellDropPercent:
            latestFlashSell.dropPercent,

        flashSellBodyRatio:
            latestFlashSell.bodyRatio,

        breakDepth:
            latestFlashSell.breakDepth,

        breakDepthRatio:
            latestFlashSell.breakDepthRatio,

        lowerChannelValue:
            latestFlashSell.lowerChannelValue,

        upperChannelValue:
            latestFlashSell.upperChannelValue,

        candlesSinceFlashSell,

        maxCandlesSinceFlashSell,

        isRecent,

        ageText:
            `${candlesSinceFlashSell} / ${maxCandlesSinceFlashSell}`,

        baseForming,

        baseType:
            baseInfo.type,

        // TradingView candle OPEN time
        baseStartedAt,

        // Actual candle CLOSE / confirmation time
        baseConfirmedAt,

        // Earliest valid PRE_PHASE signal time
        prePhaseConfirmedAt,

        detectedAt,

        baseCandlesFound:
            baseResult
                ?.baseCandlesFound ||
            0,

        baseDetails:
            baseResult

    };
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

    detectPrePhaseSetup,

    getBaseType,

    getLifecycle,

    getTimeframeMilliseconds,

    getCandleCloseTime

};