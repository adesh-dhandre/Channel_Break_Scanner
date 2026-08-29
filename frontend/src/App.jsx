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
  },

  GMX: {
    name: "GMX",
    badge: "G"
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
      .replace(
        /\.NS$/i,
        ""
      )
      .toUpperCase();
  }


  const pair =
    String(
      setup?.tradingPair ||
      ""
    )
      .toUpperCase();


  if (
    pair.endsWith(
      "USDT"
    )
  ) {

    return pair.slice(
      0,
      -4
    );
  }


  return (
    pair ||
    "UNKNOWN"
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

  return (
    setup?.uptrendScenario ||
    "Ascending Channel"
  );
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


function getLifecycle(setup) {

  const lifecycle =
    String(
      setup?.lifecycle ||
      "LIVE"
    )
      .toUpperCase();


  if (
    lifecycle ===
    "AGING"
  ) {

    return {

      key:
        "aging",

      label:
        setup?.lifecycleLabel ||
        "AGING"

    };
  }


  if (
    lifecycle ===
    "EXPIRED"
  ) {

    return {

      key:
        "expired",

      label:
        setup?.lifecycleLabel ||
        "EXPIRED"

    };
  }


  if (
    lifecycle ===
    "WAITING"
  ) {

    return {

      key:
        "waiting",

      label:
        setup?.lifecycleLabel ||
        "WAITING"

    };
  }


  return {

    key:
      "live",

    label:
      setup?.lifecycleLabel ||
      "LIVE"

  };
}


function getAgePercent(setup) {

  const current =
    Number(
      setup
        ?.candlesSinceFlashSell
    );


  const max =
    Number(
      setup
        ?.maxCandlesSinceFlashSell
    );


  if (
    !Number.isFinite(
      current
    ) ||
    !Number.isFinite(
      max
    ) ||
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


function getAgeText(setup) {

  if (setup?.ageText) {

    return setup.ageText;
  }


  const current =
    setup
      ?.candlesSinceFlashSell;


  const max =
    setup
      ?.maxCandlesSinceFlashSell;


  if (
    current != null &&
    max != null
  ) {

    return `${current} / ${max}`;
  }


  return (
    current != null
      ? String(
          current
        )
      : "-"
  );
}


// ======================================================
// APP
// ======================================================

function App() {

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
    useState(
      []
    );


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
    error,
    setError
  ] =
    useState(
      ""
    );


  const [
    scanStarting,
    setScanStarting
  ] =
    useState(
      false
    );


  const [
    scanMessage,
    setScanMessage
  ] =
    useState(
      ""
    );


  // ====================================================
  // STATUS
  // ====================================================

  async function fetchLiveStatus() {

    const response =
      await fetch(
        "/api/live/status",
        {
          cache:
            "no-store"
        }
      );


    if (!response.ok) {

      throw new Error(
        "Unable to load scanner status."
      );
    }


    const result =
      await response.json();


    setLiveStatus(
      result
    );
  }


  // ====================================================
  // RESULTS
  // ====================================================

  async function fetchLiveResults() {

    const response =
      await fetch(
        `/api/live/results?_=${Date.now()}`,
        {
          cache:
            "no-store"
        }
      );


    if (!response.ok) {

      throw new Error(
        "Unable to load live scanner results."
      );
    }


    const result =
      await response.json();


    const currentResults =
      Array.isArray(
        result
          ?.crypto
          ?.results
      )
        ? result.crypto.results
        : [];


    setLiveResults(
      currentResults
    );
  }


  // ====================================================
  // REFRESH
  // ====================================================

  async function refreshAll() {

    try {

      await Promise.all([

        fetchLiveStatus(),

        fetchLiveResults()

      ]);


      setError(
        ""
      );


    } catch (err) {

      console.error(
        err
      );


      setError(
        err.message ||
        "Unable to connect to scanner."
      );


    } finally {

      setLoading(
        false
      );
    }
  }


  // ====================================================
  // MANUAL CRYPTO SCAN
  // ====================================================

  async function triggerManualScan() {

    if (
      scanStarting ||
      liveStatus
        ?.cryptoRunning
    ) {

      return;
    }


    try {

      setScanStarting(
        true
      );


      setScanMessage(
        "Preparing the voyage..."
      );


      const response =
        await fetch(
          "/api/live/manual-trigger",
          {

            method:
              "POST",

            headers: {

              "Content-Type":
                "application/json"

            }

          }
        );


      const result =
        await response.json();


      if (!response.ok) {

        throw new Error(
          result?.error ||
          result?.message ||
          "Unable to start scanner."
        );
      }


      if (
        result?.alreadyRunning
      ) {

        setScanMessage(
          "The crew is already scanning."
        );

      } else {

        setScanMessage(
          "Voyage started. Scanning crypto seas."
        );

      }


      await refreshAll();


    } catch (err) {

      console.error(
        err
      );


      setScanMessage(
        err.message ||
        "Unable to start scanner."
      );


    } finally {

      setScanStarting(
        false
      );


      setTimeout(
        () => {

          setScanMessage(
            ""
          );

        },
        4000
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
  // FILTER
  // ====================================================

  const filteredSetups =
    useMemo(
      () => {

        const query =
          search
            .trim()
            .toLowerCase();


        return liveResults.filter(
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
                .filter(
                  Boolean
                )
                .join(
                  " "
                )
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
        liveResults,
        search,
        selectedTimeframe
      ]
    );


  // ====================================================
  // STATUS DATA
  // ====================================================

  const cryptoStats =
    liveStatus
      ?.lastCryptoResult ||
    {};


  const cryptoRunning =
    liveStatus
      ?.cryptoRunning ===
    true;


  const totalScanned =
    cryptoStats
      ?.scannedCoins ||
    0;


  const successful =
    cryptoStats
      ?.successfulCoins ||
    0;


  const failed =
    cryptoStats
      ?.failedCoins ||
    0;


  const scanDuration =
    cryptoStats
      ?.scanDurationSeconds ||
    0;


  const lastCompleted =
    liveStatus
      ?.lastCryptoCompletedAt ||
    null;


  const activeCount =
    liveResults.length;


  const scannerHealthy =
    !liveStatus
      ?.lastCryptoError;


  // ====================================================
  // UI
  // ====================================================

  return (

    <div className="grandLineApp">

      <div className="oceanBackground">

        <span className="wave waveOne" />

        <span className="wave waveTwo" />

        <span className="wave waveThree" />

      </div>


      <div className="mapGrid" />


      <div className="floatingCompass compassOne">
        ✦
      </div>


      <div className="floatingCompass compassTwo">
        ✧
      </div>


      {/* =================================================
          SIDEBAR
      ================================================= */}

      <aside className="grandSidebar">

        <div>

          <div className="pirateBrand">

            <div className="strawHatLogo">

              <div className="hatTop" />

              <div className="hatBand" />

              <div className="hatBrim" />

            </div>


            <div className="brandText">

              <span>
                GRAND LINE
              </span>

              <strong>
                CHANNEL SCANNER
              </strong>

            </div>

          </div>


          <div className="sidebarRope" />


          <section className="parchmentBlock">

            <span className="parchmentPin">
              ☸
            </span>

            <strong>
              MARKET
            </strong>

          </section>


          <div className="marketRoute active">

            <span className="routeIcon">
              ₿
            </span>


            <div>

              <strong>
                Crypto Futures
              </strong>

              <small>
                Live scanning
              </small>

            </div>


            <span className="routeLiveDot" />

          </div>


          <div className="marketRoute disabled">

            <span className="routeIcon">
              NSE
            </span>


            <div>

              <strong>
                NSE F&O
              </strong>

              <small>
                Temporarily offline
              </small>

            </div>


            <span className="routeOfflineDot" />

          </div>


          <section className="parchmentBlock secondary">

            <span className="parchmentPin">
              ☠
            </span>

            <strong>
              CHANNEL BREAK
            </strong>

          </section>


          <div className="scannerRoute">

            <span>
              ⚔
            </span>

            <strong>
              Scanner
            </strong>

          </div>

        </div>


        <div className="sidebarBottom">

          <section className="parchmentBlock systemTitle">

            <span className="parchmentPin">
              ⚙
            </span>

            <strong>
              SYSTEM
            </strong>

          </section>


          <div className="systemHealth">

            <span
              className={
                scannerHealthy
                  ? "healthPulse"
                  : "healthPulse danger"
              }
            />


            <div>

              <span>
                STATUS
              </span>

              <strong>

                {
                  scannerHealthy
                    ? "Operational"
                    : "Attention Required"
                }

              </strong>

            </div>

          </div>


          <div className="pirateSilhouette">

            <span>
              ☠
            </span>

            <strong>
              TO THE GRAND LINE
            </strong>

          </div>


          <small className="copyright">
            © 2026 Grand Line Scanner
          </small>

        </div>

      </aside>


      {/* =================================================
          MAIN
      ================================================= */}

      <main className="grandMain">

        {/* ===============================================
            HERO
        =============================================== */}

        <header className="grandHero">

          <div className="heroCopy">

            <span className="heroEyebrow">
              CHANNEL BREAK SCANNER
            </span>


            <h1>
              SET SAIL FOR{" "}
              <span>
                OPPORTUNITIES
              </span>
            </h1>


            <p>

              The crypto seas never sleep.
              Our scanner watches every wave,
              searching for fresh PRE_PHASE setups.

            </p>


            <div className="heroCoordinates">

              <span>
                ☸ Binance Futures
              </span>

              <span>
                ⚓ 24 / 7 Market
              </span>

              <span>
                ✦ IST Time
              </span>

            </div>

          </div>


          <div className="heroControls">

            <div
              className={
                cryptoRunning
                  ? "liveWantedCard scanning"
                  : "liveWantedCard"
              }
            >

              <span className="wantedLabel">
                LIVE STATUS
              </span>


              <div className="wantedSkull">
                ☠
              </div>


              <strong>

                {
                  cryptoRunning
                    ? "SCANNING"
                    : "READY"
                }

              </strong>


              <small>

                {
                  cryptoRunning
                    ? "Searching the seas..."
                    : "The seas are clear"
                }

              </small>

            </div>


            <button
              type="button"
              className={
                cryptoRunning ||
                scanStarting
                  ? "pirateScanButton scanning"
                  : "pirateScanButton"
              }
              disabled={
                cryptoRunning ||
                scanStarting
              }
              onClick={
                triggerManualScan
              }
            >

              <span className="scanButtonShine" />


              <span className="scanHatIcon">

                {
                  cryptoRunning
                    ? "☸"
                    : "⚓"
                }

              </span>


              <span>

                <strong>

                  {
                    cryptoRunning
                      ? "SCANNING"
                      : scanStarting
                        ? "PREPARING"
                        : "SCAN NOW"
                  }

                </strong>

                <small>

                  {
                    cryptoRunning
                      ? "Voyage in progress"
                      : "Begin the voyage"
                  }

                </small>

              </span>

            </button>

          </div>

        </header>


        {/* ===============================================
            TOAST
        =============================================== */}

        {
          scanMessage && (

            <div className="pirateToast">

              <span>
                ⚓
              </span>

              {scanMessage}

            </div>

          )
        }


        {
          error && (

            <div className="grandError">

              <strong>
                Storm detected
              </strong>

              <span>
                {error}
              </span>

            </div>

          )
        }


        {/* ===============================================
            METRICS
        =============================================== */}

        <section className="treasureMetrics">

          <article className="treasureMetric">

            <div className="metricIcon">
              ☠
            </div>


            <div>

              <span>
                ACTIVE SETUPS
              </span>

              <strong>
                {activeCount}
              </strong>

              <small>
                Live opportunities
              </small>

            </div>

          </article>


          <article className="treasureMetric">

            <div className="metricIcon">
              ⚓
            </div>


            <div>

              <span>
                TOTAL SCANNED
              </span>

              <strong>
                {totalScanned}
              </strong>

              <small>
                Futures contracts
              </small>

            </div>

          </article>


          <article className="treasureMetric">

            <div className="metricIcon">
              ✓
            </div>


            <div>

              <span>
                SUCCESSFUL
              </span>

              <strong>
                {successful}
              </strong>

              <small>
                Last voyage
              </small>

            </div>

          </article>


          <article className="treasureMetric">

            <div className="metricIcon danger">
              ×
            </div>


            <div>

              <span>
                FAILED
              </span>

              <strong>
                {failed}
              </strong>

              <small>
                Contracts
              </small>

            </div>

          </article>


          <article className="treasureMetric">

            <div className="metricIcon">
              ⏱
            </div>


            <div>

              <span>
                SCAN TIME
              </span>

              <strong>

                {
                  scanDuration
                    ? `${scanDuration}s`
                    : "-"
                }

              </strong>

              <small>
                Last voyage
              </small>

            </div>

          </article>

        </section>


        {/* ===============================================
            FILTERS
        =============================================== */}

        <section className="navigationMap">

          <div>

            <span className="mapLabel">
              LOG POSE • TIMEFRAME
            </span>


            <div className="timeframeNav">

              {
                TIMEFRAMES.map(
                  timeframe => (

                    <button
                      key={
                        timeframe
                      }
                      type="button"
                      className={
                        selectedTimeframe ===
                        timeframe
                          ? "timeframeButton active"
                          : "timeframeButton"
                      }
                      onClick={() =>
                        setSelectedTimeframe(
                          timeframe
                        )
                      }
                    >

                      {timeframe}

                    </button>

                  )
                )
              }

            </div>

          </div>


          <div className="pirateSearch">

            <span>
              🔎
            </span>


            <input
              type="text"
              placeholder="Search pair..."
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


        {/* ===============================================
            LIVE SETUPS
        =============================================== */}

        <section className="grandOceanPanel">

          <div className="panelHeading">

            <div>

              <span className="panelEyebrow">
                ⚔ LIVE SIGNALS
              </span>


              <h2>
                Active Pre-Phase Setups
              </h2>


              <p>
                Binance USDT Perpetual Futures
              </p>

            </div>


            <div className="lastVoyage">

              <span>
                LAST COMPLETED
              </span>

              <strong>
                {formatDate(
                  lastCompleted
                )}
              </strong>

            </div>

          </div>


          {
            loading && (

              <div className="grandEmptyState">

                <div className="grandRadar">

                  <span className="radarCircle circleOne" />

                  <span className="radarCircle circleTwo" />

                  <span className="radarCircle circleThree" />

                  <span className="radarCross horizontal" />

                  <span className="radarCross vertical" />

                  <span className="radarSweep" />

                  <span className="radarCenter" />

                </div>


                <h3>
                  Reading the Grand Line...
                </h3>


                <p>
                  Preparing market data.
                </p>

              </div>

            )
          }


          {
            !loading &&
            filteredSetups.length ===
              0 && (

              <div className="grandEmptyState">

                <div className="grandRadar">

                  <span className="radarCircle circleOne" />

                  <span className="radarCircle circleTwo" />

                  <span className="radarCircle circleThree" />

                  <span className="radarCross horizontal" />

                  <span className="radarCross vertical" />

                  <span className="radarSweep" />

                  <span className="radarTarget targetOne" />

                  <span className="radarTarget targetTwo" />

                  <span className="radarCenter" />

                </div>


                <h3>
                  No Treasure Found Yet
                </h3>


                <p>

                  {
                    cryptoRunning
                      ? "The crew is scanning the crypto seas."
                      : `Watching ${totalScanned || 521} Binance Futures contracts.`
                  }

                </p>


                <div className="voyageIndicator">

                  <span />

                  Always sailing the markets

                </div>

              </div>

            )
          }


          {
            !loading &&
            filteredSetups.length >
              0 && (

              <div className="wantedGrid">

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


                      const detectedTime =
                        setup
                          .prePhaseConfirmedAt ||
                        setup
                          .baseConfirmedAt ||
                        setup
                          .detectedAt ||
                        null;


                      return (

                        <article
                          className="wantedSetupCard"
                          style={{
                            "--delay":
                              `${Math.min(
                                index,
                                8
                              ) * 80}ms`
                          }}
                          key={
                            `${
                              setup.tradingPair ||
                              coin.symbol
                            }-${
                              setup.timeframe
                            }-${
                              setup.flashSellAt ||
                              setup.flashSellDate ||
                              index
                            }`
                          }
                        >

                          <div
                            className={
                              `wantedRibbon ${lifecycle.key}`
                            }
                          >

                            {
                              lifecycle.label
                            }

                          </div>


                          <div className="wantedCardHeader">

                            <div className="wantedAsset">

                              <div className="coinMedallion">

                                {
                                  coin.badge
                                }

                              </div>


                              <div>

                                <span>
                                  {
                                    setup
                                      .tradingPair ||
                                    `${coin.symbol}USDT`
                                  }
                                </span>


                                <strong>
                                  {
                                    coin.name
                                  }
                                </strong>


                                <small>
                                  Binance USDT Perpetual
                                </small>

                              </div>

                            </div>


                            <div className="wantedTags">

                              <span className="tfTag">

                                {
                                  setup
                                    .timeframe
                                }

                              </span>


                              <span className="phaseTag">
                                PRE_PHASE
                              </span>

                            </div>

                          </div>


                          <div className="pirateTimeline">

                            <div className="timelineStage">

                              <span className="timelineTime">

                                {
                                  formatDate(
                                    setup.flashSellAt ||
                                    setup.flashSellDate
                                  )
                                }

                              </span>


                              <div className="timelineIcon sell">
                                ↓
                              </div>


                              <strong>
                                FLASH SELL
                              </strong>


                              <small className="sellText">

                                {
                                  setup
                                    .flashSellDropPercent !=
                                  null
                                    ? `-${Math.abs(
                                        Number(
                                          setup
                                            .flashSellDropPercent
                                        )
                                      ).toFixed(
                                        2
                                      )}%`
                                    : "-"
                                }

                              </small>

                            </div>


                            <div className="timelineRope">

                              <span />

                            </div>


                            <div className="timelineStage">

                              <span className="timelineTime">

                                {
                                  formatDate(
                                    setup.baseStartedAt
                                  )
                                }

                              </span>


                              <div className="timelineIcon base">
                                ◇
                              </div>


                              <strong>

                                {
                                  setup.baseType ||
                                  "BASE"
                                }

                              </strong>


                              <small>
                                Reversal signal
                              </small>

                            </div>


                            <div className="timelineRope">

                              <span />

                            </div>


                            <div className="timelineStage">

                              <span className="timelineTime">

                                {
                                  formatDate(
                                    detectedTime
                                  )
                                }

                              </span>


                              <div className="timelineIcon confirmed">
                                ✓
                              </div>


                              <strong>
                                PRE_PHASE
                              </strong>


                              <small className="confirmedText">
                                CONFIRMED
                              </small>

                            </div>

                          </div>


                          <div className="setupAge">

                            <div className="ageHeading">

                              <div>

                                <span>
                                  SETUP AGE
                                </span>


                                <strong>

                                  {
                                    getAgeText(
                                      setup
                                    )
                                  }{" "}
                                  candles

                                </strong>

                              </div>


                              <strong className="agePercentage">

                                {
                                  Math.round(
                                    agePercent
                                  )
                                }%

                              </strong>

                            </div>


                            <div className="pirateProgress">

                              <span
                                className={
                                  lifecycle.key
                                }
                                style={{
                                  width:
                                    `${agePercent}%`
                                }}
                              />

                            </div>

                          </div>


                          <div className="structureMap">

                            <div className="structureIdentity">

                              <span className="structureIcon">
                                ↗
                              </span>


                              <div>

                                <span>
                                  STRUCTURE
                                </span>


                                <strong>

                                  {
                                    displayStructure(
                                      setup
                                    )
                                  }

                                </strong>

                              </div>

                            </div>


                            <div className="structureStats">

                              {
                                setup
                                  .channelRespectRatio !=
                                  null && (

                                  <div>

                                    <span>
                                      CHANNEL RESPECT
                                    </span>


                                    <strong>

                                      {
                                        Math.round(
                                          setup
                                            .channelRespectRatio *
                                          100
                                        )
                                      }%

                                    </strong>

                                  </div>

                                )
                              }


                              {
                                setup
                                  .baseCandlesFound !=
                                  null && (

                                  <div>

                                    <span>
                                      BASE CANDLES
                                    </span>


                                    <strong>

                                      {
                                        setup
                                          .baseCandlesFound
                                      }

                                    </strong>

                                  </div>

                                )
                              }

                            </div>

                          </div>


                          <div className="wantedFooter">

                            <span>

                              Flash{" "}

                              <strong>

                                {
                                  formatDate(
                                    setup
                                      .flashSellConfirmedAt
                                  )
                                }

                              </strong>

                            </span>


                            <span>

                              Base{" "}

                              <strong>

                                {
                                  formatDate(
                                    setup
                                      .baseConfirmedAt
                                  )
                                }

                              </strong>

                            </span>

                          </div>

                        </article>

                      );
                    }
                  )
                }

              </div>

            )
          }


          <footer className="grandOceanFooter">

            <span>
              ☠
            </span>


            <div>

              <i />

              Live data refreshes every 5 seconds

            </div>


            <span>
              ⚓
            </span>

          </footer>

        </section>

      </main>

    </div>

  );
}


export default App;