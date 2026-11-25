// One setting on a block's card or a station object's plate: its name left, its value right in a well (mono,
// right-aligned; focus the ink ring), its unit after it. A value bound to a variable shows the variable's name in
// an ink outline (a formula marked ƒ) and what it comes to in grey; a click opens the binding (`onBound`), which
// is the app's (its variables live there).
import { isRef } from "./bindings.ts";
import { NumberField } from "../NumberField.tsx";
import { Switch } from "../controls.tsx";
import type { ParamDef, ParamValue } from "./types.ts";

export function ParamRow({ def, value, onChange, disabled, onBound, computed, label }: {
  def: ParamDef;
  value: ParamValue | undefined;
  onChange: (v: ParamValue) => void;
  disabled?: boolean;
  /** A bound value was clicked: show the variable, edit it, or unbind. */
  onBound?: () => void;
  /** What a bound value comes to, shown after its chip. */
  computed?: string;
  /** Its label; default the param's id. */
  label?: string;
}) {
  const name = label ?? def.id;
  const unit = "unit" in def && def.unit ? <span className="unit">{def.unit}</span> : null;
  let field;
  if (isRef(value)) {
    const formula = "expr" in value;
    field = (
      <>
        <button type="button" className="param-bound nodrag" disabled={disabled} title={formula ? `ƒ ${value.expr}` : `Bound to ${value.var}`} onClick={onBound}>
          {formula ? `ƒ ${value.expr}` : value.var}
        </button>
        {computed !== undefined && <em>{computed}</em>}
      </>
    );
  } else if (def.type === "number") {
    field = <NumberField className="param-well nodrag" aria-label={name} disabled={disabled} value={typeof value === "number" ? value : def.default} onChange={onChange} />;
  } else if (def.type === "boolean") {
    field = <Switch label={name} checked={typeof value === "boolean" ? value : def.default} onChange={(on) => { if (!disabled) onChange(on); }} />;
  } else if (def.type === "enum") {
    field = (
      <select className="param-well nodrag" aria-label={name} disabled={disabled} value={typeof value === "string" ? value : def.default} onChange={(e) => onChange(e.target.value)}>
        {def.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  } else {
    field = <input className="param-well text nodrag" aria-label={name} disabled={disabled} spellCheck={false} value={typeof value === "string" ? value : def.default} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <>
      <label className="param-label">{name}</label>
      <span className="param-field">{field}{unit}</span>
    </>
  );
}
