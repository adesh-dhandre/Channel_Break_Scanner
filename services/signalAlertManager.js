const fs = require("fs");
const path = require("path");

const {
    sendDiscordSetupAlert
} = require("./discordAlertService");


// ======================================================
// CONFIG
// ======================================================
//
// Local development:
//     <project>/data
//
// Production / Hostless:
//     /tmp/channel-break-scanner/data
//
// Hostless mounts /app as read-only, so runtime-generated
// signal history must be stored inside the writable /tmp
// filesystem.
// ======================================================

const DATA_DIR =
    process.env.NODE_ENV === "production"
        ? path.join(
            "/tmp",
            "channel-break-scanner",
            "data"
        )
        : path.join(
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


const MAX_STORED_SIGNALS =
    5000;


// ======================================================
// MEMORY
// ======================================================
//
// sentSignals:
//
// A signal is stored here only after Discord
// successfully receives the notification.
//
// detectedSignals:
//
// Tracks when the scanner first discovered a setup and
// when that setup was most recently seen.
//
// Detection and notification state remain separate.
// ======================================================

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


    return date
        .toISOString();
}


// ======================================================
// CREATE UNIQUE SIGNAL KEY
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

    ].join(
        "|"
    );
}


// ======================================================
// LOAD SENT SIGNALS
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
// LOAD DETECTED SIGNALS
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
// CHECK WHETHER SIGNAL ALREADY NOTIFIED
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
// A signal is stored ONLY after Discord successfully
// accepts the webhook.
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

            notificationChannel:
                "DISCORD",

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

            sent:
                false,

            reason:
                "NOT_PRE_PHASE"

        };
    }


    // Always record scanner discovery first.

    const detection =
        trackSetupDetection(
            setup
        );


    const key =
        createSignalKey(
            setup
        );


    // Duplicate protection.

    if (
        sentSignals.has(
            key
        )
    ) {

        console.log(
            `Discord alert already sent: ${key}`
        );


        return {

            sent:
                false,

            duplicate:
                true,

            key,

            detectedAt:
                detection
                    ?.detectedAt ||
                null,

            lastSeenAt:
                detection
                    ?.lastSeenAt ||
                null,

            reason:
                "ALREADY_SENT"

        };
    }


    console.log(
        `New PRE_PHASE Discord alert: ${key}`
    );


    try {

        await sendDiscordSetupAlert(
            setup
        );


        // Mark only after successful Discord response.

        markSignalSent(
            setup
        );


        console.log(
            `Discord signal marked as sent: ${key}`
        );


        return {

            sent:
                true,

            duplicate:
                false,

            channel:
                "DISCORD",

            key,

            detectedAt:
                detection
                    ?.detectedAt ||
                null,

            lastSeenAt:
                detection
                    ?.lastSeenAt ||
                null

        };


    } catch (error) {

        // Failed webhook is NOT marked as sent.
        //
        // Next scanner cycle can retry.

        console.error(
            `Discord alert failed for ${key}:`,
            error.message
        );


        return {

            sent:
                false,

            duplicate:
                false,

            channel:
                "DISCORD",

            key,

            detectedAt:
                detection
                    ?.detectedAt ||
                null,

            lastSeenAt:
                detection
                    ?.lastSeenAt ||
                null,

            reason:
                "DISCORD_FAILED",

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

            channel:
                "DISCORD",

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
    // Signal volume is low and this prevents unnecessary
    // Discord webhook bursts.

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
            "DISCORD_FAILED"
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

        channel:
            "DISCORD",

        results

    };
}


// ======================================================
// STATS
// ======================================================

function getAlertStats() {

    return {

        notificationChannel:
            "DISCORD",

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