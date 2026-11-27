// The one file workflow's parts (mockup agent-docs/rebrand/apps/files): the Start page, the bar's
// workspace well and its menu, and the dialogs (Open asks, not a hub, unsaved changes, a typed path).
// They only draw and report: the app's server opens, saves and switches the workspace.
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { Dialog } from "../Dialog.tsx";
import { Icon } from "../Icon.tsx";
import { Key } from "../Key.tsx";
import { Menu, type MenuEntry } from "../Menu.tsx";
import { SAY_AFTER, SPIN_AFTER, Spinner, useAfter } from "../Spinner.tsx";
import { fileIconFor } from "../files/types.ts";
import { arrows, HubMark, PickRow } from "../hub/Hub.tsx";
import { hubStatus, hubWhere, type Hub } from "../hub/hub.ts";
import { baseName, isOpening, recentFor, shell, tilde, when, type Opening, type RecentEntry, type Workspace } from "./workspace.ts";

function FileGlyph({ path, kind }: { path: string; kind: "file" | "folder" }) {
  const { icon, tone } = fileIconFor(path, kind);
  return <span className="ws-glyph" style={{ color: `var(--file-${tone})` }}><Icon name={icon} /></span>;
}

/**
 * The open of a workspace, for `Start`, `WorkspaceWell` and `ConnectHub` (`opening`): `open(what, work)` shows
 * `what` as opening until `work` settles; a second open while one runs does nothing. A failure stays shown
 * (`error`) and is thrown on, for the app's toast; `detail` says what is happening, `clear` ends it.
 */
export function useOpening() {
  const [opening, setOpening] = useState<Opening | null>(null);
  const busy = useRef(false);
  const open = useCallback(async (what: Omit<Opening, "error" | "detail">, work: () => Promise<unknown>) => {
    if (busy.current) return;
    busy.current = true;
    setOpening(what);
    try { await work(); setOpening(null); }
    catch (e) { setOpening({ ...what, error: String((e as Error)?.message ?? e) }); throw e; }
    finally { busy.current = false; }
  }, []);
  const detail = useCallback((d?: string) => setOpening((o) => (o && !o.error ? { ...o, detail: d } : o)), []);
  const clear = useCallback(() => setOpening(null), []);
  return { opening, open, detail, clear };
}

/** Under an entry that opens, past 2 s: what is happening, and Cancel where the app can stop. */
function OpenMore({ opening, className }: { opening: Opening; className: string }) {
  return (opening.detail || opening.onCancel) ? (
    <div className={className} role="status">
      {opening.detail && <span>{opening.detail}</span>}
      {opening.onCancel && <Key size="sm" kind="quiet" onClick={opening.onCancel}>Cancel</Key>}
    </div>
  ) : null;
}

const glyphOf = (e: RecentEntry) => (e.kind === "hub" ? <HubMark /> : <FileGlyph path={e.path} kind={e.kind === "folder" ? "folder" : "file"} />);

/**
 * The Start page, in the bay while the app has no workspace: what it can open (one primary: Open folder…;
 * a hub-only app's is Open a hub…), the drop hint, and Recent: Folders, Hubs, Files, newest first.
 */
export function Start({ app, noun, nouns, about, hubs, hubOnly, recent, home, now = Date.now() / 1000, opening, onOpenFolder, onOpenFile, onNew, onConnect, onNewHub, onRecent, onDrop }: {
  /** The app's name: "Julix". */
  app: string;
  /** "script" (New script) and "scripts" (what the line under the title says it keeps). */
  noun: string;
  nouns: string;
  /** The line under the title, when the default doesn't fit. */
  about?: string;
  /** Malachite is installed: Connect to a hub…, and the Hubs group. */
  hubs: boolean;
  /** Works in hubs only (Malachite): Open a hub… first, New hub…, then Open folder…. */
  hubOnly?: boolean;
  /** The shared recent list, as read (`recentFor` picks what this app shows). */
  recent: readonly RecentEntry[];
  /** The home folder, shown as ~. */
  home?: string;
  /** Seconds since 1970, for "2 h ago". */
  now?: number;
  /** A workspace on its way (`useOpening`): its entry says so, the other keys wait; a failure is said there. */
  opening?: Opening | null;
  onOpenFolder: () => void;
  onOpenFile: () => void;
  onNew: () => void;
  onConnect?: () => void;
  onNewHub?: () => void;
  onRecent: (entry: RecentEntry) => void;
  /** A folder or a file dropped on the page (a Paperboat window gives its path). Without it, no drop hint. */
  onDrop?: (e: DragEvent) => void;
}) {
  const [over, setOver] = useState(false);
  const shown = recentFor({ version: 1, recent: [...recent] }, app.toLowerCase(), { hubs: hubs || !!hubOnly, folders: !hubOnly });
  const busy = !!opening && !opening.error, slow = useAfter(busy, SPIN_AFTER), long = useAfter(busy, SAY_AFTER);
  const listed = [...(hubOnly ? shown.hubs : shown.folders), ...(hubOnly ? [] : shown.hubs), ...shown.files].some((e) => isOpening(opening, e));
  const folderKey = <Key key="folder" kind={hubOnly ? undefined : "primary"} icon="folder-opened" shortcut="Ctrl Shift O" onClick={onOpenFolder} disabled={busy}
    title={hubOnly ? "A plain folder asks: make it a hub, or open a hub" : undefined}>Open folder…</Key>;
  const group = (title: string, rows: RecentEntry[], side = "") => rows.length > 0 && (
    <div className="start-group">
      <div className="start-glab">{title}{side && <span>{side}</span>}</div>
      {rows.map((e) => {
        const mine = isOpening(opening, e), said = mine && opening && (opening.error ?? (slow ? `Opening ${opening.name}…` : ""));
        return [
          <button key={`${e.kind}:${e.path}`} type="button" className={`start-rec${mine ? " opening" : ""}`} title={e.path} disabled={busy} aria-busy={(mine && busy) || undefined} onClick={() => onRecent(e)}>
            {mine && slow ? <Spinner size={16} /> : glyphOf(e)}
            <span><b>{baseName(e.path)}</b><small className={mine && opening?.error ? "bad" : undefined} role={mine && opening?.error ? "alert" : undefined}>{said || tilde(e.path, home)}</small></span>
            <em>{when(e.at, now)}</em>
          </button>,
          mine && long && opening && <OpenMore key={`${e.kind}:${e.path}:more`} opening={opening} className="start-more" />,
        ];
      })}
    </div>
  );
  const none = !shown.folders.length && !shown.hubs.length && !shown.files.length;
  return (
    <div className={`start-page${over ? " over" : ""}`}
      onDragOver={onDrop && ((e) => { e.preventDefault(); setOver(true); })} onDragLeave={onDrop && (() => setOver(false))}
      onDrop={onDrop && ((e) => { e.preventDefault(); setOver(false); onDrop(e); })}>
      <div>
        <h2>Open something to work on</h2>
        <p>{about ?? (hubOnly ? `${app} works in a hub: your notes, runs, models and data, linked, with their history.`
          : `${app} works in a folder${hubs ? " or a hub" : ""}: its ${nouns} and what they make stay together.`)}</p>
        <div className="start-acts">
          {hubOnly && onConnect && <Key kind="primary" onClick={onConnect} disabled={busy}><HubMark />Open a hub…</Key>}
          {hubOnly && onNewHub && <Key icon="add" onClick={onNewHub} disabled={busy}>New hub…</Key>}
          {folderKey}
          <Key icon="file" shortcut="Ctrl O" onClick={onOpenFile} disabled={busy}>Open file…</Key>
          <Key icon="new-file" shortcut="Ctrl N" onClick={onNew} disabled={busy}>New {noun}</Key>
          {!hubOnly && hubs && onConnect && <Key onClick={onConnect} disabled={busy}><HubMark />Connect to a hub…</Key>}
        </div>
        {opening && !listed && (opening.error || slow) && (
          <div className={`start-opening${opening.error ? " bad" : ""}`} role={opening.error ? "alert" : "status"}>
            {opening.error ? <Icon name="error" size={16} /> : <Spinner size={16} />}
            <span><b>{opening.error ? `Couldn't open ${opening.name}` : `Opening ${opening.name}…`}</b>{opening.error && <small>{opening.error}</small>}</span>
          </div>
        )}
        {opening && !listed && long && <OpenMore opening={opening} className="start-more" />}
        {onDrop && <div className="start-drop">or drop a folder or a file here</div>}
      </div>
      <div className="start-recent">
        {none ? <p className="start-none">Nothing opened yet: what you open shows here.</p> : <>
          {group(hubOnly ? "Hubs" : "Folders", hubOnly ? shown.hubs : shown.folders)}
          {!hubOnly && group("Hubs", shown.hubs, "Malachite")}
          {group("Files", shown.files)}
        </>}
      </div>
    </div>
  );
}

/**
 * The bar's workspace well, after the menu bar: a folder (its icon, name, chevron) or a hub (Malachite's
 * mark). Its menu opens, switches, connects and closes; closing goes back to Start. No Disconnect: Close hub
 * and Use a local folder instead… replace it. Reveal shows only in a Paperboat window (`shell()`).
 */
export function WorkspaceWell({ workspace, home, recent, hubs = [], opening, onOpenFolder, onConnect, onClose, onSwitchHub, onNewHub, onOpenInMalachite, onUseFolder }: {
  workspace: Workspace;
  /** Another workspace on its way (`useOpening`): the well says so and its menu waits; a failure is said here. */
  opening?: Opening | null;
  home?: string;
  /** Open recent's items (`recentMenu`). */
  recent: MenuEntry[];
  /** The hubs Malachite knows (the current one among them, by `workspace.hub`); none without Malachite. */
  hubs?: readonly Hub[];
  onOpenFolder: () => void;
  /** Connect to a hub… (a folder's menu, when hubs exist). */
  onConnect?: () => void;
  /** Close folder, Close hub. */
  onClose: () => void;
  onSwitchHub?: (id: string) => void;
  onNewHub?: () => void;
  /** Leave out in Malachite itself, and in a hub-only app. */
  onOpenInMalachite?: () => void;
  /** Use a local folder instead… (leave out in a hub-only app). */
  onUseFolder?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const busy = !!opening && !opening.error, slow = useAfter(busy, SPIN_AFTER), long = useAfter(busy, SAY_AFTER);
  useEffect(() => { if (busy) setOpen(false); }, [busy]);
  const inHub = workspace.kind === "hub";
  const hub = inHub ? hubs.find((h) => h.id === workspace.hub) : undefined;
  const st = hub && hubStatus(hub);
  const sh = shell();
  const reveal: MenuEntry[] = sh ? [{ id: "ws.reveal", label: "Reveal in file manager", icon: "link-external", run: () => sh.reveal(workspace.root) }] : [];
  const items: MenuEntry[] = inHub ? [
    { group: "Switch hub" },
    ...hubs.map((h): MenuEntry => ({ id: `hub:${h.id}`, label: h.name, checked: h.id === workspace.hub, disabled: h.missing, why: h.missing ? "can't find the folder" : undefined,
      run: () => h.id !== workspace.hub && onSwitchHub?.(h.id) })),
    ...(onNewHub ? [{ id: "ws.newHub", label: "New hub…", icon: "add", run: onNewHub } as MenuEntry] : []),
    "-",
    ...(onOpenInMalachite ? [{ id: "ws.malachite", label: "Open in Malachite", icon: "link-external", run: onOpenInMalachite } as MenuEntry] : []),
    ...(onUseFolder ? [{ id: "ws.folder", label: "Use a local folder instead…", run: onUseFolder } as MenuEntry] : []),
    ...reveal,
    "-",
    { id: "ws.close", label: "Close hub", run: onClose },
  ] : [
    { id: "ws.open", label: "Open folder…", shortcut: "Ctrl Shift O", run: onOpenFolder },
    { id: "ws.recent", label: "Open recent", sub: recent, run: () => {} },
    ...(onConnect && hubs.length ? ["-" as const, { id: "ws.connect", label: "Connect to a hub…", icon: "mark-malachite", run: onConnect } as MenuEntry] : []),
    "-",
    ...reveal,
    { id: "ws.close", label: "Close folder", run: onClose },
  ];
  const where = inHub ? (hub ? (hub.sync ? `${hubWhere(hub)} · ${hub.sync.text}` : hubWhere(hub)) : tilde(workspace.root, home)) : tilde(workspace.root, home);
  return (
    <span className="ws-well-wrap">
      <button ref={trigger} type="button" className={`ws-well${st?.bad || opening?.error ? " bad" : ""}`} aria-haspopup="menu" aria-expanded={open}
        aria-disabled={busy || undefined} aria-busy={busy || undefined}
        title={opening?.error ? `Couldn't open ${opening.name}: ${opening.error}` : busy ? `Opening ${opening!.name}…${opening!.detail ? ` · ${opening!.detail}` : ""}` : `${inHub ? "Hub" : "Folder"}: ${workspace.name} · switch, connect or close`}
        onClick={() => !busy && setOpen((o) => !o)}>
        {busy && slow ? <Spinner size={14} /> : inHub ? <HubMark /> : <FileGlyph path={workspace.root} kind="folder" />}
        <span className="nm">{busy && slow ? `Opening ${opening!.name}…` : workspace.name}</span>
        {opening?.error ? <span className="st" role="alert">couldn't open {opening.name}</span>
          : busy ? null
          : st && <>{st.busy && <span className="app-malachite"><Spinner size={12} /></span>}<span className="st">{st.text}</span></>}
        <Icon name="chevron-down" size={14} className="chev" />
      </button>
      {long && opening?.onCancel && <Key size="sm" kind="quiet" onClick={opening.onCancel}>Cancel</Key>}
      {open && <Menu label={inHub ? "Hub" : "Folder"} items={items} onClose={() => setOpen(false)} triggerRef={trigger} className="ws-menu"
        head={<>{inHub ? <HubMark size={14} /> : <FileGlyph path={workspace.root} kind="folder" />}<span>{where}</span></>} />}
    </span>
  );
}

/**
 * Open file… outside a hub, with Malachite installed: a local file (the system's dialog, or a typed path
 * in a browser) or Connect to a hub…. Without Malachite, the app goes straight to the local file.
 */
export function AskOpen({ what, types, hubs, onLocal, onConnect, onClose }: {
  /** "a script", "a flow or a station". */
  what: string;
  /** Extensions without the dot. */
  types: readonly string[];
  /** How many hubs Malachite knows. */
  hubs: number;
  onLocal: () => void;
  onConnect: () => void;
  onClose: () => void;
}) {
  const ext = types.map((t) => `.${t}`).join(" · ");
  return (
    <Dialog title={`Open ${what}`} tags={[ext]} className="ws-ask" onClose={onClose}
      actions={<><span className="ws-hint">Open asks this only outside a hub</span><span className="grow" /><Key shortcut="Esc" onClick={onClose}>Cancel</Key></>}>
      <div className="hub-picks" onKeyDown={(e) => arrows(e, ".hub-pick:not(:disabled)")}>
        <PickRow glyph={<Icon name="folder" size={20} />} name="Open a local file…" line={shell() ? "Your system's file dialog" : "Type its path"} fact={ext} onPick={onLocal} />
        <PickRow glyph={<HubMark size={20} />} name="Connect to a hub…" line="Work in a hub: open from it, save into it, Malachite keeps the history"
          fact={hubs === 1 ? "1 hub" : `${hubs} hubs`} onPick={onConnect} />
      </div>
    </Dialog>
  );
}

/** Malachite works in hubs only: a plain folder asks to become one (the safe choice last). */
export function NotAHub({ name, onMake, onOpenHub, onClose }: { name: string; onMake: () => void; onOpenHub: () => void; onClose: () => void }) {
  return (
    <Dialog title={`${name} isn't a hub`} wait onClose={onClose}
      actions={<><Key kind="primary" onClick={onMake}>Make it a hub</Key><Key onClick={onOpenHub}>Open a hub…</Key><Key shortcut="Esc" onClick={onClose}>Cancel</Key></>}>
      <p>Malachite works in hubs. Make this folder a hub (its files stay where they are, and Malachite keeps their history), or open one of your hubs.</p>
    </Dialog>
  );
}

/** Unsaved changes, before a file closes (or the folder or hub holding it): Save, Don't save, Cancel last. */
export function Unsaved({ name, closing, onSave, onDiscard, onClose }: {
  /** The file's name. */
  name: string;
  /** What is closing, when it isn't the file: "the folder", "the hub", "Julix". */
  closing?: string;
  onSave: () => void;
  onDiscard: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog title={`Save changes to ${name}?`} wait onClose={onClose}
      actions={<><Key kind="primary" onClick={onSave}>Save</Key><Key onClick={onDiscard}>Don't save</Key><Key shortcut="Esc" onClick={onClose}>Cancel</Key></>}>
      <p>{closing ? `Closing ${closing} closes ${name}. ` : ""}Your changes are lost if you don't save them.</p>
    </Dialog>
  );
}

/** A path as typed: absolute (/…, ~/…, C:\…). */
export const isAbsolute = (p: string) => /^(\/|~(\/|$)|[A-Za-z]:[\\/])/.test(p.trim());

/**
 * The browser's fallback for Open folder… and Open a local file… (no Paperboat window, so no system dialog
 * and no real paths): the path, typed. The app's server opens it.
 */
export function TypedPath({ title, what = "folder", initial = "", onOpen, onClose }: {
  /** "Open folder", "Open a local file". */
  title: string;
  what?: "folder" | "file";
  initial?: string;
  onOpen: (path: string) => void;
  onClose: () => void;
}) {
  const [path, setPath] = useState(initial);
  const [tried, setTried] = useState(false);
  const ok = isAbsolute(path);
  const go = () => { setTried(true); if (ok) onOpen(path.trim()); };
  return (
    <Dialog title={title} className="ws-ask" onClose={onClose}
      actions={<><Key kind="primary" disabled={!path.trim()} onClick={go}>Open</Key><Key shortcut="Esc" onClick={onClose}>Cancel</Key></>}>
      <p>In a browser the page can't open your system's dialog: type the {what}'s path. In a Paperboat window it opens the dialog instead.</p>
      <label className={`well ws-path${tried && !ok ? " error" : ""}`}>
        <Icon name={what === "folder" ? "folder" : "file"} size={14} />
        <input aria-label={`The ${what}'s path`} autoFocus spellCheck={false} placeholder={what === "folder" ? "~/projects/tank-level" : "~/projects/tank-level/…"}
          value={path} onChange={(e) => setPath(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} />
      </label>
      {tried && !ok && <small className="field-error">A whole path: from / or ~ (C:\ on Windows)</small>}
    </Dialog>
  );
}
