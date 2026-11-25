// The canvas's tools, bottom-left of a React Flow canvas (REBRAND; drawn in agent-docs rebrand/apps/simplicial):
// the gestures (?), zoom out, zoom in and fit, round keys on the raised grey. The gestures open as a two-column
// list (what · how) on glass above the keys; Esc or a click elsewhere closes it. Render it inside <ReactFlow>.
import { Panel, useReactFlow, type FitViewOptions } from "@xyflow/react";
import { Fragment, useRef, useState } from "react";
import { useDismiss } from "../dismiss.tsx";
import { Key } from "../Key.tsx";

/** What every node canvas does with a pointer and keys, one line each; `keys` between backticks. */
export const CANVAS_GESTURES: [string, string][] = [
  ["Add a block", "`/` or double-click the canvas"],
  ["Select", "Click a block · `Ctrl`-drag a box · `Ctrl`-click adds"],
  ["Rotate", "`R` turns clockwise · `Shift R` counter-clockwise"],
  ["Flip", "`F` mirrors left to right · `Alt F` top to bottom"],
  ["Duplicate", "`Ctrl D`"],
  ["Comment out · bypass", "`Ctrl /` · `Ctrl Shift Y`"],
  ["Delete", "`Delete` or `Backspace`"],
  ["Pan · zoom", "Drag the canvas · the wheel"],
  ["Remove a wire", "Drag its end off the port"],
  ["Move a port", "Drag its name to another side · double-click puts it back"],
  ["Undo · redo", "`Ctrl Z` · `Ctrl Shift Z`"],
];

/** Text with keys between backticks, the keys as `kbd`. */
export function Keys({ text }: { text: string }) {
  return <>{text.split("`").map((part, i) => (i % 2 ? <kbd key={i} className="kbd">{part}</kbd> : part))}</>;
}

export function CanvasTools({ gestures = CANVAS_GESTURES, fit, open: openAt, onOpen }: {
  gestures?: [string, string][];
  /** How Fit frames the canvas (room for what floats over it). */
  fit?: FitViewOptions;
  /** The gestures shown (`?` toggles them); give both to drive it from a key. */
  open?: boolean;
  onOpen?: (open: boolean) => void;
}) {
  const [own, setOwn] = useState(false);
  const open = openAt ?? own;
  const set = onOpen ?? setOwn;
  const box = useRef<HTMLDivElement>(null);
  useDismiss(box, () => set(false), { enabled: open });
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  return (
    <Panel position="bottom-left" className="canvas-tools nodrag nopan">
      <div ref={box}>
        {open && (
          <section className="canvas-help" role="dialog" aria-label="Canvas gestures">
            <h3>On the canvas</h3>
            <dl>
              {gestures.map(([what, how]) => (
                <Fragment key={what}>
                  <dt>{what}</dt>
                  <dd><Keys text={how} /></dd>
                </Fragment>
              ))}
            </dl>
          </section>
        )}
        <Key size="sm" round icon="question" label="Gestures (?)" aria-expanded={open} onClick={() => set(!open)} />
      </div>
      <Key size="sm" round icon="zoom-out" label="Zoom out" onClick={() => void zoomOut({ duration: 160 })} />
      <Key size="sm" round icon="zoom-in" label="Zoom in" onClick={() => void zoomIn({ duration: 160 })} />
      <Key size="sm" round icon="screen-full" label="Fit to view" onClick={() => void fitView({ duration: 200, ...fit })} />
    </Panel>
  );
}
