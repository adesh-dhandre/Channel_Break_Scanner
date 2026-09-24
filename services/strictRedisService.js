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
// Returns true only the FIRST time a setup is claimed.
// Atomic SET NX prevents duplicate Discord alerts.
// ======================================================

async function claimStrictAlert(
    setup
) {

    if (
        !redis
    ) {

        // Local environment:
        // Redis disabled.
        //
        // Alert manager can choose its own
        // local fallback behavior.

        return true;
    }


    const key =
        createAlertKey(
            setup
        );


    const result =
        await redis.set(
            key,
            new Date()
                .toISOString(),
            {
                nx: true,

                // Keep dedup history for 30 days.
                ex:
                    30 * 24 * 60 * 60
            }
        );


    return (
        result === "OK"
    );
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

    pingStrictRedis,

    createAlertKey

};
