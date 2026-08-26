const {
    getScannerState
} = require("../services/scannerState");

const {
    scanFnoStocks
} = require("../services/fnoScannerService");


// ========================================
// GET CURRENT SCANNER STATE
// ========================================

function getScannerStatus(
    req,
    res
) {

    const state =
        getScannerState();


    res.json({
        success: true,
        data: state
    });
}


// ========================================
// START SCANNER IN BACKGROUND
// ========================================

function runScanner(
    req,
    res
) {

    const state =
        getScannerState();


    // Prevent two scans running together
    if (state.scanning) {

        return res
            .status(409)
            .json({

                success: false,

                message:
                    "Scanner is already running."

            });
    }


    // ====================================
    // START SCAN WITHOUT WAITING
    // ====================================

    scanFnoStocks()
        .then(result => {

            console.log(
                "\nBackground F&O scan completed."
            );

            console.log(
                `Stocks scanned: ${result.scannedStocks}`
            );

            console.log(
                `Active setups: ${result.activeSetups.length}`
            );

        })
        .catch(error => {

            console.error(
                "\nBackground scanner failed:"
            );

            console.error(
                error.message
            );

        });


    // ====================================
    // RESPOND IMMEDIATELY
    // ====================================

    return res
        .status(202)
        .json({

            success: true,

            message:
                "F&O scanner started in background."

        });
}


module.exports = {
    getScannerStatus,
    runScanner
};