import type { Metadata } from "next";
import Link from "next/link";
import {
  DEVIATIONS,
  LIMITS,
  REJECTED_TOOLS,
  TOOL_GROUPS,
  TOOLS_DOC_SOURCES,
  THREE_SYSTEMS,
  TRACK_LABELS,
  TWO_TRACKS,
  WHY_BOTH,
  type ToolGroup,
} from "@/lib/toolsDocs";
import { PATH_DOC_HREF } from "@/lib/pathDocs";

export const metadata: Metadata = {
  title: "Tools and models | Rating guide",
  description: "Which tools the checker uses per measure, where it deviates from the SIG/TÜV NORD model and why.",
};

const SECTION = "bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 scroll-mt-6";
const H2 = "text-2xl font-bold text-cg-blue";

function ToolTable({ group }: { group: ToolGroup }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-left border border-gray-200">
        <caption className="text-left text-lg font-semibold text-gray-800 pb-2">{group.title}</caption>
        <thead className="bg-cg-gray">
          <tr>
            <th scope="col" className="p-2">Measure</th>
            <th scope="col" className="p-2">Tool</th>
            <th scope="col" className="p-2">Version</th>
            <th scope="col" className="p-2">Licence</th>
            <th scope="col" className="p-2">What it proves</th>
            <th scope="col" className="p-2">What it does not prove</th>
          </tr>
        </thead>
        <tbody>
          {group.rows.map((row) => (
            <tr key={`${row.measure}-${row.track}-${row.tool}`} className="border-t border-gray-200 align-top">
              <th scope="row" className="p-2 font-medium">
                {row.measure}
                <span className="block text-xs font-normal text-gray-600">
                  {TRACK_LABELS[row.track]}
                  {row.inReview && (row.pr ? ` (in review, #${row.pr})` : " (in review)")}
                </span>
              </th>
              <td className="p-2">{row.tool}</td>
              <td className="p-2">{row.version}</td>
              <td className="p-2">{row.licence}</td>
              <td className="p-2">{row.proves}</td>
              <td className="p-2">{row.doesNotProve}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ToolsAndModelsPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <section className="space-y-3">
        <p className="text-sm">
          <Link href="/docs" className="text-cg-lightblue hover:underline">
            Back to the rating guide
          </Link>
        </p>
        <h1 className="text-3xl font-bold text-cg-blue">Tools and models</h1>
        <p className="text-gray-700">
          This page names the tools the checker uses for each measure, what each of them proves and what it does
          not, and where the checker deviates from the SIG/TÜV NORD maintainability model, with the reason.
          Parts marked in review are built but not merged yet.
        </p>
        <p className="text-gray-700">
          How a component becomes a Common Ground component, from the version that is measured to Maintained, is
          explained in{" "}
          <Link href={PATH_DOC_HREF} className="text-cg-lightblue hover:underline">
            The path to Common Ground
          </Link>
          .
        </p>
        <p className="text-gray-700 font-semibold">
          The estimate track is not calibrated against real SIG audits. There are no Sigrid results to compare
          with: it is checked against the published model v18.1 only.
        </p>
      </section>

      <section id="three-systems" aria-labelledby="three-systems-heading" className={SECTION}>
        <h2 id="three-systems-heading" className={H2}>
          What the checker reports
        </h2>
        {THREE_SYSTEMS.map((system) => (
          <div key={system.id} className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-800">{system.title}</h3>
            {system.paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-gray-700">
                {paragraph}
              </p>
            ))}
          </div>
        ))}
      </section>

      <section id="two-tracks" aria-labelledby="two-tracks-heading" className={SECTION}>
        <h2 id="two-tracks-heading" className={H2}>
          Two tracks, and why both
        </h2>
        {TWO_TRACKS.map((track) => (
          <div key={track.id} className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-800">{track.title}</h3>
            {track.paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-gray-700">
                {paragraph}
              </p>
            ))}
          </div>
        ))}
        <h3 className="text-lg font-semibold text-gray-800">Why both</h3>
        <p className="text-gray-700">{WHY_BOTH}</p>
      </section>

      <section id="tools" aria-labelledby="tools-heading" className={SECTION}>
        <h2 id="tools-heading" className={H2}>
          Tools per measure
        </h2>
        {TOOL_GROUPS.map((group) => (
          <ToolTable key={group.id} group={group} />
        ))}
      </section>

      <section id="deviations" aria-labelledby="deviations-heading" className={SECTION}>
        <h2 id="deviations-heading" className={H2}>
          Where we deviate from SIG, and why
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left border border-gray-200">
            <thead className="bg-cg-gray">
              <tr>
                <th scope="col" className="p-2">Topic</th>
                <th scope="col" className="p-2">SIG</th>
                <th scope="col" className="p-2">The checker</th>
                <th scope="col" className="p-2">Why</th>
              </tr>
            </thead>
            <tbody>
              {DEVIATIONS.map((deviation) => (
                <tr key={deviation.topic} className="border-t border-gray-200 align-top">
                  <th scope="row" className="p-2 font-medium">{deviation.topic}</th>
                  <td className="p-2">{deviation.sig}</td>
                  <td className="p-2">{deviation.checker}</td>
                  <td className="p-2">{deviation.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="rejected" aria-labelledby="rejected-heading" className={SECTION}>
        <h2 id="rejected-heading" className={H2}>
          Tools we tested and rejected
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-gray-700">
          {REJECTED_TOOLS.map((rejected) => (
            <li key={`${rejected.tool}-${rejected.consideredFor}`}>
              <strong>{rejected.tool}</strong>, for {rejected.consideredFor}: {rejected.reason}
            </li>
          ))}
        </ul>
      </section>

      <section id="limits" aria-labelledby="limits-heading" className={SECTION}>
        <h2 id="limits-heading" className={H2}>
          Limits
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-gray-700">
          {LIMITS.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
        <h3 className="text-lg font-semibold text-gray-800">Sources</h3>
        <ul className="list-disc pl-6 space-y-1">
          {TOOLS_DOC_SOURCES.map((source) => (
            <li key={source.url}>
              <a href={source.url} className="text-cg-lightblue hover:underline" rel="noopener noreferrer">
                {source.title}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
