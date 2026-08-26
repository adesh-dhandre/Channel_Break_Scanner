require("dotenv").config();

const Mailjet =
    require("node-mailjet");


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


// Verified Mailjet sender
const FROM_EMAIL =
    "adeshkd8329@gmail.com";

const FROM_NAME =
    "Channel Break Scanner";


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

    if (
        !MAILJET_API_KEY
    ) {

        throw new Error(
            "MAILJET_API_KEY is missing."
        );
    }


    if (
        !MAILJET_SECRET_KEY
    ) {

        throw new Error(
            "MAILJET_SECRET_KEY is missing."
        );
    }


    if (
        !ALERT_EMAIL_1 ||
        !ALERT_EMAIL_2
    ) {

        throw new Error(
            "Both alert recipient emails are required."
        );
    }
}


// ======================================================
// FORMAT DATE IN IST
// ======================================================

function formatDateIST(
    dateValue
) {

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

            year:
                "numeric",

            month:
                "short",

            day:
                "2-digit",

            hour:
                "2-digit",

            minute:
                "2-digit",

            second:
                "2-digit",

            hour12:
                true
        }
    ).format(
        date
    );
}


// ======================================================
// SUBJECT
// ======================================================

function buildSubject(
    setup
) {

    const symbol =
        setup.tradingPair ||
        setup.symbol ||
        "UNKNOWN";


    return (
        `🚨 PRE_PHASE | ${symbol} | ${setup.timeframe || "N/A"}`
    );
}


// ======================================================
// TEXT BODY
// ======================================================

function buildTextBody(
    setup
) {

    const symbol =
        setup.tradingPair ||
        setup.symbol ||
        "UNKNOWN";


    return `
CHANNEL BREAK SCANNER ALERT

Status:
${setup.status || "PRE_PHASE"}

Market:
${setup.market || "N/A"}

Symbol:
${symbol}

Timeframe:
${setup.timeframe || "N/A"}

Flash Sell:
${setup.flashSellDropPercent ?? "N/A"}%

Flash Sell Time (IST):
${formatDateIST(setup.flashSellDate)}

Lower Channel:
${setup.lowerChannelValue ?? "N/A"}

Candles Since Flash Sell:
${setup.candlesSinceFlashSell ?? "N/A"}

Base Candles:
${setup.baseCandles ?? "N/A"}

--------------------------------

Pattern:

Clean ascending channel
→ strong bearish lower-channel break
→ doji / hammer / long lower wick / base
→ PRE_PHASE

Generated automatically by Channel Break Scanner.
`.trim();
}


// ======================================================
// HTML BODY
// ======================================================

function buildHtmlBody(
    setup
) {

    const symbol =
        setup.tradingPair ||
        setup.symbol ||
        "UNKNOWN";


    return `
<!DOCTYPE html>

<html>

<body
    style="
        font-family: Arial, sans-serif;
        background: #f4f4f4;
        padding: 24px;
    "
>

<div
    style="
        max-width: 620px;
        margin: auto;
        background: white;
        padding: 26px;
        border-radius: 10px;
    "
>

<h2>
    🚨 Channel Break PRE_PHASE
</h2>


<table
    style="
        width: 100%;
        border-collapse: collapse;
        line-height: 1.8;
    "
>

<tr>
<td><strong>Market</strong></td>
<td>${setup.market || "N/A"}</td>
</tr>

<tr>
<td><strong>Symbol</strong></td>
<td>${symbol}</td>
</tr>

<tr>
<td><strong>Timeframe</strong></td>
<td>${setup.timeframe || "N/A"}</td>
</tr>

<tr>
<td><strong>Status</strong></td>
<td>${setup.status || "PRE_PHASE"}</td>
</tr>

<tr>
<td><strong>Flash Sell</strong></td>
<td>${setup.flashSellDropPercent ?? "N/A"}%</td>
</tr>

<tr>
<td><strong>Flash Sell Time</strong></td>
<td>${formatDateIST(setup.flashSellDate)}</td>
</tr>

<tr>
<td><strong>Lower Channel</strong></td>
<td>${setup.lowerChannelValue ?? "N/A"}</td>
</tr>

<tr>
<td><strong>Candles Since Sell</strong></td>
<td>${setup.candlesSinceFlashSell ?? "N/A"}</td>
</tr>

<tr>
<td><strong>Base Candles</strong></td>
<td>${setup.baseCandles ?? "N/A"}</td>
</tr>

</table>


<hr
    style="
        margin: 24px 0;
        border: none;
        border-top: 1px solid #ddd;
    "
>


<p>
<strong>Pattern</strong>
</p>

<p>
Clean ascending channel
→ strong bearish lower-channel break
→ doji / hammer / long lower wick / base
→ PRE_PHASE
</p>


<p
    style="
        color: #777;
        font-size: 12px;
    "
>
Generated automatically by Channel Break Scanner.
</p>


</div>

</body>

</html>
`;
}


// ======================================================
// SEND PRE_PHASE ALERT
// ======================================================

async function sendSetupAlert(
    setup
) {

    validateEmailConfig();


    const subject =
        buildSubject(
            setup
        );


    console.log(
        "Sending Mailjet alert to 2 recipients..."
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
                                    ALERT_EMAIL_1

                            },

                            {

                                Email:
                                    ALERT_EMAIL_2

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


    console.log(
        "Mailjet alert sent successfully."
    );


    return response.body;
}


// ======================================================
// TEST EMAIL
// ======================================================

async function sendTestEmail() {

    const testSetup = {

        market:
            "TEST",

        tradingPair:
            "TESTUSDT",

        timeframe:
            "30m",

        status:
            "PRE_PHASE",

        flashSellDate:
            new Date(),

        flashSellDropPercent:
            1.25,

        lowerChannelValue:
            100,

        candlesSinceFlashSell:
            1,

        baseCandles:
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