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

const NSE_SCAN_INTERVAL_MS =
    10 * 60 * 1000;

const MANUAL_CRYPTO_SCAN_COOLDOWN_MS =
    5 * 60 * 1000;


// ======================================================
// NSE ENABLE / DISABLE
//
// NSE scanner code is preserved.
//
// false:
// - cron will NOT run NSE
// - crypto continues normally
//
// Later, when NSE is ready for production,
// change only this value to true.
// ======================================================

const NSE_CRON_ENABLED =
    false;


// ======================================================
// MANUAL SCAN STATE
// ======================================================

let lastManualCryptoTriggerAt =
    0;


// ======================================================
// CRON SECURITY
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
// NSE DECISION
// ======================================================

function getNseScanDecision(
    state
) {

    // ==================================================
    // NSE TEMPORARILY DISABLED
    // ==================================================

    if (
        !NSE_CRON_ENABLED
    ) {

        return {

            enabled: false,

            marketOpen:
                false,

            due:
                false,

            requested:
                false,

            reason:
                "NSE_DISABLED",

            nextEligibleAt:
                null

        };
    }


    const marketOpen =
        isNseMarketSession();


    if (
        !marketOpen
    ) {

        return {

            enabled: true,

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

            enabled: true,

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

            enabled: true,

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

            enabled: true,

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


    const due =
        Date.now() >=
        nextEligibleTime;


    return {

        enabled: true,

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


        const nextManualCryptoScanAt =
            lastManualCryptoTriggerAt
                ? new Date(
                    lastManualCryptoTriggerAt +
                    MANUAL_CRYPTO_SCAN_COOLDOWN_MS
                ).toISOString()
                : null;


        return res.json({

            success: true,

            ...state,

            manualScan: {

                cooldownMinutes:
                    5,

                nextEligibleAt:
                    nextManualCryptoScanAt

            },

            schedule: {

                cryptoIntervalMinutes:
                    5,

                nseEnabled:
                    nseDecision.enabled,

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

                enabled:
                    NSE_CRON_ENABLED,

                count:
                    nseSetups.length,

                results:
                    nseSetups

            },

            crypto: {

                enabled: true,

                count:
                    cryptoSetups.length,

                results:
                    cryptoSetups

            }

        });
    }
);


// ======================================================
// MANUAL CRYPTO SCAN
//
// POST /api/live/manual-trigger
//
// IMPORTANT:
// - CRYPTO ONLY
// - DOES NOT RUN NSE
// - DOES NOT EXPOSE CRON_SECRET
// - BLOCKS DUPLICATE RUNNING SCANS
// - 5 MINUTE COOLDOWN
// ======================================================

router.post(
    "/manual-trigger",
    (req, res) => {

        const state =
            getRunnerState();


        // ----------------------------------------------
        // PREVENT OVERLAPPING CRYPTO SCANS
        // ----------------------------------------------

        if (
            state.cryptoRunning
        ) {

            return res
                .status(202)
                .json({

                    success: true,

                    alreadyRunning:
                        true,

                    message:
                        "Crypto scanner is already running."

                });
        }


        const now =
            Date.now();


        const nextEligibleAt =
            lastManualCryptoTriggerAt +
            MANUAL_CRYPTO_SCAN_COOLDOWN_MS;


        // ----------------------------------------------
        // MANUAL BUTTON COOLDOWN
        // ----------------------------------------------

        if (
            lastManualCryptoTriggerAt &&
            now <
            nextEligibleAt
        ) {

            return res
                .status(429)
                .json({

                    success: false,

                    error:
                        "Manual crypto scan cooldown is active.",

                    nextEligibleAt:
                        new Date(
                            nextEligibleAt
                        ).toISOString()

                });
        }


        lastManualCryptoTriggerAt =
            now;


        // ----------------------------------------------
        // RESPOND IMMEDIATELY
        //
        // Scanner continues in background.
        // ----------------------------------------------

        res
            .status(202)
            .json({

                success: true,

                alreadyRunning:
                    false,

                market:
                    "CRYPTO",

                message:
                    "Manual crypto scan started.",

                triggeredAt:
                    new Date(
                        now
                    ).toISOString()

            });


        // ----------------------------------------------
        // RUN CRYPTO ONLY
        // ----------------------------------------------

        runCryptoScan()
            .then(
                result => {

                    console.log(
                        "Manual crypto scan finished:",
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
                        "Manual crypto scan failed:",
                        error
                    );

                }
            );
    }
);


// ======================================================
// CRON TRIGGER
//
// POST /api/live/trigger
//
// Protected using X-CRON-SECRET.
//
// CRYPTO:
// ENABLED
//
// NSE:
// TEMPORARILY DISABLED
// ======================================================

router.post(
    "/trigger",
    (req, res) => {

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

                    enabled:
                        nseDecision.enabled,

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


        // ----------------------------------------------
        // CRYPTO
        // ----------------------------------------------

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


        // ----------------------------------------------
        // NSE
        //
        // Code is preserved.
        // With NSE_CRON_ENABLED=false,
        // nseDecision.requested is always false.
        // ----------------------------------------------

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