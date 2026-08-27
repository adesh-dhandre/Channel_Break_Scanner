const fs = require("fs");
const path = require("path");

const {
    sendSetupAlert
} = require("./emailAlertService");


// ======================================================
// CONFIG
// ======================================================

const DATA_DIR =
    path.join(
        __dirname,
        "../data"
    );

const SENT_SIGNALS_FILE =
    path.join(
        DATA_DIR,
        "sent-signals.json"
    );

const DETECTED_SIGNALS_FILE =
    path.join(
        DATA_DIR,
        "detected-signals.json"
    );


// Keep histories bounded.
// This is far more than we need for normal operation.

const MAX_STORED_SIGNALS =
    5000;


// ======================================================
// MEMORY
// ======================================================

// IMPORTANT:
//
// sentSignals:
// Tracks signals whose email was successfully delivered.
//
// detectedSignals:
// Tracks when our scanner first discovered a PRE_PHASE
// and when it most recently saw that same setup.
//
// These concepts must remain separate.

const sentSignals =
    new Map();

const detectedSignals =
    new Map();


// ======================================================
// ENSURE DATA DIRECTORY
// ======================================================

function ensureDataDirectory() {

    if (
        !fs.existsSync(
            DATA_DIR
        )
    ) {

        fs.mkdirSync(
            DATA_DIR,
            {
                recursive: true
            }
        );
    }
}


// ======================================================
// NORMALIZE DATE
// ======================================================

function normalizeDate(
    value
) {

    if (
        !value
    ) {

        return null;
    }


    const date =
        new Date(
            value
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return value;
    }


    return date.toISOString();
}


// ======================================================
// CREATE UNIQUE SIGNAL KEY
//
// Same:
// market + symbol + timeframe + flash sell
//
// = SAME signal.
//
// IMPORTANT:
//
// Keep this identity consistent for BOTH:
//
// 1. detection tracking
// 2. email duplicate protection
//
// We prefer flashSellDate because that is the existing
// signal identity field.
//
// flashSellAt is only a safe fallback for newer setup
// metadata.
// ======================================================

function createSignalKey(
    setup
) {

    const market =
        String(
            setup.market ||
            "UNKNOWN"
        ).toUpperCase();


    const symbol =
        String(
            setup.tradingPair ||
            setup.symbol ||
            "UNKNOWN"
        ).toUpperCase();


    const timeframe =
        String(
            setup.timeframe ||
            "UNKNOWN"
        ).toLowerCase();


    let flashSellDate =
        setup.flashSellDate ||
        setup.flashSellAt ||
        "NO_FLASH_DATE";


    if (
        flashSellDate !==
        "NO_FLASH_DATE"
    ) {

        const normalized =
            normalizeDate(
                flashSellDate
            );


        if (
            normalized
        ) {

            flashSellDate =
                normalized;
        }
    }


    return [
        market,
        symbol,
        timeframe,
        flashSellDate
    ].join("|");
}


// ======================================================
// LOAD SENT SIGNALS FROM DISK
// ======================================================

function loadSentSignals() {

    ensureDataDirectory();


    if (
        !fs.existsSync(
            SENT_SIGNALS_FILE
        )
    ) {

        console.log(
            "No previous sent-signal history found."
        );

        return;
    }


    try {

        const raw =
            fs.readFileSync(
                SENT_SIGNALS_FILE,
                "utf8"
            );


        const parsed =
            JSON.parse(
                raw
            );


        if (
            !Array.isArray(
                parsed
            )
        ) {

            console.warn(
                "sent-signals.json is invalid. Starting empty."
            );

            return;
        }


        for (
            const item
            of parsed
        ) {

            if (
                !item ||
                !item.key
            ) {

                continue;
            }


            sentSignals.set(
                item.key,
                item
            );
        }


        console.log(
            `Loaded ${sentSignals.size} previously sent signal(s).`
        );


    } catch (error) {

        console.error(
            "Could not load sent signal history:",
            error.message
        );
    }
}


// ======================================================
// LOAD DETECTED SIGNALS FROM DISK
// ======================================================

function loadDetectedSignals() {

    ensureDataDirectory();


    if (
        !fs.existsSync(
            DETECTED_SIGNALS_FILE
        )
    ) {

        console.log(
            "No previous detected-signal history found."
        );

        return;
    }


    try {

        const raw =
            fs.readFileSync(
                DETECTED_SIGNALS_FILE,
                "utf8"
            );


        const parsed =
            JSON.parse(
                raw
            );


        if (
            !Array.isArray(
                parsed
            )
        ) {

            console.warn(
                "detected-signals.json is invalid. Starting empty."
            );

            return;
        }


        for (
            const item
            of parsed
        ) {

            if (
                !item ||
                !item.key
            ) {

                continue;
            }


            detectedSignals.set(
                item.key,
                item
            );
        }


        console.log(
            `Loaded ${detectedSignals.size} previously detected signal(s).`
        );


    } catch (error) {

        console.error(
            "Could not load detected signal history:",
            error.message
        );
    }
}


// ======================================================
// SAVE SENT SIGNALS
// ======================================================

function saveSentSignals() {

    ensureDataDirectory();


    try {

        let records =
            Array.from(
                sentSignals.values()
            );


        // Newest records first.

        records.sort(
            (a, b) =>
                new Date(
                    b.sentAt
                ).getTime() -
                new Date(
                    a.sentAt
                ).getTime()
        );


        records =
            records.slice(
                0,
                MAX_STORED_SIGNALS
            );


        // Rebuild memory if old entries were trimmed.

        if (
            records.length <
            sentSignals.size
        ) {

            sentSignals.clear();


            for (
                const record
                of records
            ) {

                sentSignals.set(
                    record.key,
                    record
                );
            }
        }


        fs.writeFileSync(
            SENT_SIGNALS_FILE,
            JSON.stringify(
                records,
                null,
                2
            ),
            "utf8"
        );


    } catch (error) {

        console.error(
            "Could not save sent signal history:",
            error.message
        );
    }
}


// ======================================================
// SAVE DETECTED SIGNALS
// ======================================================

function saveDetectedSignals() {

    ensureDataDirectory();


    try {

        let records =
            Array.from(
                detectedSignals.values()
            );


        // Most recently seen records first.

        records.sort(
            (a, b) =>
                new Date(
                    b.lastSeenAt ||
                    b.detectedAt ||
                    0
                ).getTime() -
                new Date(
                    a.lastSeenAt ||
                    a.detectedAt ||
                    0
                ).getTime()
        );


        records =
            records.slice(
                0,
                MAX_STORED_SIGNALS
            );


        // Rebuild memory if old entries were trimmed.

        if (
            records.length <
            detectedSignals.size
        ) {

            detectedSignals.clear();


            for (
                const record
                of records
            ) {

                detectedSignals.set(
                    record.key,
                    record
                );
            }
        }


        fs.writeFileSync(
            DETECTED_SIGNALS_FILE,
            JSON.stringify(
                records,
                null,
                2
            ),
            "utf8"
        );


    } catch (error) {

        console.error(
            "Could not save detected signal history:",
            error.message
        );
    }
}


// ======================================================
// TRACK SETUP DETECTION
//
// detectedAt:
// First exact system time our scanner discovered this
// unique PRE_PHASE.
//
// NEVER changes for the same signal key.
//
// lastSeenAt:
// Updated every scanner cycle where the same PRE_PHASE
// remains visible.
//
// IMPORTANT:
//
// This does NOT mean an email was successfully sent.
// Detection history is completely separate from
// sentSignals.
// ======================================================

function trackSetupDetection(
    setup
) {

    if (
        !setup ||
        setup.status !==
            "PRE_PHASE"
    ) {

        return null;
    }


    const key =
        createSignalKey(
            setup
        );


    const now =
        new Date()
            .toISOString();


    const existing =
        detectedSignals.get(
            key
        );


    let record;


    if (
        existing
    ) {

        record = {

            ...existing,

            market:
                setup.market ||
                existing.market ||
                null,

            symbol:
                setup.tradingPair ||
                setup.symbol ||
                existing.symbol ||
                null,

            tradingPair:
                setup.tradingPair ||
                existing.tradingPair ||
                null,

            timeframe:
                setup.timeframe ||
                existing.timeframe ||
                null,

            flashSellDate:
                normalizeDate(
                    setup.flashSellDate
                ) ||
                existing.flashSellDate ||
                null,

            flashSellAt:
                normalizeDate(
                    setup.flashSellAt ||
                    setup.flashSellDate
                ) ||
                existing.flashSellAt ||
                null,

            baseType:
                setup.baseType ||
                existing.baseType ||
                null,

            baseStartedAt:
                normalizeDate(
                    setup.baseStartedAt
                ) ||
                existing.baseStartedAt ||
                null,

            baseConfirmedAt:
                normalizeDate(
                    setup.baseConfirmedAt
                ) ||
                existing.baseConfirmedAt ||
                null,

            detectedAt:
                existing.detectedAt,

            lastSeenAt:
                now

        };

    } else {

        record = {

            key,

            market:
                setup.market ||
                null,

            symbol:
                setup.tradingPair ||
                setup.symbol ||
                null,

            tradingPair:
                setup.tradingPair ||
                null,

            timeframe:
                setup.timeframe ||
                null,

            flashSellDate:
                normalizeDate(
                    setup.flashSellDate
                ),

            flashSellAt:
                normalizeDate(
                    setup.flashSellAt ||
                    setup.flashSellDate
                ),

            baseType:
                setup.baseType ||
                null,

            baseStartedAt:
                normalizeDate(
                    setup.baseStartedAt
                ),

            baseConfirmedAt:
                normalizeDate(
                    setup.baseConfirmedAt
                ),

            detectedAt:
                now,

            lastSeenAt:
                now

        };
    }


    detectedSignals.set(
        key,
        record
    );


    saveDetectedSignals();


    // Attach persistence metadata directly to the current
    // setup object.
    //
    // scanRunner receives this SAME object reference, so
    // its activeSetups will automatically contain these
    // fields without changing scanRunner yet.

    setup.detectedAt =
        record.detectedAt;

    setup.lastSeenAt =
        record.lastSeenAt;


    return record;
}


// ======================================================
// GET TRACKED SETUP
// ======================================================

function getTrackedSetup(
    setup
) {

    if (
        !setup
    ) {

        return null;
    }


    const key =
        createSignalKey(
            setup
        );


    return (
        detectedSignals.get(
            key
        ) ||
        null
    );
}


// ======================================================
// CHECK WHETHER SIGNAL WAS ALREADY SENT
// ======================================================

function wasSignalSent(
    setup
) {

    const key =
        createSignalKey(
            setup
        );


    return sentSignals.has(
        key
    );
}


// ======================================================
// MARK SIGNAL AS SENT
//
// IMPORTANT:
// We mark only AFTER Mailjet successfully sends.
// ======================================================

function markSignalSent(
    setup
) {

    const key =
        createSignalKey(
            setup
        );


    sentSignals.set(
        key,
        {

            key,

            market:
                setup.market ||
                null,

            symbol:
                setup.tradingPair ||
                setup.symbol ||
                null,

            timeframe:
                setup.timeframe ||
                null,

            flashSellDate:
                setup.flashSellDate ||
                setup.flashSellAt ||
                null,

            sentAt:
                new Date()
                    .toISOString()

        }
    );


    saveSentSignals();
}


// ======================================================
// PROCESS ONE SETUP
// ======================================================

async function processSetupAlert(
    setup
) {

    if (
        !setup ||
        setup.status !==
            "PRE_PHASE"
    ) {

        return {

            sent: false,

            reason:
                "NOT_PRE_PHASE"

        };
    }


    // ==============================================
    // TRACK DETECTION FIRST
    //
    // This happens independently of email delivery.
    //
    // If Mailjet later fails, detectedAt is still valid
    // because the scanner genuinely discovered the setup.
    // ==============================================

    const detection =
        trackSetupDetection(
            setup
        );


    const key =
        createSignalKey(
            setup
        );


    if (
        sentSignals.has(
            key
        )
    ) {

        console.log(
            `Alert already sent: ${key}`
        );


        return {

            sent: false,

            duplicate: true,

            key,

            detectedAt:
                detection?.detectedAt ||
                null,

            lastSeenAt:
                detection?.lastSeenAt ||
                null,

            reason:
                "ALREADY_SENT"

        };
    }


    console.log(
        `New PRE_PHASE alert: ${key}`
    );


    try {

        await sendSetupAlert(
            setup
        );


        // Only store email state after successful delivery.

        markSignalSent(
            setup
        );


        console.log(
            `Signal marked as sent: ${key}`
        );


        return {

            sent: true,

            duplicate: false,

            key,

            detectedAt:
                detection?.detectedAt ||
                null,

            lastSeenAt:
                detection?.lastSeenAt ||
                null

        };


    } catch (error) {

        // DO NOT mark failed email as sent.
        //
        // Detection history remains saved.
        //
        // Next scanner cycle can retry the email while
        // preserving the original detectedAt.

        console.error(
            `Email alert failed for ${key}:`,
            error.message
        );


        return {

            sent: false,

            duplicate: false,

            key,

            detectedAt:
                detection?.detectedAt ||
                null,

            lastSeenAt:
                detection?.lastSeenAt ||
                null,

            reason:
                "EMAIL_FAILED",

            error:
                error.message

        };
    }
}


// ======================================================
// PROCESS MULTIPLE SETUPS
// ======================================================

async function processSetupAlerts(
    setups
) {

    if (
        !Array.isArray(
            setups
        ) ||
        setups.length === 0
    ) {

        return {

            total:
                0,

            sent:
                0,

            duplicates:
                0,

            failed:
                0,

            results:
                []

        };
    }


    const results = [];


    let sent =
        0;

    let duplicates =
        0;

    let failed =
        0;


    // Sequential intentionally.
    //
    // We only expect a small number of PRE_PHASE signals
    // and this avoids unnecessary email API bursts.

    for (
        const setup
        of setups
    ) {

        const result =
            await processSetupAlert(
                setup
            );


        results.push(
            result
        );


        if (
            result.sent
        ) {

            sent++;

        } else if (
            result.duplicate
        ) {

            duplicates++;

        } else if (
            result.reason ===
            "EMAIL_FAILED"
        ) {

            failed++;
        }
    }


    return {

        total:
            setups.length,

        sent,

        duplicates,

        failed,

        results

    };
}


// ======================================================
// STATS
// ======================================================

function getAlertStats() {

    return {

        sentSignalCount:
            sentSignals.size,

        detectedSignalCount:
            detectedSignals.size,

        historyFile:
            SENT_SIGNALS_FILE,

        detectionHistoryFile:
            DETECTED_SIGNALS_FILE

    };
}


// ======================================================
// LOAD HISTORY ON STARTUP
// ======================================================

loadSentSignals();

loadDetectedSignals();


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

    createSignalKey,

    wasSignalSent,

    trackSetupDetection,

    getTrackedSetup,

    processSetupAlert,

    processSetupAlerts,

    getAlertStats

};