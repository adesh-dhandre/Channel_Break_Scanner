const {
    scanCryptoFutures
} = require("../services/cryptoScannerService");


// ======================================================
// IN-MEMORY SCANNER STATE
// ======================================================

let scannerState = {

    running: false,

    status: "IDLE",

    startedAt: null,

    completedAt: null,

    error: null,

    stats: {
        scannedCoins: 0,
        successfulCoins: 0,
        failedCoins: 0,
        activeSetups: 0,
        scanDurationSeconds: 0
    },

    results: []
};


// ======================================================
// POST /api/crypto/scan
// ======================================================

function startCryptoScan(req, res) {

    if (scannerState.running) {

        return res.status(409).json({

            success: false,

            message:
                "Crypto scanner is already running.",

            status:
                scannerState.status

        });
    }


    scannerState = {

        running: true,

        status: "RUNNING",

        startedAt:
            new Date(),

        completedAt:
            null,

        error:
            null,

        stats: {
            scannedCoins: 0,
            successfulCoins: 0,
            failedCoins: 0,
            activeSetups: 0,
            scanDurationSeconds: 0
        },

        // Keep previous results visible while scanning.
        results:
            scannerState.results || []

    };


    // Respond immediately.
    // Scanner continues in background.

    res.status(202).json({

        success: true,

        message:
            "Crypto futures scanner started.",

        status:
            "RUNNING",

        startedAt:
            scannerState.startedAt

    });


    // ==================================================
    // BACKGROUND SCAN
    // ==================================================

    scanCryptoFutures()

        .then(result => {

            scannerState.running =
                false;

            scannerState.status =
                "COMPLETED";

            scannerState.completedAt =
                new Date();

            scannerState.error =
                null;


            scannerState.results =
                result.activeSetups || [];


            scannerState.stats = {

                scannedCoins:
                    result.scannedCoins || 0,

                successfulCoins:
                    result.successfulCoins || 0,

                failedCoins:
                    result.failedCoins || 0,

                activeSetups:
                    (
                        result.activeSetups ||
                        []
                    ).length,

                scanDurationSeconds:
                    result.scanDurationSeconds || 0

            };


            console.log(
                `Crypto background scan completed. Setups: ${scannerState.stats.activeSetups}`
            );

        })

        .catch(error => {

            scannerState.running =
                false;

            scannerState.status =
                "FAILED";

            scannerState.completedAt =
                new Date();

            scannerState.error =
                error.message;


            console.error(
                "Crypto background scan failed:",
                error
            );

        });
}


// ======================================================
// GET /api/crypto/results
// ======================================================

function getCryptoResults(req, res) {

    return res.json({

        success: true,

        status:
            scannerState.status,

        running:
            scannerState.running,

        count:
            scannerState.results.length,

        results:
            scannerState.results

    });
}


// ======================================================
// GET /api/crypto/status
// ======================================================

function getCryptoStatus(req, res) {

    return res.json({

        success: true,

        running:
            scannerState.running,

        status:
            scannerState.status,

        startedAt:
            scannerState.startedAt,

        completedAt:
            scannerState.completedAt,

        error:
            scannerState.error,

        stats:
            scannerState.stats

    });
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

    startCryptoScan,

    getCryptoResults,

    getCryptoStatus

};