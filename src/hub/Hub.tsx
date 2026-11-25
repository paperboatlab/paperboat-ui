// The hub in every app (REBRAND "Hub", GUIDELINES §4 "No Malachite, no hub", paperboat#16; mockups in
// agent-docs/rebrand/apps/hub): the selector in the bar, the connect dialog, the hub's Settings pane and
// the file picker. They only draw and report: the app reads the hubs and does what the user picked.
// Shown only once Malachite is installed; each app picks its own hub and can switch at any time.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Dialog } from "../Dialog.tsx";
import { useDismiss } from "../dismiss.tsx";
import { Icon } from "../Icon.tsx";
import { Key } from "../Key.tsx";
import { Segmented, Switch } from "../controls.tsx";
import { Spinner } from "../Spinner.tsx";
import { FileTree, type FileEntry } from "../files/FileTree.tsx";
import { hubStatus, hubWhere, opens, pickable, PLACE_NAMES, type Hub } from "./hub.ts";

/** Malachite's mark in line (the registry's mark-malachite: a hub), in its file colour. */
export function HubMark({ size = 16 }: { size?: number }) {
  return (
    <svg className="hub-mark" width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
      <rect x="2.5" y="2.5" width="11" height="11" rx="1" /><path d="M3.6 13.5L5.8 2.5M5.8 2.5L8 13.5M8 13.5L10.2 2.5M10.2 2.5L12.4 13.5" />
    </svg>
  );
}

const glyph = (h: Hub, size = 16) => (h.place === "local" ? <HubMark size={size} /> : <Icon name="cloud" size={size} />);

/** Arrow keys between a list's enabled buttons (a menu, the picker's rows). */
function arrows(e: KeyboardEvent<HTMLElement>, selector: string) {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  e.preventDefault();
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>(selector)];
  const i = items.indexOf(document.activeElement as HTMLElement);
  items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
}

/**
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
  onOpenInMalachite: () => void;
  onDisconnect: () => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useDismiss(box, () => setOpen(false), { enabled: open, triggerRef: trigger });
  useEffect(() => { if (open) box.current?.querySelector<HTMLElement>(".menu-item:not([aria-disabled])")?.focus(); }, [open]);
  const st = hubStatus(hub);
  const run = (f: () => void) => () => { setOpen(false); f(); };
  const head = hub.place === "local" ? hub.path : `${PLACE_NAMES[hub.place]}${hub.sync ? ` · ${hub.sync.text}` : ""}`;
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
          <button type="button" className="menu-item" role="menuitem" onClick={run(onOpenInMalachite)}><span><span className="check" /><Icon name="link-external" size={14} />Open {hub.name} in Malachite</span></button>
          <hr />
          <button type="button" className="menu-item" role="menuitem" onClick={run(onDisconnect)}><span><span className="check" /><span className="hub-gap" />Disconnect {app}</span></button>
          <div className="menu-note">Only {app} switches; other apps keep their hub</div>
        </div>
      )}
    </span>
  );
}

/** One hub as a row to pick (the connect dialog, the picker's first step). */
function HubRow({ hub, on, onPick, after }: { hub: Hub; on?: boolean; onPick: () => void; after?: ReactNode }) {
  const s = hubStatus(hub);
  return (
    <button type="button" className={`hub-pick${on ? " on" : ""}`} disabled={hub.missing} aria-pressed={on} onClick={onPick} title={hubWhere(hub)}>
      {glyph(hub, 20)}
      <span className="hub-pick-text"><b>{hub.name}</b><small>{hubWhere(hub)}</small></span>
      <em className={s?.bad ? "bad" : ""}>{hub.missing ? s?.text : (hub.holds ?? (s?.text ?? ""))}</em>
      {after}
    </button>
  );
}

/** File › Connect to a hub… (apps that work in a hub as a whole: Julix, Malachite's own). */
export function ConnectHub({ app, about, hubs, current, onConnect, onNew, onFolder, onClose }: {
  app: string;
  /** What the app keeps in the hub: "its scripts, data and plots". */
  about: string;
  hubs: readonly Hub[];
  /** The hub to pick first: this app's last one. */
  current?: string;
  onConnect: (id: string) => void;
  onNew: () => void;
  /** A plain folder instead (no hub). */
  onFolder: () => void;
  onClose: () => void;
}) {
  const usable = hubs.filter((h) => !h.missing);
  const [pick, setPick] = useState(current ?? usable[0]?.id);
  const chosen = hubs.find((h) => h.id === pick);
  return (
    <Dialog title={`Connect ${app} to a hub`} wide onClose={onClose}
      actions={<>
        <Key kind="quiet" icon="add" onClick={onNew}>New hub…</Key>
        <Key kind="quiet" icon="folder" onClick={onFolder}>A plain folder instead</Key>
        <span className="grow" />
        <Key kind="primary" disabled={!chosen} onClick={() => chosen && onConnect(chosen.id)}>{chosen ? `Connect to ${chosen.name}` : "Connect"}</Key>
        <Key shortcut="Esc" onClick={onClose}>Cancel</Key>
      </>}>
      <p>{app} keeps {about} in the hub; Malachite links them to your notes and runs. Other apps keep their own hub.</p>
      <div className="hub-picks" onKeyDown={(e) => arrows(e, ".hub-pick:not(:disabled)")}>
        {usable.map((h) => <HubRow key={h.id} hub={h} on={h.id === pick} onPick={() => setPick(h.id)} />)}
      </div>
    </Dialog>
  );
}

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
    <div className="hub-row-set">
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
      <section><h3>The hub</h3>
        {row("Name", "The folder keeps its name; apps show this one", <><span className="well">{hub.name}</span><Key size="sm" onClick={onRename}>Rename</Key></>, `hub rename ${hub.name} <name>`)}
        {row("Author", "Written on every note, run and version made here", text(author, setAuthor, "author", "Author"), `hub config ${hub.name} author "${values.author}"`)}
      </section>
      <section><h3>Where it lives</h3>
        {row("Folder", cloud ? `In ${PLACE_NAMES[hub.place]}${account ? `, as ${account}` : ""}` : "On this computer",
          <><span className="well wide">{cloud ? <Icon name="cloud" size={14} /> : <Icon name="folder" size={14} />}{hub.path}</span><Key size="sm" onClick={onMove}>Move…</Key></>,
          cloud ? `hub move ${hub.name} <folder>` : `hub move ${hub.name} --cloud google-drive`)}
        {cloud && row("Sync", hub.sync ? `Now: ${hub.sync.text}` : "", <Switch label="Sync" checked={values.sync ?? true} onChange={(on) => onSet("sync", on)} />, `hub sync ${hub.name} ${values.sync === false ? "--resume" : "--pause"}`)}
      </section>
      <section><h3>History</h3>
        {row("Keep versions", "Every save is a version; restoring one keeps the current one too",
          <Segmented label="Keep versions" value={values.keep} onChange={(v) => onSet("keep", v)} options={[{ value: "90d", label: "90 days" }, { value: "1y", label: "1 year" }, { value: "always", label: "Always" }]} />,
          `hub config ${hub.name} keep ${values.keep}`)}
        {row("Leave out", "Never versioned or synced: scratch files, caches", text(ignore, setIgnore, "ignore", "Leave out", true), `hub config ${hub.name} ignore "${values.ignore}"`)}
      </section>
      <section><h3>Remove</h3>
        {row("Remove from the list", "Paperboat forgets the hub; the folder and its files stay where they are", <Key size="sm" kind="danger" onClick={onRemove}>Remove from the list</Key>, `hub remove ${hub.name}`)}
      </section>
    </div>
  );
}

/**
 * File › Open… for every app: first where from (this computer, or a hub), then the system's picker
 * (the app's) or our tree of the hub, filtered to what the app opens. The file decides the hub: the
 * app works in the hub it was opened from. Without hubs, the app calls its system picker directly.
 * ponytail: open only; Save as (a folder and a name) joins when an app saves into a hub.
 */
export function OpenFile({ what, types, hubs, list, describe, onComputer, onOpen, onClose }: {
  /** What it opens, in words: "a flow or a station". */
  what: string;
  /** The extensions it opens, without the dot: ["psf", "pst"]. */
  types: readonly string[];
  hubs: readonly Hub[];
  /** A hub's files in tree order (FileTree's entries); `.malachite/` is left out here. */
  list: (hub: Hub) => Promise<readonly FileEntry[]>;
  /** The preview of a picked file: what it holds, when it was saved. */
  describe?: (hub: Hub, entry: FileEntry) => ReactNode;
  /** Hand over to the system's picker. */
  onComputer: () => void;
  onOpen: (hub: Hub, path: string) => void;
  onClose: () => void;
}) {
  const [hub, setHub] = useState<Hub | null>(null);
  const [entries, setEntries] = useState<readonly FileEntry[] | null>(null);
  const [failed, setFailed] = useState("");
  const [all, setAll] = useState<"opens" | "all">("opens");
  const [find, setFind] = useState("");
  const [sel, setSel] = useState<FileEntry | null>(null);

  useEffect(() => {
    if (!hub) return;
    let live = true;
    setEntries(null); setFailed(""); setSel(null);
    list(hub).then((e) => live && setEntries(e), (err: unknown) => live && setFailed(String((err as Error)?.message ?? err)));
    return () => { live = false; };
  }, [hub, list]);

  const rows = entries ? pickable(entries, types, all === "all", find) : [];
  const ok = !!sel && sel.kind === "file" && opens(sel.name, types);
  const open = () => { if (hub && sel && ok) onOpen(hub, sel.path); };
  const ext = types.map((t) => `.${t}`).join(" · ");

  return (
    <Dialog title={`Open ${what}`} tags={[ext]} className="tall open-file" onClose={onClose}
      actions={<>
        <span className="open-file-hint">{hub ? "Enter opens · Backspace goes back · Esc closes" : "Pick where the file is"}</span>
        <span className="grow" />
        {hub && <Key kind="primary" disabled={!ok} onClick={open}>Open</Key>}
        <Key shortcut="Esc" onClick={onClose}>Cancel</Key>
      </>}>
      {!hub ? (
        <div className="open-where" onKeyDown={(e) => arrows(e, ".hub-pick:not(:disabled)")}>
          <button type="button" className="hub-pick" onClick={() => { onClose(); onComputer(); }}>
            <Icon name="folder" size={20} />
            <span className="hub-pick-text"><b>This computer</b><small>your system's file picker</small></span>
            <em>any folder</em><Icon name="chevron-right" size={12} />
          </button>
          <div className="open-where-group">Hubs</div>
          {hubs.map((h) => <HubRow key={h.id} hub={h} onPick={() => { setAll("opens"); setFind(""); setHub(h); }} after={<Icon name="chevron-right" size={12} />} />)}
        </div>
      ) : (
        <div className="open-hub" onKeyDown={(e) => {
          const typing = (e.target as HTMLElement).tagName === "INPUT";
          if (e.key === "Enter" && ok) { e.preventDefault(); open(); }
          if (e.key === "Backspace" && !typing) { e.preventDefault(); setHub(null); }
        }}>
          <div className="open-bar">
            <Key size="sm" kind="quiet" onClick={() => setHub(null)} title="Back (Backspace)">‹ Where from</Key>
            <span className="open-crumb"><HubMark size={14} /><b>{hub.name}</b>{sel && sel.path.includes("/") && ` › ${sel.path.split("/").slice(0, -1).join(" › ")}`}</span>
            <label className="well find"><Icon name="search" size={14} /><input aria-label="Find a file" placeholder="Find a file…" value={find} onChange={(e) => setFind(e.target.value)} /></label>
            <Segmented label="Which files" value={all} onChange={setAll} options={[{ value: "opens", label: types.map((t) => `.${t}`).join(" "), hint: `Only what this app opens` }, { value: "all", label: "All files" }]} />
          </div>
          <div className="open-body">
            <div className="open-tree" onDoubleClick={open}>
              {failed ? <p className="files-empty bad">Can't read {hub.name}: {failed}</p>
                : !entries ? <p className="files-empty"><Spinner size={14} /> Reading {hub.name}</p>
                : <FileTree entries={rows} active={sel?.path} ariaLabel={`Files in ${hub.name}`} menu={() => []}
                    labels={{ empty: find ? "Nothing matches." : `No ${ext} files in ${hub.name}.` }}
                    actions={{ onOpen: (e) => setSel(e) }} />}
            </div>
            <aside className="open-prev">
              {sel ? <>
                <b>{sel.name}</b>
                {ok && describe?.(hub, sel)}
                <small>{ok ? `in ${hub.name}/${sel.path.split("/").slice(0, -1).join("/")}` : `Not ${what}: this opens ${ext} only`}</small>
              </> : <p className="muted">Pick {what}</p>}
            </aside>
          </div>
        </div>
      )}
    </Dialog>
  );
}
