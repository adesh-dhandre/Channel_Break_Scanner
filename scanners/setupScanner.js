const {
    detectFlashSells
} = require("./flashSellScanner");

const {
    detectBaseAfterFlashSell
} = require("./baseScanner");


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
                null

        };
    }


    // ==================================================
    // RECENCY
    // ==================================================

    const recencyLimits = {

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


    // First qualifying base candle.
    const baseStartedAt =
        baseInfo.date;


    // With our current strategy a qualifying base candle
    // confirms the base immediately.
    //
    // If later we require 2-3 confirmation candles,
    // baseConfirmedAt can become different from
    // baseStartedAt without changing the dashboard.
    const baseConfirmedAt =
        baseForming
            ? baseInfo.date
            : null;


    // ==================================================
    // PRE-PHASE
    // ==================================================

    const isSetup =
        isRecent &&
        baseForming;


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


        // ----------------------------------------------
        // LIFECYCLE
        // ----------------------------------------------

        lifecycle:
            lifecycleInfo.lifecycle,

        lifecycleLabel:
            lifecycleInfo.lifecycleLabel,

        lifecycleTone:
            lifecycleInfo.lifecycleTone,


        // ----------------------------------------------
        // CHANNEL
        // ----------------------------------------------

        ascendingChannel:
            true,

        channelLookback:
            latestFlashSell
                .channelLookback,

        highSlopePercent:
            latestFlashSell
                .highSlopePercent,

        lowSlopePercent:
            latestFlashSell
                .lowSlopePercent,

        parallelRatio:
            latestFlashSell
                .parallelRatio,

        channelRespectRatio:
            latestFlashSell
                .channelRespectRatio,


        // ----------------------------------------------
        // FLASH SELL
        // ----------------------------------------------

        flashSell:
            true,

        flashSellDate:
            latestFlashSell.date,

        flashSellAt:
            latestFlashSell.date,

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


        // ----------------------------------------------
        // RECENCY / AGE
        // ----------------------------------------------

        candlesSinceFlashSell,

        maxCandlesSinceFlashSell,

        isRecent,

        ageText:
            `${candlesSinceFlashSell} / ${maxCandlesSinceFlashSell}`,


        // ----------------------------------------------
        // BASE
        // ----------------------------------------------

        baseForming,

        baseType:
            baseInfo.type,

        baseStartedAt,

        baseConfirmedAt,

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

    getLifecycle

};