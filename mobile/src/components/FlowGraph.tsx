import { Graph, layout } from '@dagrejs/dagre';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Defs, Marker, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { FlowSpec } from '@/src/api/types';
import { useThemeColors } from '@/src/useThemeColors';

const NODE_W = 168;
const NODE_H = 64;
const PAD = 24;

interface LaidOutNode {
  id: string;
  step_type: string;
  x: number;
  y: number;
  isEntry: boolean;
}

interface LaidOutEdge {
  key: string;
  path: string;
  midX: number;
  midY: number;
  label?: string;
}

/** Lay out FlowSpec with dagre (top → bottom). */
function layoutFlow(spec: FlowSpec): {
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
  width: number;
  height: number;
} {
  const g = new Graph({ directed: true, multigraph: false, compound: false });
  g.setGraph({ rankdir: 'TB', nodesep: 36, ranksep: 56, marginx: PAD, marginy: PAD });
  g.setDefaultEdgeLabel(() => ({}));

  const byId = new Map(spec.nodes.map((n) => [n.id, n]));
  for (const n of spec.nodes) {
    g.setNode(n.id, { width: NODE_W, height: NODE_H });
  }
  let edgeIdx = 0;
  for (const e of spec.edges) {
    if (!e.to) continue;
    if (!byId.has(e.from) || !byId.has(e.to)) continue;
    g.setEdge(e.from, e.to, { condition: e.condition ?? undefined, idx: edgeIdx++ });
  }

  layout(g);

  let maxX = 0;
  let maxY = 0;
  const nodes: LaidOutNode[] = [];
  for (const id of g.nodes()) {
    const label = g.node(id);
    if (!label) continue;
    const x = (label.x ?? 0) - NODE_W / 2;
    const y = (label.y ?? 0) - NODE_H / 2;
    maxX = Math.max(maxX, x + NODE_W);
    maxY = Math.max(maxY, y + NODE_H);
    const step = byId.get(id);
    nodes.push({
      id,
      step_type: step?.step_type ?? '?',
      x,
      y,
      isEntry: id === spec.entry_node,
    });
  }

  const edges: LaidOutEdge[] = [];
  for (const e of g.edges()) {
    const edge = g.edge(e);
    const points = (edge?.points ?? []) as Array<{ x: number; y: number }>;
    if (points.length < 2) continue;
    const d = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');
    const mid = points[Math.floor(points.length / 2)] ?? points[0];
    const condition =
      typeof edge?.condition === 'string' && edge.condition.length > 0
        ? edge.condition
        : undefined;
    edges.push({
      key: `${e.v}-${e.w}-${String(edge?.idx ?? 0)}`,
      path: d,
      midX: mid.x,
      midY: mid.y,
      label: condition,
    });
  }

  return {
    nodes,
    edges,
    width: Math.max(maxX + PAD, 320),
    height: Math.max(maxY + PAD, 200),
  };
}

/** Read-only flow graph (dagre layout + SVG). */
export default function FlowGraph({ spec }: { spec: FlowSpec }) {
  const c = useThemeColors();
  const laid = useMemo(() => layoutFlow(spec), [spec]);

  return (
    <ScrollView
      horizontal
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsHorizontalScrollIndicator>
      <ScrollView
        nestedScrollEnabled
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator>
        <View style={{ width: laid.width, height: laid.height }}>
          <Svg width={laid.width} height={laid.height}>
            <Defs>
              <Marker
                id="arrow"
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth">
                <Path d="M0,0 L6,3 L0,6 Z" fill={c.signal} />
              </Marker>
            </Defs>

            {laid.edges.map((e) => (
              <Path
                key={e.key}
                d={e.path}
                stroke={c.signal}
                strokeOpacity={0.55}
                strokeWidth={1.6}
                fill="none"
                markerEnd="url(#arrow)"
              />
            ))}

            {laid.edges.map((e) =>
              e.label ? (
                <SvgText
                  key={`${e.key}-label`}
                  x={e.midX}
                  y={e.midY - 4}
                  fill={c.signal}
                  fontSize="10"
                  textAnchor="middle">
                  {truncate(e.label, 16)}
                </SvgText>
              ) : null,
            )}

            {laid.nodes.map((n) => (
              <Rect
                key={`${n.id}-rect`}
                x={n.x}
                y={n.y}
                width={NODE_W}
                height={NODE_H}
                rx={10}
                ry={10}
                fill={n.isEntry ? c.signalSoft : c.card}
                stroke={n.isEntry ? c.signal : c.borderStrong}
                strokeWidth={n.isEntry ? 2 : 1}
              />
            ))}

            {laid.nodes.map((n) => (
              <SvgText
                key={`${n.id}-title`}
                x={n.x + 12}
                y={n.y + 26}
                fill={c.text}
                fontSize="13"
                fontWeight="700">
                {truncate(n.id, 18)}
              </SvgText>
            ))}

            {laid.nodes.map((n) => (
              <SvgText
                key={`${n.id}-type`}
                x={n.x + 12}
                y={n.y + 46}
                fill={c.textMuted}
                fontSize="11">
                {truncate(n.step_type, 22)}
              </SvgText>
            ))}
          </Svg>
        </View>
      </ScrollView>
    </ScrollView>
  );
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { padding: 8 },
});
