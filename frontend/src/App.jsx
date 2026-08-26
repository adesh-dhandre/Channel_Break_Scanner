import { useEffect, useMemo, useState } from "react";
import "./App.css";
import ChartModal from "./components/ChartModal";

const TIMEFRAMES = [
  "ALL",
  "15m",
  "30m",
  "45m",
  "1h",
  "2h"
];

function App() {

  const [market, setMarket] = useState("NSE");

  const [nseState, setNseState] = useState(null);

  const [cryptoStatus, setCryptoStatus] = useState(null);
  const [cryptoResults, setCryptoResults] = useState([]);

  const [selectedTimeframe, setSelectedTimeframe] =
    useState("ALL");

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);

  const [runningNse, setRunningNse] = useState(false);
  const [runningCrypto, setRunningCrypto] = useState(false);

  const [error, setError] = useState("");

  const [chartSetup, setChartSetup] = useState(null);
  const [chartCandles, setChartCandles] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);


  // ====================================================
  // FETCH NSE STATUS
  // ====================================================

  async function fetchNseStatus() {

    try {

      const response =
        await fetch("/api/scanner/status");


      if (!response.ok) {

        throw new Error(
          "Unable to load NSE scanner status."
        );

      }


      const result =
        await response.json();


      setNseState(
        result.data
      );


    } catch (err) {

      console.error(err);

    }

  }


  // ====================================================
  // FETCH CRYPTO STATUS
  // ====================================================

  async function fetchCryptoStatus() {

    try {

      const response =
        await fetch("/api/crypto/status");


      if (!response.ok) {

        throw new Error(
          "Unable to load crypto scanner status."
        );

      }


      const result =
        await response.json();


      setCryptoStatus(
        result
      );


    } catch (err) {

      console.error(err);

    }

  }


  // ====================================================
  // FETCH CRYPTO RESULTS
  // ====================================================

  async function fetchCryptoResults() {

    try {

      const response =
        await fetch("/api/crypto/results");


      if (!response.ok) {

        throw new Error(
          "Unable to load crypto results."
        );

      }


      const result =
        await response.json();


      setCryptoResults(
        result.results || []
      );


    } catch (err) {

      console.error(err);

    }

  }


  // ====================================================
  // INITIAL DATA
  // ====================================================

  async function refreshAll() {

    try {

      await Promise.all([
        fetchNseStatus(),
        fetchCryptoStatus(),
        fetchCryptoResults()
      ]);

      setError("");

    } catch (err) {

      console.error(err);

      setError(
        "Unable to connect to scanner backend."
      );

    } finally {

      setLoading(false);

    }

  }


  // ====================================================
  // RUN NSE SCANNER
  // ====================================================

  async function runNseScanner() {

    if (
      runningNse ||
      nseState?.scanning
    ) {
      return;
    }


    try {

      setRunningNse(true);
      setError("");


      const response =
        await fetch(
          "/api/scanner/run",
          {
            method: "POST"
          }
        );


      const result =
        await response.json();


      if (!response.ok) {

        throw new Error(
          result.message ||
          "Unable to start NSE scanner."
        );

      }


      await fetchNseStatus();


    } catch (err) {

      console.error(err);

      setError(
        err.message
      );

    } finally {

      setRunningNse(false);

    }

  }


  // ====================================================
  // RUN CRYPTO SCANNER
  // ====================================================

  async function runCryptoScanner() {

    if (
      runningCrypto ||
      cryptoStatus?.running
    ) {
      return;
    }


    try {

      setRunningCrypto(true);
      setError("");


      const response =
        await fetch(
          "/api/crypto/scan",
          {
            method: "POST"
          }
        );


      const result =
        await response.json();


      if (!response.ok) {

        throw new Error(
          result.message ||
          "Unable to start crypto scanner."
        );

      }


      await fetchCryptoStatus();


    } catch (err) {

      console.error(err);

      setError(
        err.message
      );

    } finally {

      setRunningCrypto(false);

    }

  }


  // ====================================================
  // OPEN NSE CHART
  // ====================================================

  async function openChart(setup) {

    if (market !== "NSE") {
      return;
    }


    try {

      setChartSetup(setup);
      setChartCandles([]);
      setChartLoading(true);
      setError("");


      const response =
        await fetch(
          `/api/scanner/chart/${encodeURIComponent(
            setup.symbol
          )}?timeframe=${setup.timeframe}`
        );


      const result =
        await response.json();


      if (!response.ok) {

        throw new Error(
          result.message ||
          "Unable to load chart."
        );

      }


      setChartCandles(
        result.data.candles || []
      );


    } catch (err) {

      console.error(err);

      setError(
        err.message
      );

      setChartSetup(null);

    } finally {

      setChartLoading(false);

    }

  }


  // ====================================================
  // CLOSE CHART
  // ====================================================

  function closeChart() {

    setChartSetup(null);
    setChartCandles([]);

  }


  // ====================================================
  // POLLING
  // ====================================================

  useEffect(() => {

    refreshAll();


    const interval =
      setInterval(
        async () => {

          await Promise.all([
            fetchNseStatus(),
            fetchCryptoStatus(),
            fetchCryptoResults()
          ]);

        },
        5000
      );


    return () =>
      clearInterval(interval);

  }, []);


  useEffect(() => {

    setSelectedTimeframe("ALL");
    setSearch("");

  }, [market]);


  // ====================================================
  // MARKET STATE
  // ====================================================

  const isNse =
    market === "NSE";


  const activeSetups =
    isNse
      ? nseState?.activeSetups || []
      : cryptoResults;


  const isScanning =
    isNse
      ? (
          runningNse ||
          nseState?.scanning
        )
      : (
          runningCrypto ||
          cryptoStatus?.running
        );


  // ====================================================
  // FILTER RESULTS
  // ====================================================

  const filteredSetups =
    useMemo(() => {

      let rows =
        [...activeSetups];


      if (
        selectedTimeframe !== "ALL"
      ) {

        rows =
          rows.filter(
            setup =>
              setup.timeframe ===
              selectedTimeframe
          );

      }


      if (
        search.trim()
      ) {

        const query =
          search
            .trim()
            .toLowerCase();


        rows =
          rows.filter(
            setup => {

              const symbol =
                (
                  setup.tradingPair ||
                  setup.symbol ||
                  ""
                )
                  .toLowerCase();


              const name =
                (
                  setup.name ||
                  ""
                )
                  .toLowerCase();


              return (
                symbol.includes(query) ||
                name.includes(query)
              );

            }
          );

      }


      return rows;

    }, [
      activeSetups,
      selectedTimeframe,
      search
    ]);


  // ====================================================
  // HELPERS
  // ====================================================

  function formatDate(date) {

    if (!date) {

      return "Not scanned yet";

    }


    return new Date(date)
      .toLocaleString(
        "en-IN",
        {
          timeZone:
            "Asia/Kolkata",

          dateStyle:
            "medium",

          timeStyle:
            "short"
        }
      );

  }


  function displaySymbol(setup) {

    if (isNse) {

      return (
        setup.symbol
          ?.replace(
            ".NS",
            ""
          ) ||
        "-"
      );

    }


    return (
      setup.tradingPair ||
      setup.symbol ||
      "-"
    );

  }


  function displayStructure(setup) {

    if (
      !setup.uptrendScenario
    ) {

      return "-";

    }


    if (
      setup.uptrendScenario ===
      "HH1_HL1_HH2"
    ) {

      return "HH1 → HL1 → HH2";

    }


    if (
      setup.uptrendScenario ===
      "HH1_HL1_HH2_HL2_NEW_HH"
    ) {

      return "HH1 → HL1 → HH2 → HL2 → HH";

    }


    return setup.uptrendScenario
      .replaceAll(
        "_",
        " → "
      );

  }


  // ====================================================
  // STATS
  // ====================================================

  const totalScanned =
    isNse
      ? nseState?.totalStocksScanned || 0
      : cryptoStatus?.stats?.scannedCoins || 0;


  const successful =
    isNse
      ? nseState?.successfulStocks || 0
      : cryptoStatus?.stats?.successfulCoins || 0;


  const failed =
    isNse
      ? nseState?.failedStocks || 0
      : cryptoStatus?.stats?.failedCoins || 0;


  const activeCount =
    activeSetups.length;


  const scanDuration =
    isNse
      ? nseState?.scanDurationSeconds || 0
      : cryptoStatus?.stats?.scanDurationSeconds || 0;


  const lastCompleted =
    isNse
      ? nseState?.lastScanCompletedAt
      : cryptoStatus?.completedAt;


  const successRate =
    totalScanned > 0
      ? (
          (
            successful /
            totalScanned
          ) *
          100
        ).toFixed(1)
      : "0.0";


  // ====================================================
  // LOADING
  // ====================================================

  if (loading) {

    return (

      <div className="pageLoader">

        <div className="loaderRing" />

        <p>
          Loading Channel Break Scanner...
        </p>

      </div>

    );

  }


  return (

    <div className="dashboardShell">


      {/* ================================================= */}
      {/* SIDEBAR */}
      {/* ================================================= */}

      <aside className="sidebar">


        <div className="brand">

          <div className="brandIcon">
            ↗
          </div>

          <div>

            <strong>
              CHANNEL BREAK
            </strong>

            <span>
              SCANNER
            </span>

          </div>

        </div>


        <nav className="sideNav">

          <button className="sideNavItem active">
            <span>▦</span>
            Dashboard
          </button>


          <button
            className={
              isNse
                ? "sideNavItem selected"
                : "sideNavItem"
            }
            onClick={() =>
              setMarket("NSE")
            }
          >
            <span>▥</span>
            NSE F&O
          </button>


          <button
            className={
              !isNse
                ? "sideNavItem selected"
                : "sideNavItem"
            }
            onClick={() =>
              setMarket("CRYPTO")
            }
          >
            <span>₿</span>
            Crypto Futures
          </button>

        </nav>


        <div className="sidebarBottom">

          <div className="systemCard">

            <span className="systemLabel">
              System Status
            </span>

            <strong>
              <span className="greenDot" />
              All Systems Operational
            </strong>

          </div>


          <p className="copyright">
            © 2026 Channel Break Scanner
          </p>

        </div>

      </aside>


      {/* ================================================= */}
      {/* MAIN */}
      {/* ================================================= */}

      <main className="mainContent">


        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <header className="mainHeader">

          <div>

            <p className="headerEyebrow">
              MARKET SCANNER
            </p>

            <h1>
              Channel Break Scanner
            </h1>

            <p className="headerSubtitle">
              Fresh pre-phase setups across 15M,
              30M, 45M, 1H and 2H timeframes.
            </p>

          </div>


          <div className="headerStatus">

            <div
              className={
                isScanning
                  ? "statusPill scanning"
                  : "statusPill live"
              }
            >

              <span className="statusDot" />

              {
                isScanning
                  ? "SCANNING"
                  : "LIVE"
              }

            </div>

          </div>

        </header>


        {/* ================================================= */}
        {/* ERROR */}
        {/* ================================================= */}

        {
          error && (

            <div className="errorBanner">

              <span>
                {error}
              </span>

              <button
                onClick={() =>
                  setError("")
                }
              >
                ×
              </button>

            </div>

          )
        }


        {/* ================================================= */}
        {/* MARKET SELECTOR + SCAN CONTROL */}
        {/* ================================================= */}

        <section className="marketControlRow">


          <div className="marketSwitch">


            <button
              className={
                isNse
                  ? "marketChoice active"
                  : "marketChoice"
              }
              onClick={() =>
                setMarket("NSE")
              }
            >

              <span className="marketChoiceIcon">
                ▥
              </span>

              <div>

                <strong>
                  NSE F&O
                </strong>

                <span>
                  208 Stocks
                </span>

              </div>

            </button>


            <button
              className={
                !isNse
                  ? "marketChoice active"
                  : "marketChoice"
              }
              onClick={() =>
                setMarket("CRYPTO")
              }
            >

              <span className="marketChoiceIcon">
                ₿
              </span>

              <div>

                <strong>
                  Crypto Futures
                </strong>

                <span>
                  109 Coins
                </span>

              </div>

            </button>

          </div>


          <div className="scanControlCard">

            <div>

              <span className="scanControlLabel">
                Scanner Status
              </span>

              <strong className="scanControlStatus">

                <span
                  className={
                    isScanning
                      ? "orangeDot"
                      : "greenDot"
                  }
                />

                {
                  isScanning
                    ? "SCANNING"
                    : "READY"
                }

              </strong>


              <small>

                Last completed:{" "}

                {
                  formatDate(
                    lastCompleted
                  )
                }

              </small>

            </div>


            <button
              className="primaryScanButton"

              onClick={
                isNse
                  ? runNseScanner
                  : runCryptoScanner
              }

              disabled={
                isScanning
              }
            >

              <span>
                ▶
              </span>

              {
                isScanning
                  ? "Scanning..."
                  : isNse
                    ? "Run NSE Scanner"
                    : "Run Crypto Scanner"
              }

            </button>

          </div>

        </section>


        {/* ================================================= */}
        {/* KPI CARDS */}
        {/* ================================================= */}

        <section className="kpiGrid">


          <article className="kpiCard">

            <div className="kpiIcon blue">
              ▱
            </div>

            <div>

              <span>
                {
                  isNse
                    ? "F&O Stocks Scanned"
                    : "Crypto Coins Scanned"
                }
              </span>

              <strong>
                {totalScanned}
              </strong>

              <small>
                Current universe
              </small>

            </div>

          </article>


          <article className="kpiCard">

            <div className="kpiIcon green">
              ↗
            </div>

            <div>

              <span>
                Active Setups
              </span>

              <strong>
                {activeCount}
              </strong>

              <small>
                Across all timeframes
              </small>

            </div>

          </article>


          <article className="kpiCard">

            <div className="kpiIcon purple">
              ✓
            </div>

            <div>

              <span>
                Successful Scans
              </span>

              <strong>
                {successful}
              </strong>

              <small className="positiveText">
                {successRate}% success rate
              </small>

            </div>

          </article>


          <article className="kpiCard">

            <div className="kpiIcon red">
              !
            </div>

            <div>

              <span>
                Failed Scans
              </span>

              <strong>
                {failed}
              </strong>

              <small className="negativeText">
                {
                  totalScanned > 0
                    ? (
                        (
                          failed /
                          totalScanned
                        ) *
                        100
                      ).toFixed(1)
                    : "0.0"
                }% failure rate
              </small>

            </div>

          </article>


          <article className="kpiCard">

            <div className="kpiIcon yellow">
              ◷
            </div>

            <div>

              <span>
                Scan Duration
              </span>

              <strong>
                {
                  scanDuration > 0
                    ? `${scanDuration}s`
                    : "-"
                }
              </strong>

              <small>
                Last completed scan
              </small>

            </div>

          </article>

        </section>


        {/* ================================================= */}
        {/* FILTER BAR */}
        {/* ================================================= */}

        <section className="filterBar">


          <div className="timeframeFilters">

            {
              TIMEFRAMES.map(
                timeframe => (

                  <button

                    key={timeframe}

                    className={
                      selectedTimeframe ===
                      timeframe
                        ? "timeFilter active"
                        : "timeFilter"
                    }

                    onClick={() =>
                      setSelectedTimeframe(
                        timeframe
                      )
                    }

                  >

                    {
                      timeframe === "ALL"
                        ? "All"
                        : timeframe
                            .toUpperCase()
                    }

                  </button>

                )
              )
            }

          </div>


          <div className="searchBox">

            <span>
              ⌕
            </span>

            <input
              type="text"
              placeholder={
                isNse
                  ? "Search stock..."
                  : "Search crypto..."
              }
              value={search}
              onChange={
                event =>
                  setSearch(
                    event.target.value
                  )
              }
            />

          </div>

        </section>


        {/* ================================================= */}
        {/* RESULTS PANEL */}
        {/* ================================================= */}

        <section className="resultsPanel">


          <div className="resultsHeader">

            <div>

              <h2>
                Active Pre-Phase Setups
              </h2>

              <p>
                {
                  isNse
                    ? "NSE F&O"
                    : "Binance USDT Perpetual Futures"
                }
              </p>

            </div>


            <span className="resultsCount">

              Showing{" "}
              {filteredSetups.length}{" "}
              of{" "}
              {activeSetups.length}{" "}
              setups

            </span>

          </div>


          {/* ================================================= */}
          {/* EMPTY */}
          {/* ================================================= */}

          {
            filteredSetups.length === 0 && (

              <div className="professionalEmptyState">

                <div className="emptyCircle">
                  ↗
                </div>

                <h3>
                  No active setups found
                </h3>

                <p>

                  {
                    isScanning
                      ? "Scanner is currently processing market data."
                      : "Run the scanner or adjust the timeframe filter."
                  }

                </p>

              </div>

            )
          }


          {/* ================================================= */}
          {/* DESKTOP TABLE */}
          {/* ================================================= */}

          {
            filteredSetups.length > 0 && (

              <div className="tableWrap">

                <table className="setupTable">

                  <thead>

                    <tr>

                      <th>
                        {
                          isNse
                            ? "SYMBOL"
                            : "PAIR"
                        }
                      </th>

                      <th>
                        TIMEFRAME
                      </th>

                      <th>
                        STATUS
                      </th>

                      <th>
                        STRUCTURE
                      </th>

                      <th>
                        FLASH SELL
                      </th>

                      <th>
                        BASE CANDLES
                      </th>

                      <th>
                        SETUP AGE
                      </th>

                      {
                        isNse && (
                          <th>
                            CHART
                          </th>
                        )
                      }

                    </tr>

                  </thead>


                  <tbody>

                    {
                      filteredSetups.map(
                        (
                          setup,
                          index
                        ) => (

                          <tr
                            key={
                              `${displaySymbol(setup)}-${setup.timeframe}-${index}`
                            }
                          >

                            <td>

                              <div className="symbolBlock">

                                <strong>

                                  {
                                    displaySymbol(
                                      setup
                                    )
                                  }

                                </strong>

                                <span>

                                  {
                                    isNse
                                      ? "NSE F&O"
                                      : setup.name ||
                                        "Crypto Futures"
                                  }

                                </span>

                              </div>

                            </td>


                            <td>

                              <span
                                className={
                                  `tfBadge tf-${setup.timeframe}`
                                }
                              >

                                {
                                  setup
                                    .timeframe
                                    ?.toUpperCase()
                                }

                              </span>

                            </td>


                            <td>

                              <span className="prePhaseBadge">

                                {
                                  setup.status
                                }

                              </span>

                            </td>


                            <td>

                              <span className="structureText">

                                {
                                  displayStructure(
                                    setup
                                  )
                                }

                              </span>

                            </td>


                            <td>

                              <span className="flashValue">

                                {
                                  setup
                                    .flashSellDropPercent ??
                                  "-"
                                }

                                {
                                  setup
                                    .flashSellDropPercent !=
                                  null
                                    ? "%"
                                    : ""
                                }

                              </span>

                            </td>


                            <td>

                              {
                                setup.baseCandles ??
                                setup.baseCandlesFound ??
                                "-"
                              }

                            </td>


                            <td>

                              <span className="ageValue">

                                {
                                  setup
                                    .candlesSinceFlashSell ??
                                  "-"
                                }

                                {
                                  setup
                                    .candlesSinceFlashSell !=
                                  null
                                    ? " candles"
                                    : ""
                                }

                              </span>

                            </td>


                            {
                              isNse && (

                                <td>

                                  <button
                                    className="chartButton"
                                    onClick={() =>
                                      openChart(
                                        setup
                                      )
                                    }
                                  >

                                    ↗ View Chart

                                  </button>

                                </td>

                              )
                            }

                          </tr>

                        )
                      )
                    }

                  </tbody>

                </table>

              </div>

            )
          }


          {/* ================================================= */}
          {/* MOBILE CARDS */}
          {/* ================================================= */}

          {
            filteredSetups.length > 0 && (

              <div className="mobileSetupList">

                {
                  filteredSetups.map(
                    (
                      setup,
                      index
                    ) => (

                      <article
                        className="mobileSetupCard"
                        key={
                          `mobile-${displaySymbol(setup)}-${setup.timeframe}-${index}`
                        }
                      >

                        <div className="mobileSetupTop">

                          <div>

                            <span className="mobileMarketLabel">

                              {
                                isNse
                                  ? "NSE F&O"
                                  : "CRYPTO FUTURES"
                              }

                            </span>

                            <h3>
                              {
                                displaySymbol(
                                  setup
                                )
                              }
                            </h3>

                          </div>


                          <span className="prePhaseBadge">

                            {
                              setup.status
                            }

                          </span>

                        </div>


                        <div className="mobileSetupGrid">

                          <div>
                            <span>Timeframe</span>
                            <strong>
                              {
                                setup
                                  .timeframe
                                  ?.toUpperCase()
                              }
                            </strong>
                          </div>

                          <div>
                            <span>Flash Sell</span>
                            <strong className="flashValue">
                              {
                                setup
                                  .flashSellDropPercent ??
                                "-"
                              }
                              {
                                setup
                                  .flashSellDropPercent !=
                                null
                                  ? "%"
                                  : ""
                              }
                            </strong>
                          </div>

                          <div>
                            <span>Base</span>
                            <strong>
                              {
                                setup.baseCandles ??
                                setup.baseCandlesFound ??
                                "-"
                              }
                            </strong>
                          </div>

                          <div>
                            <span>Age</span>
                            <strong>
                              {
                                setup
                                  .candlesSinceFlashSell ??
                                "-"
                              }
                            </strong>
                          </div>

                        </div>


                        <div className="mobileStructure">

                          <span>
                            Structure
                          </span>

                          <strong>
                            {
                              displayStructure(
                                setup
                              )
                            }
                          </strong>

                        </div>


                        {
                          isNse && (

                            <button
                              className="mobileChartAction"
                              onClick={() =>
                                openChart(
                                  setup
                                )
                              }
                            >
                              View Chart
                            </button>

                          )
                        }

                      </article>

                    )
                  )
                }

              </div>

            )
          }


          <footer className="resultsFooter">

            <span>
              ↻ Auto-refreshing every 5 seconds
            </span>

          </footer>

        </section>

      </main>


      {/* ================================================= */}
      {/* CHART */}
      {/* ================================================= */}

      {
        chartSetup && (

          <ChartModal

            open={true}

            symbol={
              chartSetup.symbol
            }

            timeframe={
              chartSetup.timeframe
            }

            candles={
              chartCandles
            }

            loading={
              chartLoading
            }

            onClose={
              closeChart
            }

          />

        )
      }

    </div>

  );

}

export default App;