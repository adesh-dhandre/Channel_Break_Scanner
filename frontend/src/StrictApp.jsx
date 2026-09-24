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
  "2h",
  "4h",
  "1d"
];


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


function formatPrice(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  const absolute = Math.abs(number);

  let decimals;

  if (absolute >= 1000) {
    decimals = 2;
  } else if (absolute >= 1) {
    decimals = 4;
  } else if (absolute >= 0.01) {
    decimals = 6;
  } else {
    decimals = 8;
  }

  return number
    .toFixed(decimals)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}


function cleanCryptoSymbol(setup) {
  const pair = String(
    setup?.tradingPair ||
    setup?.symbol ||
    "UNKNOWN"
  ).toUpperCase();

  if (pair.endsWith("USDT")) {
    return pair.slice(0, -4);
  }

  return pair;
}


function StrictApp() {
  const [status, setStatus] = useState({});
  const [results, setResults] = useState([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scanStarting, setScanStarting] = useState(false);
  const [scanMessage, setScanMessage] = useState("");


  async function refreshAll() {
    try {
      const [
        strictStatusResponse,
        strictResultsResponse,
        liveStatusResponse,
        liveResultsResponse
      ] = await Promise.all([
        fetch(`/api/strict/status?_=${Date.now()}`, {
          cache: "no-store"
        }),
        fetch(`/api/strict/results?_=${Date.now()}`, {
          cache: "no-store"
        }),
        fetch(`/api/live/status?_=${Date.now()}`, {
          cache: "no-store"
        }),
        fetch(`/api/live/results?_=${Date.now()}`, {
          cache: "no-store"
        })
      ]);

      if (
        !strictStatusResponse.ok ||
        !strictResultsResponse.ok ||
        !liveStatusResponse.ok ||
        !liveResultsResponse.ok
      ) {
        throw new Error(
          "Unable to load live scanner data."
        );
      }

      const strictStatus = await strictStatusResponse.json();
      const strictResults = await strictResultsResponse.json();
      const liveStatus = await liveStatusResponse.json();
      const liveResults = await liveResultsResponse.json();

      const redisEnabled =
        strictStatus?.redisEnabled === true;

      const state = redisEnabled
        ? strictStatus?.state || {}
        : {
            running:
              liveStatus?.cryptoRunning === true,
            startedAt:
              liveStatus?.lastCryptoStartedAt || null,
            completedAt:
              liveStatus?.lastCryptoCompletedAt || null,
            scannedSymbols:
              liveStatus?.lastCryptoResult?.scannedCoins || 0,
            failedSymbols:
              liveStatus?.lastCryptoResult?.failedCoins || 0,
            dueTimeframes:
              liveStatus?.lastCryptoResult?.timeframes || [],
            newSetupCount:
              liveStatus?.lastCryptoResult?.newSetups?.length || 0,
            currentSetupCount:
              liveStatus?.lastCryptoResult?.activeSetups?.length || 0,
            scanDurationSeconds:
              liveStatus?.lastCryptoResult?.scanDurationSeconds || 0,
            error:
              liveStatus?.lastCryptoError || null
          };

      const currentResults = redisEnabled
        ? (
            Array.isArray(strictResults?.results)
              ? strictResults.results
              : []
          )
        : (
            Array.isArray(liveResults?.crypto?.results)
              ? liveResults.crypto.results
              : []
          );

      setStatus({
        ...state,
        redisEnabled
      });

      setResults(currentResults);
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
      status?.running
    ) {
      return;
    }

    try {
      setScanStarting(true);
      setScanMessage(
        "Starting strict market scan..."
      );

      const response = await fetch(
        "/api/live/manual-trigger",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          }
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
          result?.message ||
          "Unable to start scanner."
        );
      }

      setScanMessage(
        result?.alreadyRunning
          ? "Scanner is already running."
          : "Strict crypto scan started."
      );

      setTimeout(
        refreshAll,
        1000
      );

    } catch (err) {
      console.error(err);
      setScanMessage(
        err.message ||
        "Unable to start scanner."
      );
    } finally {
      setScanStarting(false);

      setTimeout(
        () => setScanMessage(""),
        4000
      );
    }
  }


  useEffect(() => {
    refreshAll();

    const timer = setInterval(
      refreshAll,
      5000
    );

    return () => clearInterval(timer);
  }, []);


  const filteredSetups = useMemo(
    () => {
      const query = search
        .trim()
        .toLowerCase();

      return results.filter(setup => {
        const timeframeMatch =
          selectedTimeframe === "ALL" ||
          setup.timeframe === selectedTimeframe;

        const searchable = [
          setup.symbol,
          setup.tradingPair,
          setup.setupType,
          setup.setupColor
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return (
          timeframeMatch &&
          (
            !query ||
            searchable.includes(query)
          )
        );
      });
    },
    [results, search, selectedTimeframe]
  );


  const totalScanned =
    status?.scannedSymbols || 0;

  const failed =
    status?.failedSymbols || 0;

  const successful =
    Math.max(
      0,
      totalScanned - failed
    );

  const scanDuration =
    status?.scanDurationSeconds || 0;

  const activeCount =
    results.length;

  const scannerHealthy =
    !status?.error;


  return (
    <div className="scannerApp">

      <header className="topbar">
        <div className="brand">
          <div className="brandMark">CB</div>
          <div>
            <strong>Channel Break Scanner</strong>
            <span>Strict Flash Turn • Crypto Futures</span>
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
            <small>SYSTEM STATUS</small>
            <strong>
              {scannerHealthy
                ? "Operational"
                : "Attention Required"}
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
            <h1>Strict Live Scanner</h1>
            <p>
              Established ascending channel → Flash Sell → immediate true Hammer/Doji → next-candle entry.
            </p>
          </div>

          <div className="scanActions">
            <div
              className={
                status?.running
                  ? "scanStatus running"
                  : "scanStatus"
              }
            >
              <span
                className={
                  status?.running
                    ? "statusDot scanning"
                    : "statusDot online"
                }
              />
              <div>
                <small>SCANNER</small>
                <strong>
                  {status?.running
                    ? "Scanning"
                    : "Ready"}
                </strong>
              </div>
            </div>

            <button
              type="button"
              className="scanButton"
              disabled={
                status?.running ||
                scanStarting
              }
              onClick={triggerManualScan}
            >
              <strong>
                {status?.running
                  ? "SCANNING"
                  : scanStarting
                    ? "PREPARING"
                    : "SCAN NOW"}
              </strong>
              <small>Manual strict scan</small>
            </button>
          </div>
        </section>


        {scanMessage && (
          <div className="notice">
            {scanMessage}
          </div>
        )}

        {error && (
          <div className="errorBox">
            <strong>Scanner connection issue</strong>
            <span>{error}</span>
          </div>
        )}


        <section className="metricsGrid">
          <article className="metricCard">
            <span>ACTIVE SETUPS</span>
            <strong>{activeCount}</strong>
            <small>Current entry candles</small>
          </article>

          <article className="metricCard">
            <span>TOTAL SCANNED</span>
            <strong>{totalScanned}</strong>
            <small>Futures contracts</small>
          </article>

          <article className="metricCard">
            <span>SUCCESSFUL</span>
            <strong>{successful}</strong>
            <small>Last scan</small>
          </article>

          <article className="metricCard">
            <span>FAILED</span>
            <strong className={failed > 0 ? "dangerText" : ""}>
              {failed}
            </strong>
            <small>Last scan</small>
          </article>

          <article className="metricCard">
            <span>SCAN TIME</span>
            <strong>
              {scanDuration
                ? `${scanDuration}s`
                : "-"}
            </strong>
            <small>Last completed scan</small>
          </article>
        </section>


        <section className="toolbar">
          <div className="timeframeGroup">
            <span className="toolbarLabel">TIMEFRAME</span>
            <div className="timeframeButtons">
              {TIMEFRAMES.map(timeframe => (
                <button
                  key={timeframe}
                  type="button"
                  className={
                    selectedTimeframe === timeframe
                      ? "timeframeButton active"
                      : "timeframeButton"
                  }
                  onClick={() =>
                    setSelectedTimeframe(timeframe)
                  }
                >
                  {timeframe}
                </button>
              ))}
            </div>
          </div>

          <div className="searchBox">
            <span>Search</span>
            <input
              type="text"
              placeholder="BTC, ETH, SOPH..."
              value={search}
              onChange={event =>
                setSearch(event.target.value)
              }
            />
          </div>
        </section>


        <section className="signalsPanel">
          <div className="panelHeader">
            <div>
              <span className="sectionLabel">LIVE SIGNALS</span>
              <h2>Strict Flash Turn Setups</h2>
              <p>
                5m • 15m • 30m • 45m • 1h • 2h • 4h • 1D
              </p>
            </div>

            <div className="lastCompleted">
              <span>LAST COMPLETED</span>
              <strong>
                {formatDate(status?.completedAt)}
              </strong>
            </div>
          </div>


          {loading && (
            <div className="emptyState">
              <div className="loadingIndicator" />
              <h3>Loading scanner data</h3>
              <p>Connecting to strict live results.</p>
            </div>
          )}


          {!loading && filteredSetups.length === 0 && (
            <div className="emptyState">
              <div className="emptyIcon">↗</div>
              <h3>No active strict setups</h3>
              <p>
                {status?.running
                  ? "Scanner is checking the market now."
                  : `Monitoring ${totalScanned || 527} Binance Futures contracts.`}
              </p>
              <span className="monitoringText">
                ● Market monitoring active
              </span>
            </div>
          )}


          {!loading && filteredSetups.length > 0 && (
            <div className="signalsGrid">
              {filteredSetups.map((setup, index) => {
                const symbol =
                  setup.tradingPair ||
                  setup.symbol ||
                  "UNKNOWN";

                const baseSymbol =
                  cleanCryptoSymbol(setup);

                return (
                  <article
                    className="signalCard"
                    key={`${symbol}-${setup.timeframe}-${setup.reversalTime || index}`}
                  >
                    <div className="signalCardHeader">
                      <div className="assetInfo">
                        <div className="coinBadge">
                          {baseSymbol.charAt(0) || "◆"}
                        </div>
                        <div>
                          <strong>{symbol}</strong>
                          <span>{baseSymbol} Futures</span>
                        </div>
                      </div>

                      <div className="signalTags">
                        <span className="timeframeTag">
                          {setup.timeframe}
                        </span>
                        <span className="lifecycleTag live">
                          LIVE
                        </span>
                      </div>
                    </div>

                    <div className="phaseBadge">
                      STRICT FLASH TURN
                    </div>

                    <div className="timeline">
                      <div className="timelineItem">
                        <span>FLASH SELL</span>
                        <strong className="sellValue">
                          {setup.flashDropPct != null
                            ? `-${Math.abs(Number(setup.flashDropPct)).toFixed(2)}%`
                            : "-"}
                        </strong>
                        <small>
                          {formatDate(setup.flashSellAt || setup.flashSellDate)}
                        </small>
                      </div>

                      <div className="timelineArrow">→</div>

                      <div className="timelineItem">
                        <span>REVERSAL</span>
                        <strong>
                          {setup.setupType || "HAMMER"}
                        </strong>
                        <small>
                          {`${setup.setupColor || ""} • ${formatDate(setup.reversalTime || setup.reversalDate)}`}
                        </small>
                      </div>

                      <div className="timelineArrow">→</div>

                      <div className="timelineItem">
                        <span>ENTRY</span>
                        <strong className="confirmedValue">
                          {formatPrice(setup.entry)}
                        </strong>
                        <small>
                          {formatDate(setup.entryTime)}
                        </small>
                      </div>
                    </div>

                    <div className="structureSection">
                      <div>
                        <span>STOP LOSS</span>
                        <strong>{formatPrice(setup.stopLoss ?? setup.stop)}</strong>
                      </div>

                      <div>
                        <span>1R TARGET</span>
                        <strong>{formatPrice(setup.target1R)}</strong>
                      </div>

                      <div>
                        <span>1.5R TARGET</span>
                        <strong>{formatPrice(setup.target1_5R)}</strong>
                      </div>

                      <div>
                        <span>2R TARGET</span>
                        <strong>{formatPrice(setup.target2R)}</strong>
                      </div>
                    </div>

                    <div className="signalFooter">
                      <span>
                        Reversal confirmed
                        <strong>
                          {formatDate(setup.baseConfirmedAt || setup.entryTime)}
                        </strong>
                      </span>

                      <span>
                        Entry candle ends
                        <strong>
                          {formatDate(setup.entryEnd)}
                        </strong>
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}


          <footer className="panelFooter">
            <span className="statusDot online" />
            Strict dashboard refreshes every 5 seconds
          </footer>
        </section>
      </main>
    </div>
  );
}


export default StrictApp;
