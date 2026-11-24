// The change from light to dark (and back): one cross-fade of the whole window on --glide (300 ms, the one
// curve --ease), so nothing flips in pieces; canvases (plots, the editor) fade with the rest because the
// View Transitions API fades a snapshot. Only on a change the user made, never at the first paint; reduced
// motion makes it instant. Where View Transitions are missing, colours glide on --glide instead.
const GLIDE_MS = 300;

type Doc = Document & { startViewTransition?: (update: () => void) => unknown };

export function applyTheme(shown: "light" | "dark", root: HTMLElement = document.documentElement): void {
  const before = root.dataset.theme;
  const set = () => { root.dataset.theme = shown; };
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!before || before === shown || reduce) return set();  // the first paint, no change, or no motion
  const doc = document as Doc;
  if (doc.startViewTransition) {
    doc.startViewTransition(set);
    return;
  }
  root.classList.add("pb-theme-changing");
  set();
  setTimeout(() => root.classList.remove("pb-theme-changing"), GLIDE_MS + 50);
}
