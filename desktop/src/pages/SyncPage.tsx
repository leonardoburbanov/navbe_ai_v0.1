import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { GithubRepoItem } from "../api/types";
import Alert from "../components/ui/Alert";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";

type Step = 1 | 2 | 3;

/** Guided GitHub login → pick repo → push/pull. */
export default function SyncPage() {
  const qc = useQueryClient();
  const auth = useQuery({ queryKey: ["github-auth"], queryFn: () => api.authGithubStatus() });
  const status = useQuery({
    queryKey: ["sync-status"],
    queryFn: () => api.syncStatus(),
    retry: false,
  });
  const loggedIn = Boolean(
    auth.data?.logged_in || status.data?.github_logged_in,
  );
  const [step, setStep] = useState<Step>(1);
  const [device, setDevice] = useState<{ user_code: string; verification_uri: string } | null>(
    null,
  );
  const [waitingLogin, setWaitingLogin] = useState(false);
  const [repoQuery, setRepoQuery] = useState("");
  const [selected, setSelected] = useState<GithubRepoItem | null>(null);
  const [manualOwner, setManualOwner] = useState("");
  const [manualName, setManualName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const repos = useQuery({
    queryKey: ["github-repos"],
    queryFn: () => api.authGithubRepos(),
    enabled: loggedIn,
    retry: false,
  });

  useEffect(() => {
    if (loggedIn && step === 1) setStep(2);
    if (status.data?.configured && loggedIn) setStep(3);
  }, [loggedIn, status.data?.configured, step]);

  const filteredRepos = useMemo(() => {
    const list = repos.data?.repos ?? [];
    const q = repoQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.owner.toLowerCase().includes(q),
    );
  }, [repos.data, repoQuery]);

  const begin = useMutation({
    mutationFn: () => api.authGithubBegin(),
    onSuccess: async (res) => {
      setDevice(res);
      setError(null);
      setWaitingLogin(true);
      try {
        await openUrl(res.verification_uri);
      } catch {
        /* opener may be unavailable in browser-only preview */
      }
      try {
        await api.authGithubComplete(300);
        setDevice(null);
        setWaitingLogin(false);
        setInfo("Signed in with GitHub");
        setStep(2);
        void qc.invalidateQueries({ queryKey: ["github-auth"] });
        void qc.invalidateQueries({ queryKey: ["sync-status"] });
      } catch (err) {
        setWaitingLogin(false);
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    onError: (err: Error) => setError(err.message),
  });

  const logout = useMutation({
    mutationFn: () => api.authGithubLogout(),
    onSuccess: () => {
      setStep(1);
      setSelected(null);
      void qc.invalidateQueries({ queryKey: ["github-auth"] });
      void qc.invalidateQueries({ queryKey: ["sync-status"] });
      void qc.invalidateQueries({ queryKey: ["github-repos"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const connect = useMutation({
    mutationFn: () => {
      if (selected) {
        return api.syncConnect({
          owner: selected.owner,
          name: selected.name,
          private: selected.private,
        });
      }
      if (!manualOwner.trim() || !manualName.trim()) {
        throw new Error("Pick a repository or enter owner and name");
      }
      return api.syncConnect({
        owner: manualOwner.trim(),
        name: manualName.trim(),
        private: true,
      });
    },
    onSuccess: () => {
      setInfo("Repository connected");
      setError(null);
      setStep(3);
      void qc.invalidateQueries({ queryKey: ["sync-status"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const push = useMutation({
    mutationFn: () => api.syncPush(),
    onSuccess: (res) => {
      setInfo(res.message || "Pushed");
      setError(null);
      void qc.invalidateQueries({ queryKey: ["sync-status"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const pull = useMutation({
    mutationFn: () => api.syncPull(),
    onSuccess: (res) => {
      setInfo(res.message || "Pulled");
      setError(null);
      void qc.invalidateQueries({ queryKey: ["sync-status"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const loginLabel =
    auth.data?.login || status.data?.github_login || (loggedIn ? "signed in" : null);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sync"
        subtitle="Sign in with GitHub, pick a repo, then push or pull your flows."
      />

      <ol className="sync-steps">
        <li className={step === 1 ? "sync-steps__item--active" : ""}>1. Sign in</li>
        <li className={step === 2 ? "sync-steps__item--active" : ""}>2. Choose repo</li>
        <li className={step === 3 ? "sync-steps__item--active" : ""}>3. Sync</li>
      </ol>

      {error && <Alert tone="error">{error}</Alert>}
      {info && <Alert tone="info">{info}</Alert>}

      {step === 1 && (
        <div className="card space-y-3">
          <h2 className="text-lg font-medium">Sign in with GitHub</h2>
          <p className="muted text-sm">
            Opens GitHub in your browser. Keep this window open while you authorize.
          </p>
          <Button onClick={() => begin.mutate()} disabled={begin.isPending || waitingLogin}>
            {waitingLogin ? "Waiting for browser…" : begin.isPending ? "Starting…" : "Sign in with GitHub"}
          </Button>
          {device && (
            <div className="rounded-lg border border-[var(--line)] p-3 text-sm space-y-1">
              <p className="muted">If the browser does not open, go to the link and enter this code:</p>
              <div>
                Code: <code className="text-lg tracking-widest">{device.user_code}</code>
              </div>
              <div>
                Open: <code>{device.verification_uri}</code>
              </div>
            </div>
          )}
        </div>
      )}

      {step >= 2 && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-lg font-medium">Choose repository</h2>
            {loggedIn && (
              <Button variant="ghost" size="sm" onClick={() => logout.mutate()}>
                Sign out{loginLabel ? ` (${loginLabel})` : ""}
              </Button>
            )}
          </div>

          {repos.isLoading && <p className="muted text-sm">Loading repositories…</p>}
          {repos.isError && (
            <Alert tone="warn">
              Could not list repositories. Enter owner and name below, or install the GitHub App on
              the repos you need.
            </Alert>
          )}

          {(repos.data?.repos.length ?? 0) > 0 && (
            <>
              <label className="field">
                <span>Search</span>
                <input
                  value={repoQuery}
                  onChange={(e) => setRepoQuery(e.target.value)}
                  placeholder="owner/name"
                />
              </label>
              <div className="sync-repo-list">
                {filteredRepos.map((r) => (
                  <button
                    key={r.full_name}
                    type="button"
                    className={`sync-repo-item ${selected?.full_name === r.full_name ? "sync-repo-item--selected" : ""}`}
                    onClick={() => setSelected(r)}
                  >
                    <span className="font-medium">{r.full_name}</span>
                    <span className="muted text-xs">{r.private ? "private" : "public"}</span>
                  </button>
                ))}
                {filteredRepos.length === 0 && (
                  <p className="muted text-sm px-1">No matches</p>
                )}
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="field">
              <span>Owner (fallback)</span>
              <input value={manualOwner} onChange={(e) => setManualOwner(e.target.value)} />
            </label>
            <label className="field">
              <span>Repo name</span>
              <input value={manualName} onChange={(e) => setManualName(e.target.value)} />
            </label>
          </div>
          <Button
            onClick={() => connect.mutate()}
            disabled={connect.isPending || (!selected && (!manualOwner || !manualName))}
          >
            {connect.isPending ? "Connecting…" : "Connect"}
          </Button>
          {status.data?.configured && (
            <Button variant="ghost" onClick={() => setStep(3)}>
              Continue to sync
            </Button>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="card space-y-4">
          <h2 className="text-lg font-medium">Sync</h2>
          <div className="sync-status-grid">
            <div>
              <div className="muted text-xs">Remote</div>
              <div className="text-sm break-all">{status.data?.remote_url || "—"}</div>
            </div>
            <div>
              <div className="muted text-xs">Branch</div>
              <div className="text-sm">{status.data?.branch || status.data?.default_branch || "—"}</div>
            </div>
            <div>
              <div className="muted text-xs">Dirty</div>
              <div className="text-sm">{status.data?.dirty ? "yes" : "no"}</div>
            </div>
            <div>
              <div className="muted text-xs">Flows (local / remote)</div>
              <div className="text-sm">
                {status.data?.local_flow_count ?? 0} / {status.data?.remote_flow_count ?? 0}
              </div>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button className="min-w-[120px]" onClick={() => push.mutate()} disabled={push.isPending}>
              {push.isPending ? "Pushing…" : "Push"}
            </Button>
            <Button
              className="min-w-[120px]"
              variant="ghost"
              onClick={() => pull.mutate()}
              disabled={pull.isPending}
            >
              {pull.isPending ? "Pulling…" : "Pull"}
            </Button>
            <Button variant="ghost" onClick={() => setStep(2)}>
              Change repo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
