// The hub parts (paperboat#16): `npm run demo`, then open demo/hub.html (?show=connect|open|open-hub, ?theme=dark).
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "../src/tokens.css";
import "../src/ui.css";
import { useTheme, type Theme } from "../src/theme.tsx";
import type { FileEntry } from "../src/files/index.ts";
import { ConnectHub, HubSelector, HubSettings, OpenFile, type Hub, type HubSettingsValues } from "../src/hub/index.ts";

const q = new URLSearchParams(location.search);
const HUBS: Hub[] = [
  { id: "1", name: "tank-lab", place: "local", path: "~/hubs/tank-lab", holds: "3 flows · 2 stations" },
  { id: "2", name: "pump-rig", place: "google-drive", path: "My Drive/Paperboat/pump-rig", sync: { state: "syncing", text: "syncing 3 files" }, holds: "1 flow · 1 station" },
  { id: "3", name: "old-rig", place: "local", path: "~/hubs/old-rig", missing: true },
];
const E = (path: string, kind: "file" | "folder" = "file"): FileEntry => ({ path, name: path.split("/").pop()!, depth: path.split("/").length - 1, kind });
const FILES = [E(".malachite", "folder"), E(".malachite/hub.toml"), E("notes", "folder"), E("notes/step.md"), E("projects", "folder"), E("projects/pendulum", "folder"),
  E("projects/pendulum/pendulum.psf"), E("projects/pendulum/cart-pole.pst"), E("projects/pendulum/params.csv"), E("projects/tank-level", "folder"), E("projects/tank-level/tank-level.psf"), E("projects/tank-level/tank.pst")];
const list = async () => FILES;

function Demo() {
  const [theme] = useState<Theme>((q.get("theme") as Theme) || "light");
  useTheme(theme);
  const [hub, setHub] = useState<Hub | null>(HUBS[1]);
  const [show, setShow] = useState(q.get("show") ?? "");
  const [vals, setVals] = useState<HubSettingsValues>({ author: "lab", keep: "1y", ignore: ".malachite/out/ *.tmp", sync: true });
  const [said, say] = useState("");
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16, minHeight: "100vh", boxSizing: "border-box", background: "var(--surface-ground)", color: "var(--text)", font: "13px var(--font-sans)" }}>
      <header className="panel" style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: "0 12px", height: 48, overflow: "visible", zIndex: 5 }}>
        <b style={{ font: "600 15px var(--font-display)" }}>Simplicial</b>
        {hub ? <HubSelector hub={hub} hubs={HUBS} app="Simplicial" onSwitch={(id) => setHub(HUBS.find((h) => h.id === id)!)} onNew={() => say("new hub")}
          onOpenInMalachite={() => say("open in Malachite")} onDisconnect={() => setHub(null)} /> : <span style={{ font: "12px var(--font-mono)", color: "var(--text-muted)" }}>~/projects/pendulum.psf</span>}
        <button className="key sm" onClick={() => setShow("open")}>Open… (OpenFile)</button>
        <button className="key sm" onClick={() => setShow("connect")}>Connect to a hub…</button>
        <span style={{ marginLeft: "auto", font: "12px var(--font-mono)", color: "var(--text-muted)" }}>{said}</span>
      </header>
      <div style={{ maxWidth: 900 }}>
        <HubSettings hub={hub ?? HUBS[0]} values={vals} account="you@example.com" commands={q.has("cli")} onSet={(k, v) => { setVals({ ...vals, [k]: v }); say(`hub config ${k} ${v}`); }}
          onRename={() => say("rename")} onMove={() => say("move")} onRemove={() => say("remove")} />
      </div>
      {show === "connect" && <ConnectHub app="Julix" about="its scripts, data and plots" hubs={HUBS} current="1" onConnect={(id) => { setHub(HUBS.find((h) => h.id === id)!); setShow(""); }}
        onNew={() => say("new hub")} onFolder={() => setShow("")} onClose={() => setShow("")} />}
      {(show === "open" || show === "open-hub") && <OpenFile what="a flow or a station" types={["psf", "pst"]} hubs={HUBS} list={list}
        describe={(_, e) => <small>{e.name.endsWith(".psf") ? "Simplicial flow · 14 blocks" : "Simplicial station"}</small>}
        onComputer={() => say("the system's picker")} onOpen={(h, p) => { setHub(h); setShow(""); say(`opened ${h.name}/${p}`); }} onClose={() => setShow("")} />}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<StrictMode><Demo /></StrictMode>);
