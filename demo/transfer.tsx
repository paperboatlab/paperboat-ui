// Export and import (TransferDialog): `npm run demo`, then open demo/transfer.html. ?app=malachite (a note out
// as PDF: export only, no switch) or ?app=articula (export and import); &theme=dark.
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "../src/tokens.css";
import "../src/ui.css";
import { Segmented, Switch } from "../src/controls.tsx";
import { Key } from "../src/Key.tsx";
import { Menu } from "../src/Menu.tsx";
import { SettingRow, SettingsSection } from "../src/Settings.tsx";
import { useTheme, type Theme } from "../src/theme.tsx";
import { TransferDialog, TransferPreview } from "../src/Transfer.tsx";
import { shellLine, transferMenu, type TransferKind, type TransferMode } from "../src/transfer.ts";

const q = new URLSearchParams(location.search);
const app = q.get("app") === "articula" ? "articula" : "malachite";
document.documentElement.dataset.app = app;

const NOTE: TransferKind[] = [
  { id: "pdf", group: "Documents", name: "PDF", types: ["pdf"], line: "To print or send: the note as it reads, cells' output included" },
  { id: "html", group: "Documents", name: "Web page", types: ["html"], line: "One file that opens in any browser, figures inside" },
  { id: "slides", group: "Documents", name: "Slides", types: ["pdf"], line: "A slide per heading", why: "Only a note with three headings or more" },
  { id: "md", group: "Notes", name: "Markdown", types: ["md", "zip"], line: "The text and its attachments, for another notes app" },
];
const MODEL: Partial<Record<TransferMode, TransferKind[]>> = {
  export: [
    { id: "station", group: "For Paperboat", name: "Station", types: ["pst"], line: "The model as it is, nonlinear, for Simplicial's flows" },
    { id: "linear-station", group: "For Paperboat", name: "Linear station", types: ["pst"], line: "ẋ = Ax + Bu about an operating point; no FMU, no omc to run it" },
    { id: "fmu", group: "Model files", name: "FMU", types: ["fmu"], line: "For any FMI tool, or Julia's FMI.jl" },
  ],
  import: [
    { id: "fmu", group: "Into the model", name: "FMU", types: ["fmu"], line: "A block that runs it, wired like any part" },
    { id: "parameters", group: "Into the model", name: "Parameters", types: ["toml", "json"], line: "Set a class's parameters from a file", action: "Set 6 parameters" },
  ],
};

function Body({ mode, kind }: { mode: TransferMode; kind: string }) {
  const [page, setPage] = useState("a4");
  const [cells, setCells] = useState(true);
  const [path, setPath] = useState("auto");
  const [ts, setTs] = useState("discrete");
  const [open, setOpen] = useState(true);
  if (app === "malachite") return (
    <>
      <SettingsSection title={kind === "md" ? "Markdown" : kind === "html" ? "Web page" : "PDF"}>
        {kind === "pdf" && <SettingRow label="Page" hint="Margins as the hub's print settings"><Segmented label="Page" options={[{ value: "a4", label: "A4" }, { value: "letter", label: "Letter" }]} value={page} onChange={setPage} /></SettingRow>}
        <SettingRow label="Cells' output" hint="Figures and values as they last ran; the code stays"><Switch label="Cells' output" checked={cells} onChange={setCells} /></SettingRow>
        <SettingRow label="Links" hint="A link to another note becomes its title, with the note's path in a footnote"><Switch label="Links" checked onChange={() => {}} /></SettingRow>
      </SettingsSection>
      <SettingsSection title="Preview">
        <TransferPreview>{`E5: MPC on the identified model                         page 1 of 3
  The control toolkit's mpc block in place of E4's state feedback…
  Choosing the horizon · table, 3 rows
  Result · table, 5 rows · 1 figure (arm-error.svg)
  2 cells' output · 1 equation`}</TransferPreview>
      </SettingsSection>
      <SettingsSection title="When done"><SettingRow label="Open it"><Switch label="Open it" checked={open} onChange={setOpen} /></SettingRow></SettingsSection>
    </>
  );
  if (mode === "import") return (
    <SettingsSection title={kind === "fmu" ? "FMU" : "Parameters"}>
      <SettingRow label="File"><span className="well transfer-path">{kind === "fmu" ? "vendor/amp-q2.fmu" : "flows/out/identified.toml"}</span><Key size="sm">Choose…</Key></SettingRow>
      <SettingRow label="Into" hint={kind === "fmu" ? "A class in the package; then drag it from the Library" : undefined}><span className="well">{kind === "fmu" ? "Furuta" : "Furuta.Rig · pendulum"}</span></SettingRow>
      {kind === "parameters" && <TransferPreview>{"mp  0.034   → 0.03131 ± 0.00032\nlp  0.081   → 0.08166 ± 9.2e-5\nBr  1.6e-3  → 1.431e-3 ± 4.7e-5\nBp  4.5e-5  → 3.882e-5 ± 2.0e-6\nkm  0.040   → 0.03578 ± 0.00026\nfc  1.5e-3  → 1.198e-3 ± 1.1e-4"}</TransferPreview>}
    </SettingsSection>
  );
  return (
    <>
      <SettingsSection title={kind === "fmu" ? "FMU" : "Station"}>
        <SettingRow label="Model"><span className="well">{kind === "station" ? "Furuta.Rig" : "Furuta.Pendulum"}</span></SettingRow>
        {kind === "station" && <SettingRow label="Path" hint="FMU: it has an event, abs(cmd) <= deadband"><Segmented label="Path" options={[{ value: "auto", label: "Auto: FMU" }, { value: "eq", label: "Equations" }, { value: "fmu", label: "FMU" }]} value={path} onChange={setPath} /></SettingRow>}
        {kind === "linear-station" && <SettingRow label="Time" hint="Discrete: held between steps, at the flow's rate (5 ms)"><Segmented label="Time" options={[{ value: "continuous", label: "Continuous" }, { value: "discrete", label: "Discrete" }]} value={ts} onChange={setTs} /></SettingRow>}
        {kind === "fmu" && <SettingRow label="Kind" hint="Co-simulation carries its own solver"><Segmented label="Kind" options={[{ value: "auto", label: "Co-simulation" }, { value: "me", label: "Model exchange" }]} value="auto" onChange={() => {}} /></SettingRow>}
      </SettingsSection>
      {kind === "linear-station" && <SettingsSection title="Preview"><TransferPreview>{"A =  0   1        0        0\n     0  -2.404  -49.601    0.067\n     0   0        0        1\n     0   2.404  147.701   -0.201\npoles  -12.73  -1.58  0.00  +11.71 (unstable: the pendulum falling)"}</TransferPreview></SettingsSection>}
      {kind !== "fmu" && <SettingsSection title="When done"><SettingRow label="Open in Simplicial"><Switch label="Open in Simplicial" checked={open} onChange={setOpen} /></SettingRow></SettingsSection>}
    </>
  );
}

function Demo() {
  useTheme((q.get("theme") as Theme) || "light");
  const [at, setAt] = useState<{ mode: TransferMode; kind?: string } | null>(q.has("closed") ? null : { mode: (q.get("mode") as TransferMode) || "export", kind: q.get("kind") ?? undefined });
  const [busy, setBusy] = useState("");
  const [said, setSaid] = useState("");
  const [menu, setMenu] = useState(q.has("menu"));
  const kinds = app === "malachite" ? { export: NOTE } : MODEL;
  const open = (mode: TransferMode, kind?: string) => { setMenu(false); setAt({ mode, kind }); };
  const target = (_: TransferMode, k: string) => app === "malachite"
    ? { path: `exports/e5-mpc.${k === "md" ? "zip" : k === "slides" ? "pdf" : k}`, note: "In the hub furuta-lab", onChange: () => setSaid("Change…: the hub's SaveFile") }
    : _ === "export" ? { path: k === "fmu" ? "model/out/Furuta.Rig.fmu" : k === "station" ? "stations/furuta-rig-0.1.0.pst" : "stations/furuta-pendulum-lin-0.1.0.pst", note: "In the hub furuta-lab", onChange: () => setSaid("Change…") } : undefined;
  const command = (m: TransferMode, k: string) => app === "malachite"
    ? shellLine(["malachite", "export", "notes/e5-mpc.md", "--as", k, "--out", target(m, k)!.path])
    : m === "export" ? shellLine(["articula", "export", "model/Furuta.mo", "--model", k === "station" || k === "fmu" ? "Furuta.Rig" : "Furuta.Pendulum", "--as", k, "--out", target(m, k)!.path])
      : shellLine(["articula", "import", k === "fmu" ? "vendor/amp-q2.fmu" : "flows/out/identified.toml", "--as", k, "--into", k === "fmu" ? "Furuta" : "Furuta.Rig.pendulum"]);
  return (
    <div style={{ height: "100vh", background: "var(--surface-ground)", color: "var(--text)", font: "13px var(--font-sans)", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12, padding: 20, boxSizing: "border-box" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <span style={{ position: "relative" }}>
          <Key kind="quiet" onClick={() => setMenu(!menu)}>{app === "malachite" ? "Note" : "Model"}</Key>
          {menu && <Menu label={app === "malachite" ? "Note" : "Model"} items={Object.entries(kinds).map(([m, ks]) => transferMenu(m as TransferMode, ks!, open))} onClose={() => setMenu(false)} />}
        </span>
        <Key icon="desktop-download" onClick={() => open("export")}>Export…</Key>
      </div>
      <p style={{ color: "var(--text-muted)" }}>{said || `${app === "malachite" ? "Malachite: a note out as PDF, export only" : "Articula: export and import"} · ?app=malachite|articula&theme=dark`}</p>
      {at && <TransferDialog kinds={kinds} mode={at.mode} kind={at.kind} subject={app === "malachite" ? "E5: MPC · notes/e5-mpc.md" : "model/Furuta.mo"}
        body={(m, k) => <Body key={`${m}-${k}`} mode={m} kind={k} />} target={target} command={command}
        say={(m, k) => app === "malachite" ? (k === "pdf" ? "Lays the note out in pages; the cells don't run again" : undefined) : m === "export" && k === "station" ? "Builds the station, then packs it" : undefined}
        busy={busy} onKind={(m, k) => setSaid(`last: ${m} ${k}`)}
        onRun={(m, k) => { setBusy(m === "export" ? "Exporting…" : "Importing…"); setTimeout(() => { setBusy(""); setAt(null); setSaid(`${m}ed ${k}`); }, 1200); }}
        onClose={() => setAt(null)} />}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<StrictMode><Demo /></StrictMode>);
