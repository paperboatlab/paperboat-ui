import type { Language } from "../../language.ts";

/** Anything else: no colours, no checks. */
export const plaintext: Language = { id: "plaintext", label: "Plain text", extensions: ["txt", "log"], grammar: () => [] };
