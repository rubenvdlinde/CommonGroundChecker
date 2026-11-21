import { pathStatusLabel, type PathStatus } from "@/lib/pathDocs";
import { CHECKLIST_OUTCOMES, CHECKLIST_SOURCES } from "@/lib/aboutDocs";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SourcesLayout {
  id: string;
  width: number;
  height: number;
  /** Font size in viewBox units, chosen so the text renders at 12px or more where the layout is shown */
  fontSize: number;
  /** Keyed by source id, "checklist" and outcome id */
  boxes: Record<string, Box>;
  /** SVG path data per line: each source joins one line into the checklist, the checklist points at Suitable and Suitable at Maintained */
  edges: Record<string, string>;
}

const LINE_HEIGHT = 17;

export const CHECKLIST_NODE = "checklist";

/** Wide screens: the sources on the left, the checklist in the middle, the levels on the right. */
export const WIDE_SOURCES_LAYOUT: SourcesLayout = {
  id: "wide",
  width: 1040,
  height: 390,
  fontSize: 15,
  boxes: {
    "component-checker": { x: 10, y: 10, width: 400, height: 76 },
    sig: { x: 10, y: 108, width: 400, height: 76 },
    alv: { x: 10, y: 206, width: 400, height: 76 },
    fpc: { x: 10, y: 304, width: 400, height: 76 },
    checklist: { x: 500, y: 157, width: 200, height: 76 },
    suitable: { x: 800, y: 95, width: 230, height: 76 },
    maintained: { x: 800, y: 219, width: 230, height: 76 },
  },
  edges: {
    "component-checker": "M410 48 H455",
    sig: "M410 146 H455",
    alv: "M410 244 H455",
    fpc: "M410 342 H455",
    join: "M455 48 V342 M455 195 H500",
    suitable: "M700 195 H750 V133 H800",
    maintained: "M915 171 V219",
  },
};

/** Narrow screens: the sources in a column, joined on the right, the levels stacked below. */
export const NARROW_SOURCES_LAYOUT: SourcesLayout = {
  id: "narrow",
  width: 320,
  height: 696,
  fontSize: 14,
  boxes: {
    "component-checker": { x: 10, y: 10, width: 260, height: 76 },
    sig: { x: 10, y: 106, width: 260, height: 76 },
    alv: { x: 10, y: 202, width: 260, height: 76 },
    fpc: { x: 10, y: 298, width: 260, height: 76 },
    checklist: { x: 60, y: 406, width: 200, height: 60 },
    suitable: { x: 60, y: 506, width: 200, height: 76 },
    maintained: { x: 60, y: 610, width: 200, height: 76 },
  },
  edges: {
    "component-checker": "M270 48 H295",
    sig: "M270 144 H295",
    alv: "M270 240 H295",
    fpc: "M270 336 H295",
    join: "M295 48 V436 H260",
    suitable: "M160 466 V506",
    maintained: "M160 582 V610",
  },
};

/** Splits a level name over two lines when it does not fit a narrow box. */
function outcomeLines(name: string): string[] {
  if (name.length <= 16) return [name];
  const words = name.split(" ");
  const half = Math.ceil(words.length / 2);
  return [words.slice(0, half).join(" "), words.slice(half).join(" ")];
}

/** Every box with the lines drawn in it, in drawing order. */
export function sourcesNodes(): { id: string; lines: string[]; boldLines: number; status?: PathStatus }[] {
  return [
    ...CHECKLIST_SOURCES.map((source) => ({ id: source.id, lines: source.lines, boldLines: 1, status: source.status })),
    { id: CHECKLIST_NODE, lines: ["The checklist"], boldLines: 1 },
    ...CHECKLIST_OUTCOMES.map((outcome) => {
      const lines = outcomeLines(outcome.name);
      return { id: outcome.id, lines, boldLines: lines.length, status: outcome.status };
    }),
  ];
}

export default function ChecklistSourcesDiagram({ layout, className }: { layout: SourcesLayout; className?: string }) {
  const arrowId = `cg-sources-arrow-${layout.id}`;
  const titleId = `cg-sources-title-${layout.id}`;
  const descId = `cg-sources-desc-${layout.id}`;

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
      className={className}
      data-layout={layout.id}
    >
      <title id={titleId}>Where the checklist comes from</title>
      <desc id={descId}>
        Four sources feed the checklist: Hugo ter Doest&apos;s proposal, the SIG ratings, the Common Ground
        standard v1.0, put to the VNG ALV of 11 December 2026, and the Standard for Public Code. The checklist decides suitable for Common Ground,
        and Maintained follows from suitable. The list below the diagram gives the same as text.
      </desc>
      <defs>
        <marker id={arrowId} viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="fill-gray-500" />
        </marker>
      </defs>

      {Object.entries(layout.edges).map(([id, d]) => (
        <path
          key={id}
          data-edge={id}
          d={d}
          fill="none"
          strokeWidth={1.5}
          markerEnd={layout.boxes[id] && !CHECKLIST_OUTCOMES.some((outcome) => outcome.id === id) ? undefined : `url(#${arrowId})`}
          className="stroke-gray-500"
        />
      ))}

      {sourcesNodes().map((node) => {
        const box = layout.boxes[node.id];
        const rows = node.lines.length + (node.status ? 1 : 0);
        const centerX = box.x + box.width / 2;
        const firstBaseline = box.y + box.height / 2 - ((rows - 1) * LINE_HEIGHT) / 2 + 5;
        return (
          <g key={node.id} data-node={node.id}>
            <rect
              x={box.x}
              y={box.y}
              width={box.width}
              height={box.height}
              rx={10}
              strokeWidth={1.5}
              strokeDasharray={node.status ? "5 3" : undefined}
              className={
                node.status
                  ? "fill-amber-50 stroke-amber-700"
                  : node.id === CHECKLIST_NODE
                    ? "fill-blue-50 stroke-cg-blue"
                    : "fill-white stroke-cg-blue"
              }
            />
            {node.lines.map((line, index) => (
              <text
                key={line}
                x={centerX}
                y={firstBaseline + index * LINE_HEIGHT}
                textAnchor="middle"
                fontSize={layout.fontSize}
                fontWeight={index < node.boldLines ? 600 : 400}
                className="fill-gray-900"
              >
                {line}
              </text>
            ))}
            {node.status && (
              <text
                x={centerX}
                y={firstBaseline + node.lines.length * LINE_HEIGHT}
                textAnchor="middle"
                fontSize={layout.fontSize}
                className="fill-amber-800"
              >
                {pathStatusLabel(node.status)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
