import {
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type {
  ConnectorCatalogEntry,
  ConnectorInstanceConfig,
  FlowSpec,
  StepCatalogEntry,
} from "../api/types";
import Button from "../components/ui/Button";
import FlowCanvas from "./FlowCanvas";
import Inspector from "./Inspector";
import { layoutWithDagre } from "./layout";
import {
  flowToSpec,
  STEP_NODE_TYPE,
  specToFlow,
  type FlowEdgeData,
  type StepNodeData,
} from "./mapSpec";
import Palette from "./Palette";
import { loadPositions, positionsFromNodes, savePositions } from "./positions";

interface FlowEditorProps {
  initial: FlowSpec;
  created: boolean;
  stepCatalog: Record<string, StepCatalogEntry>;
  connectorCatalog: Record<string, ConnectorCatalogEntry>;
  /** When set, poll run and highlight node statuses (read-only canvas). */
  runId?: string | null;
  onClose: () => void;
  onRan?: (flowId: string, runId: string) => void;
  onSchedule?: (flowId: string) => void;
}

/** Visual flow editor with optional live run highlight. */
export default function FlowEditor({
  initial,
  created: initiallyCreated,
  stepCatalog,
  connectorCatalog,
  runId = null,
  onClose,
  onRan,
  onSchedule,
}: FlowEditorProps) {
  const qc = useQueryClient();
  const readOnly = Boolean(runId);
  const seeded = useMemo(() => {
    const mapped = specToFlow(initial, loadPositions(initial.flow_id || "draft"));
    return {
      ...mapped,
      nodes: enrichTitles(mapped.nodes, stepCatalog),
    };
  }, [initial, stepCatalog]);
  const [nodes, setNodes, onNodesChange] = useNodesState(seeded.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(seeded.edges);
  const [meta, setMeta] = useState(seeded.meta);
  const [created, setCreated] = useState(initiallyCreated);
  const [dirty, setDirty] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const stepTypes = useMemo(() => Object.keys(stepCatalog).sort(), [stepCatalog]);
  const titleMap = useMemo(
    () => Object.fromEntries(stepTypes.map((t) => [t, stepCatalog[t]?.title ?? humanize(t)])),
    [stepTypes, stepCatalog],
  );

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) ?? null;

  const runQuery = useQuery({
    queryKey: ["run", runId],
    queryFn: () => api.getRun(runId!),
    enabled: Boolean(runId),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "running" || s === "pending" ? 1000 : false;
    },
  });

  useEffect(() => {
    const byNode = executionByNodeId(runQuery.data?.steps);
    setNodes((nds) =>
      nds.map((n) => {
        const ex = byNode[n.id];
        return {
          ...n,
          data: {
            ...n.data,
            title: n.data.title ?? titleMap[n.data.step_type] ?? humanize(n.data.step_type),
            executionStatus: ex?.status ?? null,
            executionError: ex?.error ?? null,
          },
        };
      }),
    );
  }, [runQuery.data, setNodes, titleMap]);

  const persistLayout = useCallback(() => {
    savePositions(meta.flow_id || "draft", positionsFromNodes(nodes));
  }, [meta.flow_id, nodes]);

  const markEntryFlags = useCallback((list: Node<StepNodeData>[], entry: string) => {
    return list.map((n) => ({
      ...n,
      data: { ...n.data, isEntry: n.id === entry },
    }));
  }, []);

  const currentSpec = useCallback((): FlowSpec => {
    return flowToSpec(nodes, edges, meta);
  }, [nodes, edges, meta]);

  async function persistSpec(): Promise<FlowSpec> {
    const spec = currentSpec();
    if (!spec.flow_id.trim()) throw new Error("Set a Flow ID in the Flow tab first");
    if (spec.nodes.length === 0) throw new Error("Add at least one step from the palette");
    if (!spec.entry_node) throw new Error("Set an entry node (select a step → Set as entry)");
    if (created) {
      await api.updateFlow(spec.flow_id, spec);
    } else {
      await api.createFlow(spec);
    }
    persistLayout();
    savePositions(spec.flow_id, positionsFromNodes(nodes));
    setCreated(true);
    setDirty(false);
    void qc.invalidateQueries({ queryKey: ["flows"] });
    return spec;
  }

  const validate = useMutation({
    mutationFn: () => api.validateFlow(currentSpec()),
    onSuccess: (result) => {
      if (result.valid) {
        setMessage("Looks good");
        setError(null);
      } else {
        setMessage(null);
        setError(result.issues.map((i) => i.message).join("; "));
      }
    },
    onError: (err: Error) => setError(err.message),
  });

  const save = useMutation({
    mutationFn: () => persistSpec(),
    onSuccess: () => {
      setMessage("Saved");
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const runFlow = useMutation({
    mutationFn: async () => {
      const spec = dirty || !created ? await persistSpec() : currentSpec();
      const run = await api.startRun(spec.flow_id);
      return { flowId: spec.flow_id, run };
    },
    onSuccess: ({ flowId, run }) => {
      setMessage("Run started");
      setError(null);
      void qc.invalidateQueries({ queryKey: ["runs"] });
      onRan?.(flowId, run.run_id);
    },
    onError: (err: Error) => setError(err.message),
  });

  const onConnect = useCallback(
    (connection: Connection) => {
      setDirty(true);
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            data: { condition: null } satisfies FlowEdgeData,
          },
          eds,
        ),
      );
    },
    [setEdges],
  );

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    setSelectedNodeId(params.nodes[0]?.id ?? null);
    setSelectedEdgeId(params.edges[0]?.id ?? null);
  }, []);

  const addStep = useCallback(
    (stepType: string, position?: { x: number; y: number }) => {
      const id = uniqueNodeId(nodes);
      const next: Node<StepNodeData> = {
        id,
        type: STEP_NODE_TYPE,
        position: position ?? { x: 80 + nodes.length * 24, y: 80 + nodes.length * 24 },
        data: {
          step_type: stepType,
          config: {},
          isEntry: false,
          title: titleMap[stepType] ?? humanize(stepType),
        },
      };
      setDirty(true);
      setNodes((nds) => {
        const withNew = [...nds, next];
        if (!meta.entry_node && withNew.length === 1) {
          setMeta((m) => ({ ...m, entry_node: id }));
          return markEntryFlags(withNew, id);
        }
        return markEntryFlags(withNew, meta.entry_node);
      });
      setSelectedNodeId(id);
      setSelectedEdgeId(null);
    },
    [nodes, meta.entry_node, setNodes, markEntryFlags, titleMap],
  );

  const applyAutoLayout = useCallback(() => {
    const positions = layoutWithDagre(nodes, edges);
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        position: positions[n.id] ?? n.position,
      })),
    );
    queueMicrotask(() => {
      savePositions(meta.flow_id || "draft", positions);
    });
  }, [nodes, edges, setNodes, meta.flow_id]);

  function onNodeChange(
    nodeId: string,
    patch: Partial<StepNodeData> & { id?: string },
  ): void {
    setDirty(true);
    const newId = patch.id;
    setNodes((nds) => {
      let next = nds.map((n) => {
        if (n.id !== nodeId) return n;
        const { id: _ignore, ...dataPatch } = patch;
        return {
          ...n,
          id: newId && newId !== nodeId ? newId : n.id,
          data: { ...n.data, ...dataPatch },
        };
      });
      if (newId && newId !== nodeId) {
        setEdges((eds) =>
          eds.map((e) => ({
            ...e,
            source: e.source === nodeId ? newId : e.source,
            target: e.target === nodeId ? newId : e.target,
          })),
        );
        if (meta.entry_node === nodeId) {
          setMeta((m) => ({ ...m, entry_node: newId }));
        }
        setSelectedNodeId(newId);
      }
      next = markEntryFlags(next, newId && meta.entry_node === nodeId ? newId : meta.entry_node);
      return next;
    });
  }

  function onSetEntry(nodeId: string): void {
    setDirty(true);
    setMeta((m) => ({ ...m, entry_node: nodeId }));
    setNodes((nds) => markEntryFlags(nds, nodeId));
  }

  function onEdgeCondition(edgeId: string, condition: string | null): void {
    setDirty(true);
    setEdges((eds) =>
      eds.map((e) =>
        e.id === edgeId
          ? { ...e, label: condition ?? undefined, data: { ...e.data, condition } }
          : e,
      ),
    );
  }

  function onConnectorUpsert(alias: string, inst: ConnectorInstanceConfig): void {
    setDirty(true);
    setMeta((m) => ({
      ...m,
      connectors: { ...m.connectors, [alias]: inst },
    }));
  }

  function onConnectorRemove(alias: string): void {
    setDirty(true);
    setMeta((m) => {
      const connectors = { ...m.connectors };
      delete connectors[alias];
      return { ...m, connectors };
    });
  }

  function onConnectorRename(from: string, to: string): void {
    setDirty(true);
    setMeta((m) => {
      if (!m.connectors[from] || m.connectors[to]) return m;
      const connectors = { ...m.connectors };
      connectors[to] = connectors[from];
      delete connectors[from];
      return { ...m, connectors };
    });
  }

  useEffect(() => {
    if (!meta.entry_node) return;
    if (nodes.some((n) => n.id === meta.entry_node)) return;
    const fallback = nodes[0]?.id ?? "";
    setMeta((m) => ({ ...m, entry_node: fallback }));
  }, [nodes, meta.entry_node]);

  const title = meta.name || meta.flow_id || "Flow";
  const canRun = Boolean(meta.flow_id.trim()) && nodes.length > 0;
  const runStatus = runQuery.data?.status;

  return (
    <div className="flow-editor card">
      <div className="flow-editor__toolbar">
        <div className="flex items-center gap-2 min-w-0">
          <div className="min-w-0">
            <h2 className="text-lg font-medium truncate">{title}</h2>
            <code className="text-xs muted">{meta.flow_id}</code>
            {dirty && !readOnly && <span className="text-xs muted ml-2">unsaved</span>}
            {readOnly && runId && (
              <span className="text-xs muted ml-2">
                run <code>{runId.slice(0, 8)}</code>
                {runStatus ? ` · ${runStatus}` : ""}
              </span>
            )}
          </div>
          {message && <span className="text-[var(--ok)] text-sm shrink-0">{message}</span>}
          {error && <span className="error text-sm truncate">{error}</span>}
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {!readOnly && (
            <>
              <Button variant="ghost" onClick={applyAutoLayout}>
                Auto-layout
              </Button>
              <Button variant="ghost" onClick={() => validate.mutate()} disabled={validate.isPending}>
                Validate
              </Button>
              <Button variant="ghost" onClick={() => save.mutate()} disabled={save.isPending}>
                Save
              </Button>
              {created && meta.flow_id && onSchedule && (
                <Button variant="ghost" onClick={() => onSchedule(meta.flow_id)}>
                  Schedule
                </Button>
              )}
              <Button
                onClick={() => runFlow.mutate()}
                disabled={!canRun || runFlow.isPending}
                title="Save if needed, then start a run"
              >
                {runFlow.isPending ? "Starting…" : "Run"}
              </Button>
            </>
          )}
          {readOnly && created && meta.flow_id && onSchedule && (
            <Button variant="ghost" onClick={() => onSchedule(meta.flow_id)}>
              Schedule
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      <div className="flow-editor__body">
        <Palette
          stepTypes={stepTypes}
          titles={titleMap}
          onAdd={(t) => addStep(t)}
          hidden={readOnly}
        />
        <div className="flow-canvas-wrap">
          <FlowCanvas
            nodes={nodes}
            edges={edges as Edge<FlowEdgeData>[]}
            onNodesChange={(c) => {
              if (readOnly) return;
              setDirty(true);
              onNodesChange(c);
            }}
            onEdgesChange={(c) => {
              if (readOnly) return;
              setDirty(true);
              onEdgesChange(c);
            }}
            onConnect={onConnect}
            onSelectionChange={onSelectionChange}
            onDropStep={(t, pos) => addStep(t, pos)}
            onNodeDragStop={persistLayout}
            readOnly={readOnly}
          />
          {nodes.length === 0 && !readOnly && (
            <div className="flow-canvas-hint">
              <p className="font-medium">Add a step → connect → Schedule or Run</p>
              <p className="muted text-sm">
                Click a step on the left, or drag it onto the canvas. Connect steps by dragging from
                the bottom handle to the next top handle.
              </p>
            </div>
          )}
        </div>
        <Inspector
          meta={meta}
          isNew={!created}
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          stepCatalog={stepCatalog}
          connectorCatalog={connectorCatalog}
          readOnly={readOnly}
          onMetaChange={(patch) => {
            if (readOnly) return;
            setDirty(true);
            setMeta((m) => {
              const next = { ...m, ...patch };
              if (patch.entry_node != null) {
                setNodes((nds) => markEntryFlags(nds, next.entry_node));
              }
              return next;
            });
          }}
          onNodeChange={onNodeChange}
          onEdgeCondition={onEdgeCondition}
          onSetEntry={onSetEntry}
          onConnectorUpsert={onConnectorUpsert}
          onConnectorRemove={onConnectorRemove}
          onConnectorRename={onConnectorRename}
        />
      </div>
    </div>
  );
}

/** Allocate a unique node id like n1, n2, … */
function uniqueNodeId(nodes: Node<StepNodeData>[]): string {
  let i = nodes.length + 1;
  const used = new Set(nodes.map((n) => n.id));
  while (used.has(`n${i}`)) i += 1;
  return `n${i}`;
}

function enrichTitles(
  nodes: Node<StepNodeData>[],
  catalog: Record<string, StepCatalogEntry>,
): Node<StepNodeData>[] {
  return nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      title: catalog[n.data.step_type]?.title ?? humanize(n.data.step_type),
    },
  }));
}

/** Map run step rows to node id → status. */
function executionByNodeId(
  steps: { node_id: string; status: string; error?: string | null }[] | undefined,
): Record<string, { status: string; error?: string | null }> {
  const out: Record<string, { status: string; error?: string | null }> = {};
  for (const s of steps ?? []) {
    out[s.node_id] = { status: s.status, error: s.error };
  }
  return out;
}

function humanize(stepType: string): string {
  return stepType
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
