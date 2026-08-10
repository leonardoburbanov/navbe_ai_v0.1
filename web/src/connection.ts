/** Persist and restore LAN connection settings (localStorage). */

import { getConnection, setConnection } from "./api/client";
import type { ConnectionSettings } from "./api/types";

const STORAGE_KEY = "navbe.connection";

/** Load saved connection into the API client; returns settings or null. */
export function loadConnection(): ConnectionSettings | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    setConnection(null);
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as ConnectionSettings;
    if (!parsed.baseUrl || !parsed.token) {
      setConnection(null);
      return null;
    }
    setConnection(parsed);
    return getConnection();
  } catch {
    setConnection(null);
    return null;
  }
}

/** Save and activate connection settings. */
export function saveConnection(settings: ConnectionSettings): void {
  const normalized: ConnectionSettings = {
    baseUrl: settings.baseUrl.replace(/\/+$/, ""),
    token: settings.token.trim(),
    mode: settings.mode,
    relayUrl: settings.relayUrl?.replace(/\/+$/, ""),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  setConnection(normalized);
}

/** Clear saved connection. */
export function clearConnection(): void {
  localStorage.removeItem(STORAGE_KEY);
  setConnection(null);
}
