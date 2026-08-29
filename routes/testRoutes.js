const express = require("express");

const router = express.Router();

const {
    buildTimeframes
} = require("../services/timeframeService");

const {
    detectPrePhaseSetup
} = require("../scanners/setupScanner");

const {
    initializeSymbol: initializeNseSymbol
} = require("../services/marketDataCache");

const {
    initializeSymbol: initializeCryptoSymbol
} = require("../services/cryptoMarketDataCache");

const {
    sendDiscordTestAlert
} = require("../services/discordAlertService");


// ======================================================
// DISCORD NOTIFICATION TEST
//
// GET:
// /api/test/discord
//
// Sends a fake PRE_PHASE notification directly to
// Discord.
//
// IMPORTANT:
// This does NOT run the scanner.
// This does NOT create a real signal.
// This does NOT touch sent-signals.json.
// This does NOT send email.
// ======================================================

router.get(
    "/discord",
    async (req, res) => {

        try {

            const result =
                await sendDiscordTestAlert();


            return res.json({

                success:
                    true,

                message:
                    "Discord test notification sent.",

                result

            });


        } catch (error) {

            console.error(
                "Discord test notification failed:",
                error
            );


            return res
                .status(500)
                .json({

                    success:
                        false,

                    error:
                        error.message

                });
        }
    }
);


// ======================================================
// SINGLE SYMBOL SETUP TEST
//
// NSE:
// /api/test/setup?market=NSE&symbol=MRF.NS&timeframe=1h
//
// CRYPTO:
// /api/test/setup?market=CRYPTO&symbol=SOLUSDT&timeframe=30m
// ======================================================

router.get(
    "/setup",
    async (req, res) => {

        try {

            const market =
                String(
                    req.query.market || ""
                ).toUpperCase();


            let symbol =
                String(
                    req.query.symbol || ""
                ).toUpperCase();


            const timeframe =
                String(
                    req.query.timeframe || "1h"
                ).toLowerCase();


            const allowedTimeframes = [
                "5m",
                "15m",
                "30m",
                "45m",
                "1h",
                "2h"
            ];


            // ==========================================
            // VALIDATE MARKET
            // ==========================================

            if (
                market !== "NSE" &&
                market !== "CRYPTO"
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        error:
                            "market must be NSE or CRYPTO"

                    });
            }


            // ==========================================
            // VALIDATE SYMBOL
            // ==========================================

            if (!symbol) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        error:
                            "symbol is required"

                    });
            }


            // Automatically add .NS for NSE.

            if (
                market === "NSE" &&
                !symbol.endsWith(".NS")
            ) {

                symbol =
                    `${symbol}.NS`;
            }


            // ==========================================
            // VALIDATE TIMEFRAME
            // ==========================================

            if (
                !allowedTimeframes.includes(
                    timeframe
                )
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        error:
                            "Invalid timeframe",

                        allowedTimeframes

                    });
            }


            // ==========================================
            // LOAD / REFRESH 5M CANDLES
            // ==========================================

            let candles5m;


            if (
                market === "NSE"
            ) {

                candles5m =
                    await initializeNseSymbol(
                        symbol
                    );

            } else {

                candles5m =
                    await initializeCryptoSymbol(
                        symbol
                    );
            }


            if (
                !Array.isArray(
                    candles5m
                ) ||
                candles5m.length === 0
            ) {

                return res
                    .status(404)
                    .json({

                        success:
                            false,

                        error:
                            "No candle data found",

                        market,

                        symbol

                    });
            }


            // ==========================================
            // BUILD MARKET-AWARE TIMEFRAMES
            //
            // NSE:
            // grouped inside IST trading days.
            //
            // CRYPTO:
            // continuous 24/7 aggregation.
            // ==========================================

            const timeframes =
                buildTimeframes(
                    candles5m,
                    market
                );


            const timeframeCandles =
                timeframes[
                    timeframe
                ];


            if (
                !Array.isArray(
                    timeframeCandles
                ) ||
                timeframeCandles.length === 0
            ) {

                return res
                    .status(404)
                    .json({

                        success:
                            false,

                        error:
                            "No candles generated for timeframe",

                        market,

                        symbol,

                        timeframe

                    });
            }


            // ==========================================
            // RUN EXISTING STRATEGY
            // ==========================================

            const result =
                detectPrePhaseSetup(
                    timeframeCandles,
                    timeframe
                );


            // ==========================================
            // RESPONSE
            // ==========================================

            return res.json({

                success:
                    true,

                market,

                symbol,

                timeframe,

                candles5m:
                    candles5m.length,

                candleCount:
                    timeframeCandles.length,

                result

            });


        } catch (error) {

            console.error(
                "Single-symbol test failed:",
                error
            );


            return res
                .status(500)
                .json({

                    success:
                        false,

                    error:
                        error.message

                });
        }
    }
);


module.exports =
    router;