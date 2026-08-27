// ======================================================
// TIMEFRAME SERVICE
//
// NSE:
// - Candles are grouped inside each IST trading day.
// - Higher timeframe candles never span two NSE sessions.
//
// CRYPTO:
// - Binance futures trades 24/7.
// - Higher timeframes are aligned to Binance / exchange
//   UTC timeframe boundaries.
//
// TradingView:
// - User displays chart in Asia/Kolkata.
// - TradingView converts Binance exchange boundaries to IST.
//
// Example:
//
// Binance 1h:
// 19:00 UTC
//
// TradingView Asia/Kolkata:
// 00:30 IST
//
// Therefore we MUST NOT re-anchor crypto candles to
// IST midnight.
//
// IMPORTANT:
// We DO NOT simply group every N candles starting from
// the first candle in cache. That causes shifted candles.
// ======================================================


// ======================================================
// CONSTANTS
// ======================================================

const FIVE_MINUTES_MS =
    5 * 60 * 1000;


// ======================================================
// IST DATE KEY
// ======================================================

function getISTDateKey(date) {

    return new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone:
                "Asia/Kolkata",

            year:
                "numeric",

            month:
                "2-digit",

            day:
                "2-digit"
        }
    ).format(
        new Date(date)
    );
}


// ======================================================
// GROUP NSE CANDLES BY TRADING DAY
// ======================================================

function groupCandlesByTradingDay(
    candles
) {

    const days = {};


    for (
        const candle
        of candles
    ) {

        const dayKey =
            getISTDateKey(
                candle.date
            );


        if (
            !days[dayKey]
        ) {

            days[dayKey] = [];
        }


        days[dayKey].push(
            candle
        );
    }


    return days;
}


// ======================================================
// CREATE AGGREGATED CANDLE
// ======================================================

function createAggregatedCandle(
    group,
    candleDate = null
) {

    if (
        !Array.isArray(group) ||
        group.length === 0
    ) {

        return null;
    }


    return {

        date:
            candleDate ||
            group[0].date,

        open:
            Number(
                group[0].open
            ),

        high:
            Math.max(
                ...group.map(
                    candle =>
                        Number(
                            candle.high
                        )
                )
            ),

        low:
            Math.min(
                ...group.map(
                    candle =>
                        Number(
                            candle.low
                        )
                )
            ),

        close:
            Number(
                group[
                    group.length - 1
                ].close
            ),

        volume:
            group.reduce(
                (
                    total,
                    candle
                ) =>
                    total +
                    Number(
                        candle.volume ||
                        0
                    ),
                0
            )
    };
}


// ======================================================
// CHECK CONTIGUOUS 5M CANDLES
// ======================================================

function isCompleteFiveMinuteGroup(
    group,
    expectedSize
) {

    if (
        !Array.isArray(group) ||
        group.length !== expectedSize
    ) {

        return false;
    }


    const sorted =
        [...group].sort(
            (a, b) =>
                new Date(a.date) -
                new Date(b.date)
        );


    for (
        let i = 1;
        i < sorted.length;
        i++
    ) {

        const previous =
            new Date(
                sorted[i - 1].date
            ).getTime();


        const current =
            new Date(
                sorted[i].date
            ).getTime();


        if (
            current - previous !==
            FIVE_MINUTES_MS
        ) {

            return false;
        }
    }


    return true;
}


// ======================================================
// BASIC GROUP AGGREGATION
//
// Used by NSE where grouping starts from the beginning
// of each trading session.
// ======================================================

function aggregateCompleteGroups(
    candles,
    groupSize
) {

    const result = [];


    for (
        let i = 0;
        i + groupSize <= candles.length;
        i += groupSize
    ) {

        const group =
            candles.slice(
                i,
                i + groupSize
            );


        const aggregated =
            createAggregatedCandle(
                group
            );


        if (aggregated) {

            result.push(
                aggregated
            );
        }
    }


    return result;
}


// ======================================================
// NSE AGGREGATION
//
// Each trading day remains independent.
// ======================================================

function aggregateNseCandles(
    candles,
    groupSize
) {

    const tradingDays =
        groupCandlesByTradingDay(
            candles
        );


    const result = [];


    const sortedDays =
        Object.keys(
            tradingDays
        ).sort();


    for (
        const dayKey
        of sortedDays
    ) {

        const dayCandles =
            tradingDays[
                dayKey
            ];


        dayCandles.sort(
            (a, b) =>
                new Date(a.date) -
                new Date(b.date)
        );


        const aggregated =
            aggregateCompleteGroups(
                dayCandles,
                groupSize
            );


        result.push(
            ...aggregated
        );
    }


    return result;
}


// ======================================================
// CRYPTO AGGREGATION
//
// CRITICAL:
//
// Crypto candles are bucketed using Binance exchange
// timeframe boundaries.
//
// Binance timestamps are UTC-based.
//
// TradingView can DISPLAY them in Asia/Kolkata, but the
// underlying Binance candle boundary must stay unchanged.
//
// Example:
//
// Binance 1h candle:
// 19:00 UTC
//
// TradingView Asia/Kolkata:
// 00:30 IST
//
// This is the SAME candle.
//
// We therefore use epoch-based bucket boundaries and
// DO NOT shift the buckets by +05:30.
// ======================================================

function aggregateCryptoCandles(
    candles,
    groupSize
) {

    if (
        !Array.isArray(candles) ||
        candles.length === 0
    ) {

        return [];
    }


    const timeframeMs =
        groupSize *
        FIVE_MINUTES_MS;


    const buckets =
        new Map();


    // ==================================================
    // SORT INPUT
    // ==================================================

    const sortedCandles =
        [...candles].sort(
            (a, b) =>
                new Date(a.date) -
                new Date(b.date)
        );


    // ==================================================
    // ASSIGN EACH 5M CANDLE TO BINANCE TIMEFRAME BUCKET
    // ==================================================

    for (
        const candle
        of sortedCandles
    ) {

        const timestamp =
            new Date(
                candle.date
            ).getTime();


        if (
            !Number.isFinite(
                timestamp
            )
        ) {

            continue;
        }


        const bucketStart =
            Math.floor(
                timestamp /
                timeframeMs
            ) *
            timeframeMs;


        if (
            !buckets.has(
                bucketStart
            )
        ) {

            buckets.set(
                bucketStart,
                []
            );
        }


        buckets
            .get(
                bucketStart
            )
            .push(
                candle
            );
    }


    // ==================================================
    // BUILD ONLY COMPLETE TIMEFRAME CANDLES
    // ==================================================

    const result = [];


    const sortedBucketStarts =
        [...buckets.keys()]
            .sort(
                (a, b) =>
                    a - b
            );


    for (
        const bucketStart
        of sortedBucketStarts
    ) {

        const group =
            buckets.get(
                bucketStart
            );


        group.sort(
            (a, b) =>
                new Date(a.date) -
                new Date(b.date)
        );


        // ==============================================
        // MUST CONTAIN EXACT NUMBER OF 5M CANDLES
        // ==============================================

        if (
            !isCompleteFiveMinuteGroup(
                group,
                groupSize
            )
        ) {

            continue;
        }


        // ==============================================
        // FIRST CANDLE MUST START EXACTLY AT BUCKET START
        // ==============================================

        const firstTime =
            new Date(
                group[0].date
            ).getTime();


        if (
            firstTime !==
            bucketStart
        ) {

            continue;
        }


        // ==============================================
        // LAST 5M CANDLE MUST ALSO BE WHERE EXPECTED
        // ==============================================

        const expectedLastTime =
            bucketStart +
            (
                groupSize - 1
            ) *
            FIVE_MINUTES_MS;


        const actualLastTime =
            new Date(
                group[
                    group.length - 1
                ].date
            ).getTime();


        if (
            actualLastTime !==
            expectedLastTime
        ) {

            continue;
        }


        // ==============================================
        // CREATE HIGHER TIMEFRAME CANDLE
        //
        // date remains candle OPEN time.
        // ==============================================

        const aggregated =
            createAggregatedCandle(
                group,
                new Date(
                    bucketStart
                )
            );


        if (aggregated) {

            result.push(
                aggregated
            );
        }
    }


    return result;
}


// ======================================================
// NORMALIZE ORIGINAL 5M CANDLES
//
// No aggregation is required.
//
// cryptoMarketDataCache already removes the unfinished
// Binance 5m candle before this function receives data.
// ======================================================

function buildFiveMinuteCandles(
    candles
) {

    if (
        !Array.isArray(candles)
    ) {

        return [];
    }


    return [...candles]
        .filter(
            candle =>
                candle &&
                !Number.isNaN(
                    new Date(
                        candle.date
                    ).getTime()
                )
        )
        .sort(
            (a, b) =>
                new Date(a.date) -
                new Date(b.date)
        );
}


// ======================================================
// GENERIC AGGREGATOR
// ======================================================

function aggregateCandles(
    candles,
    groupSize,
    market = "NSE"
) {

    const normalizedMarket =
        String(
            market
        ).toUpperCase();


    if (
        normalizedMarket ===
        "CRYPTO"
    ) {

        return aggregateCryptoCandles(
            candles,
            groupSize
        );
    }


    return aggregateNseCandles(
        candles,
        groupSize
    );
}


// ======================================================
// BUILD PRODUCTION TIMEFRAMES
// ======================================================

function buildTimeframes(
    candles5m,
    market = "NSE"
) {

    return {

        "5m":
            buildFiveMinuteCandles(
                candles5m
            ),

        "15m":
            aggregateCandles(
                candles5m,
                3,
                market
            ),

        "30m":
            aggregateCandles(
                candles5m,
                6,
                market
            ),

        "45m":
            aggregateCandles(
                candles5m,
                9,
                market
            ),

        "1h":
            aggregateCandles(
                candles5m,
                12,
                market
            ),

        "2h":
            aggregateCandles(
                candles5m,
                24,
                market
            )

    };
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

    aggregateCandles,

    aggregateNseCandles,

    aggregateCryptoCandles,

    buildFiveMinuteCandles,

    buildTimeframes

};