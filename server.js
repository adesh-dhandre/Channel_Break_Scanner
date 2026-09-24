require("dotenv").config();

const express =
    require("express");

const path =
    require("path");

const scannerRoutes =
    require("./routes/scannerRoutes");

const cryptoRoutes =
    require("./routes/cryptoRoutes");

const testRoutes =
    require("./routes/testRoutes");

const liveRoutes =
    require("./routes/liveRoutes");

const strictRoutes =
    require("./routes/strictRoutes");


const app =
    express();


const PORT =
    process.env.PORT ||
    3000;


// ======================================================
// PATHS
// ======================================================

const FRONTEND_DIST =
    path.join(
        __dirname,
        "frontend",
        "dist"
    );


// ======================================================
// MIDDLEWARE
// ======================================================

app.use(
    express.json()
);


// ======================================================
// API ROUTES
// ======================================================

// NSE Scanner
app.use(
    "/api/scanner",
    scannerRoutes
);


// Crypto Scanner
app.use(
    "/api/crypto",
    cryptoRoutes
);


// Single Symbol Testing
app.use(
    "/api/test",
    testRoutes
);


// Live / Cron Routes
app.use(
    "/api/live",
    liveRoutes
);


// Strict live crypto state/results from Redis
app.use(
    "/api/strict",
    strictRoutes
);


// ======================================================
// FRONTEND STATIC FILES
// ======================================================

app.use(
    express.static(
        FRONTEND_DIST
    )
);


// ======================================================
// API 404
// ======================================================

app.use(
    "/api",
    (req, res) => {

        return res
            .status(404)
            .json({
                success: false,
                error:
                    "API endpoint not found"
            });
    }
);


// ======================================================
// REACT FALLBACK
// ======================================================

app.use(
    (req, res) => {

        return res.sendFile(
            path.join(
                FRONTEND_DIST,
                "index.html"
            )
        );
    }
);


// ======================================================
// START SERVER
//
// External cron calls POST /api/live/trigger every 5m.
// ======================================================

app.listen(
    PORT,
    () => {

        console.log(
            `Server running on http://localhost:${PORT}`
        );

        console.log(
            "Frontend: React production build"
        );

        console.log(
            "Crypto strategy: STRICT_FLASH_TURN"
        );

        console.log(
            "Automation mode: external cron trigger"
        );
    }
);
