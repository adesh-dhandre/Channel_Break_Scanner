const {
    scanFnoStocks
} = require("./fnoScannerService");

const {
    scanCryptoFutures
} = require("./cryptoScannerService");

const {
    processSetupAlerts
} = require("./signalAlertManager");


// ======================================================
// LIVE SCAN RUNNER
// ======================================================

let runnerState = {

    nseRunning: false,
    cryptoRunning: false,

    lastNseStartedAt: null,
    lastNseCompletedAt: null,

    lastCryptoStartedAt: null,
    lastCryptoCompletedAt: null,

    lastNseError: null,
    lastCryptoError: null,

    lastNseResult: null,
    lastCryptoResult: null,

    lastNseAlertResult: null,
    lastCryptoAlertResult: null

};


// ======================================================
// NSE LIVE SCAN
// ======================================================

async function runNseScan() {

    if (
        runnerState.nseRunning
    ) {

        console.log(
            "NSE scan skipped: previous scan still running."
        );

        return {

            success: false,

            skipped: true,

            reason:
                "NSE_SCAN_ALREADY_RUNNING",

            activeSetups: []

        };
    }


    runnerState.nseRunning =
        true;

    runnerState.lastNseStartedAt =
        new Date();

    runnerState.lastNseError =
        null;


    console.log(
        "\n===================================="
    );

    console.log(
        "LIVE NSE SCAN STARTED"
    );

    console.log(
        "===================================="
    );


    try {

        const result =
            await scanFnoStocks();


        const activeSetups =
            Array.isArray(
                result?.activeSetups
            )
                ? result.activeSetups
                : [];


        // ==============================================
        // EMAIL NEW PRE_PHASE SIGNALS
        // ==============================================

        const alertResult =
            await processSetupAlerts(
                activeSetups
            );


        runnerState.lastNseAlertResult =
            alertResult;


        console.log(
            `NSE alerts — new: ${alertResult.sent}, duplicates: ${alertResult.duplicates}, failed: ${alertResult.failed}`
        );


        // ==============================================
        // STORE LIVE RESULT
        // ==============================================

        runnerState.lastNseResult = {

            scannedStocks:
                result?.scannedStocks || 0,

            successfulStocks:
                result?.successfulStocks || 0,

            failedStocks:
                result?.failedStocks || 0,

            concurrency:
                result?.concurrency || 0,

            timeframes:
                result?.timeframes || [],

            activeSetups,

            alerts:
                alertResult

        };


        runnerState.lastNseCompletedAt =
            new Date();


        console.log(
            `Live NSE scan completed. Active setups: ${activeSetups.length}`
        );


        return {

            success: true,

            market:
                "NSE",

            scanned:
                result?.scannedStocks || 0,

            successful:
                result?.successfulStocks || 0,

            failed:
                result?.failedStocks || 0,

            activeSetups,

            alerts:
                alertResult

        };


    } catch (error) {

        runnerState.lastNseError =
            error.message;

        runnerState.lastNseCompletedAt =
            new Date();


        console.error(
            "Live NSE scan failed:",
            error
        );


        return {

            success: false,

            market:
                "NSE",

            error:
                error.message,

            activeSetups: []

        };


    } finally {

        runnerState.nseRunning =
            false;

    }
}


// ======================================================
// CRYPTO LIVE SCAN
// ======================================================

async function runCryptoScan() {

    if (
        runnerState.cryptoRunning
    ) {

        console.log(
            "Crypto scan skipped: previous scan still running."
        );


        return {

            success: false,

            skipped: true,

            reason:
                "CRYPTO_SCAN_ALREADY_RUNNING",

            activeSetups: []

        };
    }


    runnerState.cryptoRunning =
        true;

    runnerState.lastCryptoStartedAt =
        new Date();

    runnerState.lastCryptoError =
        null;


    console.log(
        "\n===================================="
    );

    console.log(
        "LIVE CRYPTO SCAN STARTED"
    );

    console.log(
        "===================================="
    );


    try {

        const result =
            await scanCryptoFutures();


        const activeSetups =
            Array.isArray(
                result?.activeSetups
            )
                ? result.activeSetups
                : [];


        // ==============================================
        // EMAIL NEW PRE_PHASE SIGNALS
        // ==============================================

        const alertResult =
            await processSetupAlerts(
                activeSetups
            );


        runnerState.lastCryptoAlertResult =
            alertResult;


        console.log(
            `Crypto alerts — new: ${alertResult.sent}, duplicates: ${alertResult.duplicates}, failed: ${alertResult.failed}`
        );


        // ==============================================
        // STORE LIVE RESULT
        // ==============================================

        runnerState.lastCryptoResult = {

            scannedCoins:
                result?.scannedCoins || 0,

            successfulCoins:
                result?.successfulCoins || 0,

            failedCoins:
                result?.failedCoins || 0,

            concurrency:
                result?.concurrency || 0,

            timeframes:
                result?.timeframes || [],

            scanDurationSeconds:
                result?.scanDurationSeconds || 0,

            activeSetups,

            alerts:
                alertResult

        };


        runnerState.lastCryptoCompletedAt =
            new Date();


        console.log(
            `Live crypto scan completed. Active setups: ${activeSetups.length}`
        );


        return {

            success: true,

            market:
                "CRYPTO",

            scanned:
                result?.scannedCoins || 0,

            successful:
                result?.successfulCoins || 0,

            failed:
                result?.failedCoins || 0,

            scanDurationSeconds:
                result?.scanDurationSeconds || 0,

            activeSetups,

            alerts:
                alertResult

        };


    } catch (error) {

        runnerState.lastCryptoError =
            error.message;

        runnerState.lastCryptoCompletedAt =
            new Date();


        console.error(
            "Live crypto scan failed:",
            error
        );


        return {

            success: false,

            market:
                "CRYPTO",

            error:
                error.message,

            activeSetups: []

        };


    } finally {

        runnerState.cryptoRunning =
            false;

    }
}


// ======================================================
// RUN BOTH
// ======================================================

async function runAllScans() {

    const startedAt =
        new Date();


    const [
        nse,
        crypto
    ] =
        await Promise.all([

            runNseScan(),

            runCryptoScan()

        ]);


    return {

        success:
            nse.success ||
            crypto.success,

        startedAt,

        completedAt:
            new Date(),

        nse,

        crypto,

        activeSetups: [

            ...(
                nse.activeSetups ||
                []
            ),

            ...(
                crypto.activeSetups ||
                []
            )

        ]

    };
}


// ======================================================
// GET LIVE STATE
// ======================================================

function getRunnerState() {

    return {

        nseRunning:
            runnerState.nseRunning,

        cryptoRunning:
            runnerState.cryptoRunning,


        lastNseStartedAt:
            runnerState.lastNseStartedAt,

        lastNseCompletedAt:
            runnerState.lastNseCompletedAt,


        lastCryptoStartedAt:
            runnerState.lastCryptoStartedAt,

        lastCryptoCompletedAt:
            runnerState.lastCryptoCompletedAt,


        lastNseError:
            runnerState.lastNseError,

        lastCryptoError:
            runnerState.lastCryptoError,


        lastNseResult:
            runnerState.lastNseResult,

        lastCryptoResult:
            runnerState.lastCryptoResult,


        lastNseAlertResult:
            runnerState.lastNseAlertResult,

        lastCryptoAlertResult:
            runnerState.lastCryptoAlertResult

    };
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

    runNseScan,

    runCryptoScan,

    runAllScans,

    getRunnerState

};