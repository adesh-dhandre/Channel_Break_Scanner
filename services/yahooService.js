async function fetchYahooCandlesByRange(
    symbol,
    range
) {
    try {

        const url =
            `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}` +
            `?interval=5m&range=${range}`;


        const response =
            await fetch(url);


        if (!response.ok) {

            const text =
                await response.text();

            throw new Error(
                `Yahoo HTTP ${response.status}: ${text}`
            );
        }


        const data =
            await response.json();


        if (
            !data.chart ||
            !data.chart.result ||
            !data.chart.result[0]
        ) {
            throw new Error(
                "Yahoo returned no chart data"
            );
        }


        const result =
            data.chart.result[0];


        const timestamps =
            result.timestamp || [];


        const quote =
            result.indicators.quote[0];


        const candles =
            timestamps.map(
                (timestamp, index) => ({
                    date:
                        new Date(
                            timestamp * 1000
                        ),

                    open:
                        quote.open[index],

                    high:
                        quote.high[index],

                    low:
                        quote.low[index],

                    close:
                        quote.close[index],

                    volume:
                        quote.volume[index]
                })
            );


        return candles.filter(
            candle =>
                candle.open !== null &&
                candle.high !== null &&
                candle.low !== null &&
                candle.close !== null
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


async function fetchYahooCandlesByPeriod(
    symbol,
    minutesBack = 60
) {
    try {

        const now =
            Math.floor(
                Date.now() / 1000
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
            `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}` +
            `?interval=5m` +
            `&period1=${period1}` +
            `&period2=${period2}`;


        const response =
            await fetch(url);


        if (!response.ok) {

            const text =
                await response.text();

            throw new Error(
                `Yahoo HTTP ${response.status}: ${text}`
            );
        }


        const data =
            await response.json();


        if (
            !data.chart ||
            !data.chart.result ||
            !data.chart.result[0]
        ) {

            return [];
        }


        const result =
            data.chart.result[0];


        const timestamps =
            result.timestamp || [];


        const quote =
            result.indicators.quote[0];


        const candles =
            timestamps.map(
                (timestamp, index) => ({
                    date:
                        new Date(
                            timestamp * 1000
                        ),

                    open:
                        quote.open[index],

                    high:
                        quote.high[index],

                    low:
                        quote.low[index],

                    close:
                        quote.close[index],

                    volume:
                        quote.volume[index]
                })
            );


        return candles.filter(
            candle =>
                candle.open !== null &&
                candle.high !== null &&
                candle.low !== null &&
                candle.close !== null
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


// ========================================
// FULL 30-DAY HISTORY
// ========================================

async function getHistoricalCandles(
    symbol
) {

    return await fetchYahooCandlesByRange(
        symbol,
        "30d"
    );
}


// ========================================
// FAST LIVE REFRESH
// ========================================

async function getRecentCandles(
    symbol
) {

    return await fetchYahooCandlesByPeriod(
        symbol,
        60
    );
}


// ========================================
// OLD COMPATIBILITY FUNCTION
// ========================================

async function getFiveMinuteCandles(
    symbol
) {

    return await getHistoricalCandles(
        symbol
    );
}


module.exports = {
    getHistoricalCandles,
    getRecentCandles,
    getFiveMinuteCandles
};