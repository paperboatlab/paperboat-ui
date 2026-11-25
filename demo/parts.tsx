// The ported parts on one page, light and dark: `npm run demo`, then open demo/parts.html.
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "../src/tokens.css";
import "../src/ui.css";
import { MenuBar } from "../src/Menus.tsx";
import { MessageList } from "../src/Messages.tsx";
import { DebugDock, Dock } from "../src/Dock.tsx";
import { FileRail, FileTree, type FileEntry } from "../src/files/index.ts";
import { Instrument, Plot2D, Scope } from "../src/plot/index.ts";
import { useTheme, type Theme } from "../src/theme.tsx";
import { VariableGroup, VariableList, VariableRow } from "../src/VariableList.tsx";
import { typeLine, valueText } from "../src/variables.ts";
import type { Variable } from "../src/canvas/types.ts";
import type { Command } from "../src/commands.ts";

const q = new URLSearchParams(location.search);
const FILES: FileEntry[] = [
  { path: "src", name: "src", depth: 0, kind: "folder" }, { path: "src/pendulum.jl", name: "pendulum.jl", depth: 1, kind: "file", badge: "M" },
  { path: "src/fit.py", name: "fit.py", depth: 1, kind: "file" }, { path: "data", name: "data", depth: 0, kind: "folder" },
  { path: "data/measured.csv", name: "measured.csv", depth: 1, kind: "file", badge: "U" }, { path: "data/phase.png", name: "phase.png", depth: 1, kind: "file" },
  { path: "Tank.mo", name: "Tank.mo", depth: 0, kind: "file" }, { path: "Project.toml", name: "Project.toml", depth: 0, kind: "file" },
  { path: "settings.json", name: "settings.json", depth: 0, kind: "file" }, { path: "README.md", name: "README.md", depth: 0, kind: "file" },
];
const t = Array.from({ length: 401 }, (_, i) => i * 0.05);
// The Scope in lanes, one per unit: a cart-pole's angle (rad) and force (N).
const th = t.map((s) => 0.2 * Math.exp(-1.3 * s) * Math.cos(3.6 * s));
const SCOPE = [
  { id: "a", label: "cart.θ", unit: "rad", buf: { times: t, values: th } },
  { id: "b", label: "sat.y", unit: "N", buf: { times: t, values: th.map((v) => Math.max(-20, Math.min(20, 90 * v))) } },
];
const VARS: Variable[] = [
  { name: "kp_theta", type: "number", value: 40, group: "pid", tunable: true }, { name: "kd_theta", type: "number", expr: "kp_theta / 5", group: "pid" },
  { name: "damping", type: "number", value: 0.4, unit: "N·s/rad", group: "plant" }, { name: "mode", type: "enum", value: "swing", options: ["swing", "hold"], group: "plant" },
  { name: "K", type: "matrix", value: "1 0; 0 1", source: "mx", group: "Julix" },
];
const COMMANDS: Command[] = [
  { id: "new", label: "New file", menu: "file", group: "a", shortcut: "Ctrl N", run: () => {} },
  { id: "open", label: "Open…", menu: "file", group: "a", shortcut: "Ctrl O", run: () => {} },
  { id: "save", label: "Save", menu: "file", group: "b", shortcut: "Ctrl S", enabled: false, why: "Nothing changed", run: () => {} },
  { id: "light", label: "Light", menu: "view", group: "theme", checked: false, run: () => {} },
  { id: "dark", label: "Dark", menu: "view", group: "theme", checked: false, run: () => {} },
  { id: "system", label: "System", menu: "view", group: "theme", checked: true, run: () => {} },
];

function Parts() {
  const [theme] = useState<Theme>((q.get("theme") as Theme) || "light");
  useTheme(theme);
  const [active, setActive] = useState("src/pendulum.jl");
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(true);
  const [openVar, setOpenVar] = useState<string | null>("kd_theta");
  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gridTemplateRows: "44px 1fr", gap: 10, padding: 10, height: "100vh", boxSizing: "border-box", background: "var(--surface-ground)", color: "var(--text)", font: "13px var(--font-sans)" }}>
      <header className="panel" style={{ gridColumn: "1 / -1", flexDirection: "row", alignItems: "center", padding: "0 6px", overflow: "visible", zIndex: 5 }}>
        <MenuBar commands={COMMANDS} menus={[{ id: "file", label: "File" }, { id: "view", label: "View" }]} groupTitles={{ theme: "Theme" }} />
      </header>
      <div className="panel">
        <FileRail label="Files" tabs={["files", "outline"]} tab="files" name="pendulum" foot={<span>10 files · 2 changed</span>}
          tree={<FileTree entries={FILES} active={active} actions={{ onOpen: (e) => setActive(e.path) }} ariaLabel="Files" />} />
      </div>
      <div style={{ display: "grid", gridTemplateRows: "1fr 230px 300px", gap: 10, minHeight: 0 }}>
        <div className="panel" style={{ padding: 12, position: "relative" }}>
          <Dock canRun running={running} status={running ? "running" : undefined} statusText="running 3.2 / 10 s" onRun={() => setRunning(true)} onCancel={() => setRunning(false)} />
          <Plot2D title="θ, simulated and measured" series={[
            { x: t, y: t.map((s) => 0.6 * Math.exp(-0.15 * s) * Math.cos(2.08 * s)), label: "θ simulated" },
            { x: t, y: t.map((s) => 0.6 * Math.exp(-0.17 * s) * Math.cos(2.11 * s + 0.03)), label: "θ measured" },
          ]} axes={{ xlabel: "t [s]", ylabel: "θ [rad]", grid: true } as never} />
        </div>
        <div className="panel" style={{ padding: 12, position: "relative" }}>
          <DebugDock paused={paused} where="fit.jl:12 · in solve" onContinue={() => setPaused(false)} onPause={() => setPaused(true)}
            onStepOver={() => {}} onStepInto={() => {}} onStepOut={() => {}} onStop={() => setPaused(true)} />
          <MessageList messages={[
            { level: "error", text: "Variable g not found in scope Tank.", file: "Tank.mo", line: 12, column: 5 },
            { level: "warning", text: "Parameter c has no value, and is fixed during initialization (fixed=true), using available start value (start=0.3).", file: "Tank.mo", line: 4 },
            { level: "info", text: "Check of Tank completed successfully." },
          ]} selected={null} />
        </div>
        <div className="panel" style={{ padding: 12, display: "grid", gridTemplateColumns: "2fr 1fr 1fr 260px", gap: 12 }}>
          <Scope name="scope" channels={SCOPE} version={0} live={false} settings={{}} />
          <Instrument name="x" detail="cart position" value="0.470 m"><span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", font: "30px var(--font-mono)" }}>0.47</span></Instrument>
          <Instrument name="θ" detail="pole" value="–" idle hint="No run yet · Run (Ctrl R)" />
          <VariableList>
            {["pid", "plant", "Julix"].map((g) => (
              <VariableGroup key={g} title={g}>
                {VARS.filter((v) => v.group === g).map((v) => (
                  <VariableRow key={v.name} name={v.name} type={typeLine(v)} value={valueText(v.expr ? 8 : v.value, v.type)} live={v.source === "mx"}
                    open={openVar === v.name} onOpen={() => setOpenVar(openVar === v.name ? null : v.name)} error={v.name === "mode" ? "unknown option" : undefined}>
                    <small style={{ color: "var(--text-muted)" }}>1 use: pid.kd</small>
                  </VariableRow>
                ))}
              </VariableGroup>
            ))}
          </VariableList>
        </div>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<StrictMode><Parts /></StrictMode>);
