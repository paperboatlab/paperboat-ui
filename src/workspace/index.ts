// The one file workflow (plans/2026-11-26_11-05_one_file_workflow.md): the Start page, the File menu, the
// workspace well, the dialogs, the shell client and the shared store's shapes.
export { AskOpen, isAbsolute, NotAHub, Start, TypedPath, Unsaved, WorkspaceWell } from "./Workspace.tsx";
export {
  addRecent, baseName, dropRecent, fileMenu, hasShell, parseRecent, parseSettings, recentFor, recentMenu, shell, tilde, when, RECENT_MAX,
  type FileMenuOptions, type RecentEntry, type RecentKind, type RecentStore, type SharedSettings, type Shell, type Workspace,
} from "./workspace.ts";
