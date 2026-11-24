// A page with every component, light and dark: `npm run demo`, then open demo/index.html.
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "../src/tokens.css";
import "../src/ui.css";
import { AppMark, Dialog, Icon, Key, Menu, Panel, Pill, Rail, RemoveKey, Search, Segmented, Spinner, Switch, Tabs, Tag, ThemePicker, Toasts, useTheme, useToasts, type Theme } from "../src/index.ts";

function Demo() {
  const [theme, setTheme] = useState<Theme>((new URLSearchParams(location.search).get("theme") as Theme) || "light");
  useTheme(theme);
  const [page, setPage] = useState("runtimes");
  const [wide, setWide] = useState(new URLSearchParams(location.search).has("wide"));
  const [seg, setSeg] = useState<"all" | "kernels" | "stations">("all");
  const [tab, setTab] = useState<"overview" | "packages" | "logs">("packages");
  const [on, setOn] = useState(true);
  const [left, setLeft] = useState(new URLSearchParams(location.search).has("hide"));
  const [dialog, setDialog] = useState(new URLSearchParams(location.search).has("dialog"));
  const [menu, setMenu] = useState(new URLSearchParams(location.search).has("menu"));
  const [search, setSearch] = useState(new URLSearchParams(location.search).has("search"));
  const { toasts, show, dismiss } = useToasts();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gridTemplateRows: "48px 1fr", gap: 10, padding: 10, height: "100vh", boxSizing: "border-box", background: "var(--surface-ground)", color: "var(--text)", font: "13px var(--font-sans)" }}>
      <header className="panel" style={{ gridColumn: "1 / -1", flexDirection: "row", alignItems: "center", gap: 10, padding: "0 10px" }}>
        <AppMark app="paperboat" size={26} idle label="Paperboat" />
        <b style={{ font: "600 17px var(--font-display)" }}>Paperboat</b>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <Key icon="search" size="sm" shortcut="Ctrl K" onClick={() => setSearch(true)}>Search</Key>
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
              <Key onClick={() => show({ title: "Pulled julia", detail: "ghcr.io/paperboatlab/julia · 412 MB", state: "done" })}>Toast</Key>
              <Key onClick={() => show({ title: "Pull failed", detail: "no network", state: "failed" })}>Failed toast</Key>
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
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><Demo /></StrictMode>);
