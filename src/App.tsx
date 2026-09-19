import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "./utils/cn";
import {
  ASSETS,
  CURRENCIES,
  SYMBOLS,
  amt,
  clamp,
  defaultWallets,
  initQuotes,
  load,
  makeAddress,
  makeMoney,
  pct,
  save,
  shorten,
  uid,
  WALLET_COLORS,
  type AssetMeta,
  type Currency,
  type Prices,
  type Symbol,
  type TxItem,
  type Wallet,
} from "./lib/wallet";
import {
  fetchMovers,
  fetchNews,
  fetchQuotes,
  fetchTrending,
  type MarketStatus,
  type Mover,
  type NewsItem,
  type TrendingCoin,
} from "./lib/market";
import { useCountUp } from "./lib/useCountUp";
import { CoinIcon } from "./components/coins";
import { ToastStack, type Toast } from "./components/sheets";
import { AssetDetail } from "./components/AssetDetail";
import { StockWatchlist } from "./components/StockWatchlist";
import {
  EarnFlow,
  ReceiveFlow,
  ScanFlow,
  SendFlow,
  SettingsFlow,
  SwapFlow,
} from "./components/flows";
import {
  IconArrowRight,
  IconChart,
  IconCheck,
  IconChevronDown,
  IconClock,
  IconEye,
  IconEyeOff,
  IconGear,
  IconHome,
  IconP2P,
  IconPlus,
  IconReceive,
  IconRefresh,
  IconScan,
  IconSend,
  IconSwap,
  IconWallet,
  IconX,
  IconZap,
  TriDown,
  TriUp,
} from "./components/icons";

type Screen = { t: "home" } | { t: "asset"; sym: Symbol };

type Sheet =
  | { kind: "send"; sym?: Symbol; addr?: string }
  | { kind: "receive"; sym?: Symbol }
  | { kind: "swap" }
  | { kind: "scan" }
  | { kind: "earn" }
  | { kind: "settings" }
  | null;

export default function App() {
  /* ---------- state ---------- */
  const [wallets, setWallets] = useState<Wallet[]>(() =>
    load("cf.wallets.v5", defaultWallets())
      .filter((w) => w.id !== "w-trade")
      .map((w) => ({ ...w, txs: w.txs ?? [] })),
  );
  const [activeId, setActiveId] = useState<string>(() => load("cf.active", "w-main"));
  const wallet = wallets.find((w) => w.id === activeId) ?? wallets[0];

  const [prices, setPrices] = useState<Prices>(initQuotes);
  const [status, setStatus] = useState<MarketStatus>("loading");
  const [lastSync, setLastSync] = useState(0);
  const [currency, setCurrency] = useState<Currency>(() => load("cf.currency", "USD" as Currency));
  const [hideBalance, setHideBalance] = useState<boolean>(() => load("cf.hide", false));
  const [promo, setPromo] = useState<boolean>(() => load("cf.promo", true));
  const [twoFA, setTwoFA] = useState<boolean>(() => load("cf.2fa", false));
  const [notif, setNotif] = useState<boolean>(() => load("cf.notif", true));


  const [screen, setScreen] = useState<Screen>({ t: "home" });
  const [tab, setTab] = useState<"home" | "markets" | "activity">("home");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [movers, setMovers] = useState<Mover[] | null>(null);
  const [moversErr, setMoversErr] = useState(false);
  const [moversRetry, setMoversRetry] = useState(0);
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [newsErr, setNewsErr] = useState(false);
  const [newsRetry, setNewsRetry] = useState(0);
  const [trending, setTrending] = useState<TrendingCoin[] | null>(null);
  const [trendingErr, setTrendingErr] = useState(false);
  const [trendingRetry, setTrendingRetry] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [time, setTime] = useState(() => new Date());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const money = useMemo(() => makeMoney(currency), [currency]);
  const cur = CURRENCIES[currency].s;

  /* ---------- persistence ---------- */
  useEffect(() => save("cf.wallets.v5", wallets), [wallets]);
  useEffect(() => save("cf.active", activeId), [activeId]);
  useEffect(() => save("cf.currency", currency), [currency]);
  useEffect(() => save("cf.hide", hideBalance), [hideBalance]);
  useEffect(() => save("cf.promo", promo), [promo]);
  useEffect(() => save("cf.2fa", twoFA), [twoFA]);
  useEffect(() => save("cf.notif", notif), [notif]);

  /* ---------- live market (CoinGecko, refresh every 30s) ---------- */
  const refresh = useCallback(async () => {
    try {
      const q = await fetchQuotes();
      setPrices((prev) => {
        const next = { ...prev };
        for (const s of SYMBOLS) {
          next[s] = {
            ...q[s],
            dir: q[s].price > prev[s].price ? 1 : q[s].price < prev[s].price ? -1 : 0,
            tick: prev[s].tick + 1,
          };
        }
        return next;
      });
      setLastSync(Date.now());
      setStatus("live");
    } catch {
      setStatus("offline");
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  /* home tab: trending coins */
  useEffect(() => {
    if (tab !== "home") return;
    let stop = false;
    setTrendingErr(false);
    fetchTrending(trendingRetry > 0)
      .then((t) => {
        if (!stop) {
          setTrending(t);
          setTrendingErr(false);
        }
      })
      .catch(() => {
        if (!stop) setTrendingErr(true);
      });
    return () => {
      stop = true;
    };
  }, [tab, trendingRetry]);

  /* markets tab: live movers + news */
  useEffect(() => {
    if (tab !== "markets") return;
    let stop = false;
    fetchMovers(moversRetry > 0)
      .then((m) => {
        if (!stop) {
          setMovers(m);
          setMoversErr(false);
        }
      })
      .catch(() => {
        if (!stop) setMoversErr(true);
      });
    fetchNews(newsRetry > 0)
      .then((nn) => {
        if (!stop) {
          setNews(nn);
          setNewsErr(false);
        }
      })
      .catch(() => {
        if (!stop) setNewsErr(true);
      });
    return () => {
      stop = true;
    };
  }, [tab, moversRetry, newsRetry]);

  /* ---------- toasts ---------- */
  const notify = (msg: string, tone: "ok" | "err" | "info" = "ok") => {
    const id = ++toastId.current;
    setToasts((ts) => [...ts.slice(-2), { id, msg, tone }]);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 2800);
  };

  /* ---------- sheet scroll lock ---------- */
  useEffect(() => {
    document.body.style.overflow = sheet ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sheet]);

  /* ---------- wallet mutations (all logged to activity) ---------- */
  const mutate = (fn: (w: Wallet) => Wallet) =>
    setWallets((ws) => ws.map((w) => (w.id === wallet.id ? fn(w) : w)));

  const withTx = (w: Wallet, t: Omit<TxItem, "id" | "at">): Wallet => ({
    ...w,
    txs: [{ id: uid(), at: Date.now(), ...t }, ...(w.txs ?? [])].slice(0, 50),
  });

  const available = (s: Symbol) =>
    Math.max(0, wallet.portfolio.holdings[s] - wallet.portfolio.staked[s]);

  const doSend = (sym: Symbol, amount: number, addr: string) => {
    const fee = sym === "ETH" ? 769.92 / prices.ETH.price : amount * 0.001;
    const total = amount + fee;
    mutate((w) =>
      withTx(
        {
          ...w,
          portfolio: { ...w.portfolio, holdings: { ...w.portfolio.holdings, [sym]: Math.max(0, w.portfolio.holdings[sym] - total) } },
        },
        { type: "send", title: `Sent ${amt(amount, sym)} ${sym}`, sub: `To ${shorten(addr, 8, 6)}`, sym, usd: -(total * prices[sym].price) },
      ),
    );
  };

  const doSwap = (from: Symbol, to: Symbol, n: number) => {
    const rate = (prices[from].price / prices[to].price) * 0.995;
    const gas = 769.92 / prices.ETH.price;
    mutate((w) =>
      withTx(
        {
          ...w,
          portfolio: {
            ...w.portfolio,
            holdings: {
              ...w.portfolio.holdings,
              [from]: Math.max(0, w.portfolio.holdings[from] - (from === "ETH" ? n + gas : n)),
              [to]: w.portfolio.holdings[to] + (to === "ETH" ? n * rate - gas : n * rate),
            },
          },
        },
        { type: "swap", title: `Swapped ${from} for ${to}`, sub: `1 ${from} = ${amt(rate, to)} ${to} · gas ${money(769.92)}`, sym: to, usd: 0 },
      ),
    );
  };

  const doStake = (sym: Symbol, n: number) =>
    mutate((w) =>
      withTx(
        {
          ...w,
          portfolio: {
            holdings: { ...w.portfolio.holdings, [sym]: Math.max(0, w.portfolio.holdings[sym] - n) },
            staked: { ...w.portfolio.staked, [sym]: w.portfolio.staked[sym] + n },
          },
        },
        { type: "stake", title: `Staked ${amt(n, sym)} ${sym}`, sub: "Flexible staking", sym, usd: 0 },
      ),
    );

  const doUnstake = (sym: Symbol, n: number) =>
    mutate((w) =>
      withTx(
        {
          ...w,
          portfolio: {
            holdings: { ...w.portfolio.holdings, [sym]: w.portfolio.holdings[sym] + n },
            staked: { ...w.portfolio.staked, [sym]: Math.max(0, w.portfolio.staked[sym] - n) },
          },
        },
        { type: "unstake", title: `Unstaked ${amt(n, sym)} ${sym}`, sub: "Flexible staking", sym, usd: 0 },
      ),
    );

  const addWallet = () => {
    const name = newName.trim() || `Wallet ${wallets.length + 1}`;
    const id = "w-" + uid().toLowerCase();
    const w: Wallet = {
      id,
      name,
      color: WALLET_COLORS[wallets.length % WALLET_COLORS.length],
      portfolio: {
        holdings: { ETH: 0, TRX: 0, USDT: 0 },
        staked: { ETH: 0, TRX: 0, USDT: 0 },
      },
      txs: [],
    };
    setWallets((ws) => [...ws, w]);
    setActiveId(id);
    setNewName("");
    setAdding(false);
    setMenuOpen(false);
    notify(`Created ${name}`);
  };

  const erase = () => {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("cf."))
      .forEach((k) => localStorage.removeItem(k));
    setWallets(defaultWallets());
    setActiveId("w-main");
    setCurrency("USD");
    setHideBalance(false);
    setPromo(true);
    setTwoFA(false);
    setNotif(true);
    setSheet(null);
    setScreen({ t: "home" });
    notify("All wallet data erased", "info");
  };

  /* ---------- derived ---------- */
  const total = SYMBOLS.reduce((s, x) => s + wallet.portfolio.holdings[x] * prices[x].price, 0);
  const shownTotal = useCountUp(total);
  const delta24 = SYMBOLS.reduce((s, x) => s + (wallet.portfolio.holdings[x] * prices[x].price * prices[x].change) / 100, 0);
  const walletBalance = (w: Wallet) => SYMBOLS.reduce((s, x) => s + w.portfolio.holdings[x] * prices[x].price, 0);

  const masked = hideBalance;
  const connecting = status === "loading";

  /* keep prices moving with a local random walk while offline */
  useEffect(() => {
    if (status !== "offline") return;
    const t = setInterval(() => {
      setPrices((p) => {
        const next = { ...p };
        const count = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
          const s = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
          const drift = (Math.random() - 0.5) * 0.003;
          next[s] = {
            ...next[s],
            price: Math.max(0.000001, next[s].price * (1 + drift)),
            change: clamp(next[s].change + (Math.random() - 0.5) * 0.06, -9, 9),
            dir: drift >= 0 ? 1 : -1,
            tick: next[s].tick + 1,
          };
        }
        return next;
      });
    }, 4000);
    return () => clearInterval(t);
  }, [status]);
  const clock = time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M/i, "");

  const actions = [
    { label: "Send", icon: <IconSend className="size-6" />, run: () => setSheet({ kind: "send" }) },
    { label: "Receive", icon: <IconReceive className="size-6" />, run: () => setSheet({ kind: "receive" }) },
    { label: "Swap", icon: <IconSwap className="size-6" />, run: () => setSheet({ kind: "swap" }) },
  ];

  const goTab = (t: "home" | "markets" | "activity") => {
    setTab(t);
    setScreen({ t: "home" });
  };

  const gainers = movers ? [...movers].sort((a, b) => b.change - a.change).slice(0, 3) : [];
  const losers = movers ? [...movers].sort((a, b) => a.change - b.change).slice(0, 3) : [];

  const assetRow = (a: AssetMeta, i: number) => {
    const p = prices[a.symbol];
    const h = wallet.portfolio.holdings[a.symbol];
    const pos = p.change >= 0;
    return (
      <button
        key={a.symbol}
        onClick={() => setScreen({ t: "asset", sym: a.symbol })}
        className="rise group flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-page/70 active:bg-page"
        style={{ animationDelay: `${150 + i * 60}ms` }}
      >
        <span className="transition-transform duration-300 group-hover:scale-110 group-active:scale-95">
          <CoinIcon symbol={a.symbol} className="size-10" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-extrabold leading-tight">{a.name}</span>
          <span className="mt-0.5 block text-[13px] font-semibold text-sub">
            {connecting ? (
              <span className="inline-block h-3.5 w-20 animate-pulse rounded bg-line align-middle" />
            ) : (
              <>
                <span key={p.tick} className={cn("num", p.dir > 0 && "tick-up", p.dir < 0 && "tick-down")}>
                  {masked ? "••••••" : money(p.price)}
                </span>{" "}
                <span className={pos ? "text-up" : "text-down"}>{pct(p.change)}</span>
              </>
            )}
          </span>
        </span>
        <span className="text-right">
          {connecting ? (
            <span className="mx-auto mt-1 block h-4 w-16 animate-pulse rounded bg-line" />
          ) : (
            <span className={cn("num block text-[15px] font-bold leading-tight", h === 0 && "text-faint")}>
              {masked ? "••••" : money(h * p.price)}
            </span>
          )}
          <span className="num mt-0.5 block text-[13px] font-semibold text-sub">
            {amt(h, a.symbol)} {a.symbol}
          </span>
        </span>
      </button>
    );
  };

  /* ---------- render ---------- */
  return (
    <div className="flex min-h-dvh justify-center font-sans">
      <div className="relative flex min-h-dvh w-full max-w-[430px] flex-col bg-surface md:border-x md:border-line md:shadow-[0_0_60px_-20px_rgba(15,27,45,0.35)]">
        {/* sticky app bar */}
        <div className="sticky top-0 z-40 border-b border-line bg-white/95 shadow-[0_1px_0_rgba(255,255,255,0.6),0_8px_24px_-20px_rgba(15,27,45,0.35)] backdrop-blur-md">
          {/* status bar */}
          <div className="px-6 pt-4 pb-1 text-[13px] font-bold">
            <span className="num">{clock}</span>
          </div>

          {screen.t === "home" && status === "live" && (
            <div className="border-t border-line/60">
              <Ticker quotes={prices} money={money} />
            </div>
          )}

          {/* header */}
          <header className="flex items-center justify-between px-4 pb-3 pt-2">
          {screen.t === "home" ? (
            <>
              <div className="relative flex items-center gap-1">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label="Switch wallet"
                  className="relative grid size-11 place-items-center overflow-hidden rounded-full text-white shadow-card transition active:scale-95"
                  style={{ background: wallet.color }}
                >
                  <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/30 via-transparent to-black/15" />
                  <IconWallet className="relative size-5" />
                </button>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label="Wallet menu"
                  className="grid size-8 place-items-center rounded-full text-sub transition hover:bg-line"
                >
                  <IconChevronDown className={cn("size-4 transition-transform", menuOpen && "rotate-180")} />
                </button>

                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                    <div className="animate-fade absolute left-0 top-12 z-40 w-72 rounded-2xl border border-line bg-white p-2 shadow-card">
                      <div className="px-2 pb-1.5 pt-1 text-[11px] font-extrabold uppercase tracking-wider text-faint">
                        Your wallets
                      </div>
                      {wallets.map((w) => (
                        <button
                          key={w.id}
                          onClick={() => {
                            setActiveId(w.id);
                            setMenuOpen(false);
                            notify(`Switched to ${w.name}`, "info");
                          }}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition",
                            w.id === wallet.id ? "bg-brand-soft" : "hover:bg-page",
                          )}
                        >
                          <span
                            className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-full text-white"
                            style={{ background: w.color }}
                          >
                            <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/30 via-transparent to-black/15" />
                            <IconWallet className="relative size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold">{w.name}</span>
                            <span className="num block text-xs font-semibold text-sub">
                              {masked ? "••••" : connecting ? "—" : money(walletBalance(w))}
                            </span>
                          </span>
                          {w.id === wallet.id && <IconCheck className="size-4 shrink-0 text-brand" strokeWidth={2.4} />}
                        </button>
                      ))}
                      <div className="mt-1.5 border-t border-line pt-1.5">
                        {adding ? (
                          <div className="flex gap-1.5 px-1 pb-1">
                            <input
                              autoFocus
                              value={newName}
                              onChange={(e) => setNewName(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && addWallet()}
                              placeholder="Wallet name"
                              className="w-full min-w-0 flex-1 rounded-lg border border-line bg-page/60 px-3 py-2 text-sm font-semibold outline-none focus:border-brand"
                            />
                            <button
                              onClick={addWallet}
                              aria-label="Create wallet"
                              className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand text-white transition hover:bg-brand-deep"
                            >
                              <IconPlus className="size-4.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAdding(true)}
                            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 text-sm font-bold text-brand transition hover:bg-brand-soft"
                          >
                            <span className="grid size-8 place-items-center rounded-full bg-brand-soft">
                              <IconPlus className="size-4" />
                            </span>
                            New wallet
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <h1 className="font-display text-lg font-bold tracking-tight">
                {tab === "markets" ? "Markets" : tab === "activity" ? "Activity" : "Home"}
              </h1>

              <div className="flex gap-1">
                <button
                  onClick={() => setSheet({ kind: "scan" })}
                  aria-label="Scan QR"
                  className="grid size-10 place-items-center rounded-full text-ink transition hover:bg-line"
                >
                  <IconScan className="size-5" />
                </button>
                <button
                  onClick={() => setSheet({ kind: "settings" })}
                  aria-label="Settings"
                  className="grid size-10 place-items-center rounded-full text-ink transition hover:bg-line"
                >
                  <IconGear className="size-5" />
                </button>
              </div>
            </>
          ) : (
            <div className="h-11" />
          )}
          </header>
        </div>

        {/* content */}
        <main className="flex-1 px-5 pb-28 pt-5">
          <div key={screen.t === "asset" ? "detail" : tab} className="animate-fade-up">
            {tab === "markets" ? (
              <div className="space-y-7">
                {/* top movers */}
                <section>
                  <div className="mb-2.5 flex items-center justify-between px-1">
                    <h2 className="text-base font-extrabold tracking-tight">Top movers</h2>
                    <span className="text-xs font-extrabold text-faint">24h · top 25 by cap</span>
                  </div>
                  {moversErr ? (
                    <ErrorCard msg="Couldn't load movers" onRetry={() => setMoversRetry((x) => x + 1)} />
                  ) : !movers ? (
                    <div className="grid grid-cols-2 gap-3">
                      {[0, 1].map((k) => (
                        <div key={k} className="space-y-2.5 rounded-2xl border border-line bg-white p-4 shadow-card">
                          <div className="h-4 w-20 animate-pulse rounded bg-line" />
                          {[0, 1, 2].map((i) => (
                            <div key={i} className="h-10 animate-pulse rounded-xl bg-line" style={{ animationDelay: `${i * 120}ms` }} />
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <MoverCard title="Gainers" items={gainers} money={money} />
                      <MoverCard title="Losers" items={losers} money={money} />
                    </div>
                  )}
                </section>

                {/* crypto news */}
                <section>
                  <div className="mb-2.5 flex items-center justify-between px-1">
                    <h2 className="text-base font-extrabold tracking-tight">Crypto news</h2>
                    <button
                      onClick={() => setNewsRetry((x) => x + 1)}
                      aria-label="Refresh news"
                      className="grid size-8 place-items-center rounded-full text-brand transition hover:bg-brand-soft active:scale-90"
                    >
                      <IconRefresh className="size-4.5" />
                    </button>
                  </div>
                  {newsErr ? (
                    <ErrorCard msg="Couldn't load news" onRetry={() => setNewsRetry((x) => x + 1)} />
                  ) : !news ? (
                    <div className="space-y-2.5">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="h-[72px] animate-pulse rounded-2xl border border-line bg-white/80"
                          style={{ animationDelay: `${i * 100}ms` }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
                      {news.map((it, i) => (
                        <a
                          key={it.id}
                          href={it.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rise group flex gap-3 border-b border-line px-4 py-3.5 transition last:border-0 hover:bg-page/70"
                          style={{ animationDelay: `${i * 40}ms` }}
                        >
                          <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-page text-xs font-extrabold text-sub">
                            {it.image ? (
                              <img src={it.image} alt="" className="size-full object-cover" />
                            ) : (
                              it.source.slice(0, 1)
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 text-[14px] font-extrabold leading-snug transition group-hover:text-brand">
                              {it.title}
                            </span>
                            <span className="mt-1 block text-xs font-bold text-faint">
                              {it.source} · {timeAgo(it.ts * 1000)}
                            </span>
                          </span>
                          <IconArrowRight className="size-4 shrink-0 self-center text-faint transition group-hover:translate-x-0.5 group-hover:text-brand" />
                        </a>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            ) : tab === "activity" ? (
              <ActivityView txs={wallet.txs ?? []} money={money} onCta={() => setSheet({ kind: "swap" })} />
            ) : screen.t === "asset" ? (
              <AssetDetail
                symbol={screen.sym}
                prices={prices}
                money={money}
                portfolio={wallet.portfolio}
                hideBalance={hideBalance}
                simulated={status === "offline"}
                onBack={() => setScreen({ t: "home" })}
                onSend={() => setSheet({ kind: "send", sym: screen.sym })}
                onReceive={() => setSheet({ kind: "receive", sym: screen.sym })}
              />
            ) : (
              <>
              {/* balance */}
              <section className="rise relative pt-5 text-center">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 -top-14 h-80 bg-[radial-gradient(60%_60%_at_50%_18%,rgba(11,94,84,0.13),transparent_70%)]"
                />
                <div className="relative">
                <div className="flex items-center justify-center gap-2 text-sm font-extrabold uppercase tracking-wide text-sub">
                  Total balance
                  <button
                    onClick={() => {
                      setHideBalance(!hideBalance);
                      notify(hideBalance ? "Balance shown" : "Balance hidden", "info");
                    }}
                    aria-label="Toggle balance visibility"
                    className="grid size-7 place-items-center rounded-full text-faint transition hover:bg-line hover:text-ink"
                  >
                    {masked ? <IconEyeOff className="size-4" /> : <IconEye className="size-4" />}
                  </button>
                </div>
                <div className="num mt-2 text-[44px] font-bold leading-none tracking-tight">
                  {connecting ? (
                    <span className="mx-auto block h-10 w-52 animate-pulse rounded-2xl bg-line align-middle" />
                  ) : masked ? (
                    <span className="tracking-normal">{cur}••••••</span>
                  ) : (
                    <span>{money(shownTotal)}</span>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-center gap-2">
                  {connecting ? (
                    <span className="mx-auto block h-6 w-40 animate-pulse rounded-full bg-line" />
                  ) : (
                    <span
                      className={cn(
                        "num inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-extrabold",
                        delta24 >= 0 ? "bg-up/10 text-up" : "bg-down/10 text-down",
                      )}
                    >
                      {delta24 >= 0 ? <TriUp /> : <TriDown />}
                      {masked ? "••••" : `${money(Math.abs(delta24))} (24h)`}
                    </span>
                  )}
                </div>
                {status !== "offline" && (
                  <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-widest text-faint">
                    <span className="relative flex size-2">
                      {status === "live" && (
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-up opacity-40" />
                      )}
                      <span
                        className={cn(
                          "relative inline-flex size-2 rounded-full",
                          status === "live" ? "bg-up" : "bg-faint",
                        )}
                      />
                    </span>
                    {status === "live" ? (
                      <span>
                        Live · CoinGecko
                        <span className="ml-1 normal-case tracking-normal text-faint/80">
                          · updated <SyncAgo at={lastSync} />
                        </span>
                      </span>
                    ) : (
                      "Connecting to market"
                    )}
                  </div>
                )}
                </div>
              </section>

              {/* actions */}
              <section className="rise mt-7 grid grid-cols-3 gap-4" style={{ animationDelay: "80ms" }}>
                {actions.map((a, i) => (
                    <button
                      key={a.label}
                      onClick={a.run}
                      className="rise group flex flex-col items-center gap-2"
                      style={{ animationDelay: `${100 + i * 45}ms` }}
                    >
                      <span className="grid size-15 place-items-center rounded-2xl bg-gradient-to-b from-[#12755f] to-[#0a4f44] text-white shadow-card shadow-brand/25 ring-1 ring-inset ring-white/15 transition duration-200 group-hover:-translate-y-1 group-hover:from-[#0f6650] group-hover:to-[#084136] group-active:scale-90">
                        {a.icon}
                      </span>
                      <span className="text-xs font-extrabold text-ink">{a.label}</span>
                    </button>
                ))}
              </section>

              {/* promo */}
              {promo && (
                <section
                  className="rise relative mt-6 overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f6b58] via-[#0b5e54] to-[#083f36] p-4 text-white shadow-card"
                  style={{ animationDelay: "150ms" }}
                >
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -right-10 -top-14 size-44 rounded-full bg-white/10 blur-2xl"
                  />
                  <button
                    onClick={() => setPromo(false)}
                    aria-label="Dismiss"
                    className="absolute right-3 top-3 grid size-7 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
                  >
                    <IconX className="size-3.5" />
                  </button>
                  <div className="relative z-10 max-w-[75%]">
                    <h2 className="font-display text-lg font-bold tracking-tight">Earn money</h2>
                    <p className="mt-1 text-[13px] font-bold leading-snug text-white/80">
                      Discover the power of staking and DeFi
                    </p>
                    <button
                      onClick={() => setSheet({ kind: "earn" })}
                      className="mt-2.5 inline-flex items-center gap-1 text-[13px] font-extrabold text-amber-300 transition hover:gap-1.5 hover:text-amber-200"
                    >
                      Learn more
                      <IconArrowRight className="size-3.5" strokeWidth={2.4} />
                    </button>
                  </div>
                  <span className="floaty pointer-events-none absolute -bottom-8 -right-6 grid size-32 select-none place-items-center rounded-full bg-white/10 font-display text-7xl font-bold text-white/25">
                    {cur}
                  </span>
                </section>
              )}

              {/* assets */}
              <section className="mt-6">
                <div className="mb-2.5 flex items-center justify-between px-1">
                  <h2 className="text-base font-extrabold tracking-tight">My assets</h2>
                  <span className="text-xs font-extrabold text-faint">{ASSETS.length} assets · {wallet.name}</span>
                </div>
                <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-card">
                  {ASSETS.map((a, i) => assetRow(a, i))}
                </div>
              </section>

              {/* trending coins */}
              <section className="mt-6">
                <div className="mb-2.5 flex items-center justify-between px-1">
                  <h2 className="text-base font-extrabold tracking-tight">Trending</h2>
                  <button
                    onClick={() => setTrendingRetry((x) => x + 1)}
                    aria-label="Refresh trending"
                    className="grid size-8 place-items-center rounded-full text-brand transition hover:bg-brand-soft active:scale-90"
                  >
                    <IconRefresh className="size-4.5" />
                  </button>
                </div>
                {trendingErr ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-line bg-white px-4 py-3.5 shadow-card">
                    <span className="text-[12.5px] font-bold text-sub">Couldn't load trending</span>
                    <button
                      onClick={() => setTrendingRetry((x) => x + 1)}
                      className="ml-auto text-xs font-extrabold text-brand transition hover:text-brand-deep"
                    >
                      Retry
                    </button>
                  </div>
                ) : !trending ? (
                  <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="h-[54px] w-24 shrink-0 animate-pulse rounded-2xl bg-line"
                        style={{ animationDelay: `${i * 80}ms` }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
                    {trending.map((t, i) => (
                      <button
                        key={t.id}
                        onClick={() => window.open(`https://www.coingecko.com/en/coins/${t.id}`, "_blank", "noopener")}
                        className="rise group flex shrink-0 items-center gap-2.5 rounded-2xl border border-line bg-white px-3 py-2.5 shadow-card transition hover:-translate-y-0.5 hover:border-brand/40"
                        style={{ animationDelay: `${350 + i * 40}ms` }}
                      >
                        <img src={t.image} alt="" className="size-7 shrink-0 rounded-full" />
                        <span className="text-left">
                          <span className="block text-[12.5px] font-extrabold leading-tight transition group-hover:text-brand">
                            {t.symbol}
                          </span>
                          <span className="num block text-[10.5px] font-bold text-faint">#{t.rank ?? "–"}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <StockWatchlist />
              </>
            )}
          </div>
        </main>

        {/* bottom navigation */}
        <nav className="sticky bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur-md">
          <div className="grid grid-cols-5 items-end px-1 pb-[max(env(safe-area-inset-bottom),10px)] pt-1.5">
            <NavBtn label="Home" icon={<IconHome className="size-5.5" />} active={tab === "home"} onClick={() => goTab("home")} />
            <NavBtn label="Markets" icon={<IconChart className="size-5.5" />} active={tab === "markets"} onClick={() => goTab("markets")} />
            <div className="flex justify-center">
              <button
                onClick={() => setSheet({ kind: "scan" })}
                aria-label="Scan QR"
                className="-mt-7 grid size-14 place-items-center rounded-full bg-gradient-to-b from-[#12755f] to-[#0a4f44] text-white shadow-card shadow-brand/40 ring-1 ring-inset ring-white/20 ring-4 ring-white transition hover:from-[#0f6650] hover:to-[#084136] active:scale-90"
              >
                <IconScan className="size-6" />
              </button>
            </div>
            <NavBtn label="Activity" icon={<IconClock className="size-5.5" />} active={tab === "activity"} onClick={() => goTab("activity")} />
            <NavBtn label="Settings" icon={<IconGear className="size-5.5" />} active={false} onClick={() => setSheet({ kind: "settings" })} />
          </div>
        </nav>

        {/* sheets */}
        {sheet?.kind === "send" && (
          <SendFlow
            money={money}
            prices={prices}
            available={available}
            initialSymbol={sheet.sym}
            initialAddress={sheet.addr}
            onSubmit={doSend}
            onDepositETH={() => setSheet({ kind: "receive", sym: "ETH" })}
            onClose={() => setSheet(null)}
          />
        )}
        {sheet?.kind === "receive" && (
          <ReceiveFlow
            initialSymbol={sheet.sym}
            addressOf={(s) =>
              s === "ETH"
                ? "0xc21284c08247962a98e0d2274b4b4a0f214ed4aa"
                : s === "USDT"
                  ? "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
                  : makeAddress(s, wallet.id)
            }
            onClose={() => setSheet(null)}
            notify={notify}
          />
        )}

        {sheet?.kind === "swap" && (
          <SwapFlow
            money={money}
            prices={prices}
            available={available}
            onSubmit={doSwap}
            onDepositETH={() => setSheet({ kind: "receive", sym: "ETH" })}
            onClose={() => setSheet(null)}
          />
        )}

        {sheet?.kind === "scan" && (
          <ScanFlow
            onSend={(addr, sym) => setSheet({ kind: "send", addr, sym })}
            onClose={() => setSheet(null)}
          />
        )}
        {sheet?.kind === "earn" && (
          <EarnFlow
            money={money}
            prices={prices}
            staked={wallet.portfolio.staked}
            available={available}
            onStake={doStake}
            onUnstake={doUnstake}
            onClose={() => setSheet(null)}
            notify={notify}
          />
        )}
        {sheet?.kind === "settings" && (
          <SettingsFlow
            hideBalance={hideBalance}
            setHideBalance={setHideBalance}
            currency={currency}
            setCurrency={setCurrency}
            notifications={notif}
            setNotifications={setNotif}
            twoFA={twoFA}
            setTwoFA={setTwoFA}
            onErase={erase}
            onClose={() => setSheet(null)}
            notify={notify}
          />
        )}

        <ToastStack toasts={toasts} />
      </div>
    </div>
  );
}

/* ---------- live sync indicator (1s heartbeat) ---------- */

function SyncAgo({ at }: { at: number }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  return <span>{s < 5 ? "just now" : s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`}</span>;
}

/* ---------- live price ticker tape ---------- */

function Ticker({ quotes, money }: { quotes: Prices; money: (n: number) => string }) {
  const items = ASSETS.map((a) => {
    const q = quotes[a.symbol];
    const pos = q.change >= 0;
    return (
      <span key={a.symbol} className="flex shrink-0 items-center gap-2 px-5">
        <CoinIcon symbol={a.symbol} className="size-4.5" />
        <span className="text-xs font-extrabold text-ink">{a.symbol}</span>
        <span className="num text-xs font-bold text-sub">{money(q.price)}</span>
        <span
          className={cn("num flex items-center gap-1 text-[11px] font-extrabold", pos ? "text-up" : "text-down")}
        >
          {pos ? <TriUp className="scale-75" /> : <TriDown className="scale-75" />}
          {pct(q.change)}
        </span>
      </span>
    );
  });
  return (
    <div className="overflow-hidden bg-white py-2">
      <div className="marquee flex w-max">
        <div className="flex">{items}</div>
        <div className="flex" aria-hidden>
          {items}
        </div>
      </div>
    </div>
  );
}

/* ---------- bottom nav button ---------- */

function NavBtn({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-1 py-2 text-[10.5px] font-extrabold transition-colors duration-200",
        active ? "text-brand" : "text-faint hover:text-sub active:text-sub",
      )}
    >
      <span className={cn("transition-transform duration-200", active && "-translate-y-0.5 scale-110")}>{icon}</span>
      <span>{label}</span>
      <span
        className={cn(
          "absolute bottom-0.5 size-1 rounded-full bg-brand transition-all duration-300",
          active ? "scale-100 opacity-100" : "scale-0 opacity-0",
        )}
      />
    </button>
  );
}

/* ---------- activity ---------- */

const TX_ICON: Record<TxItem["type"], typeof IconSend> = {
  send: IconSend,
  buy: IconReceive,
  swap: IconSwap,
  p2p: IconP2P,
  stake: IconZap,
  unstake: IconZap,
};

function ErrorCard({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-white px-4 py-8 text-center shadow-card">
      <span className="text-[13px] font-bold text-sub">{msg}</span>
      <button
        onClick={onRetry}
        className="rounded-full bg-brand px-4 py-1.5 text-xs font-extrabold text-white transition hover:bg-brand-deep active:scale-95"
      >
        Retry
      </button>
    </div>
  );
}

function MoverCard({
  title,
  items,
  money,
  href,
}: {
  title: string;
  items: Mover[];
  money: (n: number) => string;
  href?: (m: Mover) => string;
}) {
  const up = title === "Gainers";
  const link = (m: Mover) => (href ? href(m) : `https://www.coingecko.com/en/coins/${m.id}`);
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <div
        className={cn(
          "flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-extrabold",
          up ? "bg-up/5 text-up" : "bg-down/5 text-down",
        )}
      >
        {up ? <TriUp className="scale-125" /> : <TriDown className="scale-125" />}
        {title}
      </div>
      <div className="divide-y divide-line">
        {items.map((m) => (
          <button
            key={m.id}
            onClick={() => window.open(link(m), "_blank", "noopener")}
            className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left transition hover:bg-page/70"
          >
            {m.image ? (
              <img src={m.image} alt="" className="size-7 shrink-0 rounded-full" />
            ) : (
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-page text-[11px] font-extrabold text-sub">
                {m.symbol.slice(0, 1)}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-extrabold leading-tight">{m.symbol}</span>
              <span className="num block text-[11.5px] font-semibold text-faint">{money(m.price)}</span>
            </span>
            <span className={cn("num flex items-center gap-0.5 text-[12.5px] font-extrabold", up ? "text-up" : "text-down")}>
              {up ? <TriUp className="scale-75" /> : <TriDown className="scale-75" />}
              {pct(m.change)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function timeAgo(at: number) {
  const s = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ActivityView({ txs, money, onCta }: { txs: TxItem[]; money: (n: number) => string; onCta: () => void }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  if (txs.length === 0) {
    return (
      <div className="rise flex flex-col items-center rounded-2xl border-2 border-dashed border-line bg-white/60 px-6 py-12 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-brand-soft text-brand">
          <IconClock className="size-6" />
        </span>
        <h3 className="mt-4 font-display text-lg font-bold tracking-tight">No activity yet</h3>
        <p className="mt-1 max-w-[250px] text-[13px] font-bold leading-relaxed text-sub">
          Your sends, buys, swaps and staking will show up here.
        </p>
        <button
          onClick={onCta}
          className="mt-5 rounded-xl bg-brand px-5 py-2.5 text-sm font-extrabold text-white shadow-card transition hover:bg-brand-deep active:scale-[0.98]"
        >
          Make your first trade
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      {txs.map((t, i) => {
        const Icon = TX_ICON[t.type];
        const out = t.usd < 0;
        const zero = t.usd === 0;
        return (
          <div
            key={t.id}
            className="rise flex items-center gap-3 border-b border-line px-4 py-3.5 last:border-0"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-full",
                t.type === "stake" || t.type === "unstake"
                  ? "bg-gold/10 text-gold"
                  : zero
                    ? "bg-brand-soft text-brand"
                    : out
                      ? "bg-down/10 text-down"
                      : "bg-up/10 text-up",
              )}
            >
              <Icon className="size-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] font-extrabold">{t.title}</span>
              <span className="block truncate text-xs font-bold text-faint">
                {t.sub} · {timeAgo(t.at)}
              </span>
            </span>
            <span className={cn("num shrink-0 text-[14px] font-bold", zero ? "text-sub" : out ? "text-down" : "text-up")}>
              {zero ? "—" : (out ? "−" : "+") + money(Math.abs(t.usd))}
            </span>
          </div>
        );
      })}
    </div>
  );
}
