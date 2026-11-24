// A figure's own paper (its background colour): whether it is dark, and the class that keeps the figure's
// keys and readouts in that paper's colours rather than the app theme's (tokens.css, .pb-paper-*).

/** True for a dark paper: #rrggbb, or rgb()/rgba() as JulixPlot writes a translucent one. Unknown reads light. */
export function isDarkColor(bg?: string): boolean {
  if (!bg || bg === "transparent") return false;
  const hex = bg.match(/^#([0-9a-f]{6})$/i);
  const rgb = bg.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  const [r, g, b] = hex ? [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)) : rgb ? rgb.slice(1, 4).map(Number) : [255, 255, 255];
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}

/** The paper class for a figure's own background: on the figure (Plot2D sets it), or on a host's whole figure. */
export const paperClass = (background: string) => (isDarkColor(background) ? "pb-paper-dark" : "pb-paper-light");
