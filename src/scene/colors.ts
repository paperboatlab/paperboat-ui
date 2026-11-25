// A design token as a colour three.js can take: the browser resolves var(), color-mix() and the rest,
// so the scene draws in the theme's roles (tokens.css), never a raw colour of its own.

let pad: CanvasRenderingContext2D | null = null;

/** The token's colour (0xRRGGBB, sRGB) and its alpha, read from `el` (default: the page). */
export function tokenColor(name: string, el: Element = document.documentElement): { hex: number; alpha: number } {
  const probe = document.createElement("i");
  probe.style.cssText = `display:none;color:var(${name})`;
  el.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  pad ??= Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true });
  if (!pad) return { hex: 0x888888, alpha: 1 };
  pad.clearRect(0, 0, 1, 1);
  pad.fillStyle = color;
  pad.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = pad.getImageData(0, 0, 1, 1).data;
  return { hex: (r << 16) | (g << 8) | b, alpha: a / 255 };
}

/** A CSS colour of the token, for a canvas texture. */
export function tokenCss(name: string, el?: Element): string {
  const { hex, alpha } = tokenColor(name, el);
  return `rgb(${hex >> 16} ${(hex >> 8) & 255} ${hex & 255} / ${alpha})`;
}
