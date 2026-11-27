// The theme: one setting for every Paperboat app (REBRAND "Theme"): light, dark or system (the OS,
// live; the default). It lives in the shared Paperboat settings, not in a page's localStorage (the apps
// run on different ports): the app passes the setting in and saves the choice through `onChange`.
import { useEffect, useRef, useState } from "react";
import { useDismiss } from "./dismiss.tsx";
import { Icon } from "./Icon.tsx";
import { applyTheme } from "./themeTransition.ts";

export type Theme = "light" | "dark" | "system";
export const THEMES: readonly Theme[] = ["light", "dark", "system"];
const NAME: Record<Theme, string> = { light: "Light", dark: "Dark", system: "System" };

/** Applies the theme to <html data-theme> (system: from prefers-color-scheme, live); returns what shows. */
export function useTheme(theme: Theme): "light" | "dark" {
  const query = "(prefers-color-scheme: dark)";
  const [os, setOs] = useState<"light" | "dark">(() => (typeof matchMedia === "function" && matchMedia(query).matches ? "dark" : "light"));
  useEffect(() => {
    const m = typeof matchMedia === "function" ? matchMedia(query) : undefined;
    if (!m) return;
    const on = () => setOs(m.matches ? "dark" : "light");
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  const shown = theme === "system" ? os : theme;
  useEffect(() => applyTheme(shown), [shown]);  // a cross-fade on a change (themeTransition.ts)
  return shown;
}

/** A counter that changes with `<html data-theme>`: what reads CSS tokens once (a canvas, a scene) re-reads on it. */
export function useThemeVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const observer = new MutationObserver(() => setVersion((value) => value + 1));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return version;
}

/* a miniature window in each theme, drawn with that theme's own greys (primitives: it is a picture of the theme) */
function Thumb({ theme }: { theme: "light" | "dark" }) {
  const c = theme === "light"
    ? { g: "var(--grey-100)", p: "var(--grey-50)", r: "var(--white)", t: "var(--grey-900)", m: "var(--grey-500)", l: "var(--grey-200)" }
    : { g: "var(--night-200)", p: "var(--night-100)", r: "var(--night-50)", t: "var(--night-850)", m: "var(--night-500)", l: "var(--night-50)" };
  return (
    <g>
      <rect width="64" height="44" fill={c.g} />
      <rect x="4" y="4" width="56" height="7" rx="1.5" fill={c.p} stroke={c.l} strokeWidth=".5" />
      <rect x="7" y="6.6" width="10" height="1.8" fill={c.t} />
      <rect x="4" y="14" width="12" height="26" rx="1.5" fill={c.p} stroke={c.l} strokeWidth=".5" />
      <rect x="19" y="14" width="41" height="26" rx="1.5" fill={c.p} stroke={c.l} strokeWidth=".5" />
      <rect x="22" y="17" width="14" height="9" rx="1" fill={c.r} stroke={c.l} strokeWidth=".5" />
      <rect x="24" y="19.5" width="8" height="1.4" fill={c.t} />
      <rect x="24" y="22.5" width="10" height="1.2" fill={c.m} />
      <path d="M40 35c3-6 5-6 8-2s5 0 8-3" fill="none" stroke="var(--accent)" strokeWidth=".9" />
    </g>
  );
}

export function ThemePreview({ theme, width = 64 }: { theme: Theme; width?: number }) {
  return (
    <svg className="thumb" viewBox="0 0 64 44" width={width} height={(width * 44) / 64} aria-hidden="true">
      {theme === "system" ? (
        <>
          <defs><clipPath id="pb-thumb-half"><path d="M64 0V44H0z" /></clipPath></defs>
          <Thumb theme="light" />
          <g clipPath="url(#pb-thumb-half)"><Thumb theme="dark" /></g>
        </>
      ) : <Thumb theme={theme} />}
    </svg>
  );
}

/** The bar's theme key: a disc (half white, half black, the same in every state; half a turn on a change)
 *  that opens three previews. */
export function ThemePicker({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState(0);
  const pop = useRef<HTMLDivElement>(null);
  const key = useRef<HTMLButtonElement>(null);
  useDismiss(pop, () => setOpen(false), { enabled: open, triggerRef: key });
  const pick = (t: Theme) => { if (t !== theme) { setTurns((n) => n + 1); onChange(t); } setOpen(false); };
  return (
    <span className="theme-picker">
      <button ref={key} type="button" className="key round" aria-label={`Theme: ${NAME[theme]}`} title={`Theme: ${NAME[theme]}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="disc" style={{ transform: `rotate(${turns * 180}deg)` }}><Icon name="theme-system" /></span>
      </button>
      {open && (
        <div ref={pop} className="popover" role="dialog" aria-label="Theme">
          <h3>Theme</h3>
          <div className="theme-choices" role="radiogroup" aria-label="Theme">
            {THEMES.map((t) => (
              <button key={t} type="button" role="radio" aria-checked={t === theme} onClick={() => pick(t)}>
                <ThemePreview theme={t} />
                {NAME[t]}
              </button>
            ))}
          </div>
          <div className="menu-note">Applies to every Paperboat app</div>
        </div>
      )}
    </span>
  );
}
