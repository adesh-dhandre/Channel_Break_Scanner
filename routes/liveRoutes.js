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
// CONFIG
// ======================================================
//
// External cron can call:
//
// POST /api/live/trigger
//
// every 5 minutes.
//
// CRYPTO:
// Every trigger.
//
// NSE:
// Maximum once every 10 minutes while market is open.
//
// ======================================================

const NSE_SCAN_INTERVAL_MS =
    10 * 60 * 1000;


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
// CHECK WHETHER NSE SCAN IS DUE
//
// Rules:
//
// 1. Market must be open.
// 2. Previous NSE scan must not still be running.
// 3. If no previous scan exists, run immediately.
// 4. Otherwise at least 10 minutes must have elapsed
//    since the previous NSE scan started.
//
// We use lastNseStartedAt rather than completion time
// because the desired cadence is scan-start to scan-start.
// ======================================================

function getNseScanDecision(
    state
) {

    const marketOpen =
        isNseMarketSession();


    if (
        !marketOpen
    ) {

        return {

            marketOpen: false,

            due: false,

            requested: false,

            reason:
                "MARKET_CLOSED",

            nextEligibleAt:
                null

        };
    }


    if (
        state.nseRunning
    ) {

        return {

            marketOpen: true,

            due: false,

            requested: false,

            reason:
                "NSE_ALREADY_RUNNING",

            nextEligibleAt:
                null

        };
    }


    if (
        !state.lastNseStartedAt
    ) {

        return {

            marketOpen: true,

            due: true,

            requested: true,

            reason:
                "FIRST_SCAN",

            nextEligibleAt:
                null

        };
    }


    const lastStartedAt =
        new Date(
            state.lastNseStartedAt
        );


    if (
        Number.isNaN(
            lastStartedAt.getTime()
        )
    ) {

        return {

            marketOpen: true,

            due: true,

            requested: true,

            reason:
                "INVALID_PREVIOUS_SCAN_TIME",

            nextEligibleAt:
                null

        };
    }


    const nextEligibleTime =
        lastStartedAt.getTime() +
        NSE_SCAN_INTERVAL_MS;


    const now =
        Date.now();


    const due =
        now >=
        nextEligibleTime;


    return {

        marketOpen: true,

        due,

        requested:
            due,

        reason:
            due
                ? "NSE_SCAN_DUE"
                : "NSE_10_MINUTE_INTERVAL",

        nextEligibleAt:
            new Date(
                nextEligibleTime
            ).toISOString()

    };
}


// ======================================================
// LIVE SCANNER STATUS
// ======================================================

router.get(
    "/status",
    (req, res) => {

        const state =
            getRunnerState();


        const nseDecision =
            getNseScanDecision(
                state
            );


        return res.json({

            success: true,

            ...state,

            schedule: {

                cryptoIntervalMinutes:
                    5,

                nseIntervalMinutes:
                    10,

                nseMarketOpen:
                    nseDecision.marketOpen,

                nseDue:
                    nseDecision.due,

                nseNextEligibleAt:
                    nseDecision.nextEligibleAt

            }

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
// Intended external schedule:
//
// EVERY 5 MINUTES
//
// CRYPTO:
//
// Runs every trigger unless the previous crypto scan
// is still running.
//
// NSE:
//
// Runs only:
//
// Monday-Friday
// 09:15-15:30 IST
//
// AND
//
// at least 10 minutes since the previous NSE scan.
//
// IMPORTANT:
//
// Response is returned immediately.
// Actual scanning continues asynchronously.
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


        const nseDecision =
            getNseScanDecision(
                state
            );


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

                    intervalMinutes:
                        5,

                    requested:
                        cryptoRequested,

                    alreadyRunning:
                        state.cryptoRunning

                },

                nse: {

                    intervalMinutes:
                        10,

                    marketOpen:
                        nseDecision.marketOpen,

                    due:
                        nseDecision.due,

                    requested:
                        nseDecision.requested,

                    alreadyRunning:
                        state.nseRunning,

                    reason:
                        nseDecision.reason,

                    nextEligibleAt:
                        nseDecision.nextEligibleAt

                },

                triggeredAt:
                    new Date()
                        .toISOString()

            });


        // ==============================================
        // CRYPTO BACKGROUND SCAN
        //
        // Every 5-minute cron trigger.
        //
        // Do not launch another one if the previous scan
        // is still running.
        // ==============================================

        if (
            cryptoRequested
        ) {

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
        // NSE BACKGROUND SCAN
        //
        // Maximum once every 10 minutes.
        // ==============================================

        if (
            nseDecision.requested
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
                `Cron NSE scan skipped: ${nseDecision.reason}`
            );
        }

    }
);


// ======================================================
// EXPORTS
// ======================================================

module.exports =
    router;