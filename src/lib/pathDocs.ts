import type { DocSource } from "./ratingDocs";
import { TOOLS_DOC_HREF } from "./toolsDocs";

/** Path of the page in the rating guide on how a component becomes a Common Ground component. */
export const PATH_DOC_HREF = "/docs/common-ground-path";

/**
 * Where a part of the path stands: built and in review with its pull request,
 * being built now, or proposed and waiting for a decision by the community.
 */
export type PathStatus =
  | { kind: "in-review"; pr: number }
  | { kind: "in-development" }
  | { kind: "proposed"; until?: string };

export interface PathSection {
  id: string;
  title: string;
  /** Left out when every part of the section is in the checker already */
  status?: PathStatus;
  paragraphs: string[];
  items?: string[];
  /** Parts of the section with a status of their own */
  parts?: PathPart[];
}

export interface PathTable {
  caption: string;
  columns: string[];
  rows: string[][];
}

export interface PathPart {
  title: string;
  status?: PathStatus;
  paragraphs: string[];
  items?: string[];
  table?: PathTable;
  /** Shown below the list and the table */
  notes?: string[];
}

/** The label shown next to a section or part that is not in the checker yet. */
export function pathStatusLabel(status: PathStatus): string {
  switch (status.kind) {
    case "in-review":
      return `In review (#${status.pr})`;
    case "in-development":
      return "In development";
    case "proposed":
      return status.until ? `Proposed (${status.until})` : "Proposed";
  }
}

export const AUDIENCES: { id: string; title: string; text: string }[] = [
  {
    id: "buyer",
    title: "A buyer",
    text: "You want to know if you can use a component with confidence. Look at the verdict and the level. Suitable means the code is good enough and someone maintains it under a contract. Maintained adds that the software is stable, that at least one organisation uses it in practice and that there is a valid SLA with a maintainer, on the VNG model contract.",
  },
  {
    id: "maintainer",
    title: "A maintainer or supplier",
    text: "You want to know what to fix and what you sign up for. Every result says what was measured and what is missing. Maintenance is measured every night against the same criteria, so you know in advance what keeping a component at its level means.",
  },
  {
    id: "municipality",
    title: "A municipality",
    text: "You use components and want a say in what counts. List your organisation under usedBy in the publiccode.yml of a component you use, so it counts towards Maintained. Propose changes to the checklist through the issue form. VNG, as regievoerder, organises the input of municipalities before it decides.",
  },
];

/** The path from a public repository to a Maintained Common Ground component. */
export const PATH_STEPS: string[] = [
  "Publish the component in a public repository with a publiccode.yml.",
  "The checker measures the version you released, not work in progress.",
  "Fix every mandatory criterion and reach an overall rating of at least 2.5.",
  "Make the component maintainable: at least 4 stars for maintainability in the estimate.",
  "Name a maintenance contract in publiccode.yml. The component is now suitable for Common Ground.",
  "Mark the component stable in publiccode.yml. At least one organisation is listed as a user under usedBy, and there is a valid SLA with a maintainer, on the VNG model contract. The component is now Maintained.",
  "Stay there: the checker measures every night, and a drop below a criterion is fixed within the agreed fix term.",
];

/** What an SLA for a Maintained component at least says. A proposal. */
export const SLA_TERMS: string[] = [
  "The maintainer keeps the component above the Suitable for Common Ground level. When it drops below a criterion, the maintainer fixes it within the fix term.",
  "The maintainer meets the response and fix times below, as KPIs.",
];

export const RESPONSE_AND_FIX_TIMES_INTRO =
  "For the KPIs we propose these response and fix times, in working days. Responding is the first reaction of a maintainer. Fixing is a stable release with the solution.";

export const RESPONSE_AND_FIX_TIMES: PathTable = {
  caption: "Proposed response and fix times, in working days",
  columns: ["Report", "Respond", "Fix"],
  rows: [
    ["Critical vulnerability", "1", "7"],
    ["High vulnerability", "2", "30"],
    ["Blocking bug", "2", "10"],
    ["Other bug", "5", "Next release"],
    ["Question or feature request", "10", "No term"],
  ],
};

export const REPORT_KINDS =
  "The checker reads the kind of report from the standard GitHub labels (bug, question, enhancement, documentation) and from published security advisories. A repository does not have to set anything up for this. There is no standard label for a blocking bug, so without such a label every bug counts as an other bug.";

export const PATH_SECTIONS: PathSection[] = [
  {
    id: "version",
    title: "Which version is measured",
    status: { kind: "in-review", pr: 68 },
    paragraphs: [
      "A buyer runs a released version, so the checker measures that version and not the latest commit. It takes the first of these that exists:",
    ],
    items: [
      "the tag that matches softwareVersion in publiccode.yml;",
      "the newest stable release;",
      "the newest stable semver tag, such as 1.4.2 or v1.4.2;",
      "the default branch, with a warning that no released version was found.",
    ],
    parts: [
      {
        title: "Choosing another version",
        paragraphs: [
          "An admin can choose another branch or tag for a component. Every scan records which ref it measured (scannedRef) and which commit (scannedCommit), so a result can always be traced back to the code.",
        ],
      },
    ],
  },
  {
    id: "three-systems",
    title: "Three kinds of result",
    paragraphs: [
      "The checker reports three different things. They answer different questions and must not be mixed up.",
    ],
    items: [
      "Information only: project health, usage and ecosystem, size and the comparison with SonarQube. Shown, never rated, never part of the verdict.",
      "The improvement rating: 1 to 5 stars per aspect, per category and overall. It shows a supplier where a component can improve.",
      "The verdict: suitable for Common Ground or not. It is the threshold the Common Ground programme uses to decide whether to adopt a component as supported. It is not a condition for being listed.",
    ],
  },
  {
    id: "verdict",
    title: "When a component is suitable",
    status: { kind: "in-review", pr: 56 },
    paragraphs: ["A component is suitable for Common Ground when all four of these hold:"],
    items: [
      "no mandatory criterion fails;",
      "the overall rating is at least 2.5;",
      "the maintainability estimate is at least 4 stars, the level at which SIG and TÜViT certify;",
      "publiccode.yml names a valid maintenance contract.",
    ],
    parts: [
      {
        title: "Ready for certification, not certified",
        paragraphs: [
          "The checker does not certify. Certification is a manual assessment by SIG and TÜViT. The checker only estimates whether a component looks ready for it. Whether adoption into Common Ground needs a SIG certificate is up to VNG as regievoerder. The ALV papers do not ask for one.",
        ],
      },
      {
        title: "A valid maintenance contract",
        status: { kind: "in-review", pr: 55 },
        paragraphs: [
          "The criterion Maintenance contract reads maintenance in publiccode.yml. It passes on maintenance.type: contract with at least one contractor that has a name and an until date that has not passed. The types none, internal and community are not a contract. When something is missing or wrong, the checker says exactly what: no name, no end date, an end date that is not a date, an expired contract or an invalid email address.",
        ],
      },
    ],
  },
  {
    id: "levels",
    title: "Two levels: Suitable for Common Ground and Maintained",
    paragraphs: [
      "Suitable for Common Ground means the checker finds that the component meets the technical conditions above. It is the threshold the Common Ground programme uses to decide whether to adopt a component as supported. It is not a condition for being listed: a component that is not yet suitable is still listed.",
    ],
    parts: [
      {
        title: "Maintained",
        status: { kind: "in-development" },
        paragraphs: [
          "A component is Maintained when it is suitable, its developmentStatus in publiccode.yml is stable, at least one organisation is listed as a user under usedBy in publiccode.yml, and there is a valid SLA with a maintainer, on the VNG model contract. A component that leaves stable leaves Maintained and goes back to Suitable for Common Ground. The SLA rests on the hard criteria and the KPIs below. One user follows the Common Ground standard put to the VNG ALV: a component is proven in practice by one or more municipalities. VNG does not contract the maintainer. Municipalities do, on the VNG model contracts and framework agreements.",
        ],
      },
    ],
  },
  {
    id: "maintenance",
    title: "Maintenance made measurable",
    status: { kind: "proposed" },
    paragraphs: [
      "The measurement makes clear what maintenance is. A supplier that maintains a component keeps it at the level the checker measures. Maintenance has three parts:",
    ],
    items: [
      "Hard criteria. Every criterion that passes now keeps passing. When one drops, a fix term applies. Examples: a known vulnerability in a dependency, a missing licence header, maintainability below 4 stars.",
      "KPIs. What has no hard limit gets a target: the response time on issues and pull requests, how reports are handled, and the release frequency. The checker already measures these with the CHAOSS metrics.",
      "Bugs. A fault in existing functionality is maintenance.",
    ],
    parts: [
      {
        title: "Nightly measurement and fix terms",
        status: { kind: "in-development" },
        paragraphs: [
          "The checker measures every followed component every night and reports a drop against the previous measurement. When a component drops below a criterion, the maintainer fixes it within the agreed fix term. Every criterion gets a proposed fix term, and every KPI a proposed target.",
        ],
      },
      {
        title: "What an SLA covers",
        status: { kind: "proposed" },
        paragraphs: ["We propose that an SLA for a Maintained component at least says this:"],
        items: SLA_TERMS,
      },
      {
        title: "Response and fix times",
        status: { kind: "proposed" },
        paragraphs: [RESPONSE_AND_FIX_TIMES_INTRO],
        table: RESPONSE_AND_FIX_TIMES,
        notes: [REPORT_KINDS],
      },
      {
        title: "What is not maintenance",
        paragraphs: [
          "New development is not maintenance. An issue that asks for new or different functionality is development work and is agreed separately.",
          "A component below 4 stars is first made maintainable. Only then can a supplier take it into maintenance on these terms.",
        ],
      },
    ],
  },
  {
    id: "usage",
    title: "Counting usage",
    status: { kind: "in-development" },
    paragraphs: [
      "The checker counts the organisations under usedBy in publiccode.yml. That is the declared number of users. There is no separate confirmation step for now.",
      "Every measurement stores the number, so the history shows whether use grows or shrinks. Usage gives no stars and no ranking. It only counts towards Maintained.",
    ],
  },
  {
    id: "checklist",
    title: "The checklist as a standard",
    paragraphs: [
      "What the checker measures decides which component is called suitable. Buyers, suppliers and municipalities act on it, so the checklist works as a standard. No single person or supplier decides what is in it. It changes through the change process of the Common Ground standard v1.0, put to the VNG autumn ALV of 11 December 2026.",
    ],
    parts: [
      {
        title: "How the checklist changes",
        status: { kind: "proposed" },
        paragraphs: [
          "Propose. Anyone can propose a change: a new criterion, another threshold or another weight. This goes through an issue with a fixed template. The proposal says what changes, why, and which measured components pass or fail because of it.",
          "Consult. VNG, as regievoerder, organises the input of municipalities. The checker shows what the proposal does to the measured components.",
          "Decide. VNG decides as regievoerder, within the mandate the ALV gave it. A change outside that mandate goes to the ALV. Every decision gets a public report: which comments came in and how they were weighed.",
          "Prioritise. The VNG board sets the priorities, advised by the Commissie Informatiesamenleving.",
          "Standardise. The College voor Dienstverleningszaken assesses new standards. It is the route to national standardisation.",
        ],
      },
      {
        title: "Versions and a transition period",
        status: { kind: "in-development" },
        paragraphs: [
          "Every version of the checklist has a number, and every measurement records the version it was measured against. A new mandatory criterion or a stricter threshold gets a transition period. During that period the checker shows it as a warning, not as a fail. A component that is suitable stays suitable until the end of the transition period, so a maintainer has time to fix it.",
        ],
      },
    ],
  },
  {
    id: "governance",
    title: "Who decides that a component is Maintained",
    paragraphs: [
      "Maintained needs more than technology. Under the Common Ground standard, supervision and validation are tasks of VNG as regievoerder. The checker is such a validation service: it shows the outcome. Who sets the fix terms and the targets, and what happens when a maintainer does not meet them, still needs a governance decision. The setup does not make that decision. It refers to it once it exists.",
    ],
  },
];

export const PATH_DOC_SOURCES: DocSource[] = [
  {
    title: "The setup behind the checker (issue #54)",
    url: "https://github.com/Hugo-ter-Doest/CommonGroundChecker/issues/54",
  },
  {
    title: "publiccode.yml, the maintenance section",
    url: "https://publiccodeyml.github.io/v0/schema.core.html#section-maintenance",
  },
  { title: "CHAOSS metrics", url: "https://chaoss.community/kb-metrics-and-metrics-models/" },
  {
    title: "The Common Ground standard v1.0, put to the VNG autumn ALV of 11 December 2026",
    url: "https://vng.nl/sites/default/files/2026-11/08b-bijlage-2-notitie-common-ground-standaard.pdf",
  },
  {
    title: "Agenda and papers of the VNG autumn ALV of 11 December 2026",
    url: "https://vng.nl/artikelen/agenda-en-stukken-najaars-alv-11-december-2026",
  },
];

/** Where the tools page explains the three kinds of result in more detail. */
export const THREE_SYSTEMS_HREF = `${TOOLS_DOC_HREF}#three-systems`;
