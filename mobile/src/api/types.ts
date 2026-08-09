/** Shared API response shapes for the mobile companion. */

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

export interface VersionInfo {
  name: string;
  version: string;
  features?: string[];
}

export interface ConnectionSettings {
  baseUrl: string;
  token: string;
}
