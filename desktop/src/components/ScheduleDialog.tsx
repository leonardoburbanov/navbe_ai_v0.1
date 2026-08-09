import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import type { ScheduleSpec } from "../api/types";
import Alert from "./ui/Alert";
import Button from "./ui/Button";
import { SCHEDULE_PRESETS, whenLabel } from "../lib/whenLabel";

interface ScheduleDialogProps {
  open: boolean;
  /** Prefill flow when opening from a flow card/editor. */
  defaultFlowId?: string;
  /** When set, dialog edits this schedule. */
  initial?: ScheduleSpec | null;
  onClose: () => void;
  onSaved?: () => void;
}

/** Create/edit schedule with presets. */
export default function ScheduleDialog({
  open,
  defaultFlowId = "",
  initial = null,
  onClose,
  onSaved,
}: ScheduleDialogProps) {
  const qc = useQueryClient();
  const flows = useQuery({ queryKey: ["flows"], queryFn: () => api.listFlows() });
  const [presetId, setPresetId] = useState<string>("hourly");
  const [customWhen, setCustomWhen] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ScheduleSpec>({
    schedule_id: "",
    flow_id: defaultFlowId,
    when: SCHEDULE_PRESETS[0].when,
    enabled: true,
    name: "",
  });

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        schedule_id: initial.schedule_id,
        flow_id: initial.flow_id,
        when: initial.when,
        enabled: initial.enabled ?? true,
        name: initial.name ?? "",
      });
      const match = SCHEDULE_PRESETS.find((p) => p.when === initial.when);
      setPresetId(match?.id ?? "custom");
      setCustomWhen(match ? "" : initial.when);
    } else {
      const sid = `sched_${Date.now().toString(36)}`;
      setForm({
        schedule_id: sid,
        flow_id: defaultFlowId,
        when: SCHEDULE_PRESETS[0].when,
        enabled: true,
        name: "",
      });
      setPresetId("hourly");
      setCustomWhen("");
    }
    setError(null);
  }, [open, initial, defaultFlowId]);

  const save = useMutation({
    mutationFn: async () => {
      const when =
        presetId === "custom" ? customWhen.trim() : (SCHEDULE_PRESETS.find((p) => p.id === presetId)?.when ?? form.when);
      const payload: ScheduleSpec = {
        ...form,
        when,
        name: form.name?.trim() || form.schedule_id,
      };
      if (!payload.schedule_id || !payload.flow_id || !payload.when) {
        throw new Error("Schedule id, flow, and timing are required");
      }
      const isEdit = Boolean(initial);
      return isEdit
        ? api.updateSchedule(payload.schedule_id, payload)
        : api.createSchedule(payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["schedules"] });
      onSaved?.();
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  if (!open) return null;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  const resolvedWhen =
    presetId === "custom"
      ? customWhen
      : (SCHEDULE_PRESETS.find((p) => p.id === presetId)?.when ?? "");

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <form
        className="dialog"
        style={{ width: "min(480px, 100%)" }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
      >
        <h2 className="dialog__title">{initial ? "Edit schedule" : "Schedule a flow"}</h2>
        <p className="dialog__body">
          Runs while the local engine is online. Preview: {whenLabel(resolvedWhen)}
        </p>

        <label className="field">
          <span>Flow</span>
          <select
            value={form.flow_id}
            onChange={(e) => setForm({ ...form, flow_id: e.target.value })}
            required
          >
            <option value="">Select…</option>
            {(flows.data ?? []).map((f) => (
              <option key={f.flow_id} value={f.flow_id}>
                {f.name ? `${f.name} (${f.flow_id})` : f.flow_id}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Name</span>
          <input
            value={form.name ?? ""}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Hourly export"
          />
        </label>

        <label className="field">
          <span>Schedule ID</span>
          <input
            value={form.schedule_id}
            disabled={Boolean(initial)}
            onChange={(e) => setForm({ ...form, schedule_id: e.target.value })}
            required
          />
        </label>

        <fieldset className="field">
          <span>When</span>
          <div className="preset-grid">
            {SCHEDULE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`chip ${presetId === p.id ? "chip--on" : ""}`}
                onClick={() => setPresetId(p.id)}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              className={`chip ${presetId === "custom" ? "chip--on" : ""}`}
              onClick={() => setPresetId("custom")}
            >
              Custom
            </button>
          </div>
        </fieldset>

        {presetId === "custom" && (
          <label className="field">
            <span>Custom expression</span>
            <input
              value={customWhen}
              onChange={(e) => setCustomWhen(e.target.value)}
              placeholder="+30m or 0 9 * * *"
              required
            />
          </label>
        )}

        {error && <Alert tone="error">{error}</Alert>}

        <div className="dialog__actions">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save schedule"}
          </Button>
        </div>
      </form>
    </div>
  );
}
