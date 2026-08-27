const fs = require("fs");
const path = require("path");

const {
    getHistoricalCandles,
    getRecentCandles
} = require("./yahooService");


// ======================================================
// CACHE DIRECTORY
//
// LOCAL:
// project/cache
//
// PRODUCTION / HOSTLESS:
// /tmp/channel-break-scanner/cache
// ======================================================

const CACHE_DIR =
    process.env.NODE_ENV === "production"
        ? path.join(
            "/tmp",
            "channel-break-scanner",
            "cache"
        )
        : path.join(
            __dirname,
            "../cache"
        );


const candleCache =
    new Map();


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
            `Created NSE candle cache directory: ${CACHE_DIR}`
        );
    }
}


ensureCacheDirectory();


// ======================================================
// CACHE FILE PATH
// ======================================================

function getCacheFilePath(
    symbol
) {

    const safeSymbol =
        symbol.replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
        );


    return path.join(
        CACHE_DIR,
        `${safeSymbol}.json`
    );
}


// ======================================================
// NORMALIZE CANDLES
// ======================================================

function normalizeCandles(
    candles
) {

    if (
        !Array.isArray(
            candles
        )
    ) {

        return [];
    }


    return candles
        .map(
            candle => {

                const date =
                    candle.date instanceof Date
                        ? candle.date
                        : new Date(
                            candle.date
                        );


                if (
                    Number.isNaN(
                        date.getTime()
                    )
                ) {

                    return null;
                }


                return {

                    ...candle,

                    date

                };
            }
        )
        .filter(
            Boolean
        );
}


// ======================================================
// SAVE TO DISK
// ======================================================

function saveCandlesToDisk(
    symbol,
    candles
) {

    try {

        ensureCacheDirectory();


        const filePath =
            getCacheFilePath(
                symbol
            );


        const data = {

            symbol,

            updatedAt:
                new Date()
                    .toISOString(),

            candles

        };


        fs.writeFileSync(
            filePath,
            JSON.stringify(
                data
            ),
            "utf8"
        );


    } catch (error) {

        console.error(
            `Could not save cache for ${symbol}:`,
            error.message
        );
    }
}


// ======================================================
// LOAD FROM DISK
// ======================================================

function loadCandlesFromDisk(
    symbol
) {

    try {

        ensureCacheDirectory();


        const filePath =
            getCacheFilePath(
                symbol
            );


        if (
            !fs.existsSync(
                filePath
            )
        ) {

            return null;
        }


        const raw =
            fs.readFileSync(
                filePath,
                "utf8"
            );


        const parsed =
            JSON.parse(
                raw
            );


        if (
            !Array.isArray(
                parsed.candles
            )
        ) {

            return null;
        }


        return normalizeCandles(
            parsed.candles
        );


    } catch (error) {

        console.error(
            `Could not read cache for ${symbol}:`,
            error.message
        );


        return null;
    }
}


// ======================================================
// MERGE OLD + NEW CANDLES
// ======================================================

function mergeCandles(
    oldCandles,
    newCandles
) {

    const mergedMap =
        new Map();


    const normalizedOld =
        normalizeCandles(
            oldCandles
        );


    const normalizedNew =
        normalizeCandles(
            newCandles
        );


    for (
        const candle
        of normalizedOld
    ) {

        const key =
            candle.date
                .getTime();


        mergedMap.set(
            key,
            candle
        );
    }


    for (
        const candle
        of normalizedNew
    ) {

        const key =
            candle.date
                .getTime();


        mergedMap.set(
            key,
            candle
        );
    }


    const mergedCandles =
        Array.from(
            mergedMap.values()
        );


    mergedCandles.sort(
        (
            a,
            b
        ) =>
            a.date.getTime() -
            b.date.getTime()
    );


    return mergedCandles;
}


// ======================================================
// INITIALIZE SYMBOL
// ======================================================

async function initializeSymbol(
    symbol
) {

    // MEMORY
    const memoryCandles =
        candleCache.get(
            symbol
        );


    if (
        memoryCandles &&
        memoryCandles.length
    ) {

        return memoryCandles;
    }


    // DISK
    const diskCandles =
        loadCandlesFromDisk(
            symbol
        );


    if (
        diskCandles &&
        diskCandles.length
    ) {

        candleCache.set(
            symbol,
            diskCandles
        );


        console.log(
            `${symbol}: loaded ${diskCandles.length} candles from disk.`
        );


        return diskCandles;
    }


    // YAHOO FULL HISTORY
    console.log(
        `Loading full history for ${symbol}...`
    );


    const historicalCandles =
        normalizeCandles(
            await getHistoricalCandles(
                symbol
            )
        );


    candleCache.set(
        symbol,
        historicalCandles
    );


    saveCandlesToDisk(
        symbol,
        historicalCandles
    );


    console.log(
        `${symbol}: history cached (${historicalCandles.length} candles).`
    );


    return historicalCandles;
}


// ======================================================
// REFRESH SYMBOL
// ======================================================

async function refreshSymbol(
    symbol
) {

    let existingCandles =
        candleCache.get(
            symbol
        );


    if (
        !existingCandles ||
        !existingCandles.length
    ) {

        existingCandles =
            loadCandlesFromDisk(
                symbol
            );


        if (
            existingCandles &&
            existingCandles.length
        ) {

            candleCache.set(
                symbol,
                existingCandles
            );

        } else {

            return await initializeSymbol(
                symbol
            );
        }
    }


    const recentCandles =
        normalizeCandles(
            await getRecentCandles(
                symbol
            )
        );


    const mergedCandles =
        mergeCandles(
            existingCandles,
            recentCandles
        );


    candleCache.set(
        symbol,
        mergedCandles
    );


    saveCandlesToDisk(
        symbol,
        mergedCandles
    );


    return mergedCandles;
}


// ======================================================
// GET CACHED CANDLES
// ======================================================

function getCachedCandles(
    symbol
) {

    const memoryCandles =
        candleCache.get(
            symbol
        );


    if (
        memoryCandles
    ) {

        return memoryCandles;
    }


    const diskCandles =
        loadCandlesFromDisk(
            symbol
        );


    if (
        diskCandles
    ) {

        candleCache.set(
            symbol,
            diskCandles
        );


        return diskCandles;
    }


    return [];
}


// ======================================================
// CACHE STATS
// ======================================================

function getCacheStats() {

    const stats = [];


    for (
        const [
            symbol,
            candles
        ]
        of candleCache.entries()
    ) {

        stats.push({

            symbol,

            candles:
                candles.length

        });
    }


    return stats;
}


// ======================================================
// CLEAR MEMORY ONLY
// ======================================================

function clearMemoryCache() {

    candleCache.clear();
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

    initializeSymbol,

    refreshSymbol,

    getCachedCandles,

    getCacheStats,

    mergeCandles,

    normalizeCandles,

    loadCandlesFromDisk,

    saveCandlesToDisk,

    clearMemoryCache

};