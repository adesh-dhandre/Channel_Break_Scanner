const express =
    require("express");

const router =
    express.Router();

const {
    startCryptoScan,
    getCryptoResults,
    getCryptoStatus
} = require(
    "../controllers/cryptoController"
);


// Start scanner
router.post(
    "/scan",
    startCryptoScan
);


// Latest setups
router.get(
    "/results",
    getCryptoResults
);


// Scanner status
router.get(
    "/status",
    getCryptoStatus
);


module.exports =
    router;