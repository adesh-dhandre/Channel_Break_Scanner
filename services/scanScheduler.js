const {
    runNseScan,
    runCryptoScan
} = require("./scanRunner");


// ======================================================
// CONFIG
// ======================================================

const FIVE_MINUTES =
    5 * 60 * 1000;


// Prevent scheduler from being started twice.
let schedulerStarted = false;


// ======================================================
// IST TIME HELPERS
// ======================================================

function getISTParts() {

    const parts =
        new Intl.DateTimeFormat(
            "en-GB",
            {
                timeZone:
                    "Asia/Kolkata",

                weekday:
                    "short",

                hour:
                    "2-digit",

                minute:
                    "2-digit",

                hourCycle:
                    "h23"
            }
        ).formatToParts(
            new Date()
        );


    const values = {};


    for (const part of parts) {

        if (
            part.type !==
            "literal"
        ) {

            values[
                part.type
            ] = part.value;
        }
    }


    return {

        weekday:
            values.weekday,

        hour:
            Number(
                values.hour
            ),

        minute:
            Number(
                values.minute
            )

    };
}


// ======================================================
// NSE MARKET SESSION
//
// Monday-Friday
// 09:15 - 15:30 IST
//
// This checks session time only.
// Exchange holidays can be added later.
// ======================================================

function isNseMarketSession() {

    const {
        weekday,
        hour,
        minute
    } = getISTParts();


    const tradingDays = [
        "Mon",
        "Tue",
        "Wed",
        "Thu",
        "Fri"
    ];


    if (
        !tradingDays.includes(
            weekday
        )
    ) {

        return false;
    }


    const currentMinutes =
        hour * 60 +
        minute;


    const marketOpen =
        9 * 60 + 15;


    const marketClose =
        15 * 60 + 30;


    return (
        currentMinutes >=
            marketOpen &&
        currentMinutes <=
            marketClose
    );
}


// ======================================================
// ONE SCHEDULER CYCLE
// ======================================================

async function runSchedulerCycle() {

    const startedAt =
        new Date();


    console.log(
        `\nScheduler cycle: ${startedAt.toISOString()}`
    );


    // ------------------------------------------
    // CRYPTO
    //
    // Crypto runs 24/7.
    // ------------------------------------------

    runCryptoScan()
        .catch(error => {

            console.error(
                "Scheduled crypto scan failed:",
                error.message
            );

        });


    // ------------------------------------------
    // NSE
    //
    // Only scan during Indian trading session.
    // ------------------------------------------

    if (
        isNseMarketSession()
    ) {

        runNseScan()
            .catch(error => {

                console.error(
                    "Scheduled NSE scan failed:",
                    error.message
                );

            });

    } else {

        console.log(
            "NSE scan skipped: market session closed."
        );
    }
}


// ======================================================
// START SCHEDULER
// ======================================================

function startScanScheduler() {

    if (
        schedulerStarted
    ) {

        console.log(
            "Scan scheduler already started."
        );

        return;
    }


    schedulerStarted =
        true;


    console.log(
        "===================================="
    );

    console.log(
        "CHANNEL BREAK LIVE SCHEDULER STARTED"
    );

    console.log(
        "Crypto: every 5 minutes"
    );

    console.log(
        "NSE: every 5 minutes during 09:15-15:30 IST"
    );

    console.log(
        "===================================="
    );


    // Run once immediately when server starts.
    runSchedulerCycle();


    // Then every 5 minutes.
    setInterval(
        runSchedulerCycle,
        FIVE_MINUTES
    );
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

    startScanScheduler,

    runSchedulerCycle,

    isNseMarketSession,

    getISTParts

};