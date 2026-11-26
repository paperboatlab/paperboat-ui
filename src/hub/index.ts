// The hub in every app (paperboat#16): the connect dialog, the Settings pane, the picker over the workspace's hub.
// The bar's hub well is the workflow's WorkspaceWell (`@paperboatlab/ui/workspace`); HubSelector stays until the apps move.
export { ConnectHub, HubMark, HubSelector, HubSettings, OpenFile, PickRow, SaveFile, type HubSettingsValues } from "./Hub.tsx";
export { byParent, folderOf, HUB_OWN, PLACE_NAMES, hubStatus, hubWhere, opens, pickable, saveName, type Hub, type HubPlace } from "./hub.ts";
