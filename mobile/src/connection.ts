/** Persist and restore LAN connection settings. */

import AsyncStorage from "@react-native-async-storage/async-storage";

import { getConnection, setConnection } from "./api/client";
import type { ConnectionSettings } from "./api/types";

const STORAGE_KEY = "navbe.connection";

/** Load saved connection into the API client; returns settings or null. */
export async function loadConnection(): Promise<ConnectionSettings | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
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
export async function saveConnection(settings: ConnectionSettings): Promise<void> {
  const normalized: ConnectionSettings = {
    baseUrl: settings.baseUrl.replace(/\/+$/, ""),
    token: settings.token.trim(),
    mode: settings.mode,
    relayUrl: settings.relayUrl?.replace(/\/+$/, ""),
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  setConnection(normalized);
}

/** Clear saved connection. */
export async function clearConnection(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  setConnection(null);
}
