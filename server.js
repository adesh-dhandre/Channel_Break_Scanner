
const express = require("express");

const scannerRoutes =
    require("./routes/scannerRoutes");

const cryptoRoutes =
    require("./routes/cryptoRoutes");

const testRoutes =
    require("./routes/testRoutes");

const liveRoutes =
    require("./routes/liveRoutes");

const {
    startScanScheduler
} = require("./services/scanScheduler");


const app =
    express();


const PORT =
    process.env.PORT ||
    3000;


// ======================================================
// MIDDLEWARE
// ======================================================

app.use(
    express.json()
);


// ======================================================
// ROUTES
// ======================================================


// NSE Scanner
app.use(
    "/api/scanner",
    scannerRoutes
);


// Crypto Scanner
app.use(
    "/api/crypto",
    cryptoRoutes
);


// Single Symbol Testing
app.use(
    "/api/test",
    testRoutes
);


// Automatic live scheduler results
app.use(
    "/api/live",
    liveRoutes
);


// ======================================================
// HOME
// ======================================================

app.get(
    "/",
    (req, res) => {

        return res.json({

            success: true,

            message:
                "Channel Break Scanner API is running.",

            scheduler:
                "ACTIVE",

            endpoints: {

                live: {

                    status:
                        "GET /api/live/status",

                    results:
                        "GET /api/live/results"

                },

                nse: {

                    run:
                        "POST /api/scanner/run",

                    status:
                        "GET /api/scanner/status"

                },

                crypto: {

                    scan:
                        "POST /api/crypto/scan",

                    status:
                        "GET /api/crypto/status",

                    results:
                        "GET /api/crypto/results"

                },

                testing: {

                    setup:
                        "GET /api/test/setup?market=NSE&symbol=MRF.NS&timeframe=1h"

                }

            }

        });
    }
);


// ======================================================
// START SERVER
// ======================================================

app.listen(
    PORT,
    () => {

        console.log(
            `Server running on http://localhost:${PORT}`
        );


        // ==============================================
        // AUTOMATIC LIVE SCANNER
        //
        // Crypto:
        // Every 5 minutes, 24/7
        //
        // NSE:
        // Every 5 minutes during
        // 09:15 - 15:30 IST
        // ==============================================

        startScanScheduler();

    }
);
