import { useEffect, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { IconArrowRight, IconRefresh } from "./icons";

const STOCKS = [
  { symbol: "AAPL", name: "Apple", color: "#1c2423" },
  { symbol: "NVDA", name: "NVIDIA", color: "#5b8c20" },
  { symbol: "MSFT", name: "Microsoft", color: "#1679aa" },
  { symbol: "TSLA", name: "Tesla", color: "#c53b46" },
];

export function StockWatchlist() {
  const host = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let stopped = false;
    setPhase("loading");

    // Keep the third-party widget's DOM separate from React's managed children.
    const container = document.createElement("div");
    container.className = "tradingview-widget-container";
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    const credit = document.createElement("div");
    credit.className = "tradingview-widget-copyright";
    const link = document.createElement("a");
    link.href = "https://www.tradingview.com/markets/stocks-usa/?utm_source=coifold&utm_medium=widget&utm_campaign=market-overview";
    link.target = "_blank";
    link.rel = "noopener noreferrer nofollow";
    link.textContent = "Stock market quotes by TradingView";
    credit.append(link);
    container.append(widget, credit);
    element.append(container);

    const fail = () => { if (!stopped) setPhase("error"); };
    const timeout = window.setTimeout(fail, 18_000);
    const frames = new Set<HTMLIFrameElement>();
    const onFrameLoad = () => {
      if (!stopped) {
        window.clearTimeout(timeout);
        setPhase("ready");
      }
    };
    const observer = new MutationObserver(() => {
      container.querySelectorAll("iframe").forEach((frame) => {
        if (frames.has(frame)) return;
        frame.title = "U.S. stock quotes from TradingView";
        frames.add(frame);
        frame.addEventListener("load", onFrameLoad);
      });
    });
    observer.observe(container, { childList: true, subtree: true });

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js";
    script.async = true;
    script.type = "text/javascript";
    script.onerror = fail;
    script.textContent = JSON.stringify({
      colorTheme: "light",
      dateRange: "1D",
      showChart: false,
      locale: "en",
      width: "100%",
      height: 324,
      isTransparent: true,
      showSymbolLogo: true,
      showFloatingTooltip: false,
      symbolActiveColor: "rgba(11, 94, 84, 0.08)",
      tabs: [{
        title: "U.S. stocks",
        symbols: STOCKS.map((stock) => ({ s: `NASDAQ:${stock.symbol}`, d: stock.name })),
      }],
    });
    container.append(script);

    return () => {
      stopped = true;
      window.clearTimeout(timeout);
      observer.disconnect();
      frames.forEach((frame) => frame.removeEventListener("load", onFrameLoad));
      script.onerror = null;
      container.remove();
    };
  }, [attempt]);

  return (
    <section className="market-section mt-7" aria-labelledby="stocks-title">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div>
          <h2 id="stocks-title" className="text-base font-extrabold tracking-tight">Stocks</h2>
          <p className="mt-0.5 text-xs font-semibold text-sub">A closer look at U.S. companies</p>
        </div>
        <button
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
          disabled={phase === "loading"}
          aria-label="Refresh stock quotes"
          className="market-refresh"
        >
          <IconRefresh className={cn("size-4", phase === "loading" && "motion-safe:animate-spin")} />
        </button>
      </div>

      <div className="relative min-h-[350px] overflow-hidden rounded-2xl border border-line bg-white">
        <div
          ref={host}
          className={cn("stock-widget-host transition-opacity duration-300", phase === "ready" ? "opacity-100" : "pointer-events-none opacity-0")}
          aria-hidden={phase !== "ready"}
          inert={phase !== "ready"}
        />
        {phase !== "ready" && (
          <div className="absolute inset-0 bg-white">
            <div className="flex items-center justify-between border-b border-line px-4 py-3 text-[11px] font-bold text-sub">
              <span>NASDAQ</span>
              <span>{phase === "loading" ? "Fetching quotes" : "Quotes unavailable"}</span>
            </div>
            <div className="divide-y divide-line/70">
              {STOCKS.map((stock) => (
                <a
                  key={stock.symbol}
                  href={`https://www.tradingview.com/symbols/NASDAQ-${stock.symbol}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="market-list-row group"
                  aria-label={`View ${stock.name} stock on TradingView (opens in a new tab)`}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl text-xs font-extrabold text-white" style={{ backgroundColor: stock.color }}>
                    {stock.symbol.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-extrabold">{stock.symbol}</span>
                    <span className="block text-[11px] font-semibold text-sub">{stock.name}</span>
                  </span>
                  {phase === "loading" ? (
                    <span className="h-4 w-16 animate-pulse rounded bg-page" />
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-brand">View quote <IconArrowRight className="size-3.5" /></span>
                  )}
                </a>
              ))}
            </div>
            {phase === "error" && (
              <div role="status" className="px-4 py-2 text-center text-[11px] font-semibold text-sub">
                Feed unavailable. Retry above or open a company for its quote.
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}