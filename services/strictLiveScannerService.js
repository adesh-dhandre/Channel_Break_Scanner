const {
    getUsdtPerpetualSymbols,
    getFuturesCandles
} = require("./binanceFuturesService");

const {
    aggregateCryptoCandles
} = require("./timeframeService");

const {
    detectStrictFlashTurnSetups
} = require(
    "../research/strict-flash-turn/strictStrategyDetector"
);

const {
    isStrictRedisEnabled,
    saveCurrentStrictSetups,
    getCurrentStrictSetups,
    saveStrictScanState
} = require("./strictRedisService");


// ======================================================
// CONFIG
// ======================================================

const FIVE_MINUTES_MS =
    5 * 60 * 1000;


const TIMEFRAMES = [

    {
        name: "5m",
        ms: 5 * 60 * 1000,
        sourceInterval: "5m",
        limit: 60
    },

    {
        name: "15m",
        ms: 15 * 60 * 1000,
        sourceInterval: "15m",
        limit: 60
    },

    {
        name: "30m",
        ms: 30 * 60 * 1000,
        sourceInterval: "30m",
        limit: 60
    },

    {
        name: "45m",
        ms: 45 * 60 * 1000,
        sourceInterval: "5m",
        limit: 450,
        aggregateGroup: 9
    },

    {
        name: "1h",
        ms: 60 * 60 * 1000,
        sourceInterval: "1h",
        limit: 60
    },

    {
        name: "2h",
        ms: 2 * 60 * 60 * 1000,
        sourceInterval: "2h",
        limit: 60
    },

    {
        name: "4h",
        ms: 4 * 60 * 60 * 1000,
        sourceInterval: "4h",
        limit: 60
    },

    {
        name: "1d",
        ms: 24 * 60 * 60 * 1000,
        sourceInterval: "1d",
        limit: 60
    }

];


const CONCURRENCY =
    15;


// ======================================================
// IN-MEMORY LOCAL FALLBACK
// ======================================================

let localCurrentSetups =
    [];


// ======================================================
// NORMALIZE TIME
// ======================================================

function getTime(
    candle
) {

    if (
        !candle ||
        !candle.date
    ) {
        return NaN;
    }


    return candle.date instanceof Date
        ? candle.date.getTime()
        : new Date(
            candle.date
        ).getTime();
}


// ======================================================
// CLOSED CANDLES ONLY
// ======================================================

function keepOnlyClosedCandles(
    candles,
    timeframeMs,
    now = Date.now()
) {

    if (
        !Array.isArray(
            candles
        )
    ) {
        return [];
    }


    return candles.filter(
        candle => {

            const openTime =
                getTime(
                    candle
                );


            if (
                Number.isNaN(
                    openTime
                )
            ) {
                return false;
            }


            return (
                openTime +
                timeframeMs <=
                now
            );
        }
    );
}


// ======================================================
// TIMEFRAME DUE CHECK
//
// External cron may run every 5 minutes.
//
// A timeframe is due during the first 5 minutes
// after one of its candle boundaries.
//
// Example:
//
// 15m:
// 10:15 - 10:19:59 => due
//
// 1h:
// 11:00 - 11:04:59 => due
//
// 1d Binance UTC:
// 00:00 UTC - 00:04:59 UTC => due
// ======================================================

function isTimeframeDue(
    timeframeMs,
    now = Date.now()
) {

    const boundary =
        Math.floor(
            now /
            timeframeMs
        ) *
        timeframeMs;


    return (
        now -
        boundary <
        FIVE_MINUTES_MS
    );
}


function getDueTimeframes(
    now = Date.now(),
    forceTimeframes = null
) {

    if (
        Array.isArray(
            forceTimeframes
        ) &&
        forceTimeframes.length > 0
    ) {

        const requested =
            new Set(
                forceTimeframes.map(
                    value =>
                        String(
                            value
                        ).toLowerCase()
                )
            );


        return TIMEFRAMES.filter(
            timeframe =>
                requested.has(
                    timeframe.name
                        .toLowerCase()
                )
        );
    }


    return TIMEFRAMES.filter(
        timeframe =>
            isTimeframeDue(
                timeframe.ms,
                now
            )
    );
}


// ======================================================
// CURRENT SETUP DETECTION
// ======================================================

function findCurrentStrictSetup(
    targetCandles,
    entrySourceCandles,
    timeframe,
    symbol,
    now
) {

    const completed =
        keepOnlyClosedCandles(
            targetCandles,
            timeframe.ms,
            now
        );


    if (
        completed.length < 45
    ) {
        return null;
    }


    const setups =
        detectStrictFlashTurnSetups(
            completed
        );


    if (
        setups.length === 0
    ) {
        return null;
    }


    const setup =
        setups[
            setups.length - 1
        ];


    // The reversal must be the most recently
    // completed target-timeframe candle.

    if (
        setup.reversalIndex !==
        completed.length - 1
    ) {
        return null;
    }


    const reversalOpen =
        new Date(
            setup.reversalDate
        ).getTime();


    const entryStart =
        reversalOpen +
        timeframe.ms;


    const entryEnd =
        entryStart +
        timeframe.ms;


    // Entry candle must currently be active.

    if (
        now <
        entryStart ||
        now >=
        entryEnd
    ) {
        return null;
    }


    // Native timeframes:
    // source candle = current target candle.
    //
    // 45m:
    // source candle = first 5m candle of
    // the new 45m entry candle.

    const entryCandle =
        entrySourceCandles.find(
            candle =>
                getTime(
                    candle
                ) ===
                entryStart
        );


    if (
        !entryCandle
    ) {
        return null;
    }


    const entry =
        Number(
            entryCandle.open
        );


    const stop =
        Number(
            setup.setupLow
        );


    const risk =
        entry -
        stop;


    if (
        !Number.isFinite(
            entry
        ) ||
        !Number.isFinite(
            stop
        ) ||
        risk <= 0
    ) {
        return null;
    }


    return {

        market:
            "BINANCE_USDT_PERPETUAL",

        strategy:
            "STRICT_FLASH_TURN",

        status:
            "STRICT_LIVE",

        symbol,

        tradingPair:
            symbol,

        timeframe:
            timeframe.name,

        setupType:
            setup.setupType,

        baseType:
            setup.setupType,

        setupColor:
            setup.setupColor,

        flashSellDate:
            new Date(
                setup.flashDate
            ).toISOString(),

        flashSellAt:
            new Date(
                setup.flashDate
            ).toISOString(),

        reversalTime:
            new Date(
                setup.reversalDate
            ).toISOString(),

        reversalDate:
            new Date(
                setup.reversalDate
            ).toISOString(),

        baseStartedAt:
            new Date(
                setup.reversalDate
            ).toISOString(),

        baseConfirmedAt:
            new Date(
                entryStart
            ).toISOString(),

        entryTime:
            new Date(
                entryStart
            ).toISOString(),

        entryEnd:
            new Date(
                entryEnd
            ).toISOString(),

        entry,

        stopLoss:
            stop,

        stop,

        risk,

        target1R:
            entry +
            risk,

        target1_5R:
            entry +
            risk *
            1.5,

        target2R:
            entry +
            risk *
            2,

        flashDropPct:
            setup.flash
                .dropPercent,

        flashBodyRatio:
            setup.flash
                .bodyRatio,

        breakDepthRatio:
            setup.flash
                .breakDepthRatio,

        reversalBodyRatio:
            setup.reversal
                .bodyRatio,

        lowerWickRatio:
            setup.reversal
                .lowerWickRatio,

        upperWickRatio:
            setup.reversal
                .upperWickRatio,

        detectedAt:
            new Date(
                now
            ).toISOString()

    };
}


// ======================================================
// FETCH + SCAN ONE SYMBOL
// ======================================================

async function scanStrictSymbol(
    symbol,
    dueTimeframes,
    now
) {

    const results =
        [];


    const dueNames =
        new Set(
            dueTimeframes.map(
                timeframe =>
                    timeframe.name
            )
        );


    let raw5m =
        null;


    // ==================================================
    // 5M SOURCE
    //
    // If 45m is due, fetch 450 5m candles once.
    // The same response can also be used for 5m.
    // ==================================================

    if (
        dueNames.has(
            "5m"
        ) ||
        dueNames.has(
            "45m"
        )
    ) {

        const limit =
            dueNames.has(
                "45m"
            )
                ? 450
                : 60;


        raw5m =
            await getFuturesCandles(
                symbol,
                "5m",
                limit
            );
    }


    // ==================================================
    // 5M
    // ==================================================

    if (
        dueNames.has(
            "5m"
        ) &&
        raw5m
    ) {

        const timeframe =
            TIMEFRAMES.find(
                item =>
                    item.name ===
                    "5m"
            );


        const setup =
            findCurrentStrictSetup(
                raw5m,
                raw5m,
                timeframe,
                symbol,
                now
            );


        if (
            setup
        ) {
            results.push(
                setup
            );
        }
    }


    // ==================================================
    // 45M
    // ==================================================

    if (
        dueNames.has(
            "45m"
        ) &&
        raw5m
    ) {

        const closed5m =
            keepOnlyClosedCandles(
                raw5m,
                FIVE_MINUTES_MS,
                now
            );


        const candles45m =
            aggregateCryptoCandles(
                closed5m,
                9
            );


        const timeframe =
            TIMEFRAMES.find(
                item =>
                    item.name ===
                    "45m"
            );


        const setup =
            findCurrentStrictSetup(
                candles45m,
                raw5m,
                timeframe,
                symbol,
                now
            );


        if (
            setup
        ) {
            results.push(
                setup
            );
        }
    }


    // ==================================================
    // NATIVE BINANCE TIMEFRAMES
    // ==================================================

    const nativeTimeframes =
        dueTimeframes.filter(
            timeframe =>
                timeframe.name !==
                    "5m" &&
                timeframe.name !==
                    "45m"
        );


    const nativeResponses =
        await Promise.all(
            nativeTimeframes.map(
                async timeframe => {

                    const candles =
                        await getFuturesCandles(
                            symbol,
                            timeframe
                                .sourceInterval,
                            timeframe
                                .limit
                        );


                    return {
                        timeframe,
                        candles
                    };
                }
            )
        );


    for (
        const item
        of nativeResponses
    ) {

        const setup =
            findCurrentStrictSetup(
                item.candles,
                item.candles,
                item.timeframe,
                symbol,
                now
            );


        if (
            setup
        ) {
            results.push(
                setup
            );
        }
    }


    return results;
}


// ======================================================
// CONCURRENCY HELPER
// ======================================================

async function runWithConcurrency(
    items,
    concurrency,
    worker
) {

    const results =
        new Array(
            items.length
        );


    let nextIndex =
        0;


    async function runner() {

        while (
            true
        ) {

            const index =
                nextIndex++;


            if (
                index >=
                items.length
            ) {
                return;
            }


            results[index] =
                await worker(
                    items[index],
                    index
                );
        }
    }


    const workerCount =
        Math.min(
            concurrency,
            items.length
        );


    await Promise.all(
        Array.from(
            {
                length:
                    workerCount
            },
            () =>
                runner()
        )
    );


    return results;
}


// ======================================================
// SETUP KEY
// ======================================================

function createSetupKey(
    setup
) {

    return [

        setup.symbol,

        setup.timeframe,

        setup.reversalTime

    ].join(
        "|"
    );
}


// ======================================================
// CURRENT SETUP STORAGE
// ======================================================

async function loadExistingCurrentSetups() {

    if (
        isStrictRedisEnabled()
    ) {

        try {

            const stored =
                await getCurrentStrictSetups();


            if (
                Array.isArray(
                    stored
                )
            ) {
                return stored;
            }

        } catch (error) {

            console.error(
                "Strict Redis read failed:",
                error.message
            );
        }
    }


    return localCurrentSetups;
}


async function persistCurrentSetups(
    setups
) {

    localCurrentSetups =
        setups;


    if (
        isStrictRedisEnabled()
    ) {

        try {

            await saveCurrentStrictSetups(
                setups
            );

        } catch (error) {

            console.error(
                "Strict Redis save failed:",
                error.message
            );
        }
    }
}


// ======================================================
// MERGE + REMOVE EXPIRED SETUPS
// ======================================================

function mergeCurrentSetups(
    existing,
    newSetups,
    now
) {

    const setupMap =
        new Map();


    for (
        const setup
        of (
            Array.isArray(
                existing
            )
                ? existing
                : []
        )
    ) {

        const entryEnd =
            new Date(
                setup.entryEnd
            ).getTime();


        if (
            Number.isNaN(
                entryEnd
            ) ||
            entryEnd <=
                now
        ) {
            continue;
        }


        setupMap.set(
            createSetupKey(
                setup
            ),
            setup
        );
    }


    for (
        const setup
        of newSetups
    ) {

        setupMap.set(
            createSetupKey(
                setup
            ),
            setup
        );
    }


    return Array.from(
        setupMap.values()
    )
        .sort(
            (a, b) =>
                new Date(
                    b.entryTime
                ).getTime() -
                new Date(
                    a.entryTime
                ).getTime()
        );
}


// ======================================================
// MAIN LIVE SCAN
// ======================================================

async function scanStrictLiveSetups(
    options = {}
) {

    const startedAt =
        Date.now();


    const now =
        Number.isFinite(
            options.now
        )
            ? options.now
            : Date.now();


    const dueTimeframes =
        getDueTimeframes(
            now,
            options.forceTimeframes
        );


    if (
        dueTimeframes.length === 0
    ) {

        return {

            success: true,

            scannedSymbols:
                0,

            dueTimeframes:
                [],

            newSetups:
                [],

            currentSetups:
                await loadExistingCurrentSetups(),

            scanDurationSeconds:
                0

        };
    }


    let symbols;


    if (
        Array.isArray(
            options.symbols
        ) &&
        options.symbols.length > 0
    ) {

        symbols =
            options.symbols.map(
                symbol =>
                    String(
                        symbol
                    ).toUpperCase()
            );

    } else {

        const symbolMap =
            await getUsdtPerpetualSymbols();


        symbols =
            Array.from(
                symbolMap.values()
            );
    }


    console.log(
        "\n===================================="
    );

    console.log(
        "STRICT LIVE CRYPTO SCAN STARTED"
    );

    console.log(
        `Symbols: ${symbols.length}`
    );

    console.log(
        `Due TFs: ${dueTimeframes
            .map(
                timeframe =>
                    timeframe.name
            )
            .join(", ")}`
    );

    console.log(
        "===================================="
    );


    try {

        await saveStrictScanState({

            running:
                true,

            startedAt:
                new Date(
                    startedAt
                ).toISOString(),

            dueTimeframes:
                dueTimeframes.map(
                    timeframe =>
                        timeframe.name
                ),

            scannedSymbols:
                0

        });

    } catch (_) {
        // Redis disabled or unavailable.
    }


    let completedCount =
        0;

    let failedCount =
        0;


    const scanResults =
        await runWithConcurrency(

            symbols,

            options.concurrency ||
                CONCURRENCY,

            async symbol => {

                try {

                    const setups =
                        await scanStrictSymbol(
                            symbol,
                            dueTimeframes,
                            now
                        );


                    completedCount++;


                    if (
                        completedCount %
                            25 ===
                            0 ||
                        completedCount ===
                            symbols.length
                    ) {

                        console.log(
                            `Strict scan ${completedCount}/${symbols.length}`
                        );
                    }


                    return setups;

                } catch (error) {

                    completedCount++;
                    failedCount++;


                    console.error(
                        `${symbol}: strict scan failed: ${error.message}`
                    );


                    return [];
                }
            }
        );


    const newSetups =
        scanResults.flat();


    const existing =
        await loadExistingCurrentSetups();


    const currentSetups =
        mergeCurrentSetups(
            existing,
            newSetups,
            now
        );


    await persistCurrentSetups(
        currentSetups
    );


    const completedAt =
        Date.now();


    const state = {

        running:
            false,

        success:
            true,

        startedAt:
            new Date(
                startedAt
            ).toISOString(),

        completedAt:
            new Date(
                completedAt
            ).toISOString(),

        scannedSymbols:
            symbols.length,

        failedSymbols:
            failedCount,

        dueTimeframes:
            dueTimeframes.map(
                timeframe =>
                    timeframe.name
            ),

        newSetupCount:
            newSetups.length,

        currentSetupCount:
            currentSetups.length,

        scanDurationSeconds:
            Number(
                (
                    (
                        completedAt -
                        startedAt
                    ) /
                    1000
                ).toFixed(
                    2
                )
            )

    };


    try {

        await saveStrictScanState(
            state
        );

    } catch (_) {
        // Redis disabled or unavailable.
    }


    console.log(
        `Strict live scan complete. New: ${newSetups.length}, Current: ${currentSetups.length}`
    );


    return {

        ...state,

        newSetups,

        currentSetups

    };
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

    TIMEFRAMES,

    isTimeframeDue,

    getDueTimeframes,

    keepOnlyClosedCandles,

    findCurrentStrictSetup,

    scanStrictLiveSetups

};
