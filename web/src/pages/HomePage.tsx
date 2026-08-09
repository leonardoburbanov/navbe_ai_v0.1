import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { probeConnection } from "../api/client";
import BrandMark from "../components/BrandMark";
import { Btn, Card, Screen } from "../components/ui";
import { useConnection } from "../ConnectionContext";

/** Try parse desktop QR JSON payload into URL + token. */
function tryParsePairingBlob(raw: string): { baseUrl: string; token: string } | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as { baseUrl?: unknown; token?: unknown };
    if (typeof parsed.baseUrl === "string" && typeof parsed.token === "string") {
      return { baseUrl: parsed.baseUrl, token: parsed.token };
    }
  } catch {
    return null;
  }
  return null;
}

/** Pair with the desktop daemon — brand-first home. */
export default function HomePage() {
  const { ready, connected, settings, connect, disconnect } = useConnection();
  const [baseUrl, setBaseUrl] = useState("http://192.168.1.");
  const [token, setToken] = useState("");
  const [pairPaste, setPairPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!ready || hydrated) return;
    if (settings) {
      setBaseUrl(settings.baseUrl);
      setToken(settings.token);
    }
    setHydrated(true);
  }, [ready, settings, hydrated]);

  useEffect(() => {
    const parsed = tryParsePairingBlob(pairPaste);
    if (!parsed) return;
    setBaseUrl(parsed.baseUrl);
    setToken(parsed.token);
    setPairPaste("");
  }, [pairPaste]);

  async function onConnect() {
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const version = await probeConnection({ baseUrl, token });
      connect({ baseUrl, token });
      setOkMsg(`Connected · Navbe ${version.version}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function onDisconnect() {
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      disconnect();
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <Screen className="items-center justify-center gap-5 p-6">
        <BrandMark size="lg" />
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--signal)] border-t-transparent"
          aria-hidden
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5 px-5 pb-10 pt-2">
        <div className="flex flex-col gap-2.5">
          <BrandMark size="lg" showWordmark />
          <p className="text-[15px] leading-[22px] text-[var(--ink-muted)]">
            Run and monitor local workflows over the same Wi‑Fi as Desktop.
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{
                background: connected ? "var(--ok)" : "var(--ink-muted)",
              }}
            />
            <span className="text-[13px] font-medium text-[var(--ink-muted)]">
              {connected ? "Paired with desktop" : "Not paired"}
            </span>
          </div>
        </div>

        <Card>
          <h2 className="text-[17px] font-bold tracking-tight text-[var(--ink)]">
            {connected ? "Connection" : "Pair with desktop"}
          </h2>
          <p className="mb-3 mt-1 text-[13px] leading-[18px] text-[var(--ink-muted)]">
            On Desktop: Allow mobile → paste URL &amp; token, or paste the QR JSON
            payload below.
          </p>

          {connected && settings ? (
            <div className="mb-2 rounded-[10px] border border-[var(--line)] bg-[var(--bg-panel)] px-3 py-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">
                Engine
              </div>
              <div className="mono truncate text-xs text-[var(--signal)]">
                {settings.baseUrl}
              </div>
            </div>
          ) : null}

          <label className="mt-2.5 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">
            Paste QR JSON (optional)
          </label>
          <input
            className="mt-1.5 w-full rounded-[10px] border border-[var(--line)] bg-[var(--bg-panel)] px-3 py-3 text-[15px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)] focus:border-[var(--signal)]"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder='{"baseUrl":"http://…","token":"…"}'
            value={pairPaste}
            onChange={(e) => setPairPaste(e.target.value)}
          />

          <label className="mt-2.5 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">
            Base URL
          </label>
          <input
            className="mt-1.5 w-full rounded-[10px] border border-[var(--line)] bg-[var(--bg-panel)] px-3 py-3 text-[15px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)] focus:border-[var(--signal)]"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="url"
            placeholder="http://192.168.1.10:8000"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />

          <label className="mt-2.5 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">
            Pairing token
          </label>
          <input
            className="mt-1.5 w-full rounded-[10px] border border-[var(--line)] bg-[var(--bg-panel)] px-3 py-3 text-[15px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)] focus:border-[var(--signal)]"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            type={token.length > 8 ? "password" : "text"}
            placeholder="Token from desktop"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />

          {error ? (
            <p className="mt-2.5 text-[13px] text-[var(--err)]">{error}</p>
          ) : null}
          {okMsg ? (
            <p className="mt-2.5 text-[13px] text-[var(--ok)]">{okMsg}</p>
          ) : null}

          <div className="mt-4">
            <Btn
              className="w-full"
              label={connected ? "Reconnect" : "Connect"}
              variant="signal"
              loading={busy}
              disabled={!baseUrl.trim() || !token.trim()}
              onClick={() => void onConnect()}
            />
          </div>
        </Card>

        {connected ? (
          <div className="flex gap-2.5">
            <Link to="/flows" className="flex-1">
              <Btn className="w-full" label="Open flows" variant="primary" />
            </Link>
            <Btn
              className="flex-1"
              label="Disconnect"
              variant="ghost"
              loading={busy}
              onClick={onDisconnect}
            />
          </div>
        ) : null}
      </div>
    </Screen>
  );
}
