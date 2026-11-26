// The file tree (brand.html §14), shared by every app with files: Articula's Modelica packages and
// classes, Julix's and Malachite's scripts and folders. It owns only the interaction state (collapse,
// menu, drop); the host owns the entries and the mutations. Icons by file type (§11), from the registry.
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";

import { Icon } from "../Icon.tsx";
import { Menu, type MenuEntry } from "../Menu.tsx";
import { fileIconFor } from "./types.ts";
import { dropTarget, parentsOf, within } from "./tree.ts";

export type FileEntry = {
  path: string;
  name: string;
  /** 0 for a root row, +1 per folder level. */
  depth: number;
  kind: "folder" | "file";
  /** A host-drawn glyph that replaces the file type's icon (Articula's class kinds, a language mark). */
  glyph?: ReactNode;
  /** A short right-hand label ("jl", "package", …). */
  badge?: string;
  /** The entry it belongs under (a flow's station, by path): the picker's "By station" view. `null`: it
   *  should have one, but it wasn't found (it shows under the orphans' group). */
  parent?: string | null;
  /** A short warning on the row ("pump-rig 0.1.0 not found"), with the warning icon; never red. */
  warn?: string;
};

export type FileLabels = {
  newFile?: string;
  newFolder?: string;
  open?: string;
  rename?: string;
  duplicate?: string;
  delete?: string;
  copyPath?: string;
  empty?: string;
};

export type FileActions = {
  onOpen?: (entry: FileEntry) => void;
  /** A folder's row was pressed (it also opens or closes): a picker choosing where to save. */
  onFolder?: (entry: FileEntry) => void;
  onNewFile?: (parent?: FileEntry) => void;
  onNewFolder?: (parent?: FileEntry) => void;
  onRename?: (entry: FileEntry) => void;
  onDuplicate?: (entry: FileEntry) => void;
  onDelete?: (entry: FileEntry) => void;
  onCopyPath?: (entry: FileEntry) => void;
  /** Move `source` into `target`; no target means the workspace root. */
  onMove?: (source: FileEntry, target?: FileEntry) => void;
};

export type FileTreeHandle = { openNewMenu: (x: number, y: number) => void };

type Menu = { entry?: FileEntry; x: number; y: number };

function visible(entries: readonly FileEntry[], collapsed: ReadonlySet<string>): FileEntry[] {
  const out: FileEntry[] = [];
  let hiddenBelow: number | null = null;
  for (const entry of entries) {
    if (hiddenBelow !== null && entry.depth > hiddenBelow) continue;
    hiddenBelow = null;
    out.push(entry);
    if (entry.kind === "folder" && collapsed.has(entry.path)) hiddenBelow = entry.depth;
  }
  return out;
}

function TypeIcon({ entry, open }: { entry: FileEntry; open: boolean }) {
  const { icon, tone } = fileIconFor(entry.name, entry.kind, open);
  return <span style={{ color: `var(--file-${tone})`, display: "inline-flex" }}><Icon name={icon} /></span>;
}

export const FileTree = forwardRef<FileTreeHandle, {
  entries: readonly FileEntry[];
  active?: string;
  actions: FileActions;
  labels?: FileLabels;
  ariaLabel?: string;
  /** The app's own file menu (REBRAND "File menu": the shared groups, its own group under its name, an
   *  unavailable item greyed with why); without it the tree offers the actions it was given. */
  menu?: (entry?: FileEntry) => MenuEntry[];
}>(function FileTree({ entries, active, actions, labels = {}, ariaLabel = "Workspace", menu: menuFor }, ref) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [menu, setMenu] = useState<Menu | null>(null);
  // the folder a drag would land in ("" = the root) and the path being dragged
  const [drop, setDrop] = useState<string | null>(null);
  const dragged = useRef<string | null>(null);
  const parents = useMemo(() => parentsOf(entries), [entries]);
  const rows = visible(entries, collapsed);
  const DND = "application/x-paperboat-file";

  useImperativeHandle(ref, () => ({
    openNewMenu: (x, y) => setMenu({ x, y }),
  }), []);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", close);
    };
  }, [menu]);

  const close = () => setMenu(null);
  const toggle = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const move = (source: string, target?: FileEntry) => {
    if (!actions.onMove) return;
    const from = entries.find((e) => e.path === source);
    if (from) actions.onMove(from, target);
  };

  // over a row: the folder that holds it takes the drop (the row itself when it is a folder)
  const over = (e: DragEvent, row: FileEntry | undefined) => {
    if (!dragged.current || !e.dataTransfer.types.includes(DND)) return;
    const t = dropTarget(entries, parents, row, dragged.current);
    e.stopPropagation();
    if (!t.ok) { setDrop(null); return; }
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDrop(t.folder?.path ?? "");
  };
  const land = (e: DragEvent, row: FileEntry | undefined) => {
    e.preventDefault();
    e.stopPropagation();
    const source = dragged.current ?? e.dataTransfer.getData(DND);
    dragged.current = null;
    setDrop(null);
    if (!source) return;
    const t = dropTarget(entries, parents, row, source);
    if (t.ok) move(source, t.folder);
  };

  const parentOf = (entry?: FileEntry) => (entry?.kind === "folder" ? entry : undefined);
  const menuAt = (entry: FileEntry | undefined, x: number, y: number) => setMenu({ entry, x, y });

  const item = (label: string, run: () => void, danger = false) => (
    <button type="button" role="menuitem" className={danger ? "danger" : ""} onClick={() => { run(); close(); }}>{label}</button>
  );

  return (
    <div
      className="files-tree"
      role="tree"
      aria-label={ariaLabel}
      onDragOver={(e) => over(e, undefined)}
      onDrop={(e) => land(e, undefined)}
      onDragEnd={() => { dragged.current = null; setDrop(null); }}
    >
      {rows.length === 0 && <p className="files-empty">{labels.empty ?? "No files here yet."}</p>}
      {rows.map((entry) => {
        const here = entry.path === active;
        const open = entry.kind === "folder" && !collapsed.has(entry.path);
        return (
          <button
            key={entry.path}
            type="button"
            role="treeitem"
            aria-expanded={entry.kind === "folder" ? open : undefined}
            aria-selected={entry.kind === "file" ? here : undefined}
            className={`file-row${here ? " on" : ""}${drop && drop === entry.path ? " drop-target" : ""}${drop && entry.path !== drop && within(parents, parents.get(entry.path), drop) ? " drop-inside" : ""}`}
            style={{ paddingLeft: 8 + entry.depth * 14 }}
            title={entry.path}
            draggable={!!actions.onMove}
            onDragStart={(e) => {
              if (!actions.onMove) return;
              dragged.current = entry.path;
              e.dataTransfer.setData(DND, entry.path);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => over(e, entry)}
            onDrop={(e) => land(e, entry)}
            onClick={() => { if (entry.kind === "folder") { toggle(entry.path); actions.onFolder?.(entry); } else actions.onOpen?.(entry); }}
            onKeyDown={(e) => {
              if ((e.key === "Delete" || e.key === "Backspace") && actions.onDelete) {
                e.preventDefault();
                actions.onDelete(entry);
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (entry.kind === "folder") toggle(entry.path);
                else actions.onOpen?.(entry);
              } else if (e.key === "F2" && actions.onRename) {
                e.preventDefault();
                actions.onRename(entry);
              } else if (e.key === "ArrowRight" && entry.kind === "folder" && collapsed.has(entry.path)) {
                e.preventDefault();
                toggle(entry.path);
              } else if (e.key === "ArrowLeft" && entry.kind === "folder" && !collapsed.has(entry.path)) {
                e.preventDefault();
                toggle(entry.path);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              menuAt(entry, e.clientX, e.clientY);
            }}
          >
            <span className="caret">{entry.kind === "folder" && <Icon name={open ? "chevron-down" : "chevron-right"} size={14} />}</span>
            <span className="file-icon">{entry.glyph ?? <TypeIcon entry={entry} open={open} />}</span>
            <span className="nm">{entry.name}</span>
            {entry.warn ? <span className="file-warn" title={entry.warn}><Icon name="warning" size={12} />{entry.warn}</span> : <span className="k">{entry.badge ?? ""}</span>}
          </button>
        );
      })}

      {menu && menuFor && (
        <div className="file-menu own" style={{ left: Math.min(menu.x, window.innerWidth - 290), top: Math.min(menu.y, window.innerHeight - 460) }}>
          {menu.entry && <div className="file-menu-head"><TypeIcon entry={menu.entry} open={false} />{menu.entry.name}</div>}
          <Menu label={menu.entry ? `${menu.entry.name}: actions` : "New"} items={menuFor(menu.entry)} onClose={close} />
        </div>
      )}
      {menu && !menuFor && (
        <>
          <div className="file-menu-scrim" onPointerDown={close} />
          <div
            className="file-menu"
            role="menu"
            aria-label="File actions"
            style={{ left: Math.min(menu.x, window.innerWidth - 230), top: Math.min(menu.y, window.innerHeight - 280) }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {actions.onNewFile && item(labels.newFile ?? "New file…", () => actions.onNewFile?.(parentOf(menu.entry)))}
            {actions.onNewFolder && item(labels.newFolder ?? "New folder…", () => actions.onNewFolder?.(parentOf(menu.entry)))}
            {menu.entry && actions.onOpen && menu.entry.kind === "file" && item(labels.open ?? "Open", () => actions.onOpen?.(menu.entry!))}
            {menu.entry && actions.onRename && <hr />}
            {menu.entry && actions.onRename && item(labels.rename ?? "Rename…", () => actions.onRename?.(menu.entry!))}
            {menu.entry && actions.onDuplicate && menu.entry.kind === "file" && item(labels.duplicate ?? "Duplicate…", () => actions.onDuplicate?.(menu.entry!))}
            {menu.entry && actions.onDelete && <hr />}
            {menu.entry && actions.onDelete && item(labels.delete ?? "Delete…", () => actions.onDelete?.(menu.entry!), true)}
            {menu.entry && actions.onCopyPath && <hr />}
            {menu.entry && actions.onCopyPath && item(labels.copyPath ?? "Copy path", () => actions.onCopyPath?.(menu.entry!))}
          </div>
        </>
      )}
    </div>
  );
});
