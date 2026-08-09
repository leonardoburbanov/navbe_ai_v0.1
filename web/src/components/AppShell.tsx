import { NavLink, Outlet, useLocation } from "react-router-dom";

import BrandMark from "./BrandMark";

const NAV = [
  { to: "/", label: "Home", end: true, icon: "⌂" },
  { to: "/flows", label: "Flows", end: false, icon: "⬡" },
  { to: "/runs", label: "Runs", end: false, icon: "▶" },
  { to: "/schedules", label: "Schedules", end: false, icon: "◷" },
] as const;

function linkClass({ isActive }: { isActive: boolean }): string {
  return [
    "flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-semibold transition-colors",
    isActive
      ? "bg-[var(--signal-soft)] text-[var(--signal)]"
      : "text-[var(--ink-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--ink)]",
  ].join(" ");
}

function tabClass({ isActive }: { isActive: boolean }): string {
  return [
    "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold",
    isActive ? "text-[var(--signal)]" : "text-[var(--ink-muted)]",
  ].join(" ");
}

/** Responsive shell: rail on md+, bottom tabs on small screens. */
export default function AppShell() {
  const location = useLocation();
  const isDetail =
    location.pathname.startsWith("/flows/") || location.pathname.startsWith("/runs/");

  return (
    <div className="flex min-h-screen flex-col md:grid md:grid-cols-[200px_1fr]">
      <aside className="hidden border-r border-[var(--line)] bg-[var(--bg-panel)] p-3.5 md:flex md:flex-col md:gap-5">
        <BrandMark size="sm" showWordmark />
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
              <span aria-hidden className="w-4 text-center opacity-80">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <p className="mt-auto px-1 text-[11px] leading-4 text-[var(--ink-muted)]">
          LAN companion · pairs with Desktop
        </p>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col pb-[58px] md:pb-0">
        {isDetail ? (
          <div className="border-b border-[var(--line)] px-4 py-2 md:hidden">
            <NavLink to=".." className="text-sm font-semibold text-[var(--signal)]">
              ← Back
            </NavLink>
          </div>
        ) : null}
        <main className="flex min-h-0 flex-1 flex-col overflow-auto">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex h-[58px] border-t border-[var(--line)] bg-[var(--bg)] pt-1 md:hidden">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={tabClass}>
            <span aria-hidden className="text-base leading-none">
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
