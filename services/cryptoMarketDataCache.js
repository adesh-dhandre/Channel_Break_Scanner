const fs = require("fs");
const path = require("path");

const {
    getFuturesCandles
} = require("./binanceFuturesService");


// ======================================================
// CONFIG
// ======================================================

const CACHE_DIR =
    path.join(
        __dirname,
        "..",
        "crypto-cache"
    );


// First time:
// Download enough history for timeframe calculations.

const INITIAL_CANDLE_LIMIT = 1500;


// Later scans:
// Only refresh the most recent candles.

const REFRESH_CANDLE_LIMIT = 100;


// Keep maximum number of 5m candles locally.

const MAX_CACHE_CANDLES = 1500;


// ======================================================
// CREATE CACHE DIRECTORY
// ======================================================

function ensureCacheDirectory() {

    if (
        !fs.existsSync(CACHE_DIR)
    ) {

        fs.mkdirSync(
            CACHE_DIR,
            {
                recursive: true
            }
        );

        console.log(
            "Created crypto candle cache directory."
        );
    }
}


// ======================================================
// CACHE FILE
// ======================================================

function getCacheFile(symbol) {

    return path.join(
        CACHE_DIR,
        `${symbol}.json`
    );
}


// ======================================================
// NORMALIZE CANDLE
// ======================================================

function normalizeCandle(candle) {

    return {

        date:
            candle.date instanceof Date
                ? candle.date
                : new Date(candle.date),

        open:
            Number(candle.open),

        high:
            Number(candle.high),

        low:
            Number(candle.low),

        close:
            Number(candle.close),

        volume:
            Number(candle.volume)

    };
}


// ======================================================
// LOAD CACHE
// ======================================================

function loadCandlesFromDisk(symbol) {

    ensureCacheDirectory();


    const file =
        getCacheFile(symbol);


    if (
        !fs.existsSync(file)
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
            JSON.parse(raw);


        if (
            !Array.isArray(parsed)
        ) {

            return null;
        }


        return parsed
            .map(normalizeCandle)
            .filter(
                candle =>
                    !Number.isNaN(
                        candle.date.getTime()
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
        getCacheFile(symbol);


    const cleanCandles =
        candles
            .map(normalizeCandle)
            .filter(
                candle =>
                    !Number.isNaN(
                        candle.date.getTime()
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
//
// Candle timestamp is the unique key.
// New Binance candle replaces old cached candle.
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
            normalizeCandle(candle);


        const time =
            normalized.date.getTime();


        if (
            !Number.isNaN(time)
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
            normalizeCandle(candle);


        const time =
            normalized.date.getTime();


        if (
            !Number.isNaN(time)
        ) {

            // Fresh Binance data wins.

            candleMap.set(
                time,
                normalized
            );
        }
    }


    return Array
        .from(
            candleMap.values()
        )
        .sort(
            (a, b) =>
                a.date.getTime() -
                b.date.getTime()
        )
        .slice(
            -MAX_CACHE_CANDLES
        );
}


// ======================================================
// INITIALIZE SYMBOL
//
// FIRST RUN:
// Binance -> 1500 candles -> disk
//
// LATER:
// disk -> Binance latest 100 -> merge -> disk
// ======================================================

async function initializeSymbol(symbol) {

    ensureCacheDirectory();


    const cached =
        loadCandlesFromDisk(
            symbol
        );


    // --------------------------------------------------
// FIRST RUN
// --------------------------------------------------

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
            `${symbol}: crypto history cached (${saved.length} candles).`
        );


        return saved;
    }


    // --------------------------------------------------
// REFRESH EXISTING CACHE
// --------------------------------------------------

    console.log(
        `${symbol}: loaded ${cached.length} candles from crypto cache.`
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
        `${symbol}: refreshed (${saved.length} candles).`
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

    getCacheFile

};