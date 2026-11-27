// Two panes and the gutter between them, which you drag to size them (brand.html §14 "Panel size"); first
// in Julix, between the editor and the plots. One pane has a size (`sized`), the other takes the rest. The
// handle is the gutter itself: quiet until you point at it, then a grip in ink. Drag past the sized pane's
// minimum and it hides (`onHidden`, the app shows its slim bar); double-click puts the default back; with
// focus, the arrow keys move it (Shift: further), Home and End go to the limits. The app keeps the size.
import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { keySize, maxSize, resolveSize, type SplitLimits } from "./split.ts";
import { pageZoom } from "./scale.ts";

export function Split({ direction = "row", sized = "end", size, defaultSize, min = 200, max, otherMin = 240, onSize, onHidden, label, children, className = "" }: {
  /** row: side by side (a vertical gutter); column: one above the other. */
  direction?: "row" | "column";
  /** The pane the size is of: the first (start) or the second (end). */
  sized?: "start" | "end";
  size: number;
  defaultSize: number;
  min?: number;
  max?: number;
  /** The other pane's minimum. */
  otherMin?: number;
  onSize: (size: number) => void;
  /** Dragged past its minimum: hide the sized pane (its slim bar). Without it the pane stops at its minimum. */
  onHidden?: () => void;
  /** The handle's name for assistive tech ("Plots width"). */
  label: string;
  children: [ReactNode, ReactNode];
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ at: number; size: number } | null>(null);
  const row = direction === "row";
  const limits = (): SplitLimits => {
    const r = box.current?.getBoundingClientRect();
    return { min, max, otherMin, total: r ? (row ? r.width : r.height) / pageZoom() : size + otherMin };
  };
  const apply = (wanted: number) => {
    const r = resolveSize(wanted, limits(), !!onHidden);
    if (r.hidden) onHidden?.();
    else if (r.size !== size) onSize(r.size);
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { at: row ? e.clientX : e.clientY, size };
    setDragging(true);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const d = ((row ? e.clientX : e.clientY) - start.current.at) / pageZoom();   // screen pixels to the page's
    apply(start.current.size + (sized === "end" ? -d : d));
  };
  const up = () => { start.current = null; setDragging(false); };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const grows = row ? (sized === "end" ? "ArrowLeft" : "ArrowRight") : (sized === "end" ? "ArrowUp" : "ArrowDown");
    const next = keySize(e.key, e.shiftKey, size, limits(), grows);
    if (next === undefined) return;
    e.preventDefault();
    onSize(resolveSize(next, limits(), false).size);  // keys never hide: Hide is its own key
  };

  const sizedStyle = row ? { width: size } : { height: size };
  const [a, b] = children;
  return (
    <div ref={box} className={`split ${direction}${dragging ? " dragging" : ""}${className ? ` ${className}` : ""}`}>
      <div className="split-pane" style={sized === "start" ? sizedStyle : undefined}>{a}</div>
      <div
        className="split-handle"
        role="separator"
        aria-orientation={row ? "vertical" : "horizontal"}
        aria-label={label}
        aria-valuenow={size}
        aria-valuemin={min}
        aria-valuemax={box.current ? maxSize(limits()) : max}
        tabIndex={0}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onDoubleClick={() => onSize(resolveSize(defaultSize, limits(), false).size)}
        onKeyDown={key}
        title={`${label}: drag, or double-click for the default`}
      />
      <div className="split-pane" style={sized === "end" ? sizedStyle : undefined}>{b}</div>
    </div>
  );
}
