// The interface scale (Settings › General, REBRAND "Settings"): one setting for every Paperboat app, kept
// beside the theme in $PAPERBOAT_HOME/settings.json (`scale`). The app passes the setting in (useScale) and
// saves the choice itself, as it does the theme.
import { useEffect } from "react";

export type Scale = 0.75 | 1 | 1.25;
export const SCALES: readonly Scale[] = [0.75, 1, 1.25];
export const isScale = (v: unknown): v is Scale => SCALES.includes(v as Scale);

type Zooms = { setZoom?(factor: number): void };
const zooms = (): Zooms | undefined => (typeof window === "undefined" ? undefined : (window as { paperboatWindow?: Zooms }).paperboatWindow);

/**
 * Shows the page at `scale`. A Paperboat window zooms itself (`paperboatWindow.setZoom`): the page's layout
 * sees a real smaller or larger viewport. A browser tab takes CSS `zoom` on <html>, and `--page-zoom` for the
 * styles that size by the viewport (`calc(100vh / var(--page-zoom, 1))`).
 */
export function applyScale(scale: Scale, root: { style: CSSStyleDeclaration } = document.documentElement, w = zooms()) {
  const css = w?.setZoom ? 1 : scale;
  w?.setZoom?.(scale);
  root.style.zoom = css === 1 ? "" : String(css);
  if (css === 1) root.style.removeProperty("--page-zoom");
  else root.style.setProperty("--page-zoom", String(css));
}

/**
 * The CSS zoom on the page (a browser tab not at Default), else 1. A point from an event or a rect is in the
 * screen's pixels: divide it by this before it becomes a `left` or `top` inside the page.
 */
export const pageZoom = () => (typeof document === "undefined" ? 1 : Number(document.documentElement.style.zoom) || 1);

/** Applies the scale at start and on every change. */
export function useScale(scale: Scale) {
  useEffect(() => { applyScale(scale); }, [scale]);
}
