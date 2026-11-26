// A page with every component, light and dark: `npm run demo`, then open demo/index.html.
import { StrictMode, useState } from "react";
import type { Runtime } from "../src/runtimes.ts";
import { createRoot } from "react-dom/client";
import "../src/tokens.css";
import "../src/ui.css";
import { Editor, DEFAULT_EDITOR_SETTINGS, DEFAULT_EDITOR_THEME, EDITOR_THEMES, languageFor } from "../src/editor/index.ts";
import { About, AppMark, Dialog, Icon, Key, Menu, Notifications, Panel, PanelsKey, Pill, Rail, RemoveKey, RuntimesKey, Search, Segmented, Spinner, Switch, Tabs, Tag, ThemePicker, Toasts, useTheme, useToasts, type Theme } from "../src/index.ts";

const RUNTIMES: Runtime[] = [
  { id: "jl", name: "Julia 1.11.6", lang: "julia@1.11.6", state: "busy", via: "podman", up: 2520, memory: 1.2 * 2 ** 30, cpu: 87, now: "cell [4] in step-response-5cm · 0.6 s", note: "used by 5 cells in 3 notes", onInterrupt: () => {}, onRestart: () => {}, onStop: () => {} },
  { id: "py", name: "Python 3.12", lang: "python", state: "idle", via: "podman", up: 5400, idle: 240, memory: 310 * 2 ** 20, note: "used by 1 cell in pump-check", onRestart: () => {}, onStop: () => {} },
  { id: "omc", name: "OpenModelica 1.27", lang: "openmodelica", state: "off", note: "needed by Tank.mo", onStart: () => {} },
];

const JL = `using DifferentialEquations
using JulixPlot

# a damped pendulum: θ'' = -(g/L) sin θ - c θ'
const g, L, c = 9.81, 2.2, 0.3

function pendulum!(du, u, p, t)
    θ, ω = u
    du[1] = ω
    du[2] = -(g / L) * sin(θ) - c * ω  # "drag"
end
`;

function Demo() {
  const [theme, setTheme] = useState<Theme>((new URLSearchParams(location.search).get("theme") as Theme) || "light");
  const [page, setPage] = useState("runtimes");
  const [wide, setWide] = useState(new URLSearchParams(location.search).has("wide"));
  const [seg, setSeg] = useState<"all" | "kernels" | "stations">("all");
  const [tab, setTab] = useState<"overview" | "packages" | "logs">("packages");
  const [on, setOn] = useState(true);
  const [left, setLeft] = useState(new URLSearchParams(location.search).has("hide"));
  const [dialog, setDialog] = useState(new URLSearchParams(location.search).has("dialog"));
  const [about, setAbout] = useState(new URLSearchParams(location.search).get("about"));
  const [menu, setMenu] = useState(new URLSearchParams(location.search).has("menu"));
  const [search, setSearch] = useState(new URLSearchParams(location.search).has("search"));
  const notes = useToasts();
  const { toasts, show, dismiss } = notes;
  const [edTheme, setEdTheme] = useState(new URLSearchParams(location.search).get("ed") || DEFAULT_EDITOR_THEME);
  const shown = useTheme(theme);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gridTemplateRows: "48px 1fr", gap: 10, padding: 10, height: "100vh", boxSizing: "border-box", background: "var(--surface-ground)", color: "var(--text)", font: "13px var(--font-sans)" }}>
      <header className="panel" style={{ gridColumn: "1 / -1", overflow: "visible", flexDirection: "row", alignItems: "center", gap: 10, padding: "0 10px" }}>
        <AppMark app="paperboat" size={26} idle label="Paperboat" />
        <b style={{ font: "600 17px var(--font-display)" }}>Paperboat</b>
        <span className="demo-keys" style={{ marginLeft: 24, display: "flex", gap: 18, alignItems: "center" }}>
          <RuntimesKey runtimes={[]} scope="this folder" />
          <RuntimesKey count={1} live scope="this folder" />
          <RuntimesKey failed scope="this workspace" error="omc exited (code 139): the next call starts a new session"
            runtimes={[{ id: "omc", name: "OpenModelica 1.24.0", lang: "omc", state: "failed", via: "session", note: "Tank.mo stopped at t = 4.2 s" }]} />
          <RuntimesKey scope="this hub" count={2} />
          <button type="button" className="key" aria-label="Console: 3 errors" title="Console: 3 errors"><Icon name="a-console" />Console<b className="badge bad">3</b></button>
        </span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <Key icon="search" size="sm" shortcut="Ctrl K" onClick={() => setSearch(true)}>Search</Key>
          <RuntimesKey runtimes={RUNTIMES} scope="tank-lab" footer={(close) => <><span>Each cell and block names its runtime.</span><Key size="sm" kind="quiet" icon="a-runtimes" onClick={close}>Launcher › Runtimes</Key></>} />
          <PanelsKey panels={[{ id: "l", label: "Runtimes", keys: "Ctrl B", shown: !left }]} layout={{ l: [4, 4, 16, 36], m: [22, 4, 38, 36] }} onToggle={() => setLeft((h) => !h)} />
          <Notifications {...notes} />
          <ThemePicker theme={theme} onChange={setTheme} />
        </span>
      </header>
      <Rail label="Pages" wide={wide} onWide={setWide} page={page} onPage={setPage}
        pages={[{ id: "apps", label: "Apps", icon: "a-apps", keys: "Alt+1" }, { id: "stations", label: "Stations", icon: "a-stations", keys: "Alt+2", count: 12 },
          { id: "toolkits", label: "Toolkits", icon: "a-toolkits", keys: "Alt+3", count: "live" }, { id: "runtimes", label: "Runtimes", icon: "a-runtimes", keys: "Alt+4", count: "2!" }, { id: "console", label: "Console", icon: "a-console", keys: "Alt+5" }]}
        foot={[{ id: "settings", label: "Settings", icon: "a-settings" }]} />
      <main style={{ display: "flex", gap: 10, minHeight: 0 }}>
        <Panel name="Runtimes" count="3 in the catalog" side="left" hidden={left} onHidden={setLeft} icon="a-runtimes" width={260}>
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            <Pill state="live" label="2 running" className="app-malachite" />
            <Pill state="working" label="pulling 3 of 5" labels={["pulling 5 of 5"]} />
            <Pill state="idle" label="idle" />
            <Pill state="failed" label="failed · exit 1" />
            <Pill state="progress" label="42 %" progress={0.42} />
            <span><Tag>sandboxed</Tag> <Tag ask><Icon name="shield" />+ camera</Tag></span>
          </div>
        </Panel>
        <Panel name="pendulum.jl" count="Julia · Ink">
          <div style={{ padding: "8px 12px" }}><Segmented label="Editor theme" value={edTheme} onChange={setEdTheme} options={EDITOR_THEMES.map((t) => ({ value: t.id, label: t.label }))} /></div>
          <div style={{ height: 250, borderTop: "1px solid var(--line)" }}>
            <Editor key={"jl"} ariaLabel="pendulum.jl" language={languageFor("pendulum.jl")} settings={{ ...DEFAULT_EDITOR_SETTINGS, theme: edTheme }} appTheme={shown} base={JL.replace("0.3", "0.25").replace("using DifferentialEquations\n", "")}
              value={JL} />
          </div>
          <div style={{ height: 120, borderTop: "1px solid var(--line)" }}>
            <Editor key={"toml"} ariaLabel="Project.toml" language={languageFor("Project.toml")} settings={{ ...DEFAULT_EDITOR_SETTINGS, theme: edTheme }} appTheme={shown}
              value={'name = "pendulum"\nversion = \n[deps]\nJulixPlot = "6f2a"\n'} />
          </div>
        </Panel>
        <Panel name="Julia 1.11.6" count="podman · ready">
          <Tabs label="Runtime" value={tab} onChange={setTab} tabs={[{ value: "overview", label: "Overview" }, { value: "packages", label: "Packages", count: 4 }, { value: "logs", label: "Logs" }]} />
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Key kind="primary" icon="add">Add package</Key>
              <Key icon="cloud-download">Pull</Key>
              <Key busy>Pulling</Key>
              <Key kind="quiet" icon="output">Logs</Key>
              <Key kind="danger">Prune</Key>
              <Key round icon="kebab-vertical" label="More" onClick={() => setMenu((m) => !m)} />
              <Key size="sm" icon="debug-pause">Interrupt</Key>
              <RemoveKey label="Remove Example" onClick={() => {}} />
            </div>
            <Segmented label="Show" value={seg} onChange={setSeg} options={[{ value: "all", label: "All" }, { value: "kernels", label: "Kernels" }, { value: "stations", label: "Stations" }]} />
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}><Switch label="Allow network" checked={on} onChange={setOn} /> Allow network</label>
            <label className="well" style={{ width: 280 }}><input defaultValue="Example@0.5" /><em>package</em></label>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Spinner /> <Spinner size={22} />
              {(["paperboat", "simplicial", "articula", "julix", "malachite"] as const).map((a) => <AppMark key={a} app={a} size={40} label={a} />)}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Key onClick={() => setDialog(true)}>Open dialog</Key>
              <Key onClick={() => setAbout("articula")}>About</Key>
              <Key onClick={() => show({ title: "Pulled julia", detail: "ghcr.io/paperboatlab/julia · 412 MB", state: "done" })}>Toast</Key>
              <Key onClick={() => show({ title: "Pull failed", detail: "no network", state: "failed" })}>Failed toast</Key>
              <Key onClick={() => { const id = show({ title: "Pulling python", detail: "ghcr.io/paperboatlab/python", state: "working" }); setTimeout(() => show({ id, title: "Pulled python", detail: "ghcr.io/paperboatlab/python · 288 MB", state: "done" }), 2500); }}>Working → done</Key>
            </div>
            {menu && (
              <div style={{ position: "relative" }}>
                <Menu label="More" onClose={() => setMenu(false)} items={[{ id: "a", label: "Restart", icon: "debug-restart", shortcut: "Ctrl R", run: () => {} }, { id: "b", label: "Interrupt", icon: "debug-pause", disabled: true, why: "Nothing is running", run: () => {} }, "-", { note: "Kernel 3f2a" }]} />
              </div>
            )}
          </div>
        </Panel>
      </main>
      {dialog && (
        <Dialog title="Remove Example?" tags={["julia"]} onClose={() => setDialog(false)} actions={<><Key kind="confirm-danger">Remove</Key><Key onClick={() => setDialog(false)}>Keep</Key></>}>
          <p>The project's environment drops it; the packages volume keeps a copy until the next prune.</p>
        </Dialog>
      )}
      {search && <Search scopes={["All", "Commands", "Runtimes"]} onClose={() => setSearch(false)} items={[
        { id: "rl", label: "runtime list", group: "Runtimes", icon: "a-runtimes", detail: "runtimes", scope: "Runtimes", run: () => {} },
        { id: "rp", label: "runtime pull", group: "Runtimes", icon: "cloud-download", detail: "<runtime>", scope: "Runtimes", run: () => {} },
        { id: "pa", label: "package add", group: "Packages", icon: "add", detail: "<runtime> <package>", scope: "Commands", run: () => {} },
        { id: "run", label: "run", group: "Stations", icon: "play", detail: "<station>", scope: "Commands", disabled: true, why: "Needs Simplicial, which isn't installed yet", run: () => {} },
      ]} />}
      <Toasts toasts={toasts} onDismiss={dismiss} />
      {about && <About app={about as "articula"} role="Acausal physical modelling on OpenModelica" version="0.1.0" paperboat="0.1.0-alpha.3" info="omc 1.24.0 · protocol articula/0 · commit 9938032" repo={`paperboatlab/${about}`}
        credits={[["OpenModelica (omc)", "compiles and simulates models", "OSMC-PL / GPL-3.0", "https://openmodelica.org"], ["three.js", "the 3D view", "MIT", "https://threejs.org"]]} onClose={() => setAbout(null)} />}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><Demo /></StrictMode>);
