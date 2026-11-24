// The note graph (Obsidian's graph, on React Flow): every note a dot sized by its links, every link a line,
// laid out by a force that settles. Hover a note and the rest dims to its neighbours; drag one and the
// others follow; the focus (the note open) carries the accent ring. Compact, it is the local graph beside
// a note: labels only for the focus and what the pointer is on, no keys. One quiet key fits it to view.
import { Handle, Position, ReactFlow, ReactFlowProvider, useReactFlow, useStore, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Key } from "../Key.tsx";
import { Force } from "./force.ts";

/** A note or file: its label, and its type's tone (the --file-* colours, brand.html §11). */
export type GraphNode = { id: string; label: string; tone?: string; missing?: boolean };
export type GraphLink = { source: string; target: string };

type Dot = { label: string; tone?: string; missing?: boolean; r: number; state: "" | "focus" | "near" | "far"; labelled: boolean };

const handle = { left: "50%", top: "50%", transform: "translate(-50%, -50%)", opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, border: 0 } as const;

function DotNode({ data }: NodeProps<Node<Dot>>) {
  return (
    <div className={`graph-dot ${data.state}${data.missing ? " missing" : ""}`} style={{ width: data.r * 2, height: data.r * 2, color: data.tone ? `var(--file-${data.tone})` : undefined }}>
      <Handle type="target" position={Position.Top} style={handle} isConnectable={false} />
      <Handle type="source" position={Position.Top} style={handle} isConnectable={false} />
      {data.labelled && <span className="graph-label">{data.label}</span>}
    </div>
  );
}
const TYPES = { dot: DotNode };
// each frame hands React Flow new nodes, which drops the handles it measured; links are drawn from these
// instead (both ends at the dot's centre), so they never vanish while the layout moves or a dot is dragged
const centre = (id: string, r: number) => (["source", "target"] as const).map((type) => ({ id: null, nodeId: id, type, position: Position.Top, x: r, y: r, width: 0, height: 0 }));
// a small hub opens at its own size, not blown up to fill the view
const FIT = { padding: 0.15, maxZoom: 1.25 };

function Graph({ nodes, links, focus, onOpen, compact, ariaLabel }: Props) {
  const flow = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);
  const [hover, setHover] = useState<string | null>(null);
  const [, tick] = useState(0);
  const sim = useRef<Force | null>(null);
  const fitted = useRef(false);

  const degree = useMemo(() => {
    const d = new Map<string, number>();
    for (const l of links) { d.set(l.source, (d.get(l.source) ?? 0) + 1); d.set(l.target, (d.get(l.target) ?? 0) + 1); }
    return d;
  }, [links]);
  // hovering a note dims everything but it and its neighbours (the open note only carries its ring)
  const near = useMemo(() => {
    const at = hover;
    if (!at) return null;
    const s = new Set([at]);
    for (const l of links) { if (l.source === at) s.add(l.target); if (l.target === at) s.add(l.source); }
    return s;
  }, [hover, focus, links]);

  // a new set of notes or links: a new layout, keeping where known notes were; then it runs until it rests
  // one animation loop: it runs while the layout moves and stops when it rests; a drag wakes it
  const raf = useRef(0), steps = useRef(0);
  const wake = () => {
    if (raf.current) return;
    const run = () => {
      const moving = !!sim.current && sim.current.step() && sim.current.step();
      steps.current += 2;
      tick((t) => t + 1);
      if (!fitted.current && (steps.current > 60 || !moving)) { fitted.current = true; requestAnimationFrame(() => flow.fitView(FIT)); }
      raf.current = moving ? requestAnimationFrame(run) : 0;
    };
    raf.current = requestAnimationFrame(run);
  };
  useEffect(() => () => { cancelAnimationFrame(raf.current); raf.current = 0; }, []);

  // a new set of notes or links: a new layout, keeping where known notes were; it fits once it has spread
  const key = nodes.map((n) => n.id).join("\n") + "\n--\n" + links.map((l) => `${l.source}>${l.target}`).join("\n");
  useEffect(() => {
    const before = new Map((sim.current?.nodes ?? []).map((n) => [n.id, { x: n.x, y: n.y }]));
    sim.current = new Force(nodes.map((n) => n.id), links, before);
    fitted.current = false;
    steps.current = 0;
    wake();
    // `key` stands for nodes and links
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const at = new Map((sim.current?.nodes ?? []).map((n) => [n.id, n]));
  const showAll = !compact && zoom >= 0.7;
  const rfNodes: Node<Dot>[] = nodes.map((n) => {
    const p = at.get(n.id), r = 3.5 + Math.sqrt(degree.get(n.id) ?? 0) * 2.2;
    const state = n.id === focus ? "focus" : near ? (near.has(n.id) ? "near" : "far") : "";
    const labelled = showAll ? state !== "far" : n.id === focus || n.id === hover || (!!hover && state === "near");
    return { id: n.id, type: "dot", position: { x: (p?.x ?? 0) - r, y: (p?.y ?? 0) - r }, width: r * 2, height: r * 2, handles: centre(n.id, r), data: { label: n.label, tone: n.tone, missing: n.missing, r, state, labelled }, draggable: true, selectable: false };
  });
  const rfEdges: Edge[] = links.map((l) => {
    const lit = !!hover && (l.source === hover || l.target === hover);
    return { id: `${l.source}>${l.target}`, source: l.source, target: l.target, type: "straight", className: lit ? "lit" : near ? "far" : "" };
  });

  return (
    <div className={`note-graph${compact ? " compact" : ""}`}>
      <ReactFlow nodes={rfNodes} edges={rfEdges} nodeTypes={TYPES} aria-label={ariaLabel} proOptions={{ hideAttribution: true }}
        nodesConnectable={false} elementsSelectable={false} zoomOnDoubleClick={false} zoomOnScroll={!compact} preventScrolling={!compact} panOnDrag minZoom={0.1} maxZoom={4}
        onNodeMouseEnter={(_, n) => setHover(n.id)} onNodeMouseLeave={() => setHover(null)}
        onNodeClick={(_, n) => onOpen?.(n.id)}
        onNodeDrag={(_, n) => { const r = (n.data as Dot).r; sim.current?.hold(n.id, n.position.x + r, n.position.y + r); tick((t) => t + 1); }}
        onNodeDragStart={() => wake()}
        onNodeDragStop={(_, n) => { sim.current?.release(n.id); wake(); }} />
      {!compact && <span className="note-graph-keys"><Key size="sm" kind="quiet" round icon="screen-full" label="Fit to view" onClick={() => flow.fitView({ ...FIT, duration: 300 })} /></span>}
    </div>
  );
}

type Props = {
  nodes: readonly GraphNode[];
  links: readonly GraphLink[];
  /** The note open: the accent ring, and what the rest dims around while nothing is hovered. */
  focus?: string;
  onOpen?: (id: string) => void;
  /** The local graph beside a note: small, labels only where the pointer is, no keys, no wheel zoom. */
  compact?: boolean;
  ariaLabel: string;
};

export function NoteGraph(props: Props) {
  return <ReactFlowProvider><Graph {...props} /></ReactFlowProvider>;
}
