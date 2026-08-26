const fs = require("fs");
const path = require("path");
const zlib = require("zlib");


// ======================================================
// CSV PARSER
// ======================================================

function parseCsvLine(line) {

    const values = [];

    let current = "";
    let insideQuotes = false;


    for (let i = 0; i < line.length; i++) {

        const char = line[i];


        if (char === '"') {

            if (
                insideQuotes &&
                line[i + 1] === '"'
            ) {

                current += '"';
                i++;

            } else {

                insideQuotes = !insideQuotes;
            }

        } else if (
            char === "," &&
            !insideQuotes
        ) {

            values.push(current.trim());
            current = "";

        } else {

            current += char;
        }
    }


    values.push(current.trim());

    return values;
}


// ======================================================
// NORMALIZE HEADER
// ======================================================

function normalizeHeader(value) {

    return String(value || "")
        .replace(/"/g, "")
        .replace(/[\s_-]/g, "")
        .trim()
        .toLowerCase();
}


// ======================================================
// FIND HEADER
// ======================================================

function findHeaderIndex(
    normalizedHeaders,
    possibleNames
) {

    for (const name of possibleNames) {

        const index =
            normalizedHeaders.indexOf(
                normalizeHeader(name)
            );


        if (index !== -1) {
            return index;
        }
    }


    return -1;
}


// ======================================================
// EXTRACT REAL NSE F&O STOCK SYMBOLS
// ======================================================

function extractStockSymbols(csvText) {

    const lines =
        csvText
            .split(/\r?\n/)
            .filter(
                line => line.trim()
            );


    if (lines.length < 2) {

        throw new Error(
            "NSE contract file is empty."
        );
    }


    const rawHeaders =
        parseCsvLine(
            lines[0]
        );


    const headers =
        rawHeaders.map(
            normalizeHeader
        );


    console.log(
        "\nDetected NSE columns:"
    );

    console.log(
        rawHeaders.slice(0, 30)
    );


    // ==================================================
    // SYMBOL COLUMN
    // 2026 NSE file uses TckrSymb
    // ==================================================

    const symbolIndex =
        findHeaderIndex(
            headers,
            [
                "TckrSymb",
                "Symbol",
                "UndrlygSymb",
                "UnderlyingSymbol"
            ]
        );


    if (symbolIndex === -1) {

        throw new Error(
            "Could not find NSE ticker/symbol column."
        );
    }


    // ==================================================
    // INSTRUMENT COLUMN
    // ==================================================

    const instrumentIndex =
        findHeaderIndex(
            headers,
            [
                "FinInstrmNm",
                "Instrument",
                "InstrumentType",
                "FinInstrmTp"
            ]
        );


    // ==================================================
    // ASSET CLASS COLUMN
    // ==================================================

    const assetClassIndex =
        findHeaderIndex(
            headers,
            [
                "UndrlygInstrmAsstClss",
                "UnderlyingInstrumentAssetClass"
            ]
        );


    console.log(
        "\nSymbol column:",
        rawHeaders[symbolIndex]
    );


    console.log(
        "Instrument column:",
        instrumentIndex >= 0
            ? rawHeaders[instrumentIndex]
            : "Not found"
    );


    console.log(
        "Asset class column:",
        assetClassIndex >= 0
            ? rawHeaders[assetClassIndex]
            : "Not found"
    );


    // ==================================================
    // KNOWN INDEX SYMBOLS
    // ==================================================

    const knownIndexes =
        new Set([
            "NIFTY",
            "BANKNIFTY",
            "FINNIFTY",
            "MIDCPNIFTY",
            "NIFTYNXT50"
        ]);


    const symbols =
        new Set();


    // ==================================================
    // READ CONTRACT ROWS
    // ==================================================

    for (
        let i = 1;
        i < lines.length;
        i++
    ) {

        const columns =
            parseCsvLine(
                lines[i]
            );


        const symbol =
            String(
                columns[symbolIndex] || ""
            )
                .trim()
                .toUpperCase();


        if (!symbol) {
            continue;
        }


        // ==================================================
        // REMOVE NSE TEST CONTRACTS
        // Example:
        // 011NSETEST
        // 021NSETEST
        // etc.
        // ==================================================

        if (
            symbol.includes(
                "NSETEST"
            )
        ) {
            continue;
        }


        // ==================================================
        // REMOVE INDEX DERIVATIVES
        // ==================================================

        if (
            knownIndexes.has(
                symbol
            )
        ) {
            continue;
        }


        // ==================================================
        // BASIC SYMBOL VALIDATION
        // ==================================================

        if (
            symbol.length < 2
        ) {
            continue;
        }


        const instrument =
            instrumentIndex >= 0
                ? String(
                    columns[
                        instrumentIndex
                    ] || ""
                )
                    .trim()
                    .toUpperCase()
                : "";


        const assetClass =
            assetClassIndex >= 0
                ? String(
                    columns[
                        assetClassIndex
                    ] || ""
                )
                    .trim()
                    .toUpperCase()
                : "";


        // ==================================================
        // DETECT STOCK DERIVATIVES
        // ==================================================

        const instrumentLooksLikeStock =
            instrument.includes("FUTSTK") ||
            instrument.includes("OPTSTK") ||
            instrument === "STK" ||
            instrument.includes("STOCK");


        const assetClassLooksLikeStock =
            assetClass.includes("EQUITY") ||
            assetClass.includes("STOCK") ||
            assetClass === "STK";


        // ==================================================
        // FILTER NON-STOCK CONTRACTS
        // ==================================================

        if (
            (
                instrumentIndex >= 0 ||
                assetClassIndex >= 0
            ) &&
            !instrumentLooksLikeStock &&
            !assetClassLooksLikeStock
        ) {

            continue;
        }


        symbols.add(symbol);
    }


    return Array
        .from(symbols)
        .sort();
}


// ======================================================
// NSE -> YAHOO SYMBOL CONVERSION
// ======================================================

function applyYahooMappings(
    nseSymbols
) {

    /*
     * Put special Yahoo mappings here whenever
     * NSE and Yahoo use different ticker symbols.
     */

    const mappings = {

        TATAMOTORS:
            "TMPV"

    };


    const yahooSymbols =
        nseSymbols.map(
            symbol => {

                const mappedSymbol =
                    mappings[symbol] ||
                    symbol;


                return `${mappedSymbol}.NS`;
            }
        );


    // Mapping could theoretically create duplicates,
    // so deduplicate again.

    return Array
        .from(
            new Set(
                yahooSymbols
            )
        )
        .sort();
}


// ======================================================
// READ NSE GZIP CONTRACT FILE
// ======================================================

function readContractFile(
    filePath
) {

    if (
        !fs.existsSync(
            filePath
        )
    ) {

        throw new Error(
            `Contract file not found: ${filePath}`
        );
    }


    const compressed =
        fs.readFileSync(
            filePath
        );


    const decompressed =
        zlib.gunzipSync(
            compressed
        );


    return decompressed
        .toString("utf8");
}


// ======================================================
// GENERATE data/fnoSymbols.js
// ======================================================

function generateFnoSymbolsFile(
    contractFilePath
) {

    console.log(
        "\n===================================="
    );

    console.log(
        "NSE 2026 F&O UNIVERSE GENERATOR"
    );

    console.log(
        "===================================="
    );


    console.log("\nReading:");

    console.log(
        contractFilePath
    );


    // ==================================================
    // READ NSE CONTRACT DATA
    // ==================================================

    const csvText =
        readContractFile(
            contractFilePath
        );


    // ==================================================
    // EXTRACT NSE STOCK SYMBOLS
    // ==================================================

    const nseSymbols =
        extractStockSymbols(
            csvText
        );


    // ==================================================
    // CONVERT TO YAHOO SYMBOLS
    // ==================================================

    const yahooSymbols =
        applyYahooMappings(
            nseSymbols
        );


    // ==================================================
    // SAFETY CHECKS
    // ==================================================

    if (
        yahooSymbols.length === 0
    ) {

        throw new Error(
            "No F&O symbols extracted. fnoSymbols.js NOT overwritten."
        );
    }


    /*
     * Protect against accidentally replacing
     * our universe with a badly parsed file.
     */

    if (
        yahooSymbols.length < 100
    ) {

        throw new Error(
            `Only ${yahooSymbols.length} symbols found. This looks incorrect. fnoSymbols.js NOT overwritten.`
        );
    }


    // ==================================================
    // MAKE SURE NSETEST DID NOT SURVIVE
    // ==================================================

    const testSymbols =
        yahooSymbols.filter(
            symbol =>
                symbol.includes(
                    "NSETEST"
                )
        );


    if (
        testSymbols.length > 0
    ) {

        throw new Error(
            `Found ${testSymbols.length} NSETEST symbols. fnoSymbols.js NOT overwritten.`
        );
    }


    // ==================================================
    // OUTPUT PATH
    // ==================================================

    const outputPath =
        path.join(
            __dirname,
            "../data/fnoSymbols.js"
        );


    const sourceFile =
        path.basename(
            contractFilePath
        );


    // ==================================================
    // BUILD JS FILE
    // ==================================================

    const fileContent =
`// =====================================================
// AUTO-GENERATED NSE F&O UNIVERSE
// Source: ${sourceFile}
// DO NOT EDIT THIS LIST MANUALLY
// =====================================================

const fnoSymbols = ${JSON.stringify(
    yahooSymbols,
    null,
    4
)};

module.exports = {
    fnoSymbols
};
`;


    // ==================================================
    // WRITE FILE
    // ==================================================

    fs.writeFileSync(
        outputPath,
        fileContent,
        "utf8"
    );


    // ==================================================
    // REPORT
    // ==================================================

    console.log(
        "\n===================================="
    );

    console.log(
        "GENERATION COMPLETED"
    );

    console.log(
        "===================================="
    );


    console.log(
        "\nNSE stock symbols found:",
        nseSymbols.length
    );


    console.log(
        "Yahoo symbols generated:",
        yahooSymbols.length
    );


    console.log(
        "NSETEST symbols:",
        testSymbols.length
    );


    console.log(
        "\nSaved:"
    );


    console.log(
        outputPath
    );


    console.log(
        "\nFirst 25 symbols:"
    );


    console.log(
        yahooSymbols.slice(
            0,
            25
        )
    );


    console.log(
        "\nLast 10 symbols:"
    );


    console.log(
        yahooSymbols.slice(
            -10
        )
    );


    return yahooSymbols;
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

    parseCsvLine,

    extractStockSymbols,

    applyYahooMappings,

    readContractFile,

    generateFnoSymbolsFile

};