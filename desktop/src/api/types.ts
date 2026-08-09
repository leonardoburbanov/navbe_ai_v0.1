/** Shared API response shapes for the desktop UI. */

export type JsonSchema = Record<string, unknown>;

export interface FlowMetadata {
  flow_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  version: number;
  path: string;
}

export interface ConnectorInstanceConfig {
  type: string;
  config: Record<string, unknown>;
}

export interface NodeSpec {
  id: string;
  step_type: string;
  config: Record<string, unknown>;
}

export interface EdgeSpec {
  from: string;
  to?: string | null;
  condition?: string | null;
}

export interface FlowSpec {
  flow_id: string;
  name?: string;
  entry_node: string;
  connectors?: Record<string, ConnectorInstanceConfig>;
  nodes: NodeSpec[];
  edges: EdgeSpec[];
}

export interface ValidationIssue {
  code: string;
  message: string;
  node_id?: string | null;
  edge_index?: number | null;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface StepCatalogEntry {
  step_type: string;
  title?: string;
  description?: string;
  config_schema: JsonSchema;
}

export interface ConnectorCatalogEntry {
  connector_type: string;
  title?: string;
  description?: string;
  config_schema: JsonSchema;
  actions: string[];
  required_secrets?: string[];
}

export interface CredentialItem {
  key: string;
  hint: string;
  app?: string | null;
  updated_at?: string | null;
}

export interface RunState {
  run_id: string;
  flow_id: string;
  status: string;
  node_outputs?: Record<string, unknown>;
  current_node?: string | null;
  error?: string | null;
  trigger?: string;
  schedule_id?: string | null;
  created_at: string;
  updated_at: string;
  steps?: StepExecution[];
  diagram?: string;
}

export interface StepExecution {
  node_id: string;
  step_type: string;
  status: string;
  latency_ms?: number | null;
  error?: string | null;
}

export interface ScheduleMeta {
  schedule_id: string;
  flow_id: string;
  when: string;
  enabled: boolean;
  next_run_at?: string | null;
  name?: string;
}

export interface ScheduleSpec {
  schedule_id: string;
  flow_id: string;
  when: string;
  enabled?: boolean;
  name?: string;
  notify_on_failure?: Record<string, unknown> | null;
  initial_input?: Record<string, unknown> | null;
}

export interface DaemonStatus {
  running: boolean;
  attached: boolean;
  booting: boolean;
  base_url: string;
  mcp_url: string;
  log_path: string | null;
  error: string | null;
  lan_enabled?: boolean;
  lan_urls?: string[];
  lan_token?: string | null;
}

export interface LanRemoteStatus {
  enabled: boolean;
  token: string | null;
  urls: string[];
  qr_payload: string | null;
}

export interface SyncStatus {
  configured: boolean;
  initialized: boolean;
  remote_url: string;
  branch: string | null;
  dirty: boolean;
  flows_subdir: string;
  default_branch: string;
  local_flow_count: number;
  remote_flow_count: number;
  asset_counts?: Record<string, Record<string, number>>;
  github_logged_in: boolean;
  github_login: string | null;
}

export interface GithubAuthStatus {
  logged_in: boolean;
  login?: string | null;
  [key: string]: unknown;
}

export interface GithubRepoItem {
  full_name: string;
  owner: string;
  name: string;
  private: boolean;
  html_url?: string;
  clone_url?: string;
  default_branch?: string;
}

export interface SyncResult {
  branch: string;
  commit_sha?: string | null;
  flows_added?: string[];
  flows_updated?: string[];
  flows_removed?: string[];
  message?: string;
}
