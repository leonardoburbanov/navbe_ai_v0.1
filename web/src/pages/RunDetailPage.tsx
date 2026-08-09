import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { api } from "../api/client";
import { Btn, EmptyState, Screen, StatusPill } from "../components/ui";
import { useConnection } from "../ConnectionContext";

const ACTIVE = new Set(["running", "pending", "paused"]);

function toneFor(status: string): "ok" | "live" | "bad" | "neutral" {
  if (status === "completed") return "ok";
  if (status === "failed" || status === "cancelled") return "bad";
  if (ACTIVE.has(status)) return "live";
  return "neutral";
}

/** Live run detail. */
export default function RunDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const { connected } = useConnection();
  const qc = useQueryClient();

  const run = useQuery({
    queryKey: ["run", id],
    queryFn: () => api.getRun(id),
    enabled: connected && Boolean(id),
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status && ACTIVE.has(status) ? 1500 : false;
    },
  });

  const cancel = useMutation({
    mutationFn: () => api.cancelRun(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["run", id] });
      void qc.invalidateQueries({ queryKey: ["runs"] });
    },
  });

  const resume = useMutation({
    mutationFn: (approved: boolean) => api.resumeRun(id, { approved }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["run", id] });
      void qc.invalidateQueries({ queryKey: ["runs"] });
    },
  });

  if (!connected) {
    return (
      <Screen>
        <EmptyState title="Connect first" body="Pair with desktop to open this run." />
      </Screen>
    );
  }

  if (run.isLoading) {
    return (
      <Screen className="items-center justify-center">
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--signal)] border-t-transparent"
          aria-hidden
        />
      </Screen>
    );
  }

  if (run.isError || !run.data) {
    return (
      <Screen>
        <EmptyState title="Missing run" body={String(run.error ?? "Not found")} />
      </Screen>
    );
  }

  const state = run.data;
  const steps = state.steps ?? [];

  return (
    <Screen>
      <div className="flex flex-col gap-1.5 px-4 pb-10 pt-4">
        <div className="flex items-center gap-2.5">
          <h1 className="min-w-0 flex-1 truncate text-[22px] font-bold tracking-tight text-[var(--ink)]">
            {state.flow_id}
          </h1>
          <StatusPill label={state.status} tone={toneFor(state.status)} />
        </div>
        <p className="text-xs text-[var(--ink-muted)]">{state.run_id}</p>
        {state.current_node ? (
          <p className="text-xs text-[var(--signal)]">Node · {state.current_node}</p>
        ) : null}
        {state.error ? (
          <p className="mt-2 text-sm text-[var(--err)]">{state.error}</p>
        ) : null}

        <div className="mt-3.5 flex flex-wrap gap-2.5">
          {ACTIVE.has(state.status) && state.status !== "paused" ? (
            <Btn
              label="Cancel"
              variant="danger"
              loading={cancel.isPending}
              onClick={() => cancel.mutate()}
            />
          ) : null}
          {state.status === "paused" ? (
            <>
              <Btn
                label="Approve"
                variant="signal"
                loading={resume.isPending}
                onClick={() => resume.mutate(true)}
              />
              <Btn
                label="Reject"
                variant="danger"
                loading={resume.isPending}
                onClick={() => resume.mutate(false)}
              />
            </>
          ) : null}
        </div>

        <h2 className="mt-5 text-base font-bold text-[var(--ink)]">Steps</h2>
        {steps.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">No step detail yet.</p>
        ) : (
          steps.map((step) => (
            <div
              key={`${step.node_id}-${step.step_type}`}
              className="mt-2 rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] p-3"
            >
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 font-bold text-[var(--ink)]">
                  {step.node_id}
                </span>
                <StatusPill label={step.status} tone={toneFor(step.status)} />
              </div>
              <p className="text-xs text-[var(--ink-muted)]">
                {step.step_type}
                {step.latency_ms != null ? ` · ${step.latency_ms}ms` : ""}
              </p>
              {step.error ? (
                <p className="text-sm text-[var(--err)]">{step.error}</p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </Screen>
  );
}
