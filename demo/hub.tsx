// The one file workflow and the hub parts: `npm run demo`, then open demo/hub.html
// (?show=connect|ask|open|save|nothub|unsaved|path, ?ws=folder|hub, ?hubonly, ?nohubs, ?shell, ?theme=dark).
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "../src/tokens.css";
import "../src/ui.css";
import { MenuBar } from "../src/Menus.tsx";
import { useShortcuts } from "../src/commands.ts";
import { useTheme, type Theme } from "../src/theme.tsx";
import type { FileEntry } from "../src/files/index.ts";
import { ConnectHub, HubSettings, OpenFile, SaveFile, type Hub, type HubSettingsValues } from "../src/hub/index.ts";
import { addRecent, AskOpen, fileMenu, NotAHub, parseRecent, recentFor, recentMenu, Start, TypedPath, Unsaved, WorkspaceWell, type RecentEntry, type Workspace } from "../src/workspace/index.ts";

const q = new URLSearchParams(location.search);
if (q.has("shell")) (window as { paperboatShell?: unknown }).paperboatShell = {
  pickFile: async () => "/home/me/projects/tank-level/identify.jl", pickFolder: async () => "/home/me/projects/tank-level",
  pickSave: async () => null, reveal: (p: string) => alert(`reveal ${p}`),
};
const HOME = "/home/me";
const HUBS: Hub[] = [
  { id: "1", name: "tank-lab", place: "local", path: "~/hubs/tank-lab", holds: "3 flows · 2 stations" },
  { id: "2", name: "pump-rig", place: "google-drive", path: "My Drive/Paperboat/pump-rig", sync: { state: "syncing", text: "syncing 3 files" }, holds: "1 flow · 1 station" },
  { id: "3", name: "old-rig", place: "local", path: "~/hubs/old-rig", missing: true },
];
const E = (path: string, kind: "file" | "folder" = "file", more: Partial<FileEntry> = {}): FileEntry => ({ path, name: path.split("/").pop()!, depth: path.split("/").length - 1, kind, ...more });
const FILES = [E(".malachite", "folder"), E(".malachite/hub.toml"), E("notes", "folder"), E("notes/step.md"), E("notes/pump-limits.psf", "file", { parent: "stations/tank-rig.pst" }),
  E("stations", "folder"), E("stations/tank-rig.pst", "file", { badge: "0.2.0" }), E("stations/pendulum.pst", "file", { badge: "0.3.1" }),
  E("flows", "folder"), E("flows/level-loop.psf", "file", { parent: "stations/tank-rig.pst" }), E("flows/step-test.psf", "file", { parent: "stations/tank-rig.pst" }),
  E("flows/swing-up.psf", "file", { parent: "stations/pendulum.pst" }), E("flows/old-sweep.psf", "file", { parent: null, warn: "pump-rig 0.1.0 not found" })];
const list = async () => FILES;
const NOW = Date.now() / 1000;
let RECENT = parseRecent(null);
for (const e of [R("hub", "/home/me/hubs/pump-rig", 3 * 86400), R("folder", "/home/me/projects/pendulum", 86400 + 60), R("file", "/home/me/hubs/tank-lab/flows/step-test.psf", 86400 + 30),
  R("hub", "/home/me/hubs/tank-lab", 5000), R("file", "/home/me/projects/tank-level/level-loop.psf", 7200), R("folder", "/home/me/projects/tank-level", 7100)]) RECENT = addRecent(RECENT, e);
function R(kind: RecentEntry["kind"], path: string, ago: number): RecentEntry { return { kind, path, at: NOW - ago, app: "simplicial", hub: kind === "hub" ? path : undefined }; }

const FOLDER: Workspace = { kind: "folder", root: "/home/me/projects/tank-level", name: "tank-level" };
const inHub = (h: Hub): Workspace => ({ kind: "hub", root: `/home/me/hubs/${h.name}`, name: h.name, hub: h.id });

function Demo() {
  const [theme] = useState<Theme>((q.get("theme") as Theme) || "light");
  useTheme(theme);
  const hubOnly = q.has("hubonly"), hubs = !q.has("nohubs");
  const [ws, setWs] = useState<Workspace | null>(q.get("ws") === "hub" ? inHub(HUBS[0]) : q.get("ws") === "folder" || hubOnly ? FOLDER : null);
  const [file, setFile] = useState(!!ws);
  const [show, setShow] = useState(q.get("show") ?? "");
  const [vals, setVals] = useState<HubSettingsValues>({ author: "lab", keep: "1y", ignore: ".malachite/out/ *.tmp", sync: true });
  const [said, say] = useState("");
  const hub = ws?.kind === "hub" ? HUBS.find((h) => h.id === ws.hub) : undefined;
  const open = (e: RecentEntry) => { say(`open ${e.kind} ${e.path}`); if (e.kind !== "file") setWs(e.kind === "hub" ? inHub(HUBS[0]) : FOLDER); setFile(e.kind === "file"); };
  const recent = recentMenu(recentFor(RECENT, "simplicial", { hubs }), open, () => say("clear recent"));
  const openFile = () => setShow(ws?.kind === "hub" ? "open" : hubs ? "ask" : "path");
  const commands = fileMenu({
    noun: "flow", workspace: ws, file, hubs, hubOnly, recent,
    onNew: () => { setFile(true); say("new flow"); }, onOpenFile: openFile, onOpenFolder: () => setShow(hubOnly ? "nothub" : "path"), onConnect: () => setShow("connect"),
    onSave: () => say("save"), onSaveAs: () => setShow(ws?.kind === "hub" ? "save" : ""), onCloseFile: () => setShow("unsaved"), onCloseWorkspace: () => setShow("unsaved-ws"), onSettings: () => say("settings"),
  });
  useShortcuts(commands);
  return (
    <div className="frame" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", color: "var(--text)", font: "13px var(--font-sans)" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 16, padding: "0 12px", height: 52 }}>
        <b style={{ font: "600 17px var(--font-display)" }}>Simplicial</b>
        <MenuBar commands={commands} menus={[{ id: "file", label: "File" }]} />
        {ws && <WorkspaceWell workspace={ws} home={HOME} recent={recent} hubs={hubs ? HUBS : []} onOpenFolder={() => setShow("path")} onConnect={() => setShow("connect")}
          onClose={() => setShow("unsaved-ws")} onSwitchHub={(id) => setWs(inHub(HUBS.find((h) => h.id === id)!))} onNewHub={() => say("new hub")}
          onOpenInMalachite={hubOnly ? undefined : () => say("open in Malachite")} onUseFolder={hubOnly ? undefined : () => setShow("path")} />}
        <span style={{ marginLeft: "auto", font: "12px var(--font-mono)", color: "var(--text-muted)" }}>{said}</span>
        {["open", "save", "connect", "ask", "nothub", "path"].map((s) => <button key={s} className="key sm" onClick={() => setShow(s)}>{s}</button>)}
      </header>
      <main className="bay" style={{ flex: 1, margin: "0 12px 12px", display: "flex" }}>
        <div className="panel" style={{ flex: 1, display: "flex" }}>
          {!ws ? <Start app={hubOnly ? "Malachite" : "Simplicial"} noun="flow" nouns="flows and stations" hubs={hubs} hubOnly={hubOnly} recent={RECENT.recent} home={HOME}
            onOpenFolder={() => setShow(hubOnly ? "nothub" : "path")} onOpenFile={openFile} onNew={() => say("new flow")} onConnect={() => setShow("connect")}
            onNewHub={() => say("new hub")} onRecent={open} onDrop={() => say("dropped")} />
            : <div style={{ padding: 24, width: "100%", maxWidth: 900 }}>
              <HubSettings hub={hub ?? HUBS[0]} values={vals} account="you@example.com" commands={q.has("cli")} onSet={(k, v) => { setVals({ ...vals, [k]: v }); say(`hub config ${k} ${v}`); }}
                onRename={() => say("rename")} onMove={() => say("move")} onRemove={() => say("remove")} />
            </div>}
        </div>
      </main>
      {show === "connect" && <ConnectHub app="Simplicial" hubOnly={hubOnly} hubs={HUBS} onConnect={(id) => { setWs(inHub(HUBS.find((h) => h.id === id)!)); setShow(""); }}
        onNew={() => say("new hub")} onClose={() => setShow("")} />}
      {show === "ask" && <AskOpen what="a flow or a station" types={["psf", "pst"]} hubs={HUBS.length} onLocal={() => setShow("path")} onConnect={() => setShow("connect")} onClose={() => setShow("")} />}
      {show === "open" && <OpenFile what="a flow or a station" types={["psf", "pst"]} hub={hub ?? HUBS[0]} list={list} byParent={{ label: "By station", orphans: "No station" }}
        describe={(e) => <small>{e.name.endsWith(".psf") ? "Simplicial flow · 14 blocks" : "Simplicial station"}</small>}
        onOpen={(p) => { setShow(""); setFile(true); say(`opened ${p}`); }} onClose={() => setShow("")} />}
      {show === "save" && <SaveFile what="the flow" types={["psf", "pst"]} name="level-loop-v2" hub={hub ?? HUBS[0]} list={list}
        onSave={(p) => { setShow(""); say(`saved ${p}`); }} onClose={() => setShow("")} />}
      {show === "nothub" && <NotAHub name="tank-level" onMake={() => { setWs(inHub(HUBS[0])); setShow(""); }} onOpenHub={() => setShow("connect")} onClose={() => setShow("")} />}
      {(show === "unsaved" || show === "unsaved-ws") && <Unsaved name="level-loop.psf" closing={show === "unsaved-ws" ? (ws?.kind === "hub" ? "the hub" : "the folder") : undefined}
        onSave={() => { say("saved"); setFile(false); if (show === "unsaved-ws") setWs(null); setShow(""); }} onDiscard={() => { setFile(false); if (show === "unsaved-ws") setWs(null); setShow(""); }} onClose={() => setShow("")} />}
      {show === "path" && <TypedPath title="Open folder" onOpen={(p) => { setWs({ kind: "folder", root: p, name: p.split("/").pop()! }); setShow(""); }} onClose={() => setShow("")} />}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<StrictMode><Demo /></StrictMode>);
