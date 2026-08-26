require("dotenv").config();

const express =
    require("express");

const scannerRoutes =
    require("./routes/scannerRoutes");

const cryptoRoutes =
    require("./routes/cryptoRoutes");

const testRoutes =
    require("./routes/testRoutes");

const liveRoutes =
    require("./routes/liveRoutes");


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


// NSE manual scanner
app.use(
    "/api/scanner",
    scannerRoutes
);


// Crypto manual scanner
app.use(
    "/api/crypto",
    cryptoRoutes
);


// Single-symbol testing
app.use(
    "/api/test",
    testRoutes
);


// Live / cron routes
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

            automation:
                "EXTERNAL_CRON",

            endpoints: {

                live: {

                    status:
                        "GET /api/live/status",

                    results:
                        "GET /api/live/results",

                    trigger:
                        "POST /api/live/trigger"

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
//
// IMPORTANT:
//
// No internal setInterval scheduler here.
//
// cron-job.org will call:
//
// POST /api/live/trigger
//
// every 5 minutes.
// ======================================================

app.listen(
    PORT,
    () => {

        console.log(
            `Server running on http://localhost:${PORT}`
        );

        console.log(
            "Automation mode: external cron trigger"
        );

    }
);