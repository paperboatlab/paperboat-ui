// TeX as HTML (KaTeX), for a note's $…$ and $$…$$ and anything else that shows math. A note may come from
// anyone: `trust` stays off (no \href, no \includegraphics), and a mistake never throws, it shows in red
// with KaTeX's message.
import katex from "katex";

export function mathHtml(tex: string, display = false): string {
  return katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: "ignore", trust: false, output: "htmlAndMathml" });
}

/** Inline math in a line of Markdown: `$x$`, not `$$`, not `\$`, no space just inside the dollars, and not a
 *  price (`$5 and $6`: a closing $ followed by a digit). Groups: 1 the TeX. */
export const INLINE_MATH = /(?<![\\$])\$(?![\s$])((?:\\.|[^$\\\n])+?)(?<!\s)\$(?![\d$])/g;
