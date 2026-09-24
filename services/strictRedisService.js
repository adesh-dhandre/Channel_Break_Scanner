const {
    Redis
} = require("@upstash/redis");


// ======================================================
// CONFIG
// ======================================================

const REDIS_URL =
    process.env.UPSTASH_REDIS_REST_URL;

const REDIS_TOKEN =
    process.env.UPSTASH_REDIS_REST_TOKEN;


// ======================================================
// CLIENT
// ======================================================

let redis = null;


if (
    REDIS_URL &&
    REDIS_TOKEN
) {

    redis =
        new Redis({

            url:
                REDIS_URL,

            token:
                REDIS_TOKEN

        });
}


// ======================================================
// STATUS
// ======================================================

function isStrictRedisEnabled() {

    return Boolean(
        redis
    );
}


// ======================================================
// KEYS
// ======================================================

const KEYS = {

    CURRENT_SETUPS:
        "strict:current-setups",

    SCAN_STATE:
        "strict:scan-state",

    LAST_SCAN:
        "strict:last-scan"

};


function createAlertKey(
    setup
) {

    const symbol =
        String(
            setup.symbol ||
            setup.tradingPair ||
            "UNKNOWN"
        ).toUpperCase();


    const timeframe =
        String(
            setup.timeframe ||
            "UNKNOWN"
        ).toLowerCase();


    const reversalTime =
        new Date(
            setup.reversalTime ||
            setup.reversalDate
        ).toISOString();


    return (
        `strict:alert:${symbol}:${timeframe}:${reversalTime}`
    );
}


// ======================================================
// SAVE CURRENT SETUPS
// ======================================================

async function saveCurrentStrictSetups(
    setups
) {

    if (
        !redis
    ) {
        return false;
    }


    await redis.set(
        KEYS.CURRENT_SETUPS,
        JSON.stringify(
            Array.isArray(setups)
                ? setups
                : []
        )
    );


    return true;
}


// ======================================================
// GET CURRENT SETUPS
// ======================================================

async function getCurrentStrictSetups() {

    if (
        !redis
    ) {
        return [];
    }


    const value =
        await redis.get(
            KEYS.CURRENT_SETUPS
        );


    if (
        !value
    ) {
        return [];
    }


    if (
        Array.isArray(value)
    ) {
        return value;
    }


    if (
        typeof value === "object"
    ) {
        return value;
    }


    try {

        return JSON.parse(
            value
        );

    } catch (_) {

        return [];
    }
}


// ======================================================
// SAVE SCAN STATE
// ======================================================

async function saveStrictScanState(
    state
) {

    if (
        !redis
    ) {
        return false;
    }


    await redis.set(
        KEYS.SCAN_STATE,
        JSON.stringify(
            state || {}
        )
    );


    return true;
}


// ======================================================
// GET SCAN STATE
// ======================================================

async function getStrictScanState() {

    if (
        !redis
    ) {
        return null;
    }


    const value =
        await redis.get(
            KEYS.SCAN_STATE
        );


    if (
        !value
    ) {
        return null;
    }


    if (
        typeof value === "object"
    ) {
        return value;
    }


    try {

        return JSON.parse(
            value
        );

    } catch (_) {

        return null;
    }
}


// ======================================================
// ALERT DEDUPLICATION
//
// Flow:
// 1. claimStrictAlert() creates a short atomic lock.
// 2. Discord success -> markStrictAlertSent().
// 3. Discord failure -> releaseStrictAlert().
//
// This prevents duplicates without permanently losing
// an alert when Discord delivery fails.
// ======================================================

async function claimStrictAlert(
    setup
) {

    if (
        !redis
    ) {
        return true;
    }


    const key =
        createAlertKey(
            setup
        );


    const result =
        await redis.set(
            key,
            `PENDING:${new Date().toISOString()}`,
            {
                nx: true,

                // Crash-safe temporary claim.
                ex:
                    5 * 60
            }
        );


    return (
        result === "OK"
    );
}


// ======================================================
// MARK ALERT SUCCESSFULLY SENT
// ======================================================

async function markStrictAlertSent(
    setup
) {

    if (
        !redis
    ) {
        return true;
    }


    const key =
        createAlertKey(
            setup
        );


    await redis.set(
        key,
        `SENT:${new Date().toISOString()}`,
        {
            // Keep successful dedup history for 30 days.
            ex:
                30 * 24 * 60 * 60
        }
    );


    return true;
}


// ======================================================
// RELEASE FAILED ALERT CLAIM
// ======================================================

async function releaseStrictAlert(
    setup
) {

    if (
        !redis
    ) {
        return true;
    }


    const key =
        createAlertKey(
            setup
        );


    await redis.del(
        key
    );


    return true;
}


// ======================================================
// HEALTH CHECK
// ======================================================

async function pingStrictRedis() {

    if (
        !redis
    ) {

        return {

            enabled:
                false,

            connected:
                false,

            reason:
                "UPSTASH_ENV_NOT_CONFIGURED"

        };
    }


    try {

        const result =
            await redis.ping();


        return {

            enabled:
                true,

            connected:
                result === "PONG",

            result

        };

    } catch (error) {

        return {

            enabled:
                true,

            connected:
                false,

            error:
                error.message

        };
    }
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

    isStrictRedisEnabled,

    saveCurrentStrictSetups,

    getCurrentStrictSetups,

    saveStrictScanState,

    getStrictScanState,

    claimStrictAlert,

    markStrictAlertSent,

    releaseStrictAlert,

    pingStrictRedis,

    createAlertKey

};
