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
  BTC: { name: "Bitcoin", badge: "₿" },
  ETH: { name: "Ethereum", badge: "Ξ" },
  SOL: { name: "Solana", badge: "S" },
  BNB: { name: "BNB", badge: "B" },
  XRP: { name: "XRP", badge: "X" },
  DOGE: { name: "Dogecoin", badge: "Ð" },
  ADA: { name: "Cardano", badge: "A" },
  AVAX: { name: "Avalanche", badge: "A" },
  LINK: { name: "Chainlink", badge: "L" },
  DOT: { name: "Polkadot", badge: "D" },
  LTC: { name: "Litecoin", badge: "Ł" },
  BCH: { name: "Bitcoin Cash", badge: "B" },
  TRX: { name: "TRON", badge: "T" },
  TON: { name: "Toncoin", badge: "T" },
  STX: { name: "Stacks", badge: "S" },
  GMX: { name: "GMX", badge: "G" }
};


function cleanCryptoSymbol(setup) {
  if (setup?.symbol) {
    return String(setup.symbol)
      .replace(/\.NS$/i, "")
      .toUpperCase();
  }

  const pair = String(
    setup?.tradingPair || ""
  ).toUpperCase();

  if (pair.endsWith("USDT")) {
    return pair.slice(0, -4);
  }

  return pair || "UNKNOWN";
}


function getCoinInfo(setup) {
  const symbol = cleanCryptoSymbol(setup);
  const known = COIN_INFO[symbol];

  if (known) {
    return {
      symbol,
      name: known.name,
      badge: known.badge
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
      symbol.charAt(0).toUpperCase() ||
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

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }
  ).format(date);
}


function getLifecycle(setup) {
  const lifecycle = String(
    setup?.lifecycle ||
    "LIVE"
  ).toUpperCase();

  if (lifecycle === "AGING") {
    return {
      key: "aging",
      label:
        setup?.lifecycleLabel ||
        "AGING"
    };
  }

  if (lifecycle === "EXPIRED") {
    return {
      key: "expired",
      label:
        setup?.lifecycleLabel ||
        "EXPIRED"
    };
  }

  if (lifecycle === "WAITING") {
    return {
      key: "waiting",
      label:
        setup?.lifecycleLabel ||
        "WAITING"
    };
  }

  return {
    key: "live",
    label:
      setup?.lifecycleLabel ||
      "LIVE"
  };
}


function getAgePercent(setup) {
  const current = Number(
    setup?.candlesSinceFlashSell
  );

  const max = Number(
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
      (current / max) * 100
    )
  );
}


function getAgeText(setup) {
  if (setup?.ageText) {
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

  return current != null
    ? String(current)
    : "-";
}


function App() {
  const [
    liveStatus,
    setLiveStatus
  ] = useState(null);

  const [
    liveResults,
    setLiveResults
  ] = useState([]);

  const [
    selectedTimeframe,
    setSelectedTimeframe
  ] = useState("ALL");

  const [
    search,
    setSearch
  ] = useState("");

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    error,
    setError
  ] = useState("");

  const [
    scanStarting,
    setScanStarting
  ] = useState(false);

  const [
    scanMessage,
    setScanMessage
  ] = useState("");


  async function fetchLiveStatus() {
    const response = await fetch(
      "/api/live/status",
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        "Unable to load scanner status."
      );
    }

    const result =
      await response.json();

    setLiveStatus(result);
  }


  async function fetchLiveResults() {
    const response = await fetch(
      `/api/live/results?_=${Date.now()}`,
      {
        cache: "no-store"
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
        result?.crypto?.results
      )
        ? result.crypto.results
        : [];

    setLiveResults(
      currentResults
    );
  }


  async function refreshAll() {
    try {
      await Promise.all([
        fetchLiveStatus(),
        fetchLiveResults()
      ]);

      setError("");
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
        "Unable to connect to scanner."
      );
    } finally {
      setLoading(false);
    }
  }


  async function triggerManualScan() {
    if (
      scanStarting ||
      liveStatus?.cryptoRunning
    ) {
      return;
    }

    try {
      setScanStarting(true);
      setScanMessage(
        "Preparing scanner..."
      );

      const response = await fetch(
        "/api/live/manual-trigger",
        {
          method: "POST",
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

      if (result?.alreadyRunning) {
        setScanMessage(
          "Scanner is already running."
        );
      } else {
        setScanMessage(
          "Crypto scan started."
        );
      }

      await refreshAll();
    } catch (err) {
      console.error(err);

      setScanMessage(
        err.message ||
        "Unable to start scanner."
      );
    } finally {
      setScanStarting(false);

      setTimeout(
        () => {
          setScanMessage("");
        },
        4000
      );
    }
  }


  useEffect(
    () => {
      refreshAll();

      const timer =
        setInterval(
          refreshAll,
          5000
        );

      return () =>
        clearInterval(timer);
    },
    []
  );


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
              getCoinInfo(setup);

            const searchable = [
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
        liveResults,
        search,
        selectedTimeframe
      ]
    );


  const cryptoStats =
    liveStatus?.lastCryptoResult ||
    {};

  const cryptoRunning =
    liveStatus?.cryptoRunning ===
    true;

  const totalScanned =
    cryptoStats?.scannedCoins || 0;

  const successful =
    cryptoStats?.successfulCoins ||
    0;

  const failed =
    cryptoStats?.failedCoins || 0;

  const scanDuration =
    cryptoStats?.scanDurationSeconds ||
    0;

  const lastCompleted =
    liveStatus
      ?.lastCryptoCompletedAt ||
    null;

  const activeCount =
    liveResults.length;

  const scannerHealthy =
    !liveStatus?.lastCryptoError;


  return (
    <div className="scannerApp">

      <header className="topbar">

        <div className="brand">

          <div className="brandMark">
            CB
          </div>

          <div>
            <strong>
              Channel Break Scanner
            </strong>

            <span>
              Crypto Futures Monitoring
            </span>
          </div>

        </div>


        <div className="topbarStatus">

          <span
            className={
              scannerHealthy
                ? "statusDot online"
                : "statusDot offline"
            }
          />

          <div>
            <small>
              SYSTEM STATUS
            </small>

            <strong>
              {
                scannerHealthy
                  ? "Operational"
                  : "Attention Required"
              }
            </strong>
          </div>

        </div>

      </header>


      <main className="dashboard">

        <section className="dashboardHeader">

          <div>

            <span className="sectionLabel">
              BINANCE USDT PERPETUAL FUTURES
            </span>

            <h1>
              Market Scanner
            </h1>

            <p>
              Monitoring fresh channel-break
              PRE_PHASE opportunities across
              crypto futures.
            </p>

          </div>


          <div className="scanActions">

            <div
              className={
                cryptoRunning
                  ? "scanStatus running"
                  : "scanStatus"
              }
            >

              <span
                className={
                  cryptoRunning
                    ? "statusDot scanning"
                    : "statusDot online"
                }
              />

              <div>

                <small>
                  SCANNER
                </small>

                <strong>
                  {
                    cryptoRunning
                      ? "Scanning"
                      : "Ready"
                  }
                </strong>

              </div>

            </div>


            <button
              type="button"
              className="scanButton"
              disabled={
                cryptoRunning ||
                scanStarting
              }
              onClick={
                triggerManualScan
              }
            >

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
                Manual crypto scan
              </small>

            </button>

          </div>

        </section>


        {
          scanMessage && (
            <div className="notice">
              {scanMessage}
            </div>
          )
        }


        {
          error && (
            <div className="errorBox">

              <strong>
                Scanner connection issue
              </strong>

              <span>
                {error}
              </span>

            </div>
          )
        }


        <section className="metricsGrid">

          <article className="metricCard">
            <span>
              ACTIVE SETUPS
            </span>

            <strong>
              {activeCount}
            </strong>

            <small>
              Current opportunities
            </small>
          </article>


          <article className="metricCard">
            <span>
              TOTAL SCANNED
            </span>

            <strong>
              {totalScanned}
            </strong>

            <small>
              Futures contracts
            </small>
          </article>


          <article className="metricCard">
            <span>
              SUCCESSFUL
            </span>

            <strong>
              {successful}
            </strong>

            <small>
              Last scan
            </small>
          </article>


          <article className="metricCard">
            <span>
              FAILED
            </span>

            <strong
              className={
                failed > 0
                  ? "dangerText"
                  : ""
              }
            >
              {failed}
            </strong>

            <small>
              Last scan
            </small>
          </article>


          <article className="metricCard">
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
              Last completed scan
            </small>
          </article>

        </section>


        <section className="toolbar">

          <div className="timeframeGroup">

            <span className="toolbarLabel">
              TIMEFRAME
            </span>

            <div className="timeframeButtons">

              {
                TIMEFRAMES.map(
                  timeframe => (
                    <button
                      key={timeframe}
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


          <div className="searchBox">

            <span>
              Search
            </span>

            <input
              type="text"
              placeholder="BTC, ETH, SOL..."
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


        <section className="signalsPanel">

          <div className="panelHeader">

            <div>

              <span className="sectionLabel">
                LIVE SIGNALS
              </span>

              <h2>
                Active PRE_PHASE Setups
              </h2>

              <p>
                Binance USDT Perpetual Futures
              </p>

            </div>


            <div className="lastCompleted">

              <span>
                LAST COMPLETED
              </span>

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
              <div className="emptyState">

                <div className="loadingIndicator" />

                <h3>
                  Loading scanner data
                </h3>

                <p>
                  Connecting to live results.
                </p>

              </div>
            )
          }


          {
            !loading &&
            filteredSetups.length ===
              0 && (
              <div className="emptyState">

                <div className="emptyIcon">
                  ↗
                </div>

                <h3>
                  No active setups
                </h3>

                <p>
                  {
                    cryptoRunning
                      ? "Scanner is currently checking the market."
                      : `Monitoring ${totalScanned || 521} Binance Futures contracts.`
                  }
                </p>

                <span className="monitoringText">
                  ● Market monitoring active
                </span>

              </div>
            )
          }


          {
            !loading &&
            filteredSetups.length >
              0 && (
              <div className="signalsGrid">

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
                          className="signalCard"
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

                          <div className="signalCardHeader">

                            <div className="assetInfo">

                              <div className="coinBadge">
                                {coin.badge}
                              </div>

                              <div>

                                <strong>
                                  {
                                    setup
                                      .tradingPair ||
                                    `${coin.symbol}USDT`
                                  }
                                </strong>

                                <span>
                                  {coin.name}
                                </span>

                              </div>

                            </div>


                            <div className="signalTags">

                              <span className="timeframeTag">
                                {
                                  setup
                                    .timeframe
                                }
                              </span>

                              <span
                                className={
                                  `lifecycleTag ${lifecycle.key}`
                                }
                              >
                                {
                                  lifecycle.label
                                }
                              </span>

                            </div>

                          </div>


                          <div className="phaseBadge">
                            PRE_PHASE
                          </div>


                          <div className="timeline">

                            <div className="timelineItem">

                              <span>
                                FLASH SELL
                              </span>

                              <strong className="sellValue">
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
                              </strong>

                              <small>
                                {
                                  formatDate(
                                    setup.flashSellAt ||
                                    setup.flashSellDate
                                  )
                                }
                              </small>

                            </div>


                            <div className="timelineArrow">
                              →
                            </div>


                            <div className="timelineItem">

                              <span>
                                BASE
                              </span>

                              <strong>
                                {
                                  setup.baseType ||
                                  "BASE"
                                }
                              </strong>

                              <small>
                                {
                                  formatDate(
                                    setup.baseStartedAt
                                  )
                                }
                              </small>

                            </div>


                            <div className="timelineArrow">
                              →
                            </div>


                            <div className="timelineItem">

                              <span>
                                CONFIRMED
                              </span>

                              <strong className="confirmedValue">
                                PRE_PHASE
                              </strong>

                              <small>
                                {
                                  formatDate(
                                    detectedTime
                                  )
                                }
                              </small>

                            </div>

                          </div>


                          <div className="ageSection">

                            <div className="ageHeader">

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

                              <strong>
                                {
                                  Math.round(
                                    agePercent
                                  )
                                }%
                              </strong>

                            </div>


                            <div className="progressTrack">

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


                          <div className="structureSection">

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


                          <div className="signalFooter">

                            <span>
                              Flash confirmed
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
                              Base confirmed
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


          <footer className="panelFooter">

            <span className="statusDot online" />

            Dashboard data refreshes every
            5 seconds

          </footer>

        </section>

      </main>

    </div>
  );
}


export default App;