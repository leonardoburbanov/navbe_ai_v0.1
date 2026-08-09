import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { ScheduleSpec } from "../api/types";
import ScheduleDialog from "../components/ScheduleDialog";
import Alert from "../components/ui/Alert";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import { formatNextRun, whenLabel } from "../lib/whenLabel";
import { runsHref } from "../lib/runsNav";

/** First-class schedules: card list + create/edit dialog. */
export default function SchedulesPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const prefillFlow = params.get("flow_id") ?? "";
  const qc = useQueryClient();
  const schedules = useQuery({ queryKey: ["schedules"], queryFn: () => api.listSchedules() });
  const [createOpen, setCreateOpen] = useState(Boolean(prefillFlow));
  const [editing, setEditing] = useState<ScheduleSpec | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) =>
      enabled ? api.disableSchedule(id) : api.enableSchedule(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["schedules"] }),
    onError: (err: Error) => setError(err.message),
  });

  const list = schedules.data?.schedules ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-header__title">Schedules</h1>
          <p className="page-header__subtitle">
            Run flows on a timer while the local engine is online.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setCreateOpen(true); }}>
          New schedule
        </Button>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {schedules.isLoading && <p className="muted">Loading…</p>}

      {!schedules.isLoading && list.length === 0 && (
        <div className="card">
          <EmptyState
            title="No schedules yet"
            description="Pick a flow and how often it should run. You can also schedule from any flow card."
            action={<Button onClick={() => setCreateOpen(true)}>Create schedule</Button>}
          />
        </div>
      )}

      <div className="flow-cards">
        {list.map((s) => (
          <article key={s.schedule_id} className="flow-card card">
            <div className="flow-card__body">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="flow-card__title">{s.name || s.schedule_id}</h2>
                <span className={`status-pill status-pill--${s.enabled ? "ok" : "idle"}`}>
                  {s.enabled ? "on" : "off"}
                </span>
              </div>
              <p className="muted text-sm mt-1">
                Flow <code>{s.flow_id}</code> · {whenLabel(s.when)}
              </p>
              <p className="muted text-xs mt-1">Next: {formatNextRun(s.next_run_at)}</p>
            </div>
            <div className="flow-card__actions">
              <Button
                variant="ghost"
                onClick={() => toggle.mutate({ id: s.schedule_id, enabled: s.enabled })}
              >
                {s.enabled ? "Pause" : "Enable"}
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  setEditing({
                    schedule_id: s.schedule_id,
                    flow_id: s.flow_id,
                    when: s.when,
                    enabled: s.enabled,
                    name: s.name ?? "",
                  })
                }
              >
                Edit
              </Button>
              <Button variant="ghost" onClick={() => navigate(runsHref(s.flow_id))}>
                History
              </Button>
              <Link to={`/flows?edit=${encodeURIComponent(s.flow_id)}`}>
                <Button variant="ghost">Open flow</Button>
              </Link>
            </div>
          </article>
        ))}
      </div>

      <ScheduleDialog
        open={createOpen || editing != null}
        defaultFlowId={prefillFlow}
        initial={editing}
        onClose={() => {
          setCreateOpen(false);
          setEditing(null);
        }}
      />
    </div>
  );
}
