// A file's icon and colour by its type (brand.html §11): classic Codicons, our formats and languages in
// their app's muted accent, the rest a muted type colour (--file-* tokens).
import type { IconName } from "../icons.ts";

export type FileTone = "simplicial" | "articula" | "julix" | "malachite" | "folder" | "amber" | "green" | "steel" | "rose" | "slate";

const BY_EXT: Record<string, [IconName, FileTone]> = {
  psf: ["file", "simplicial"], pst: ["file", "simplicial"], mnb: ["notebook", "malachite"],  // our formats: their mark once the marks join the kit
  mo: ["file-code", "articula"], fmu: ["file-zip", "articula"],
  jl: ["file-code", "julix"], py: ["file-code", "steel"],
  toml: ["settings-gear", "slate"], json: ["json", "amber"], csv: ["table", "green"],
  md: ["markdown", "steel"], png: ["file-media", "rose"], jpg: ["file-media", "rose"], svg: ["file-media", "rose"],
  zip: ["file-zip", "slate"],
};

/** The icon and colour for a file or folder. */
export function fileIconFor(name: string, kind: "file" | "folder", open = false): { icon: IconName; tone: FileTone } {
  if (kind === "folder") return { icon: open ? "folder-opened" : "folder", tone: "folder" };
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "";
  const [icon, tone] = BY_EXT[ext] ?? ["file", "slate"];
  return { icon, tone };
}
