// The TUI's spinner (REBRAND "spinner", logogen/src/glyphs.py): the same blintz turn as Spinner, as a font.
/** The TUI's spinner: Paperboat Glyphs U+E000–E007 in this order, one frame every 120 ms. */
export const GLYPH_FRAMES = [0, 1, 2, 3, 4, 5, 5, 6, 7].map((i) => String.fromCodePoint(0xe000 + i));
/** Where the terminal can't map the font. */
export const GLYPH_FALLBACK = ["■", "◩", "◪", "◆", "◈"];
export const GLYPH_FRAME_MS = 120;
