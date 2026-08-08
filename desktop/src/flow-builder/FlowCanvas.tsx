import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnSelectionChangeParams,
  type ReactFlowInstance,
} from "@xyflow/react";
import { useCallback, useMemo, useRef, type DragEvent } from "react";
import "@xyflow/react/dist/style.css";
import { STEP_DRAG_MIME } from "./Palette";
import { STEP_NODE_TYPE, type FlowEdgeData, type StepNodeData } from "./mapSpec";
import StepNode from "./StepNode";

interface FlowCanvasProps {
  nodes: Node<StepNodeData>[];
  edges: Edge<FlowEdgeData>[];
  onNodesChange: (changes: NodeChange<Node<StepNodeData>>[]) => void;
  onEdgesChange: (changes: EdgeChange<Edge<FlowEdgeData>>[]) => void;
  onConnect: (connection: Connection) => void;
  onSelectionChange: (params: OnSelectionChangeParams) => void;
  onDropStep: (stepType: string, position: { x: number; y: number }) => void;
  onNodeDragStop: () => void;
  readOnly?: boolean;
}

/** React Flow canvas with minimap and optional read-only runtime mode. */
export default function FlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onSelectionChange,
  onDropStep,
  onNodeDragStop,
  readOnly = false,
}: FlowCanvasProps) {
  const nodeTypes = useMemo(() => ({ [STEP_NODE_TYPE]: StepNode }), []);
  const rfRef = useRef<ReactFlowInstance<Node<StepNodeData>, Edge<FlowEdgeData>> | null>(null);

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      if (readOnly) return;
      const stepType = e.dataTransfer.getData(STEP_DRAG_MIME);
      if (!stepType || !rfRef.current) return;
      const position = rfRef.current.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });
      onDropStep(stepType, position);
    },
    [onDropStep, readOnly],
  );

  return (
    <div className="flow-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onEdgesChange={readOnly ? undefined : onEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        onSelectionChange={onSelectionChange}
        onInit={(instance) => {
          rfRef.current = instance;
        }}
        onDragOver={readOnly ? undefined : onDragOver}
        onDrop={readOnly ? undefined : onDrop}
        onNodeDragStop={readOnly ? undefined : onNodeDragStop}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable
        fitView
        colorMode="dark"
        deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
        defaultEdgeOptions={{ style: { strokeWidth: 2 }, type: "smoothstep" }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} color="rgba(255,255,255,0.06)" />
        <Controls />
        <MiniMap
          pannable
          zoomable
          maskColor="rgba(10,10,12,0.7)"
          nodeColor={() => "#3a3a42"}
        />
      </ReactFlow>
    </div>
  );
}
