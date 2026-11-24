// Colours for what plots draw on a <canvas>, which can't read CSS variables: the tokens, read from the page
// when drawing (so a theme change redraws in the new ink), with the light values as a fallback.
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#6250d6"];

export function token(name: string, fallback: string, from?: Element | null): string {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(from ?? document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** Series k (brand.html §14): six slots in a fixed order, never cycled into new hues; past six they repeat
 *  and the caller changes the dash. */
export const seriesColor = (k: number, from?: Element | null) => token(`--series-${(k % 6) + 1}`, SERIES[k % 6], from);
