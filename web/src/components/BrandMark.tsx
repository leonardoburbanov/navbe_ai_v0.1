type Size = "sm" | "md" | "lg" | "hero";

const SIZES: Record<Size, number> = {
  sm: 28,
  md: 40,
  lg: 56,
  hero: 88,
};

interface BrandMarkProps {
  size?: Size;
  showWordmark?: boolean;
  className?: string;
}

/** Navbe logo mark (+ optional wordmark). */
export default function BrandMark({
  size = "md",
  showWordmark = false,
  className = "",
}: BrandMarkProps) {
  const dim = SIZES[size];
  return (
    <div className={["flex items-center gap-3", className].join(" ")}>
      <img
        src="/navbe-logo.png"
        alt="Navbe"
        width={dim}
        height={dim}
        className="object-contain"
      />
      {showWordmark ? (
        <span
          className={[
            "font-bold tracking-tight text-[var(--ink)]",
            size === "hero" ? "text-[34px]" : "text-[22px]",
          ].join(" ")}
        >
          Navbe
        </span>
      ) : null}
    </div>
  );
}
