// Settings › Editor: what the sliders key held (theme, font, size, line height, tab, wrap, autocomplete,
// brackets, lint), as rows of the Settings window. The same EditorSettings, the same config file.
import { SettingRow, SettingsSection } from "../Settings.tsx";
import { Switch } from "../controls.tsx";
import type { EditorSettings } from "./Editor.tsx";
import { EDITOR_THEMES } from "./themes/index.ts";
import type { ConfigFile } from "./useEditorSettings.ts";

export function EditorSettingsPane({ settings, onSettings, lintNote, file }: {
  settings: EditorSettings;
  onSettings: (next: EditorSettings) => void;
  /** What the app's linter checks ("% comments"). */
  lintNote?: string;
  /** The config file the settings live in, shown at the foot so a user knows where to edit them. */
  file?: ConfigFile;
}) {
  const set = <K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) => onSettings({ ...settings, [key]: value });
  const choose = <K extends "fontSize" | "lineHeight" | "tabSize">(key: K, label: string, values: number[], unit = "") => (
    <label className="well"><select aria-label={label} value={settings[key]} onChange={(e) => set(key, Number(e.target.value))}>
      {values.map((n) => <option key={n} value={n}>{n}{unit}</option>)}
    </select></label>
  );
  const own = Object.keys(settings.themes ?? {}).filter((t) => !EDITOR_THEMES.some((b) => b.id === t));
  return (
    <>
      <SettingsSection title="Look">
        <SettingRow label="Theme" hint="The code's colours; Follow the app takes the app's light or dark">
          <label className="well"><select aria-label="Editor theme" value={settings.theme} onChange={(e) => set("theme", e.target.value)}>
            <option value="ui">Follow the app</option>
            {EDITOR_THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            {own.map((t) => <option key={t} value={t}>{t}</option>)}
          </select></label>
        </SettingRow>
        <SettingRow label="Font">
          <label className="well"><select aria-label="Font" value={settings.font} onChange={(e) => set("font", e.target.value as EditorSettings["font"])}>
            <option value="geist">Geist Mono</option><option value="system">System mono</option><option value="serif">Serif</option>
          </select></label>
        </SettingRow>
        <SettingRow label="Size">{choose("fontSize", "Size", [11, 12, 12.5, 13, 14, 15, 16], " px")}</SettingRow>
        <SettingRow label="Line height">{choose("lineHeight", "Line height", [20, 22, 24, 26, 28], " px")}</SettingRow>
      </SettingsSection>
      <SettingsSection title="Typing">
        <SettingRow label="Tab size">{choose("tabSize", "Tab size", [2, 4, 8])}</SettingRow>
        <SettingRow label="Wrap lines"><Switch label="Wrap lines" checked={settings.wrap} onChange={(v) => set("wrap", v)} /></SettingRow>
        <SettingRow label="Autocomplete"><Switch label="Autocomplete" checked={settings.autocomplete} onChange={(v) => set("autocomplete", v)} /></SettingRow>
        <SettingRow label="Close brackets"><Switch label="Close brackets" checked={settings.brackets} onChange={(v) => set("brackets", v)} /></SettingRow>
        <SettingRow label="Lint" hint={lintNote}><Switch label="Lint" checked={settings.lint} onChange={(v) => set("lint", v)} /></SettingRow>
      </SettingsSection>
      {file && <p className="settings-note" title="Edit this file for your own themes; the app reads it again when its window regains focus">
        Kept in <code>{file.path}</code>{file.error && <span className="es-error"> {file.error}</span>}
      </p>}
    </>
  );
}
