const {
    scanStrictLiveSetups
} = require("./strictLiveScannerService");


// ======================================================
// CONFIG
// ======================================================

const TARGET_TIMEFRAMES = [
    "5m",
    "15m",
    "30m",
    "45m",
    "1h",
    "2h",
    "4h",
    "1d"
];


const CONCURRENCY =
    15;


// ======================================================
// SCAN SINGLE CRYPTO
//
// Compatibility helper for existing callers/tests.
// Uses the new strict strategy only.
// ======================================================

async function scanSingleCrypto(
    coin
) {

    const tradingPair =
        String(
            coin?.tradingPair ||
            coin?.symbol ||
            ""
        ).toUpperCase();


    if (
        !tradingPair
    ) {

        return {
            symbol: null,
            tradingPair: null,
            success: false,
            error:
                "Missing trading pair",
            scanSummary: [],
            activeSetups: [],
            newSetups: []
        };
    }


    try {

        const result =
            await scanStrictLiveSetups({

                symbols: [
                    tradingPair
                ],

                forceTimeframes:
                    TARGET_TIMEFRAMES,

                concurrency:
                    1

            });


        const newSetups =
            (
                result.newSetups ||
                []
            ).filter(
                setup =>
                    setup.tradingPair ===
                        tradingPair ||
                    setup.symbol ===
                        tradingPair
            );


        const activeSetups =
            (
                result.currentSetups ||
                []
            ).filter(
                setup =>
                    setup.tradingPair ===
                        tradingPair ||
                    setup.symbol ===
                        tradingPair
            );


        return {
            symbol:
                coin?.symbol ||
                tradingPair,
            tradingPair,
            success: true,
            scanSummary:
                newSetups,
            activeSetups,
            newSetups
        };


    } catch (error) {

        console.error(
            `${tradingPair} strict scan failed: ${error.message}`
        );


        return {
            symbol:
                coin?.symbol ||
                tradingPair,
            tradingPair,
            success: false,
            error:
                error.message,
            scanSummary: [],
            activeSetups: [],
            newSetups: []
        };
    }
}


// ======================================================
// FULL CRYPTO FUTURES SCANNER
//
// IMPORTANT:
// This is now the production crypto strategy.
// The old PRE_PHASE detector is no longer called here.
// ======================================================

async function scanCryptoFutures() {

    const result =
        await scanStrictLiveSetups({
            concurrency:
                CONCURRENCY
        });


    const scannedCoins =
        result.scannedSymbols ||
        0;


    const failedCoins =
        result.failedSymbols ||
        0;


    const successfulCoins =
        Math.max(
            0,
            scannedCoins -
            failedCoins
        );


    const newSetups =
        Array.isArray(
            result.newSetups
        )
            ? result.newSetups
            : [];


    const activeSetups =
        Array.isArray(
            result.currentSetups
        )
            ? result.currentSetups
            : [];


    return {

        strategy:
            "STRICT_FLASH_TURN",

        scannedCoins,

        successfulCoins,

        failedCoins,

        concurrency:
            CONCURRENCY,

        timeframes:
            result.dueTimeframes ||
            [],

        scanDurationSeconds:
            result.scanDurationSeconds ||
            0,

        // Kept for API compatibility.
        // Now contains strict setups discovered
        // during the current scan only.
        scanSummary:
            newSetups,

        // Used for Discord notifications.
        newSetups,

        // Used by /api/live/results and frontend.
        activeSetups

    };
}


module.exports = {
    TARGET_TIMEFRAMES,
    scanCryptoFutures,
    scanSingleCrypto
};
