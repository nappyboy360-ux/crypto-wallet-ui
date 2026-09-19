import { useEffect, useState } from "react";
import { cn } from "../utils/cn";
import { ASSET_MAP, amt, pct, sparkSeries, type Prices, type Symbol } from "../lib/wallet";
import { fetchHistory, fmtBig } from "../lib/market";
import { CoinIcon, Sparkline } from "./coins";
import { IconChevronLeft, IconEye, IconEyeOff, TriDown, TriUp } from "./icons";

const RANGES = ["1D", "7D", "1Y"] as const;
type Range = (typeof RANGES)[number];

/* simple in-memory cache so range switches feel instant */
const histCache = new Map<string, { at: number; data: number[] }>();
const TTL = 10 * 60 * 1000;

export function AssetDetail({
  symbol,
  prices,
  money,
  portfolio,
  hideBalance,
  simulated,
  onBack,
  onSend,
  onReceive,
}: {
  symbol: Symbol;
  prices: Prices;
  money: (n: number) => string;
  portfolio: { holdings: Record<Symbol, number>; staked: Record<Symbol, number> };
  hideBalance: boolean;
  simulated: boolean;
  onBack: () => void;
  onSend: () => void;
  onReceive: () => void;
}) {
  const meta = ASSET_MAP[symbol];
  const p = prices[symbol];
  const [range, setRange] = useState<Range>("7D");
  const [localHide, setLocalHide] = useState(false);
  const [hist, setHist] = useState<number[] | null>(null);
  const [chartErr, setChartErr] = useState(false);
  const [reload, setReload] = useState(0);
  const hidden = hideBalance || localHide;

  /* real price history; synthetic walk while offline */
  useEffect(() => {
    let stop = false;
    const key = `${symbol}:${range}`;
    const hit = histCache.get(key);
    if (hit && Date.now() - hit.at < TTL) {
      setHist(hit.data);
      setChartErr(false);
      return;
    }
    setHist(null);
    setChartErr(false);
    if (simulated) {
      setHist(sparkSeries(symbol, p.change, range, 80));
      return;
    }
    fetchHistory(symbol, range === "1D" ? 1 : range === "7D" ? 7 : 365)
      .then((data) => {
        if (stop) return;
        histCache.set(key, { at: Date.now(), data });
        setHist(data);
      })
      .catch(() => {
        if (!stop) setChartErr(true);
      });
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, range, simulated, reload]);

  const holdings = portfolio.holdings[symbol];
  const staked = portfolio.staked[symbol];
  const value = holdings * p.price;
  const pos = p.change >= 0;

  const stats: [string, string][] = [
    ["24h High", hidden ? "—" : money(p.high)],
    ["24h Low", hidden ? "—" : money(p.low)],
    ["Market Cap", fmtBig(p.cap)],
    ["24h Volume", fmtBig(p.vol)],
  ];

  return (
    <div className="space-y-4">
      <div className="rise flex items-center gap-3 pt-1">
        <button
          onClick={onBack}
          aria-label="Back"
          className="grid size-10 place-items-center rounded-full text-sub transition hover:bg-line active:scale-90"
        >
          <IconChevronLeft className="size-5.5" strokeWidth={2.2} />
        </button>
        <CoinIcon symbol={symbol} className="size-11" />
        <div className="min-w-0 flex-1">
          <div className="font-display text-xl font-bold leading-tight tracking-tight">{meta.name}</div>
          <div className="text-xs font-bold text-faint">
            {symbol} · {meta.network}
          </div>
        </div>
        <button
          onClick={() => setLocalHide((v) => !v)}
          aria-label="Toggle price"
          className="grid size-10 place-items-center rounded-full text-sub transition hover:bg-line active:scale-90"
        >
          {localHide ? <IconEyeOff className="size-5" /> : <IconEye className="size-5" />}
        </button>
      </div>

      <div className="rise rounded-2xl border border-line bg-white p-5 shadow-card" style={{ animationDelay: "60ms" }}>
        <div className="flex items-end justify-between gap-3">
          <div className="num text-[36px] font-bold leading-none tracking-tight">
            {hidden ? "••••••" : money(p.price)}
          </div>
          <span
            className={cn(
              "num mb-0.5 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-extrabold",
              pos ? "bg-up/10 text-up" : "bg-down/10 text-down",
            )}
          >
            {pos ? <TriUp /> : <TriDown />} {pct(p.change)}
          </span>
        </div>
        <div className="mt-1 text-xs font-bold text-sub">24h change · market data</div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs font-extrabold uppercase tracking-wide text-faint">Price</span>
          <div className="flex gap-1 rounded-lg bg-page p-0.5">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-extrabold transition active:scale-95",
                  range === r ? "bg-white text-ink shadow-card" : "text-sub hover:text-ink",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div key={`${symbol}-${range}-${hist ? "live" : chartErr ? "err" : "loading"}`} className="mt-2">
          {chartErr ? (
            <div className="flex h-28 flex-col items-center justify-center gap-2 rounded-xl bg-page/60">
              <span className="text-[13px] font-bold text-sub">Couldn't load price history</span>
              <button
                onClick={() => setReload((x) => x + 1)}
                className="rounded-full bg-brand px-4 py-1.5 text-xs font-extrabold text-white transition hover:bg-brand-deep active:scale-95"
              >
                Retry
              </button>
            </div>
          ) : hist === null ? (
            <div className="flex h-28 flex-col justify-end gap-1.5 px-1">
              <div className="h-2.5 w-full animate-pulse rounded-full bg-line" />
              <div className="h-2.5 w-2/3 animate-pulse rounded-full bg-line" style={{ animationDelay: "120ms" }} />
              <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-line" style={{ animationDelay: "240ms" }} />
            </div>
          ) : (
            <Sparkline id={`spark-${symbol}-${range}`} series={hist} positive={pos} className="h-28 w-full" />
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {stats.map(([k, v], i) => (
            <div
              key={k}
              className="rise rounded-xl bg-page/70 px-3.5 py-3"
              style={{ animationDelay: `${120 + i * 50}ms` }}
            >
              <div className="text-[11px] font-extrabold uppercase tracking-wide text-faint">{k}</div>
              <div className="num mt-0.5 text-[15px] font-bold">{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rise rounded-2xl border border-line bg-white p-5 shadow-card" style={{ animationDelay: "140ms" }}>
        <div className="text-xs font-extrabold uppercase tracking-wide text-faint">Your holdings</div>
        <div className="mt-2 flex items-end justify-between">
          <div className="num text-[26px] font-bold tracking-tight">{hidden ? "••••" : money(value)}</div>
          <div className="num text-right text-[15px] font-bold text-sub">
            {amt(holdings, symbol)} {symbol}
          </div>
        </div>
        {staked > 0 && (
          <div className="mt-2 flex justify-between text-[13px] font-bold text-sub">
            <span>
              of which <span className="text-gold">staked</span>
            </span>
            <span className="num">
              {amt(staked, symbol)} {symbol}
            </span>
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button
            onClick={onSend}
            className="rounded-xl bg-brand py-3 text-[15px] font-extrabold text-white shadow-card transition hover:bg-brand-deep active:scale-[0.98]"
          >
            Send
          </button>
          <button
            onClick={onReceive}
            className="rounded-xl bg-brand-soft py-3 text-[15px] font-extrabold text-brand transition hover:bg-brand hover:text-white active:scale-[0.98]"
          >
            Receive
          </button>
        </div>
      </div>

      <div className="rise flex items-start gap-2 px-1 pb-2 text-xs font-bold leading-relaxed text-faint" style={{ animationDelay: "200ms" }}>
        <IconEye className="mt-0.5 size-4 shrink-0" />
        {meta.name} price and stats refresh automatically from live market data.
      </div>
    </div>
  );
}
