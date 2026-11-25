// The wire being drawn from a port: routed square and inked like every placed wire, so it doesn't change look
// when it lands. Pass it to React Flow as `connectionLineComponent`.
import { Position, type ConnectionLineComponentProps } from "@xyflow/react";
import { orthoPoints, roundedPolyline, type Side } from "./wireRouting.ts";

const side = (p: Position): Side => (p === Position.Left ? "left" : p === Position.Top ? "top" : p === Position.Bottom ? "bottom" : "right");

export function ConnectionLine({ fromX, fromY, toX, toY, fromPosition, toPosition }: ConnectionLineComponentProps) {
  const points = orthoPoints([fromX, fromY], side(fromPosition), [toX, toY], side(toPosition));
  return <path className="wire-drawing" d={roundedPolyline(points, 8)} />;
}
