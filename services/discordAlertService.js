require("dotenv").config();


// ======================================================
// CONFIG
// ======================================================

const DISCORD_WEBHOOK_URL =
    process.env.DISCORD_WEBHOOK_URL;


// ======================================================
// VALIDATE CONFIG
// ======================================================

function validateDiscordConfig() {

    if (
        !DISCORD_WEBHOOK_URL
    ) {

        throw new Error(
            "DISCORD_WEBHOOK_URL is missing."
        );
    }


    if (
        !DISCORD_WEBHOOK_URL.startsWith(
            "https://discord.com/api/webhooks/"
        )
    ) {

        throw new Error(
            "DISCORD_WEBHOOK_URL is invalid."
        );
    }
}


// ======================================================
// FORMAT DATE / TIME IN IST
// ======================================================

function formatDateIST(
    value
) {

    if (
        !value
    ) {

        return "N/A";
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

        return "N/A";
    }


    return new Intl.DateTimeFormat(
        "en-IN",
        {
            timeZone:
                "Asia/Kolkata",

            day:
                "2-digit",

            month:
                "short",

            year:
                "numeric",

            hour:
                "2-digit",

            minute:
                "2-digit",

            hour12:
                true
        }
    ).format(
        date
    );
}


// ======================================================
// HELPERS
// ======================================================

function getSymbol(
    setup
) {

    return String(
        setup.tradingPair ||
        setup.symbol ||
        "UNKNOWN"
    ).toUpperCase();
}


function getTimeframe(
    setup
) {

    return String(
        setup.timeframe ||
        "N/A"
    ).toUpperCase();
}


function getBaseType(
    setup
) {

    return String(
        setup.baseType ||
        "N/A"
    ).toUpperCase();
}


function getTimeframeMinutes(
    timeframe
) {

    const value =
        String(
            timeframe ||
            ""
        ).toLowerCase();


    const minuteMatch =
        value.match(
            /^(\d+)m$/
        );


    if (
        minuteMatch
    ) {

        return Number(
            minuteMatch[1]
        );
    }


    const hourMatch =
        value.match(
            /^(\d+)h$/
        );


    if (
        hourMatch
    ) {

        return Number(
            hourMatch[1]
        ) * 60;
    }


    return null;
}


function getBaseCloseTime(
    setup
) {

    if (
        setup.baseConfirmedAt
    ) {

        return setup.baseConfirmedAt;
    }


    if (
        !setup.baseStartedAt
    ) {

        return null;
    }


    const timeframeMinutes =
        getTimeframeMinutes(
            setup.timeframe
        );


    if (
        !Number.isFinite(
            timeframeMinutes
        )
    ) {

        return null;
    }


    const baseOpen =
        new Date(
            setup.baseStartedAt
        );


    if (
        Number.isNaN(
            baseOpen.getTime()
        )
    ) {

        return null;
    }


    return new Date(
        baseOpen.getTime() +
        timeframeMinutes *
        60 *
        1000
    );
}


// ======================================================
// BUILD DISCORD ALERT
// ======================================================

function buildDiscordPayload(
    setup
) {

    const symbol =
        getSymbol(
            setup
        );


    const timeframe =
        getTimeframe(
            setup
        );


    const baseType =
        getBaseType(
            setup
        );


    const flashSellTime =
        formatDateIST(
            setup.flashSellAt ||
            setup.flashSellDate
        );


    const baseOpenTime =
        formatDateIST(
            setup.baseStartedAt
        );


    const baseCloseTime =
        formatDateIST(
            getBaseCloseTime(
                setup
            )
        );


    return {

        username:
            "Channel Scanner",

        content:
            [
                `${symbol} ${timeframe}`,
                `Flash Sell: ${flashSellTime} IST`,
                `Base: ${baseType}`,
                `Base Open: ${baseOpenTime} IST`,
                `Base Close: ${baseCloseTime} IST`
            ].join(
                "\n"
            ),

        allowed_mentions: {
            parse: []
        }

    };
}


// ======================================================
// SEND DISCORD ALERT
// ======================================================

async function sendDiscordSetupAlert(
    setup
) {

    validateDiscordConfig();


    const symbol =
        getSymbol(
            setup
        );


    console.log(
        `Sending Discord alert for ${symbol}...`
    );


    const response =
        await fetch(
            DISCORD_WEBHOOK_URL,
            {
                method:
                    "POST",

                headers: {

                    "Content-Type":
                        "application/json"

                },

                body:
                    JSON.stringify(
                        buildDiscordPayload(
                            setup
                        )
                    )
            }
        );


    if (
        !response.ok
    ) {

        const errorText =
            await response.text();


        throw new Error(
            `Discord webhook failed (${response.status}): ${errorText}`
        );
    }


    console.log(
        `Discord alert sent for ${symbol}.`
    );


    return {

        success:
            true,

        status:
            response.status

    };
}


// ======================================================
// TEST ALERT
// ======================================================

async function sendDiscordTestAlert() {

    const baseOpen =
        new Date();


    const timeframeMinutes =
        15;


    const baseClose =
        new Date(
            baseOpen.getTime() +
            timeframeMinutes *
            60 *
            1000
        );


    const flashSell =
        new Date(
            baseOpen.getTime() -
            timeframeMinutes *
            60 *
            1000
        );


    const setup = {

        market:
            "BINANCE_USDT_PERPETUAL",

        tradingPair:
            "TESTUSDT",

        timeframe:
            "15m",

        status:
            "PRE_PHASE",

        flashSellAt:
            flashSell,

        flashSellDate:
            flashSell,

        baseType:
            "HAMMER",

        baseStartedAt:
            baseOpen,

        baseConfirmedAt:
            baseClose

    };


    return sendDiscordSetupAlert(
        setup
    );
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

    sendDiscordSetupAlert,

    sendDiscordTestAlert,

    formatDateIST

};