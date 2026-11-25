// A mesh entity (shape "mesh") as three.js geometry: its vertices and triangles as buffer attributes,
// and its optional field (values) as vertex colours on a colour map (absent: viridis). From legacy shared.
import * as THREE from "three";
import { sampleColormap } from "../plot/colormaps.ts";
import type { SceneEntity } from "./types.ts";

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** Linear RGB per value (what three.js wants for vertex colours), from low to high. */
export function fieldColors(values: ArrayLike<number>, range?: [number, number], colormap?: string): Float32Array {
  let [lo, hi] = range && range[1] > range[0] ? range : [Infinity, -Infinity];
  if (!(range && range[1] > range[0])) {
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (!Number.isFinite(v)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  const span = hi > lo ? hi - lo : 1;
  const out = new Float32Array(values.length * 3);
  for (let i = 0; i < values.length; i++) {
    const [r, g, b] = sampleColormap(colormap ?? "viridis", Math.min(1, Math.max(0, (values[i] - lo) / span)) || 0);
    out[i * 3] = srgbToLinear(r / 255);
    out[i * 3 + 1] = srgbToLinear(g / 255);
    out[i * 3 + 2] = srgbToLinear(b / 255);
  }
  return out;
}

const asFloat32 = (v: unknown) => (v instanceof Float32Array ? v : Array.isArray(v) ? new Float32Array(v.map(Number)) : null);
const asIndex = (v: unknown) => (v instanceof Uint32Array ? v : Array.isArray(v) ? new Uint32Array(v.map(Number)) : null);

// An id per array object: a mesh is rebuilt when its vertices or triangles are new arrays.
const ids = new WeakMap<object, number>();
let next = 1;
const idOf = (v: unknown) => {
  if (typeof v !== "object" || v === null) return 0;
  let id = ids.get(v);
  if (id === undefined) ids.set(v, (id = next++));
  return id;
};

/** What a mesh's geometry is built from: its arrays' identities, and whether it has a field. */
export const meshLook = (e: SceneEntity) => [idOf(e.vertices), idOf(e.indices), e.values !== undefined, e.colormap];

export function meshGeometry(e: SceneEntity): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const vertices = asFloat32(e.vertices);
  if (!vertices) return geometry;
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  const index = asIndex(e.indices);
  if (index) geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.computeVertexNormals();
  if (e.values !== undefined) paintField(geometry, e);
  return geometry;
}

/** Colours the mesh by its field, when the field or its colour range is new. */
export function paintField(geometry: THREE.BufferGeometry, e: SceneEntity) {
  const last = geometry.userData.field as { values?: unknown; lo?: number; hi?: number; colormap?: string } | undefined;
  if (e.values === undefined || (last && last.values === e.values && last.lo === e.range?.[0] && last.hi === e.range?.[1] && last.colormap === e.colormap)) return;
  geometry.userData.field = { values: e.values, lo: e.range?.[0], hi: e.range?.[1], colormap: e.colormap };
  const values = asFloat32(e.values);
  const n = geometry.getAttribute("position")?.count ?? 0;
  if (!values || values.length !== n) return;
  geometry.setAttribute("color", new THREE.BufferAttribute(fieldColors(values, e.range, e.colormap), 3));
}
