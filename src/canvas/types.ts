// The canvas contract: how a block, its ports, its icon and its connectors are described. Taken from
// Simplicial's protocol (paperboat-shared-legacy src/protocol.ts) so any app's node canvas can use it;
// an app's protocol may extend these shapes, never contradict them.


export type VectorComponent = {
  /** The component's label, in vector order. */
  id: string;
  /** The component's unit (m, rad…). */
  unit?: string;
};

export type PortDef = {
  id: string;
  /** signal (a value, the default), step (control in a Step flow), a value's shape (image, points, vector…), or any (any value but a step). A wire joins ports of one type; vector and legacy numbers are compatible. */
  type: string;
  /** Its unit (N, m, rad, m/s…). A wire between two ports with units joins the same unit; a port without one takes any (#4). */
  unit?: string;
  /** A vector's fixed number of values. Absent: any length. */
  dimension?: number;
  /** A vector's ordered component labels and optional per-component units; its length fixes the dimension. */
  components?: VectorComponent[];
  /** A signal port of an elementwise block: it also joins a vector port (the block runs element by element). Absent: false. */
  broadcast?: boolean;
};

/** A setting on a block, or a property of a station object. number and boolean reach the block as numbers (boolean: a checkbox, 1 or 0); text, key (a KeyboardEvent.code, picked by pressing it) and file (a path, relative to the descriptor) as text; enum (one of options, a dropdown) as its name (and to an expression, its index). */
export type ParamDef = {
  id: string;
  type: "number";
  default: number;
  /** Its unit (kg, N/rad…), shown next to the field; a variable bound to it must be in the same unit. */
  unit?: string;
} | {
  id: string;
  type: "boolean";
  default: boolean;
} | {
  id: string;
  type: "text" | "key" | "file" | "variable" | "matrix";
  default: string;
} | {
  id: string;
  type: "enum";
  default: string;
  options: string[];
};

/** ink = --text, muted = --line-strong, signal = --signal (live state only). */
export type Stroke = "ink" | "muted" | "signal" | "electrical" | "translational" | "thermal" | "fluid" | "magnetic" | "rotational";

/** 1, 1.5 or 2 px. */
export type Weight = "thin" | "normal" | "wire";

/** Never red: dashed red means missing only. */
export type Dash = "solid" | "axis" | "dash" | "dot" | "dashdot";

/** none, --text, --surface-raised, --surface-sunken, --signal, or --surface-screen (the black of a display, the same in light and dark). */
export type Fill = "none" | "ink" | "raised" | "sunken" | "signal" | "screen" | "electrical" | "translational" | "thermal" | "fluid" | "magnetic" | "rotational";

/** md = 5px. */
export type Corner = "0" | "sm" | "md";

/** A point in the icon's 0..100 box, multiples of 5. */
export type Pt = [number, number];

/** One icon primitive (§3). Attribute values are tokens, never colours or paths. */
export type Prim = {
  t: "line";
  p: Pt[];
  stroke?: Stroke;
  weight?: Weight;
  dash?: Dash;
  fill?: Fill;
  when?: When;
} | {
  t: "poly";
  p: Pt[];
  stroke?: Stroke;
  weight?: Weight;
  dash?: Dash;
  fill?: Fill;
  when?: When;
} | {
  t: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  corner?: Corner;
  stroke?: Stroke;
  weight?: Weight;
  dash?: Dash;
  fill?: Fill;
  when?: When;
} | {
  t: "ellipse";
  x: number;
  y: number;
  w: number;
  h: number;
  stroke?: Stroke;
  weight?: Weight;
  dash?: Dash;
  fill?: Fill;
  when?: When;
} | {
  t: "arc";
  x: number;
  y: number;
  w: number;
  h: number;
  a0: number;
  a1: number;
  stroke?: Stroke;
  weight?: Weight;
  dash?: Dash;
  fill?: Fill;
  when?: When;
} | {
  t: "text";
  x: number;
  y: number;
  /** May hold {param}, filled like the caption value. */
  s: string;
  font?: "sans" | "mono";
  size?: 12 | 12.5 | 13 | 15 | 30;
  stroke?: Stroke;
  weight?: Weight;
  dash?: Dash;
  fill?: Fill;
  when?: When;
};

export type IconPort = {
  id: string;
  /** Key into the catalog's connectors. */
  class: string;
  side: "left" | "right" | "top" | "bottom";
  /** 0..100 along the edge, a multiple of 5. */
  at: number;
  /** a/b or p/n side, never state. */
  variant?: "hollow" | "filled";
  /** Param id holding n (the vector port model). */
  array?: string;
  /** Param id; the port exists while it is truthy. */
  if?: string;
};

/** A block's custom look: 1x1 (64x56), 2x1 or 1x2 plates only. */
export type IconDef = {
  w?: 1 | 2;
  h?: 1 | 2;
  g: Prim[];
  ports?: IconPort[];
};

export type ConnectorDef = {
  /** expandable is reserved, not drawn yet. */
  kind: "acausal" | "input" | "output" | "expandable";
  handle: "square" | "diamond" | "ring2" | "triangle" | "circle";
  /** The look the variant swaps to. */
  alt?: "hollow" | "filled";
  size: 8 | 10 | 12;
  weight: 1.2 | 1.8 | 2;
  /** Thermal wires are dashed grey, not red. */
  dash?: "solid" | "dashed";
  /** The connector's own fill, when a user-defined class gives one (#43). */
  color?: string;
  potential?: {
    id: string;
    unit: string;
  }[];
  flow?: {
    id: string;
    unit: string;
  }[];
  stream?: {
    id: string;
    unit: string;
  }[];
};

/** Connector classes the blocks' icon ports refer to (§4), by Modelica class short name. */
export type Connectors = Record<string, ConnectorDef>;

/** What a sheet is (#9): a Signal flow (values flow one way), a Step flow (control passes along step wires), a State flow (transitions between states) or a Model flow (acausal physical connections). */
export type FlowType = "signal" | "step" | "state" | "model";

export type BlockDef = {
  type: string;
  label: string;
  /** source pushes into the domain, probe reads it, function computes, monitor shows a value on the Board. */
  kind: "source" | "probe" | "function" | "monitor";
  inputs: PortDef[];
  outputs: PortDef[];
  params: ParamDef[];
  /** Palette group: the domain for its own blocks, else the toolkit package. */
  group?: string;
  /** Spawned by a station object (same id): not in the palette, no params, removed with it. */
  linked?: boolean;
  /** A monitor's instrument on the Board: graph (default), display (the latest value) or image. */
  instrument?: string;
  /** How the UI draws the block: a hint, so a UI without it (or a block without it) draws the normal card. */
  view?: {
    /** Draw a small plate: a glyph, bare port dots (names on hover), the name and main value in a caption below. */
    compact?: boolean;
    /** The plate's glyph: a curve name (gain, plus, step, clamp, const) or a few characters drawn as text (&, ≥1, ¬). */
    glyph?: string;
    /** The caption's value, an expression of the block's params: {k}, {min}…{max}. */
    value?: string;
    /** Additive icon definition (§3); absent means plain plate. */
    icon?: IconDef;
  };
  /** A magic block's forms; its inputs and outputs are the first's, and its form param (an enum) picks one. */
  forms?: Form[];
  /** The id of a text param that decides the inputs: one per sign character in it (+ adds, - or − subtracts; at most 26; none reads as ++), ids a, b, c… of the first input's type. Sum's signs. A param called names gives one input per name instead (Mux), see outputs_from. */
  ports_from?: string;
  /** The id of a text param whose expression's free names are the inputs: one per identifier in it (other than pi, e and built-in functions, in order of first appearance), of the first input's type. f(t)'s f. */
  inputs_from?: string;
  /** The id of a text param of names (split on spaces and commas: "x v theta") that are the outputs, ids in that order; the first vector input gets one component per name, units by position from a `units` param. Demux's names. (ports_from "names" does the same for the inputs: Mux.) */
  outputs_from?: string;
  /** It works element by element: its signal ports take vectors too (they are marked broadcast), scalars broadcast, and with any vector in, its outputs are vectors of that length, one instance per element. Absent: false. */
  elementwise?: boolean;
  /** false: its outputs this step don't depend on its inputs this step (an integrator, a delay), so a feedback loop may pass through it. Absent: true. */
  feedthrough?: boolean;
  /** One line in plain words: what it does. Shown on its card in the block browser. Optional. */
  description?: string;
  /** The flow types it works in (#9): the palette offers it only on a sheet of one of these, and the engine refuses it on another. Absent: every flow type. */
  flows?: FlowType[];
};

/** A param's value: a number, true / false (a boolean param), or text (text, key and file params). Or a reference (#36): {"var": name} takes a variable's value; {"expr": formula} (number and boolean params) a formula over variables. The station resolves references before it makes blocks and objects. */
export type ParamValue = number | boolean | string | {
  /** A variable's name. */
  var: string;
} | {
  /** A formula over number and boolean variables: + - * / ^ %, comparisons, && || ?:, sqrt, sin, min, clamp… */
  expr: string;
};

/** One form of a magic block: the ports it has in that form (signal: computes; step: branches on a Step flow's path). The block's form param picks one. */
export type Form = {
  name: string;
  inputs: PortDef[];
  outputs: PortDef[];
};

/** Where a block's ports sit on the Flow canvas: the port ids on each side, in order. A port not listed keeps its place (inputs on the left, outputs on the right, after the listed ones). Stations ignore it. */
export type PortSides = {
  left?: string[];
  right?: string[];
  top?: string[];
  bottom?: string[];
};

/** Draw this primitive only while the block's latest value is on (a number above 0.5, or true), or only while it is not (off, and before any value). Absent: always. */
export type When = "on" | "off";
