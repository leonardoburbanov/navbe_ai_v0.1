import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { QRCodeSVG } from "qrcode.react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { api } from "../api/client";
import type { DaemonStatus, LanRemoteStatus } from "../api/types";
import logo from "../assets/navbe-logo.png";
import Alert from "../components/ui/Alert";
import Button from "../components/ui/Button";
import { runsHref } from "../lib/runsNav";

const STARTER_ID = "starter";

/** Simple start screen: status + one clear next action. */
export default function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [restarting, setRestarting] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [lanBusy, setLanBusy] = useState(false);
  const [lanError, setLanError] = useState<string | null>(null);

  const daemon = useQuery({
    queryKey: ["daemon-status"],
    queryFn: async () => {
      try {
        return await invoke<DaemonStatus>("daemon_status");
      } catch {
        return {
          running: false,
          attached: false,
          booting: false,
          base_url: "http://127.0.0.1:8000",
          mcp_url: "http://127.0.0.1:8000/mcp",
          log_path: null,
          error: "Engine status unavailable (browser preview?)",
          lan_enabled: false,
          lan_urls: [],
          lan_token: null,
        } satisfies DaemonStatus;
      }
    },
    refetchInterval: (q) => (q.state.data?.booting || restarting || lanBusy ? 1000 : 3000),
  });

  const ready = Boolean(daemon.data?.running);
  const flows = useQuery({
    queryKey: ["flows"],
    queryFn: () => api.listFlows(),
    enabled: ready,
    retry: false,
  });

  const status = daemon.data;
  const booting = (Boolean(status?.booting) || restarting || lanBusy) && !ready;
  const hasStarter = (flows.data ?? []).some((f) => f.flow_id === STARTER_ID);
  const flowCount = flows.data?.length ?? 0;
  const lanEnabled = Boolean(status?.lan_enabled);
  const lanUrls = status?.lan_urls ?? [];
  const lanToken = status?.lan_token ?? null;
  const qrPayload =
    lanEnabled && lanToken && lanUrls[0]
      ? JSON.stringify({ baseUrl: lanUrls[0], token: lanToken })
      : null;

  const runStarter = useMutation({
    mutationFn: () => api.startRun(STARTER_ID),
    onSuccess: (run) => {
      setRunError(null);
      void queryClient.invalidateQueries({ queryKey: ["runs"] });
      navigate(runsHref(run.flow_id, run.run_id));
    },
    onError: (err: Error) => setRunError(err.message),
  });

  async function restartEngine() {
    setRestarting(true);
    setRunError(null);
    try {
      await invoke<DaemonStatus>("daemon_restart");
      await queryClient.invalidateQueries();
    } finally {
      setRestarting(false);
    }
  }

  async function setLanRemote(enabled: boolean) {
    setLanBusy(true);
    setLanError(null);
    try {
      await invoke<LanRemoteStatus>("lan_remote_set", { enabled });
      await queryClient.invalidateQueries({ queryKey: ["daemon-status"] });
    } catch (err) {
      setLanError(err instanceof Error ? err.message : String(err));
    } finally {
      setLanBusy(false);
    }
  }

  return (
    <div className="home">
      <div className="home-hero">
        <img src={logo} alt="" className="home-logo" />
        <p className="home-kicker">Navbe</p>
        <h1 className="home-title">Run local workflows</h1>
        <p className="home-lead">
          Build a graph of steps, connect APIs if you need them, press Run, then see what happened.
        </p>
      </div>

      <div className={`home-status card ${ready ? "home-status--ok" : "home-status--wait"}`}>
        <div className="home-status__row">
          <span className={`home-status__dot ${ready ? "is-ok" : ""}`} />
          <div>
            <strong>{ready ? "Ready to use" : booting ? "Starting…" : "Not ready yet"}</strong>
            <p className="muted text-sm mt-1">
              {ready
                ? `${flowCount} workflow${flowCount === 1 ? "" : "s"} available`
                : "Wait a few seconds, or restart the engine."}
            </p>
          </div>
          {!ready && (
            <Button
              variant="ghost"
              className="ml-auto"
              disabled={restarting || lanBusy}
              onClick={() => void restartEngine()}
            >
              {restarting ? "Restarting…" : "Restart"}
            </Button>
          )}
        </div>
        {status?.error && <Alert tone="error">{status.error}</Alert>}
        {runError && <Alert tone="error">{runError}</Alert>}
        {lanError && <Alert tone="error">{lanError}</Alert>}
      </div>

      {ready && (
        <div className="home-actions">
          <div className="home-cta card">
            <h2 className="home-cta__title">1. Try an example</h2>
            <p className="muted text-sm">
              {hasStarter
                ? "Starter sends a test HTTP request. No secrets required."
                : "Open Flows and run any workflow, or create one."}
            </p>
            <div className="home-cta__buttons">
              {hasStarter ? (
                <Button
                  disabled={runStarter.isPending}
                  onClick={() => runStarter.mutate()}
                >
                  {runStarter.isPending ? "Starting…" : "Run starter"}
                </Button>
              ) : (
                <Link to="/flows">
                  <Button>Open Flows</Button>
                </Link>
              )}
              <Link to="/runs">
                <Button variant="ghost">See results</Button>
              </Link>
            </div>
          </div>

          <div className="home-cta card">
            <h2 className="home-cta__title">2. Make your own</h2>
            <p className="muted text-sm">
              Create a flow, drag steps, connect them, then Run.
            </p>
            <div className="home-cta__buttons">
              <Link to="/flows">
                <Button variant="ghost">Go to Flows</Button>
              </Link>
            </div>
          </div>

          <div className="home-cta card">
            <h2 className="home-cta__title">3. Only if you need it</h2>
            <ul className="home-extra">
              <li>
                <Link to="/credentials">Credentials</Link>
                <span className="muted"> — API keys (e.g. Langfuse)</span>
              </li>
              <li>
                <Link to="/catalog">Catalog</Link>
                <span className="muted"> — what steps & connectors exist</span>
              </li>
              <li>
                <Link to="/schedules">Schedules</Link>
                <span className="muted"> — run on a timer</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {ready && (
        <div className="home-cta card home-lan">
          <div className="home-lan__row">
            <div>
              <h2 className="home-cta__title">Mobile on same Wi‑Fi</h2>
              <p className="muted text-sm">
                Lets the iOS app run and monitor workflows on this PC. Windows Firewall may prompt
                the first time.
              </p>
            </div>
            <Button
              variant={lanEnabled ? "ghost" : undefined}
              disabled={lanBusy}
              onClick={() => void setLanRemote(!lanEnabled)}
            >
              {lanBusy
                ? lanEnabled
                  ? "Disabling…"
                  : "Enabling…"
                : lanEnabled
                  ? "Turn off"
                  : "Allow mobile"}
            </Button>
          </div>
          {lanEnabled && (
            <div className="home-lan__details">
              {lanUrls.length === 0 ? (
                <p className="muted text-sm">No LAN IP detected yet — check Wi‑Fi.</p>
              ) : (
                <>
                  <p className="muted text-sm">Scan or paste into the mobile app:</p>
                  <ul className="home-lan__urls">
                    {lanUrls.map((url) => (
                      <li key={url}>
                        <code className="text-xs">{url}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void navigator.clipboard.writeText(url)}
                        >
                          Copy
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {lanToken && (
                    <div className="home-lan__token">
                      <span className="muted text-sm">Pairing token</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-xs break-all">{lanToken}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void navigator.clipboard.writeText(lanToken)}
                        >
                          Copy
                        </Button>
                      </div>
                    </div>
                  )}
                  {qrPayload && (
                    <div className="home-lan__qr">
                      <QRCodeSVG value={qrPayload} size={160} level="M" includeMargin />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {ready && (
        <details className="home-advanced card">
          <summary>Advanced: connect AI agents (MCP)</summary>
          <p className="muted text-sm mt-2">
            Same local engine. Paste this URL into Cursor or Claude Desktop:
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <code className="text-xs">{status?.mcp_url ?? "http://127.0.0.1:8000/mcp"}</code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                navigator.clipboard.writeText(status?.mcp_url ?? "http://127.0.0.1:8000/mcp")
              }
            >
              Copy
            </Button>
          </div>
        </details>
      )}
    </div>
  );
}
