import type { Metadata } from "next";
import Link from "next/link";
import DocTable from "@/components/DocTable";
import {
  AUDIENCES,
  PATH_DOC_SOURCES,
  PATH_SECTIONS,
  PATH_STEPS,
  THREE_SYSTEMS_HREF,
} from "@/lib/pathDocs";
import StatusBadge from "@/components/StatusBadge";

export const metadata: Metadata = {
  title: "The path to Common Ground | Rating guide",
  description: "How the checker measures and judges a component, and how a component becomes a Common Ground component.",
};

const SECTION = "bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 scroll-mt-6";
const H2 = "text-2xl font-bold text-cg-blue";

export default function CommonGroundPathPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <section className="space-y-3">
        <p className="text-sm">
          <Link href="/docs" className="text-cg-lightblue hover:underline">
            Back to the rating guide
          </Link>
        </p>
        <h1 className="text-3xl font-bold text-cg-blue">The path to Common Ground</h1>
        <p className="text-gray-700">
          This page explains the setup behind the checker: how the checker measures and judges a component, and
          how a component becomes a Common Ground component. Parts marked in review are built but not merged yet. Parts marked in
          development are being built. Parts marked proposed wait for a decision by the community.
        </p>
      </section>

      <section id="audiences" aria-labelledby="audiences-heading" className={SECTION}>
        <h2 id="audiences-heading" className={H2}>
          Who this page is for
        </h2>
        {AUDIENCES.map((audience) => (
          <div key={audience.id} className="space-y-1">
            <h3 className="text-lg font-semibold text-gray-800">{audience.title}</h3>
            <p className="text-gray-700">{audience.text}</p>
          </div>
        ))}
      </section>

      <section id="steps" aria-labelledby="steps-heading" className={SECTION}>
        <h2 id="steps-heading" className={H2}>
          The path in seven steps
        </h2>
        <ol className="list-decimal pl-6 space-y-2 text-gray-700">
          {PATH_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      {PATH_SECTIONS.map((section) => (
        <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`} className={SECTION}>
          <h2 id={`${section.id}-heading`} className={H2}>
            {section.title}
            <StatusBadge status={section.status} />
          </h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-gray-700">
              {paragraph}
            </p>
          ))}
          {section.items && (
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {section.id === "three-systems" && (
            <p className="text-gray-700">
              <Link href={THREE_SYSTEMS_HREF} className="text-cg-lightblue hover:underline">
                Tools and models
              </Link>{" "}
              explains the three kinds of result in more detail.
            </p>
          )}
          {section.parts?.map((part) => (
            <div key={part.title} className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-800">
                {part.title}
                <StatusBadge status={part.status} />
              </h3>
              {part.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-gray-700">
                  {paragraph}
                </p>
              ))}
              {part.items && (
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                  {part.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {part.table && <DocTable table={part.table} />}
              {part.notes?.map((note) => (
                <p key={note} className="text-gray-700">
                  {note}
                </p>
              ))}
            </div>
          ))}
        </section>
      ))}

      <section id="sources" aria-labelledby="sources-heading" className={SECTION}>
        <h2 id="sources-heading" className={H2}>
          Sources
        </h2>
        <ul className="list-disc pl-6 space-y-1">
          {PATH_DOC_SOURCES.map((source) => (
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
