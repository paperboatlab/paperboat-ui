// Export and import (REBRAND "Export and import"): one dialog in every app that writes files out or reads them
// in. The kinds down the left in their groups (Export | Import above them when the app does both), the chosen
// kind's options and preview on the right (the app's, in SettingsSection and SettingRow), where it goes, the
// same as a command for a terminal, and the keys: what it will do, the primary, Cancel last.
// The app opens it from its menu's "Export as ▸" / "Import ▸" (transferMenu), Ctrl K and its own key.
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Segmented } from "./controls.tsx";
import { Dialog } from "./Dialog.tsx";
import { fileIconFor } from "./files/types.ts";
import { Icon } from "./Icon.tsx";
import { Key } from "./Key.tsx";
import { SettingRow, SettingsSection } from "./Settings.tsx";
import { actionLabel, groupKinds, MODE_NAME, pickKind, typesText, type TransferKind, type TransferMode } from "./transfer.ts";

export type TransferTarget = {
  /** Where the file goes, in the workspace ("stations/furuta-rig-0.1.0.pst"). */
  path: string;
  /** A word under it ("In the hub furuta-lab"). */
  note?: ReactNode;
  /** Change…: the app opens its picker (the kit's SaveFile in a hub, the system's otherwise). */
  onChange?: () => void;
};

export function TransferDialog({ kinds, mode: mode0, kind: kind0, subject, body, target, command, say, busy, onKind, onRun, onClose }: {
  /** What the app writes out and reads in. One mode alone: no switch (Malachite exports a note as PDF). */
  kinds: Partial<Record<TransferMode, readonly TransferKind[]>>;
  /** What it opens on; default export, and the first kind that can be chosen. */
  mode?: TransferMode;
  kind?: string;
  /** What is exported, beside the title: "Furuta.Pendulum · model/Furuta.mo", "E5: MPC". */
  subject?: string;
  /** The chosen kind's options and preview. */
  body: (mode: TransferMode, kind: string) => ReactNode;
  /** Where it goes (an export); the app keeps it as the options change. */
  target?: (mode: TransferMode, kind: string) => TransferTarget | undefined;
  /** The same from a terminal, for the options chosen: shown with a copy key. */
  command?: (mode: TransferMode, kind: string) => string | undefined;
  /** What the primary key will do, beside it ("Builds the station, then packs it"). */
  say?: (mode: TransferMode, kind: string) => string | undefined;
  /** While it runs: the primary key says what is happening, with the spinner. */
  busy?: string;
  /** The kind chosen: the app remembers it for its next open (Ctrl E opens on the last). */
  onKind?: (mode: TransferMode, kind: string) => void;
  onRun: (mode: TransferMode, kind: string) => void;
  onClose: () => void;
}) {
  const modes = (["export", "import"] as const).filter((m) => kinds[m]?.length);
  const [mode, setMode] = useState<TransferMode>(modes.includes(mode0 as TransferMode) ? mode0! : modes[0] ?? "export");
  const [chosen, setChosen] = useState<Partial<Record<TransferMode, string>>>(() => ({ [mode]: kind0 }));
  const list = kinds[mode] ?? [];
  const kind = pickKind(list, chosen[mode]);
  const nav = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const choose = (m: TransferMode, id: string) => { setMode(m); setChosen((c) => ({ ...c, [m]: id })); onKind?.(m, id); };
  const step = (e: KeyboardEvent) => {
    const d = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!d || !kind) return;
    e.preventDefault();
    const open = list.filter((k) => !k.why), i = open.findIndex((k) => k.id === kind.id);
    const next = open[(i + d + open.length) % open.length];
    choose(mode, next.id);
    nav.current?.querySelector<HTMLElement>(`[data-kind="${next.id}"]`)?.focus();
  };
  const to = kind && target?.(mode, kind.id), cmd = kind && command?.(mode, kind.id);
  const copy = () => { if (cmd) void navigator.clipboard?.writeText(cmd).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };

  return (
    <Dialog title={MODE_NAME[mode]} tags={[subject]} className="transfer" onClose={onClose} actions={<>
      <span className="transfer-say">{kind && say?.(mode, kind.id)}</span>
      {kind && <Key kind="primary" icon={mode === "export" ? "desktop-download" : undefined} busy={!!busy} disabled={!!busy} onClick={() => onRun(mode, kind.id)}>{busy || actionLabel(mode, kind)}</Key>}
      <Key onClick={onClose} shortcut="Esc">Cancel</Key>
    </>}>
      <div className="transfer-body">
        <div className="transfer-side">
          {modes.length > 1 && <Segmented label="Export or import" options={modes.map((m) => ({ value: m, label: MODE_NAME[m] }))} value={mode}
            onChange={(m) => { setMode(m); const k = pickKind(kinds[m] ?? [], chosen[m]); if (k) onKind?.(m, k.id); }} />}
          <div ref={nav} className="transfer-kinds" role="listbox" aria-label={`${MODE_NAME[mode]} as`} onKeyDown={step}>
            {groupKinds(list).map((g) => (
              <div key={g.group} role="group" aria-label={g.group || undefined}>
                {g.group && <div className="group-label">{g.group}</div>}
                {g.kinds.map((k) => <KindRow key={k.id} k={k} on={k.id === kind?.id} onPick={() => choose(mode, k.id)} />)}
              </div>
            ))}
          </div>
        </div>
        <div className="transfer-page" role="region" aria-label={kind?.name}>
          {kind ? body(mode, kind.id) : <p className="settings-note">Nothing to {mode} here.</p>}
          {to && (
            <SettingsSection title="Where">
              <SettingRow label="Save to" hint={to.note}>
                <span className="well transfer-path" title={to.path}>{to.path}</span>
                {to.onChange && <Key size="sm" onClick={to.onChange}>Change…</Key>}
              </SettingRow>
            </SettingsSection>
          )}
        </div>
      </div>
      {cmd && (
        <div className="transfer-cli">
          <span>In a terminal</span><code title={cmd}>{cmd}</code>
          <Key kind="quiet" size="sm" icon={copied ? "check" : "copy"} onClick={copy}>{copied ? "Copied" : "Copy"}</Key>
        </div>
      )}
    </Dialog>
  );
}

function KindRow({ k, on, onPick }: { k: TransferKind; on: boolean; onPick: () => void }) {
  const file = fileIconFor(`x.${k.types[0] ?? ""}`, "file");
  return (
    <button type="button" role="option" aria-selected={on} data-kind={k.id} tabIndex={on ? 0 : -1} aria-disabled={!!k.why || undefined}
      title={k.why} onClick={() => !k.why && onPick()}>
      <span className="transfer-icon" style={{ color: k.icon ? undefined : `var(--file-${file.tone})` }}><Icon name={k.icon ?? file.icon} size={20} /></span>
      <b>{k.name}<em title={typesText(k.types)}>{typesText(k.types)}</em></b>
      <small>{k.why ?? k.line}</small>
    </button>
  );
}

/** A read-only look at what it will write (code, a table's first rows, a summary), in mono on the sunken grey. */
export function TransferPreview({ children }: { children: ReactNode }) {
  return <pre className="transfer-preview">{children}</pre>;
}
