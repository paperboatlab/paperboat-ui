// An example opened read-only (paperboat-ui#85): the banner at the top of a bay, and the shared fields
// editable beside read-only. `npm run demo`, then open demo/example.html (?theme=dark&app=articula&scale=1.25).
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "../src/tokens.css";
import "../src/ui.css";
import "../src/canvas/canvas.css";
import { ExampleBanner } from "../src/ExampleBanner.tsx";
import { RemoveKey } from "../src/Key.tsx";
import { NumberField } from "../src/NumberField.tsx";
import { Panel } from "../src/Panel.tsx";
import { Segmented, Switch } from "../src/controls.tsx";
import { ParamRow } from "../src/canvas/ParamRow.tsx";
import { applyScale, isScale } from "../src/scale.ts";
import { useTheme, type Theme } from "../src/theme.tsx";
import type { ParamDef, ParamValue } from "../src/canvas/types.ts";

const q = new URLSearchParams(location.search);
if (q.get("app")) document.documentElement.dataset.app = q.get("app")!;
const scale = Number(q.get("scale") ?? 1);
if (isScale(scale)) applyScale(scale);
const PARAMS: ParamDef[] = [
  { id: "k", type: "number", default: 2.5, unit: "N/m" },
  { id: "d", type: "number", default: 0.1 },
  { id: "on", type: "boolean", default: true },
  { id: "mode", type: "enum", default: "fast", options: ["fast", "exact"] },
  { id: "label", type: "string", default: "spring" },
] as ParamDef[];

function Fields({ readOnly }: { readOnly?: boolean }) {
  const [w, setW] = useState<"thin" | "normal" | "bold">("normal");
  const [on, setOn] = useState(true);
  const [x, setX] = useState(12);
  const [vals, setVals] = useState<Record<string, ParamValue>>({ d: { var: "damping" } as ParamValue });
  return (
    <Panel name={readOnly ? "Read-only" : "Editable"} count={readOnly ? "readOnly" : undefined}>
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        <Segmented<typeof w> label="Weight" readOnly={readOnly} value={w} onChange={setW} options={[{ value: "thin", label: "Thin" }, { value: "normal", label: "Normal" }, { value: "bold", label: "Bold" }]} />
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}><Switch label="Show the grid" readOnly={readOnly} checked={on} onChange={setOn} /> Show the grid</label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>x
          <span className="well sm" style={{ width: 90 }}><NumberField aria-label="x" readOnly={readOnly} value={x} onChange={setX} /></span>
          <RemoveKey label="Remove x" disabled={readOnly} title={readOnly ? "Copy the example to change it" : undefined} onClick={() => {}} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 12px", alignItems: "center" }} className="param-grid">
          {PARAMS.map((def) => (
            <ParamRow key={def.id} def={def} readOnly={readOnly} value={vals[def.id]} computed={def.id === "d" ? "0.1" : undefined}
              vars={def.id === "k" ? [{ name: "stiffness", type: "Float64", value: "2.5" }] : undefined}
              onChange={(v) => setVals((s) => ({ ...s, [def.id]: v }))} />
          ))}
        </div>
      </div>
    </Panel>
  );
}

function Example() {
  useTheme((q.get("theme") as Theme) || "light");
  const width = q.get("width");
  return (
    <div style={{ padding: 14, background: "var(--surface-ground)", color: "var(--text)", font: "13px var(--font-sans)", minHeight: "100vh", boxSizing: "border-box", width: width ? `${width}px` : undefined }}>
      <div className="bay" style={{ display: "flex", flexDirection: "column", gap: "var(--gutter)" }}>
        <ExampleBanner name="03 Tank Loop" folder="~/Documents/paperboat" onCopy={() => {}} />
        <ExampleBanner name="02 Notebook" onCopy={() => {}} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--gutter)" }}>
          <Fields />
          <Fields readOnly />
        </div>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<StrictMode><Example /></StrictMode>);
