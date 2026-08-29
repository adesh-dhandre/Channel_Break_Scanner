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
// FORMAT DATE IN IST
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
// DISPLAY VALUE
// ======================================================

function displayValue(
    value,
    fallback = "N/A"
) {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {

        return fallback;
    }


    return String(
        value
    );
}


// ======================================================
// SYMBOL
// ======================================================

function getSymbol(
    setup
) {

    return (
        setup.tradingPair ||
        setup.symbol ||
        "UNKNOWN"
    );
}


// ======================================================
// MARKET
// ======================================================

function getMarketName(
    setup
) {

    const market =
        String(
            setup.market ||
            ""
        ).toUpperCase();


    if (
        market ===
        "BINANCE_USDT_PERPETUAL"
    ) {

        return "Binance Futures";
    }


    if (
        market ===
        "NSE"
    ) {

        return "NSE F&O";
    }


    return (
        setup.market ||
        "Unknown Market"
    );
}


// ======================================================
// LIFECYCLE COLOR
// ======================================================

function getEmbedColor(
    setup
) {

    const lifecycle =
        String(
            setup.lifecycle ||
            "LIVE"
        ).toUpperCase();


    if (
        lifecycle ===
        "AGING"
    ) {

        return 0xF0B429;
    }


    if (
        lifecycle ===
        "EXPIRED"
    ) {

        return 0xD64545;
    }


    return 0x2ECC71;
}


// ======================================================
// BUILD DISCORD EMBED
// ======================================================

function buildDiscordEmbed(
    setup
) {

    const symbol =
        getSymbol(
            setup
        );


    const flashTime =
        formatDateIST(
            setup.flashSellAt ||
            setup.flashSellDate
        );


    const flashConfirmed =
        formatDateIST(
            setup.flashSellConfirmedAt
        );


    const baseStarted =
        formatDateIST(
            setup.baseStartedAt
        );


    const baseConfirmed =
        formatDateIST(
            setup.baseConfirmedAt
        );


    const prePhaseConfirmed =
        formatDateIST(
            setup.prePhaseConfirmedAt ||
            setup.detectedAt
        );


    const drop =
        setup.flashSellDropPercent != null
            ? `${Number(
                setup.flashSellDropPercent
            ).toFixed(2)}%`
            : "N/A";


    const respect =
        setup.channelRespectRatio != null
            ? `${Math.round(
                Number(
                    setup.channelRespectRatio
                ) *
                100
            )}%`
            : "N/A";


    return {

        title:
            `${symbol} • ${displayValue(
                setup.timeframe
            ).toUpperCase()}`,

        description:
            "Channel Break setup detected",

        color:
            getEmbedColor(
                setup
            ),

        fields: [

            {
                name:
                    "Market",

                value:
                    getMarketName(
                        setup
                    ),

                inline:
                    true
            },

            {
                name:
                    "Status",

                value:
                    displayValue(
                        setup.status,
                        "PRE_PHASE"
                    ),

                inline:
                    true
            },

            {
                name:
                    "Lifecycle",

                value:
                    displayValue(
                        setup.lifecycleLabel ||
                        setup.lifecycle,
                        "Live"
                    ),

                inline:
                    true
            },

            {
                name:
                    "Flash Sell",

                value:
                    drop,

                inline:
                    true
            },

            {
                name:
                    "Base Type",

                value:
                    displayValue(
                        setup.baseType
                    ),

                inline:
                    true
            },

            {
                name:
                    "Channel Respect",

                value:
                    respect,

                inline:
                    true
            },

            {
                name:
                    "Flash Candle",

                value:
                    flashTime,

                inline:
                    false
            },

            {
                name:
                    "Flash Confirmed",

                value:
                    flashConfirmed,

                inline:
                    false
            },

            {
                name:
                    "Base Started",

                value:
                    baseStarted,

                inline:
                    false
            },

            {
                name:
                    "Base Confirmed",

                value:
                    baseConfirmed,

                inline:
                    false
            },

            {
                name:
                    "Pre-Phase Confirmed",

                value:
                    prePhaseConfirmed,

                inline:
                    false
            },

            {
                name:
                    "Setup Age",

                value:
                    setup.candlesSinceFlashSell != null &&
                    setup.maxCandlesSinceFlashSell != null
                        ? `${setup.candlesSinceFlashSell} / ${setup.maxCandlesSinceFlashSell} candles`
                        : "N/A",

                inline:
                    false
            }

        ],

        footer: {

            text:
                "Channel Scanner • Times shown in IST"

        },

        timestamp:
            new Date()
                .toISOString()

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
                    JSON.stringify({

                        username:
                            "Channel Scanner",

                        content:
                            null,

                        embeds: [

                            buildDiscordEmbed(
                                setup
                            )

                        ]

                    })
            }
        );


    if (
        !response.ok
    ) {

        const errorText =
            await response
                .text();


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

    const now =
        new Date();

    const thirtyMinutesAgo =
        new Date(
            now.getTime() -
            30 *
            60 *
            1000
        );

    const oneHourAgo =
        new Date(
            now.getTime() -
            60 *
            60 *
            1000
        );


    const setup = {

        market:
            "BINANCE_USDT_PERPETUAL",

        tradingPair:
            "TESTUSDT",

        timeframe:
            "30m",

        status:
            "PRE_PHASE",

        lifecycle:
            "LIVE",

        lifecycleLabel:
            "Live",

        flashSellAt:
            oneHourAgo,

        flashSellConfirmedAt:
            thirtyMinutesAgo,

        flashSellDropPercent:
            1.42,

        baseType:
            "HAMMER",

        baseStartedAt:
            thirtyMinutesAgo,

        baseConfirmedAt:
            now,

        prePhaseConfirmedAt:
            now,

        channelRespectRatio:
            0.94,

        candlesSinceFlashSell:
            2,

        maxCandlesSinceFlashSell:
            8

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