// Release versions (x.y.z, optionally -pre and a leading v), compared the SemVer way: by number,
// a prerelease before its release. What the package panel offers as an update.
const parse = (v: string) => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(v.trim());
  return m ? { n: [+m[1], +m[2], +m[3]], pre: m[4] ?? "" } : null;
};

/** Above 0 when `a` is newer than `b`; NaN when either is not a release version ("dev", "—"). */
export function compareVersions(a: string, b: string): number {
  const x = parse(a), y = parse(b);
  if (!x || !y) return NaN;
  for (let i = 0; i < 3; i++) if (x.n[i] !== y.n[i]) return x.n[i] - y.n[i];
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1;
  if (!y.pre) return -1;
  return x.pre.localeCompare(y.pre, undefined, { numeric: true });
}

/**
 * What to offer as an update: the newest of `releases` when it is newer than `installed`. An install
 * that is no release (a branch such as "dev", or no version at all) is offered the newest release:
 * nothing says how old it is.
 */
export function newerRelease(installed: string | undefined, releases: readonly string[] = []): string | undefined {
  let best: string | undefined;
  for (const r of releases) if (parse(r) && (!best || compareVersions(r, best) > 0)) best = r;
  if (!best) return undefined;
  return !installed || !parse(installed) || compareVersions(best, installed) > 0 ? best : undefined;
}
