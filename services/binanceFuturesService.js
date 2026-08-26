const FUTURES_BASE_URL =
    "https://fapi.binance.com";


// ========================================
// GET ACTIVE USDT PERPETUAL CONTRACTS
// ========================================

async function getUsdtPerpetualSymbols() {

    const response =
        await fetch(
            `${FUTURES_BASE_URL}/fapi/v1/exchangeInfo`
        );


    if (!response.ok) {

        throw new Error(
            `Binance Futures exchangeInfo failed: ${response.status}`
        );
    }


    const data =
        await response.json();


    if (
        !data ||
        !Array.isArray(data.symbols)
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
            item.quoteAsset !== "USDT"
        ) {
            continue;
        }


        if (
            item.contractType !== "PERPETUAL"
        ) {
            continue;
        }


        if (
            item.status !== "TRADING"
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


// ========================================
// GET FUTURES CANDLES
// ========================================

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


    const response =
        await fetch(url);


    if (!response.ok) {

        const text =
            await response.text();


        throw new Error(
            `Binance Futures candles failed for ${symbol}: ${response.status} ${text}`
        );
    }


    const data =
        await response.json();


    if (!Array.isArray(data)) {

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
                Number(candle[1]),

            high:
                Number(candle[2]),

            low:
                Number(candle[3]),

            close:
                Number(candle[4]),

            volume:
                Number(candle[5])

        })
    );
}


module.exports = {
    getUsdtPerpetualSymbols,
    getFuturesCandles
};