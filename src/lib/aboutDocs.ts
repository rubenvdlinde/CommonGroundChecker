import {
  PATH_DOC_HREF,
  PATH_SECTIONS,
  RESPONSE_AND_FIX_TIMES,
  RESPONSE_AND_FIX_TIMES_INTRO,
  SLA_TERMS,
  type PathStatus,
  type PathTable,
} from "./pathDocs";

/** The Common Ground standard v1.0, put to the VNG autumn ALV of 11 December 2026. */
export const ALV_STANDARD_URL = "https://vng.nl/sites/default/files/2026-11/08b-bijlage-2-notitie-common-ground-standaard.pdf";

export const ALV_AGENDA_URL = "https://vng.nl/artikelen/agenda-en-stukken-najaars-alv-11-december-2026";

/** The explanation of the Common Ground proposal to the same ALV. */
export const ALV_EXPLANATION_URL =
  "https://vng.nl/sites/default/files/2026-11/08b-bijlage-1-toelichting-op-voorstel-common-ground.pdf";

/** The setup behind the checker, kept in issue #54. */
export const SETUP_ISSUE_URL = "https://github.com/Hugo-ter-Doest/CommonGroundChecker/issues/54";

const SETUP_LINK = { href: SETUP_ISSUE_URL, text: "The setup behind the checker (issue #54)" };

export interface SetupPoint {
  id: string;
  title: string;
  paragraphs: string[];
  items?: string[];
  /** Shown after the items, above the table */
  tableIntro?: string;
  table?: PathTable;
  status?: PathStatus;
  link: { href: string; text: string };
}

function pathSection(id: string) {
  const section = PATH_SECTIONS.find((candidate) => candidate.id === id);
  if (!section) throw new Error(`no path section ${id}`);
  return section;
}

function pathPart(sectionId: string, title: string) {
  const part = pathSection(sectionId).parts?.find((candidate) => candidate.title === title);
  if (!part) throw new Error(`no part ${title} in path section ${sectionId}`);
  return part;
}

function pathLink(id: string) {
  return { href: `${PATH_DOC_HREF}#${id}`, text: `More on the path page: ${pathSection(id).title.toLowerCase()}` };
}

/** A short overview of the setup: the four goals first, then how they are worked out. The path page holds the detail. */
export const SETUP_POINTS: SetupPoint[] = [
  {
    id: "goal-open-space",
    title: "Goal 1: an open space for components",
    paragraphs: [
      "Every organisation can offer its components, and everyone can see them. That shows where initiatives build the same thing, so organisations that work on the same thing find each other. The only condition is that the repository is public.",
      "We want Common Ground and the aspects the checker rates to become part of developer.overheid.nl, together with Developer Overheid. We do not build a catalogue of our own. The checker measures, and the register shows the measurements.",
    ],
    link: SETUP_LINK,
  },
  {
    id: "organisations",
    title: "Who uses which component",
    paragraphs: [
      "A page per organisation shows which components it uses, and per component which organisations use it. The checker reads this from usedBy in the publiccode.yml of every followed component.",
    ],
    status: { kind: "in-development" },
    link: pathLink("usage"),
  },
  {
    id: "goal-better-code",
    title: "Goal 2: helping developers improve their code",
    paragraphs: [
      "The checker gives developers tools on five aspects: repository setup, deployability on Haven, code quality, security and architecture. The tools and the results are both open. A developer sees what to work on, and a buyer sees what they take on. A rating is not a condition for being listed.",
    ],
    link: SETUP_LINK,
  },
  {
    id: "goal-neutral-rating",
    title: "Goal 3: a neutral and clear rating",
    paragraphs: [
      "Everyone should be able to tell in the same way whether a component is good enough to be maintained as part of the Common Ground programme. So the checker gives a neutral rating, with the same criteria and thresholds for every component. That also lets you compare components.",
      "The parts on fair measurement, on suitable for Common Ground and on Maintained work this out.",
    ],
    link: pathLink("levels"),
  },
  {
    id: "goal-trust",
    title: "Goal 4: trust among organisations",
    paragraphs: [
      "A municipality that uses a component from another organisation must be able to trust that the software and the code are good. That trust grows when the measurement is open, the same for everyone, and done again every night.",
      "So the tools are open, anyone can propose a change to the checklist, and the checker watches maintenance.",
    ],
    link: SETUP_LINK,
  },
  {
    id: "three-systems",
    title: pathSection("three-systems").title,
    paragraphs: ["The checker reports three different things. They answer different questions."],
    items: pathSection("three-systems").items,
    status: pathSection("three-systems").status,
    link: pathLink("three-systems"),
  },
  {
    id: "levels",
    title: pathSection("levels").title,
    paragraphs: [
      "Suitable for Common Ground means the checker finds that the component meets the technical conditions, including a valid maintenance contract. It is the threshold the Common Ground programme uses to decide whether to adopt a component as supported. It is not a condition for being listed: a component that is not yet suitable is still listed.",
      "Maintained adds that the software is stable, that at least one organisation is listed as a user under usedBy in publiccode.yml, and that there is a valid SLA with a maintainer, on the VNG model contract. One user follows the Common Ground standard put to the VNG ALV: a component is proven in practice by one or more municipalities.",
    ],
    status: pathSection("levels").status,
    link: pathLink("levels"),
  },
  {
    id: "maintenance",
    title: pathSection("maintenance").title,
    paragraphs: [
      "A maintainer keeps a component at the level the checker measures. Maintenance has three parts: hard criteria that keep passing, KPIs with a target, and fixing bugs. New development is agreed separately.",
      pathPart("maintenance", "What an SLA covers").paragraphs[0],
    ],
    items: SLA_TERMS,
    tableIntro: RESPONSE_AND_FIX_TIMES_INTRO,
    table: RESPONSE_AND_FIX_TIMES,
    status: pathSection("maintenance").status,
    link: pathLink("maintenance"),
  },
  {
    id: "checklist",
    title: pathSection("checklist").title,
    paragraphs: [
      "What the checker measures decides which component is called suitable, so the checklist works as a standard. It changes through the change process of the Common Ground standard. Anyone proposes a change through the issue form. VNG, as regievoerder, organises the input of municipalities and decides within the mandate of the ALV. The VNG board sets the priorities, advised by the Commissie Informatiesamenleving. The College voor Dienstverleningszaken assesses new standards and is the route to national standardisation. A change outside the mandate goes to the ALV. Every version has a number.",
    ],
    status: pathSection("checklist").status,
    link: pathLink("checklist"),
  },
  {
    id: "code-overheid",
    title: "A home at code.overheid.nl",
    paragraphs: [
      "The goals are about trust between governments, so the checker belongs with the government and not on a personal account. code.overheid.nl is the code platform for Dutch government organisations. The community decides whether the checker moves there and who owns it.",
    ],
    status: { kind: "proposed" },
    link: { href: "https://code.overheid.nl", text: "code.overheid.nl" },
  },
];

export interface ChecklistSource {
  id: string;
  title: string;
  text: string;
  /** The short text drawn in the diagram; the first line is bold */
  lines: string[];
  status?: PathStatus;
  links?: { href: string; text: string }[];
}

/** The three sources the checklist rests on. */
export const CHECKLIST_SOURCES: ChecklistSource[] = [
  {
    id: "component-checker",
    title: "Hugo ter Doest's proposal for the original Component Checker",
    text: "It sets what a repository contains: a licence, publiccode.yml, documentation, tests, Docker, Helm, OpenAPI and the other criteria.",
    lines: ["Hugo ter Doest's proposal", "What a repository contains"],
  },
  {
    id: "sig",
    title: "The SIG ratings, as the Common Ground programme currently uses them",
    text: "A component must be ready for certification by SIG and TÜViT. That is why suitable for Common Ground asks at least 4 stars for maintainability, by the estimate. Ready is not certified: certification is a manual assessment by SIG and TÜViT, and the checker only estimates whether a component looks ready for it. Whether adoption into Common Ground needs a SIG certificate is up to VNG as regievoerder. The ALV papers do not ask for one.",
    lines: ["The SIG ratings", "Ready for certification"],
  },
  {
    id: "alv",
    title: "The Common Ground standard v1.0, put to the VNG autumn ALV of 11 December 2026",
    text: "It sets the basisset of components, with their versions. A new component is added only when it contributes to the collective data provision, fits the Common Ground principles, meets the agreed standards and is proven in practice by one or more municipalities. It runs on Haven or Haven+. Supervision and validation services are tasks of VNG as regievoerder. The checker is such a validation service. The ALV decides on 11 December 2026.",
    lines: ["Common Ground standard v1.0", "VNG ALV, 11 December 2026"],
    status: { kind: "proposed" },
    links: [
      { href: ALV_STANDARD_URL, text: "The Common Ground standard v1.0 (PDF)" },
      { href: ALV_AGENDA_URL, text: "Agenda and papers of the ALV of 11 December 2026" },
    ],
  },
];

/** What the checklist decides, with the status of each level. */
export const CHECKLIST_OUTCOMES: { id: string; name: string; status?: PathStatus }[] = [
  { id: "suitable", name: "Suitable for Common Ground", status: pathSection("verdict").status },
  { id: "maintained", name: "Maintained", status: pathPart("levels", "Maintained").status },
];

export const NO_CONDITIONS_OF_OUR_OWN =
  "We only added measurements and tools in line with these sources, for example testing Helm charts through Artifact Hub. We added no conditions of our own.";

/** Shown for information only. None of it counts towards a rating or the verdict. */
export const INFORMATION_ONLY: string[] = [
  "GitHub stars and forks",
  "response times",
  "codebase size in person-years",
  "downloads",
  "users",
  "project health",
];

export interface LifecycleState {
  id: string;
  name: string;
  text: string;
  /** Left out when the checker shows the state already */
  status?: PathStatus;
  /** What happens while a component is in this state, drawn under its box */
  note?: string[];
}

export interface LifecycleTransition {
  /** "any" stands for every other state */
  from: string;
  to: string;
  /** A few words, drawn next to the arrow */
  label: string;
  /** The full condition, for the table */
  text: string;
}

/** The status of a component in the Common Ground programme. */
export const CG_STATES: LifecycleState[] = [
  { id: "listed", name: "Listed", text: "A public repository is in the space of goal 1. Anyone can add one." },
  { id: "measured", name: "Measured", text: "The checker measures it, every night for followed components." },
  {
    id: "suitable",
    name: "Suitable for Common Ground",
    text: "The verdict holds: no mandatory criterion fails, the overall rating is at least 2.5, there is a valid maintenance contract, and the maintainability estimate is at least 4 stars.",
    status: pathSection("verdict").status,
  },
  {
    id: "maintained",
    name: "Maintained",
    text: "Suitable, developmentStatus stable, at least one user listed under usedBy in publiccode.yml, and a valid SLA with a maintainer, on the VNG model contract. The component is in the support of the programme. A drop below a criterion starts a fix term: the maintainer must fix it in time, and the component stays Maintained during the term.",
    status: { kind: "in-development" },
    note: ["A drop starts a fix term:", "the maintainer must fix", "it in time."],
  },
  {
    id: "retired",
    name: "Retired",
    text: "The component is obsolete, or the programme retires it. Its history stays visible.",
    status: { kind: "proposed" },
  },
];

export const CG_TRANSITIONS: LifecycleTransition[] = [
  { from: "listed", to: "measured", label: "measured", text: "The checker measures the component." },
  { from: "measured", to: "suitable", label: "verdict holds", text: "The verdict holds." },
  { from: "suitable", to: "measured", label: "verdict lost", text: "The verdict no longer holds." },
  {
    from: "suitable",
    to: "maintained",
    label: "stable, user, SLA",
    text: "The software is stable, at least one organisation is listed as a user under usedBy, and there is a valid SLA with a maintainer, on the VNG model contract.",
  },
  {
    from: "maintained",
    to: "suitable",
    label: "condition lost",
    text: "The SLA ended, fewer organisations are listed as users than required, developmentStatus went back from stable to beta, development or concept, or a fix term passed without a fix. The verdict still holds. The component can come back.",
  },
  {
    from: "maintained",
    to: "measured",
    label: "verdict lost too",
    text: "A condition of Maintained is lost and the verdict no longer holds either.",
  },
  {
    from: "any",
    to: "retired",
    label: "obsolete or retired",
    text: "developmentStatus becomes obsolete, or the programme retires the component.",
  },
];

/** The developmentStatus values of publiccode.yml, in order. The maintainer sets them. */
export const COMPONENT_STATES: LifecycleState[] = [
  { id: "concept", name: "concept", text: "Only the idea exists." },
  { id: "development", name: "development", text: "The software is being built." },
  { id: "beta", name: "beta", text: "The software is being tested." },
  { id: "stable", name: "stable", text: "The software is ready for use." },
  { id: "obsolete", name: "obsolete", text: "The software is no longer maintained or has been replaced." },
];

/** How a developmentStatus relates to the Common Ground lifecycle. */
export const LIFECYCLE_RELATION: { statuses: string[]; effect: string }[] = [
  {
    statuses: ["concept", "development", "beta"],
    effect: "Can be listed, measured and suitable for Common Ground. Cannot be Maintained.",
  },
  {
    statuses: ["stable"],
    effect: "Can be in any state of the Common Ground lifecycle. Only a stable component can be Maintained. A stable component can still be only suitable, for example without a valid SLA.",
  },
  { statuses: ["obsolete"], effect: "Leads to retired. The history stays visible." },
];

/** What happens to a Maintained component whose developmentStatus leaves stable. */
export const LEAVING_STABLE: { to: string[]; state: string }[] = [
  { to: ["beta", "development", "concept"], state: "suitable" },
  { to: ["obsolete"], state: "retired" },
];

export function stateName(id: string): string {
  if (id === "any") return "Any state";
  const state = CG_STATES.find((candidate) => candidate.id === id);
  if (!state) throw new Error(`no lifecycle state ${id}`);
  return state.name;
}

export interface AdoptionNode {
  id: string;
  /** The text drawn in the box; the first line is bold */
  lines: string[];
  /** step: a step in the process; input: feeds the regievoerder; decision: a question; end: where it ends */
  kind: "step" | "input" | "decision" | "end";
}

export interface AdoptionEdge {
  from: string;
  to: string;
  label?: string;
}

/** How a component enters the Common Ground standard, after the papers for the VNG ALV of 11 December 2026. */
export const ADOPTION_NODES: AdoptionNode[] = [
  { id: "checker", lines: ["The checker", "measures: suitable for", "Common Ground?"], kind: "input" },
  { id: "board", lines: ["VNG board sets priorities", "advised by the Commissie", "Informatiesamenleving"], kind: "input" },
  {
    id: "college",
    lines: ["College voor", "Dienstverleningszaken", "assesses new standards,", "route to national standards"],
    kind: "input",
  },
  { id: "proposal", lines: ["Proposal", "new component or change", "from municipalities,", "suppliers or community"], kind: "step" },
  { id: "regie", lines: ["Regievoerder (VNG)", "assesses on content,", "with municipal input"], kind: "step" },
  {
    id: "criteria",
    lines: [
      "Contributes to the collective",
      "provision, fits the Common",
      "Ground principles, meets the",
      "standards, proven by at least",
      "one municipality?",
    ],
    kind: "decision",
  },
  { id: "not-adopted", lines: ["Not adopted"], kind: "end" },
  { id: "mandate", lines: ["Within mandate and", "financial frame?"], kind: "decision" },
  { id: "alv", lines: ["ALV informed,", "consulted if needed"], kind: "step" },
  { id: "adopted", lines: ["Adopted in the basisset of", "the Common Ground standard"], kind: "step" },
  {
    id: "after",
    lines: ["Runs on Haven or Haven+.", "Municipalities contract the", "maintainer on VNG model", "contracts."],
    kind: "end",
  },
];

export const ADOPTION_EDGES: AdoptionEdge[] = [
  { from: "checker", to: "regie", label: "measurement" },
  { from: "board", to: "regie", label: "priorities" },
  { from: "college", to: "regie", label: "standards" },
  { from: "proposal", to: "regie" },
  { from: "regie", to: "criteria" },
  { from: "criteria", to: "not-adopted", label: "no" },
  { from: "criteria", to: "mandate", label: "yes" },
  { from: "mandate", to: "adopted", label: "yes" },
  { from: "mandate", to: "alv", label: "no" },
  { from: "alv", to: "adopted" },
  { from: "adopted", to: "after" },
];

/** The same flow as text, for the list below the diagram. */
export const ADOPTION_STEPS: string[] = [
  "Anyone proposes a new component or a change: municipalities, suppliers or the community.",
  "VNG, as regievoerder, assesses the proposal on content, with input from municipalities. The measurement of the checker, suitable for Common Ground or not, is one of its inputs. The VNG board sets the priorities, advised by the Commissie Informatiesamenleving. The College voor Dienstverleningszaken assesses new standards and is the route to national standardisation.",
  "A component is adopted only when it contributes to the collective data provision, fits the Common Ground principles, meets the agreed standards and is proven in practice by at least one municipality. Otherwise it is not adopted.",
  "Within the mandate and the financial frame, the component is adopted in the basisset of the Common Ground standard. Outside them, the ALV is informed and consulted if needed before it is adopted.",
  "An adopted component runs on Haven or Haven+. Municipalities contract the maintainer, on the VNG model contracts.",
];

export const ADOPTION_NOTES: string[] = [
  "The regievoerder supervises whether solutions meet the agreed frameworks. Validation services such as the checker belong to that task.",
  "VNG does not contract, build or host. Municipalities contract, on the VNG model contracts and framework agreements.",
  "In June 2027 the ALV decides on the organisation, the tasks and the financing of the regie.",
  "The papers name no SIG certificate as a requirement. Whether one is needed is up to the regievoerder within this process.",
];

export const ADOPTION_STATUS: PathStatus = { kind: "proposed", until: "ALV 11 Dec 2026" };
