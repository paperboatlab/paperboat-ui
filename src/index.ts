// @paperboatlab/ui: the Paperboat look (agent-docs/rebrand) as React components. Load the styles once:
//   import "@paperboatlab/ui/tokens.css"; import "@paperboatlab/ui/ui.css";
// No app logic here: an app's own canvas, notebooks or pages live in the app.
export { AppMark } from "./AppMark.tsx";
export { APPS, FRAMES, FOLD_MS, frameAt, restMs, type App } from "./fold.ts";
export { Dialog } from "./Dialog.tsx";
export { Icon } from "./Icon.tsx";
export { ICONS, type IconName } from "./icons.ts";
export { Key, RemoveKey, type KeyProps } from "./Key.tsx";
export { Menu, type MenuEntry } from "./Menu.tsx";
export { Panel } from "./Panel.tsx";
export { PanelsKey, type PaneRect, type PanelChoice } from "./PanelsKey.tsx";
export { Pill, Tag, type PillState } from "./Pill.tsx";
export { Rail, type RailItem } from "./Rail.tsx";
export { Search, type SearchItem } from "./Search.tsx";
export { Spinner } from "./Spinner.tsx";
export { GLYPH_FRAMES, GLYPH_FALLBACK, GLYPH_FRAME_MS } from "./glyphs.ts";
export { Segmented, Tabs, Switch } from "./controls.tsx";
export { Toasts, useToasts, type Toast } from "./Toasts.tsx";
export { applyTheme } from "./themeTransition.ts";
export { ThemePicker, ThemePreview, THEMES, useTheme, type Theme } from "./theme.tsx";
export { useDismiss, useFocusReturn } from "./dismiss.tsx";
export * from "./commands.ts";
export { fuzzy } from "./fuzzy.ts";
export { parseToml, patchToml, formatToml, type TomlTable, type TomlValue } from "./toml.ts";
export { readStored, writeStored } from "./storage.ts";
export { compareVersions, newerRelease } from "./versions.ts";
