// The Panels key (REBRAND "Show / hide panels"; the Julix mockup): one key in the bar, before the theme
// disc, that opens a picker like the theme picker's. Each panel is a preview of the window with that panel
// filled in the accent while it shows and dashed while hidden, its name and its keys; a choice toggles it
// and the picker stays open for the next one. Each panel also hides from the key in its own head.
import { useRef, useState } from "react";
import { useDismiss } from "./dismiss.tsx";
import { Icon } from "./Icon.tsx";

/** A rectangle of the window's sketch, in a 64 × 44 frame. */
export type PaneRect = [x: number, y: number, w: number, h: number];
export type PanelChoice = { id: string; label: string; keys?: string; shown: boolean };

function Sketch({ layout, me }: { layout: Record<string, PaneRect>; me: string }) {
  return (
    <svg className="thumb panels-thumb" viewBox="0 0 64 44" width="64" height="44" aria-hidden="true">
      <rect className="bg" width="64" height="44" />
      {Object.entries(layout).map(([id, [x, y, w, h]]) => <rect key={id} className={id === me ? "me" : "pane"} x={x} y={y} width={w} height={h} rx="1.5" />)}
    </svg>
  );
}

export function PanelsKey({ panels, layout, onToggle }: {
  /** The panels that can hide, in screen order (left, bottom, right). */
  panels: PanelChoice[];
  /** Every area of the window (the main one too), keyed by id: the sketch each preview draws. */
  layout: Record<string, PaneRect>;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const pop = useRef<HTMLDivElement>(null);
  const key = useRef<HTMLButtonElement>(null);
  useDismiss(pop, () => setOpen(false), { enabled: open, triggerRef: key });
  return (
    <span className="theme-picker panels-key">
      <button ref={key} type="button" className="key round" aria-label="Panels: show or hide" title="Panels: show or hide" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="layout-panels" />
      </button>
      {open && (
        <div ref={pop} className="popover" role="dialog" aria-label="Panels">
          <h3>Panels</h3>
          <div className="theme-choices" role="group" aria-label="Panels">
            {panels.map((p) => (
              <button key={p.id} type="button" aria-pressed={p.shown} title={`${p.shown ? "Hide" : "Show"} ${p.label}${p.keys ? ` (${p.keys})` : ""}`} onClick={() => onToggle(p.id)}>
                <Sketch layout={layout} me={p.id} />
                {p.label}
                {p.keys && <kbd>{p.keys}</kbd>}
              </button>
            ))}
          </div>
          <div className="menu-note">Each panel also hides from the key in its head</div>
        </div>
      )}
    </span>
  );
}
