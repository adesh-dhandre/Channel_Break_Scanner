import {
  useEffect,
  useMemo,
  useState
} from "react";

import "./App.css";


const TIMEFRAMES = [
  "ALL",
  "5m",
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


function formatTimelineDate(value) {

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


function getLifecycle(setup) {

  const lifecycle =
    String(
      setup?.lifecycle ||
      "LIVE"
    ).toUpperCase();


  if (
    lifecycle ===
    "AGING"
  ) {

    return {
      key: "aging",
      label:
        setup?.lifecycleLabel ||
        "Aging"
    };
  }


  if (
    lifecycle ===
    "EXPIRED"
  ) {

    return {
      key: "expired",
      label:
        setup?.lifecycleLabel ||
        "Expired"
    };
  }


  if (
    lifecycle ===
    "WAITING"
  ) {

    return {
      key: "waiting",
      label:
        setup?.lifecycleLabel ||
        "Waiting"
    };
  }


  return {
    key: "live",
    label:
      setup?.lifecycleLabel ||
      "Live"
  };
}


function getAgePercent(
  setup
) {

  const current =
    Number(
      setup?.candlesSinceFlashSell
    );


  const max =
    Number(
      setup?.maxCandlesSinceFlashSell
    );


  if (
    !Number.isFinite(current) ||
    !Number.isFinite(max) ||
    max <= 0
  ) {

    return 0;
  }


  return Math.min(
    100,
    Math.max(
      0,
      (
        current /
        max
      ) *
      100
    )
  );
}


function getAgeText(
  setup
) {

  if (
    setup?.ageText
  ) {

    return setup.ageText;
  }


  const current =
    setup?.candlesSinceFlashSell;


  const max =
    setup?.maxCandlesSinceFlashSell;


  if (
    current != null &&
    max != null
  ) {

    return `${current} / ${max}`;
  }


  if (
    current != null
  ) {

    return `${current}`;
  }


  return "-";
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
          nseState?.scanning ||
          liveStatus?.nseRunning
        )
      : (
          runningCrypto ||
          cryptoStatus?.running ||
          liveStatus?.cryptoRunning
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
            nseState?.activeSetups ||
            nseState?.results ||
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
          nseLiveStats.scannedStocks ??
          nseState?.scannedStocks ??
          nseState?.stats?.scannedStocks ??
          0
        )
      : (
          cryptoLiveStats.scannedCoins ??
          cryptoStatus?.stats?.scannedCoins ??
          0
        );


  const successful =
    isNse
      ? (
          nseLiveStats.successfulStocks ??
          nseState?.successfulStocks ??
          nseState?.stats?.successfulStocks ??
          0
        )
      : (
          cryptoLiveStats.successfulCoins ??
          cryptoStatus?.stats?.successfulCoins ??
          0
        );


  const failed =
    isNse
      ? (
          nseLiveStats.failedStocks ??
          nseState?.failedStocks ??
          nseState?.stats?.failedStocks ??
          0
        )
      : (
          cryptoLiveStats.failedCoins ??
          cryptoStatus?.stats?.failedCoins ??
          0
        );


  const scanDuration =
    isNse
      ? (
          nseLiveStats.scanDurationSeconds ??
          nseState?.scanDurationSeconds ??
          0
        )
      : (
          cryptoLiveStats.scanDurationSeconds ??
          cryptoStatus?.stats?.scanDurationSeconds ??
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
          liveStatus?.lastNseCompletedAt ||
          nseState?.completedAt
        )
      : (
          liveStatus?.lastCryptoCompletedAt ||
          cryptoStatus?.completedAt
        );


  // ====================================================
  // RENDER
  // ====================================================

  return (

    <div className="dashboardShell">

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
              Fresh pre-phase setups with lifecycle,
              timeline and channel context.
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


          {
            filteredSetups.length > 0 && (

              <div className="setupCardsGrid">

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


                      const lifecycle =
                        getLifecycle(
                          setup
                        );


                      const agePercent =
                        getAgePercent(
                          setup
                        );


                      const mainName =
                        isNse
                          ? String(
                              setup.symbol ||
                              "-"
                            ).replace(
                              /\.NS$/i,
                              ""
                            )
                          : coin.name;


                      const subName =
                        isNse
                          ? `${mainName} · NSE F&O`
                          : `${coin.symbol} · ${setup.tradingPair || `${coin.symbol}USDT`}`;


                      const detectedTime =
                        setup.prePhaseConfirmedAt ||
                        setup.detectedAt ||
                        setup.baseConfirmedAt ||
                        null;


                      return (

                        <article
                          className="setupLifecycleCard"

                          key={
                            `${displaySymbol(setup)}-${setup.timeframe}-${setup.flashSellAt || setup.flashSellDate || index}`
                          }
                        >

                          <div className="setupCardHeader">

                            <div className="setupIdentityRow">

                              {
                                !isNse && (

                                  <div className="coinBadge">
                                    {
                                      coin.badge
                                    }
                                  </div>

                                )
                              }


                              <div>

                                <h3>
                                  {mainName}
                                </h3>

                                <span className="setupSubName">
                                  {subName}
                                </span>

                              </div>

                            </div>


                            <div className="setupBadgeStack">

                              <span
                                className={
                                  `lifecycleBadge ${lifecycle.key}`
                                }
                              >
                                <span className="lifecycleDot" />
                                {
                                  lifecycle.label
                                }
                              </span>

                              <div className="setupMiniBadges">

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

                                <span className="prePhaseBadge">
                                  {
                                    setup.status
                                  }
                                </span>

                              </div>

                            </div>

                          </div>


                          <div className="timeline">

                            <div className="timelineStep">

                              <span className="timelineTime">
                                {
                                  formatTimelineDate(
                                    setup.flashSellAt ||
                                    setup.flashSellDate
                                  )
                                }
                              </span>

                              <div className="timelineNode flash">
                                ↓
                              </div>

                              <strong>
                                FLASH SELL
                              </strong>

                              <small className="timelineValue negative">
                                {
                                  setup.flashSellDropPercent != null
                                    ? `-${Number(setup.flashSellDropPercent).toFixed(2)}%`
                                    : "-"
                                }
                              </small>

                            </div>


                            <div className="timelineConnector">
                              →
                            </div>


                            <div className="timelineStep">

                              <span className="timelineTime">
                                {
                                  formatTimelineDate(
                                    setup.baseStartedAt
                                  )
                                }
                              </span>

                              <div className="timelineNode base">
                                ◇
                              </div>

                              <strong>
                                {
                                  setup.baseType ||
                                  "BASE"
                                }
                              </strong>

                              <small>
                                Base candle
                              </small>

                            </div>


                            <div className="timelineConnector">
                              →
                            </div>


                            <div className="timelineStep">

                              <span className="timelineTime">
                                {
                                  formatTimelineDate(
                                    detectedTime
                                  )
                                }
                              </span>

                              <div className="timelineNode detected">
                                ✓
                              </div>

                              <strong>
                                DETECTED
                              </strong>

                              <small>
                                Pre-phase confirmed
                              </small>

                            </div>

                          </div>


                          <div className="ageSection">

                            <div className="ageHeader">

                              <span>
                                Setup age
                              </span>

                              <strong>
                                {
                                  getAgeText(
                                    setup
                                  )
                                } candles
                              </strong>

                            </div>


                            <div className="ageTrack">

                              <div
                                className={
                                  `ageFill ${lifecycle.key}`
                                }

                                style={{
                                  width:
                                    `${agePercent}%`
                                }}
                              />

                            </div>

                          </div>


                          <div className="setupContextRow">

                            <div>

                              <span className="contextIcon">
                                ↗
                              </span>

                              <div>

                                <strong>
                                  {
                                    displayStructure(
                                      setup
                                    )
                                  }
                                </strong>

                                <small>
                                  Base confirmed after lower-channel break
                                </small>

                              </div>

                            </div>


                            <div className="contextStats">

                              {
                                setup.channelRespectRatio != null && (

                                  <span>
                                    Respect{" "}
                                    <strong>
                                      {
                                        Math.round(
                                          setup.channelRespectRatio *
                                          100
                                        )
                                      }%
                                    </strong>
                                  </span>

                                )
                              }


                              {
                                setup.baseCandlesFound != null && (

                                  <span>
                                    Base candles{" "}
                                    <strong>
                                      {
                                        setup.baseCandlesFound
                                      }
                                    </strong>
                                  </span>

                                )
                              }

                            </div>

                          </div>


                          <div className="setupCardFooter">

                            <span>
                              Last seen{" "}
                              {
                                formatTimelineDate(
                                  setup.lastSeenAt
                                )
                              }
                            </span>

                            {
                              setup.baseConfirmedAt && (

                                <span>
                                  Base confirmed{" "}
                                  {
                                    formatTimelineDate(
                                      setup.baseConfirmedAt
                                    )
                                  }
                                </span>

                              )
                            }

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