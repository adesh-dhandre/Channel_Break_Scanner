const express =
    require("express");

const {
    getScannerStatus,
    runScanner
} = require("../controllers/scannerController");

const {
    getChartData
} = require("../controllers/chartController");


const router =
    express.Router();


router.get(
    "/status",
    getScannerStatus
);


router.post(
    "/run",
    runScanner
);


// Chart candles for a specific stock + timeframe
router.get(
    "/chart/:symbol",
    getChartData
);


module.exports =
    router;