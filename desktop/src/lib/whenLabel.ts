/** Human labels for schedule ``when`` expressions (frontend-only). */

export const SCHEDULE_PRESETS = [
  { id: "hourly", label: "Every hour", when: "0 * * * *" },
  { id: "daily", label: "Every day at 09:00", when: "0 9 * * *" },
  { id: "weekly", label: "Every Monday at 09:00", when: "0 9 * * 1" },
  { id: "plus1h", label: "In 1 hour (once-style relative)", when: "+1h" },
  { id: "plus30m", label: "In 30 minutes", when: "+30m" },
] as const;

/** Turn a ``when`` string into a short human label. */
export function whenLabel(when: string): string {
  const cleaned = when.trim();
  const preset = SCHEDULE_PRESETS.find((p) => p.when === cleaned);
  if (preset) return preset.label;
  if (/^\+\d+[smhd]$/i.test(cleaned)) {
    const m = cleaned.match(/^\+(\d+)([smhd])$/i)!;
    const n = m[1];
    const unit =
      m[2].toLowerCase() === "s"
        ? "second"
        : m[2].toLowerCase() === "m"
          ? "minute"
          : m[2].toLowerCase() === "h"
            ? "hour"
            : "day";
    return `Every ${n} ${unit}${n === "1" ? "" : "s"} (relative)`;
  }
  if (cleaned.split(/\s+/).length === 5) return `Cron: ${cleaned}`;
  return cleaned || "—";
}

/** Format next_run_at for display. */
export function formatNextRun(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}
