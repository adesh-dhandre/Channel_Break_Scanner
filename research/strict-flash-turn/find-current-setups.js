const {
    getUsdtPerpetualSymbols,
    getFuturesCandles
} = require("../../services/binanceFuturesService");

const {
    aggregateCryptoCandles
} = require("../../services/timeframeService");

const {
    detectStrictFlashTurnSetups
} = require("./strictStrategyDetector");


const TIMEFRAMES = [
    {
        name: "5m",
        ms: 5 * 60 * 1000,
        source: "5m",
        group: 1
    },
    {
        name: "15m",
        ms: 15 * 60 * 1000,
        source: "5m",
        group: 3
    },
    {
        name: "30m",
        ms: 30 * 60 * 1000,
        source: "5m",
        group: 6
    },
    {
        name: "45m",
        ms: 45 * 60 * 1000,
        source: "5m",
        group: 9
    },
    {
        name: "1h",
        ms: 60 * 60 * 1000,
        source: "5m",
        group: 12
    },
    {
        name: "2h",
        ms: 2 * 60 * 60 * 1000,
        source: "5m",
        group: 24
    },
    {
        name: "4h",
        ms: 4 * 60 * 60 * 1000,
        source: "4h"
    },
    {
        name: "1d",
        ms: 24 * 60 * 60 * 1000,
        source: "1d"
    }
];


function completedCandles(
    candles,
    timeframeMs,
    now
) {

    return candles.filter(
        candle =>
            new Date(
                candle.date
            ).getTime() +
            timeframeMs <= now
    );
}


function findCurrentSetup(
    candles,
    timeframe,
    symbol,
    now
) {

    const completed =
        completedCandles(
            candles,
            timeframe.ms,
            now
        );


    if (
        completed.length < 45
    ) {
        return null;
    }


    const setups =
        detectStrictFlashTurnSetups(
            completed
        );


    if (
        setups.length === 0
    ) {
        return null;
    }


    const setup =
        setups[
            setups.length - 1
        ];


    /*
     * Current means:
     *
     * Flash Sell
     *       ↓
     * Hammer/Doji closes
     *       ↓
     * NEXT candle is active right now
     */

    if (
        setup.reversalIndex !==
        completed.length - 1
    ) {
        return null;
    }


    const reversalOpen =
        new Date(
            setup.reversalDate
        ).getTime();


    const entryStart =
        reversalOpen +
        timeframe.ms;


    const entryEnd =
        entryStart +
        timeframe.ms;


    if (
        now < entryStart ||
        now >= entryEnd
    ) {
        return null;
    }


    const entryCandle =
        candles.find(
            candle =>
                new Date(
                    candle.date
                ).getTime() ===
                entryStart
        );


    if (
        !entryCandle
    ) {
        return null;
    }


    const entry =
        Number(
            entryCandle.open
        );


    const stop =
        Number(
            setup.setupLow
        );


    const risk =
        entry - stop;


    if (
        !Number.isFinite(entry) ||
        !Number.isFinite(stop) ||
        risk <= 0
    ) {
        return null;
    }


    return {

        symbol,

        timeframe:
            timeframe.name,

        type:
            setup.setupType,

        color:
            setup.setupColor,

        flashTime:
            new Date(
                setup.flashDate
            ).toISOString(),

        reversalTime:
            new Date(
                setup.reversalDate
            ).toISOString(),

        entryTime:
            new Date(
                entryStart
            ).toISOString(),

        entry:
            entry,

        stop:
            stop,

        target1R:
            entry + risk,

        target1_5R:
            entry + risk * 1.5,

        target2R:
            entry + risk * 2,

        flashDropPct:
            setup.flash.dropPercent,

        breakDepthRatio:
            setup.flash.breakDepthRatio,

        bodyRatio:
            setup.reversal.bodyRatio,

        lowerWickRatio:
            setup.reversal.lowerWickRatio,

        upperWickRatio:
            setup.reversal.upperWickRatio
    };
}


async function main() {

    console.log(
        "\nCURRENT STRICT SETUP SCANNER"
    );

    console.log(
        "Loading Binance USDT perpetual symbols...\n"
    );


    const symbolMap =
        await getUsdtPerpetualSymbols();


    const symbols =
        Array.from(
            symbolMap.values()
        );


    console.log(
        `Symbols: ${symbols.length}`
    );


    const matches = [];


    for (
        let i = 0;
        i < symbols.length;
        i++
    ) {

        const symbol =
            symbols[i];


        try {

            const now =
                Date.now();


            /*
             * One large 5m request gives enough
             * history for 5m through 2h.
             */

            const raw5m =
                await getFuturesCandles(
                    symbol,
                    "5m",
                    1500
                );


            const frameData = {

                "5m":
                    aggregateCryptoCandles(
                        raw5m,
                        1
                    ),

                "15m":
                    aggregateCryptoCandles(
                        raw5m,
                        3
                    ),

                "30m":
                    aggregateCryptoCandles(
                        raw5m,
                        6
                    ),

                "45m":
                    aggregateCryptoCandles(
                        raw5m,
                        9
                    ),

                "1h":
                    aggregateCryptoCandles(
                        raw5m,
                        12
                    ),

                "2h":
                    aggregateCryptoCandles(
                        raw5m,
                        24
                    )
            };


            /*
             * 4h and 1D need more historical
             * calendar coverage than 1500 x 5m.
             */

            frameData["4h"] =
                await getFuturesCandles(
                    symbol,
                    "4h",
                    120
                );


            frameData["1d"] =
                await getFuturesCandles(
                    symbol,
                    "1d",
                    120
                );


            for (
                const timeframe
                of TIMEFRAMES
            ) {

                const result =
                    findCurrentSetup(
                        frameData[
                            timeframe.name
                        ],
                        timeframe,
                        symbol,
                        now
                    );


                if (result) {

                    matches.push(
                        result
                    );


                    console.log(
                        "\n🔥 CURRENT SETUP FOUND"
                    );

                    console.table([
                        result
                    ]);
                }
            }


            if (
                (i + 1) % 25 === 0 ||
                i === symbols.length - 1
            ) {

                console.log(
                    `Scanned ${i + 1}/${symbols.length} | Current setups: ${matches.length}`
                );
            }

        } catch (error) {

            console.error(
                `${symbol}: ${error.message}`
            );
        }
    }


    matches.sort(
        (a, b) =>
            a.timeframe.localeCompare(
                b.timeframe
            ) ||
            a.symbol.localeCompare(
                b.symbol
            )
    );


    console.log(
        "\n================================"
    );

    console.log(
        `CURRENT SETUPS FOUND: ${matches.length}`
    );

    console.log(
        "================================\n"
    );


    if (
        matches.length === 0
    ) {

        console.log(
            "No current strict setups right now."
        );

    } else {

        console.table(
            matches.map(
                item => ({

                    symbol:
                        item.symbol,

                    timeframe:
                        item.timeframe,

                    type:
                        item.type,

                    color:
                        item.color,

                    entry:
                        item.entry,

                    stop:
                        item.stop,

                    target1R:
                        item.target1R,

                    target1_5R:
                        item.target1_5R,

                    target2R:
                        item.target2R,

                    flashDropPct:
                        item.flashDropPct

                })
            )
        );
    }
}


main().catch(
    error => {

        console.error(
            error
        );

        process.exit(1);
    }
);
