const {
    runNseScan,
    runCryptoScan
} = require("./scanRunner");


// ======================================================
// CONFIG
// ======================================================

const FIVE_MINUTES =
    5 * 60 * 1000;

const TEN_MINUTES =
    10 * 60 * 1000;


// Prevent scheduler from being started twice.
let schedulerStarted =
    false;


// Keep interval references.
// Useful later if we ever need controlled shutdown.

let cryptoInterval =
    null;

let nseInterval =
    null;


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


    for (
        const part
        of parts
    ) {

        if (
            part.type !==
            "literal"
        ) {

            values[
                part.type
            ] =
                part.value;
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
    } =
        getISTParts();


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
// CRYPTO SCHEDULER CYCLE
//
// Runs every 5 minutes.
// Crypto trades 24/7.
// ======================================================

async function runCryptoSchedulerCycle() {

    const startedAt =
        new Date();


    console.log(
        `\nCrypto scheduler cycle: ${startedAt.toISOString()}`
    );


    try {

        await runCryptoScan();


    } catch (error) {

        console.error(
            "Scheduled crypto scan failed:",
            error.message
        );
    }
}


// ======================================================
// NSE SCHEDULER CYCLE
//
// Runs every 10 minutes.
//
// Actual NSE scanning happens only during:
// Monday-Friday
// 09:15-15:30 IST.
// ======================================================

async function runNseSchedulerCycle() {

    const startedAt =
        new Date();


    console.log(
        `\nNSE scheduler cycle: ${startedAt.toISOString()}`
    );


    if (
        !isNseMarketSession()
    ) {

        console.log(
            "NSE scan skipped: market session closed."
        );

        return;
    }


    try {

        await runNseScan();


    } catch (error) {

        console.error(
            "Scheduled NSE scan failed:",
            error.message
        );
    }
}


// ======================================================
// LEGACY / MANUAL FULL SCHEDULER CYCLE
//
// Preserved because this function was already exported.
//
// Calling this manually runs:
//
// Crypto
// +
// NSE if market is open.
//
// The recurring scheduler itself does NOT use this
// function anymore because crypto and NSE now have
// different cadences.
// ======================================================

async function runSchedulerCycle() {

    const startedAt =
        new Date();


    console.log(
        `\nManual scheduler cycle: ${startedAt.toISOString()}`
    );


    const jobs = [
        runCryptoSchedulerCycle()
    ];


    if (
        isNseMarketSession()
    ) {

        jobs.push(
            runNseSchedulerCycle()
        );

    } else {

        console.log(
            "NSE scan skipped: market session closed."
        );
    }


    await Promise.all(
        jobs
    );
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
        "NSE: every 10 minutes during 09:15-15:30 IST"
    );

    console.log(
        "===================================="
    );


    // ==================================================
    // INITIAL RUN
    //
    // Crypto:
    // Run immediately.
    //
    // NSE:
    // Run immediately only if market is open.
    // ==================================================

    runCryptoSchedulerCycle();


    if (
        isNseMarketSession()
    ) {

        runNseSchedulerCycle();

    } else {

        console.log(
            "Initial NSE scan skipped: market session closed."
        );
    }


    // ==================================================
    // CRYPTO INTERVAL
    // ==================================================

    cryptoInterval =
        setInterval(
            runCryptoSchedulerCycle,
            FIVE_MINUTES
        );


    // ==================================================
    // NSE INTERVAL
    // ==================================================

    nseInterval =
        setInterval(
            runNseSchedulerCycle,
            TEN_MINUTES
        );
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

    startScanScheduler,

    runSchedulerCycle,

    runCryptoSchedulerCycle,

    runNseSchedulerCycle,

    isNseMarketSession,

    getISTParts

};