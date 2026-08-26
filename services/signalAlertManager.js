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


// Keep signal history bounded.
// This is far more than we need for normal operation.

const MAX_STORED_SIGNALS =
    5000;


// ======================================================
// MEMORY
// ======================================================

const sentSignals =
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
// CREATE UNIQUE SIGNAL KEY
//
// Same:
// market + symbol + timeframe + flash sell
//
// = SAME signal.
//
// Therefore the scanner can run every 5 minutes without
// repeatedly emailing the same PRE_PHASE.
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
        "NO_FLASH_DATE";


    if (
        flashSellDate !==
        "NO_FLASH_DATE"
    ) {

        const date =
            new Date(
                flashSellDate
            );


        if (
            !Number.isNaN(
                date.getTime()
            )
        ) {

            flashSellDate =
                date.toISOString();
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


        // Only store it after successful email delivery.

        markSignalSent(
            setup
        );


        console.log(
            `Signal marked as sent: ${key}`
        );


        return {

            sent: true,

            duplicate: false,

            key

        };


    } catch (error) {

        // DO NOT mark failed email as sent.
        // Next scanner cycle can retry it.

        console.error(
            `Email alert failed for ${key}:`,
            error.message
        );


        return {

            sent: false,

            duplicate: false,

            key,

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

        historyFile:
            SENT_SIGNALS_FILE

    };
}


// ======================================================
// LOAD HISTORY ON STARTUP
// ======================================================

loadSentSignals();


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

    createSignalKey,

    wasSignalSent,

    processSetupAlert,

    processSetupAlerts,

    getAlertStats

};