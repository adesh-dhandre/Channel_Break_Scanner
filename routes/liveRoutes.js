const express = require("express");

const {
    getRunnerState,
    runCryptoScan
} = require("../services/scanRunner");


const router =
    express.Router();


// ======================================================
// CONFIG
// ======================================================
//
// External cron:
//
// POST /api/live/trigger
//
// Runs every 5 minutes.
//
// CRYPTO:
// ENABLED
//
// NSE:
// TEMPORARILY DISABLED
//
// NSE scanner code remains in the project.
// We are only preventing the live cron trigger from
// starting NSE scans.
//
// ======================================================

const CRYPTO_SCAN_INTERVAL_MINUTES =
    5;

const NSE_ENABLED =
    false;


// ======================================================
// CRON SECURITY
//
// cron-job.org must send:
//
// X-CRON-SECRET: <your secret>
//
// Secret lives in:
//
// local .env
// production environment variables
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

            ...state,

            schedule: {

                cryptoEnabled:
                    true,

                cryptoIntervalMinutes:
                    CRYPTO_SCAN_INTERVAL_MINUTES,

                nseEnabled:
                    NSE_ENABLED,

                nseStatus:
                    "TEMPORARILY_DISABLED"

            }

        });
    }
);


// ======================================================
// LIVE SCANNER RESULTS
//
// Existing NSE results are still returned if they exist
// in scanner state.
//
// Disabling NSE scanning does NOT remove old NSE results.
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

                enabled:
                    NSE_ENABLED,

                count:
                    nseSetups.length,

                results:
                    nseSetups

            },

            crypto: {

                enabled:
                    true,

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
// CRYPTO:
//
// Runs on every 5-minute external cron trigger unless
// the previous crypto scan is still running.
//
// NSE:
//
// TEMPORARILY DISABLED.
//
// IMPORTANT:
//
// Response is returned immediately.
// Crypto scanning continues asynchronously.
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


        const cryptoRequested =
            !state.cryptoRunning;


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

                    enabled:
                        true,

                    intervalMinutes:
                        CRYPTO_SCAN_INTERVAL_MINUTES,

                    requested:
                        cryptoRequested,

                    alreadyRunning:
                        state.cryptoRunning

                },

                nse: {

                    enabled:
                        NSE_ENABLED,

                    requested:
                        false,

                    alreadyRunning:
                        state.nseRunning,

                    reason:
                        "TEMPORARILY_DISABLED"

                },

                triggeredAt:
                    new Date()
                        .toISOString()

            });


        // ==============================================
        // CRYPTO BACKGROUND SCAN
        // ==============================================

        if (
            cryptoRequested
        ) {

            console.log(
                "Cron crypto scan starting..."
            );


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

        } else {

            console.log(
                "Cron crypto scan skipped: previous scan still running."
            );
        }


        // ==============================================
        // NSE DISABLED
        // ==============================================

        console.log(
            "Cron NSE scan skipped: temporarily disabled."
        );

    }
);


// ======================================================
// EXPORTS
// ======================================================

module.exports =
    router;