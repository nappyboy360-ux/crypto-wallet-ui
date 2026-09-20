export type Symbol = "ETH" | "TRX" | "USDT";

export interface AssetMeta {
  symbol: Symbol;
  name: string;
  decimals: number;
  network: string;
}

export const ASSETS: AssetMeta[] = [
  { symbol: "ETH", name: "Ethereum", decimals: 5, network: "Ethereum" },
  { symbol: "TRX", name: "Tron", decimals: 4, network: "Tron" },
  { symbol: "USDT", name: "Tether", decimals: 2, network: "Tron / ERC-20" },
];

export const ASSET_MAP = Object.fromEntries(ASSETS.map((a) => [a.symbol, a])) as Record<Symbol, AssetMeta>;
export const SYMBOLS = ASSETS.map((a) => a.symbol);

export const BASE_PRICES: Record<Symbol, number> = {
  ETH: 2996.5,
  TRX: 0.1302,
  USDT: 1.0,
};

export const BASE_CHANGE: Record<Symbol, number> = {
  ETH: 0.15,
  TRX: 3.07,
  USDT: 0.02,
};

/* fallbacks for offline market stats */
const DEMO_STATS: Record<Symbol, { cap: number; vol: number }> = {
  ETH: { cap: 3.61e11, vol: 1.42e10 },
  TRX: { cap: 2.41e10, vol: 8.9e8 },
  USDT: { cap: 1.4e11, vol: 4.27e11 },
};

export interface MarketQuote {
  price: number;
  change: number;
  high: number;
  low: number;
  cap: number;
  vol: number;
  dir: number;
  tick: number;
}
export type Prices = Record<Symbol, MarketQuote>;

export function initQuotes(): Prices {
  const out = {} as Prices;
  for (const s of SYMBOLS)
    out[s] = {
      price: BASE_PRICES[s],
      change: BASE_CHANGE[s],
      high: BASE_PRICES[s] * 1.0121,
      low: BASE_PRICES[s] * 0.9864,
      cap: DEMO_STATS[s].cap,
      vol: DEMO_STATS[s].vol,
      dir: 0,
      tick: 0,
    };
  return out;
}

export interface Portfolio {
  holdings: Record<Symbol, number>;
  staked: Record<Symbol, number>;
}

export const emptyPortfolio = (): Portfolio => ({
  holdings: { ETH: 0, TRX: 0, USDT: 0 },
  staked: { ETH: 0, TRX: 0, USDT: 0 },
});

export interface TxItem {
  id: string;
  type: "send" | "buy" | "swap" | "p2p" | "stake" | "unstake";
  title: string;
  sub: string;
  sym: Symbol;
  usd: number;
  at: number;
}

export interface Wallet {
  id: string;
  name: string;
  color: string;
  portfolio: Portfolio;
  txs?: TxItem[];
}

export const WALLET_COLORS = ["#0b5e54", "#7a3ff2", "#b45309", "#c2255c", "#0e7490"];

export const defaultWallets = (): Wallet[] => [
  {
    id: "w-main",
    name: "Main Wallet",
    color: "#0b5e54",
    portfolio: {
      holdings: { ETH: 0.0036109, TRX: 0, USDT: 111879.8 },
      staked: { ...emptyPortfolio().staked, USDT: 120 },
    },
  },
];

/* ---------- formatting ---------- */

export const CURRENCIES = {
  USD: { s: "$", r: 1 },
  EUR: { s: "€", r: 0.923 },
  GBP: { s: "£", r: 0.791 },
} as const;
export type Currency = keyof typeof CURRENCIES;

export function makeMoney(cur: Currency) {
  const { s, r } = CURRENCIES[cur];
  return (n: number) =>
    s + (n * r).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function amt(n: number, sym: Symbol) {
  const d = ASSET_MAP[sym].decimals;
  const min = sym === "USDT" ? 2 : n === 0 ? 0 : 2;
  return n.toLocaleString("en-US", { minimumFractionDigits: Math.min(min, d), maximumFractionDigits: d });
}

export const pct = (n: number) => (n > 0 ? "+" : "") + n.toFixed(2) + "%";

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/* ---------- deterministic randomness ---------- */

export function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const HEX = "0123456789abcdef";

/* ---------- address generation & validation (real formats) ---------- */

export function makeAddress(sym: Symbol, seed: string) {
  const rnd = mulberry32(hashStr(sym + "::" + seed));
  const gen = (n: number, chars: string) =>
    Array.from({ length: n }, () => chars[Math.floor(rnd() * chars.length)]).join("");
  if (sym === "TRX") return "T" + gen(33, B58);
  return "0x" + gen(40, HEX);
}

export function validateAddress(sym: Symbol, raw: string): string | null {
  const a = raw.trim();
  if (!a) return null;
  if (sym === "TRX") {
    if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) return null;
    return "Tron addresses start with T (34 chars)";
  }
  if (sym === "USDT") {
    if (/^0x[0-9a-fA-F]{40}$/.test(a) || /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) return null;
    return "Enter a Tron (T…) or ERC-20 (0x…) address";
  }
  if (/^0x[0-9a-fA-F]{40}$/.test(a)) return null;
  return "EVM addresses are 0x + 40 hex chars";
}

export const shorten = (s: string, a = 6, b = 4) => (s.length <= a + b ? s : s.slice(0, a) + "… " + s.slice(-b));

export function sparkSeries(sym: Symbol, change: number, range: "1D" | "7D" | "1Y", n = 40) {
  const rnd = mulberry32(hashStr("spark:" + sym + ":" + range));
  const vol = range === "1D" ? 0.9 : range === "7D" ? 1.8 : 3.2;
  const drift = (range === "1D" ? change : change * (range === "7D" ? 4 : 26)) / 100 / n;
  let v = 100;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(v);
    v += v * drift + (rnd() - 0.5) * vol;
  }
  return out;
}

export const uid = () => Math.random().toString(36).slice(2, 10).toUpperCase();

/* ---------- storage ---------- */

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

/* ---------- content ---------- */

export const EARN_PRODUCTS: { sym: Symbol; apy: number; tag: string }[] = [
  { sym: "USDT", apy: 7.2, tag: "Flexible" },
  { sym: "TRX", apy: 3.4, tag: "Flexible" },
  { sym: "ETH", apy: 0.4, tag: "Flexible" },
];

export interface Contact {
  name: string;
  sym: Symbol;
  addr: string;
}

export const CONTACTS: Contact[] = [
  { name: "Cold Vault", sym: "ETH", addr: makeAddress("ETH", "contact-vault") },
  { name: "Alice M.", sym: "USDT", addr: makeAddress("USDT", "contact-alice") },
  { name: "Tron Relay", sym: "TRX", addr: makeAddress("TRX", "contact-relay") },
];
