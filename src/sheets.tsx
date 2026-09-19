import type { ReactNode } from "react";
import { cn } from "../utils/cn";
import { ASSETS, SYMBOLS, type Symbol } from "../lib/wallet";
import { CoinIcon } from "./coins";
import { IconCheck, IconInfo, IconX } from "./icons";

/* ---------- bottom sheet ---------- */

export function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-center">
      <div className="animate-fade absolute inset-0 bg-ink/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-[430px] items-end">
        <div className="animate-sheet flex max-h-[90%] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-card">
          <div className="flex justify-center pt-3">
            <span className="h-1 w-10 rounded-full bg-line" />
          </div>
          <div className="flex items-center justify-between px-5 pb-3 pt-2">
            <h3 className="font-display text-xl font-bold tracking-tight">{title}</h3>
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid size-9 place-items-center rounded-full bg-page text-sub transition hover:bg-line"
            >
              <IconX className="size-4.5" />
            </button>
          </div>
          <div className="min-h-0 overflow-y-auto no-scrollbar px-5 pb-5">{children}</div>
          {footer && <div className="border-t border-line px-5 py-4">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

/* ---------- toasts ---------- */

export interface Toast {
  id: number;
  msg: string;
  tone: "ok" | "err" | "info";
}

export function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-toast flex max-w-[380px] items-center gap-2.5 rounded-full bg-ink py-2.5 pl-3.5 pr-5 text-[13px] font-semibold text-white shadow-card"
        >
          <span
            className={cn(
              "grid size-5 shrink-0 place-items-center rounded-full",
              t.tone === "err" ? "bg-down" : t.tone === "info" ? "bg-brand" : "bg-up",
            )}
          >
            {t.tone === "info" ? (
              <IconInfo className="size-3" strokeWidth={2.4} />
            ) : (
              <IconCheck className="size-3" strokeWidth={2.4} />
            )}
          </span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

/* ---------- asset chips ---------- */

export function AssetChips({
  selected,
  onSelect,
  exclude,
}: {
  selected: Symbol;
  onSelect: (s: Symbol) => void;
  exclude?: Symbol;
}) {
  return (
    <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {SYMBOLS.filter((s) => s !== exclude).map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition",
            selected === s
              ? "border-brand bg-brand text-white"
              : "border-line bg-white text-sub hover:border-faint",
          )}
        >
          <CoinIcon symbol={s} className="size-5" />
          {ASSETS.find((a) => a.symbol === s)!.name}
        </button>
      ))}
    </div>
  );
}

/* ---------- inputs & buttons ---------- */

export function Field({ label, children, right }: { label: string; children: ReactNode; right?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-xs font-extrabold uppercase tracking-wide text-sub">
        {label}
        {right}
      </span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-line bg-page/50 px-4 py-3 text-[15px] font-bold text-ink outline-none transition placeholder:font-semibold placeholder:text-faint focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10";

export function PrimaryBtn({
  children,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full rounded-xl bg-gradient-to-b from-[#12755f] to-[#0a4f44] py-4 text-base font-extrabold text-white shadow-card ring-1 ring-inset ring-white/15 transition",
        "hover:from-[#0f6650] hover:to-[#084136] active:scale-[0.99] disabled:cursor-not-allowed disabled:from-faint/60 disabled:to-faint/60 disabled:shadow-none disabled:ring-0",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        "relative h-6.5 w-11.5 shrink-0 rounded-full transition-colors duration-200",
        on ? "bg-brand" : "bg-line",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-5.5 rounded-full bg-white shadow transition-transform duration-200",
          on && "translate-x-5",
        )}
      />
    </button>
  );
}

export function Row({
  icon,
  label,
  sub,
  control,
  danger,
  onClick,
}: {
  icon?: ReactNode;
  label: string;
  sub?: string;
  control?: ReactNode;
  danger?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3.5 text-left transition",
        onClick && "hover:bg-page/70 active:bg-page",
      )}
    >
      {icon && (
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-lg",
            danger ? "bg-down/10 text-down" : "bg-brand-soft text-brand",
          )}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[14.5px] font-semibold", danger ? "text-down" : "text-ink")}>{label}</span>
        {sub && <span className="block text-xs font-medium text-sub">{sub}</span>}
      </span>
      {control}
    </Tag>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("overflow-hidden rounded-2xl border border-line bg-white shadow-card", className)}>{children}</div>;
}

/* ---------- success view ---------- */

export function SuccessView({
  title,
  lines,
  cta,
  onCta,
}: {
  title: string;
  lines: { k: string; v: string }[];
  cta: string;
  onCta: () => void;
}) {
  return (
    <div className="flex flex-col items-center pt-4 pb-2">
      <span className="animate-pop grid size-16 place-items-center rounded-full bg-up/12 text-up">
        <svg
          viewBox="0 0 24 24"
          className="check-draw size-8"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" pathLength={1} opacity={0.35} />
          <path d="m7 12.5 3.2 3.2L17 9" pathLength={1} />
        </svg>
      </span>
      <h4 className="mt-4 font-display text-xl font-bold tracking-tight">{title}</h4>
      <div className="mt-5 w-full space-y-0 rounded-2xl border border-line bg-page/50">
        {lines.map((l) => (
          <div key={l.k} className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 last:border-0">
            <span className="text-[13px] font-semibold text-sub">{l.k}</span>
            <span className="num max-w-[60%] truncate text-right text-[13px] font-semibold">{l.v}</span>
          </div>
        ))}
      </div>
      <PrimaryBtn onClick={onCta} className="mt-6">
        {cta}
      </PrimaryBtn>
    </div>
  );
}
