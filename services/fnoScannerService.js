const {
    initializeSymbol,
    refreshSymbol,
    getCachedCandles
} = require("./marketDataCache");

const {
    buildTimeframes
} = require("./timeframeService");

const {
    detectPrePhaseSetup
} = require("../scanners/setupScanner");

const {
    fnoSymbols
} = require("../data/fnoSymbols");

const {
    startScan,
    completeScan,
    failScan
} = require("./scannerState");


const targetTimeframes = [
    "15m",
    "30m",
    "45m",
    "1h",
    "2h"
];


const CONCURRENCY = 10;


const initializedSymbols =
    new Set();


// ======================================================
// GET / REFRESH SYMBOL CANDLES
// ======================================================

async function getSymbolCandles(symbol) {

    if (
        !initializedSymbols.has(
            symbol
        )
    ) {

        const candles =
            await initializeSymbol(
                symbol
            );

        initializedSymbols.add(
            symbol
        );

        return candles;
    }


    return await refreshSymbol(
        symbol
    );
}


// ======================================================
// SCAN SINGLE NSE SYMBOL
// ======================================================

async function scanSingleSymbol(symbol) {

    console.log(
        `Scanning ${symbol}...`
    );


    try {

        const candles5m =
            await getSymbolCandles(
                symbol
            );


        if (
            !candles5m ||
            candles5m.length === 0
        ) {

            return {

                symbol,

                success: false,

                error:
                    "No candle data",

                scanSummary: [],

                activeSetups: []

            };
        }


        // ==============================================
        // BUILD NSE TIMEFRAMES
        //
        // IMPORTANT:
        // NSE candles are aggregated inside each
        // IST trading session.
        // ==============================================

        const timeframes =
            buildTimeframes(
                candles5m,
                "NSE"
            );


        const scanSummary = [];

        const activeSetups = [];


        // ==============================================
        // SCAN EACH TIMEFRAME
        // ==============================================

        for (
            const timeframe
            of targetTimeframes
        ) {

            const candles =
                timeframes[
                    timeframe
                ];


            if (
                !candles ||
                candles.length === 0
            ) {

                continue;
            }


            const result =
                detectPrePhaseSetup(
                    candles,
                    timeframe
                );


            // ==========================================
            // SUMMARY
            // ==========================================

            scanSummary.push({

                symbol,

                timeframe,

                status:
                    result.status,

                isSetup:
                    result.isSetup,

                lifecycle:
                    result.lifecycle ||
                    null,

                lifecycleLabel:
                    result.lifecycleLabel ||
                    null,

                lifecycleTone:
                    result.lifecycleTone ||
                    null,

                flashSellDate:
                    result.flashSellDate ||
                    null,

                flashSellAt:
                    result.flashSellAt ||
                    result.flashSellDate ||
                    null,

                baseType:
                    result.baseType ||
                    null

            });


            // ==========================================
            // ACTIVE PRE-PHASE SETUP
            // ==========================================

            if (
                result.isSetup
            ) {

                activeSetups.push({

                    symbol,

                    timeframe,

                    status:
                        result.status,

                    lifecycle:
                        result.lifecycle ||
                        null,

                    lifecycleLabel:
                        result.lifecycleLabel ||
                        null,

                    lifecycleTone:
                        result.lifecycleTone ||
                        null,

                    uptrendScenario:
                        result.uptrendScenario ||
                        null,

                    HH1:
                        result.HH1 ||
                        null,

                    HL1:
                        result.HL1 ||
                        null,

                    HH2:
                        result.HH2 ||
                        null,

                    HL2:
                        result.HL2 ||
                        null,

                    continuationHigh:
                        result.continuationHigh ||
                        null,

                    flashSellDate:
                        result.flashSellDate ||
                        null,

                    flashSellAt:
                        result.flashSellAt ||
                        result.flashSellDate ||
                        null,

                    flashSellDropPercent:
                        result.flashSellDropPercent,

                    flashSellBodyRatio:
                        result.flashSellBodyRatio,

                    lowerChannelValue:
                        result.lowerChannelValue,

                    channelLookback:
                        result.channelLookback,

                    highSlopePercent:
                        result.highSlopePercent,

                    lowSlopePercent:
                        result.lowSlopePercent,

                    parallelRatio:
                        result.parallelRatio,

                    channelRespectRatio:
                        result.channelRespectRatio,

                    candlesSinceFlashSell:
                        result.candlesSinceFlashSell,

                    maxCandlesSinceFlashSell:
                        result.maxCandlesSinceFlashSell,

                    ageText:
                        result.ageText ||
                        null,

                    baseForming:
                        result.baseForming === true,

                    baseType:
                        result.baseType ||
                        null,

                    baseStartedAt:
                        result.baseStartedAt ||
                        null,

                    baseConfirmedAt:
                        result.baseConfirmedAt ||
                        null,

                    baseCandlesFound:
                        result.baseCandlesFound,

                    market:
                        "NSE"

                });
            }
        }


        console.log(
            `${symbol} completed.`
        );


        return {

            symbol,

            success: true,

            scanSummary,

            activeSetups

        };


    } catch (error) {

        console.error(
            `${symbol} failed: ${error.message}`
        );


        return {

            symbol,

            success: false,

            error:
                error.message,

            scanSummary: [],

            activeSetups: []

        };
    }
}


// ======================================================
// CREATE BATCHES
// ======================================================

function createBatches(
    symbols,
    batchSize
) {

    const batches = [];


    for (
        let i = 0;
        i < symbols.length;
        i += batchSize
    ) {

        batches.push(
            symbols.slice(
                i,
                i + batchSize
            )
        );
    }


    return batches;
}


// ======================================================
// FULL NSE F&O SCANNER
// ======================================================

async function scanFnoStocks() {

    startScan();


    try {

        const activeSetups = [];

        const scanSummary = [];

        let successfulStocks = 0;

        let failedStocks = 0;


        const batches =
            createBatches(
                fnoSymbols,
                CONCURRENCY
            );


        console.log(
            `\nRunning ${fnoSymbols.length} stocks`
        );

        console.log(
            `Concurrency: ${CONCURRENCY}`
        );

        console.log(
            `Batches: ${batches.length}`
        );


        for (
            let batchIndex = 0;
            batchIndex < batches.length;
            batchIndex++
        ) {

            const batch =
                batches[
                    batchIndex
                ];


            console.log(
                `\nBatch ${batchIndex + 1}/${batches.length}`
            );


            const batchResults =
                await Promise.all(
                    batch.map(
                        symbol =>
                            scanSingleSymbol(
                                symbol
                            )
                    )
                );


            for (
                const result
                of batchResults
            ) {

                if (
                    result.success
                ) {

                    successfulStocks++;

                } else {

                    failedStocks++;
                }


                scanSummary.push(
                    ...result.scanSummary
                );


                activeSetups.push(
                    ...result.activeSetups
                );
            }
        }


        const finalResult = {

            scannedStocks:
                fnoSymbols.length,

            successfulStocks,

            failedStocks,

            concurrency:
                CONCURRENCY,

            timeframes:
                targetTimeframes,

            scanSummary,

            activeSetups

        };


        completeScan(
            finalResult
        );


        return finalResult;


    } catch (error) {

        failScan();

        throw error;
    }
}


// ======================================================
// CACHE INFO
// ======================================================

function getScannerCacheInfo() {

    const cacheInfo = [];


    for (
        const symbol
        of fnoSymbols
    ) {

        const candles =
            getCachedCandles(
                symbol
            );


        cacheInfo.push({

            symbol,

            cachedCandles:
                candles.length,

            initialized:
                initializedSymbols.has(
                    symbol
                )

        });
    }


    return cacheInfo;
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

    scanFnoStocks,

    getScannerCacheInfo

};