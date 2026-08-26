import {
  useEffect,
  useMemo,
  useState
} from "react";

import "./App.css";


const TIMEFRAMES = [
  "ALL",
  "15m",
  "30m",
  "45m",
  "1h",
  "2h"
];


// ======================================================
// POPULAR CRYPTO DISPLAY DATA
// ======================================================

const COIN_INFO = {

  BTC: {
    name: "Bitcoin",
    badge: "₿"
  },

  ETH: {
    name: "Ethereum",
    badge: "Ξ"
  },

  SOL: {
    name: "Solana",
    badge: "S"
  },

  BNB: {
    name: "BNB",
    badge: "B"
  },

  XRP: {
    name: "XRP",
    badge: "X"
  },

  DOGE: {
    name: "Dogecoin",
    badge: "Ð"
  },

  ADA: {
    name: "Cardano",
    badge: "A"
  },

  AVAX: {
    name: "Avalanche",
    badge: "A"
  },

  LINK: {
    name: "Chainlink",
    badge: "L"
  },

  DOT: {
    name: "Polkadot",
    badge: "D"
  },

  LTC: {
    name: "Litecoin",
    badge: "Ł"
  },

  BCH: {
    name: "Bitcoin Cash",
    badge: "B"
  },

  TRX: {
    name: "TRON",
    badge: "T"
  },

  TON: {
    name: "Toncoin",
    badge: "T"
  },

  STX: {
    name: "Stacks",
    badge: "S"
  }

};


// ======================================================
// HELPERS
// ======================================================

function cleanCryptoSymbol(setup) {

  if (setup?.symbol) {

    return String(
      setup.symbol
    )
      .replace(/\.NS$/i, "")
      .toUpperCase();

  }


  const pair =
    String(
      setup?.tradingPair || ""
    ).toUpperCase();


  if (
    pair.endsWith("USDT")
  ) {

    return pair.slice(
      0,
      -4
    );
  }


  return pair || "UNKNOWN";
}


function displaySymbol(setup) {

  if (!setup) {
    return "-";
  }


  if (
    setup.tradingPair
  ) {

    return setup.tradingPair;
  }


  return String(
    setup.symbol || "-"
  ).replace(
    /\.NS$/i,
    ""
  );
}


function getCoinInfo(setup) {

  const symbol =
    cleanCryptoSymbol(
      setup
    );


  const known =
    COIN_INFO[
      symbol
    ];


  if (known) {

    return {
      symbol,
      name:
        known.name,
      badge:
        known.badge
    };
  }


  return {

    symbol,

    name:
      setup?.name &&
      setup.name !== symbol
        ? setup.name
        : `${symbol} Futures`,

    badge:
      symbol
        .charAt(0)
        .toUpperCase() ||
      "◆"

  };
}


function displayStructure(setup) {

  if (
    setup?.uptrendScenario
  ) {

    return setup
      .uptrendScenario;
  }


  return "Ascending Channel";
}


function formatDate(value) {

  if (!value) {
    return "-";
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "-";
  }


  return new Intl.DateTimeFormat(
    "en-IN",
    {
      timeZone:
        "Asia/Kolkata",

      day:
        "2-digit",

      month:
        "short",

      hour:
        "2-digit",

      minute:
        "2-digit",

      hour12:
        true
    }
  ).format(
    date
  );
}


function getSetupFreshness(
  setup
) {

  const age =
    Number(
      setup?.candlesSinceFlashSell
    );


  if (
    Number.isFinite(age) &&
    age <= 1
  ) {

    return {
      label: "Very Fresh",
      className: "fresh"
    };
  }


  if (
    Number.isFinite(age) &&
    age <= 3
  ) {

    return {
      label: "Fresh Setup",
      className: "fresh"
    };
  }


  return {
    label: "Active Setup",
    className: "active"
  };
}


// ======================================================
// APP
// ======================================================

function App() {

  const [
    market,
    setMarket
  ] =
    useState(
      "NSE"
    );


  const [
    nseState,
    setNseState
  ] =
    useState(
      null
    );


  const [
    cryptoStatus,
    setCryptoStatus
  ] =
    useState(
      null
    );


  const [
    cryptoResults,
    setCryptoResults
  ] =
    useState(
      []
    );


  const [
    liveStatus,
    setLiveStatus
  ] =
    useState(
      null
    );


  const [
    liveResults,
    setLiveResults
  ] =
    useState({

      nse: {
        count: 0,
        results: []
      },

      crypto: {
        count: 0,
        results: []
      }

    });


  const [
    selectedTimeframe,
    setSelectedTimeframe
  ] =
    useState(
      "ALL"
    );


  const [
    search,
    setSearch
  ] =
    useState(
      ""
    );


  const [
    loading,
    setLoading
  ] =
    useState(
      true
    );


  const [
    runningNse,
    setRunningNse
  ] =
    useState(
      false
    );


  const [
    runningCrypto,
    setRunningCrypto
  ] =
    useState(
      false
    );


  const [
    error,
    setError
  ] =
    useState(
      ""
    );


  // ====================================================
  // API LOADERS
  // ====================================================

  async function fetchNseStatus() {

    try {

      const response =
        await fetch(
          "/api/scanner/status"
        );


      if (!response.ok) {
        return;
      }


      const result =
        await response.json();


      setNseState(
        result.data ||
        result
      );


    } catch (err) {

      console.error(
        err
      );

    }
  }


  async function fetchCryptoStatus() {

    try {

      const response =
        await fetch(
          "/api/crypto/status"
        );


      if (!response.ok) {
        return;
      }


      const result =
        await response.json();


      setCryptoStatus(
        result
      );


    } catch (err) {

      console.error(
        err
      );

    }
  }


  async function fetchCryptoResults() {

    try {

      const response =
        await fetch(
          "/api/crypto/results"
        );


      if (!response.ok) {
        return;
      }


      const result =
        await response.json();


      setCryptoResults(
        result.results ||
        []
      );


    } catch (err) {

      console.error(
        err
      );

    }
  }


  async function fetchLiveStatus() {

    try {

      const response =
        await fetch(
          "/api/live/status"
        );


      if (!response.ok) {
        return;
      }


      const result =
        await response.json();


      setLiveStatus(
        result
      );


    } catch (err) {

      console.error(
        err
      );

    }
  }


  async function fetchLiveResults() {

    try {

      const response =
        await fetch(
          "/api/live/results"
        );


      if (!response.ok) {
        return;
      }


      const result =
        await response.json();


      setLiveResults({

        nse:
          result.nse || {
            count: 0,
            results: []
          },

        crypto:
          result.crypto || {
            count: 0,
            results: []
          }

      });


    } catch (err) {

      console.error(
        err
      );

    }
  }


  // ====================================================
  // REFRESH
  // ====================================================

  async function refreshAll() {

    try {

      await Promise.all([

        fetchNseStatus(),

        fetchCryptoStatus(),

        fetchCryptoResults(),

        fetchLiveStatus(),

        fetchLiveResults()

      ]);


      setError("");


    } catch (err) {

      console.error(
        err
      );


      setError(
        "Unable to connect to scanner backend."
      );


    } finally {

      setLoading(
        false
      );

    }
  }


  // ====================================================
  // MANUAL NSE SCAN
  // ====================================================

  async function runNseScanner() {

    if (
      runningNse ||
      nseState?.scanning ||
      liveStatus?.nseRunning
    ) {

      return;
    }


    try {

      setRunningNse(
        true
      );

      setError("");


      const response =
        await fetch(
          "/api/scanner/run",
          {
            method:
              "POST"
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


      await refreshAll();


    } catch (err) {

      console.error(
        err
      );


      setError(
        err.message
      );


    } finally {

      setRunningNse(
        false
      );

    }
  }


  // ====================================================
  // MANUAL CRYPTO SCAN
  // ====================================================

  async function runCryptoScanner() {

    if (
      runningCrypto ||
      cryptoStatus?.running ||
      liveStatus?.cryptoRunning
    ) {

      return;
    }


    try {

      setRunningCrypto(
        true
      );

      setError("");


      const response =
        await fetch(
          "/api/crypto/scan",
          {
            method:
              "POST"
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


      await refreshAll();


    } catch (err) {

      console.error(
        err
      );


      setError(
        err.message
      );


    } finally {

      setRunningCrypto(
        false
      );

    }
  }


  // ====================================================
  // POLLING
  // ====================================================

  useEffect(
    () => {

      refreshAll();


      const timer =
        setInterval(
          refreshAll,
          5000
        );


      return () =>
        clearInterval(
          timer
        );

    },
    []
  );


  // ====================================================
  // CURRENT MARKET
  // ====================================================

  const isNse =
    market ===
    "NSE";


  const isScanning =
    isNse
      ? (
          runningNse ||
          nseState
            ?.scanning ||
          liveStatus
            ?.nseRunning
        )
      : (
          runningCrypto ||
          cryptoStatus
            ?.running ||
          liveStatus
            ?.cryptoRunning
        );


  // ====================================================
  // ACTIVE SETUPS
  // ====================================================

  const activeSetups =
    useMemo(
      () => {

        if (isNse) {

          const live =
            liveResults
              ?.nse
              ?.results;


          if (
            Array.isArray(
              live
            ) &&
            live.length > 0
          ) {

            return live;
          }


          return (
            nseState
              ?.activeSetups ||
            nseState
              ?.results ||
            []
          );
        }


        const live =
          liveResults
            ?.crypto
            ?.results;


        if (
          Array.isArray(
            live
          ) &&
          live.length > 0
        ) {

          return live;
        }


        return (
          cryptoResults ||
          []
        );

      },
      [
        isNse,
        nseState,
        cryptoResults,
        liveResults
      ]
    );


  // ====================================================
  // FILTERED SETUPS
  // ====================================================

  const filteredSetups =
    useMemo(
      () => {

        const query =
          search
            .trim()
            .toLowerCase();


        return activeSetups.filter(
          setup => {

            const timeframeMatch =
              selectedTimeframe ===
                "ALL" ||
              setup.timeframe ===
                selectedTimeframe;


            const coin =
              getCoinInfo(
                setup
              );


            const searchable =
              [
                setup.symbol,
                setup.tradingPair,
                setup.name,
                coin.symbol,
                coin.name
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();


            const searchMatch =
              !query ||
              searchable.includes(
                query
              );


            return (
              timeframeMatch &&
              searchMatch
            );

          }
        );

      },
      [
        activeSetups,
        search,
        selectedTimeframe
      ]
    );


  // ====================================================
  // KPI DATA
  // ====================================================

  const nseLiveStats =
    liveStatus
      ?.lastNseResult ||
    {};


  const cryptoLiveStats =
    liveStatus
      ?.lastCryptoResult ||
    {};


  const totalScanned =
    isNse
      ? (
          nseLiveStats
            .scannedStocks ??
          nseState
            ?.scannedStocks ??
          nseState
            ?.stats
            ?.scannedStocks ??
          0
        )
      : (
          cryptoLiveStats
            .scannedCoins ??
          cryptoStatus
            ?.stats
            ?.scannedCoins ??
          0
        );


  const successful =
    isNse
      ? (
          nseLiveStats
            .successfulStocks ??
          nseState
            ?.successfulStocks ??
          nseState
            ?.stats
            ?.successfulStocks ??
          0
        )
      : (
          cryptoLiveStats
            .successfulCoins ??
          cryptoStatus
            ?.stats
            ?.successfulCoins ??
          0
        );


  const failed =
    isNse
      ? (
          nseLiveStats
            .failedStocks ??
          nseState
            ?.failedStocks ??
          nseState
            ?.stats
            ?.failedStocks ??
          0
        )
      : (
          cryptoLiveStats
            .failedCoins ??
          cryptoStatus
            ?.stats
            ?.failedCoins ??
          0
        );


  const scanDuration =
    isNse
      ? (
          nseLiveStats
            .scanDurationSeconds ??
          nseState
            ?.scanDurationSeconds ??
          0
        )
      : (
          cryptoLiveStats
            .scanDurationSeconds ??
          cryptoStatus
            ?.stats
            ?.scanDurationSeconds ??
          0
        );


  const activeCount =
    activeSetups.length;


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


  const lastCompleted =
    isNse
      ? (
          liveStatus
            ?.lastNseCompletedAt ||
          nseState
            ?.completedAt
        )
      : (
          liveStatus
            ?.lastCryptoCompletedAt ||
          cryptoStatus
            ?.completedAt
        );


  // ====================================================
  // RENDER
  // ====================================================

  return (

    <div className="dashboardShell">


      {/* ================================================= */}
      {/* SIDEBAR */}
      {/* ================================================= */}

      <aside className="sidebar">

        <div>

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
              ◫ Dashboard
            </button>

            <button className="sideNavItem selected">
              ◉ Live Scanner
            </button>

            <button className="sideNavItem">
              ◷ Signal Monitor
            </button>

          </nav>

        </div>


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
        {/* MARKET CONTROL */}
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
                setMarket(
                  "NSE"
                )
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
                  {
                    isNse &&
                    totalScanned > 0
                      ? `${totalScanned} Stocks`
                      : "F&O Stocks"
                  }
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
                setMarket(
                  "CRYPTO"
                )
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
                  {
                    !isNse &&
                    totalScanned > 0
                      ? `${totalScanned} Contracts`
                      : "USDT Perpetuals"
                  }
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
                isScanning ||
                loading
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
        {/* KPI */}
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
                    : "Futures Contracts"
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
        {/* FILTER */}
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
                      timeframe ===
                      "ALL"
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
                  : "Search symbol or pair..."
              }

              value={
                search
              }

              onChange={
                event =>
                  setSearch(
                    event
                      .target
                      .value
                  )
              }
            />

          </div>

        </section>


        {/* ================================================= */}
        {/* RESULTS */}
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
                      : "Waiting for a fresh channel-break setup."
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
                            : "COIN"
                        }
                      </th>

                      {
                        !isNse && (
                          <th>
                            PAIR
                          </th>
                        )
                      }

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
                        BASE
                      </th>

                      <th>
                        AGE
                      </th>

                      <th>
                        QUICK INFO
                      </th>

                    </tr>

                  </thead>


                  <tbody>

                    {
                      filteredSetups.map(
                        (
                          setup,
                          index
                        ) => {

                          const coin =
                            getCoinInfo(
                              setup
                            );


                          const freshness =
                            getSetupFreshness(
                              setup
                            );


                          return (

                            <tr
                              key={
                                `${displaySymbol(setup)}-${setup.timeframe}-${index}`
                              }
                            >

                              <td>

                                {
                                  isNse ? (

                                    <div className="symbolBlock">

                                      <strong>
                                        {
                                          String(
                                            setup.symbol ||
                                            "-"
                                          ).replace(
                                            /\.NS$/i,
                                            ""
                                          )
                                        }
                                      </strong>

                                      <span>
                                        NSE F&O
                                      </span>

                                    </div>

                                  ) : (

                                    <div className="coinIdentity">

                                      <div className="coinBadge">
                                        {
                                          coin.badge
                                        }
                                      </div>

                                      <div className="symbolBlock">

                                        <strong>
                                          {
                                            coin.name
                                          }
                                        </strong>

                                        <span>
                                          {
                                            coin.symbol
                                          }
                                        </span>

                                      </div>

                                    </div>

                                  )
                                }

                              </td>


                              {
                                !isNse && (

                                  <td>

                                    <div className="pairBlock">

                                      <strong>
                                        {
                                          setup.tradingPair ||
                                          `${coin.symbol}USDT`
                                        }
                                      </strong>

                                      <span>
                                        Perpetual
                                      </span>

                                    </div>

                                  </td>

                                )
                              }


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

                                <span className="baseValue">

                                  {
                                    setup.baseCandles ??
                                    setup.baseCandlesFound ??
                                    "-"
                                  }

                                </span>

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


                              <td>

                                <div className="quickInfo">

                                  <span
                                    className={
                                      `quickInfoStatus ${freshness.className}`
                                    }
                                  >
                                    ⚡ {
                                      freshness.label
                                    }
                                  </span>

                                  <small>

                                    {
                                      setup.baseCandles > 0 ||
                                      setup.baseCandlesFound > 0
                                        ? "Base confirmed after channel break"
                                        : "Watching post-break structure"
                                    }

                                  </small>

                                </div>

                              </td>

                            </tr>

                          );

                        }
                      )
                    }

                  </tbody>

                </table>

              </div>

            )
          }


          {/* ================================================= */}
          {/* MOBILE */}
          {/* ================================================= */}

          {
            filteredSetups.length > 0 && (

              <div className="mobileSetupList">

                {
                  filteredSetups.map(
                    (
                      setup,
                      index
                    ) => {

                      const coin =
                        getCoinInfo(
                          setup
                        );


                      const freshness =
                        getSetupFreshness(
                          setup
                        );


                      return (

                        <article
                          className="mobileSetupCard"

                          key={
                            `mobile-${displaySymbol(setup)}-${setup.timeframe}-${index}`
                          }
                        >

                          <div className="mobileSetupTop">

                            <div className="mobileCoinHeading">

                              {
                                !isNse && (

                                  <div className="coinBadge mobile">
                                    {
                                      coin.badge
                                    }
                                  </div>

                                )
                              }

                              <div>

                                <span className="mobileMarketLabel">

                                  {
                                    isNse
                                      ? "NSE F&O"
                                      : setup.tradingPair ||
                                        `${coin.symbol}USDT`
                                  }

                                </span>

                                <h3>

                                  {
                                    isNse
                                      ? String(
                                          setup.symbol ||
                                          "-"
                                        ).replace(
                                          /\.NS$/i,
                                          ""
                                        )
                                      : coin.name
                                  }

                                </h3>

                                {
                                  !isNse && (

                                    <span className="mobileCoinSymbol">
                                      {coin.symbol}
                                    </span>

                                  )
                                }

                              </div>

                            </div>


                            <span className="prePhaseBadge">
                              {
                                setup.status
                              }
                            </span>

                          </div>


                          <div className="mobileSetupGrid">

                            <div>

                              <span>
                                Timeframe
                              </span>

                              <strong>
                                {
                                  setup
                                    .timeframe
                                    ?.toUpperCase()
                                }
                              </strong>

                            </div>


                            <div>

                              <span>
                                Flash Sell
                              </span>

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

                              <span>
                                Base
                              </span>

                              <strong>

                                {
                                  setup.baseCandles ??
                                  setup.baseCandlesFound ??
                                  "-"
                                }

                              </strong>

                            </div>


                            <div>

                              <span>
                                Age
                              </span>

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


                          <div className="mobileQuickInfo">

                            <span
                              className={
                                `quickInfoStatus ${freshness.className}`
                              }
                            >

                              ⚡ {
                                freshness.label
                              }

                            </span>

                            <small>

                              {
                                setup.baseCandles > 0 ||
                                setup.baseCandlesFound > 0
                                  ? "Base confirmed after channel break"
                                  : "Watching post-break structure"
                              }

                            </small>

                          </div>

                        </article>

                      );

                    }
                  )
                }

              </div>

            )
          }


          <footer className="resultsFooter">

            <span>
              ↻ Dashboard refreshes every 5 seconds
            </span>

          </footer>

        </section>

      </main>

    </div>

  );

}


export default App;