require("dotenv").config();

const Mailjet = require("node-mailjet");


// ======================================================
// CONFIG
// ======================================================

const MAILJET_API_KEY =
    process.env.MAILJET_API_KEY;

const MAILJET_SECRET_KEY =
    process.env.MAILJET_SECRET_KEY;

const ALERT_EMAIL_1 =
    process.env.ALERT_EMAIL_1;

const ALERT_EMAIL_2 =
    process.env.ALERT_EMAIL_2;


// Current verified Mailjet sender.
// Later we can replace this with:
// alerts@ourdomain.com
const FROM_EMAIL =
    "adeshkd8329@gmail.com";

const FROM_NAME =
    "Channel Scanner";


// ======================================================
// MAILJET CLIENT
// ======================================================

const mailjet =
    new Mailjet({
        apiKey:
            MAILJET_API_KEY,

        apiSecret:
            MAILJET_SECRET_KEY
    });


// ======================================================
// VALIDATE CONFIG
// ======================================================

function validateEmailConfig() {

    if (!MAILJET_API_KEY) {

        throw new Error(
            "MAILJET_API_KEY is missing."
        );
    }


    if (!MAILJET_SECRET_KEY) {

        throw new Error(
            "MAILJET_SECRET_KEY is missing."
        );
    }


    if (!ALERT_EMAIL_1) {

        throw new Error(
            "ALERT_EMAIL_1 is missing."
        );
    }
}


// ======================================================
// FORMAT DATE IN IST
// ======================================================

function formatDateIST(dateValue) {

    if (!dateValue) {

        return "N/A";
    }


    const date =
        new Date(
            dateValue
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return String(
            dateValue
        );
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
// SAFE DISPLAY VALUE
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


    return value;
}


// ======================================================
// MARKET LABEL
// ======================================================

function getMarketLabel(setup) {

    if (
        setup.market ===
        "BINANCE_USDT_PERPETUAL"
    ) {

        return "Binance Futures";
    }


    if (
        setup.market ===
        "NSE"
    ) {

        return "NSE";
    }


    return (
        setup.market ||
        "N/A"
    );
}


// ======================================================
// SYMBOL
// ======================================================

function getSymbol(setup) {

    return (
        setup.tradingPair ||
        setup.symbol ||
        "UNKNOWN"
    );
}


// ======================================================
// SUBJECT
// ======================================================

function buildSubject(setup) {

    const symbol =
        getSymbol(setup);

    const timeframe =
        setup.timeframe ||
        "N/A";


    return (
        `Channel Scanner - ${symbol} ${timeframe} setup detected`
    );
}


// ======================================================
// TEXT BODY
// ======================================================

function buildTextBody(setup) {

    const symbol =
        getSymbol(setup);

    const market =
        getMarketLabel(setup);

    const flashSellTime =
        formatDateIST(
            setup.flashSellAt ||
            setup.flashSellDate
        );

    const baseTime =
        formatDateIST(
            setup.baseStartedAt
        );

    const confirmedTime =
        formatDateIST(
            setup.prePhaseConfirmedAt ||
            setup.baseConfirmedAt ||
            setup.detectedAt
        );


    return `
CHANNEL SCANNER

New setup detected

Market: ${market}
Symbol: ${symbol}
Timeframe: ${displayValue(setup.timeframe)}
Status: ${displayValue(setup.status, "PRE_PHASE")}

SETUP DETAILS

Flash Sell: ${displayValue(setup.flashSellDropPercent)}%
Flash Sell Time: ${flashSellTime}
Lower Channel: ${displayValue(setup.lowerChannelValue)}

Base Type: ${displayValue(setup.baseType)}
Base Started: ${baseTime}
Setup Confirmed: ${confirmedTime}

Candles Since Flash Sell: ${displayValue(setup.candlesSinceFlashSell)}
Base Candles: ${displayValue(
        setup.baseCandlesFound ??
        setup.baseCandles
    )}

This is an automated market-scanner notification.

Channel Scanner
`.trim();
}


// ======================================================
// HTML TABLE ROW
// ======================================================

function tableRow(
    label,
    value
) {

    return `
        <tr>
            <td
                style="
                    padding: 10px 0;
                    color: #6b7280;
                    font-size: 14px;
                    width: 48%;
                    border-bottom: 1px solid #f0f0f0;
                "
            >
                ${label}
            </td>

            <td
                style="
                    padding: 10px 0;
                    color: #111827;
                    font-size: 14px;
                    font-weight: 600;
                    text-align: right;
                    border-bottom: 1px solid #f0f0f0;
                "
            >
                ${displayValue(value)}
            </td>
        </tr>
    `;
}


// ======================================================
// HTML BODY
// ======================================================

function buildHtmlBody(setup) {

    const symbol =
        getSymbol(setup);

    const market =
        getMarketLabel(setup);

    const timeframe =
        displayValue(
            setup.timeframe
        );

    const status =
        displayValue(
            setup.status,
            "PRE_PHASE"
        );

    const flashSellTime =
        formatDateIST(
            setup.flashSellAt ||
            setup.flashSellDate
        );

    const baseTime =
        formatDateIST(
            setup.baseStartedAt
        );

    const confirmedTime =
        formatDateIST(
            setup.prePhaseConfirmedAt ||
            setup.baseConfirmedAt ||
            setup.detectedAt
        );

    const baseCandles =
        setup.baseCandlesFound ??
        setup.baseCandles ??
        "N/A";


    return `
<!DOCTYPE html>

<html>

<head>

    <meta
        charset="UTF-8"
    >

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>
        Channel Scanner
    </title>

</head>


<body
    style="
        margin: 0;
        padding: 0;
        background-color: #f5f7fa;
        font-family: Arial, Helvetica, sans-serif;
        color: #111827;
    "
>


<table
    role="presentation"
    width="100%"
    cellspacing="0"
    cellpadding="0"
    border="0"
    style="
        background-color: #f5f7fa;
        padding: 30px 12px;
    "
>

<tr>

<td align="center">


<table
    role="presentation"
    width="100%"
    cellspacing="0"
    cellpadding="0"
    border="0"
    style="
        max-width: 600px;
        background-color: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        overflow: hidden;
    "
>


<tr>

<td
    style="
        padding: 26px 30px;
        border-bottom: 1px solid #e5e7eb;
    "
>

    <div
        style="
            font-size: 20px;
            font-weight: 700;
            color: #111827;
        "
    >
        Channel Scanner
    </div>

    <div
        style="
            margin-top: 5px;
            font-size: 13px;
            color: #6b7280;
        "
    >
        Automated market setup notification
    </div>

</td>

</tr>


<tr>

<td
    style="
        padding: 30px;
    "
>

    <div
        style="
            font-size: 13px;
            color: #6b7280;
            margin-bottom: 7px;
        "
    >
        NEW SETUP DETECTED
    </div>


    <div
        style="
            font-size: 28px;
            line-height: 1.2;
            font-weight: 700;
            color: #111827;
        "
    >
        ${symbol}
    </div>


    <div
        style="
            margin-top: 8px;
            font-size: 15px;
            color: #4b5563;
        "
    >
        ${market} &nbsp;&bull;&nbsp;
        ${timeframe}
    </div>


    <div
        style="
            display: inline-block;
            margin-top: 18px;
            padding: 7px 12px;
            border-radius: 6px;
            background-color: #f3f4f6;
            color: #111827;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.4px;
        "
    >
        ${status}
    </div>


    <div
        style="
            margin-top: 30px;
            font-size: 14px;
            font-weight: 700;
            color: #111827;
        "
    >
        Setup details
    </div>


    <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        border="0"
        style="
            margin-top: 10px;
            border-collapse: collapse;
        "
    >

        ${tableRow(
            "Flash Sell",
            `${
                displayValue(
                    setup.flashSellDropPercent
                )
            }%`
        )}

        ${tableRow(
            "Flash Sell Time",
            flashSellTime
        )}

        ${tableRow(
            "Lower Channel",
            setup.lowerChannelValue
        )}

        ${tableRow(
            "Base Type",
            setup.baseType
        )}

        ${tableRow(
            "Base Started",
            baseTime
        )}

        ${tableRow(
            "Setup Confirmed",
            confirmedTime
        )}

        ${tableRow(
            "Candles Since Flash Sell",
            setup.candlesSinceFlashSell
        )}

        ${tableRow(
            "Base Candles",
            baseCandles
        )}

    </table>


    <div
        style="
            margin-top: 28px;
            padding: 16px;
            background-color: #f9fafb;
            border-radius: 8px;
            font-size: 13px;
            line-height: 1.6;
            color: #6b7280;
        "
    >
        This notification was generated automatically
        when Channel Scanner detected a setup matching
        the configured strategy conditions.
    </div>

</td>

</tr>


<tr>

<td
    style="
        padding: 20px 30px;
        background-color: #fafafa;
        border-top: 1px solid #e5e7eb;
        font-size: 11px;
        line-height: 1.6;
        color: #9ca3af;
    "
>

    Channel Scanner<br>

    Automated market monitoring notification.<br>

    Times displayed in India Standard Time (IST).

</td>

</tr>


</table>


</td>

</tr>

</table>


</body>

</html>
`;
}


// ======================================================
// GET RECIPIENTS
// ======================================================

function getRecipients() {

    return [
        ALERT_EMAIL_1,
        ALERT_EMAIL_2
    ].filter(
        email =>
            typeof email === "string" &&
            email.trim().length > 0
    );
}


// ======================================================
// SEND EMAIL TO ONE RECIPIENT
// ======================================================

async function sendToRecipient(
    email,
    setup
) {

    const subject =
        buildSubject(
            setup
        );


    const response =
        await mailjet
            .post(
                "send",
                {
                    version:
                        "v3.1"
                }
            )
            .request({

                Messages: [

                    {

                        From: {

                            Email:
                                FROM_EMAIL,

                            Name:
                                FROM_NAME

                        },


                        To: [

                            {

                                Email:
                                    email

                            }

                        ],


                        Subject:
                            subject,


                        TextPart:
                            buildTextBody(
                                setup
                            ),


                        HTMLPart:
                            buildHtmlBody(
                                setup
                            )

                    }

                ]

            });


    return response.body;
}


// ======================================================
// SEND SETUP ALERT
// ======================================================

async function sendSetupAlert(
    setup
) {

    validateEmailConfig();


    const recipients =
        getRecipients();


    if (
        recipients.length === 0
    ) {

        throw new Error(
            "No alert recipients configured."
        );
    }


    console.log(
        `Sending Channel Scanner alert to ${recipients.length} recipient(s)...`
    );


    const results = [];


    // Send separately so recipients are not exposed
    // to each other in the To field.
    for (
        const recipient
        of recipients
    ) {

        try {

            const response =
                await sendToRecipient(
                    recipient,
                    setup
                );


            results.push({

                email:
                    recipient,

                success:
                    true,

                response

            });


            console.log(
                `Email sent successfully to ${recipient}.`
            );


        } catch (error) {

            console.error(
                `Email failed for ${recipient}: ${error.message}`
            );


            results.push({

                email:
                    recipient,

                success:
                    false,

                error:
                    error.message

            });
        }
    }


    const successful =
        results.filter(
            result =>
                result.success
        );


    if (
        successful.length === 0
    ) {

        throw new Error(
            "Email delivery failed for all recipients."
        );
    }


    return {

        success:
            true,

        sent:
            successful.length,

        failed:
            results.length -
            successful.length,

        results

    };
}


// ======================================================
// TEST EMAIL
// ======================================================

async function sendTestEmail() {

    const now =
        new Date();

    const thirtyMinutesAgo =
        new Date(
            now.getTime() -
            30 * 60 * 1000
        );

    const sixtyMinutesAgo =
        new Date(
            now.getTime() -
            60 * 60 * 1000
        );


    const testSetup = {

        market:
            "BINANCE_USDT_PERPETUAL",

        tradingPair:
            "TESTUSDT",

        timeframe:
            "30m",

        status:
            "PRE_PHASE",

        flashSellAt:
            sixtyMinutesAgo,

        flashSellDate:
            sixtyMinutesAgo,

        flashSellDropPercent:
            1.25,

        lowerChannelValue:
            100,

        candlesSinceFlashSell:
            1,

        baseType:
            "HAMMER",

        baseStartedAt:
            thirtyMinutesAgo,

        baseConfirmedAt:
            now,

        prePhaseConfirmedAt:
            now,

        detectedAt:
            now,

        baseCandlesFound:
            1

    };


    return await sendSetupAlert(
        testSetup
    );
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

    sendSetupAlert,

    sendTestEmail,

    formatDateIST

};