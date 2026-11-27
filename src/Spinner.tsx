import { useEffect, useState } from "react";

// The spinner: the blintz turn (REBRAND "spinner"), in the accent of whoever works. For small waits in
// place (a key, a pill, a row); a whole window that can't draw yet shows the splash instead.
export function Spinner({ size = 16, label }: { size?: number; label?: string }) {
  return (
    <span className="spinner" style={{ ["--s" as string]: `${size}px` }} role={label ? "status" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <i><b /><em /><em /><em /><em /></i>
    </span>
  );
}

/** True once `on` has held for `ms`: a wait that ends quickly never flashes a spinner. */
export function useAfter(on: boolean, ms: number) {
  const [past, setPast] = useState(false);
  useEffect(() => { setPast(false); if (!on) return; const t = setTimeout(() => setPast(true), ms); return () => clearTimeout(t); }, [on, ms]);
  return on && past;
}
/** An open in place (a workspace, a hub): the spinner after this, and what is happening after that. */
export const SPIN_AFTER = 300, SAY_AFTER = 2000;
