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
//
// Prevent unknown /api routes from falling through
// to React index.html.
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
//
// Express 5:
// Do not use app.get("*").
//
// This middleware handles every remaining browser route
// and returns the React application.
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
// No internal scheduler.
//
// cron-job.org will call:
//
// POST /api/live/trigger
//
// every 5 minutes.
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
            "Automation mode: external cron trigger"
        );

    }
);