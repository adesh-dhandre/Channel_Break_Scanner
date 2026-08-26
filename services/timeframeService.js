// ======================================================
// TIMEFRAME SERVICE
//
// NSE:
// - Candles are grouped inside each IST trading day.
// - Higher timeframe candles never span two NSE sessions.
//
// CRYPTO:
// - Market runs 24/7.
// - Candles are aggregated continuously.
// - No IST midnight reset.
//
// Production timeframes:
//
// 15m
// 30m
// 45m
// 1h
// 2h
// ======================================================


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
// AGGREGATE A SINGLE ARRAY
//
// Only complete groups are returned.
//
// This prevents a partial 15m/30m/etc candle from
// being treated as a completed candle.
// ======================================================

function aggregateCompleteGroups(
    candles,
    groupSize
) {

    const result = [];


    for (
        let i = 0;
        i + groupSize <=
            candles.length;
        i += groupSize
    ) {

        const group =
            candles.slice(
                i,
                i + groupSize
            );


        const aggregatedCandle = {

            date:
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


        result.push(
            aggregatedCandle
        );
    }


    return result;
}


// ======================================================
// NSE AGGREGATION
//
// Each trading day is independent.
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
                new Date(
                    a.date
                ) -
                new Date(
                    b.date
                )
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
// Binance futures is 24/7.
//
// No trading-day reset.
// ======================================================

function aggregateCryptoCandles(
    candles,
    groupSize
) {

    const sortedCandles =
        [...candles];


    sortedCandles.sort(
        (a, b) =>
            new Date(
                a.date
            ) -
            new Date(
                b.date
            )
    );


    return aggregateCompleteGroups(
        sortedCandles,
        groupSize
    );
}


// ======================================================
// GENERIC AGGREGATOR
//
// Kept exported for compatibility.
//
// Default behavior remains NSE.
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
    buildTimeframes
};