// Fuzzy matching for the floating search: every letter of the query in order, case ignored. A letter
// right after the last one, or at a word's start, ranks higher. Returns the matched positions (the
// search draws them in the accent text) and a score (lower is better), or undefined.
const boundary = (t: string, i: number) => i === 0 || /[\s\-_./:]/.test(t[i - 1]);
const subsequence = (q: string, t: string, from: number) => {
  for (const ch of q) { from = t.indexOf(ch, from) + 1; if (!from) return false; }
  return true;
};

export function fuzzy(query: string, text: string): { score: number; at: number[] } | undefined {
  const q = query.toLowerCase().replace(/\s+/g, "");
  const t = text.toLowerCase();
  if (!subsequence(q, t, 0)) return undefined;
  for (let i = t.indexOf(q); q && i >= 0; i = t.indexOf(q, i + 1))  // the query whole, at a word start: best
    if (boundary(t, i)) return { score: 0, at: [...q].map((_, k) => i + k) };
  const at: number[] = [];
  let score = 0;
  for (let k = 0; k < q.length; k++) {
    const prev = at.length ? at[at.length - 1] : -1;
    const rest = q.slice(k + 1);
    let first = -1, start = -1, next = -1;
    for (let j = t.indexOf(q[k], prev + 1); j >= 0; j = t.indexOf(q[k], j + 1)) {
      if (!subsequence(rest, t, j + 1)) break;  // later ones can't fit the rest either
      if (first < 0) first = j;
      if (j === prev + 1 && prev >= 0) { next = j; break; }
      if (start < 0 && boundary(t, j)) start = j;
    }
    const i = next >= 0 ? next : start >= 0 ? start : first;
    score += i === prev + 1 && prev >= 0 ? 0 : boundary(t, i) ? 1 : 3;
    at.push(i);
  }
  return { score, at };
}
