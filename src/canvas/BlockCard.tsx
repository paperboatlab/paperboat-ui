// A block's full face (REBRAND; drawn in agent-docs rebrand/apps/simplicial): the same for a card floated over
// its plate, a block unfolded on the canvas and a block with no plate, and (with `object`) a station object or
// joint on the Station's Graph view. Presentational: the app gives its ports (`usePortLayout`), its params
// (`ParamRow`s) and what is happening to it; the head says it in words (`blockTag`). A head of 28 px: the name,
// a linked block's station mark and object id, the note key (on hover or selection; ink with a note), the tag,
// and for a block with a plate its fold key. A running block shows its outline and the spinner, never a
// progress bar; selection is a soft outline.
import type { ReactNode } from "react";
import { Icon } from "../Icon.tsx";
import { Spinner } from "../Spinner.tsx";
import { blockClasses, blockTag, type TagInput } from "./faces.ts";

export function BlockCard({ name, linkedId, note, onNote, fold, onFold, glyph, ports, params, title, selected, ...tag }: TagInput & {
  name: string;
  /** A linked block's station object id (its head shows the station mark and the id). */
  linkedId?: string;
  selected?: boolean;
  /** Its note: the key is ink while there is one. */
  note?: string;
  onNote?: () => void;
  /** A block with a plate: "unfold" puts the card on the canvas, "fold" brings the plate back. */
  fold?: "fold" | "unfold";
  onFold?: () => void;
  /** A glyph block's glyph, faint in the middle of the port body. */
  glyph?: ReactNode;
  /** From `usePortLayout`: the strips above and below, and the rows between. */
  ports: { top?: ReactNode; rows: ReactNode; bottom?: ReactNode };
  /** `ParamRow`s; none: no params section. */
  params?: ReactNode;
  title?: string;
}) {
  const word = blockTag(tag);
  return (
    <div className={blockClasses({ ...tag, selected })} title={title}>
      {ports.top}
      <div className="block-title">
        <span className="block-name">{name}</span>
        {linkedId && <span className="block-link" title={`Linked to station object ${linkedId}`}><Icon name="a-station" />{linkedId}</span>}
        {onNote && (
          <button type="button" className={`block-note nodrag${note ? " has-note" : ""}`} title={note ? `Note: ${note}` : "Add a note"} aria-label={note ? `Edit the note: ${note}` : "Add a note"} onClick={onNote}>
            <Icon name="comment" />
          </button>
        )}
        <span className={`block-tag${tag.state ? ` ${tag.state}` : ""}`}>{tag.state === "running" && <Spinner size={12} />}{word}</span>
        {fold && onFold && (
          <button type="button" className="key quiet sm block-fold nodrag" title={fold === "unfold" ? "Unfold on the canvas; what it covers moves aside" : "Fold back to a plate"} onClick={onFold}>{fold}</button>
        )}
      </div>
      <div className="port-rows">
        {glyph}
        {ports.rows}
      </div>
      {params && <div className="block-params">{params}</div>}
      {ports.bottom}
    </div>
  );
}
