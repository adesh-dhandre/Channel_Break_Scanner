const express = require("express");

const {
    getRunnerState,
    runNseScan,
    runCryptoScan
} = require("../services/scanRunner");

const {
    isNseMarketSession
} = require("../services/scanScheduler");


const router =
    express.Router();


// ======================================================
// CRON SECURITY
//
// cron-job.org must send:
//
// X-CRON-SECRET: <your secret>
//
// The secret will live in:
// - local .env
// - Render environment variables
//
// Never GitHub.
// ======================================================

function validateCronSecret(
    req
) {

    const expectedSecret =
        process.env.CRON_SECRET;


    if (
        !expectedSecret
    ) {

        console.error(
            "CRON_SECRET is not configured."
        );

        return false;
    }


    const suppliedSecret =
        req.get(
            "X-CRON-SECRET"
        );


    return (
        suppliedSecret ===
        expectedSecret
    );
}


// ======================================================
// LIVE SCANNER STATUS
// ======================================================

router.get(
    "/status",
    (req, res) => {

        const state =
            getRunnerState();


        return res.json({

            success: true,

            ...state

        });
    }
);


// ======================================================
// LIVE SCANNER RESULTS
// ======================================================

router.get(
    "/results",
    (req, res) => {

        const state =
            getRunnerState();


        const nseSetups =
            state
                .lastNseResult
                ?.activeSetups ||
            [];


        const cryptoSetups =
            state
                .lastCryptoResult
                ?.activeSetups ||
            [];


        return res.json({

            success: true,

            count:
                nseSetups.length +
                cryptoSetups.length,

            nse: {

                count:
                    nseSetups.length,

                results:
                    nseSetups

            },

            crypto: {

                count:
                    cryptoSetups.length,

                results:
                    cryptoSetups

            }

        });
    }
);


// ======================================================
// CRON TRIGGER
//
// POST /api/live/trigger
//
// Called every 5 minutes by cron-job.org.
//
// CRYPTO:
// Always runs.
//
// NSE:
// Runs only:
// Monday-Friday
// 09:15-15:30 IST.
//
// IMPORTANT:
// Response is sent immediately.
// Scanning continues in background.
//
// This prevents cron-job.org from waiting for the
// complete 200-symbol scan.
// ======================================================

router.post(
    "/trigger",
    (req, res) => {

        // ==============================================
        // SECURITY
        // ==============================================

        if (
            !validateCronSecret(
                req
            )
        ) {

            return res
                .status(401)
                .json({

                    success: false,

                    error:
                        "Unauthorized"

                });
        }


        const state =
            getRunnerState();


        const nseMarketOpen =
            isNseMarketSession();


        // ==============================================
        // RESPOND IMMEDIATELY
        // ==============================================

        res
            .status(202)
            .json({

                success: true,

                message:
                    "Live scan trigger accepted.",

                crypto: {

                    requested:
                        true,

                    alreadyRunning:
                        state.cryptoRunning

                },

                nse: {

                    marketOpen:
                        nseMarketOpen,

                    requested:
                        nseMarketOpen,

                    alreadyRunning:
                        state.nseRunning

                },

                triggeredAt:
                    new Date()
                        .toISOString()

            });


        // ==============================================
        // CRYPTO BACKGROUND SCAN
        // ==============================================

        runCryptoScan()
            .then(
                result => {

                    console.log(
                        "Cron crypto scan finished:",
                        {
                            success:
                                result.success,

                            activeSetups:
                                result
                                    .activeSetups
                                    ?.length ||
                                0
                        }
                    );

                }
            )
            .catch(
                error => {

                    console.error(
                        "Cron crypto scan failed:",
                        error
                    );

                }
            );


        // ==============================================
        // NSE BACKGROUND SCAN
        // ==============================================

        if (
            nseMarketOpen
        ) {

            runNseScan()
                .then(
                    result => {

                        console.log(
                            "Cron NSE scan finished:",
                            {
                                success:
                                    result.success,

                                activeSetups:
                                    result
                                        .activeSetups
                                        ?.length ||
                                    0
                            }
                        );

                    }
                )
                .catch(
                    error => {

                        console.error(
                            "Cron NSE scan failed:",
                            error
                        );

                    }
                );

        } else {

            console.log(
                "Cron NSE scan skipped: market closed."
            );
        }

    }
);


// ======================================================
// EXPORTS
// ======================================================

module.exports =
    router;