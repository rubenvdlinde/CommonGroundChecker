import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import AddComponentPanel from "@/components/AddComponentPanel";
import CheckerHome from "@/components/CheckerHome";
import AdoptionDiagram, { NARROW_ADOPTION_LAYOUT, WIDE_ADOPTION_LAYOUT } from "@/components/AdoptionDiagram";
import ChecklistSourcesDiagram, { NARROW_SOURCES_LAYOUT, WIDE_SOURCES_LAYOUT } from "@/components/ChecklistSourcesDiagram";
import DocTable from "@/components/DocTable";
import LifecycleDiagram, { NARROW_LAYOUT, WIDE_LAYOUT } from "@/components/LifecycleDiagram";
import SourcesDiagram from "@/components/SourcesDiagram";
import StatusBadge from "@/components/StatusBadge";
import {
  ADOPTION_NOTES,
  ADOPTION_STATUS,
  ADOPTION_STEPS,
  ALV_EXPLANATION_URL,
  ALV_STANDARD_URL,
  CG_STATES,
  CG_TRANSITIONS,
  CHECKLIST_OUTCOMES,
  CHECKLIST_SOURCES,
  COMPONENT_STATES,
  INFORMATION_ONLY,
  LEAVING_STABLE,
  LIFECYCLE_RELATION,
  NO_CONDITIONS_OF_OUR_OWN,
  PUBLICCODE_YML_STANDARD_URL,
  SETUP_POINTS,
  stateName,
} from "@/lib/aboutDocs";
import {
  ABOUT_COMMON_GROUND,
  ABOUT_REFERENCES,
  ABOUT_SECTIONS,
  ABOUT_SITE_LINKS,
  BASISSET_TEXT,
  CRITERIA_SOURCES_INTRO,
  OWN_ADDITIONS,
  PRINCIPLE,
  PUBLICCODE_BASIS,
  PUBLICCODE_NOT_READ,
  PUBLICCODE_USES,
  RATING_TEXT,
  RUN_TEXT,
  SOURCES_DIAGRAM_INTRO,
  WHAT_IT_IS,
  type AboutBlock,
} from "@/lib/aboutStructure";
import { CRITERIA_DOC_HREF } from "@/lib/criterionDocs";
import { IS_STATIC_SITE } from "@/lib/dataSource/mode";
import { BASISSET_PAGE_HREF, MEASURING_STICK_INTRO, MEASURING_STICK_PARTS } from "@/lib/measuringStickDocs";
import { PATH_DOC_HREF, PATH_SECTIONS } from "@/lib/pathDocs";
import { PUBLICCODE_PROFILE_PATH } from "@/lib/publiccodeProfile";
import { sourcesDiagramData } from "@/lib/sourcesDiagram";
import { TOOLS_DOC_HREF } from "@/lib/toolsDocs";

export const metadata: Metadata = {
  title: "About | Common Ground Component Checker",
};

const CARD = "bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4 scroll-mt-6";
const H2 = "text-2xl font-bold text-cg-blue";
const H3 = "text-lg font-semibold text-gray-800";
const BLOCK = "space-y-2 scroll-mt-6";
const TEXT = "text-gray-700";
const LINK = "text-cg-lightblue hover:underline";

function SetupLink({ href, text }: { href: string; text: string }) {
  if (href.startsWith("/") || href.startsWith("#")) {
    return (
      <Link href={href} className={LINK}>
        {text}
      </Link>
    );
  }
  return (
    <a href={href} className={LINK} rel="noopener noreferrer">
      {text}
    </a>
  );
}

function Paragraphs({ texts }: { texts: string[] }) {
  return (
    <>
      {texts.map((text) => (
        <p key={text} className={TEXT}>
          {text}
        </p>
      ))}
    </>
  );
}

function SetupBlock({ id }: { id: string }) {
  const point = SETUP_POINTS.find((candidate) => candidate.id === id);
  if (!point) throw new Error(`no setup point ${id}`);
  return (
    <div id={`setup-${point.id}`} className={BLOCK}>
      <h3 className={H3}>
        {point.title}
        <StatusBadge status={point.status} />
      </h3>
      <Paragraphs texts={point.paragraphs} />
      {point.items && (
        <ul className={`list-disc pl-6 space-y-1 ${TEXT}`}>
          {point.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {point.tableIntro && <p className={TEXT}>{point.tableIntro}</p>}
      {point.table && <DocTable table={point.table} />}
      <p className="text-sm">
        <SetupLink {...point.link} />
      </p>
    </div>
  );
}

function StickBlock({ id }: { id: string }) {
  const part = MEASURING_STICK_PARTS.find((candidate) => candidate.id === id);
  if (!part) throw new Error(`no measuring stick part ${id}`);
  return (
    <div id={`measuring-stick-${part.id}`} className={BLOCK}>
      <h3 className={H3}>
        {part.title}
        <StatusBadge status={part.status} />
      </h3>
      <Paragraphs texts={part.paragraphs} />
      {part.items && (
        <ul className={`list-disc pl-6 space-y-1 ${TEXT}`}>
          {part.items.map((item) => (
            <li key={item.text}>
              {item.text}
              <StatusBadge status={item.status} />
            </li>
          ))}
        </ul>
      )}
      {part.closing && <Paragraphs texts={part.closing} />}
      {part.links && (
        <ul aria-label={`Read more: ${part.title}`} className="space-y-1 text-sm">
          {part.links.map((link) => (
            <li key={link.href}>
              <SetupLink {...link} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChecklistSources() {
  return (
    <div className={BLOCK}>
      <p className={TEXT}>{CRITERIA_SOURCES_INTRO}</p>
      <ChecklistSourcesDiagram layout={WIDE_SOURCES_LAYOUT} className="hidden lg:block w-full h-auto" />
      <ChecklistSourcesDiagram layout={NARROW_SOURCES_LAYOUT} className="lg:hidden block w-full max-w-sm h-auto mx-auto" />
      <h3 id="checklist-sources-list-heading" className={H3}>
        The four sources
      </h3>
      <ol aria-labelledby="checklist-sources-list-heading" className={`list-decimal pl-6 space-y-2 ${TEXT}`}>
        {CHECKLIST_SOURCES.map((source) => (
          <li key={source.id} id={`source-${source.id}`}>
            <span className="font-semibold text-gray-800">{source.title}.</span> {source.text}
            <StatusBadge status={source.status} />
            {source.links?.map((link) => (
              <span key={link.href} className="block text-sm">
                <a href={link.href} target="_blank" rel="noopener noreferrer" className={LINK}>
                  {link.text}
                </a>
              </span>
            ))}
          </li>
        ))}
      </ol>
      <p className={TEXT}>
        The checklist feeds two levels:{" "}
        {CHECKLIST_OUTCOMES.map((outcome, index) => (
          <span key={outcome.id}>
            {index > 0 && " and "}
            {outcome.name}
            <StatusBadge status={outcome.status} />
          </span>
        ))}
        .
      </p>
    </div>
  );
}

function SourcesAndMeasurements() {
  return (
    <div id="sources-and-measurements" className={BLOCK}>
      <h3 className={H3}>Sources and measurements</h3>
      <p className={TEXT}>{SOURCES_DIAGRAM_INTRO}</p>
      <SourcesDiagram data={sourcesDiagramData()} />
      <p className="text-sm">
        <Link href={CRITERIA_DOC_HREF} className={LINK}>
          Every criterion, with its source and its tool
        </Link>
      </p>
    </div>
  );
}

function OwnAdditions() {
  return (
    <div className={BLOCK}>
      <h3 id="information-only-heading" className={H3}>
        Our own additions, shown for information only
      </h3>
      <p className={TEXT}>{OWN_ADDITIONS}</p>
      <p className={TEXT}>The checker also shows information that rates nothing. It never counts towards a rating or the verdict:</p>
      <ul aria-labelledby="information-only-heading" className={`list-disc pl-6 space-y-1 ${TEXT}`}>
        {INFORMATION_ONLY.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className={TEXT}>
        The number of organisations listed under usedBy in publiccode.yml counts only towards the verdict: Suitable for
        Common Ground needs at least 2.
      </p>
    </div>
  );
}

function PubliccodeBasis() {
  return (
    <div className={BLOCK}>
      <Paragraphs texts={PUBLICCODE_BASIS} />
      <div className="overflow-x-auto">
        <table className={`w-full text-sm text-left ${TEXT}`}>
          <caption className="sr-only">Which parts of the checker read which publiccode.yml fields</caption>
          <thead className="border-b border-gray-200 text-gray-800">
            <tr>
              <th scope="col" className="py-2 pr-3">
                What reads it
              </th>
              <th scope="col" className="py-2">
                publiccode.yml fields
              </th>
            </tr>
          </thead>
          <tbody>
            {PUBLICCODE_USES.map((use) => (
              <tr key={use.feature} className="border-b border-gray-100 align-top">
                <th scope="row" className="py-2 pr-3 font-normal">
                  {use.href ? <SetupLink href={use.href} text={use.feature} /> : use.feature}
                </th>
                <td className="py-2 font-mono text-xs sm:text-sm break-words">{use.fields}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={TEXT}>{PUBLICCODE_NOT_READ}</p>
      <p className="text-sm space-x-4">
        <Link href={PUBLICCODE_PROFILE_PATH} className={LINK}>
          The Common Ground profile of publiccode.yml
        </Link>
        <a href={PUBLICCODE_YML_STANDARD_URL} className={LINK} rel="noopener noreferrer">
          The publiccode.yml standard
        </a>
      </p>
    </div>
  );
}

function ChecklistVersions() {
  const part = PATH_SECTIONS.find((section) => section.id === "checklist")?.parts?.find(
    (candidate) => candidate.title === "Versions and a transition period",
  );
  if (!part) throw new Error("no checklist versions part");
  return (
    <div id="checklist-versions" className={BLOCK}>
      <h3 className={H3}>
        Checklist versions
        <StatusBadge status={part.status} />
      </h3>
      <Paragraphs texts={part.paragraphs} />
      <p className="text-sm">
        <Link href={CRITERIA_DOC_HREF} className={LINK}>
          The criteria and the version that introduced each
        </Link>
      </p>
    </div>
  );
}

function CommonGroundLifecycle() {
  return (
    <div id="common-ground-lifecycle" className={BLOCK}>
      <h3 id="common-ground-lifecycle-heading" className={H3}>
        The Common Ground lifecycle
      </h3>
      <p className={TEXT}>
        A component has its own lifecycle in the Common Ground programme. It is separate from the lifecycle of the
        software. A component can move into the support of the programme and out of it again. The checker shows the
        state of every component on its page, on the Components list and on the Users pages.
      </p>
      <LifecycleDiagram layout={WIDE_LAYOUT} className="hidden lg:block w-full h-auto" />
      <LifecycleDiagram layout={NARROW_LAYOUT} className="lg:hidden block w-full max-w-sm h-auto mx-auto" />
      <h4 id="common-ground-states-heading" className="font-semibold text-gray-800">
        The states
      </h4>
      <ol aria-labelledby="common-ground-states-heading" className={`list-decimal pl-6 space-y-2 ${TEXT}`}>
        {CG_STATES.map((state) => (
          <li key={state.id}>
            <span className="font-semibold text-gray-800">{state.name}.</span> {state.text}
            <StatusBadge status={state.status} />
          </li>
        ))}
      </ol>
      <h4 id="common-ground-transitions-heading" className="font-semibold text-gray-800">
        The transitions
      </h4>
      <div className="overflow-x-auto">
        <table aria-labelledby="common-ground-transitions-heading" className={`w-full text-sm text-left ${TEXT}`}>
          <thead className="border-b border-gray-200 text-gray-800">
            <tr>
              <th scope="col" className="py-2 pr-3">From</th>
              <th scope="col" className="py-2 pr-3">To</th>
              <th scope="col" className="py-2">When</th>
            </tr>
          </thead>
          <tbody>
            {CG_TRANSITIONS.map((transition) => (
              <tr key={`${transition.from}>${transition.to}`} className="border-b border-gray-100 align-top">
                <td className="py-2 pr-3">{stateName(transition.from)}</td>
                <td className="py-2 pr-3">{stateName(transition.to)}</td>
                <td className="py-2">{transition.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComponentLifecycle() {
  return (
    <div id="component-lifecycle" className={BLOCK}>
      <h3 className={H3}>The component lifecycle</h3>
      <p className={TEXT}>
        The software itself follows developmentStatus in publiccode.yml. The maintainer sets it. It moves in one
        direction, from concept to obsolete.
      </p>
      <ol aria-label="developmentStatus in publiccode.yml, in order" className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:items-stretch">
        {COMPONENT_STATES.map((state, index) => (
          <li key={state.id} className="flex flex-col sm:flex-row items-center sm:flex-1">
            {index > 0 && (
              <span aria-hidden="true" className="text-gray-500 px-1">
                <span className="sm:hidden">↓</span>
                <span className="hidden sm:inline">→</span>
              </span>
            )}
            <div className="w-full rounded-lg border border-cg-blue bg-white p-2 text-center">
              <span className="block font-mono font-semibold text-gray-900">{state.name}</span>
              <span className="block text-xs text-gray-700">{state.text}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function LifecyclesRelation() {
  return (
    <div id="lifecycles-relation" className={BLOCK}>
      <h3 className={H3}>How the two relate</h3>
      <p className={TEXT}>
        The two lifecycles are separate. The maintainer decides the developmentStatus. The programme decides the status
        in Common Ground. They meet at one rule: only a stable component can be suitable for Common Ground or
        Maintained. A stable component can still be only suitable, for example without a valid SLA. An obsolete
        component leads to retired.
      </p>
      <div className="overflow-x-auto">
        <table className={`w-full text-sm text-left ${TEXT}`}>
          <thead className="border-b border-gray-200 text-gray-800">
            <tr>
              <th scope="col" className="py-2 pr-3">developmentStatus</th>
              <th scope="col" className="py-2">In the Common Ground lifecycle</th>
            </tr>
          </thead>
          <tbody>
            {LIFECYCLE_RELATION.map((row) => (
              <tr key={row.statuses.join()} className="border-b border-gray-100 align-top">
                <td className="py-2 pr-3 font-mono">{row.statuses.join(", ")}</td>
                <td className="py-2">{row.effect}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h4 id="leaving-stable-heading" className="font-semibold text-gray-800">
        When a Maintained component leaves stable
      </h4>
      <p className={TEXT}>
        A component that leaves stable is no longer suitable for Common Ground, so it leaves Maintained too. Which state
        it moves to depends on the new developmentStatus.
      </p>
      <div className="overflow-x-auto">
        <table aria-labelledby="leaving-stable-heading" className={`w-full text-sm text-left ${TEXT}`}>
          <thead className="border-b border-gray-200 text-gray-800">
            <tr>
              <th scope="col" className="py-2 pr-3">New developmentStatus</th>
              <th scope="col" className="py-2">New state</th>
            </tr>
          </thead>
          <tbody>
            {LEAVING_STABLE.map((row) => (
              <tr key={row.state} className="border-b border-gray-100 align-top">
                <td className="py-2 pr-3 font-mono">{row.to.join(", ")}</td>
                <td className="py-2">{stateName(row.state)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Adoption() {
  return (
    <div id="adoption" className={BLOCK}>
      <h3 id="adoption-heading" className={H3}>
        How a component enters the standard (ALV papers)
        <StatusBadge status={ADOPTION_STATUS} />
      </h3>
      <p className={TEXT}>
        The Common Ground standard v1.0 and its explanation, put to the VNG ALV of 11 December 2026, describe how a
        component enters the standard. The checker delivers a measurement. VNG, as regievoerder, decides.
      </p>
      <AdoptionDiagram layout={WIDE_ADOPTION_LAYOUT} className="hidden lg:block w-full h-auto" />
      <AdoptionDiagram layout={NARROW_ADOPTION_LAYOUT} className="lg:hidden block w-full max-w-sm h-auto mx-auto" />
      <h4 id="adoption-steps-heading" className="font-semibold text-gray-800">
        The steps
      </h4>
      <ol aria-labelledby="adoption-steps-heading" className={`list-decimal pl-6 space-y-2 ${TEXT}`}>
        {ADOPTION_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <ul aria-label="What the ALV papers say about the regie" className={`list-disc pl-6 space-y-1 ${TEXT}`}>
        {ADOPTION_NOTES.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
      <p className="text-sm">
        <a href={ALV_STANDARD_URL} target="_blank" rel="noopener noreferrer" className={LINK}>
          The Common Ground standard v1.0 (PDF)
        </a>
        {" · "}
        <a href={ALV_EXPLANATION_URL} target="_blank" rel="noopener noreferrer" className={LINK}>
          The explanation of the Common Ground proposal (PDF)
        </a>
      </p>
    </div>
  );
}

function References() {
  return (
    <div className={BLOCK}>
      <ul aria-label="Outside sources" className={`list-disc pl-6 space-y-1 ${TEXT}`}>
        {ABOUT_REFERENCES.map((reference) => (
          <li key={reference.url}>
            <a href={reference.url} className={LINK} rel="noopener noreferrer">
              {reference.title}
            </a>
          </li>
        ))}
      </ul>
      <h3 className={H3}>On this site</h3>
      <ul aria-label="On this site" className={`list-disc pl-6 space-y-1 ${TEXT}`}>
        {ABOUT_SITE_LINKS.map((link) => (
          <li key={link.url}>
            <Link href={link.url} className={LINK}>
              {link.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Credits() {
  return (
    <div className="text-sm text-gray-500 border-t border-gray-200 pt-4 space-y-1">
      <p>© 2026 VNG Realisatie</p>
      <p>Author: Hugo W.L. ter Doest</p>
      <p>
        <a
          href="https://github.com/Hugo-ter-Doest/CommonGroundChecker"
          target="_blank"
          rel="noopener noreferrer"
          className={LINK}
        >
          View source on GitHub
        </a>
      </p>
    </div>
  );
}

const PAGE_BLOCKS: Record<string, () => ReactNode> = {
  "what-it-is": () => <Paragraphs texts={WHAT_IT_IS} />,
  "about-common-ground": () => (
    <div className={BLOCK}>
      <h3 className={H3}>About Common Ground</h3>
      <p className={TEXT}>{ABOUT_COMMON_GROUND}</p>
    </div>
  ),
  "measuring-stick-intro": () => <p className={TEXT}>{MEASURING_STICK_INTRO}</p>,
  principle: () => (
    <>
      <Paragraphs texts={PRINCIPLE} />
      <p className={`${TEXT} font-semibold`}>{NO_CONDITIONS_OF_OUR_OWN}</p>
      <p className="text-sm">
        <Link href={TOOLS_DOC_HREF} className={LINK}>
          Tools and models: what each tool proves and what it does not
        </Link>
      </p>
    </>
  ),
  "criteria-sources": () => <ChecklistSources />,
  "sources-and-measurements": () => <SourcesAndMeasurements />,
  "own-additions": () => <OwnAdditions />,
  "publiccode-basis": () => <PubliccodeBasis />,
  rating: () => (
    <>
      <Paragraphs texts={RATING_TEXT} />
      <p className="text-sm">
        <Link href="/docs" className={LINK}>
          The rating guide: categories, aspects and stars
        </Link>
      </p>
    </>
  ),
  "checklist-versions": () => <ChecklistVersions />,
  "common-ground-lifecycle": () => <CommonGroundLifecycle />,
  "component-lifecycle": () => <ComponentLifecycle />,
  "lifecycles-relation": () => <LifecyclesRelation />,
  basisset: () => (
    <div id="basisset" className={BLOCK}>
      <h3 className={H3}>The basisset</h3>
      <p className={TEXT}>{BASISSET_TEXT}</p>
      <p className="text-sm">
        <Link href={BASISSET_PAGE_HREF} className={LINK}>
          The basisset, next to what the checker measured
        </Link>
      </p>
    </div>
  ),
  "setup-intro": () => (
    <p className={TEXT}>
      This is a short overview of the setup behind the checker. It has four goals. Parts marked in review are built but
      not merged yet. Parts marked in development are being built. Parts marked proposed wait for a decision by the
      community.{" "}
      <Link href={PATH_DOC_HREF} className={LINK}>
        The path to Common Ground
      </Link>{" "}
      gives the detail.
    </p>
  ),
  adoption: () => <Adoption />,
  run: () => (
    <>
      <p className={TEXT}>{RUN_TEXT}</p>
      <p className="text-sm">
        <Link href="/docs/run-without-a-server" className={LINK}>
          Run the checker without a server
        </Link>
      </p>
    </>
  ),
  check: () => (IS_STATIC_SITE ? <AddComponentPanel /> : <CheckerHome />),
  references: () => <References />,
  credits: () => <Credits />,
};

function Block({ block }: { block: AboutBlock }) {
  if (block.kind === "setup") return <SetupBlock id={block.id} />;
  if (block.kind === "stick") return <StickBlock id={block.id} />;
  const render = PAGE_BLOCKS[block.id];
  if (!render) throw new Error(`no page block ${block.id}`);
  return <>{render()}</>;
}

export default function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-cg-blue">About the Common Ground Component Checker</h1>
        <nav aria-label="On this page" className="text-sm">
          <ol className="grid gap-x-6 gap-y-1 sm:grid-cols-2 list-decimal pl-6">
            {ABOUT_SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className={LINK}>
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </header>

      {ABOUT_SECTIONS.map((section) => (
        <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`} className={CARD}>
          {section.aliases?.map((alias) => <span key={alias} id={alias} aria-hidden="true" />)}
          <h2 id={`${section.id}-heading`} className={H2}>
            {section.title}
          </h2>
          {section.blocks.map((block) => (
            <Block key={`${block.kind}:${block.id}`} block={block} />
          ))}
        </section>
      ))}
    </div>
  );
}
