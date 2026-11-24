// The spinner: the blintz turn (REBRAND "spinner"), in the accent of whoever works. For small waits in
// place (a key, a pill, a row); a whole window that can't draw yet shows the splash instead.
export function Spinner({ size = 16, label }: { size?: number; label?: string }) {
  return (
    <span className="spinner" style={{ ["--s" as string]: `${size}px` }} role={label ? "status" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <i><b /><em /><em /><em /><em /></i>
    </span>
  );
}
