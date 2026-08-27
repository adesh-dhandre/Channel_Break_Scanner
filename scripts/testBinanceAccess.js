async function testBinanceAccess() {

    try {

        const response =
            await fetch(
                "https://fapi.binance.com/fapi/v1/exchangeInfo"
            );

        console.log(
            "BINANCE STATUS:",
            response.status
        );

        const text =
            await response.text();

        console.log(
            text.slice(0, 500)
        );

        process.exit(
            response.ok ? 0 : 1
        );

    } catch (error) {

        console.error(
            "BINANCE TEST ERROR:",
            error
        );

        process.exit(1);
    }
}

testBinanceAccess();