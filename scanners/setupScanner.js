const {
    detectFlashSells
} = require("./flashSellScanner");

const {
    detectBaseAfterFlashSell
} = require("./baseScanner");


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
            status: "NO_DATA",
            ascendingChannel: false,
            flashSell: false,
            baseForming: false
        };
    }


    // ==========================================
    // 1. FIND VALID ASCENDING-CHANNEL BREAKS
    // ==========================================

    const flashSellResults =
        detectFlashSells(candles);


    if (
        !Array.isArray(flashSellResults) ||
        flashSellResults.length === 0
    ) {

        return {
            timeframe,
            isSetup: false,
            status: "NO_CHANNEL_BREAK",

            ascendingChannel: false,

            flashSell: false,

            baseForming: false
        };
    }


    // ==========================================
    // 2. LATEST VALID BREAK
    // ==========================================

    const latestFlashSell =
        flashSellResults[
            flashSellResults.length - 1
        ];


    // ==========================================
    // 3. FIND FLASH-SELL INDEX
    // ==========================================

    let flashIndex =
        latestFlashSell.index;


    if (
        !Number.isInteger(flashIndex)
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
        flashIndex < 0
    ) {

        return {
            timeframe,
            isSetup: false,
            status: "FLASH_SELL_NOT_FOUND",

            ascendingChannel: true,

            flashSell: true,

            baseForming: false
        };
    }


    // ==========================================
    // 4. RECENCY LIMIT BY TIMEFRAME
    // ==========================================

    const recencyLimits = {

        "15m": 8,

        "30m": 6,

        "45m": 5,

        "1h": 4,

        "2h": 3

    };


    const maxCandlesSinceFlashSell =
        recencyLimits[timeframe] ||
        4;


    const candlesSinceFlashSell =
        candles.length -
        1 -
        flashIndex;


    const isRecent =
        candlesSinceFlashSell <=
        maxCandlesSinceFlashSell;


    // ==========================================
    // 5. BASE AFTER CHANNEL BREAK
    // ==========================================

    const baseResult =
        detectBaseAfterFlashSell(
            candles,
            latestFlashSell.date
        );


    const baseForming =
        baseResult
            ?.isBaseForming === true;


    // ==========================================
    // 6. FINAL PRE-PHASE CONDITION
    // ==========================================

    const isSetup =
        isRecent &&
        baseForming;


    let status;


    if (!isRecent) {

        status = "OLD_SETUP";

    } else if (!baseForming) {

        status = "NO_BASE";

    } else {

        status = "PRE_PHASE";
    }


    // ==========================================
    // 7. RETURN
    // ==========================================

    return {

        timeframe,

        isSetup,

        status,


        // CHANNEL

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


        // FLASH SELL

        flashSell:
            true,

        flashSellDate:
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


        // RECENCY

        candlesSinceFlashSell,

        maxCandlesSinceFlashSell,

        isRecent,


        // BASE

        baseForming,

        baseCandlesFound:
            baseResult
                ?.baseCandlesFound ||
            0,

        baseDetails:
            baseResult

    };
}


module.exports = {
    detectPrePhaseSetup
};