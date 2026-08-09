import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

type Variant = "primary" | "signal" | "ghost" | "danger";

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: Variant;
  loading?: boolean;
}

const variantClass: Record<Variant, string> = {
  primary: "bg-[var(--action)] text-[var(--action-ink)] border-transparent",
  signal: "bg-[var(--signal)] text-[var(--action-ink)] border-transparent",
  danger: "bg-[var(--err)] text-white border-transparent",
  ghost: "bg-transparent text-[var(--ink)] border-[var(--line-strong)]",
};

/** Branded button. */
export function Btn({
  label,
  variant = "primary",
  loading,
  disabled,
  className = "",
  ...rest
}: BtnProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={[
        "inline-flex min-h-11 items-center justify-center rounded-[10px] border px-4 py-3 text-[15px] font-semibold",
        "disabled:opacity-50 hover:opacity-90 active:opacity-85",
        variantClass[variant],
        className,
      ].join(" ")}
      {...rest}
    >
      {loading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      ) : (
        label
      )}
    </button>
  );
}

interface CardProps {
  children: ReactNode;
  featured?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Surface card. */
export function Card({ children, featured, className = "", style }: CardProps) {
  return (
    <div
      className={[
        "rounded-[14px] border p-4",
        featured
          ? "border-[var(--signal)] bg-[var(--signal-soft)]"
          : "border-[var(--line)] bg-[var(--bg-elevated)]",
        className,
      ].join(" ")}
      style={style}
    >
      {children}
    </div>
  );
}

interface StatusPillProps {
  label: string;
  tone?: "neutral" | "ok" | "live" | "bad" | "signal";
}

/** Compact status chip. */
export function StatusPill({ label, tone = "neutral" }: StatusPillProps) {
  const map = {
    neutral: "bg-[var(--line)] text-[var(--ink-muted)]",
    ok: "bg-[var(--ok-bg)] text-[var(--ok)]",
    live: "bg-[var(--warn-bg)] text-[var(--warn)]",
    bad: "bg-[var(--err-bg)] text-[var(--err)]",
    signal: "bg-[var(--signal-soft)] text-[var(--signal)]",
  } as const;
  return (
    <span
      className={[
        "inline-flex self-start rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide",
        map[tone],
      ].join(" ")}
    >
      {label}
    </span>
  );
}

interface EmptyProps {
  title: string;
  body?: string;
  action?: ReactNode;
}

/** Empty / connect-first placeholder. */
export function EmptyState({ title, body, action }: EmptyProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h2 className="text-lg font-bold text-[var(--ink)]">{title}</h2>
      {body ? (
        <p className="max-w-[280px] text-sm leading-5 text-[var(--ink-muted)]">{body}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

interface ScreenProps {
  children?: ReactNode;
  className?: string;
}

/** Full-area themed container. */
export function Screen({ children, className = "" }: ScreenProps) {
  return (
    <div className={["flex min-h-0 flex-1 flex-col bg-[var(--bg)]", className].join(" ")}>
      {children}
    </div>
  );
}

/** Page title block. */
export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3.5 flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-[28px] font-bold tracking-tight text-[var(--ink)]">{title}</h1>
        {subtitle ? (
          <p className="mt-0.5 text-sm text-[var(--ink-muted)]">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
