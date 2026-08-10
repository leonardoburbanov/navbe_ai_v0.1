/** React context for Navbe LAN connection state. */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { clearConnection, loadConnection, saveConnection } from "./connection";
import type { ConnectionSettings } from "./api/types";

interface ConnectionContextValue {
  ready: boolean;
  connected: boolean;
  settings: ConnectionSettings | null;
  connect: (settings: ConnectionSettings) => void;
  disconnect: () => void;
  refresh: () => void;
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5_000,
    },
  },
});

/** Provide connection + React Query to the app tree. */
export function AppProviders({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<ConnectionSettings | null>(null);

  const refresh = useCallback(() => {
    setSettings(loadConnection());
  }, []);

  useEffect(() => {
    refresh();
    setReady(true);
  }, [refresh]);

  const connect = useCallback((next: ConnectionSettings) => {
    saveConnection(next);
    setSettings({
      baseUrl: next.baseUrl.replace(/\/+$/, ""),
      token: next.token.trim(),
      mode: next.mode,
      relayUrl: next.relayUrl?.replace(/\/+$/, ""),
    });
    void queryClient.invalidateQueries();
  }, []);

  const disconnect = useCallback(() => {
    clearConnection();
    setSettings(null);
    queryClient.clear();
  }, []);

  const value = useMemo(
    () => ({
      ready,
      connected: settings != null,
      settings,
      connect,
      disconnect,
      refresh,
    }),
    [ready, settings, connect, disconnect, refresh],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>
    </QueryClientProvider>
  );
}

/** Access LAN connection state. */
export function useConnection(): ConnectionContextValue {
  const ctx = useContext(ConnectionContext);
  if (!ctx) {
    throw new Error("useConnection must be used within AppProviders");
  }
  return ctx;
}
