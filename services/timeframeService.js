// ======================================================
// TIMEFRAME SERVICE
//
// NSE:
// - Candles remain grouped inside each IST trading day.
// - Higher timeframe candles never span NSE sessions.
//
// CRYPTO:
// - Binance Futures trades continuously.
// - Higher timeframe candles use Binance / UTC
//   epoch-aligned boundaries.
//
// PERFORMANCE:
// - Candle timestamps are parsed once per build.
// - Crypto candles are sorted once.
// - NSE IST formatter is reused.
// - Aggregation avoids repeated map/sort/date parsing.
// ======================================================


// ======================================================
// CONSTANTS
// ======================================================

const FIVE_MINUTES_MS =
    5 * 60 * 1000;


// ======================================================
// REUSABLE IST FORMATTER
// ======================================================

const IST_DATE_FORMATTER =
    new Intl.DateTimeFormat(
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
    );


// ======================================================
// TIMESTAMP
// ======================================================

function getTimestamp(
    candle
) {

    if (!candle) {

        return NaN;
    }


    if (
        Number.isFinite(
            candle.__timestamp
        )
    ) {

        return candle.__timestamp;
    }


    if (
        candle.date instanceof Date
    ) {

        return candle.date.getTime();
    }


    return new Date(
        candle.date
    ).getTime();
}


// ======================================================
// IST DATE KEY
// ======================================================

function getISTDateKey(
    date
) {

    return IST_DATE_FORMATTER.format(
        date instanceof Date
            ? date
            : new Date(date)
    );
}


// ======================================================
// NORMALIZE / PREPARE CANDLES
// ======================================================

function prepareCandles(
    candles
) {

    if (
        !Array.isArray(candles)
    ) {

        return [];
    }


    const prepared = [];


    for (
        const candle
        of candles
    ) {

        if (!candle) {

            continue;
        }


        const timestamp =
            candle.date instanceof Date
                ? candle.date.getTime()
                : new Date(
                    candle.date
                ).getTime();


        if (
            !Number.isFinite(
                timestamp
            )
        ) {

            continue;
        }


        prepared.push({

            ...candle,

            __timestamp:
                timestamp

        });
    }


    prepared.sort(
        (a, b) =>
            a.__timestamp -
            b.__timestamp
    );


    return prepared;
}


// ======================================================
// CREATE AGGREGATED CANDLE
//
// Optimized single-pass OHLCV calculation.
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


    let high =
        -Infinity;

    let low =
        Infinity;

    let volume =
        0;


    for (
        const candle
        of group
    ) {

        const candleHigh =
            Number(
                candle.high
            );

        const candleLow =
            Number(
                candle.low
            );


        if (
            candleHigh >
            high
        ) {

            high =
                candleHigh;
        }


        if (
            candleLow <
            low
        ) {

            low =
                candleLow;
        }


        volume +=
            Number(
                candle.volume ||
                0
            );
    }


    return {

        date:
            candleDate ||
            group[0].date,

        open:
            Number(
                group[0].open
            ),

        high,

        low,

        close:
            Number(
                group[
                    group.length - 1
                ].close
            ),

        volume

    };
}


// ======================================================
// CHECK COMPLETE CONTIGUOUS 5M GROUP
//
// Assumes group is already ordered.
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


    for (
        let i = 1;
        i < group.length;
        i++
    ) {

        const previous =
            getTimestamp(
                group[i - 1]
            );

        const current =
            getTimestamp(
                group[i]
            );


        if (
            current -
            previous !==
            FIVE_MINUTES_MS
        ) {

            return false;
        }
    }


    return true;
}


// ======================================================
// GROUP NSE CANDLES BY TRADING DAY
// ======================================================

function groupCandlesByTradingDay(
    candles
) {

    const days =
        new Map();


    for (
        const candle
        of candles
    ) {

        const timestamp =
            getTimestamp(
                candle
            );


        if (
            !Number.isFinite(
                timestamp
            )
        ) {

            continue;
        }


        const dayKey =
            getISTDateKey(
                new Date(
                    timestamp
                )
            );


        if (
            !days.has(
                dayKey
            )
        ) {

            days.set(
                dayKey,
                []
            );
        }


        days
            .get(
                dayKey
            )
            .push(
                candle
            );
    }


    return days;
}


// ======================================================
// BASIC GROUP AGGREGATION
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


        if (
            aggregated
        ) {

            result.push(
                aggregated
            );
        }
    }


    return result;
}


// ======================================================
// NSE AGGREGATION
// ======================================================

function aggregateNseCandles(
    candles,
    groupSize
) {

    const prepared =
        prepareCandles(
            candles
        );


    const tradingDays =
        groupCandlesByTradingDay(
            prepared
        );


    const result = [];


    const sortedDays =
        Array
            .from(
                tradingDays.keys()
            )
            .sort();


    for (
        const dayKey
        of sortedDays
    ) {

        const dayCandles =
            tradingDays.get(
                dayKey
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
// Binance timeframe boundaries are UTC / epoch based.
//
// IMPORTANT:
// Never shift these buckets to IST.
//
// Example:
//
// Binance 1h:
//
// 19:00 UTC
//
// TradingView Asia/Kolkata:
//
// 00:30 IST
//
// Same candle.
// ======================================================

function aggregatePreparedCryptoCandles(
    preparedCandles,
    groupSize
) {

    if (
        !Array.isArray(
            preparedCandles
        ) ||
        preparedCandles.length === 0
    ) {

        return [];
    }


    const timeframeMs =
        groupSize *
        FIVE_MINUTES_MS;


    const result = [];


    let currentBucketStart =
        null;

    let currentGroup =
        [];


    function processCurrentGroup() {

        if (
            currentBucketStart ===
            null
        ) {

            return;
        }


        if (
            currentGroup.length !==
            groupSize
        ) {

            return;
        }


        if (
            !isCompleteFiveMinuteGroup(
                currentGroup,
                groupSize
            )
        ) {

            return;
        }


        const firstTime =
            getTimestamp(
                currentGroup[0]
            );


        if (
            firstTime !==
            currentBucketStart
        ) {

            return;
        }


        const expectedLastTime =
            currentBucketStart +
            (
                groupSize - 1
            ) *
            FIVE_MINUTES_MS;


        const actualLastTime =
            getTimestamp(
                currentGroup[
                    currentGroup.length - 1
                ]
            );


        if (
            actualLastTime !==
            expectedLastTime
        ) {

            return;
        }


        const aggregated =
            createAggregatedCandle(
                currentGroup,
                new Date(
                    currentBucketStart
                )
            );


        if (
            aggregated
        ) {

            result.push(
                aggregated
            );
        }
    }


    for (
        const candle
        of preparedCandles
    ) {

        const timestamp =
            getTimestamp(
                candle
            );


        const bucketStart =
            Math.floor(
                timestamp /
                timeframeMs
            ) *
            timeframeMs;


        if (
            currentBucketStart ===
            null
        ) {

            currentBucketStart =
                bucketStart;
        }


        if (
            bucketStart !==
            currentBucketStart
        ) {

            processCurrentGroup();


            currentBucketStart =
                bucketStart;

            currentGroup =
                [];
        }


        currentGroup.push(
            candle
        );
    }


    processCurrentGroup();


    return result;
}


// ======================================================
// PUBLIC CRYPTO AGGREGATOR
// ======================================================

function aggregateCryptoCandles(
    candles,
    groupSize
) {

    const prepared =
        prepareCandles(
            candles
        );


    return aggregatePreparedCryptoCandles(
        prepared,
        groupSize
    );
}


// ======================================================
// NORMALIZE ORIGINAL 5M CANDLES
// ======================================================

function buildFiveMinuteCandles(
    candles
) {

    const prepared =
        prepareCandles(
            candles
        );


    return prepared.map(
        candle => {

            const {
                __timestamp,
                ...cleanCandle
            } = candle;


            return cleanCandle;
        }
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
// REMOVE INTERNAL TIMESTAMP
// ======================================================

function cleanPreparedCandles(
    preparedCandles
) {

    return preparedCandles.map(
        candle => {

            const {
                __timestamp,
                ...cleanCandle
            } = candle;


            return cleanCandle;
        }
    );
}


// ======================================================
// BUILD PRODUCTION TIMEFRAMES
// ======================================================

function buildTimeframes(
    candles5m,
    market = "NSE"
) {

    const normalizedMarket =
        String(
            market
        ).toUpperCase();


    // ==================================================
    // CRYPTO FAST PATH
    //
    // Prepare and sort the source candles ONCE.
    //
    // Previously each timeframe independently:
    //
    // - copied candles
    // - parsed dates
    // - sorted candles
    // - created Maps
    // - sorted bucket keys
    // - sorted every bucket
    //
    // Now all six timeframes share one prepared source.
    // ==================================================

    if (
        normalizedMarket ===
        "CRYPTO"
    ) {

        const prepared =
            prepareCandles(
                candles5m
            );


        return {

            "5m":
                cleanPreparedCandles(
                    prepared
                ),

            "15m":
                aggregatePreparedCryptoCandles(
                    prepared,
                    3
                ),

            "30m":
                aggregatePreparedCryptoCandles(
                    prepared,
                    6
                ),

            "45m":
                aggregatePreparedCryptoCandles(
                    prepared,
                    9
                ),

            "1h":
                aggregatePreparedCryptoCandles(
                    prepared,
                    12
                ),

            "2h":
                aggregatePreparedCryptoCandles(
                    prepared,
                    24
                )

        };
    }


    // ==================================================
    // NSE
    //
    // Keep existing session semantics.
    // ==================================================

    return {

        "5m":
            buildFiveMinuteCandles(
                candles5m
            ),

        "15m":
            aggregateNseCandles(
                candles5m,
                3
            ),

        "30m":
            aggregateNseCandles(
                candles5m,
                6
            ),

        "45m":
            aggregateNseCandles(
                candles5m,
                9
            ),

        "1h":
            aggregateNseCandles(
                candles5m,
                12
            ),

        "2h":
            aggregateNseCandles(
                candles5m,
                24
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