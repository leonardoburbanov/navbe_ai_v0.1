/** Thin REST client for Navbe daemon (LAN) or cloud relay proxy. */

import type {
  ConnectionSettings,
  FlowMetadata,
  FlowSpec,
  RunState,
  ScheduleMeta,
  ScheduleSpec,
  VersionInfo,
} from "./types";

export interface CloudDevice {
  device_id: string;
  label: string;
  online: boolean;
}

let connection: ConnectionSettings | null = null;

/** Set the active base URL + token for subsequent requests. */
export function setConnection(settings: ConnectionSettings | null): void {
  connection = settings
    ? {
        baseUrl: settings.baseUrl.replace(/\/+$/, ""),
        token: settings.token.trim(),
        mode: settings.mode,
        relayUrl: settings.relayUrl?.replace(/\/+$/, ""),
      }
    : null;
}

/** Return the current connection settings, if any. */
export function getConnection(): ConnectionSettings | null {
  return connection;
}

function parseBody<T>(status: number, raw: string): T {
  if (status === 204 || raw.length === 0) {
    return undefined as T;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`${status}: ${raw || "empty response"}`);
  }
  if (status < 200 || status >= 300) {
    const detail =
      typeof parsed === "object" &&
      parsed !== null &&
      "detail" in parsed &&
      (parsed as { detail: unknown }).detail !== undefined
        ? typeof (parsed as { detail: unknown }).detail === "string"
          ? String((parsed as { detail: unknown }).detail)
          : JSON.stringify((parsed as { detail: unknown }).detail)
        : JSON.stringify(parsed);
    throw new Error(`${status}: ${detail}`);
  }
  return parsed as T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!connection) {
    throw new Error("Not connected â€” open Home and pair with desktop");
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${connection.token}`,
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };
  if (init?.body !== undefined && init.body !== null) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(`${connection.baseUrl}${path}`, {
    ...init,
    headers,
  });
  const raw = response.status === 204 ? "" : await response.text();
  return parseBody<T>(response.status, raw);
}

/** Probe a candidate host without mutating global connection state. */
export async function probeConnection(
  settings: ConnectionSettings,
): Promise<VersionInfo> {
  const baseUrl = settings.baseUrl.replace(/\/+$/, "");
  const token = settings.token.trim();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  const health = await fetch(`${baseUrl}/health`, { headers });
  if (!health.ok) {
    throw new Error(`Health check failed (${health.status})`);
  }

  const versionRes = await fetch(`${baseUrl}/api/v1/version`, { headers });
  const raw = await versionRes.text();
  return parseBody<VersionInfo>(versionRes.status, raw);
}

/** List devices for a Navbe Cloud account token. */
export async function listCloudDevices(
  relayUrl: string,
  accountToken: string,
): Promise<CloudDevice[]> {
  const base = relayUrl.replace(/\/+$/, "");
  const response = await fetch(`${base}/v1/devices`, {
    headers: { Authorization: `Bearer ${accountToken.trim()}` },
  });
  const raw = await response.text();
  return parseBody<CloudDevice[]>(response.status, raw);
}

/**
 * Resolve cloud connection: account token â†’ online device proxy base URL.
 */
export async function resolveCloudConnection(
  relayUrl: string,
  accountToken: string,
  preferredDeviceId?: string,
): Promise<ConnectionSettings> {
  const devices = await listCloudDevices(relayUrl, accountToken);
  const online = devices.filter((d) => d.online);
  if (online.length === 0) {
    throw new Error("No online devices â€” enable Cloud remote on Desktop first");
  }
  const chosen =
    (preferredDeviceId
      ? online.find((d) => d.device_id === preferredDeviceId)
      : undefined) ??
    (online.length === 1 ? online[0] : online[0]);
  const relay = relayUrl.replace(/\/+$/, "");
  return {
    baseUrl: `${relay}/v1/devices/${chosen.device_id}/proxy`,
    token: accountToken.trim(),
    mode: "cloud",
    relayUrl: relay,
  };
}

export const api = {
  health: () => request<{ status: string }>("/health"),
  version: () => request<VersionInfo>("/api/v1/version"),

  listFlows: () => request<FlowMetadata[]>("/api/v1/flows"),
  getFlow: (flowId: string) =>
    request<FlowSpec>(`/api/v1/flows/${encodeURIComponent(flowId)}`),

  listRuns: (flowId?: string) => {
    const qs = flowId ? `?flow_id=${encodeURIComponent(flowId)}` : "";
    return request<{ runs: RunState[] }>(`/api/v1/runs${qs}`);
  },
  getRun: (runId: string) =>
    request<RunState>(`/api/v1/runs/${encodeURIComponent(runId)}`),
  startRun: (flowId: string, initialInput?: Record<string, unknown>) =>
    request<RunState>("/api/v1/runs", {
      method: "POST",
      body: JSON.stringify({ flow_id: flowId, initial_input: initialInput ?? null }),
    }),
  cancelRun: (runId: string) =>
    request<RunState>(`/api/v1/runs/${encodeURIComponent(runId)}/cancel`, {
      method: "POST",
    }),
  resumeRun: (runId: string, decision: Record<string, unknown>) =>
    request<RunState>(`/api/v1/runs/${encodeURIComponent(runId)}/resume`, {
      method: "POST",
      body: JSON.stringify(decision),
    }),

  listSchedules: () => request<{ schedules: ScheduleMeta[] }>("/api/v1/schedules"),
  getSchedule: (id: string) =>
    request<ScheduleSpec>(`/api/v1/schedules/${encodeURIComponent(id)}`),
  createSchedule: (spec: ScheduleSpec) =>
    request<ScheduleMeta>("/api/v1/schedules", {
      method: "POST",
      body: JSON.stringify(spec),
    }),
  updateSchedule: (id: string, spec: ScheduleSpec) =>
    request<ScheduleMeta>(`/api/v1/schedules/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(spec),
    }),
  enableSchedule: (id: string) =>
    request<ScheduleSpec>(`/api/v1/schedules/${encodeURIComponent(id)}/enable`, {
      method: "POST",
    }),
  disableSchedule: (id: string) =>
    request<ScheduleSpec>(`/api/v1/schedules/${encodeURIComponent(id)}/disable`, {
      method: "POST",
    }),
};

