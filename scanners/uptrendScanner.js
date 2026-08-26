// ======================================================
// SHARED STRUCTURAL UPTREND SCANNER
//
// Used by BOTH:
// - NSE F&O
// - Crypto Futures
//
// Scenario A:
// HH1 -> HL1 -> HH2 -> FLASH SELL
//
// Scenario B:
// HH1 -> HL1 -> HH2 -> HL2 -> NEW HH -> FLASH SELL
//
// IMPORTANT:
// setupScanner should pass only candles BEFORE
// the detected flash-sell candle.
// ======================================================


function findSwingPoints(
    candles,
    swingSize = 2
) {

    const swingHighs = [];
    const swingLows = [];


    for (
        let i = swingSize;
        i < candles.length - swingSize;
        i++
    ) {

        let isSwingHigh = true;
        let isSwingLow = true;


        for (
            let j = 1;
            j <= swingSize;
            j++
        ) {

            if (
                candles[i].high <= candles[i - j].high ||
                candles[i].high <= candles[i + j].high
            ) {

                isSwingHigh = false;
            }


            if (
                candles[i].low >= candles[i - j].low ||
                candles[i].low >= candles[i + j].low
            ) {

                isSwingLow = false;
            }
        }


        if (isSwingHigh) {

            swingHighs.push({
                index: i,
                price: candles[i].high,
                date: candles[i].date
            });
        }


        if (isSwingLow) {

            swingLows.push({
                index: i,
                price: candles[i].low,
                date: candles[i].date
            });
        }
    }


    return {
        swingHighs,
        swingLows
    };
}


// ======================================================
// DETECT STRUCTURAL UPTREND
// ======================================================

function detectUptrend(
    candles,
    lookback = 30
) {

    if (
        !Array.isArray(candles) ||
        candles.length < 8
    ) {

        return {
            isUptrend: false,
            scenario: null,
            reason: "Not enough candles"
        };
    }


    const recentCandles =
        candles.slice(
            -lookback
        );


    const {
        swingHighs,
        swingLows
    } =
        findSwingPoints(
            recentCandles,
            2
        );


    if (
        swingHighs.length < 2 ||
        swingLows.length < 1
    ) {

        return {

            isUptrend: false,

            scenario: null,

            reason:
                "Not enough swing structure",

            swingHighCount:
                swingHighs.length,

            swingLowCount:
                swingLows.length

        };
    }


    // ==================================================
    // SEARCH:
    //
    // HH1
    //  ↓
    // HL1
    //  ↓
    // HH2
    //
    // HH2 must be higher than HH1.
    // ==================================================

    for (
        let h2Index =
            swingHighs.length - 1;

        h2Index >= 1;

        h2Index--
    ) {

        const HH2 =
            swingHighs[h2Index];


        for (
            let lowIndex =
                swingLows.length - 1;

            lowIndex >= 0;

            lowIndex--
        ) {

            const HL1 =
                swingLows[lowIndex];


            // HL1 must occur before HH2

            if (
                HL1.index >= HH2.index
            ) {
                continue;
            }


            for (
                let h1Index =
                    h2Index - 1;

                h1Index >= 0;

                h1Index--
            ) {

                const HH1 =
                    swingHighs[h1Index];


                // HH1 must occur before HL1

                if (
                    HH1.index >= HL1.index
                ) {
                    continue;
                }


                // HH2 must actually be higher

                if (
                    HH2.price <= HH1.price
                ) {
                    continue;
                }


                // ======================================
                // SCENARIO A
                //
                // HH1 -> HL1 -> HH2 -> SELL
                // ======================================

                let scenario =
                    "HH1_HL1_HH2";


                let HL2 =
                    null;


                let continuationHigh =
                    null;


                // ======================================
                // SCENARIO B
                //
                // HH1 -> HL1 -> HH2 -> HL2 -> NEW HH
                // ======================================

                for (
                    const possibleHL2
                    of swingLows
                ) {

                    if (
                        possibleHL2.index <=
                        HH2.index
                    ) {
                        continue;
                    }


                    // HL2 must be a higher low

                    if (
                        possibleHL2.price <=
                        HL1.price
                    ) {
                        continue;
                    }


                    for (
                        const possibleHigh
                        of swingHighs
                    ) {

                        if (
                            possibleHigh.index <=
                            possibleHL2.index
                        ) {
                            continue;
                        }


                        if (
                            possibleHigh.price >
                            HH2.price
                        ) {

                            HL2 =
                                possibleHL2;


                            continuationHigh =
                                possibleHigh;


                            scenario =
                                "HH1_HL1_HH2_HL2_NEW_HH";


                            break;
                        }
                    }


                    if (
                        continuationHigh
                    ) {
                        break;
                    }
                }


                return {

                    isUptrend: true,

                    scenario,

                    reason:
                        "Valid structural uptrend",

                    HH1,

                    HL1,

                    HH2,

                    HL2,

                    continuationHigh,

                    swingHighCount:
                        swingHighs.length,

                    swingLowCount:
                        swingLows.length

                };
            }
        }
    }


    return {

        isUptrend: false,

        scenario: null,

        reason:
            "No valid HH1 -> HL1 -> HH2 structure",

        swingHighCount:
            swingHighs.length,

        swingLowCount:
            swingLows.length

    };
}


module.exports = {
    detectUptrend,
    findSwingPoints
};