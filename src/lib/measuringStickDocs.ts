import type { PathStatus } from "./pathDocs";

/** The page of the basisset, with the version of each component next to the version the checker measured. */
export const BASISSET_PAGE_HREF = "/basisset";

/** Which components provide each functionality, with the overlap and the gaps. */
export const FUNCTIONALITIES_PAGE_HREF = "/functionalities";

/** Two components side by side. */
export const COMPARE_PAGE_HREF = "/compare";

export interface MeasuringStickItem {
  text: string;
  status?: PathStatus;
}

export interface MeasuringStickPart {
  id: string;
  title: string;
  status?: PathStatus;
  paragraphs: string[];
  items?: MeasuringStickItem[];
  /** Shown below the list */
  closing?: string[];
  links?: { href: string; text: string }[];
}

export const MEASURING_STICK_INTRO =
  "The checker is one part of a measuring stick for Common Ground components. This section explains which problem the measuring stick solves, what the checker adds, and where its answer ends.";

/**
 * The measuring stick, from the problem the ALV left open to what the checker does and does not answer.
 * Parts the checker does not show yet carry a status.
 */
export const MEASURING_STICK_PARTS: MeasuringStickPart[] = [
  {
    id: "problem",
    title: "The problem: choices without grounds",
    paragraphs: [
      "The Common Ground ALV asked for two things. Components are taken into maintenance by the programme. And duplication between components is removed.",
      "Both ask for choices. Which component goes into maintenance? Which of two components that do the same thing goes on? Such choices need a framework to weigh components against each other.",
      "That framework is missing, so the choices are not made. What fills the gap is finger pointing, assumptions and judgements about each other's components. None of that is a ground for a decision.",
    ],
  },
  {
    id: "grounds",
    title: "What the checker adds: grounds for a decision",
    paragraphs: [
      "The checker gives the grounds. It is neutral and tied to open source components. It rests on research into the quality of the code and into how the code is used.",
      "Every number comes from a tool, and every weight is published. Nobody can pitch a component. The verdict is neutral, and it is clear.",
      "The checker gives grounds. It does not decide. VNG, as regievoerder, decides, as the ALV papers describe.",
    ],
    links: [{ href: "#adoption", text: "How a component enters the standard" }],
  },
  {
    id: "mapping",
    title: "Mapping standards and functionality",
    paragraphs: [
      "The checker maps per component which standards it supports and what it does. Side by side, the map shows where components overlap. It also shows where a choice must be made, and where one can be made.",
    ],
    items: [
      {
        text: "Standards: read from supports in publiccode.yml and checked against the OpenAPI files in the repository.",
      },
      {
        text: "Functionality: each component on the component list names the GEMMA application services it provides. The functionality map shows which components provide each one, where they overlap and where nothing does.",
      },
      { text: "Filters on standards and functionality on the Components list." },
    ],
    links: [{ href: FUNCTIONALITIES_PAGE_HREF, text: "The functionality map" }],
  },
  {
    id: "comparing",
    title: "Comparing components",
    paragraphs: [
      "Where a choice is made, a comparison page puts components side by side. Per criterion it shows which one scores better, so the choice rests on the same measurements.",
      "The page also shows how far the components overlap. In practice they often overlap only in part. The part that does not overlap can give each component its own right to exist.",
    ],
    links: [{ href: COMPARE_PAGE_HREF, text: "Compare two components" }],
  },
  {
    id: "maintenance",
    title: "What maintenance means",
    status: { kind: "proposed" },
    paragraphs: [
      "Taking a component into maintenance means a regie organisation sees to two things. The checker measures both every night.",
    ],
    items: [
      {
        text: "The code keeps meeting the requirements. So bugs and vulnerabilities that are found get fixed, because a known vulnerability fails a criterion.",
      },
      { text: "The maintainer meets the KPIs on response and fix times." },
    ],
    closing: ["The SLA terms and the response and fix times follow below. The Maintained level is under levels and lifecycle."],
    links: [
      { href: "#setup-maintenance", text: "What an SLA covers, with the response and fix times" },
      { href: "#setup-levels", text: "Suitable for Common Ground and Maintained" },
    ],
  },
  {
    id: "development",
    title: "Further development: a partial answer",
    paragraphs: [
      "The checker answers this question only in part. It shows which functionality and which standards the landscape already has. That maps the gaps and the overlap. Organisations that commission development can steer on it.",
      "It also gives a measuring stick to build towards. A component that meets it is suitable for Common Ground, then Maintained. That is what a basis component needs. Whether it enters the basisset, VNG decides as regievoerder.",
      "What gets built stays the choice of the organisations that pay for it.",
    ],
    links: [
      { href: BASISSET_PAGE_HREF, text: "The basisset, next to what the checker measured" },
      { href: "#setup-levels", text: "What Maintained asks" },
    ],
  },
];
