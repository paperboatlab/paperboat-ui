// @paperboatlab/ui/scene: the 3D stage on three.js (its own entry, so an app without a scene never loads three):
// shapes from paperboat/0's scene, an orbit camera, the view cube or the x/y/z triad, fit, names and picking.
export { SceneView } from "./SceneView.tsx";
export type { SceneCamera, SceneEntity, SceneHandle } from "./types.ts";
export { cubeSide, fitDistance, screenBox, type Vec3 } from "./fit.ts";
export { tokenColor } from "./colors.ts";
