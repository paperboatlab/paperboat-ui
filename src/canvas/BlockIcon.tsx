import { createElement } from "react";
import { iconNodes, plateSize } from "./icon.ts";
import type { IconDef } from "./types.ts";

const camel = (k: string) => k.replace(/-(\w)/g, (_, c: string) => c.toUpperCase()); // stroke-width -> strokeWidth

/** A block's `view.icon` as an SVG sized to its plate; null when it cannot be drawn (the caller draws the plain plate). */
export function BlockIcon({ icon, type, fill, on }: { icon: IconDef | undefined; type?: string; fill?: (s: string) => string; on?: boolean }) {
  const nodes = iconNodes(icon, type, fill, on);
  if (!nodes || !icon) return null;
  const { w, h } = plateSize(icon);
  return (
    <svg className="icon-art" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {nodes.map((n, i) => createElement(n.tag, { key: i, ...Object.fromEntries(Object.entries(n.attrs).map(([k, v]) => [camel(k), v])) }, n.text))}
    </svg>
  );
}
