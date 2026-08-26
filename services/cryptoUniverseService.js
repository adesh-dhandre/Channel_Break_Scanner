const {
    getUsdtPerpetualSymbols
} = require("./binanceFuturesService");


// ======================================================
// EXCLUDED BASE ASSETS
// ======================================================

const EXCLUDED_SYMBOLS =
    new Set([

        "USDT",
        "USDC",
        "BUSD",
        "FDUSD",
        "TUSD",
        "USDP",
        "DAI",
        "PYUSD",
        "USDE",
        "USDD",

        "EUR",
        "GBP",
        "AUD",
        "JPY"

    ]);


// ======================================================
// EXCLUDED SYMBOL FILTER
// ======================================================

function isExcludedSymbol(
    symbol
) {

    if (!symbol) {

        return true;
    }


    const normalized =
        String(
            symbol
        ).toUpperCase();


    if (
        EXCLUDED_SYMBOLS.has(
            normalized
        )
    ) {

        return true;
    }


    const excludedSuffixes = [

        "UP",
        "DOWN",
        "BULL",
        "BEAR"

    ];


    for (
        const suffix
        of excludedSuffixes
    ) {

        if (
            normalized.endsWith(
                suffix
            )
        ) {

            return true;
        }
    }


    return false;
}


// ======================================================
// BUILD BINANCE FUTURES UNIVERSE
// ======================================================
//
// Expected input:
//
// Map {
//     "BTC" => "BTCUSDT",
//     "ETH" => "ETHUSDT",
//     ...
// }
//
// Output:
//
// [
//     {
//         symbol: "BTC",
//         tradingPair: "BTCUSDT",
//         market: "BINANCE_USDT_PERPETUAL"
//     },
//     ...
// ]
//
// ======================================================

function buildUniverseFromBinance(
    perpetualSymbols
) {

    if (
        !perpetualSymbols ||
        typeof perpetualSymbols.entries !==
            "function"
    ) {

        throw new Error(
            "Invalid Binance perpetual symbol map."
        );
    }


    const universe = [];


    const usedTradingPairs =
        new Set();


    for (
        const [
            baseSymbol,
            tradingPair
        ]
        of perpetualSymbols.entries()
    ) {

        const symbol =
            String(
                baseSymbol ||
                ""
            ).toUpperCase();


        const pair =
            String(
                tradingPair ||
                ""
            ).toUpperCase();


        if (
            !symbol ||
            !pair
        ) {

            continue;
        }


        // ==============================================
        // EXCLUDE STABLECOINS / FIAT / SPECIAL TOKENS
        // ==============================================

        if (
            isExcludedSymbol(
                symbol
            )
        ) {

            continue;
        }


        // ==============================================
        // ONLY USDT FUTURES
        // ==============================================

        if (
            !pair.endsWith(
                "USDT"
            )
        ) {

            continue;
        }


        // ==============================================
        // PREVENT DUPLICATES
        // ==============================================

        if (
            usedTradingPairs.has(
                pair
            )
        ) {

            continue;
        }


        usedTradingPairs.add(
            pair
        );


        universe.push({

            rank:
                null,

            id:
                null,

            symbol,

            name:
                symbol,

            tradingPair:
                pair,

            currentPrice:
                null,

            marketCap:
                null,

            market:
                "BINANCE_USDT_PERPETUAL"

        });
    }


    return universe;
}


// ======================================================
// GET COMPLETE BINANCE USDT PERPETUAL UNIVERSE
// ======================================================
//
// IMPORTANT:
//
// There is NO 200-symbol limit anymore.
//
// Every currently available Binance USDT perpetual
// contract returned by Binance is included, except
// excluded symbols above.
//
// ======================================================

async function getScannableCryptoUniverse() {

    console.log(
        "Fetching complete Binance USDT perpetual universe..."
    );


    const perpetualSymbols =
        await getUsdtPerpetualSymbols();


    const universe =
        buildUniverseFromBinance(
            perpetualSymbols
        );


    if (
        universe.length === 0
    ) {

        throw new Error(
            "Binance returned zero scannable USDT perpetual markets."
        );
    }


    console.log(
        `Binance USDT perpetual markets selected: ${universe.length}`
    );


    return universe;
}


// ======================================================
// COMPATIBILITY FUNCTION
// ======================================================
//
// Kept because another service may still import
// getTopCryptoCoins().
//
// It now returns the complete Binance futures universe.
//
// ======================================================

async function getTopCryptoCoins() {

    const universe =
        await getScannableCryptoUniverse();


    return universe.map(
        (
            coin,
            index
        ) => ({

            rank:
                index + 1,

            id:
                coin.id,

            symbol:
                coin.symbol,

            name:
                coin.name,

            currentPrice:
                coin.currentPrice,

            marketCap:
                coin.marketCap,

            tradingPair:
                coin.tradingPair,

            market:
                coin.market

        })
    );
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

    getTopCryptoCoins,

    getScannableCryptoUniverse,

    buildUniverseFromBinance,

    isExcludedSymbol

};