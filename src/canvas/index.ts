// @paperboatlab/ui/canvas: the node canvas on React Flow, without any app's blocks. Wire routing
// (orthogonal, around blocks), graph layout, port placement on block sides, wire snapping, geometry
// (rotate, flip), clipboard, undo and the canvas's keys, over the block contract in types.ts.
// The block faces: the plate (CompactBlock), the card (BlockCard, also a station object or joint), a param
// (ParamRow), and what a block's head says (blockTag); drawn as in agent-docs rebrand/apps/simplicial. The canvas
// tools (CanvasTools: the gestures, zoom, fit) bottom-left.
export * from "./types.ts";
export * from "./wireRouting.ts";
export * from "./graphLayout.ts";
export * from "./ports.ts";
export * from "./geometry.ts";
export * from "./flowTypes.ts";
export * from "./clipboard.ts";
export * from "./undo.ts";
export * from "./canvasHotkeys.ts";
export * from "./wireSnap.tsx";
export * from "./portLayout.tsx";
export * from "./faces.ts";
export { CompactBlock, Glyph, captionValue } from "./Compact.tsx";
export { BlockIcon } from "./BlockIcon.tsx";
export { BlockCard } from "./BlockCard.tsx";
export { ParamRow } from "./ParamRow.tsx";
export { ParamField } from "./ParamField.tsx";
export { CanvasTools, CANVAS_GESTURES, Keys } from "./CanvasTools.tsx";
export { iconValid, isOn, plateSize, iconNodes, CELL, CORNER, DASH, FILL, FONT, SIZE, STROKE, WEIGHT, type SvgNode } from "./icon.ts";
export * from "./bindings.ts";
export { useWireBends } from "./wireBends.tsx";
export { ConnectionLine } from "./ConnectionLine.tsx";
