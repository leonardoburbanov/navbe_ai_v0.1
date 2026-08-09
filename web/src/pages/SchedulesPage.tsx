import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { api } from "../api/client";
import type { ScheduleSpec } from "../api/types";
import { Btn, EmptyState, PageTitle, Screen, StatusPill } from "../components/ui";
import { useConnection } from "../ConnectionContext";

/** Schedules with cards + modal editor. */
export default function SchedulesPage() {
  const { connected } = useConnection();
  const qc = useQueryClient();
  const [editor, setEditor] = useState<ScheduleSpec | null>(null);
  const [error, setError] = useState<string | null>(null);

  const flows = useQuery({
    queryKey: ["flows"],
    queryFn: () => api.listFlows(),
    enabled: connected,
  });
  const schedules = useQuery({
    queryKey: ["schedules"],
    queryFn: () => api.listSchedules(),
    enabled: connected,
    refetchInterval: 5000,
  });

  const save = useMutation({
    mutationFn: async (spec: ScheduleSpec) => {
      const existing = (schedules.data?.schedules ?? []).some(
        (s) => s.schedule_id === spec.schedule_id,
      );
      return existing
        ? api.updateSchedule(spec.schedule_id, spec)
        : api.createSchedule(spec);
    },
    onSuccess: () => {
      setEditor(null);
      setError(null);
      void qc.invalidateQueries({ queryKey: ["schedules"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) =>
      enabled ? api.disableSchedule(id) : api.enableSchedule(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["schedules"] }),
    onError: (err: Error) => setError(err.message),
  });

  if (!connected) {
    return (
      <Screen>
        <EmptyState
          title="Connect first"
          body="Pair with desktop to manage schedules from the browser."
          action={
            <Link to="/">
              <Btn label="Go to Home" variant="signal" />
            </Link>
          }
        />
      </Screen>
    );
  }

  if (schedules.isLoading) {
    return (
      <Screen className="items-center justify-center">
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--signal)] border-t-transparent"
          aria-hidden
        />
      </Screen>
    );
  }

  const list = schedules.data?.schedules ?? [];
  const flowIds = (flows.data ?? []).map((f) => f.flow_id);

  function openNew() {
    setEditor({
      schedule_id: `sched-${Date.now().toString(36)}`,
      flow_id: flowIds[0] ?? "",
      when: "+1h",
      enabled: true,
      name: "",
    });
  }

  return (
    <Screen>
      <div className="px-4 pb-10 pt-4">
        <PageTitle
          title="Schedules"
          subtitle="Timers fire while the desktop engine is online"
          action={<Btn label="New" variant="signal" onClick={openNew} />}
        />

        {list.length === 0 ? (
          <EmptyState
            title="No schedules yet"
            body="Create one here or from Desktop."
            action={<Btn label="Create schedule" variant="signal" onClick={openNew} />}
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {list.map((item) => (
              <li
                key={item.schedule_id}
                className="rounded-[14px] border border-[var(--line)] bg-[var(--bg-elevated)] p-3.5"
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-base font-bold text-[var(--ink)]">
                    {item.name || item.schedule_id}
                  </span>
                  <StatusPill
                    label={item.enabled ? "on" : "off"}
                    tone={item.enabled ? "ok" : "neutral"}
                  />
                </div>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">
                  {item.flow_id} · {item.when}
                </p>
                {item.next_run_at ? (
                  <p className="text-xs text-[var(--ink-muted)]">
                    Next {new Date(item.next_run_at).toLocaleString()}
                  </p>
                ) : null}
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Btn
                    label={item.enabled ? "Pause" : "Enable"}
                    variant="ghost"
                    onClick={() =>
                      toggle.mutate({ id: item.schedule_id, enabled: item.enabled })
                    }
                  />
                  <Btn
                    label="Edit"
                    variant="ghost"
                    onClick={() =>
                      setEditor({
                        schedule_id: item.schedule_id,
                        flow_id: item.flow_id,
                        when: item.when,
                        enabled: item.enabled,
                        name: item.name ?? "",
                      })
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        {error ? (
          <p className="mt-2 text-sm text-[var(--err)]">{error}</p>
        ) : null}
      </div>

      {editor ? (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/65 sm:items-center"
          onClick={() => setEditor(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditor(null);
          }}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-t-[18px] bg-[var(--bg-elevated)] p-5 pb-8 sm:rounded-[18px]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal
            aria-label="Schedule editor"
          >
            <div className="mx-auto mb-3.5 h-1 w-9 rounded-full bg-[var(--line-strong)] sm:hidden" />
            <h2 className="mb-1 text-xl font-bold text-[var(--ink)]">Schedule</h2>
            <Field
              label="ID"
              value={editor.schedule_id}
              onChange={(schedule_id) => setEditor({ ...editor, schedule_id })}
            />
            <Field
              label="Flow ID"
              value={editor.flow_id}
              onChange={(flow_id) => setEditor({ ...editor, flow_id })}
              placeholder={flowIds.join(", ") || "flow_id"}
            />
            <Field
              label="When"
              value={editor.when}
              onChange={(when) => setEditor({ ...editor, when })}
              placeholder="+30s / +1h / cron"
            />
            <Field
              label="Name"
              value={editor.name ?? ""}
              onChange={(name) => setEditor({ ...editor, name })}
            />
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Btn
                className="flex-1"
                label={save.isPending ? "Saving…" : "Save"}
                variant="signal"
                loading={save.isPending}
                onClick={() => save.mutate(editor)}
              />
              <Btn label="Cancel" variant="ghost" onClick={() => setEditor(null)} />
            </div>
          </div>
        </div>
      ) : null}
    </Screen>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}): ReactNode {
  return (
    <label className="mt-2.5 block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">
        {label}
      </span>
      <input
        className="w-full rounded-[10px] border border-[var(--line-strong)] bg-[var(--bg-panel)] px-3 py-2.5 text-[15px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)] focus:border-[var(--signal)]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoCapitalize="off"
        spellCheck={false}
        placeholder={placeholder}
      />
    </label>
  );
}
