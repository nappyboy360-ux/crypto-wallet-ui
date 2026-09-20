import { ASSETS, SYMBOLS, type Prices, type Symbol } from "./wallet";

export type MarketStatus = "loading" | "live" | "offline";

const CG: Record<Symbol, string> = {
  ETH: "ethereum",
  TRX: "tron",
  USDT: "tether",
};

const IDS_CSV = ASSETS.map((a) => CG[a.symbol]).join(",");

interface MarketRow {
  id: string;
  current_price: number;
  price_change_percentage_24h: number | null;
  high_24h: number;
  low_24h: number;
  market_cap: number;
  total_volume: number;
}

/** Live prices + 24h stats from CoinGecko (free, CORS-enabled). */
export async function fetchQuotes(): Promise<Prices> {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${IDS_CSV}&price_change_percentage=24h`,
    { headers: { accept: "application/json" } },
  );
  if (!res.ok) throw new Error("market " + res.status);
  const rows = (await res.json()) as MarketRow[];
  const byId: Record<string, MarketRow> = {};
  rows.forEach((r) => (byId[r.id] = r));
  const out = {} as Prices;
  for (const s of SYMBOLS) {
    const r = byId[CG[s]];
    if (!r) throw new Error("missing " + s);
    out[s] = {
      price: r.current_price,
      change: r.price_change_percentage_24h ?? 0,
      high: r.high_24h ?? r.current_price,
      low: r.low_24h ?? r.current_price,
      cap: r.market_cap ?? 0,
      vol: r.total_volume ?? 0,
      dir: 0,
      tick: 0,
    };
  }
  return out;
}

/** Real price history for the detail chart. */
export async function fetchHistory(sym: Symbol, days: 1 | 7 | 365): Promise<number[]> {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${CG[sym]}/market_chart?vs_currency=usd&days=${days}`,
    { headers: { accept: "application/json" } },
  );
  if (!res.ok) throw new Error("history " + res.status);
  const j = (await res.json()) as { prices: [number, number][] };
  return j.prices.map((p) => p[1]);
}

export function fmtBig(n: number): string {
  if (!n) return "—";
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  return String(Math.round(n));
}

/* ---------- top movers (live, from top 25 by market cap) ---------- */

export interface Mover {
  id: string;
  name: string;
  symbol: string;
  price: number;
  change: number;
  image: string;
}

let moversCache: { at: number; data: Mover[] } | null = null;

export async function fetchMovers(force = false): Promise<Mover[]> {
  if (!force && moversCache && Date.now() - moversCache.at < 10 * 60 * 1000) return moversCache.data;
  const res = await fetch(
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=25&page=1&price_change_percentage=24h",
    { headers: { accept: "application/json" } },
  );
  if (!res.ok) throw new Error("movers " + res.status);
  const rows = (await res.json()) as {
    id: string;
    name: string;
    symbol: string;
    current_price: number;
    price_change_percentage_24h: number | null;
    image: string;
  }[];
  const data = rows.map((r) => ({
    id: r.id,
    name: r.name,
    symbol: r.symbol.toUpperCase(),
    price: r.current_price,
    change: r.price_change_percentage_24h ?? 0,
    image: r.image,
  }));
  moversCache = { at: Date.now(), data };
  return data;
}

/* ---------- crypto news (CryptoCompare, CoinDesk RSS fallback) ---------- */

/* ---------- trending coins (CoinGecko) ---------- */

export interface TrendingCoin {
  id: string;
  name: string;
  symbol: string;
  rank: number | null;
  image: string;
}

let trendingCache: { at: number; data: TrendingCoin[] } | null = null;

export async function fetchTrending(force = false): Promise<TrendingCoin[]> {
  if (!force && trendingCache && Date.now() - trendingCache.at < 10 * 60 * 1000) return trendingCache.data;
  const res = await fetch("https://api.coingecko.com/api/v3/search/trending", {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error("trending " + res.status);
  const j = (await res.json()) as {
    coins?: { item: { id: string; name: string; symbol: string; market_cap_rank: number | null; thumb: string } }[];
  };
  const coins = j.coins;
  if (!Array.isArray(coins) || !coins.length) throw new Error("trending empty");
  const data = coins.slice(0, 8).map((c) => ({
    id: c.item.id,
    name: c.item.name,
    symbol: c.item.symbol,
    rank: c.item.market_cap_rank ?? null,
    image: c.item.thumb,
  }));
  trendingCache = { at: Date.now(), data };
  return data;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  ts: number;
  image?: string;
}

let newsCache: { at: number; data: NewsItem[] } | null = null;

export async function fetchNews(force = false): Promise<NewsItem[]> {
  if (!force && newsCache && Date.now() - newsCache.at < 10 * 60 * 1000) return newsCache.data;
  try {
    const r = await fetch("https://min-api.cryptocompare.com/data/v2/news/?lang=EN");
    if (r.ok) {
      const j = (await r.json()) as { Data?: any[] };
      const data = j?.Data;
      if (Array.isArray(data) && data.length) {
        const items: NewsItem[] = data.slice(0, 8).map((d) => ({
          id: String(d.id ?? d.url),
          title: String(d.title ?? ""),
          source: String(d.author || d.exchange || "Crypto"),
          url: String(d.url),
          ts: d.publish_ts ?? Math.floor(Date.now() / 1000),
          image: d.image_url ? String(d.image_url) : undefined,
        }));
        newsCache = { at: Date.now(), data: items };
        return items;
      }
    }
  } catch {
    /* fall through to RSS */
  }
  const r2 = await fetch(
    "https://api.rss2json.com/v1/api.json?rss_url=" +
      encodeURIComponent("https://www.coindesk.com/arc/outboundfeeds/rss/"),
  );
  if (!r2.ok) throw new Error("news " + r2.status);
  const j2 = (await r2.json()) as { items?: any[] };
  const items = j2?.items;
  if (!Array.isArray(items) || !items.length) throw new Error("news empty");
  const data: NewsItem[] = items.slice(0, 8).map((it, i) => ({
    id: String(it.link ?? i),
    title: String(it.title ?? ""),
    source: "CoinDesk",
    url: String(it.link ?? "#"),
    ts: it.pubDate ? Math.floor(new Date(it.pubDate).getTime() / 1000) : Math.floor(Date.now() / 1000),
    image: it.thumbnail ? String(it.thumbnail) : undefined,
  }));
  newsCache = { at: Date.now(), data };
  return data;
}
