import { useEffect, useMemo, useState } from "react";
import QRCodeLib from "qrcode";
import { hashStr, mulberry32, type Symbol } from "../lib/wallet";

/* ---------- real brand coin marks ---------- */

function Emblem({ symbol }: { symbol: Symbol }) {
  switch (symbol) {
    case "ETH": // Ethereum — classic faceted diamond
      return (
        <svg viewBox="0 0 40 40" className="h-full w-full">
          <circle cx="20" cy="20" r="20" fill="#f4f5f9" />
          <circle cx="20" cy="20" r="20" fill="none" stroke="#e3e6ee" strokeWidth="1" />
          <path d="M20 7 L30 20.2 L20 25.4 L10 20.2 Z" fill="#6a779c" />
          <path d="M20 7 L30 20.2 L20 25.4 Z" fill="#3e4a6e" />
          <path d="M10 22 L20 27 L20 34 Z" fill="#7d89ac" />
          <path d="M30 22 L20 27 L20 34 Z" fill="#525d7e" />
        </svg>
      );
    case "TRX": // Tron — chevron gate on brand red
      return (
        <svg viewBox="0 0 40 40" className="h-full w-full">
          <circle cx="20" cy="20" r="20" fill="#ef0027" />
          <path d="M20 7.5 L31.5 25 H25.2 L20 16.2 L14.8 25 H8.5 Z" fill="#fff" />
          <path d="M20 20.2 L25.9 29.5 H14.1 Z" fill="#fff" />
        </svg>
      );
    case "USDT": // Tether — T on teal
      return (
        <svg viewBox="0 0 40 40" className="h-full w-full">
          <circle cx="20" cy="20" r="20" fill="#26a17b" />
          <g fill="#fff">
            <rect x="11.5" y="11.5" width="17" height="3.6" rx="1.8" />
            <rect x="18.2" y="11.5" width="3.6" height="16.5" rx="1.8" />
            <rect x="14.5" y="18.4" width="11" height="3" rx="1.5" />
          </g>
        </svg>
      );
  }
}

export function CoinIcon({ symbol, className = "size-10" }: { symbol: Symbol; className?: string }) {
  return (
    <span className={`inline-block shrink-0 overflow-hidden rounded-full ${className}`}>
      <Emblem symbol={symbol} />
    </span>
  );
}

/* ---------- price chart with draw-on animation ---------- */

export function Sparkline({
  series,
  positive,
  className = "h-24 w-full",
  id,
}: {
  series: number[];
  positive: boolean;
  className?: string;
  id: string;
}) {
  const { line, area } = useMemo(() => {
    const min = Math.min(...series);
    const max = Math.max(...series);
    const span = max - min || 1;
    const W = 120;
    const H = 44;
    const pts = series.map((v, i) => [
      (i / (series.length - 1)) * W,
      H - 3 - ((v - min) / span) * (H - 8),
    ]);
    const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(2) + " " + p[1].toFixed(2)).join(" ");
    const area = line + ` L${W} ${H} L0 ${H} Z`;
    return { line, area };
  }, [series]);

  const color = positive ? "#0e9f6e" : "#e5484d";
  return (
    <svg viewBox="0 0 120 44" preserveAspectRatio="none" className={className}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.24" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} className="animate-fade" />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        pathLength={1}
        className="chart-draw"
      />
    </svg>
  );
}

/* ---------- real, scannable QR (with offline fallback) ---------- */

function PseudoQR({ value, className = "size-44" }: { value: string; className?: string }) {
  const cells = useMemo(() => {
    const n = 25;
    const rnd = mulberry32(hashStr(value));
    const grid: boolean[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => rnd() > 0.52));
    const finder = (r: number, c: number) => {
      for (let i = 0; i < 7; i++)
        for (let j = 0; j < 7; j++) {
          const ring = i === 0 || i === 6 || j === 0 || j === 6;
          const core = i >= 2 && i <= 4 && j >= 2 && j <= 4;
          grid[r + i][c + j] = ring || core;
        }
      for (let i = -1; i < 8; i++)
        for (let j = -1; j < 8; j++) {
          const rr = r + i;
          const cc = c + j;
          if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
          if (i === -1 || i === 7 || j === -1 || j === 7) grid[rr][cc] = false;
        }
    };
    finder(0, 0);
    finder(0, n - 7);
    finder(n - 7, 0);
    return grid;
  }, [value]);

  return (
    <svg viewBox="0 0 25 25" className={className} shapeRendering="crispEdges">
      <rect width="25" height="25" fill="#fff" />
      {cells.map((row, r) =>
        row.map((on, c) => (on ? <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="#0f1b2d" /> : null)),
      )}
    </svg>
  );
}

export function QRCode({ value, className = "size-44" }: { value: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let ok = true;
    setUrl(null);
    QRCodeLib.toDataURL(value, {
      width: 512,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0f1b2d", light: "#ffffff" },
    })
      .then((u) => {
        if (ok) setUrl(u);
      })
      .catch(() => {
        /* fallback to pseudo grid */
      });
    return () => {
      ok = false;
    };
  }, [value]);

  return url ? (
    <img src={url} alt="Wallet address QR code" className={className} />
  ) : (
    <PseudoQR value={value} className={className} />
  );
}
