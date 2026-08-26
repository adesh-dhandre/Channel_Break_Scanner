const express = require("express");

const scannerRoutes =
    require("./routes/scannerRoutes");


const app = express();

const PORT =
    process.env.PORT || 3000;


// Parse JSON request bodies
app.use(
    express.json()
);


// Scanner API routes
app.use(
    "/api/scanner",
    scannerRoutes
);


// Simple home test route
app.get(
    "/",
    (req, res) => {

        res.send(
            "Channel Break Scanner API is running."
        );
    }
);


// Start server
app.listen(
    PORT,
    () => {

        console.log(
            `Server running on http://localhost:${PORT}`
        );
    }
);