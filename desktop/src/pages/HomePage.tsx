import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { QRCodeSVG } from "qrcode.react";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type {
  CloudRemoteStatus,
  DaemonStatus,
  LanRemoteStatus,
  McpClientConfigureResult,
  McpClientStatus,
} from "../api/types";
import logo from "../assets/navbe-logo.png";
import Alert from "../components/ui/Alert";
import Button from "../components/ui/Button";
import { runsHref } from "../lib/runsNav";

const STARTER_ID = "starter";
const DEFAULT_RELAY = "http://127.0.0.1:8443";
const DEFAULT_CLOUD_PROJECT = "C:\\NavbeAI\\navbe_ai_cloud";

/** Simple start screen: status + one clear next action. */
export default function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [restarting, setRestarting] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [lanBusy, setLanBusy] = useState(false);
  const [lanError, setLanError] = useState<string | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [accountToken, setAccountToken] = useState("");
  const [relayUrl, setRelayUrl] = useState(DEFAULT_RELAY);
  const [projectDir, setProjectDir] = useState(DEFAULT_CLOUD_PROJECT);
  const [mcpBusy, setMcpBusy] = useState<"cursor" | "claude" | null>(null);
  const [mcpError, setMcpError] = useState<string | null>(null);
  const [mcpHint, setMcpHint] = useState<string | null>(null);

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
    refetchInterval: (q) =>
      q.state.data?.booting || restarting || lanBusy || cloudBusy ? 1000 : 3000,
  });

  const cloud = useQuery({
    queryKey: ["cloud-remote"],
    queryFn: async () => {
      try {
        return await invoke<CloudRemoteStatus>("cloud_remote_status");
      } catch {
        return {
          enabled: false,
          agent_running: false,
          relay_url: DEFAULT_RELAY,
          account_token_set: false,
          device_id: null,
          online: false,
          error: null,
        } satisfies CloudRemoteStatus;
      }
    },
    refetchInterval: cloudBusy ? 1000 : 4000,
  });

  useEffect(() => {
    if (cloud.data?.relay_url) setRelayUrl(cloud.data.relay_url);
  }, [cloud.data?.relay_url]);

  const ready = Boolean(daemon.data?.running);

  const mcp = useQuery({
    queryKey: ["mcp-client-status"],
    queryFn: async () => {
      try {
        return await invoke<McpClientStatus>("mcp_client_status");
      } catch {
        return {
          mcp_url: daemon.data?.mcp_url ?? "http://127.0.0.1:8000/mcp",
          cursor: { connected: false, path: null, available: false },
          claude: { connected: false, path: null, available: false },
          cursor_snippet: "",
          claude_snippet: "",
        } satisfies McpClientStatus;
      }
    },
    enabled: ready,
    refetchInterval: mcpBusy ? 1000 : 5000,
  });

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
  const mcpUrl = mcp.data?.mcp_url ?? status?.mcp_url ?? "http://127.0.0.1:8000/mcp";

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

  async function setCloudRemote(enabled: boolean) {
    setCloudBusy(true);
    setCloudError(null);
    try {
      await invoke<CloudRemoteStatus>("cloud_remote_set", {
        enabled,
        accountToken: accountToken.trim() || null,
        relayUrl: relayUrl.trim() || null,
        projectDir: projectDir.trim() || null,
      });
      await queryClient.invalidateQueries({ queryKey: ["cloud-remote"] });
    } catch (err) {
      setCloudError(err instanceof Error ? err.message : String(err));
    } finally {
      setCloudBusy(false);
    }
  }

  async function configureMcp(client: "cursor" | "claude") {
    setMcpBusy(client);
    setMcpError(null);
    setMcpHint(null);
    try {
      const result = await invoke<McpClientConfigureResult>("mcp_client_configure", {
        client,
      });
      await queryClient.invalidateQueries({ queryKey: ["mcp-client-status"] });
      setMcpHint(
        client === "cursor"
          ? `Connected Cursor (${result.path}). Reload MCP in Cursor (Settings → Tools & MCP).`
          : `Connected Claude Desktop (${result.path}). Fully quit and reopen Claude Desktop. Needs Node.js / npx.`,
      );
    } catch (err) {
      setMcpError(err instanceof Error ? err.message : String(err));
    } finally {
      setMcpBusy(null);
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  const cloudEnabled = Boolean(cloud.data?.enabled);

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
        {cloudError && <Alert tone="error">{cloudError}</Alert>}
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
        <div className="home-cta card home-lan home-mcp">
          <div>
            <h2 className="home-cta__title">Connect AI agents</h2>
            <p className="muted text-sm">
              Wire this local engine into Cursor or Claude Desktop over MCP. Keep Navbe running while
              you use the agent.
            </p>
          </div>

          <div className="home-mcp__url flex items-center gap-2 mt-3 flex-wrap">
            <code className="text-xs">{mcpUrl}</code>
            <Button variant="ghost" size="sm" onClick={() => void copyText(mcpUrl)}>
              Copy URL
            </Button>
          </div>

          <div className="home-mcp__clients mt-3">
            <div className="home-mcp__row">
              <div>
                <strong>Cursor</strong>
                <p className="muted text-sm">
                  {mcp.data?.cursor.connected ? "Connected" : "Not connected"}
                  {mcp.data?.cursor.path ? (
                    <>
                      {" "}
                      · <span className="home-mcp__path">{mcp.data.cursor.path}</span>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="home-mcp__actions">
                <Button
                  size="sm"
                  disabled={mcpBusy !== null || mcp.data?.cursor.available === false}
                  onClick={() => void configureMcp("cursor")}
                >
                  {mcpBusy === "cursor"
                    ? "Connecting…"
                    : mcp.data?.cursor.connected
                      ? "Reconnect"
                      : "Connect"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!mcp.data?.cursor_snippet}
                  onClick={() => void copyText(mcp.data?.cursor_snippet ?? "")}
                >
                  Copy JSON
                </Button>
              </div>
            </div>

            <div className="home-mcp__row">
              <div>
                <strong>Claude Desktop</strong>
                <p className="muted text-sm">
                  {mcp.data?.claude.available === false
                    ? "Copy JSON and paste into Claude’s config (path not detected on this OS)."
                    : mcp.data?.claude.connected
                      ? "Connected"
                      : "Not connected"}
                  {mcp.data?.claude.path ? (
                    <>
                      {" "}
                      · <span className="home-mcp__path">{mcp.data.claude.path}</span>
                    </>
                  ) : null}
                </p>
                <p className="muted text-sm">Uses npx mcp-remote — Node.js required.</p>
              </div>
              <div className="home-mcp__actions">
                <Button
                  size="sm"
                  disabled={mcpBusy !== null || mcp.data?.claude.available === false}
                  onClick={() => void configureMcp("claude")}
                >
                  {mcpBusy === "claude"
                    ? "Connecting…"
                    : mcp.data?.claude.connected
                      ? "Reconnect"
                      : "Connect"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!mcp.data?.claude_snippet}
                  onClick={() => void copyText(mcp.data?.claude_snippet ?? "")}
                >
                  Copy JSON
                </Button>
              </div>
            </div>
          </div>

          {mcpHint && <Alert tone="info">{mcpHint}</Alert>}
          {mcpError && <Alert tone="error">{mcpError}</Alert>}
        </div>
      )}

      {ready && (
        <div className="home-cta card home-lan">
          <div className="home-lan__row">
            <div>
              <h2 className="home-cta__title">Cloud remote</h2>
              <p className="muted text-sm">
                Same account token in Desktop, Web, and Mobile. Device secret stays on this
                laptop. Requires a running navbe-cloud relay.
              </p>
            </div>
            <Button
              variant={cloudEnabled ? "ghost" : undefined}
              disabled={cloudBusy}
              onClick={() => void setCloudRemote(!cloudEnabled)}
            >
              {cloudBusy
                ? cloudEnabled
                  ? "Disabling…"
                  : "Enabling…"
                : cloudEnabled
                  ? "Turn off"
                  : "Enable cloud"}
            </Button>
          </div>
          <div className="home-lan__details">
            <label className="muted text-sm block">
              Account token
              <input
                className="mt-1 w-full text-sm"
                type="password"
                autoComplete="off"
                placeholder={
                  cloud.data?.account_token_set ? "Token saved — paste to replace" : "nbc_…"
                }
                value={accountToken}
                onChange={(e) => setAccountToken(e.target.value)}
              />
            </label>
            <label className="muted text-sm block mt-2">
              Relay URL
              <input
                className="mt-1 w-full text-sm"
                value={relayUrl}
                onChange={(e) => setRelayUrl(e.target.value)}
              />
            </label>
            <label className="muted text-sm block mt-2">
              Cloud project dir (for uv run agent)
              <input
                className="mt-1 w-full text-sm"
                value={projectDir}
                onChange={(e) => setProjectDir(e.target.value)}
                placeholder="C:\NavbeAI\navbe_ai_cloud"
              />
            </label>
            {cloudEnabled && (
              <p className="muted text-sm mt-2">
                Status:{" "}
                {cloud.data?.online
                  ? "Online"
                  : cloud.data?.agent_running
                    ? "Agent running — waiting for relay"
                    : "Agent not running"}
                {cloud.data?.device_id ? ` · device ${cloud.data.device_id}` : ""}
              </p>
            )}
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
    </div>
  );
}
