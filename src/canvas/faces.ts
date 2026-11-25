// What a block's head says (DESIGN "State in words", REBRAND): what is happening to it, else what it is. Words,
// never colours alone. Pure, so the card, the plate's caption and an app's lists say the same.

/** What is happening to a block: in a run, or because its type is gone. */
export type BlockState = "running" | "failed" | "queued" | "cached" | "missing";

export type TagInput = {
  kind: string;
  state?: BlockState;
  /** Commented out: "out" skips it, "through" passes its input on (bypass). */
  commented?: "out" | "through";
  linked?: boolean;
  step?: boolean;
  /** A station object or joint (the Station's Graph view). */
  object?: "object" | "joint";
  /** A subsystem or a story (a group with a level inside). */
  group?: "subsystem" | "story";
};

export function blockTag(b: TagInput): string {
  if (b.commented) return b.commented === "through" ? "// bypass" : "// commented";
  if (b.state) return b.state;
  if (b.object) return b.object;
  if (b.group) return b.group;
  if (b.linked) return "linked";
  if (b.step) return "step";
  return b.kind === "function" ? "fn" : b.kind;
}

/** The card's classes: its kind, its state and its look (linked bar, step ink, object square). */
export function blockClasses(b: TagInput & { selected?: boolean }): string {
  return [
    "block",
    `kind-${b.kind}`,
    b.step && "step",
    b.linked && "linked",
    b.object && `object${b.object === "joint" ? " joint" : ""}`,
    b.group && "subsystem",
    b.state,
    b.commented && "commented",
    b.commented === "through" && "comment-through",
    b.selected && "selected",
  ].filter(Boolean).join(" ");
}
