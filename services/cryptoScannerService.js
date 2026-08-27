const {
    getScannableCryptoUniverse
} = require("./cryptoUniverseService");

const {
    initializeSymbol
} = require("./cryptoMarketDataCache");

const {
    buildTimeframes
} = require("./timeframeService");

const {
    detectPrePhaseSetup
} = require("../scanners/setupScanner");


// ======================================================
// CONFIG
// ======================================================

const TARGET_TIMEFRAMES = [
    "15m",
    "30m",
    "45m",
    "1h",
    "2h"
];


const CONCURRENCY = 15;


// ======================================================
// SCAN SINGLE CRYPTO
// ======================================================

async function scanSingleCrypto(coin) {

    const {
        rank,
        symbol,
        name,
        tradingPair
    } = coin;


    console.log(
        `Scanning ${tradingPair}...`
    );


    try {

        // ==============================================
        // LOAD / REFRESH CRYPTO CACHE
        //
        // First run:
        // Binance -> 1500 5m candles
        //
        // Later:
        // cache + latest 100 Binance candles
        // ==============================================

        const candles5m =
            await initializeSymbol(
                tradingPair
            );


        if (
            !Array.isArray(
                candles5m
            ) ||
            candles5m.length === 0
        ) {

            throw new Error(
                "No 5m candle data"
            );
        }


        // ==============================================
        // BUILD CRYPTO TIMEFRAMES
        // ==============================================

        const timeframes =
            buildTimeframes(
                candles5m,
                "CRYPTO"
            );


        const scanSummary = [];

        const activeSetups = [];


        // ==============================================
        // SCAN EACH TIMEFRAME
        // ==============================================

        for (
            const timeframe
            of TARGET_TIMEFRAMES
        ) {

            const candles =
                timeframes[
                    timeframe
                ];


            if (
                !Array.isArray(
                    candles
                ) ||
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

                rank,

                symbol,

                name,

                tradingPair,

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

                uptrend:
                    result.uptrend,

                uptrendScenario:
                    result.uptrendScenario ||
                    null,

                flashSell:
                    result.flashSell,

                flashSellDate:
                    result.flashSellDate ||
                    null,

                flashSellAt:
                    result.flashSellAt ||
                    result.flashSellDate ||
                    null,

                recent:
                    result.isRecent === true,

                baseForming:
                    result.baseForming === true,

                baseType:
                    result.baseType ||
                    null

            });


            // ==========================================
            // ACTIVE PRE-PHASE SETUP
            // ==========================================

            if (
                result.isSetup === true
            ) {

                activeSetups.push({

                    rank,

                    symbol,

                    name,

                    tradingPair,

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
                        "BINANCE_USDT_PERPETUAL"

                });
            }
        }


        console.log(
            `${tradingPair} completed.`
        );


        return {

            symbol,

            tradingPair,

            success: true,

            scanSummary,

            activeSetups

        };


    } catch (error) {

        console.error(
            `${tradingPair} failed: ${error.message}`
        );


        return {

            symbol,

            tradingPair,

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
    items,
    batchSize
) {

    const batches = [];


    for (
        let i = 0;
        i < items.length;
        i += batchSize
    ) {

        batches.push(
            items.slice(
                i,
                i + batchSize
            )
        );
    }


    return batches;
}


// ======================================================
// FULL CRYPTO FUTURES SCANNER
// ======================================================

async function scanCryptoFutures() {

    const startedAt =
        Date.now();


    // ==============================================
    // GET BINANCE PERPETUAL UNIVERSE
    // ==============================================

    const universe =
        await getScannableCryptoUniverse();


    const batches =
        createBatches(
            universe,
            CONCURRENCY
        );


    const activeSetups = [];

    const scanSummary = [];


    let successfulCoins = 0;

    let failedCoins = 0;


    console.log(
        "\n===================================="
    );

    console.log(
        "CRYPTO FUTURES CHANNEL BREAK SCANNER"
    );

    console.log(
        "===================================="
    );

    console.log(
        `Coins: ${universe.length}`
    );

    console.log(
        `Concurrency: ${CONCURRENCY}`
    );

    console.log(
        `Batches: ${batches.length}`
    );


    // ==============================================
    // PROCESS BATCHES
    // ==============================================

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


        const results =
            await Promise.all(
                batch.map(
                    coin =>
                        scanSingleCrypto(
                            coin
                        )
                )
            );


        for (
            const result
            of results
        ) {

            if (
                result.success
            ) {

                successfulCoins++;

            } else {

                failedCoins++;
            }


            scanSummary.push(
                ...result.scanSummary
            );


            activeSetups.push(
                ...result.activeSetups
            );
        }
    }


    // ==============================================
    // FINAL RESULT
    // ==============================================

    const scanDurationSeconds =
        Number(
            (
                (
                    Date.now() -
                    startedAt
                ) /
                1000
            ).toFixed(2)
        );


    const finalResult = {

        scannedCoins:
            universe.length,

        successfulCoins,

        failedCoins,

        concurrency:
            CONCURRENCY,

        timeframes:
            TARGET_TIMEFRAMES,

        scanDurationSeconds,

        scanSummary,

        activeSetups

    };


    console.log(
        "\n===================================="
    );

    console.log(
        "CRYPTO SCAN COMPLETED"
    );

    console.log(
        "===================================="
    );

    console.log(
        `Coins scanned: ${universe.length}`
    );

    console.log(
        `Successful: ${successfulCoins}`
    );

    console.log(
        `Failed: ${failedCoins}`
    );

    console.log(
        `Active setups: ${activeSetups.length}`
    );

    console.log(
        `Actual scan time: ${scanDurationSeconds} seconds`
    );

    console.log(
        "===================================="
    );


    return finalResult;
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

    scanCryptoFutures,

    scanSingleCrypto

};