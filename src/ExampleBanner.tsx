// An example's window: Julix's read-only line (before julix#40), moved here for every app (paperboat#75).
// `paperboat example open` opens an example where it is and tells the page so in its URL; the apps keep it
// read-only (malachite#73, julix#45, articula#57), so the line says so, and Copy (the app's
// `paperboat example copy <id> --to <folder> --open`) is how to change it. It sits in the bay like a panel:
// the kit's raised surface, line and --radius-lg, as the toasts and pills; the app gives it its place.
import { Icon } from "./Icon.tsx";
import { Key } from "./Key.tsx";

/** The line at the top of an example's bay: it is read-only; copy it to `folder` (none: `onCopy` asks where) to change it. */
export function ExampleBanner({ name, folder, onCopy }: {
  name: string;
  folder?: string;
  /** @deprecated An example from the cache is read-only like any other: the line is the same. */
  cache?: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="example-banner" role="note" aria-label={`${name}: an example`}>
      <p><Icon name="lock" className="example-banner-mark" /><b>{name}</b> <span>This example is read-only. Copy it to make changes.</span></p>
      <Key size="sm" icon="copy" title={folder ? `Copy ${name} to ${folder} and open the copy` : `Copy ${name} to a folder and open the copy`} onClick={onCopy}>
        <span>{folder ? `Copy to ${folder}` : "Copy to a folder…"}</span>
      </Key>
    </div>
  );
}
