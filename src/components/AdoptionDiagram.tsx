import { ADOPTION_EDGES, ADOPTION_NODES, type AdoptionEdge, type AdoptionNode } from "@/lib/aboutDocs";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface EdgeShape {
  /** SVG path data; the arrow head sits on its last point */
  d: string;
  /** Left out where the boxes already say what the edge carries */
  label?: { x: number; y: number; anchor: "start" | "middle" | "end" };
}

export interface AdoptionLayout {
  id: string;
  width: number;
  height: number;
  /** Font size in viewBox units, chosen so the text renders at 12px or more where the layout is shown */
  fontSize: number;
  lineHeight: number;
  boxes: Record<string, Box>;
  /** Keyed by adoptionEdgeKey() */
  edges: Record<string, EdgeShape>;
}

export function adoptionEdgeKey(edge: Pick<AdoptionEdge, "from" | "to">): string {
  return `${edge.from}>${edge.to}`;
}

/** Wide screens: the inputs in a row on top, the process in three columns below. */
export const WIDE_ADOPTION_LAYOUT: AdoptionLayout = {
  id: "wide",
  width: 1040,
  height: 548,
  fontSize: 15,
  lineHeight: 18,
  boxes: {
    checker: { x: 10, y: 10, width: 300, height: 88 },
    board: { x: 370, y: 10, width: 300, height: 88 },
    college: { x: 730, y: 10, width: 300, height: 88 },
    proposal: { x: 10, y: 160, width: 300, height: 88 },
    regie: { x: 370, y: 160, width: 300, height: 88 },
    criteria: { x: 730, y: 160, width: 300, height: 110 },
    "not-adopted": { x: 730, y: 330, width: 300, height: 52 },
    mandate: { x: 370, y: 330, width: 300, height: 70 },
    alv: { x: 10, y: 330, width: 300, height: 70 },
    adopted: { x: 370, y: 450, width: 300, height: 70 },
    after: { x: 730, y: 450, width: 300, height: 88 },
  },
  edges: {
    "checker>regie": { d: "M160 98 V120 H400 V160", label: { x: 280, y: 114, anchor: "middle" } },
    "board>regie": { d: "M520 98 V160", label: { x: 528, y: 145, anchor: "start" } },
    "college>regie": { d: "M880 98 V120 H640 V160", label: { x: 760, y: 114, anchor: "middle" } },
    "proposal>regie": { d: "M310 204 H370" },
    "regie>criteria": { d: "M670 204 H730" },
    "criteria>not-adopted": { d: "M960 270 V330", label: { x: 968, y: 304, anchor: "start" } },
    "criteria>mandate": { d: "M800 270 V300 H520 V330", label: { x: 660, y: 294, anchor: "middle" } },
    "mandate>adopted": { d: "M520 400 V450", label: { x: 528, y: 430, anchor: "start" } },
    "mandate>alv": { d: "M370 365 H310", label: { x: 340, y: 357, anchor: "middle" } },
    "alv>adopted": { d: "M160 400 V485 H370" },
    "adopted>after": { d: "M670 485 H730" },
  },
};

/** Narrow screens: one column, the inputs on top joined on the right, "yes" along the left. */
export const NARROW_ADOPTION_LAYOUT: AdoptionLayout = {
  id: "narrow",
  width: 320,
  height: 1052,
  fontSize: 14,
  lineHeight: 17,
  boxes: {
    checker: { x: 10, y: 10, width: 250, height: 67 },
    board: { x: 10, y: 87, width: 250, height: 67 },
    college: { x: 10, y: 164, width: 250, height: 84 },
    proposal: { x: 10, y: 268, width: 250, height: 84 },
    regie: { x: 10, y: 382, width: 250, height: 67 },
    criteria: { x: 40, y: 479, width: 270, height: 101 },
    "not-adopted": { x: 110, y: 620, width: 200, height: 48 },
    mandate: { x: 40, y: 698, width: 270, height: 50 },
    alv: { x: 110, y: 788, width: 200, height: 50 },
    adopted: { x: 40, y: 878, width: 270, height: 50 },
    after: { x: 40, y: 958, width: 270, height: 84 },
  },
  edges: {
    "checker>regie": { d: "M260 43 H290 V415 H260" },
    "board>regie": { d: "M260 120 H290 V415 H260" },
    "college>regie": { d: "M260 206 H290 V415 H260" },
    "proposal>regie": { d: "M135 352 V382" },
    "regie>criteria": { d: "M135 449 V479" },
    "criteria>not-adopted": { d: "M210 580 V620", label: { x: 218, y: 604, anchor: "start" } },
    "criteria>mandate": { d: "M40 530 H20 V723 H40", label: { x: 26, y: 612, anchor: "start" } },
    "mandate>alv": { d: "M210 748 V788", label: { x: 218, y: 772, anchor: "start" } },
    "mandate>adopted": { d: "M40 723 H20 V903 H40", label: { x: 26, y: 812, anchor: "start" } },
    "alv>adopted": { d: "M210 838 V878" },
    "adopted>after": { d: "M175 928 V958" },
  },
};

const BOX_CLASS: Record<AdoptionNode["kind"], string> = {
  step: "fill-white stroke-cg-blue",
  input: "fill-gray-50 stroke-gray-500",
  decision: "fill-blue-50 stroke-cg-blue",
  end: "fill-white stroke-gray-700",
};

export default function AdoptionDiagram({ layout, className }: { layout: AdoptionLayout; className?: string }) {
  const arrowId = `cg-adoption-arrow-${layout.id}`;
  const titleId = `cg-adoption-title-${layout.id}`;
  const descId = `cg-adoption-desc-${layout.id}`;
  const kindOf = (id: string) => ADOPTION_NODES.find((node) => node.id === id)!.kind;

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
      className={className}
      data-layout={layout.id}
    >
      <title id={titleId}>How a component enters the Common Ground standard</title>
      <desc id={descId}>
        A proposal goes to VNG as regievoerder, which weighs the measurement of the checker, the priorities of the
        VNG board and the College voor Dienstverleningszaken. It then checks the conditions for adoption and the
        mandate. The list below the diagram gives the same steps as text.
      </desc>
      <defs>
        <marker id={arrowId} viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="fill-gray-500" />
        </marker>
      </defs>

      {ADOPTION_EDGES.map((edge) => {
        const key = adoptionEdgeKey(edge);
        const shape = layout.edges[key];
        const dashed = kindOf(edge.from) === "input";
        return (
          <g key={key} data-edge={key}>
            <path
              d={shape.d}
              fill="none"
              strokeWidth={1.5}
              strokeDasharray={dashed ? "5 4" : undefined}
              markerEnd={`url(#${arrowId})`}
              className="stroke-gray-500"
            />
            {edge.label && shape.label && (
              <text
                x={shape.label.x}
                y={shape.label.y}
                textAnchor={shape.label.anchor}
                fontSize={layout.fontSize}
                className="fill-gray-700"
              >
                {edge.label}
              </text>
            )}
          </g>
        );
      })}

      {ADOPTION_NODES.map((node) => {
        const box = layout.boxes[node.id];
        const centerX = box.x + box.width / 2;
        const firstBaseline =
          box.y + box.height / 2 - ((node.lines.length - 1) * layout.lineHeight) / 2 + layout.fontSize * 0.35;
        return (
          <g key={node.id} data-node={node.id}>
            <rect
              x={box.x}
              y={box.y}
              width={box.width}
              height={box.height}
              rx={node.kind === "decision" ? 4 : 10}
              strokeWidth={1.5}
              strokeDasharray={node.kind === "input" ? "5 3" : undefined}
              className={BOX_CLASS[node.kind]}
            />
            {node.lines.map((line, index) => (
              <text
                key={line}
                x={centerX}
                y={firstBaseline + index * layout.lineHeight}
                textAnchor="middle"
                fontSize={layout.fontSize}
                fontWeight={index === 0 ? 600 : 400}
                className="fill-gray-900"
              >
                {line}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}
