// ======================================================
// YAHOO FINANCE SERVICE
//
// Goals:
//
// 1. Avoid large request bursts.
// 2. Reduce Yahoo HTTP 429 errors.
// 3. Retry temporary Yahoo/network failures.
// 4. Keep existing scanner behavior unchanged.
//
// Node.js 18 compatible.
// ======================================================


// ======================================================
// REQUEST CONFIG
// ======================================================

const MAX_CONCURRENT_REQUESTS =
    3;


// Minimum gap between Yahoo request starts.
//
// This prevents Promise.all() batches from firing many
// requests at exactly the same moment.

const MIN_REQUEST_GAP_MS =
    300;


// Retry temporary failures.
//
// Total attempts:
//
// initial attempt
// +
// MAX_RETRIES

const MAX_RETRIES =
    3;


// ======================================================
// REQUEST LIMITER STATE
// ======================================================

let activeRequests =
    0;

let lastRequestStartedAt =
    0;

const requestQueue =
    [];


// ======================================================
// SLEEP
// ======================================================

function sleep(
    milliseconds
) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                milliseconds
            )
    );
}


// ======================================================
// PROCESS REQUEST QUEUE
// ======================================================

function processRequestQueue() {

    while (
        activeRequests <
            MAX_CONCURRENT_REQUESTS &&
        requestQueue.length >
            0
    ) {

        const job =
            requestQueue.shift();


        activeRequests++;


        runQueuedRequest(
            job
        );
    }
}


// ======================================================
// RUN ONE QUEUED REQUEST
// ======================================================

async function runQueuedRequest(
    job
) {

    try {

        // ==============================================
        // GLOBAL REQUEST START GAP
        // ==============================================

        const now =
            Date.now();


        const elapsed =
            now -
            lastRequestStartedAt;


        if (
            elapsed <
            MIN_REQUEST_GAP_MS
        ) {

            await sleep(
                MIN_REQUEST_GAP_MS -
                elapsed
            );
        }


        lastRequestStartedAt =
            Date.now();


        const result =
            await job.task();


        job.resolve(
            result
        );


    } catch (error) {

        job.reject(
            error
        );


    } finally {

        activeRequests--;


        processRequestQueue();
    }
}


// ======================================================
// QUEUE YAHOO REQUEST
// ======================================================

function queueYahooRequest(
    task
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            requestQueue.push({

                task,

                resolve,

                reject

            });


            processRequestQueue();
        }
    );
}


// ======================================================
// RETRYABLE HTTP STATUS
// ======================================================

function isRetryableStatus(
    status
) {

    return (
        status === 429 ||
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504
    );
}


// ======================================================
// RETRY WAIT
// ======================================================

function getRetryDelay(
    status,
    attempt
) {

    // Yahoo 429 needs a stronger cooldown.

    if (
        status === 429
    ) {

        const delays = [
            3000,
            7000,
            15000
        ];


        return (
            delays[
                attempt
            ] ||
            15000
        );
    }


    // Temporary server failures.

    const delays = [
        1000,
        2500,
        5000
    ];


    return (
        delays[
            attempt
        ] ||
        5000
    );
}


// ======================================================
// FETCH YAHOO JSON
// ======================================================

async function fetchYahooJson(
    url,
    symbol,
    requestType
) {

    return await queueYahooRequest(
        async () => {

            let lastError =
                null;


            for (
                let attempt = 0;
                attempt <= MAX_RETRIES;
                attempt++
            ) {

                try {

                    const response =
                        await fetch(
                            url,
                            {
                                headers: {

                                    "User-Agent":
                                        "Mozilla/5.0",

                                    "Accept":
                                        "application/json,text/plain,*/*"

                                }
                            }
                        );


                    if (
                        response.ok
                    ) {

                        return await response.json();
                    }


                    const status =
                        response.status;


                    const text =
                        await response.text();


                    const error =
                        new Error(
                            `Yahoo HTTP ${status}: ${text}`
                        );


                    error.status =
                        status;


                    lastError =
                        error;


                    if (
                        !isRetryableStatus(
                            status
                        ) ||
                        attempt >=
                            MAX_RETRIES
                    ) {

                        throw error;
                    }


                    const delay =
                        getRetryDelay(
                            status,
                            attempt
                        );


                    console.warn(
                        `${symbol}: Yahoo ${requestType} HTTP ${status}. Retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms.`
                    );


                    await sleep(
                        delay
                    );


                } catch (error) {

                    lastError =
                        error;


                    const status =
                        error.status;


                    // Already handled Yahoo HTTP errors.

                    if (
                        status
                    ) {

                        if (
                            !isRetryableStatus(
                                status
                            ) ||
                            attempt >=
                                MAX_RETRIES
                        ) {

                            throw error;
                        }


                        continue;
                    }


                    // Network-type error.

                    if (
                        attempt >=
                        MAX_RETRIES
                    ) {

                        throw error;
                    }


                    const delay =
                        getRetryDelay(
                            null,
                            attempt
                        );


                    console.warn(
                        `${symbol}: Yahoo ${requestType} network error. Retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms: ${error.message}`
                    );


                    await sleep(
                        delay
                    );
                }
            }


            throw (
                lastError ||
                new Error(
                    "Yahoo request failed"
                )
            );
        }
    );
}


// ======================================================
// PARSE YAHOO CHART RESPONSE
// ======================================================

function parseYahooCandles(
    data
) {

    if (
        !data?.chart?.result?.[0]
    ) {

        throw new Error(
            "Yahoo returned no chart data"
        );
    }


    const result =
        data.chart.result[0];


    const timestamps =
        result.timestamp ||
        [];


    const quote =
        result
            ?.indicators
            ?.quote
            ?.[0];


    if (
        !quote
    ) {

        return [];
    }


    const candles =
        timestamps.map(
            (
                timestamp,
                index
            ) => ({

                date:
                    new Date(
                        timestamp *
                        1000
                    ),

                open:
                    quote.open[
                        index
                    ],

                high:
                    quote.high[
                        index
                    ],

                low:
                    quote.low[
                        index
                    ],

                close:
                    quote.close[
                        index
                    ],

                volume:
                    quote.volume[
                        index
                    ]

            })
        );


    return candles.filter(
        candle =>
            candle.open !== null &&
            candle.open !== undefined &&

            candle.high !== null &&
            candle.high !== undefined &&

            candle.low !== null &&
            candle.low !== undefined &&

            candle.close !== null &&
            candle.close !== undefined
    );
}


// ======================================================
// FETCH CANDLES BY RANGE
// ======================================================

async function fetchYahooCandlesByRange(
    symbol,
    range
) {

    try {

        const url =
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
            `?interval=5m&range=${encodeURIComponent(range)}`;


        const data =
            await fetchYahooJson(
                url,
                symbol,
                "history"
            );


        return parseYahooCandles(
            data
        );


    } catch (error) {

        console.error(
            `Yahoo Finance error for ${symbol}:`
        );

        console.error(
            error.message
        );


        throw error;
    }
}


// ======================================================
// FETCH RECENT CANDLES BY PERIOD
// ======================================================

async function fetchYahooCandlesByPeriod(
    symbol,
    minutesBack = 60
) {

    try {

        const now =
            Math.floor(
                Date.now() /
                1000
            );


        const period2 =
            now;


        const period1 =
            now -
            (
                minutesBack *
                60
            );


        const url =
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
            `?interval=5m` +
            `&period1=${period1}` +
            `&period2=${period2}`;


        const data =
            await fetchYahooJson(
                url,
                symbol,
                "refresh"
            );


        if (
            !data?.chart?.result?.[0]
        ) {

            return [];
        }


        return parseYahooCandles(
            data
        );


    } catch (error) {

        console.error(
            `Yahoo recent-data error for ${symbol}:`
        );

        console.error(
            error.message
        );


        throw error;
    }
}


// ======================================================
// FULL 30-DAY HISTORY
//
// Only needed when we have no usable memory/disk cache.
// ======================================================

async function getHistoricalCandles(
    symbol
) {

    return await fetchYahooCandlesByRange(
        symbol,
        "30d"
    );
}


// ======================================================
// FAST LIVE REFRESH
//
// Existing cache + overlapping last 60 minutes.
//
// Overlap is intentional.
//
// mergeCandles() removes duplicates by candle timestamp,
// while overlap protects us from missing or partially
// updated recent candles.
// ======================================================

async function getRecentCandles(
    symbol
) {

    return await fetchYahooCandlesByPeriod(
        symbol,
        60
    );
}


// ======================================================
// OLD COMPATIBILITY FUNCTION
// ======================================================

async function getFiveMinuteCandles(
    symbol
) {

    return await getHistoricalCandles(
        symbol
    );
}


// ======================================================
// REQUEST STATS
// ======================================================

function getYahooRequestStats() {

    return {

        activeRequests,

        queuedRequests:
            requestQueue.length,

        maxConcurrentRequests:
            MAX_CONCURRENT_REQUESTS,

        minRequestGapMs:
            MIN_REQUEST_GAP_MS

    };
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

    getHistoricalCandles,

    getRecentCandles,

    getFiveMinuteCandles,

    getYahooRequestStats

};