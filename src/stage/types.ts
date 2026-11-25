// The stage's scene types: paperboat/0's Station entities and view (a station's `scene` and `scene.patch`).
export type Vec3 = [number, number, number];
/** A typed array, or numbers (flat, row-major). */
export type NumberArray = number[] | ArrayLike<number>;

export type Entity = {
  id: string;
  shape: "box" | "sphere" | "cylinder" | "cone" | "line" | "image" | "mesh";
  pos: Vec3;
  size?: Vec3;
  /** Radians, applied in x, y, z order. */
  rot?: Vec3;
  /** Factors on top of size. */
  scale?: Vec3;
  /** A full transform, 16 numbers column-major (three.js `Matrix4.fromArray`): replaces pos, rot and scale. A change to it
   *  (or to pos, rot, scale) only moves the object, so a playback can send one per frame. */
  matrix?: number[];
  /** 0..1 (a box, sphere, cylinder or cone): below 1 it is see-through. */
  opacity?: number;
  to?: Vec3;
  color?: string;
  /** An image's picture: a URL or a data: URL. */
  src?: string;
  /** A mesh's vertices: x, y, z each, in the entity's own frame (pos, rot and scale place it). Shape [n, 3], f32. */
  vertices?: NumberArray;
  /** A mesh's triangles: three vertex indices each, counter-clockwise seen from the front. Shape [m, 3], u32 (or i32, u8). */
  indices?: NumberArray;
  /** A field over a mesh, one number per vertex (a pressure, a stress), that the UI colours over range. Shape [n]. */
  values?: NumberArray;
  /** Draw the mesh's edges over its faces. */
  wireframe?: boolean;
  /** The edge colour; absent: the theme's ink. */
  wireframeColor?: string;
  /** Draw through other geometry (chart axes at the origin, a coordinate cross). */
  overlay?: boolean;
  /** The values that take the low and high ends of the colour scale; absent: the field's own min and max. */
  range?: [number, number];
  /** The field's colour map: parula, viridis, jet, hot, gray, cool, spring, summer, autumn, winter, bone, copper, pink (absent: viridis). */
  colormap?: string;
};

export type View = {
  mode: "3d";
  /** Show the floor grid (default true). The user can switch it on or off on the Station page, and that choice wins. */
  grid?: boolean;
  /** The height (y) of the floor grid (default 0): below a model that hangs from the origin. */
  floor?: number;
  /** Where the camera opens, and where Home on the view cube returns it. Default: eye [2, 4, 8], looking at [0, 0, 0]. */
  camera?: {
    /** The camera's position. */
    eye: [number, number, number];
    /** The point it looks at and orbits (default [0, 0, 0]). */
    target?: [number, number, number];
    /** Vertical field of view in degrees (default 50). */
    fov?: number;
  };
} | {
  mode: "2d";
  center: [number, number];
  height: number;
};
