const {
    sendDiscordStrictSetupAlert
} = require("./strictDiscordAlertService");

const {
    isStrictRedisEnabled,
    claimStrictAlert,
    markStrictAlertSent,
    releaseStrictAlert,
    createAlertKey
} = require("./strictRedisService");


// ======================================================
// LOCAL FALLBACK DEDUP
// ======================================================

const localSentSignals =
    new Set();


function isStrictSetup(
    setup
) {

    return Boolean(
        setup &&
        (
            setup.strategy ===
                "STRICT_FLASH_TURN" ||
            setup.status ===
                "STRICT_LIVE"
        )
    );
}


async function claimAlert(
    setup
) {

    if (
        isStrictRedisEnabled()
    ) {
        return claimStrictAlert(
            setup
        );
    }


    const key =
        createAlertKey(
            setup
        );


    if (
        localSentSignals.has(
            key
        )
    ) {
        return false;
    }


    localSentSignals.add(
        key
    );


    return true;
}


async function releaseAlert(
    setup
) {

    if (
        isStrictRedisEnabled()
    ) {

        await releaseStrictAlert(
            setup
        );

        return;
    }


    localSentSignals.delete(
        createAlertKey(
            setup
        )
    );
}


async function persistSentAlert(
    setup
) {

    if (
        !isStrictRedisEnabled()
    ) {
        return true;
    }


    return markStrictAlertSent(
        setup
    );
}


// ======================================================
// PROCESS ONE STRICT SETUP
// ======================================================

async function processStrictSetupAlert(
    setup
) {

    if (
        !isStrictSetup(
            setup
        )
    ) {

        return {
            sent: false,
            duplicate: false,
            failed: false,
            reason:
                "NOT_STRICT_SETUP"
        };
    }


    let claimed =
        false;


    try {

        claimed =
            await claimAlert(
                setup
            );


        if (
            !claimed
        ) {

            return {
                sent: false,
                duplicate: true,
                failed: false,
                reason:
                    "DUPLICATE"
            };
        }


        await sendDiscordStrictSetupAlert(
            setup
        );


        try {

            await persistSentAlert(
                setup
            );

        } catch (error) {

            // Discord already succeeded.
            // Keep the temporary Redis claim instead of
            // releasing it and causing an immediate duplicate.

            console.error(
                "Strict alert sent but Redis persistence failed:",
                error.message
            );
        }


        return {
            sent: true,
            duplicate: false,
            failed: false,
            reason:
                "SENT"
        };


    } catch (error) {

        if (
            claimed
        ) {

            try {

                await releaseAlert(
                    setup
                );

            } catch (releaseError) {

                console.error(
                    "Could not release strict alert claim:",
                    releaseError.message
                );
            }
        }


        console.error(
            "Strict setup alert failed:",
            error.message
        );


        return {
            sent: false,
            duplicate: false,
            failed: true,
            reason:
                "SEND_FAILED",
            error:
                error.message
        };
    }
}


// ======================================================
// PROCESS STRICT SETUP LIST
// ======================================================

async function processStrictSetupAlerts(
    setups
) {

    const list =
        Array.isArray(
            setups
        )
            ? setups
            : [];


    let sent = 0;
    let duplicates = 0;
    let failed = 0;

    const results = [];


    for (
        const setup
        of list
    ) {

        const result =
            await processStrictSetupAlert(
                setup
            );


        results.push(
            result
        );


        if (
            result.sent
        ) {
            sent++;
        }


        if (
            result.duplicate
        ) {
            duplicates++;
        }


        if (
            result.failed
        ) {
            failed++;
        }
    }


    return {
        sent,
        duplicates,
        failed,
        processed:
            list.length,
        redisEnabled:
            isStrictRedisEnabled(),
        results
    };
}


module.exports = {
    processStrictSetupAlert,
    processStrictSetupAlerts
};
