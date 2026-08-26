import { useEffect, useRef } from "react";
import {
  createChart,
  CrosshairMode
} from "lightweight-charts";


function ChartModal({
  open,
  onClose,
  symbol,
  timeframe,
  candles = []
}) {

  const chartContainerRef =
    useRef(null);


  useEffect(() => {

    if (
      !open ||
      !chartContainerRef.current ||
      candles.length === 0
    ) {
      return;
    }


    const container =
      chartContainerRef.current;


    const chart =
      createChart(
        container,
        {
          width:
            container.clientWidth,

          height:
            container.clientHeight,

          layout: {
            background: {
              color: "#0b0f15"
            },

            textColor:
              "#aab4c3"
          },

          grid: {
            vertLines: {
              color:
                "rgba(255,255,255,0.04)"
            },

            horzLines: {
              color:
                "rgba(255,255,255,0.04)"
            }
          },

          crosshair: {
            mode:
              CrosshairMode.Normal
          },

          rightPriceScale: {
            borderColor:
              "#263140"
          },

          timeScale: {
            borderColor:
              "#263140",

            timeVisible:
              true,

            secondsVisible:
              false
          }
        }
      );


    const candleSeries =
      chart.addCandlestickSeries({
        upColor:
          "#26a69a",

        downColor:
          "#ef5350",

        borderVisible:
          false,

        wickUpColor:
          "#26a69a",

        wickDownColor:
          "#ef5350"
      });


    const formattedCandles =
      candles.map(
        candle => ({
          time:
            Math.floor(
              new Date(
                candle.date
              ).getTime() /
              1000
            ),

          open:
            candle.open,

          high:
            candle.high,

          low:
            candle.low,

          close:
            candle.close
        })
      );


    candleSeries.setData(
      formattedCandles
    );


    chart.timeScale()
      .fitContent();


    const resizeObserver =
      new ResizeObserver(
        entries => {

          const entry =
            entries[0];

          if (!entry) {
            return;
          }


          const {
            width,
            height
          } =
            entry.contentRect;


          chart.applyOptions({
            width,
            height
          });

        }
      );


    resizeObserver.observe(
      container
    );


    return () => {

      resizeObserver.disconnect();

      chart.remove();
    };


  }, [
    open,
    candles
  ]);


  if (!open) {
    return null;
  }


  return (

    <div className="chartOverlay">

      <div className="chartModal">


        <div className="chartHeader">


          <div>

            <span className="chartEyebrow">
              NSE F&O
            </span>

            <h2>
              {
                symbol
                  ?.replace(
                    ".NS",
                    ""
                  )
              }

              <span className="chartTimeframe">
                {
                  timeframe
                    ?.toUpperCase()
                }
              </span>

            </h2>

          </div>


          <button
            className="chartCloseButton"
            onClick={onClose}
            aria-label="Close chart"
          >
            ×
          </button>


        </div>


        <div
          className="chartContainer"
          ref={
            chartContainerRef
          }
        />


      </div>

    </div>
  );
}


export default ChartModal;