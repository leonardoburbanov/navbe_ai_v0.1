import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { memo } from "react";
import type { StepNodeData } from "./mapSpec";

export type StepFlowNode = Node<StepNodeData, "step">;

/** Larger workflow step node with optional runtime status. */
function StepNodeInner({ id, data, selected }: NodeProps<StepFlowNode>) {
  const status = data.executionStatus;
  const statusCls = status ? `step-node--exec-${status}` : "";
  return (
    <div
      className={`step-node ${selected ? "step-node--selected" : ""} ${
        data.isEntry ? "step-node--entry" : ""
      } ${statusCls}`}
    >
      <Handle type="target" position={Position.Top} className="step-handle" />
      <div className="step-node__top">
        {data.isEntry && <span className="step-node__badge">entry</span>}
        {status && <span className="step-node__exec status-pill">{status}</span>}
      </div>
      <div className="step-node__type">{data.title ?? data.step_type}</div>
      <div className="step-node__title">{id}</div>
      {data.executionError && <div className="step-node__err">{data.executionError}</div>}
      <Handle type="source" position={Position.Bottom} className="step-handle" />
    </div>
  );
}

export default memo(StepNodeInner);
