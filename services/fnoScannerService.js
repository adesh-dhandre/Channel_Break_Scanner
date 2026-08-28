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


    const totalTimer =
        `${symbol} TOTAL`;


    console.time(
        totalTimer
    );


    try {

        // ==============================================
        // LOAD / REFRESH 5M DATA
        // ==============================================

        const candleTimer =
            `${symbol} candleLoad`;


        console.time(
            candleTimer
        );


        const candles5m =
            await getSymbolCandles(
                symbol
            );


        console.timeEnd(
            candleTimer
        );


        if (
            !candles5m ||
            candles5m.length === 0
        ) {

            console.timeEnd(
                totalTimer
            );


            return {

                symbol,

                success: false,

                error:
                    "No candle data",

                scanSummary: [],

                activeSetups: []

            };
        }


        console.log(
            `${symbol}: ${candles5m.length} 5m candles available`
        );


        // ==============================================
        // BUILD NSE TIMEFRAMES
        //
        // IMPORTANT:
        // NSE candles are aggregated inside each
        // IST trading session.
        // ==============================================

        const buildTimer =
            `${symbol} buildTimeframes`;


        console.time(
            buildTimer
        );


        const timeframes =
            buildTimeframes(
                candles5m,
                "NSE"
            );


        console.timeEnd(
            buildTimer
        );


        const scanSummary = [];

        const activeSetups = [];


        // ==============================================
        // SCAN EACH TIMEFRAME
        // ==============================================

        const setupTimer =
            `${symbol} detectSetups`;


        console.time(
            setupTimer
        );


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


            const timeframeTimer =
                `${symbol} ${timeframe}`;


            console.time(
                timeframeTimer
            );


            const result =
                detectPrePhaseSetup(
                    candles,
                    timeframe
                );


            console.timeEnd(
                timeframeTimer
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


        console.timeEnd(
            setupTimer
        );


        console.log(
            `${symbol} completed.`
        );


        console.timeEnd(
            totalTimer
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


        try {

            console.timeEnd(
                totalTimer
            );

        } catch (_) {
            // Timer may already have ended.
        }


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


    const fullScanTimer =
        "NSE FULL SCAN";


    console.time(
        fullScanTimer
    );


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


            const batchNumber =
                batchIndex + 1;


            console.log(
                `\nBatch ${batchNumber}/${batches.length}`
            );


            console.log(
                `Batch symbols: ${batch.join(", ")}`
            );


            const batchTimer =
                `NSE Batch ${batchNumber}`;


            console.time(
                batchTimer
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


            console.timeEnd(
                batchTimer
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


            console.log(
                `Batch ${batchNumber}/${batches.length} finished`
            );

            console.log(
                `Progress: ${successfulStocks + failedStocks}/${fnoSymbols.length}`
            );
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


        console.timeEnd(
            fullScanTimer
        );


        console.log(
            "\nNSE scan completed successfully"
        );

        console.log(
            `Successful stocks: ${successfulStocks}`
        );

        console.log(
            `Failed stocks: ${failedStocks}`
        );

        console.log(
            `Active setups: ${activeSetups.length}`
        );


        return finalResult;


    } catch (error) {

        failScan();


        console.error(
            "NSE full scan failed:",
            error
        );


        try {

            console.timeEnd(
                fullScanTimer
            );

        } catch (_) {
            // Timer may already have ended.
        }


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