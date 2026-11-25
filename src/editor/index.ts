// @paperboatlab/ui/editor: the code editor, its languages (one folder each) and its theme collection.
export { Editor, DEFAULT_EDITOR_SETTINGS, type EditorPos, type EditorProps, type EditorSettings } from "./Editor.tsx";
export * from "./language.ts";
export * from "./lang/index.ts";
export * from "./themes/index.ts";
export { gitGutter, gitMarks, type GitKind } from "./gitGutter.ts";
export { EditorSettingsKey } from "./EditorSettingsKey.tsx";
export { useEditorSettings, useAppConfig, readConfig, configTemplate, type ConfigStore, type ConfigFile, type AppConfig } from "./useEditorSettings.ts";
export { livePreview, type LivePreviewOptions } from "./livePreview.ts";
