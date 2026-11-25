// What the scene draws: shapes, not domains (the same fields as paperboat/0's Entity and View, so an app
// passes its protocol's objects as they are).
import type { Vec3 } from "./fit.ts";

/** One shape: box, sphere (size[0] = radius), cylinder (size[0] = radius, size[1] = length along y), line (pos to `to`), image (size[0] × size[1], facing +z, from src) or mesh. */
export type SceneEntity = {
  id: string;
  shape: "box" | "sphere" | "cylinder" | "line" | "image" | "mesh";
  pos: Vec3;
  size?: Vec3;
  /** Radians, applied in x, y, z order. */
  rot?: Vec3;
  scale?: Vec3;
  to?: Vec3;
  /** Its own colour; absent: the theme's muted ink. */
  color?: string;
  src?: string;
  /** A mesh's vertices (x, y, z each), triangles (three indices each) and field (one number per vertex): plain or typed arrays. */
  vertices?: unknown;
  indices?: unknown;
  values?: unknown;
  wireframe?: boolean;
  wireframeColor?: string;
  /** Drawn through other geometry. */
  overlay?: boolean;
  range?: [number, number];
  colormap?: string;
};

/** Where the camera opens: 3D (the floor grid, an eye and a target) or 2D (orthographic, looking down −z). */
export type SceneCamera =
  | { mode: "3d"; grid?: boolean; floor?: number; camera?: { eye: Vec3; target?: Vec3; fov?: number } }
  | { mode: "2d"; center: [number, number]; height: number };

/** What the app can ask of a scene. */
export type SceneHandle = {
  /** Frame everything (or the picked object) in view. */
  fit: (only?: string) => void;
};
