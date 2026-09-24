require("dotenv").config();


const DISCORD_WEBHOOK_URL =
    process.env.DISCORD_WEBHOOK_URL;


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


function formatPrice(
    value
) {

    const number =
        Number(
            value
        );


    if (
        !Number.isFinite(
            number
        )
    ) {
        return "N/A";
    }


    const absolute =
        Math.abs(
            number
        );


    let decimals;


    if (
        absolute >= 1000
    ) {
        decimals = 2;
    } else if (
        absolute >= 1
    ) {
        decimals = 4;
    } else if (
        absolute >= 0.01
    ) {
        decimals = 6;
    } else {
        decimals = 8;
    }


    return number
        .toFixed(
            decimals
        )
        .replace(
            /0+$/,
            ""
        )
        .replace(
            /\.$/,
            ""
        );
}


function buildStrictDiscordPayload(
    setup
) {

    const symbol =
        String(
            setup.tradingPair ||
            setup.symbol ||
            "UNKNOWN"
        ).toUpperCase();


    const timeframe =
        String(
            setup.timeframe ||
            "N/A"
        ).toUpperCase();


    const setupType =
        String(
            setup.setupType ||
            setup.baseType ||
            "HAMMER"
        ).toUpperCase();


    const setupColor =
        String(
            setup.setupColor ||
            "N/A"
        ).toUpperCase();


    const flashDrop =
        Number(
            setup.flashDropPct
        );


    return {

        username:
            "Channel Scanner",

        content: [

            "🔥 STRICT FLASH TURN",

            `${symbol} ${timeframe}`,

            `Structure: Ascending Channel → Flash Sell → ${setupType}`,

            `Flash Sell: ${Number.isFinite(flashDrop) ? `-${Math.abs(flashDrop).toFixed(2)}%` : "N/A"} | ${formatDateIST(setup.flashSellAt || setup.flashSellDate)} IST`,

            `Reversal: ${setupType} (${setupColor}) | ${formatDateIST(setup.reversalTime || setup.reversalDate)} IST`,

            `Entry: ${formatPrice(setup.entry)} | ${formatDateIST(setup.entryTime)} IST`,

            `SL: ${formatPrice(setup.stopLoss ?? setup.stop)}`,

            `1R: ${formatPrice(setup.target1R)}`,

            `1.5R: ${formatPrice(setup.target1_5R)}`,

            `2R: ${formatPrice(setup.target2R)}`

        ].join(
            "\n"
        ),

        allowed_mentions: {
            parse: []
        }

    };
}


async function sendDiscordStrictSetupAlert(
    setup
) {

    validateDiscordConfig();


    const symbol =
        String(
            setup.tradingPair ||
            setup.symbol ||
            "UNKNOWN"
        ).toUpperCase();


    console.log(
        `Sending strict Discord alert for ${symbol}...`
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
                        buildStrictDiscordPayload(
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
        `Strict Discord alert sent for ${symbol}.`
    );


    return {
        success: true,
        status:
            response.status
    };
}


module.exports = {
    sendDiscordStrictSetupAlert,
    buildStrictDiscordPayload,
    formatDateIST,
    formatPrice
};
