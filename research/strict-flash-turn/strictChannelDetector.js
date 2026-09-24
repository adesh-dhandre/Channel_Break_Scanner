// ======================================================
// STRICT ASCENDING CHANNEL — RESEARCH ONLY
//
// Goal:
// Detect a REAL swing-based ascending channel rather
// than fitting regression lines to random rising prices.
//
// Required structure:
// - >= 2 confirmed swing highs
// - >= 2 confirmed swing lows
// - higher highs
// - higher lows
// - alternating swing sequence
// - upper/lower boundaries both rising
// - boundaries reasonably parallel
// - sufficient channel duration
// - price mostly respects the channel
//
// IMPORTANT:
// Pass ONLY candles available BEFORE the Flash Sell.
// No future candles.
// ======================================================


function findSwingPoints(
    candles,
    swingSize = 2
) {

    const swings = [];


    for (
        let i = swingSize;
        i < candles.length - swingSize;
        i++
    ) {

        let isHigh = true;
        let isLow = true;


        for (
            let j = 1;
            j <= swingSize;
            j++
        ) {

            if (
                Number(candles[i].high) <=
                    Number(candles[i - j].high) ||
                Number(candles[i].high) <=
                    Number(candles[i + j].high)
            ) {
                isHigh = false;
            }


            if (
                Number(candles[i].low) >=
                    Number(candles[i - j].low) ||
                Number(candles[i].low) >=
                    Number(candles[i + j].low)
            ) {
                isLow = false;
            }
        }


        if (isHigh) {

            swings.push({
                type: "H",
                index: i,
                price:
                    Number(
                        candles[i].high
                    ),
                date:
                    candles[i].date
            });
        }


        if (isLow) {

            swings.push({
                type: "L",
                index: i,
                price:
                    Number(
                        candles[i].low
                    ),
                date:
                    candles[i].date
            });
        }
    }


    swings.sort(
        (a, b) =>
            a.index - b.index
    );


    return swings;
}


function lineThrough(
    p1,
    p2
) {

    const dx =
        p2.index -
        p1.index;


    if (
        dx <= 0
    ) {
        return null;
    }


    const slope =
        (
            p2.price -
            p1.price
        ) /
        dx;


    const intercept =
        p1.price -
        slope *
        p1.index;


    return {
        slope,
        intercept
    };
}


function valueAt(
    line,
    index
) {

    return (
        line.intercept +
        line.slope *
        index
    );
}


function averageTrueRange(
    candles,
    period = 14
) {

    if (
        candles.length < 2
    ) {
        return 0;
    }


    const start =
        Math.max(
            1,
            candles.length -
            period
        );


    const values = [];


    for (
        let i = start;
        i < candles.length;
        i++
    ) {

        const high =
            Number(
                candles[i].high
            );

        const low =
            Number(
                candles[i].low
            );

        const previousClose =
            Number(
                candles[i - 1].close
            );


        const trueRange =
            Math.max(
                high - low,
                Math.abs(
                    high -
                    previousClose
                ),
                Math.abs(
                    low -
                    previousClose
                )
            );


        values.push(
            trueRange
        );
    }


    if (
        values.length === 0
    ) {
        return 0;
    }


    return (
        values.reduce(
            (sum, value) =>
                sum + value,
            0
        ) /
        values.length
    );
}


function detectStrictAscendingChannel(
    candles,
    options = {}
) {

    const lookback =
        options.lookback ??
        40;

    const swingSize =
        options.swingSize ??
        2;

    const maxParallelRatio =
        options.maxParallelRatio ??
        0.35;

    const minSpanCandles =
        options.minSpanCandles ??
        8;

    const minInsideRatio =
        options.minInsideRatio ??
        0.80;

    const atrTolerance =
        options.atrTolerance ??
        0.35;


    if (
        !Array.isArray(candles) ||
        candles.length <
            Math.max(
                lookback,
                10
            )
    ) {

        return {
            isValidChannel: false,
            reason:
                "NOT_ENOUGH_CANDLES"
        };
    }


    const recent =
        candles.slice(
            -lookback
        );


    const swings =
        findSwingPoints(
            recent,
            swingSize
        );


    const highs =
        swings.filter(
            swing =>
                swing.type === "H"
        );


    const lows =
        swings.filter(
            swing =>
                swing.type === "L"
        );


    if (
        highs.length < 2 ||
        lows.length < 2
    ) {

        return {
            isValidChannel: false,
            reason:
                "NOT_ENOUGH_SWINGS",

            swingHighCount:
                highs.length,

            swingLowCount:
                lows.length
        };
    }


    /*
     * Search backwards so the most recent
     * valid channel is preferred.
     *
     * We require four alternating pivots:
     *
     * H1 -> L1 -> H2 -> L2
     *
     * OR
     *
     * L1 -> H1 -> L2 -> H2
     *
     * with:
     * H2 > H1
     * L2 > L1
     */

    for (
        let end =
            swings.length - 1;

        end >= 3;

        end--
    ) {

        for (
            let start =
                Math.max(
                    0,
                    end - 7
                );

            start <= end - 3;

            start++
        ) {

            const sequence =
                swings.slice(
                    start,
                    end + 1
                );


            for (
                let a = 0;
                a <=
                    sequence.length - 4;
                a++
            ) {

                const four =
                    sequence.slice(
                        a,
                        a + 4
                    );


                const pattern =
                    four
                        .map(
                            swing =>
                                swing.type
                        )
                        .join("");


                if (
                    pattern !== "HLHL" &&
                    pattern !== "LHLH"
                ) {
                    continue;
                }


                const selectedHighs =
                    four.filter(
                        swing =>
                            swing.type === "H"
                    );


                const selectedLows =
                    four.filter(
                        swing =>
                            swing.type === "L"
                    );


                const H1 =
                    selectedHighs[0];

                const H2 =
                    selectedHighs[1];

                const L1 =
                    selectedLows[0];

                const L2 =
                    selectedLows[1];


                // Genuine higher-high / higher-low structure.

                if (
                    H2.price <=
                    H1.price
                ) {
                    continue;
                }


                if (
                    L2.price <=
                    L1.price
                ) {
                    continue;
                }


                const firstPivotIndex =
                    Math.min(
                        H1.index,
                        L1.index
                    );


                const lastPivotIndex =
                    Math.max(
                        H2.index,
                        L2.index
                    );


                const spanCandles =
                    lastPivotIndex -
                    firstPivotIndex;


                if (
                    spanCandles <
                    minSpanCandles
                ) {
                    continue;
                }


                const upperLine =
                    lineThrough(
                        H1,
                        H2
                    );


                const lowerLine =
                    lineThrough(
                        L1,
                        L2
                    );


                if (
                    !upperLine ||
                    !lowerLine
                ) {
                    continue;
                }


                // Both channel sides MUST rise.

                if (
                    upperLine.slope <= 0 ||
                    lowerLine.slope <= 0
                ) {
                    continue;
                }


                const maximumSlope =
                    Math.max(
                        Math.abs(
                            upperLine.slope
                        ),
                        Math.abs(
                            lowerLine.slope
                        )
                    );


                const parallelRatio =
                    maximumSlope > 0
                        ? (
                            Math.abs(
                                upperLine.slope -
                                lowerLine.slope
                            ) /
                            maximumSlope
                        )
                        : 1;


                if (
                    parallelRatio >
                    maxParallelRatio
                ) {
                    continue;
                }


                /*
                 * Channel must remain physically valid:
                 * upper line above lower line from the
                 * first structure pivot through the
                 * candle immediately before Flash Sell.
                 */

                const checkStart =
                    firstPivotIndex;

                const checkEnd =
                    recent.length - 1;


                const startWidth =
                    valueAt(
                        upperLine,
                        checkStart
                    ) -
                    valueAt(
                        lowerLine,
                        checkStart
                    );


                const endWidth =
                    valueAt(
                        upperLine,
                        checkEnd
                    ) -
                    valueAt(
                        lowerLine,
                        checkEnd
                    );


                if (
                    startWidth <= 0 ||
                    endWidth <= 0
                ) {
                    continue;
                }


                const widthRatio =
                    Math.max(
                        startWidth,
                        endWidth
                    ) /
                    Math.min(
                        startWidth,
                        endWidth
                    );


                /*
                 * Reject channels that flare out
                 * or collapse heavily.
                 */

                if (
                    widthRatio >
                    1.50
                ) {
                    continue;
                }


                const channelCandles =
                    recent.slice(
                        checkStart
                    );


                const atr =
                    averageTrueRange(
                        channelCandles,
                        14
                    );


                if (
                    !Number.isFinite(atr) ||
                    atr <= 0
                ) {
                    continue;
                }


                const tolerance =
                    atr *
                    atrTolerance;


                let insideCount = 0;

                let majorViolationCount = 0;


                for (
                    let i = checkStart;
                    i <= checkEnd;
                    i++
                ) {

                    const candle =
                        recent[i];


                    const upper =
                        valueAt(
                            upperLine,
                            i
                        );


                    const lower =
                        valueAt(
                            lowerLine,
                            i
                        );


                    const close =
                        Number(
                            candle.close
                        );


                    if (
                        close <=
                            upper +
                            tolerance &&
                        close >=
                            lower -
                            tolerance
                    ) {

                        insideCount++;
                    }


                    /*
                     * A close materially outside the
                     * channel BEFORE the Flash Sell
                     * invalidates the structure.
                     */

                    if (
                        close >
                            upper +
                            atr ||
                        close <
                            lower -
                            atr
                    ) {

                        majorViolationCount++;
                    }
                }


                const insideRatio =
                    insideCount /
                    channelCandles.length;


                if (
                    insideRatio <
                    minInsideRatio
                ) {
                    continue;
                }


                if (
                    majorViolationCount >
                    0
                ) {
                    continue;
                }


                const projectedIndex =
                    recent.length;


                const projectedUpper =
                    valueAt(
                        upperLine,
                        projectedIndex
                    );


                const projectedLower =
                    valueAt(
                        lowerLine,
                        projectedIndex
                    );


                return {

                    isValidChannel:
                        true,

                    reason:
                        "STRICT_SWING_CHANNEL",

                    pattern,

                    H1,
                    L1,
                    H2,
                    L2,

                    spanCandles,

                    swingHighCount:
                        highs.length,

                    swingLowCount:
                        lows.length,

                    upperSlope:
                        upperLine.slope,

                    lowerSlope:
                        lowerLine.slope,

                    parallelRatio,

                    startWidth,

                    endWidth,

                    widthRatio,

                    insideRatio,

                    atr,

                    tolerance,

                    projectedUpper,

                    projectedLower,

                    lookback,

                    swingSize,

                    channelStartDate:
                        recent[
                            checkStart
                        ].date,

                    channelEndDate:
                        recent[
                            checkEnd
                        ].date
                };
            }
        }
    }


    return {
        isValidChannel: false,
        reason:
            "NO_STRICT_ASCENDING_CHANNEL",

        swingHighCount:
            highs.length,

        swingLowCount:
            lows.length
    };
}


module.exports = {
    findSwingPoints,
    detectStrictAscendingChannel
};
