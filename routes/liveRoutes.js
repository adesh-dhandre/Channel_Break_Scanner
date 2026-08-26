const express = require("express");

const {
    getRunnerState
} = require("../services/scanRunner");

const router = express.Router();


// ======================================================
// LIVE SCANNER STATUS
// ======================================================

router.get("/status", (req, res) => {

    const state = getRunnerState();

    return res.json({
        success: true,
        ...state
    });
});


// ======================================================
// LIVE SCANNER RESULTS
// ======================================================

router.get("/results", (req, res) => {

    const state = getRunnerState();

    const nseSetups =
        state.lastNseResult?.activeSetups || [];

    const cryptoSetups =
        state.lastCryptoResult?.activeSetups || [];

    return res.json({

        success: true,

        count:
            nseSetups.length +
            cryptoSetups.length,

        nse: {
            count: nseSetups.length,
            results: nseSetups
        },

        crypto: {
            count: cryptoSetups.length,
            results: cryptoSetups
        }

    });
});


module.exports = router;
