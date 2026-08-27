const fs = require("fs");
const path = require("path");

const {
    getFuturesCandles
} = require("./binanceFuturesService");


// ======================================================
// CONFIG
// ======================================================
//
// LOCAL:
// project/crypto-cache
//
// PRODUCTION / HOSTLESS:
// /tmp/channel-break-scanner/crypto-cache
//
// Hostless application filesystem may be read-only.
// /tmp is writable.
// ======================================================

const CACHE_DIR =
    process.env.NODE_ENV === "production"
        ? path.join(
            "/tmp",
            "channel-break-scanner",
            "crypto-cache"
        )
        : path.join(
            __dirname,
            "..",
            "crypto-cache"
        );


// First initialization.
//
// Enough history for channel calculations.

const INITIAL_CANDLE_LIMIT =
    1500;


// Normal live refresh.
//
// IMPORTANT:
// 99 is intentional.
//
// Binance kline weight:
//
// <100 candles = weight 1
//
// 100 candles would move us into the next
// request-weight tier.

const REFRESH_CANDLE_LIMIT =
    99;


// Keep local working history.

const MAX_CACHE_CANDLES =
    1500;


// Binance source candles are 5 minutes.

const FIVE_MINUTES_MS =
    5 * 60 * 1000;


// ======================================================
// CREATE CACHE DIRECTORY
// ======================================================

function ensureCacheDirectory() {

    if (
        !fs.existsSync(
            CACHE_DIR
        )
    ) {

        fs.mkdirSync(
            CACHE_DIR,
            {
                recursive: true
            }
        );


        console.log(
            `Created crypto candle cache directory: ${CACHE_DIR}`
        );
    }
}


// ======================================================
// CACHE FILE
// ======================================================

function getCacheFile(
    symbol
) {

    return path.join(
        CACHE_DIR,
        `${symbol}.json`
    );
}


// ======================================================
// NORMALIZE CANDLE
// ======================================================

function normalizeCandle(
    candle
) {

    return {

        date:
            candle.date instanceof Date
                ? candle.date
                : new Date(
                    candle.date
                ),

        open:
            Number(
                candle.open
            ),

        high:
            Number(
                candle.high
            ),

        low:
            Number(
                candle.low
            ),

        close:
            Number(
                candle.close
            ),

        volume:
            Number(
                candle.volume
            )

    };
}


// ======================================================
// CHECK WHETHER 5M CANDLE IS CLOSED
// ======================================================
//
// Binance candle.date is the candle OPEN time.
//
// Example:
//
// 01:55 candle
// opens  -> 01:55
// closes -> 02:00
//
// We must NEVER scan that candle before 02:00.
//
// This keeps:
// 5m
// 15m
// 30m
// 45m
// 1h
// 2h
//
// aligned with completed TradingView candles.
// ======================================================

function isClosedFiveMinuteCandle(
    candle,
    now = Date.now()
) {

    const openTime =
        candle.date instanceof Date
            ? candle.date.getTime()
            : new Date(
                candle.date
            ).getTime();


    if (
        Number.isNaN(
            openTime
        )
    ) {

        return false;
    }


    const closeTime =
        openTime +
        FIVE_MINUTES_MS;


    return (
        closeTime <=
        now
    );
}


// ======================================================
// REMOVE CURRENT / UNFINISHED 5M CANDLE
// ======================================================

function keepOnlyClosedCandles(
    candles
) {

    const now =
        Date.now();


    return candles.filter(
        candle =>
            isClosedFiveMinuteCandle(
                candle,
                now
            )
    );
}


// ======================================================
// LOAD CACHE
// ======================================================

function loadCandlesFromDisk(
    symbol
) {

    ensureCacheDirectory();


    const file =
        getCacheFile(
            symbol
        );


    if (
        !fs.existsSync(
            file
        )
    ) {

        return null;
    }


    try {

        const raw =
            fs.readFileSync(
                file,
                "utf8"
            );


        const parsed =
            JSON.parse(
                raw
            );


        if (
            !Array.isArray(
                parsed
            )
        ) {

            return null;
        }


        return keepOnlyClosedCandles(
            parsed
                .map(
                    normalizeCandle
                )
                .filter(
                    candle =>
                        !Number.isNaN(
                            candle.date
                                .getTime()
                        )
                )
        );


    } catch (error) {

        console.error(
            `${symbol}: failed to read crypto cache: ${error.message}`
        );


        return null;
    }
}


// ======================================================
// SAVE CACHE
// ======================================================

function saveCandlesToDisk(
    symbol,
    candles
) {

    ensureCacheDirectory();


    const file =
        getCacheFile(
            symbol
        );


    const cleanCandles =
        keepOnlyClosedCandles(
            candles
                .map(
                    normalizeCandle
                )
                .filter(
                    candle =>
                        !Number.isNaN(
                            candle.date
                                .getTime()
                        )
                )
        )
            .slice(
                -MAX_CACHE_CANDLES
            );


    fs.writeFileSync(
        file,
        JSON.stringify(
            cleanCandles,
            null,
            2
        )
    );


    return cleanCandles;
}


// ======================================================
// MERGE OLD + NEW CANDLES
// ======================================================

function mergeCandles(
    cachedCandles,
    freshCandles
) {

    const candleMap =
        new Map();


    for (
        const candle
        of cachedCandles
    ) {

        const normalized =
            normalizeCandle(
                candle
            );


        const time =
            normalized.date
                .getTime();


        if (
            !Number.isNaN(
                time
            )
        ) {

            candleMap.set(
                time,
                normalized
            );
        }
    }


    for (
        const candle
        of freshCandles
    ) {

        const normalized =
            normalizeCandle(
                candle
            );


        const time =
            normalized.date
                .getTime();


        if (
            !Number.isNaN(
                time
            )
        ) {

            // Fresh Binance candle replaces
            // cached candle with same timestamp.

            candleMap.set(
                time,
                normalized
            );
        }
    }


    return keepOnlyClosedCandles(
        Array
            .from(
                candleMap.values()
            )
            .sort(
                (
                    a,
                    b
                ) =>
                    a.date
                        .getTime() -
                    b.date
                        .getTime()
            )
    )
        .slice(
            -MAX_CACHE_CANDLES
        );
}


// ======================================================
// INITIALIZE / REFRESH SYMBOL
// ======================================================

async function initializeSymbol(
    symbol
) {

    ensureCacheDirectory();


    const cached =
        loadCandlesFromDisk(
            symbol
        );


    // ==================================================
    // FIRST RUN
    //
    // Expensive:
    // 1500 candles.
    // ==================================================

    if (
        !cached ||
        cached.length === 0
    ) {

        console.log(
            `${symbol}: no crypto cache found.`
        );


        console.log(
            `${symbol}: downloading ${INITIAL_CANDLE_LIMIT} 5m candles...`
        );


        const candles =
            await getFuturesCandles(
                symbol,
                "5m",
                INITIAL_CANDLE_LIMIT
            );


        const saved =
            saveCandlesToDisk(
                symbol,
                candles
            );


        console.log(
            `${symbol}: crypto history cached (${saved.length} closed candles).`
        );


        return saved;
    }


    // ==================================================
    // NORMAL LIVE REFRESH
    //
    // Cheap:
    // latest 99 candles.
    // ==================================================

    console.log(
        `${symbol}: loaded ${cached.length} closed candles from crypto cache.`
    );


    const freshCandles =
        await getFuturesCandles(
            symbol,
            "5m",
            REFRESH_CANDLE_LIMIT
        );


    const merged =
        mergeCandles(
            cached,
            freshCandles
        );


    const saved =
        saveCandlesToDisk(
            symbol,
            merged
        );


    console.log(
        `${symbol}: refreshed (${saved.length} closed candles).`
    );


    return saved;
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

    initializeSymbol,

    loadCandlesFromDisk,

    saveCandlesToDisk,

    mergeCandles,

    getCacheFile,

    isClosedFiveMinuteCandle,

    keepOnlyClosedCandles

};