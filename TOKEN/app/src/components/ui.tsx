import { useId, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode, type SelectHTMLAttributes } from "react";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

// --- icons (inline SVG, 16px, currentColor) ---

const Svg = ({ children, size = 16 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
export const SunIcon = () => <Svg><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>;
export const MoonIcon = () => <Svg><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></Svg>;
export const GearIcon = () => <Svg><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></Svg>;
export const UploadIcon = () => <Svg><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></Svg>;
export const DownloadIcon = () => <Svg><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></Svg>;
export const PrintIcon = () => <Svg><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></Svg>;
export const SparkIcon = () => <Svg><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z" /></Svg>;
export const InfoIcon = () => <Svg><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></Svg>;
export const WarningIcon = () => <Svg><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01" /></Svg>;
export const CheckIcon = () => <Svg><path d="M20 6 9 17l-5-5" /></Svg>;
export const CloseIcon = () => <Svg><path d="M18 6 6 18M6 6l12 12" /></Svg>;
export const TableIcon = () => <Svg><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16" /></Svg>;
export const ChartIcon = () => <Svg><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></Svg>;
export const TrashIcon = () => <Svg><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></Svg>;
export const LockIcon = () => <Svg><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Svg>;

export function Card({ title, subtitle, actions, children, className }: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]", className)}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-2">{subtitle}</p>}
          </div>
          {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" };

export function Button({ variant = "secondary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        variant === "primary" && "bg-accent text-white hover:bg-accent-hover",
        variant === "secondary" && "border border-line bg-surface text-ink hover:bg-surface-2",
        variant === "ghost" && "text-ink-2 hover:bg-surface-2 hover:text-ink",
        className,
      )}
    />
  );
}

export function Segmented<T extends string>({ label, options, value, onChange, size = "md" }: {
  label: string;
  options: { value: T; label: ReactNode; hint?: string }[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
}) {
  const move = (e: KeyboardEvent, i: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = options[(i + step + options.length) % options.length];
    onChange(next.value);
    (e.currentTarget.parentElement?.children[options.indexOf(next)] as HTMLElement | undefined)?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          title={o.hint}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => move(e, i)}
          className={cx(
            "rounded-md font-medium transition-colors",
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
            o.value === value ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StatTile({ label, value, sub, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-xl border border-line bg-surface px-4 py-3", className)}>
      <div className="text-xs text-ink-2">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-2">{sub}</div>}
    </div>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-text", className)}>{children}</span>;
}

const TONES = {
  info: { icon: <InfoIcon />, color: "text-series-1", label: "Note" },
  warning: { icon: <WarningIcon />, color: "text-warning", label: "Warning" },
  critical: { icon: <WarningIcon />, color: "text-critical", label: "Check" },
  good: { icon: <CheckIcon />, color: "text-good", label: "OK" },
} as const;

/** Status always pairs an icon with a text label - never colour alone. */
export function Notice({ tone = "info", title, children }: { tone?: keyof typeof TONES; title?: string; children: ReactNode }) {
  const t = TONES[tone];
  return (
    <div role={tone === "warning" || tone === "critical" ? "alert" : "note"} className="flex gap-2.5 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-xs text-ink-2">
      <span className={cx("mt-px shrink-0", t.color)} aria-hidden="true">{t.icon}</span>
      <div>
        <span className="font-semibold text-ink">{title ?? t.label}: </span>
        {children}
      </div>
    </div>
  );
}

export function Meter({ value, label }: { value: number; label: string }) {
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} className="h-1.5 w-full overflow-hidden rounded-full bg-accent-soft">
      <div className="h-full rounded-full bg-series-1 transition-[width] duration-300" style={{ width: `${Math.max(2, value * 100)}%` }} />
    </div>
  );
}

export function Select({ label, className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId();
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-xs font-medium text-ink-2">{label}</label>
      <select id={id} {...props} className="h-9 rounded-lg border border-line bg-surface px-2.5 text-sm text-ink hover:bg-surface-2">
        {children}
      </select>
    </div>
  );
}

export function NumberField({ label, value, onChange, step = 1, min = 0, suffix, className }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-xs font-medium text-ink-2">{label}</label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => {
            const v = e.target.valueAsNumber;
            if (Number.isFinite(v) && v >= min) onChange(v);
          }}
          className="tabular h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-ink"
        />
        {suffix && <span className="shrink-0 text-xs text-ink-2">{suffix}</span>}
      </div>
    </div>
  );
}
