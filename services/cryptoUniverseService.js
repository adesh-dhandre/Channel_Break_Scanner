const {
    getUsdtPerpetualSymbols
} = require("./binanceFuturesService");


// ======================================================
// CONFIG
// ======================================================

// Maximum number of Binance USDT perpetual markets
// we want to scan.
//
// We can increase/decrease this later depending
// on live scan duration.

const MAX_CRYPTO_SYMBOLS =
    200;


// ======================================================
// EXCLUDED BASE ASSETS
//
// Stablecoins and assets we don't want treated
// as normal crypto trading candidates.
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
// LEVERAGED / SPECIAL TOKEN FILTER
//
// Avoid obvious leveraged-token style symbols.
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
// NORMALIZE BINANCE SYMBOL MAP
//
// getUsdtPerpetualSymbols() currently returns a Map:
//
// BASE ASSET -> TRADING PAIR
//
// Example:
//
// BTC -> BTCUSDT
// ETH -> ETHUSDT
// SOL -> SOLUSDT
//
// We convert that into the same object structure
// expected by cryptoScannerService.
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


        // ------------------------------------------
        // Stablecoin / fiat / special token filter
        // ------------------------------------------

        if (
            isExcludedSymbol(
                symbol
            )
        ) {

            continue;
        }


        // ------------------------------------------
        // We only want USDT perpetual pairs
        // ------------------------------------------

        if (
            !pair.endsWith(
                "USDT"
            )
        ) {

            continue;
        }


        // ------------------------------------------
        // Prevent duplicate trading pairs
        // ------------------------------------------

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

            // We no longer have CoinGecko
            // market-cap rank here.
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
// SCANNABLE CRYPTO UNIVERSE
//
// Binance Futures is now the PRIMARY source.
//
// CoinGecko is NOT required.
// ======================================================

async function getScannableCryptoUniverse() {

    console.log(
        "Fetching Binance USDT perpetual universe..."
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
        `Binance USDT perpetual markets found: ${universe.length}`
    );


    // ==================================================
    // LIMIT UNIVERSE
    //
    // Important:
    //
    // This is NOT market-cap ranking anymore.
    //
    // We are simply limiting the Binance universe
    // so we can measure scanner performance first.
    // ==================================================

    const scannableUniverse =
        universe.slice(
            0,
            MAX_CRYPTO_SYMBOLS
        );


    console.log(
        `Crypto markets selected for scan: ${scannableUniverse.length}`
    );


    return scannableUniverse;
}


// ======================================================
// COMPATIBILITY FUNCTION
//
// Some other file may still import
// getTopCryptoCoins().
//
// Instead of breaking that code, return the
// Binance universe in a compatible format.
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