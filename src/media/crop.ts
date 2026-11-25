// The image editor's geometry, apart from any element so it can be tested: a crop is a rectangle in the
// rotated picture, each side a fraction of it (0–1); rotating turns the crop with the picture.

export type Rect = { x: number; y: number; w: number; h: number };
export type Turn = 0 | 90 | 180 | 270;
export const FULL: Rect = { x: 0, y: 0, w: 1, h: 1 };

/** The picture's size after `turn` (a quarter turn swaps its sides). */
export const turned = (w: number, h: number, turn: Turn) => (turn % 180 ? { w: h, h: w } : { w, h });

/** The crop after a quarter turn to the right (+90) or left (-90), so it still frames the same part. */
export function turnRect(r: Rect, by: 90 | -90): Rect {
  return by === 90 ? { x: 1 - r.y - r.h, y: r.x, w: r.h, h: r.w } : { x: r.y, y: 1 - r.x - r.w, w: r.h, h: r.w };
}

/** The largest crop of `ratio` (width / height, in pixels) inside `r`, centred on it. */
export function fitRatio(r: Rect, ratio: number, W: number, H: number): Rect {
  const pw = r.w * W, ph = r.h * H;
  const [w, h] = pw / ph > ratio ? [ph * ratio, ph] : [pw, pw / ratio];
  return clamp({ x: r.x + (r.w - w / W) / 2, y: r.y + (r.h - h / H) / 2, w: w / W, h: h / H });
}

/** Kept inside the picture and at least `min` of it on each side. */
export function clamp(r: Rect, min = 0.02): Rect {
  const w = Math.min(1, Math.max(min, r.w)), h = Math.min(1, Math.max(min, r.h));
  return { x: Math.min(1 - w, Math.max(0, r.x)), y: Math.min(1 - h, Math.max(0, r.y)), w, h };
}

/** A drag of the crop by (dx, dy) (fractions): `edge` is which sides move ("" moves the whole box), keeping
 *  `ratio` (pixels) when given. */
export function drag(r: Rect, edge: string, dx: number, dy: number, ratio: number | null, W: number, H: number): Rect {
  if (!edge) return clamp({ ...r, x: r.x + dx, y: r.y + dy });
  let { x, y, w, h } = r;
  if (edge.includes("w")) { x += dx; w -= dx; }
  if (edge.includes("e")) w += dx;
  if (edge.includes("n")) { y += dy; h -= dy; }
  if (edge.includes("s")) h += dy;
  if (x < 0) { w += x; x = 0; }
  if (y < 0) { h += y; y = 0; }
  w = Math.min(w, 1 - x); h = Math.min(h, 1 - y);
  if (ratio) {   // the side dragged leads; the other follows from the ratio, anchored on the opposite side
    const byW = edge.length === 2 ? Math.abs(dx) * W >= Math.abs(dy) * H : edge === "e" || edge === "w";
    if (byW) { const nh = (w * W) / ratio / H; if (edge.includes("n")) y += h - nh; h = nh; }
    else { const nw = (h * H * ratio) / W; if (edge.includes("w")) x += w - nw; w = nw; }
    if (x < 0 || y < 0 || x + w > 1 || y + h > 1) return r;   // it would leave the picture: stays as it was
  }
  return clamp({ x, y, w, h });
}

/** The crop in whole pixels of the turned picture. */
export function pixels(r: Rect, W: number, H: number) {
  const x = Math.round(r.x * W), y = Math.round(r.y * H);
  return { x, y, w: Math.max(1, Math.min(W - x, Math.round(r.w * W))), h: Math.max(1, Math.min(H - y, Math.round(r.h * H))) };
}
