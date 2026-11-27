// The hub in every app (REBRAND "Hub", GUIDELINES §4 "No Malachite, no hub", paperboat#16; mockups in
// agent-docs/rebrand/apps/hub and apps/files): the connect dialog, the hub's Settings pane and our picker over
// the workspace's hub. They only draw and report: the app reads the hubs and does what the user picked.
// Shown only once Malachite is installed; each app picks its own hub and can switch at any time.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Dialog } from "../Dialog.tsx";
import { useDismiss } from "../dismiss.tsx";
import { Icon } from "../Icon.tsx";
import { Key } from "../Key.tsx";
import { Segmented, Switch } from "../controls.tsx";
import { SPIN_AFTER, Spinner, useAfter } from "../Spinner.tsx";
import { isOpening, type Opening } from "../workspace/workspace.ts";
import { FileTree, type FileEntry } from "../files/FileTree.tsx";
import { byParent, folderOf, hubStatus, hubWhere, opens, pickable, PLACE_NAMES, saveName, type Hub } from "./hub.ts";
import { fileIconFor } from "../files/types.ts";

/** Malachite's mark in line (the registry's mark-malachite: a hub), in its file colour. */
export function HubMark({ size = 16 }: { size?: number }) {
  return <Icon name="mark-malachite" size={size} className="hub-mark" />;
}

const glyph = (h: Hub, size = 16) => (h.place === "local" ? <HubMark size={size} /> : <Icon name="cloud" size={size} />);

/** Arrow keys between a list's enabled buttons (a menu, the picker's rows). */
export function arrows(e: KeyboardEvent<HTMLElement>, selector: string) {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  e.preventDefault();
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>(selector)];
  const i = items.indexOf(document.activeElement as HTMLElement);
  items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
}

/**
 * @deprecated The workspace well (`WorkspaceWell` in `@paperboatlab/ui/workspace`) replaces it: a folder or a
 * hub, Close hub and Use a local folder instead… for Disconnect. Kept while the apps still import it.
 *
 * The hub selector, beside the app's name while it works in a hub: Malachite's mark, the name, a
 * word when something is wrong, a chevron. Its menu switches this app's hub (the others keep theirs).
 */
export function HubSelector({ hub, hubs, app, onSwitch, onNew, onOpenInMalachite, onDisconnect }: {
  hub: Hub;
  /** The hubs Malachite knows, this one among them. */
  hubs: readonly Hub[];
  /** This app's name, for "Disconnect Julix". */
  app: string;
  onSwitch: (id: string) => void;
  onNew: () => void;
  /** Leave out in Malachite itself, which is the hub's app. */
  onOpenInMalachite?: () => void;
  /** Leave out in Malachite itself, which always works in a hub. */
  onDisconnect?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useDismiss(box, () => setOpen(false), { enabled: open, triggerRef: trigger });
  useEffect(() => { if (open) box.current?.querySelector<HTMLElement>(".menu-item:not([aria-disabled])")?.focus(); }, [open]);
  const st = hubStatus(hub);
  const run = (f: () => void) => () => { setOpen(false); f(); };
  const head = hub.sync ? `${PLACE_NAMES[hub.place]} · ${hub.sync.text}` : hub.path;
  return (
    <span className="hub-sel-wrap">
      <button ref={trigger} type="button" className={`hub-sel${st?.bad ? " bad" : ""}`} aria-haspopup="menu" aria-expanded={open}
        title={`Hub: ${hub.name} · ${hubWhere(hub)}`} onClick={() => setOpen((o) => !o)}>
        <HubMark />
        <span className="nm">{hub.name}</span>
        {st && <>{st.busy && <span className="app-malachite"><Spinner size={12} /></span>}<span className="st">{st.text}</span></>}
        <Icon name="chevron-down" size={14} className="chev" />
      </button>
      {open && (
        <div ref={box} className="menu hub-menu" role="menu" aria-label="Hub" data-own-keys onKeyDown={(e) => arrows(e, ".menu-item:not([aria-disabled])")}>
          <div className="hub-menu-head"><b>Hub</b><span>{head}</span></div>
          {hubs.map((h) => {
            const s = hubStatus(h);
            return (
              <button key={h.id} type="button" className="menu-item hub-row" role="menuitemradio" aria-checked={h.id === hub.id}
                aria-disabled={h.missing || undefined} title={h.missing ? `Can't find ${h.path}` : hubWhere(h)}
                onClick={h.missing ? undefined : run(() => h.id !== hub.id && onSwitch(h.id))}>
                <span><Icon name="chosen" size={14} className="check" />{glyph(h, 14)}{h.name}</span>
                <span className={`meta${s?.bad ? " bad" : ""}`}>{s?.busy && <span className="app-malachite"><Spinner size={10} /></span>}{s?.bad || s?.busy ? s.text : PLACE_NAMES[h.place]}</span>
              </button>
            );
          })}
          <hr />
          <button type="button" className="menu-item" role="menuitem" onClick={run(onNew)}><span><span className="check" /><Icon name="add" size={14} />New hub…</span></button>
          {onOpenInMalachite && <button type="button" className="menu-item" role="menuitem" onClick={run(onOpenInMalachite)}><span><span className="check" /><Icon name="link-external" size={14} />Open {hub.name} in Malachite</span></button>}
          {onDisconnect && <><hr /><button type="button" className="menu-item" role="menuitem" onClick={run(onDisconnect)}><span><span className="check" /><span className="hub-gap" />Disconnect {app}</span></button></>}
          <div className="menu-note">{onDisconnect ? `Only ${app} switches; other apps keep their hub` : `Opens in a new ${app} window`}</div>
        </div>
      )}
    </span>
  );
}

/** A row to pick in a short dialog (Open asks, Connect to a hub): a glyph, a name over a line, a fact, a chevron. */
export function PickRow({ glyph, name, line, fact, bad, onPick, disabled, title }: {
  glyph: ReactNode; name: string; line: string; fact?: string; bad?: boolean; onPick: () => void; disabled?: boolean; title?: string;
}) {
  return (
    <button type="button" className="hub-pick" disabled={disabled} onClick={onPick} title={title}>
      {glyph}
      <span className="hub-pick-text"><b>{name}</b><small>{line}</small></span>
      <em className={bad ? "bad" : ""}>{fact ?? ""}</em>
      <Icon name="chevron-right" size={12} />
    </button>
  );
}

/**
 * Connect to a hub… (File, the Start page, Open asks): the hubs Malachite knows, each with how many of the
 * app's files it holds (`Hub.holds`), and New hub…. Choosing one makes it the app's workspace; the other
 * apps stay where they are. A hub-only app (Malachite) calls it Open a hub.
 */
export function ConnectHub({ app, hubs, hubOnly, opening, onConnect, onNew, onClose }: {
  app: string;
  hubs: readonly Hub[];
  hubOnly?: boolean;
  /** A hub on its way (`useOpening`): its row says so, the others wait; a failure is said on its row. */
  opening?: Opening | null;
  onConnect: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const busy = !!opening && !opening.error, slow = useAfter(busy, SPIN_AFTER);
  return (
    <Dialog title={hubOnly ? "Open a hub" : "Connect to a hub"} tags={["the hubs Malachite knows"]} className="ws-ask" onClose={onClose}
      actions={<><span className="ws-hint">The hub becomes {app}'s workspace; the other apps stay where they are</span><span className="grow" /><Key shortcut="Esc" onClick={onClose}>Cancel</Key></>}>
      <div className="hub-picks" onKeyDown={(e) => arrows(e, ".hub-pick:not(:disabled)")}>
        {hubs.map((h) => {
          const s = hubStatus(h), mine = isOpening(opening, h);
          return <PickRow key={h.id} glyph={mine && slow ? <Spinner size={20} /> : glyph(h, 20)} name={h.name} disabled={h.missing || busy} title={hubWhere(h)}
            line={mine && opening?.error ? opening.error : mine && slow ? (opening?.detail ?? `Opening ${h.name}…`) : hubWhere(h)}
            fact={mine && opening?.error ? "couldn't open" : h.missing || s?.bad ? s?.text : h.holds} bad={(mine && !!opening?.error) || s?.bad} onPick={() => onConnect(h.id)} />;
        })}
        <PickRow glyph={<Icon name="add" size={20} />} name="New hub…" line="In a folder on this computer, or one a sync app keeps" disabled={busy} onPick={onNew} />
      </div>
    </Dialog>
  );
}

/** `sync`: only when Paperboat itself syncs the hub; a folder another app syncs has no switch. */
export type HubSettingsValues = { author: string; keep: "90d" | "1y" | "always"; ignore: string; sync?: boolean };

/**
 * A hub's Settings pane (the Launcher's Hubs page, Malachite's Settings › Hub): `hub.toml` is never
 * shown as a file; it is set here. `commands` shows the `paperboat hub …` command under each row.
 */
export function HubSettings({ hub, values, account, commands, onSet, onRename, onMove, onRemove }: {
  hub: Hub;
  values: HubSettingsValues;
  /** A cloud hub's account ("you@example.com"). */
  account?: string;
  commands?: boolean;
  onSet: <K extends keyof HubSettingsValues>(key: K, value: HubSettingsValues[K]) => void;
  onRename: () => void;
  onMove: () => void;
  onRemove: () => void;
}) {
  const [author, setAuthor] = useState(values.author);
  const [ignore, setIgnore] = useState(values.ignore);
  useEffect(() => { setAuthor(values.author); setIgnore(values.ignore); }, [values.author, values.ignore]);
  const cloud = hub.place !== "local";
  const row = (label: string, hint: string, control: ReactNode, cmd: string) => (
    <div className="set-row">
      <div className="sl"><b>{label}</b><small>{hint}</small>{commands && <code className="hub-cmd">paperboat {cmd}</code>}</div>
      <div className="sctl">{control}</div>
    </div>
  );
  const text = (value: string, set: (v: string) => void, key: "author" | "ignore", label: string, wide = false) => (
    <label className={`well${wide ? " wide" : ""}`}>
      <input aria-label={label} value={value} onChange={(e) => set(e.target.value)}
        onBlur={() => value !== values[key] && onSet(key, value)} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()} />
    </label>
  );
  return (
    <div className="hub-settings">
      <section className="settings-section"><h3>The hub</h3>
        {row("Name", "The folder keeps its name; apps show this one", <><span className="well">{hub.name}</span><Key size="sm" onClick={onRename}>Rename</Key></>, `hub rename ${hub.name} <name>`)}
        {row("Author", "Written on every note, run and version made here", text(author, setAuthor, "author", "Author"), `hub config ${hub.name} author "${values.author}"`)}
      </section>
      <section className="settings-section"><h3>Where it lives</h3>
        {row("Folder", cloud ? (values.sync === undefined ? `In ${PLACE_NAMES[hub.place]}: its app on this computer keeps it in sync` : `In ${PLACE_NAMES[hub.place]}${account ? `, as ${account}` : ""}`) : "On this computer",
          <><span className="well wide" title={hub.path}>{cloud ? <Icon name="cloud" size={14} /> : <Icon name="folder" size={14} />}<span>{`\u200e${hub.path}`}</span></span><Key size="sm" onClick={onMove}>Move…</Key></>,
          `hub move ${hub.name} <folder>`)}
        {cloud && values.sync !== undefined && row("Sync", hub.sync ? `Now: ${hub.sync.text}` : "", <Switch label="Sync" checked={values.sync ?? true} onChange={(on) => onSet("sync", on)} />, `hub sync ${hub.name} ${values.sync === false ? "--resume" : "--pause"}`)}
      </section>
      <section className="settings-section"><h3>History</h3>
        {row("Keep versions", "Every save is a version; restoring one keeps the current one too",
          <Segmented label="Keep versions" value={values.keep} onChange={(v) => onSet("keep", v)} options={[{ value: "90d", label: "90 days" }, { value: "1y", label: "1 year" }, { value: "always", label: "Always" }]} />,
          `hub config ${hub.name} keep ${values.keep}`)}
        {row("Leave out", "Never versioned or synced: scratch files, caches", text(ignore, setIgnore, "ignore", "Leave out", true), `hub config ${hub.name} ignore "${values.ignore}"`)}
      </section>
      <section className="settings-section"><h3>Remove</h3>
        {row("Remove from the list", "Paperboat forgets the hub; the folder and its files stay where they are", <Key size="sm" kind="danger" onClick={onRemove}>Remove from the list</Key>, `hub remove ${hub.name}`)}
      </section>
    </div>
  );
}

type PickProps = {
  /** What it opens or saves, in words: "a flow or a station", "the flow". */
  what: string;
  /** The extensions it opens, without the dot: ["psf", "pst"]. Saving uses the first. */
  types: readonly string[];
  /** The workspace's hub: the picker works over it alone (the hub decides the picker). */
  hub: Hub;
  /** The hub's files in tree order (FileTree's entries); `.malachite/` is left out here. */
  list: () => Promise<readonly FileEntry[]>;
  /** The type filter's first choice, in words ("Scripts"); default the extensions. */
  kinds?: string;
  onClose: () => void;
};

/**
 * File › Open file… in a hub: our picker over the workspace's hub, floating in the centre (never the
 * system's): the app's files or all of them, Find, a preview. `byParent` adds a "By station | Folders"
 * switch: each parent entry with its children under it, the entries whose parent wasn't found under
 * `orphans` (FileEntry `parent`, `warn`).
 */
export function OpenFile(props: PickProps & {
  /** The preview of a picked file: what it holds, when it was saved. */
  describe?: (entry: FileEntry) => ReactNode;
  byParent?: { label: string; orphans: string };
  onOpen: (path: string) => void;
}) {
  return <Pick {...props} mode="open" />;
}

/**
 * File › Save as… in a hub: the same picker choosing a folder and a name. A name that is taken asks to
 * replace it; the old file stays in the hub's history.
 * ponytail: no New folder here yet; the app's file tree makes folders.
 */
export function SaveFile(props: PickProps & { name: string; onSave: (path: string) => void }) {
  return <Pick {...props} mode="save" />;
}

function Pick({ mode, what, types, hub, list, kinds, onClose, ...rest }: PickProps & {
  mode: "open" | "save";
  describe?: (entry: FileEntry) => ReactNode;
  byParent?: { label: string; orphans: string };
  onOpen?: (path: string) => void;
  name?: string;
  onSave?: (path: string) => void;
}) {
  const save = mode === "save";
  const nest = !save && rest.byParent;
  const [entries, setEntries] = useState<readonly FileEntry[] | null>(null);
  const [failed, setFailed] = useState("");
  const [all, setAll] = useState<"opens" | "all">("opens");
  const [view, setView] = useState<"parent" | "folders">(nest ? "parent" : "folders");
  const [find, setFind] = useState("");
  const [sel, setSel] = useState<FileEntry | null>(null);
  const [folder, setFolder] = useState("");
  const [name, setName] = useState(rest.name ?? "");

  // read once per hub: an inline `list` (a new function each render) mustn't read it again
  const lister = useRef(list);
  lister.current = list;
  useEffect(() => {
    let live = true;
    setEntries(null); setFailed(""); setSel(null); setFolder("");
    lister.current().then((e) => live && setEntries(e), (err: unknown) => live && setFailed(String((err as Error)?.message ?? err)));
    return () => { live = false; };
  }, [hub.id]);

  const ext = types.map((t) => `.${t}`).join(" · ");
  const rows = entries ? pickable(entries, types, all === "all", find) : [];
  // saving: the folder of the picked row, and the file name with the app's first type
  const fileName = saveName(name, types);
  const target = fileName && (folder ? `${folder}/${fileName}` : fileName);
  const taken = !!target && !!entries?.some((e) => e.path === target);
  const ok = save ? !!fileName && !/[\\/]/.test(name) : !!sel && sel.kind === "file" && opens(sel.name, types);
  const done = () => {
    if (!ok) return;
    if (save) rest.onSave?.(target);
    else if (sel) rest.onOpen?.(sel.path);
  };
  const pickRow = (e: FileEntry) => {
    setSel(e);
    if (save) { setFolder(folderOf(e.path)); setName(e.name); }
  };
  const where = save ? folder : sel ? folderOf(sel.path) : "";
  const empty = find ? "Nothing matches." : save ? `${hub.name} is empty: it saves at the top.` : `No ${ext} files in ${hub.name}.`;

  return (
    <Dialog title={save ? `Save ${what} as` : `Open ${what}`} tags={[ext]} className="tall open-file" onClose={onClose}
      actions={<>
        <span className="open-file-hint">{save ? (taken ? `${fileName} is there: saving replaces it (the old one stays in the history)` : `Saves into ${hub.name}; Malachite keeps the history`) : "Enter opens · Esc closes"}</span>
        <span className="grow" />
        <Key kind={save && taken ? "danger" : "primary"} disabled={!ok} onClick={done}>{save ? (taken ? "Replace" : "Save") : "Open"}</Key>
        <Key shortcut="Esc" onClick={onClose}>Cancel</Key>
      </>}>
      <div className="open-hub" onKeyDown={(e) => {
        const typing = (e.target as HTMLElement).tagName === "INPUT";
        if (e.key === "Enter" && ok && (!typing || save)) { e.preventDefault(); done(); }
      }}>
        <div className="open-bar">
          <span className="open-crumb"><HubMark size={14} /><b>{hub.name}</b>{` / ${where ? `${where.split("/").join(" / ")} /` : ""}`}</span>
          <label className="well find"><Icon name="search" size={14} /><input aria-label="Find a file" placeholder="Find…" value={find} onChange={(e) => setFind(e.target.value)} /></label>
          {nest ? <Segmented label="Show" value={view} onChange={setView} options={[{ value: "parent", label: nest.label }, { value: "folders", label: "Folders" }]} />
            : !save && <Segmented label="Which files" value={all} onChange={setAll} options={[{ value: "opens", label: kinds ?? types.map((t) => `.${t}`).join(" "), hint: "Only what this app opens" }, { value: "all", label: "All files" }]} />}
        </div>
        <div className="open-body">
          <div className="open-tree" onDoubleClick={done}>
            {failed ? <p className="files-empty bad">Can't read {hub.name}: {failed}</p>
              : !entries ? <p className="files-empty"><Spinner size={14} /> Reading {hub.name}</p>
              : nest && view === "parent" ? <Nested entries={entries} types={types} find={find} orphans={nest.orphans} active={sel?.path} empty={empty} onPick={pickRow} />
              : <FileTree entries={save && !find ? pickable(entries, types, true).filter((e) => e.kind === "folder" || opens(e.name, types)) : rows}
                  active={sel?.path} ariaLabel={`Files in ${hub.name}`} menu={() => []} labels={{ empty }}
                  actions={{ onOpen: pickRow, onFolder: save ? (e) => { setFolder(e.path); setSel(null); } : undefined }} />}
          </div>
          <aside className="open-prev">
            {save ? <>
              <b>Save in</b>
              <small>{hub.name}/{folder}</small>
              <label className="well save-name"><input aria-label="File name" autoFocus value={name} onChange={(e) => setName(e.target.value)} /></label>
              {fileName && fileName !== name.trim() && <small>saves as {fileName}</small>}
              {/[\\/]/.test(name) && <small className="bad">A name can't hold / or \: pick the folder in the tree</small>}
            </> : sel ? <>
              <b>{sel.name}</b>
              {ok && rest.describe?.(sel)}
              {sel.warn && <small className="open-warn"><Icon name="warning" size={12} />{sel.warn}</small>}
              <small>{ok ? `in ${hub.name}/${where}` : `Not ${what}: this opens ${ext} only`}</small>
            </> : <p className="muted">Pick {what}</p>}
          </aside>
        </div>
      </div>
    </Dialog>
  );
}

/** The "By station" view: each parent with its children under it (their folder at the right), then the orphans. */
function Nested({ entries, types, find, orphans, active, empty, onPick }: {
  entries: readonly FileEntry[]; types: readonly string[]; find: string; orphans: string; active?: string; empty: string; onPick: (e: FileEntry) => void;
}) {
  const [shut, setShut] = useState<ReadonlySet<string>>(new Set());
  const g = byParent(entries, types, find);
  const row = (e: FileEntry, depth: number, kids?: number) => {
    const open = !shut.has(e.path);
    const side = [e.badge, folderOf(e.path) && `${folderOf(e.path)}/`].filter(Boolean).join(" · ");
    const { icon, tone } = fileIconFor(e.name, "file");
    return (
      <button key={e.path} type="button" role="treeitem" aria-selected={e.path === active} aria-expanded={kids ? open : undefined}
        className={`file-row${e.path === active ? " on" : ""}`} style={{ paddingLeft: 8 + depth * 14 }} title={e.path}
        onClick={() => onPick(e)} onKeyDown={(k) => {
          if (kids && (k.key === "ArrowRight" || k.key === "ArrowLeft")) {
            k.preventDefault();
            setShut((s) => { const n = new Set(s); if (k.key === "ArrowLeft") n.add(e.path); else n.delete(e.path); return n; });
          }
        }}>
        <span className="caret" onClick={kids ? (c) => { c.stopPropagation(); setShut((s) => { const n = new Set(s); if (open) n.add(e.path); else n.delete(e.path); return n; }); } : undefined}>
          {!!kids && <Icon name={open ? "chevron-down" : "chevron-right"} size={14} />}
        </span>
        <span className="file-icon">{e.glyph ?? <span style={{ color: `var(--file-${tone})`, display: "inline-flex" }}><Icon name={icon} /></span>}</span>
        <span className="nm">{e.name}</span>
        {e.warn ? <span className="file-warn" title={e.warn}><Icon name="warning" size={12} />{e.warn}</span> : <span className="k">{side}</span>}
      </button>
    );
  };
  return (
    <div className="files-tree" role="tree" aria-label="By parent">
      {!g.parents.length && !g.orphans.length && <p className="files-empty">{empty}</p>}
      {g.parents.map(({ entry, children }) => [row(entry, 0, children.length), ...(shut.has(entry.path) ? [] : children.map((c) => row(c, 1)))])}
      {g.orphans.length > 0 && <><div className="files-group" role="presentation">{orphans}</div>{g.orphans.map((e) => row(e, 1))}</>}
    </div>
  );
}
