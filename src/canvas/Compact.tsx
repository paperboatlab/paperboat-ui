import { Position } from "@xyflow/react";
import { Fragment, useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { isRef } from "./bindings.ts";
import { polynomial } from "./poly.ts";
import { useDismiss } from "../dismiss.tsx";
import { BlockIcon as Icon } from "./BlockIcon.tsx";
import { iconValid, isOn, plateSize } from "./icon.ts";
import { connectorHint, hasIconPorts, placeIconPorts, placePorts, portHint, portLabel, portOffset, sideLength, SIDES, signOf, type PortSides, type Side } from "./ports.ts";
import type { BlockDef, Connectors, IconDef, ParamValue } from "./types.ts";
import { PortHandle } from "./wireSnap.tsx";
import { Spinner } from "../Spinner.tsx";

export function Glyph({ name }: { name: string }) {
  return (
    <svg className="glyph" viewBox="0 0 30 30" aria-hidden="true">
      <text x="15" y="21" textAnchor="middle">
        {name}
      </text>
    </svg>
  );
}

/** A param as the caption shows it: a bound one by its variable's name or formula (#36). */
const show = (v: ParamValue | undefined) =>
  isRef(v) ? ("var" in v ? v.var : `ƒ ${v.expr}`) : typeof v === "number" ? String(+v.toFixed(4)).replace("-", "−") : typeof v === "boolean" ? (v ? "on" : "off") : String(v ?? "");

/**
 * The caption's value: `{k}` and `{min}…{max}` with the block's params filled in. `{den:poly}` reads
 * a param of coefficients as a polynomial, in the block's `domain` param (s or z) when it has one.
 */
export function captionValue(template: string | undefined, params: Record<string, ParamValue>): string {
  return template
    ? template.replace(/\{(\w+)(:poly)?\}/g, (_, id: string, poly?: string) => {
        const v = show(params[id]);
        return poly && !isRef(params[id]) ? polynomial(v, typeof params.domain === "string" ? params.domain : "s") : v;
      })
    : "";
}

/**
 * A simple block as a small plate (#70): a glyph in a box at least 64×56, port dots 16px apart
 * (a side grows to fit them; from 4 on a side their short names show inside), and the block's
 * name and main value as a caption. Double-click (or Enter) floats `card`, the block unfolded,
 * over the plate to inspect and edit it, its port body exactly on the plate's; it closes when the
 * block is deselected, on Escape or a press outside. A variable dragged from the sheet binds on
 * the plate (`dropTake`): taken as is, or the card opens so one of its fields takes it.
 * `word` is what is happening to it (queued, running, cached, failed), said in words and in the outline.
 */
export function CompactBlock({
  id,
  def,
  sides,
  params,
  selected,
  commented,
  word,
  progress,
  card,
  dropTake,
  onTake,
  connectors,
  wires,
  live,
  art,
}: {
  id: string;
  def: BlockDef;
  sides?: PortSides;
  params: Record<string, ParamValue>;
  selected: boolean;
  commented?: boolean;
  word?: "queued" | "running" | "cached" | "failed";
  progress?: number;
  /** The block unfolded, floated over the plate on double-click; none: the plate doesn't open. */
  card?: ReactNode;
  /** What the plate does with what is dragged over it: "take" it as is (`onTake`), "open" the card for a field in it, or nothing. */
  dropTake?: (e: DragEvent) => "take" | "open" | null;
  onTake?: (e: DragEvent) => void;
  /** The block's latest value in a run, for icon primitives drawn `when` it is on or off. */
  live?: unknown;
  /** The catalog's connector classes, for `view.icon.ports`. */
  connectors?: Connectors;
  /** How many wires meet at each icon port (3 or more draw a junction dot). */
  wires?: Record<string, number>;
  /** The app's own drawing of the icon, in place of `view.icon`'s token art; the icon still sizes the plate and places its ports. */
  art?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [over, setOver] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selected) setOpen(false);
  }, [selected]);
  useDismiss(root, () => setOpen(false), { enabled: open });

  const value = captionValue(def.view?.value, params);
  const glyphName = def.view?.glyph ? captionValue(def.view.glyph, params) : "const";
  const icon = iconValid(def.view?.icon) ? def.view?.icon : undefined; // else the plain plate
  const placedPorts = placePorts(def, sides);
  // Inside the 1px border: 54 tall and 62 wide at least, longer as a side's ports need.
  const most = (a: Side, b: Side) => Math.max(placedPorts[a].length, placedPorts[b].length);
  const least = icon ? plateSize(icon) : { w: 64, h: 56 }; // an icon's own size, else the plain plate's
  // An icon with ports of its own places them itself; else the plate grows to fit its ports.
  const size = hasIconPorts(icon) ? least : { w: sideLength(most("top", "bottom"), least.w - 2) + 2, h: sideLength(most("left", "right"), least.h - 2) + 2 };
  const along = { v: size.h - 2, h: size.w - 2 };
  return (
    <div
      ref={root}
      className={["compact-block", `kind-${def.kind}`, selected && "selected", commented && "commented", word && word, open && "open", over && "drop-on"].filter(Boolean).join(" ")}
      onDoubleClick={() => card && setOpen(true)}
      onDragOver={(e) => {
        const take = dropTake?.(e);
        if (take === "open" && card) setOpen(true);
        if (take !== "take") return;
        e.preventDefault();
        e.stopPropagation();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        if (dropTake?.(e) !== "take") return;
        e.preventDefault();
        e.stopPropagation();
        onTake?.(e);
      }}
    >
      <div
        className="plate"
        role="button"
        tabIndex={0}
        aria-expanded={card ? open : undefined}
        aria-label={`${def.label}${value ? ` ${value}` : ""}`}
        style={{ width: size.w, height: size.h }}
        title={card ? "Double-click to inspect and edit" : undefined}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if ((e.key === "Enter" || e.key === " ") && card) setOpen(!open);
        }}
      >
        {icon && art ? art : icon ? <Icon icon={icon} type={def.type} fill={(t) => captionValue(t, params)} on={isOn(live)} /> : <Glyph name={glyphName} />}
        {hasIconPorts(icon) ? (
          <IconPorts icon={icon!} params={params} connectors={connectors} wires={wires} />
        ) : (
          <>
            {SIDES.map((side) => {
              const list = placedPorts[side];
              const isVert = side === "left" || side === "right";
              return (
                <Fragment key={side}>
                  {list.map((e, i) => {
                    const coord = `${portOffset(list.length, i, isVert ? along.v : along.h)}px`;
                    const inputIdx = e.dir === "in" ? def.inputs.findIndex((p) => p.id === e.port.id) : -1;
                    // A sign, else from 4 ports on a side, the port's short name beside its dot.
                    const sign = (inputIdx >= 0 ? signOf(def, params, inputIdx) : "") || (isVert && list.length >= 4 ? e.port.id.slice(0, 3) : "");
                    const signStyle =
                      side === "left"
                        ? { left: 6, top: coord, transform: "translateY(-50%)" }
                        : side === "right"
                          ? { right: 6, top: coord, transform: "translateY(-50%)" }
                          : side === "top"
                            ? { top: 6, left: coord, transform: "translateX(-50%)" }
                            : { bottom: 6, left: coord, transform: "translateX(-50%)" };
                    return (
                      <Fragment key={e.port.id}>
                        <PortHandle
                          type={e.dir === "in" ? "target" : "source"}
                          position={SIDE_POSITION[side]}
                          id={e.port.id}
                          top={isVert ? coord : undefined}
                          left={!isVert ? coord : undefined}
                          label={portLabel(e.port)}
                          title={portHint(e.port)}
                          className={`t-${e.port.type}`}
                        />
                        {sign && (
                          <span className="plate-sign" style={signStyle} aria-hidden="true">
                            {sign}
                          </span>
                        )}
                      </Fragment>
                    );
                  })}
                </Fragment>
              );
            })}
          </>
        )}
        {word === "running" && progress !== undefined && progress < 1 && <i className="plate-prog" style={{ width: `${progress * 100}%` }} />}
      </div>
      <div className="plate-cap">
        <span className={word ? `cap-${word}` : undefined}>{word === "running" && <Spinner size={10} />}{word ?? def.label}</span>
        {value && <span className="plate-val">{value}</span>}
      </div>
      {open && card && (
        <div className="block-float nodrag nowheel" style={{ left: `calc(50% - ${size.w / 2}px)` }} aria-label={`${def.label} ${id}`} onDoubleClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          {card}
        </div>
      )}
    </div>
  );
}

const SIDE_POSITION = { left: Position.Left, right: Position.Right, top: Position.Top, bottom: Position.Bottom } as const;

/**
 * An icon's connector ports (§4): a handle per port in the connector's shape and size, at `side`
 * and `at`. An acausal port has no direction, so it carries a source and a target handle in one
 * place and a wire starts or ends there either way. A port hidden by its `if` keeps an invisible
 * handle so its wires stay. 3 or more wires on a port draw a 4px junction dot.
 */
function IconPorts({ icon, params, connectors, wires }: { icon: IconDef; params: Record<string, ParamValue>; connectors?: Connectors; wires?: Record<string, number> }) {
  return (
    <>
      {placeIconPorts(icon, params).map(({ port, at, hidden, count }) => {
        const c = connectors?.[port.class];
        const along = port.side === "left" || port.side === "right" ? { top: `${at}%` } : { left: `${at}%` };
        const fill = (port.variant ?? c?.alt) === "filled" ? "filled" : "hollow"; // a port's own variant wins over the class's look
        const look = `ip ip-${c?.handle ?? "circle"} ip-${c?.size ?? 8} ip-${fill} k-${c?.kind ?? "output"}${hidden ? " ip-hidden" : ""}`;
        const title = connectorHint(port.id, c);
        const kinds: ("source" | "target")[] = !c || c.kind === "acausal" ? ["source", "target"] : c.kind === "output" ? ["source"] : ["target"];
        return (
          <Fragment key={port.id}>
            {kinds.map((type) => (
              <PortHandle key={type} type={type} position={SIDE_POSITION[port.side]} id={port.id} {...along} label={hidden ? undefined : port.id} title={title} className={look} color={c?.color} />
            ))}
            {count !== undefined && !hidden && (
              <span className={`ip-count side-${port.side}`} style={along} aria-hidden="true">
                {count}
              </span>
            )}
            {(wires?.[port.id] ?? 0) >= 3 && <i className="ip-junction" style={along} data-side={port.side} aria-hidden="true" />}
          </Fragment>
        );
      })}
    </>
  );
}
