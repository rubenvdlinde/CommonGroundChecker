import { pathStatusLabel } from "@/lib/pathDocs";
import { CG_STATES, CG_TRANSITIONS, stateName, type LifecycleTransition } from "@/lib/aboutDocs";

interface Box {
  x: number;
  y: number;
}

interface Edge {
  /** SVG path data; the arrow head sits on its last point */
  d: string;
  label: { x: number; y: number; anchor: "start" | "middle" | "end"; rotate?: boolean };
}

export interface DiagramLayout {
  id: string;
  width: number;
  height: number;
  boxWidth: number;
  /** Font sizes in viewBox units, chosen so the text renders at 12px or more where the layout is shown */
  nameSize: number;
  labelSize: number;
  boxes: Record<string, Box>;
  /** Keyed by transitionKey() */
  edges: Record<string, Edge>;
  /** Where the note of a state starts: the first baseline, left-aligned unless anchored */
  note: { x: number; y: number; anchor?: "start" | "middle" };
}

const BOX_HEIGHT = 64;
const LINE_HEIGHT = 17;

export function transitionKey(transition: Pick<LifecycleTransition, "from" | "to">): string {
  return `${transition.from}>${transition.to}`;
}

/** Wide screens: the states in a row, the way back below them, retired at the bottom. */
export const WIDE_LAYOUT: DiagramLayout = {
  id: "wide",
  width: 1040,
  height: 352,
  boxWidth: 140,
  nameSize: 14,
  labelSize: 15,
  boxes: {
    listed: { x: 10, y: 50 },
    measured: { x: 260, y: 50 },
    suitable: { x: 510, y: 50 },
    maintained: { x: 760, y: 50 },
    retired: { x: 510, y: 278 },
  },
  edges: {
    "listed>measured": { d: "M150 82 H260", label: { x: 205, y: 40, anchor: "middle" } },
    "measured>suitable": { d: "M400 70 H510", label: { x: 455, y: 40, anchor: "middle" } },
    "suitable>measured": { d: "M510 96 H400", label: { x: 455, y: 132, anchor: "middle" } },
    "suitable>maintained": { d: "M650 70 H760", label: { x: 705, y: 40, anchor: "middle" } },
    "maintained>suitable": { d: "M760 96 H650", label: { x: 705, y: 132, anchor: "middle" } },
    "maintained>measured": { d: "M790 114 V196 H330 V114", label: { x: 560, y: 214, anchor: "middle" } },
    "any>retired": { d: "M10 258 H1030 M580 258 V278", label: { x: 580, y: 250, anchor: "middle" } },
  },
  note: { x: 806, y: 140 },
};

/** Narrow screens: the states in a column, the long way back along the right. */
export const NARROW_LAYOUT: DiagramLayout = {
  id: "narrow",
  width: 320,
  height: 574,
  boxWidth: 140,
  nameSize: 14,
  labelSize: 14,
  boxes: {
    listed: { x: 90, y: 10 },
    measured: { x: 90, y: 110 },
    suitable: { x: 90, y: 210 },
    maintained: { x: 90, y: 310 },
    retired: { x: 90, y: 500 },
  },
  edges: {
    "listed>measured": { d: "M160 74 V110", label: { x: 167, y: 96, anchor: "start" } },
    "measured>suitable": { d: "M145 174 V210", label: { x: 138, y: 196, anchor: "end" } },
    "suitable>measured": { d: "M175 210 V174", label: { x: 182, y: 196, anchor: "start" } },
    "suitable>maintained": { d: "M145 274 V310", label: { x: 138, y: 296, anchor: "end" } },
    "maintained>suitable": { d: "M175 310 V274", label: { x: 182, y: 296, anchor: "start" } },
    "maintained>measured": { d: "M230 342 H302 V142 H230", label: { x: 315, y: 242, anchor: "middle", rotate: true } },
    "any>retired": { d: "M10 470 H310 M160 470 V500", label: { x: 160, y: 462, anchor: "middle" } },
  },
  note: { x: 160, y: 396, anchor: "middle" },
};

/** Splits a long state name over two lines. */
export function nameLines(name: string): string[] {
  if (name.length <= 16) return [name];
  const words = name.split(" ");
  const half = Math.ceil(words.length / 2);
  return [words.slice(0, half).join(" "), words.slice(half).join(" ")];
}

function edgeLabel(transition: LifecycleTransition): string {
  return transition.from === "any" ? `${stateName("any")}: ${transition.label}` : transition.label;
}

export default function LifecycleDiagram({ layout, className }: { layout: DiagramLayout; className?: string }) {
  const arrowId = `cg-lifecycle-arrow-${layout.id}`;
  const titleId = `cg-lifecycle-title-${layout.id}`;
  const descId = `cg-lifecycle-desc-${layout.id}`;

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
      className={className}
      data-layout={layout.id}
    >
      <title id={titleId}>The Common Ground lifecycle</title>
      <desc id={descId}>
        Five states from listed to retired, with the transitions between them and a note on Maintained. The list
        and the table below the diagram give the same states, transitions and note as text.
      </desc>
      <defs>
        <marker id={arrowId} viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="fill-gray-500" />
        </marker>
      </defs>

      {CG_TRANSITIONS.map((transition) => {
        const key = transitionKey(transition);
        const edge = layout.edges[key];
        const { x, y, anchor, rotate } = edge.label;
        return (
          <g key={key} data-transition={key}>
            <path
              d={edge.d}
              fill="none"
              strokeWidth={1.5}
              strokeDasharray={transition.from === "any" ? "5 4" : undefined}
              markerEnd={`url(#${arrowId})`}
              className="stroke-gray-500"
            />
            <text
              x={x}
              y={y}
              textAnchor={anchor}
              transform={rotate ? `rotate(-90 ${x} ${y})` : undefined}
              fontSize={layout.labelSize}
              className="fill-gray-700"
            >
              {edgeLabel(transition)}
            </text>
          </g>
        );
      })}

      {CG_STATES.map((state) => {
        const box = layout.boxes[state.id];
        const lines = nameLines(state.name);
        const rows = lines.length + (state.status ? 1 : 0);
        const centerX = box.x + layout.boxWidth / 2;
        const firstBaseline = box.y + BOX_HEIGHT / 2 - ((rows - 1) * LINE_HEIGHT) / 2 + 4;
        return (
          <g key={state.id} data-state={state.id}>
            <rect
              x={box.x}
              y={box.y}
              width={layout.boxWidth}
              height={BOX_HEIGHT}
              rx={10}
              strokeWidth={1.5}
              strokeDasharray={state.status ? "5 3" : undefined}
              className={state.status ? "fill-amber-50 stroke-amber-700" : "fill-white stroke-cg-blue"}
            />
            {lines.map((line, index) => (
              <text
                key={line}
                x={centerX}
                y={firstBaseline + index * LINE_HEIGHT}
                textAnchor="middle"
                fontSize={layout.nameSize}
                fontWeight={600}
                className="fill-gray-900"
              >
                {line}
              </text>
            ))}
            {state.note?.map((line, index) => (
              <text
                key={line}
                x={layout.note.x}
                y={layout.note.y + index * (layout.labelSize + 3)}
                textAnchor={layout.note.anchor ?? "start"}
                fontSize={layout.labelSize}
                fontStyle="italic"
                className="fill-gray-700"
                data-note={state.id}
              >
                {line}
              </text>
            ))}
            {state.status && (
              <text
                x={centerX}
                y={firstBaseline + lines.length * LINE_HEIGHT}
                textAnchor="middle"
                fontSize={layout.labelSize}
                className="fill-amber-800"
              >
                {pathStatusLabel(state.status)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
