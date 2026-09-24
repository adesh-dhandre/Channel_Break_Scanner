const express =
    require("express");

const {
    isStrictRedisEnabled,
    getCurrentStrictSetups,
    getStrictScanState,
    pingStrictRedis
} = require("../services/strictRedisService");


const router =
    express.Router();


// ======================================================
// STRICT SCANNER STATUS
// ======================================================

router.get(
    "/status",
    async (req, res) => {

        try {

            const state =
                await getStrictScanState();


            return res.json({

                success: true,

                strategy:
                    "STRICT_FLASH_TURN",

                redisEnabled:
                    isStrictRedisEnabled(),

                state:
                    state || {
                        running: false,
                        startedAt: null,
                        completedAt: null,
                        scannedSymbols: 0,
                        failedSymbols: 0,
                        dueTimeframes: [],
                        newSetupCount: 0,
                        currentSetupCount: 0,
                        scanDurationSeconds: 0
                    }

            });


        } catch (error) {

            return res
                .status(500)
                .json({
                    success: false,
                    strategy:
                        "STRICT_FLASH_TURN",
                    error:
                        error.message
                });
        }
    }
);


// ======================================================
// CURRENT STRICT SETUPS
// ======================================================

router.get(
    "/results",
    async (req, res) => {

        try {

            const setups =
                await getCurrentStrictSetups();


            const results =
                Array.isArray(
                    setups
                )
                    ? setups
                    : [];


            return res.json({

                success: true,

                strategy:
                    "STRICT_FLASH_TURN",

                count:
                    results.length,

                results

            });


        } catch (error) {

            return res
                .status(500)
                .json({
                    success: false,
                    strategy:
                        "STRICT_FLASH_TURN",
                    count: 0,
                    results: [],
                    error:
                        error.message
                });
        }
    }
);


// ======================================================
// REDIS HEALTH
// ======================================================

router.get(
    "/redis-health",
    async (req, res) => {

        const health =
            await pingStrictRedis();


        return res
            .status(
                health.connected ||
                !health.enabled
                    ? 200
                    : 503
            )
            .json({
                success:
                    health.connected,
                ...health
            });
    }
);


module.exports =
    router;
