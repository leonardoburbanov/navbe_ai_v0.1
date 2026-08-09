import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { api } from "../api/client";
import { Btn, EmptyState, PageTitle, Screen } from "../components/ui";
import { useConnection } from "../ConnectionContext";

/** Flow list — cards, tap to view graph. */
export default function FlowsPage() {
  const { connected } = useConnection();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const flows = useQuery({
    queryKey: ["flows"],
    queryFn: () => api.listFlows(),
    enabled: connected,
  });
  const run = useMutation({
    mutationFn: (flowId: string) => api.startRun(flowId),
    onSuccess: (state) => {
      void qc.invalidateQueries({ queryKey: ["runs"] });
      navigate(`/runs/${state.run_id}`);
    },
  });

  if (!connected) {
    return (
      <Screen>
        <EmptyState
          title="Connect first"
          body="Pair with Navbe Desktop on the Home tab to see your flows."
          action={
            <Link to="/">
              <Btn label="Go to Home" variant="signal" />
            </Link>
          }
        />
      </Screen>
    );
  }

  if (flows.isLoading) {
    return (
      <Screen className="items-center justify-center">
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--signal)] border-t-transparent"
          aria-hidden
        />
      </Screen>
    );
  }

  if (flows.isError) {
    return (
      <Screen>
        <EmptyState title="Couldn't load flows" body={String(flows.error)} />
      </Screen>
    );
  }

  const data = flows.data ?? [];

  return (
    <Screen>
      <div className="px-4 pb-8 pt-4">
        <PageTitle
          title="Flows"
          subtitle={`${data.length} workflow${data.length === 1 ? "" : "s"} on this engine`}
        />

        {data.length === 0 ? (
          <EmptyState
            title="No flows yet"
            body="Create one in Navbe Desktop, then refresh."
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {data.map((item) => (
              <li
                key={item.flow_id}
                className="flex items-center gap-3 overflow-hidden rounded-[14px] border border-[var(--line)] bg-[var(--bg-elevated)] py-3.5 pr-3"
              >
                <span className="w-0.5 self-stretch rounded-sm bg-[var(--signal)]" />
                <Link to={`/flows/${encodeURIComponent(item.flow_id)}`} className="min-w-0 flex-1 px-1">
                  <div className="truncate text-base font-bold text-[var(--ink)]">
                    {item.name || item.flow_id}
                  </div>
                  <div className="truncate text-xs text-[var(--ink-muted)]">
                    {item.flow_id}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-[var(--signal)]">
                    View graph →
                  </div>
                </Link>
                <Btn
                  label="Run"
                  variant="primary"
                  className="min-w-[72px] px-3"
                  loading={run.isPending}
                  onClick={() => run.mutate(item.flow_id)}
                />
              </li>
            ))}
          </ul>
        )}

        {run.isError ? (
          <p className="mt-3 rounded-lg bg-[var(--err)] px-3 py-2 text-center text-sm text-white">
            {String(run.error)}
          </p>
        ) : null}
      </div>
    </Screen>
  );
}
