const FUTURES_BASE_URL =
    "https://fapi.binance.com";


// ======================================================
// RATE LIMIT CONFIG
//
// Binance USD-M request-weight limit:
// 2400 weight / minute.
//
// We deliberately use only ~75% of that capacity
// so other requests and timing variance have headroom.
// ======================================================

const SAFE_WEIGHT_PER_MINUTE =
    1800;


const DEFAULT_429_WAIT_MS =
    60000;


const MAX_RETRIES =
    3;


// ======================================================
// GLOBAL REQUEST QUEUE
//
// Every Binance request passes through this queue.
//
// This is important because cryptoScannerService can run
// many symbols concurrently.
//
// The scanner can remain concurrent, but Binance REST
// requests are paced safely.
// ======================================================

let requestQueue =
    Promise.resolve();


let nextRequestAt =
    0;


let blockedUntil =
    0;


// ======================================================
// HELPERS
// ======================================================

function sleep(ms) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );
}


// ======================================================
// BINANCE KLINE REQUEST WEIGHT
//
// USD-M /fapi/v1/klines:
//
// limit < 100       = weight 1
// limit 100-499     = weight 2
// limit 500-1000    = weight 5
// limit > 1000      = weight 10
// ======================================================

function getKlineRequestWeight(
    limit
) {

    const value =
        Number(limit);


    if (
        value < 100
    ) {

        return 1;
    }


    if (
        value < 500
    ) {

        return 2;
    }


    if (
        value <= 1000
    ) {

        return 5;
    }


    return 10;
}


// ======================================================
// SCHEDULE WEIGHTED REQUEST
// ======================================================

function scheduleRequest(
    weight,
    requestFunction
) {

    const spacingMs =
        Math.ceil(
            (
                60000 *
                weight
            ) /
            SAFE_WEIGHT_PER_MINUTE
        );


    const execute =
        async () => {

            // ------------------------------------------
            // Respect global Binance cooldown / ban.
            // ------------------------------------------

            const now =
                Date.now();


            const allowedAt =
                Math.max(
                    nextRequestAt,
                    blockedUntil
                );


            if (
                allowedAt >
                now
            ) {

                const waitMs =
                    allowedAt -
                    now;


                console.log(
                    `Binance throttle: waiting ${Math.ceil(waitMs / 1000)}s`
                );


                await sleep(
                    waitMs
                );
            }


            // Reserve next weighted slot.

            nextRequestAt =
                Date.now() +
                spacingMs;


            return await requestFunction();
        };


    const result =
        requestQueue.then(
            execute,
            execute
        );


    // Keep queue alive even if a request fails.

    requestQueue =
        result.catch(
            () => {}
        );


    return result;
}


// ======================================================
// EXTRACT RETRY WAIT
// ======================================================

function getRetryWaitMs(
    response,
    bodyText
) {

    // ------------------------------------------
    // Prefer Binance Retry-After header.
    // ------------------------------------------

    const retryAfterHeader =
        response.headers.get(
            "retry-after"
        );


    if (
        retryAfterHeader
    ) {

        const seconds =
            Number(
                retryAfterHeader
            );


        if (
            Number.isFinite(
                seconds
            ) &&
            seconds > 0
        ) {

            return (
                seconds *
                1000
            );
        }
    }


    // ------------------------------------------
    // Binance 418 body may contain:
    //
    // banned until 1787786065887
    // ------------------------------------------

    const match =
        String(
            bodyText ||
            ""
        ).match(
            /banned until\s+(\d+)/i
        );


    if (
        match
    ) {

        const timestamp =
            Number(
                match[1]
            );


        if (
            Number.isFinite(
                timestamp
            ) &&
            timestamp >
                Date.now()
        ) {

            return (
                timestamp -
                Date.now()
            );
        }
    }


    return DEFAULT_429_WAIT_MS;
}


// ======================================================
// SAFE BINANCE FETCH
// ======================================================

async function safeBinanceFetch(
    url,
    {
        weight = 1,
        label = "Binance request"
    } = {}
) {

    return scheduleRequest(
        weight,
        async () => {

            let lastError =
                null;


            for (
                let attempt = 1;
                attempt <= MAX_RETRIES;
                attempt++
            ) {

                // --------------------------------------
                // Global block may have been created
                // while this request was waiting.
                // --------------------------------------

                if (
                    blockedUntil >
                    Date.now()
                ) {

                    const waitMs =
                        blockedUntil -
                        Date.now();


                    console.warn(
                        `Binance cooldown active. Waiting ${Math.ceil(waitMs / 1000)}s...`
                    );


                    await sleep(
                        waitMs
                    );
                }


                try {

                    const response =
                        await fetch(
                            url
                        );


                    // ==================================
                    // SUCCESS
                    // ==================================

                    if (
                        response.ok
                    ) {

                        const usedWeight =
                            response.headers.get(
                                "x-mbx-used-weight-1m"
                            );


                        if (
                            usedWeight
                        ) {

                            const numericWeight =
                                Number(
                                    usedWeight
                                );


                            if (
                                Number.isFinite(
                                    numericWeight
                                ) &&
                                numericWeight >=
                                    1800
                            ) {

                                console.warn(
                                    `Binance used weight high: ${numericWeight}/2400`
                                );
                            }
                        }


                        return response;
                    }


                    const bodyText =
                        await response.text();


                    // ==================================
                    // RATE LIMIT
                    // ==================================

                    if (
                        response.status === 429 ||
                        response.status === 418
                    ) {

                        const waitMs =
                            getRetryWaitMs(
                                response,
                                bodyText
                            );


                        blockedUntil =
                            Math.max(
                                blockedUntil,
                                Date.now() +
                                    waitMs
                            );


                        const type =
                            response.status ===
                            418
                                ? "IP BAN"
                                : "RATE LIMIT";


                        console.error(
                            `Binance ${type}: ${label}`
                        );


                        console.error(
                            `Waiting ${Math.ceil(waitMs / 1000)} seconds before more Binance requests.`
                        );


                        lastError =
                            new Error(
                                `${label} failed: ${response.status} ${bodyText}`
                            );


                        if (
                            attempt <
                            MAX_RETRIES
                        ) {

                            await sleep(
                                waitMs
                            );


                            continue;
                        }


                        throw lastError;
                    }


                    // ==================================
                    // OTHER HTTP ERROR
                    // ==================================

                    throw new Error(
                        `${label} failed: ${response.status} ${bodyText}`
                    );


                } catch (error) {

                    lastError =
                        error;


                    // Network errors may be temporary.

                    if (
                        attempt <
                        MAX_RETRIES
                    ) {

                        const retryDelay =
                            attempt *
                            2000;


                        console.warn(
                            `${label} attempt ${attempt} failed: ${error.message}`
                        );


                        console.warn(
                            `Retrying in ${retryDelay / 1000}s...`
                        );


                        await sleep(
                            retryDelay
                        );


                        continue;
                    }


                    throw error;
                }
            }


            throw (
                lastError ||
                new Error(
                    `${label} failed`
                )
            );
        }
    );
}


// ======================================================
// GET ACTIVE USDT PERPETUAL CONTRACTS
// ======================================================

async function getUsdtPerpetualSymbols() {

    const response =
        await safeBinanceFetch(
            `${FUTURES_BASE_URL}/fapi/v1/exchangeInfo`,
            {
                weight:
                    1,

                label:
                    "Binance Futures exchangeInfo"
            }
        );


    const data =
        await response.json();


    if (
        !data ||
        !Array.isArray(
            data.symbols
        )
    ) {

        throw new Error(
            "Invalid Binance Futures exchangeInfo response."
        );
    }


    const symbols =
        new Map();


    for (
        const item
        of data.symbols
    ) {

        if (
            item.quoteAsset !==
            "USDT"
        ) {

            continue;
        }


        if (
            item.contractType !==
            "PERPETUAL"
        ) {

            continue;
        }


        if (
            item.status !==
            "TRADING"
        ) {

            continue;
        }


        symbols.set(
            item.baseAsset,
            item.symbol
        );
    }


    return symbols;
}


// ======================================================
// GET FUTURES CANDLES
// ======================================================

async function getFuturesCandles(
    symbol,
    interval = "5m",
    limit = 1500
) {

    const url =
        `${FUTURES_BASE_URL}/fapi/v1/klines` +
        `?symbol=${encodeURIComponent(symbol)}` +
        `&interval=${interval}` +
        `&limit=${limit}`;


    const requestWeight =
        getKlineRequestWeight(
            limit
        );


    const response =
        await safeBinanceFetch(
            url,
            {
                weight:
                    requestWeight,

                label:
                    `Binance Futures candles for ${symbol}`
            }
        );


    const data =
        await response.json();


    if (
        !Array.isArray(
            data
        )
    ) {

        throw new Error(
            `Invalid candle response for ${symbol}`
        );
    }


    return data.map(
        candle => ({

            date:
                new Date(
                    candle[0]
                ),

            open:
                Number(
                    candle[1]
                ),

            high:
                Number(
                    candle[2]
                ),

            low:
                Number(
                    candle[3]
                ),

            close:
                Number(
                    candle[4]
                ),

            volume:
                Number(
                    candle[5]
                )

        })
    );
}


// ======================================================
// RATE LIMIT STATUS
// ======================================================

function getBinanceRateLimitState() {

    return {

        safeWeightPerMinute:
            SAFE_WEIGHT_PER_MINUTE,

        blockedUntil:
            blockedUntil > 0
                ? new Date(
                    blockedUntil
                )
                    .toISOString()
                : null,

        currentlyBlocked:
            blockedUntil >
            Date.now()

    };
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

    getUsdtPerpetualSymbols,

    getFuturesCandles,

    getKlineRequestWeight,

    getBinanceRateLimitState

};