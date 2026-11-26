// The 3D stage (`@paperboatlab/ui/stage`): scene entities (box, sphere, cylinder, line, image, mesh with a field)
// drawn with three.js, the view cube and its Home key, the axes triad, a floor grid, orbit, persp or iso. Simplicial's
// Station page and Board, and Julix's 3D figures, draw with it. It loads three only for the apps that import it.
// The camera is placed from `view` at mount: a parent remounts it (a key) when the view changes.
export { SceneView } from "./SceneView.tsx";
export type { SceneLabel, ScenePlotLayer, ScenePlotPick, SceneCameraState } from "./SceneView.tsx";
export type { Entity, View, Vec3, NumberArray } from "./types.ts";
export { AXIS_COLORS, viewCube, type ViewCubeOptions } from "./viewCube.ts";
export { viewAxes } from "./viewAxes.ts";
export { fieldColors, meshGeometry, meshLook, paintField, srgbToLinear } from "./meshes.ts";
