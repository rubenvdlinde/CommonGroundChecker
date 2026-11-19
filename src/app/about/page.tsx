import Link from "next/link";
import AdoptionDiagram, { NARROW_ADOPTION_LAYOUT, WIDE_ADOPTION_LAYOUT } from "@/components/AdoptionDiagram";
import ChecklistSourcesDiagram, { NARROW_SOURCES_LAYOUT, WIDE_SOURCES_LAYOUT } from "@/components/ChecklistSourcesDiagram";
import DocTable from "@/components/DocTable";
import LifecycleDiagram, { NARROW_LAYOUT, WIDE_LAYOUT } from "@/components/LifecycleDiagram";
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
  SETUP_POINTS,
  stateName,
} from "@/lib/aboutDocs";
import { PATH_DOC_HREF } from "@/lib/pathDocs";

const CARD = "bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4 scroll-mt-6";
const H2 = "text-2xl font-bold text-cg-blue";
const LINK = "text-cg-lightblue hover:underline";

function SetupLink({ href, text }: { href: string; text: string }) {
  if (href.startsWith("/")) {
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

export default function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">

      <section className="space-y-3">
        <h2 className="text-2xl font-bold text-cg-blue">About Common Ground</h2>
        <p className="text-gray-700">
          Common Ground is a Dutch government initiative that promotes modern,
          interoperable, and reusable digital public services. Instead of isolated
          monolithic systems, municipalities are encouraged to use open standards,
          modular components, and well-defined APIs so solutions can be shared and
          improved across organizations.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-bold text-cg-blue">Component Checker</h2>
        <p className="text-gray-700">
          The Common Ground Component Checker helps teams quickly assess whether a
          public GitHub repository aligns with key Common Ground practices. It runs
          automated checks (such as open standards, governance files, deployability,
          documentation, and versioning) and produces a transparent score with
          evidence per criterion.
        </p>
        <p className="text-gray-700">
          The goal is to support better decision-making, highlight improvement areas,
          and make reusable public-sector software easier to evaluate over time.
        </p>
      </section>

      <section id="setup" aria-labelledby="setup-heading" className={CARD}>
        <h2 id="setup-heading" className={H2}>
          The setup
        </h2>
        <p className="text-gray-700">
          This is a short overview of the setup behind the checker. It has four goals. Parts marked in review are
          built but not merged yet. Parts marked in development are being built. Parts marked proposed wait for a
          decision by the community.{" "}
          <Link href={PATH_DOC_HREF} className={LINK}>
            The path to Common Ground
          </Link>{" "}
          gives the detail.
        </p>
        {SETUP_POINTS.map((point) => (
          <div key={point.id} id={`setup-${point.id}`} className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-800">
              {point.title}
              <StatusBadge status={point.status} />
            </h3>
            {point.paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-gray-700">
                {paragraph}
              </p>
            ))}
            {point.items && (
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                {point.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            {point.tableIntro && <p className="text-gray-700">{point.tableIntro}</p>}
            {point.table && <DocTable table={point.table} />}
            <p className="text-sm">
              <SetupLink {...point.link} />
            </p>
          </div>
        ))}
      </section>

      <section id="checklist-sources" aria-labelledby="checklist-sources-heading" className={CARD}>
        <h2 id="checklist-sources-heading" className={H2}>
          Where the checklist comes from
        </h2>
        <p className="text-gray-700">
          The checklist rests on three sources. What the checklist asks decides whether a component is suitable for
          Common Ground and whether it can be Maintained.
        </p>
        <ChecklistSourcesDiagram layout={WIDE_SOURCES_LAYOUT} className="hidden lg:block w-full h-auto" />
        <ChecklistSourcesDiagram layout={NARROW_SOURCES_LAYOUT} className="lg:hidden block w-full max-w-sm h-auto mx-auto" />

        <h3 id="checklist-sources-list-heading" className="text-lg font-semibold text-gray-800">
          The three sources
        </h3>
        <ol aria-labelledby="checklist-sources-list-heading" className="list-decimal pl-6 space-y-2 text-gray-700">
          {CHECKLIST_SOURCES.map((source) => (
            <li key={source.id}>
              <span className="font-semibold text-gray-800">{source.title}.</span> {source.text}
              <StatusBadge status={source.status} />
              {source.links?.map((link) => (
                <span key={link.href} className="block text-sm">
                  <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-cg-lightblue hover:underline">
                    {link.text}
                  </a>
                </span>
              ))}
            </li>
          ))}
        </ol>
        <p className="text-gray-700">
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
        <p className="text-gray-700 font-semibold">{NO_CONDITIONS_OF_OUR_OWN}</p>

        <h3 id="information-only-heading" className="text-lg font-semibold text-gray-800">
          Shown for information only
        </h3>
        <p className="text-gray-700">
          The checker also shows information that rates nothing. It never counts towards a rating or the verdict:
        </p>
        <ul aria-labelledby="information-only-heading" className="list-disc pl-6 space-y-1 text-gray-700">
          {INFORMATION_ONLY.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="text-gray-700">
          The number of organisations listed under usedBy in publiccode.yml counts only towards Maintained.
        </p>
      </section>

      <section id="adoption" aria-labelledby="adoption-heading" className={CARD}>
        <h2 id="adoption-heading" className={H2}>
          How a component enters the standard (ALV papers)
          <StatusBadge status={ADOPTION_STATUS} />
        </h2>
        <p className="text-gray-700">
          The Common Ground standard v1.0 and its explanation, put to the VNG ALV of 11 December 2026, describe how a
          component enters the standard. The checker delivers a measurement. VNG, as regievoerder, decides.
        </p>
        <AdoptionDiagram layout={WIDE_ADOPTION_LAYOUT} className="hidden lg:block w-full h-auto" />
        <AdoptionDiagram layout={NARROW_ADOPTION_LAYOUT} className="lg:hidden block w-full max-w-sm h-auto mx-auto" />

        <h3 id="adoption-steps-heading" className="text-lg font-semibold text-gray-800">
          The steps
        </h3>
        <ol aria-labelledby="adoption-steps-heading" className="list-decimal pl-6 space-y-2 text-gray-700">
          {ADOPTION_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <ul aria-label="What the ALV papers say about the regie" className="list-disc pl-6 space-y-1 text-gray-700">
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
      </section>

      <section id="common-ground-lifecycle" aria-labelledby="common-ground-lifecycle-heading" className={CARD}>
        <h2 id="common-ground-lifecycle-heading" className={H2}>
          The Common Ground lifecycle
        </h2>
        <p className="text-gray-700">
          A component has its own lifecycle in the Common Ground programme. It is separate from the lifecycle of the
          software. A component can move into the support of the programme and out of it again. A dashed state with
          a label is not shown by the checker yet.
        </p>
        <LifecycleDiagram layout={WIDE_LAYOUT} className="hidden lg:block w-full h-auto" />
        <LifecycleDiagram layout={NARROW_LAYOUT} className="lg:hidden block w-full max-w-sm h-auto mx-auto" />

        <h3 id="common-ground-states-heading" className="text-lg font-semibold text-gray-800">
          The states
        </h3>
        <ol aria-labelledby="common-ground-states-heading" className="list-decimal pl-6 space-y-2 text-gray-700">
          {CG_STATES.map((state) => (
            <li key={state.id}>
              <span className="font-semibold text-gray-800">{state.name}.</span> {state.text}
              <StatusBadge status={state.status} />
            </li>
          ))}
        </ol>

        <h3 id="common-ground-transitions-heading" className="text-lg font-semibold text-gray-800">
          The transitions
        </h3>
        <div className="overflow-x-auto">
          <table aria-labelledby="common-ground-transitions-heading" className="w-full text-sm text-left text-gray-700">
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
      </section>

      <section id="component-lifecycle" aria-labelledby="component-lifecycle-heading" className={CARD}>
        <h2 id="component-lifecycle-heading" className={H2}>
          The component lifecycle
        </h2>
        <p className="text-gray-700">
          The software itself follows developmentStatus in publiccode.yml. The maintainer sets it. It moves in one
          direction, from concept to obsolete.
        </p>
        <ol
          aria-label="developmentStatus in publiccode.yml, in order"
          className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:items-stretch"
        >
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
      </section>

      <section id="lifecycles-relation" aria-labelledby="lifecycles-relation-heading" className={CARD}>
        <h2 id="lifecycles-relation-heading" className={H2}>
          How the two relate
        </h2>
        <p className="text-gray-700">
          The two lifecycles are separate. The maintainer decides the developmentStatus. The programme decides the
          status in Common Ground. They meet at one rule: only a stable component can be Maintained. A stable component
          can still be only suitable, for example without a valid SLA. An obsolete component leads to retired.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-700">
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
        <h3 id="leaving-stable-heading" className="text-lg font-semibold text-gray-800">
          When a Maintained component leaves stable
        </h3>
        <p className="text-gray-700">
          A component that leaves stable leaves Maintained. Which state it moves to depends on the new developmentStatus.
          It goes back to Suitable for Common Ground while the verdict still holds, and to Measured when it does not.
        </p>
        <div className="overflow-x-auto">
          <table aria-labelledby="leaving-stable-heading" className="w-full text-sm text-left text-gray-700">
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
      </section>

      <section className="text-sm text-gray-500 border-t border-gray-200 pt-4 space-y-1">
        <p>© 2026 VNG Realisatie</p>
        <p>Author: Hugo W.L. ter Doest</p>
        <p>
          <a
            href="https://github.com/Hugo-ter-Doest/CommonGroundChecker"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cg-lightblue hover:underline"
          >
            View source on GitHub
          </a>
        </p>
      </section>
    </div>
  );
}
