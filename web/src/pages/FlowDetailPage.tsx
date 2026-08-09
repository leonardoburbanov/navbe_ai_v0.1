import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import { api } from "../api/client";
import FlowGraph from "../components/FlowGraph";
import { Btn, EmptyState, Screen } from "../components/ui";
import { useConnection } from "../ConnectionContext";

/** Read-only flow graph + Run. */
export default function FlowDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const { connected } = useConnection();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const flow = useQuery({
    queryKey: ["flow", id],
    queryFn: () => api.getFlow(id),
    enabled: connected && Boolean(id),
  });

  const run = useMutation({
    mutationFn: () => api.startRun(id),
    onSuccess: (state) => {
      void qc.invalidateQueries({ queryKey: ["runs"] });
      navigate(`/runs/${state.run_id}`);
    },
  });

  if (!connected) {
    return (
      <Screen>
        <EmptyState title="Connect first" body="Pair with desktop to open this flow." />
      </Screen>
    );
  }

  if (flow.isLoading) {
    return (
      <Screen className="items-center justify-center">
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--signal)] border-t-transparent"
          aria-hidden
        />
      </Screen>
    );
  }

  if (flow.isError || !flow.data) {
    return (
      <Screen>
        <EmptyState title="Missing flow" body={String(flow.error ?? "Not found")} />
      </Screen>
    );
  }

  const spec = flow.data;
  const nodeCount = spec.nodes?.length ?? 0;
  const edgeCount = spec.edges?.length ?? 0;

  return (
    <Screen>
      <div className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold tracking-tight text-[var(--ink)]">
            {spec.name || spec.flow_id}
          </h1>
          <p className="text-xs text-[var(--ink-muted)]">
            {nodeCount} steps · {edgeCount} edges · entry{" "}
            <code className="mono">{spec.entry_node}</code>
          </p>
        </div>
        <Btn
          label={run.isPending ? "Starting…" : "Run"}
          variant="signal"
          loading={run.isPending}
          onClick={() => run.mutate()}
        />
      </div>
      {run.isError ? (
        <p className="px-4 pt-2 text-sm text-[var(--err)]">{String(run.error)}</p>
      ) : null}
      <FlowGraph spec={spec} />
    </Screen>
  );
}
