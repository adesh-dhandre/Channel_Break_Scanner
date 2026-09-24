const {
    detectStrictAscendingChannel
} = require("./strictChannelDetector");


// ======================================================
// IMMEDIATE REVERSAL CANDLE
//
// IMPORTANT:
// - ONLY candle +1 after Flash Sell
// - HAMMER or DOJI only
// - candle color does NOT matter
// - no generic "long lower wick" fallback
// ======================================================

function classifyImmediateReversal(candle) {

    if (!candle) {
        return {
            isValid: false,
            reason: "NO_CANDLE"
        };
    }


    const open = Number(candle.open);
    const high = Number(candle.high);
    const low = Number(candle.low);
    const close = Number(candle.close);


    if (
        ![open, high, low, close]
            .every(Number.isFinite)
    ) {
        return {
            isValid: false,
            reason: "INVALID_OHLC"
        };
    }


    const range =
        high - low;


    if (range <= 0) {
        return {
            isValid: false,
            reason: "ZERO_RANGE"
        };
    }


    const body =
        Math.abs(
            close - open
        );


    const lowerBody =
        Math.min(
            open,
            close
        );


    const upperBody =
        Math.max(
            open,
            close
        );


    const lowerWick =
        lowerBody - low;


    const upperWick =
        high - upperBody;


    const bodyPercent =
        open > 0
            ? (
                body /
                open
            ) * 100
            : 0;


    const bodyRatio =
        body /
        range;


    const lowerWickRatio =
        lowerWick /
        range;


    const upperWickRatio =
        upperWick /
        range;


    // ==============================================
    // DOJI
    // Same basic geometry as current scanner.
    // Color irrelevant.
    // ==============================================

    // ==============================================
    // TRUE BOTTOM-REJECTION DOJI
    //
    // Generic dojis with large upper wicks are
    // rejected. We want rejection FROM THE LOW.
    // ==============================================

    const isDoji =
        bodyPercent <= 0.25 &&
        bodyRatio <= 0.30 &&
        lowerWickRatio >= 0.50 &&
        upperWickRatio <= 0.15;


    // ==============================================
    // TRUE HAMMER
    //
    // Small body near top of candle.
    // Strong lower rejection.
    // Almost no upper wick.
    //
    // Reject:
    // - inverted hammer
    // - shooting-star shape
    // - supply-rejection upper wick
    //
    // Candle color remains irrelevant.
    // ==============================================

    const isHammer =
        bodyRatio <= 0.40 &&
        lowerWick >=
            body * 2 &&
        lowerWickRatio >=
            0.50 &&
        upperWickRatio <=
            0.15;


    const type =
        isHammer
            ? "HAMMER"
            : (
                isDoji
                    ? "DOJI"
                    : null
            );


    return {

        isValid:
            Boolean(type),

        type,

        color:
            close >= open
                ? "GREEN"
                : "RED",

        date:
            candle.date,

        open,
        high,
        low,
        close,

        bodyPercent:
            Number(
                bodyPercent
                    .toFixed(4)
            ),

        bodyRatio:
            Number(
                bodyRatio
                    .toFixed(4)
            ),

        lowerWick:
            Number(
                lowerWick
                    .toFixed(8)
            ),

        upperWick:
            Number(
                upperWick
                    .toFixed(8)
            ),

        lowerWickRatio:
            Number(
                lowerWickRatio
                    .toFixed(4)
            ),

        upperWickRatio:
            Number(
                upperWickRatio
                    .toFixed(4)
            ),

        isHammer,
        isDoji
    };
}


// ======================================================
// STRICT FLASH SELL
//
// Sequence:
//
// REAL ascending channel already exists
//             ↓
// strong bearish breakdown candle
//             ↓
// lower channel broken materially
//
// This keeps the important existing Flash Sell rules,
// but replaces the old regression channel with the new
// strict swing-based channel.
// ======================================================

function detectStrictFlashSell(
    candlesBeforeFlash,
    flashCandle,
    options = {}
) {

    const minimumDropPercent =
        options.minimumDropPercent ??
        0.70;


    const minimumBodyRatio =
        options.minimumBodyRatio ??
        0.70;


    const minimumBreakDepthRatio =
        options.minimumBreakDepthRatio ??
        0.50;


    const channel =
        detectStrictAscendingChannel(
            candlesBeforeFlash,
            options.channelOptions || {}
        );


    if (
        !channel.isValidChannel
    ) {
        return {
            isFlashSell: false,
            reason:
                "NO_VALID_ASCENDING_CHANNEL",
            channel
        };
    }


    const open =
        Number(
            flashCandle.open
        );


    const high =
        Number(
            flashCandle.high
        );


    const low =
        Number(
            flashCandle.low
        );


    const close =
        Number(
            flashCandle.close
        );


    if (
        ![
            open,
            high,
            low,
            close
        ].every(
            Number.isFinite
        )
    ) {
        return {
            isFlashSell: false,
            reason:
                "INVALID_FLASH_OHLC",
            channel
        };
    }


    // ==============================================
    // MUST BE BEARISH
    // ==============================================

    if (
        close >= open
    ) {
        return {
            isFlashSell: false,
            reason:
                "FLASH_NOT_BEARISH",
            channel
        };
    }


    // ==============================================
    // STRONG BODY DROP
    // ==============================================

    const bodyDropPercent =
        (
            (
                open -
                close
            ) /
            open
        ) * 100;


    if (
        bodyDropPercent <
        minimumDropPercent
    ) {
        return {
            isFlashSell: false,
            reason:
                "FLASH_DROP_TOO_SMALL",
            channel
        };
    }


    const range =
        high - low;


    const body =
        Math.abs(
            open - close
        );


    const bodyRatio =
        range > 0
            ? body / range
            : 0;


    if (
        bodyRatio <
        minimumBodyRatio
    ) {
        return {
            isFlashSell: false,
            reason:
                "FLASH_BODY_TOO_WEAK",
            channel
        };
    }


    const projectedLower =
        Number(
            channel.projectedLower
        );


    const projectedUpper =
        Number(
            channel.projectedUpper
        );


    const channelWidth =
        projectedUpper -
        projectedLower;


    if (
        !Number.isFinite(
            channelWidth
        ) ||
        channelWidth <= 0
    ) {
        return {
            isFlashSell: false,
            reason:
                "INVALID_CHANNEL_WIDTH",
            channel
        };
    }


    // ==============================================
    // FLASH SHOULD START FROM CHANNEL AREA
    // ==============================================

    const openTolerance =
        channelWidth *
        0.35;


    const startedNearChannel =
        open >=
            projectedLower -
            openTolerance &&
        open <=
            projectedUpper +
            openTolerance;


    if (
        !startedNearChannel
    ) {
        return {
            isFlashSell: false,
            reason:
                "FLASH_STARTED_AWAY_FROM_CHANNEL",
            channel
        };
    }


    // ==============================================
    // CLOSE MUST BREAK LOWER CHANNEL
    // ==============================================

    if (
        close >=
        projectedLower
    ) {
        return {
            isFlashSell: false,
            reason:
                "NO_LOWER_CHANNEL_BREAK",
            channel
        };
    }


    // ==============================================
    // BREAK MUST BE MEANINGFUL
    // ==============================================

    const breakDepth =
        projectedLower -
        close;


    const breakDepthRatio =
        breakDepth /
        channelWidth;


    if (
        breakDepthRatio <
        minimumBreakDepthRatio
    ) {
        return {
            isFlashSell: false,
            reason:
                "BREAK_NOT_DEEP_ENOUGH",
            channel
        };
    }


    return {

        isFlashSell:
            true,

        reason:
            "STRICT_FLASH_SELL",

        date:
            flashCandle.date,

        open,
        high,
        low,
        close,

        dropPercent:
            Number(
                bodyDropPercent
                    .toFixed(4)
            ),

        bodyRatio:
            Number(
                bodyRatio
                    .toFixed(4)
            ),

        breakDepth:
            Number(
                breakDepth
                    .toFixed(8)
            ),

        breakDepthRatio:
            Number(
                breakDepthRatio
                    .toFixed(4)
            ),

        projectedLower,

        projectedUpper,

        channelWidth,

        channel
    };
}


// ======================================================
// COMPLETE STRATEGY DETECTOR
//
// REQUIRED ORDER:
//
// 1. Established strict ascending channel
// 2. Flash Sell breaks lower boundary
// 3. VERY NEXT candle is Hammer OR Doji
//
// No +2
// No +3
// No +4
// No generic long-lower-wick fallback
// ======================================================

function detectStrictFlashTurnSetups(
    candles,
    options = {}
) {

    const matches = [];


    if (
        !Array.isArray(candles) ||
        candles.length < 45
    ) {
        return matches;
    }


    const minimumHistory =
        options.minimumHistory ??
        40;


    /*
     * i = Flash Sell candle
     *
     * i + 1 MUST exist because that is
     * the immediate Hammer/Doji candle.
     */

    for (
        let i = minimumHistory;
        i < candles.length - 1;
        i++
    ) {

        const flashCandle =
            candles[i];


        const immediateCandle =
            candles[i + 1];


        /*
         * Critical anti-lookahead rule:
         *
         * The channel detector sees ONLY candles
         * that existed BEFORE the Flash Sell.
         *
         * Flash candle itself is not included.
         * Immediate reversal candle is not included.
         */

        const channelLookback =
            options.channelOptions?.lookback ??
            40;


        const candlesBeforeFlash =
            candles.slice(
                Math.max(
                    0,
                    i - channelLookback
                ),
                i
            );


        const flash =
            detectStrictFlashSell(
                candlesBeforeFlash,
                flashCandle,
                options
            );


        if (
            !flash.isFlashSell
        ) {
            continue;
        }


        const reversal =
            classifyImmediateReversal(
                immediateCandle
            );


        if (
            !reversal.isValid
        ) {
            continue;
        }


        matches.push({

            flashIndex:
                i,

            reversalIndex:
                i + 1,

            flashDate:
                flashCandle.date,

            reversalDate:
                immediateCandle.date,


            setupType:
                reversal.type,


            setupColor:
                reversal.color,


            // Stop reference requested by strategy:
            // below immediate Hammer/Doji low.

            setupLow:
                Number(
                    immediateCandle.low
                ),


            flash,

            reversal,


            channel:
                flash.channel
        });
    }


    return matches;
}


module.exports = {
    classifyImmediateReversal,
    detectStrictFlashSell,
    detectStrictFlashTurnSetups
};
