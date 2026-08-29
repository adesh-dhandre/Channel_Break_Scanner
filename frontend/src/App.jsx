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


  if (
    known
  ) {

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
      setup.name !==
        symbol
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

  if (
    !value
  ) {

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
        "Aging"

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
        "Expired"

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
        "Waiting"

    };
  }


  return {

    key:
      "live",

    label:
      setup?.lifecycleLabel ||
      "Live"

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

  if (
    setup?.ageText
  ) {

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

    return (
      `${current} / ${max}`
    );
  }


  return (
    current != null
      ? String(current)
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


  // ====================================================
  // LIVE STATUS
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


    if (
      !response.ok
    ) {

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
  // LIVE RESULTS
  //
  // IMPORTANT:
  //
  // We ONLY display /api/live/results.
  //
  // If backend returns zero setups, frontend immediately
  // displays zero setups.
  //
  // We DO NOT fall back to /api/crypto/results because
  // that could contain results from an older scan.
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


    if (
      !response.ok
    ) {

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


    // Always replace state.
    //
    // [] means CLEAR the dashboard.
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
  // FILTER RESULTS
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
  // RENDER
  // ====================================================

  return (

    <div className="grandLineApp">

      <div className="oceanGlow oceanGlowOne" />

      <div className="oceanGlow oceanGlowTwo" />


      <aside className="grandSidebar">

        <div>

          <div className="grandBrand">

            <div className="compassLogo">

              <span className="compassArrow">
                ↗
              </span>

            </div>


            <div>

              <span className="brandOverline">
                GRAND LINE
              </span>

              <strong>
                CHANNEL SCANNER
              </strong>

            </div>

          </div>


          <div className="voyageStatus">

            <span className="voyageLabel">
              ACTIVE VOYAGE
            </span>

            <strong>
              Binance Futures
            </strong>

            <small>
              USDT Perpetual Market
            </small>

          </div>


          <div className="sidebarDivider" />


          <div className="sidebarSection">

            <span className="sidebarTitle">
              MARKET
            </span>


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

            </div>

          </div>

        </div>


        <div className="sidebarFooter">

          <div className="systemHealth">

            <span className="healthPulse" />

            <div>

              <span>
                SYSTEM
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


          <small>
            Channel Scanner © 2026
          </small>

        </div>

      </aside>


      <main className="grandMain">

        <header className="voyageHeader">

          <div>

            <div className="eyebrowRow">

              <span className="eyebrowLine" />

              <span>
                MARKET INTELLIGENCE
              </span>

            </div>


            <h1>

              Navigate the{" "}

              <span>
                Grand Line
              </span>

            </h1>


            <p>

              Real-time Channel Break detection across
              Binance USDT perpetual futures.

            </p>

          </div>


          <div
            className={
              cryptoRunning
                ? "radarStatus scanning"
                : "radarStatus online"
            }
          >

            <div className="radarPulse">

              <span />

            </div>


            <div>

              <small>
                SCANNER
              </small>

              <strong>

                {
                  cryptoRunning
                    ? "Scanning Market"
                    : "Live & Ready"
                }

              </strong>

            </div>

          </div>

        </header>


        {
          error && (

            <div className="grandError">

              <strong>
                Scanner connection issue
              </strong>

              <span>
                {error}
              </span>

            </div>

          )
        }


        <section className="commandDeck">

          <article className="commandMetric">

            <span className="metricLabel">
              MARKET UNIVERSE
            </span>

            <strong>
              {totalScanned}
            </strong>

            <small>
              Futures contracts
            </small>

          </article>


          <article className="commandMetric featured">

            <span className="metricLabel">
              LIVE TREASURES
            </span>

            <strong>
              {activeCount}
            </strong>

            <small>
              Active setups
            </small>

          </article>


          <article className="commandMetric">

            <span className="metricLabel">
              SUCCESSFUL
            </span>

            <strong>
              {successful}
            </strong>

            <small>
              Last voyage
            </small>

          </article>


          <article className="commandMetric">

            <span className="metricLabel">
              FAILED
            </span>

            <strong>
              {failed}
            </strong>

            <small>
              Contracts
            </small>

          </article>


          <article className="commandMetric">

            <span className="metricLabel">
              VOYAGE TIME
            </span>

            <strong>

              {
                scanDuration
                  ? `${scanDuration}s`
                  : "-"
              }

            </strong>

            <small>
              Full market scan
            </small>

          </article>

        </section>


        <section className="navigationDeck">

          <div>

            <span className="deckLabel">
              LOG POSE
            </span>


            <div className="timeframeNav">

              {
                TIMEFRAMES.map(
                  timeframe => (

                    <button
                      key={
                        timeframe
                      }

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

                      {
                        timeframe ===
                        "ALL"
                          ? "ALL"
                          : timeframe
                              .toUpperCase()
                      }

                    </button>

                  )
                )
              }

            </div>

          </div>


          <div className="grandSearch">

            <span>
              ⌕
            </span>

            <input
              type="text"

              placeholder="Search contract..."

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


        <section className="signalOcean">

          <div className="signalOceanHeader">

            <div>

              <span className="sectionOverline">
                SIGNAL RADAR
              </span>

              <h2>
                Active Pre-Phase Setups
              </h2>

              <p>
                Binance USDT Perpetual Futures
              </p>

            </div>


            <div className="scanTimestamp">

              <small>
                LAST COMPLETED
              </small>

              <strong>

                {
                  formatDate(
                    lastCompleted
                  )
                }

              </strong>

            </div>

          </div>


          {
            loading && (

              <div className="grandEmptyState">

                <div className="radarLoader">

                  <span />

                </div>

                <h3>
                  Reading the seas...
                </h3>

                <p>
                  Loading scanner state.
                </p>

              </div>

            )
          }


          {
            !loading &&
            filteredSetups.length ===
              0 && (

              <div className="grandEmptyState">

                <div className="emptyCompass">
                  ✦
                </div>

                <h3>
                  No active signal on the horizon
                </h3>

                <p>

                  {
                    cryptoRunning
                      ? "The scanner is currently sweeping the market."
                      : "Waiting for the next valid Channel Break setup."
                  }

                </p>

              </div>

            )
          }


          {
            !loading &&
            filteredSetups.length >
              0 && (

              <div className="treasureGrid">

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
                          .detectedAt ||
                        setup
                          .baseConfirmedAt ||
                        null;


                      return (

                        <article
                          className="treasureCard"

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

                          <div className="treasureCardTop">

                            <div className="assetIdentity">

                              <div className="coinEmblem">

                                {
                                  coin.badge
                                }

                              </div>


                              <div>

                                <span className="pairLabel">

                                  {
                                    setup
                                      .tradingPair ||
                                    `${coin.symbol}USDT`
                                  }

                                </span>

                                <h3>

                                  {
                                    coin.name
                                  }

                                </h3>

                              </div>

                            </div>


                            <div className="signalBadges">

                              <span
                                className={
                                  `lifecyclePill ${lifecycle.key}`
                                }
                              >

                                <span />

                                {
                                  lifecycle.label
                                }

                              </span>


                              <div>

                                <span
                                  className="timeframePill"
                                >

                                  {
                                    setup
                                      .timeframe
                                      ?.toUpperCase()
                                  }

                                </span>

                                <span className="prePhasePill">

                                  {
                                    setup.status ||
                                    "PRE_PHASE"
                                  }

                                </span>

                              </div>

                            </div>

                          </div>


                          <div className="signalTimeline">

                            <div className="signalStage">

                              <span className="stageTime">

                                {
                                  formatDate(
                                    setup.flashSellAt ||
                                    setup.flashSellDate
                                  )
                                }

                              </span>


                              <div className="stageIcon danger">
                                ↓
                              </div>


                              <strong>
                                FLASH SELL
                              </strong>


                              <span className="dropValue">

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

                              </span>

                            </div>


                            <div className="routeConnector">

                              <span />

                            </div>


                            <div className="signalStage">

                              <span className="stageTime">

                                {
                                  formatDate(
                                    setup.baseStartedAt
                                  )
                                }

                              </span>


                              <div className="stageIcon base">
                                ◇
                              </div>


                              <strong>

                                {
                                  setup.baseType ||
                                  "BASE"
                                }

                              </strong>


                              <span>
                                Reversal candle
                              </span>

                            </div>


                            <div className="routeConnector">

                              <span />

                            </div>


                            <div className="signalStage">

                              <span className="stageTime">

                                {
                                  formatDate(
                                    detectedTime
                                  )
                                }

                              </span>


                              <div className="stageIcon success">
                                ✓
                              </div>


                              <strong>
                                CONFIRMED
                              </strong>


                              <span>
                                Pre-phase
                              </span>

                            </div>

                          </div>


                          <div className="signalVitals">

                            <div className="vitalHeader">

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


                              <span className="agePercent">

                                {
                                  Math.round(
                                    agePercent
                                  )
                                }%

                              </span>

                            </div>


                            <div className="grandProgress">

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


                          <div className="strategyPanel">

                            <div className="strategyIdentity">

                              <div className="strategyCompass">
                                ↗
                              </div>


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


                            <div className="strategyStats">

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


                          <div className="treasureFooter">

                            <span>

                              Flash confirmed{" "}

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

                              Base confirmed{" "}

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


          <div className="oceanFooter">

            <span className="autoRefreshDot" />

            Live data refreshes every 5 seconds

          </div>

        </section>

      </main>

    </div>

  );
}


export default App;