import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { api } from "../api/client";
import { Btn, EmptyState, PageTitle, Screen, StatusPill } from "../components/ui";
import { useConnection } from "../ConnectionContext";

function toneFor(status: string): "ok" | "live" | "bad" | "neutral" {
  if (status === "completed") return "ok";
  if (status === "failed" || status === "cancelled") return "bad";
  if (status === "running" || status === "pending" || status === "paused") return "live";
  return "neutral";
}

/** Runs history with live polling. */
export default function RunsPage() {
  const { connected } = useConnection();
  const runs = useQuery({
    queryKey: ["runs", "all"],
    queryFn: () => api.listRuns(),
    enabled: connected,
    refetchInterval: 3000,
  });

  if (!connected) {
    return (
      <Screen>
        <EmptyState
          title="Connect first"
          body="Pair with the desktop engine to watch runs from here."
          action={
            <Link to="/">
              <Btn label="Go to Home" variant="signal" />
            </Link>
          }
        />
      </Screen>
    );
  }

  if (runs.isLoading) {
    return (
      <Screen className="items-center justify-center">
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--signal)] border-t-transparent"
          aria-hidden
        />
      </Screen>
    );
  }

  if (runs.isError) {
    return (
      <Screen>
        <EmptyState title="Couldn't load runs" body={String(runs.error)} />
      </Screen>
    );
  }

  const data = runs.data?.runs ?? [];

  return (
    <Screen>
      <div className="px-4 pb-8 pt-4">
        <PageTitle
          title="Runs"
          subtitle="Live updates while the engine is online"
        />

        {data.length === 0 ? (
          <EmptyState title="No runs yet" body="Start one from the Flows tab." />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {data.map((item) => (
              <li key={item.run_id}>
                <Link
                  to={`/runs/${encodeURIComponent(item.run_id)}`}
                  className="block rounded-[14px] border border-[var(--line)] bg-[var(--bg-elevated)] p-3.5 hover:bg-[var(--bg-hover)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-base font-bold text-[var(--ink)]">
                      {item.flow_id}
                    </span>
                    <StatusPill label={item.status} tone={toneFor(item.status)} />
                  </div>
                  <div className="mt-1 truncate text-xs text-[var(--ink-muted)]">
                    {item.run_id}
                  </div>
                  <div className="text-xs text-[var(--ink-muted)]">
                    {new Date(item.updated_at).toLocaleString()}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Screen>
  );
}
