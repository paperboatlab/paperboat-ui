// The scene's arithmetic, without three.js (tested in node): how far a camera stands to frame a
// sphere, which third of the view cube a point is in, and the screen box round projected points.

export type Vec3 = [number, number, number];

/** How far from a sphere's centre a camera stands to see it whole, with room round it (`margin`). */
export function fitDistance(radius: number, fovDeg: number, aspect: number, margin = 1.2): number {
  const v = (fovDeg * Math.PI) / 360; // half the vertical field
  const h = Math.atan(Math.tan(v) * Math.max(aspect, 1e-3)); // half the horizontal
  return (Math.max(radius, 1e-3) * margin) / Math.sin(Math.min(v, h));
}

/**
 * The view cube's thirds: the face, edge or corner a point on the cube (−0.5…0.5 each way) is
 * in, as the direction to look from (each component −1, 0 or 1).
 */
export function cubeSide(p: Vec3): Vec3 {
  const side = (v: number) => (Math.abs(v) < 1 / 6 ? 0 : Math.sign(v));
  return [side(p[0]), side(p[1]), side(p[2])];
}

/** The screen box round points (px), or null when none is in front of the camera (`z` ≤ 1 in clip space). */
export function screenBox(points: readonly Vec3[]): { x: number; y: number; w: number; h: number } | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y, z] of points) {
    if (z > 1) continue;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return x0 === Infinity ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
