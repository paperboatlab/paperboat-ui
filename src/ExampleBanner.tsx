// An example's window: Julix's read-only line (before julix#40), moved here for every app (paperboat#75).
// `paperboat example open` opens an example where it is and tells the page so in its URL; Copy is the app's
// `paperboat example copy <id> --to <folder> --open`.

/** The line at the top of an example's bay: run it as it is, or copy it to `folder` (none: `onCopy` asks where). */
export function ExampleBanner({ name, folder, cache, onCopy }: { name: string; folder?: string; cache?: boolean; onCopy: () => void }) {
  return (
    <div className="example-banner" role="note">
      {name}: an example. Run it as it is, or{" "}
      <button type="button" onClick={onCopy}>{folder ? `copy it to ${folder}` : "copy it to a folder…"}</button> to change it.
      {cache && " Changes here aren't kept."}
    </div>
  );
}
