import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CHECKLIST_VERSION, transitionNotice } from "@/lib/criteria";
import { DEFAULT_CRITERION_CONFIG_BY_CHECK_ID } from "@/lib/checkers/config";
import {
  CRITERIA_DOC_HREF,
  CRITERION_DOCS,
  LEVEL_LABELS,
  SOURCE_DOCS,
  findCriterionDoc,
  resolveCriterionDoc,
} from "@/lib/criterionDocs";
import { TOOLS_DOC_HREF } from "@/lib/toolsDocs";

interface CriterionDocPageProps {
  params: Promise<{ id: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return CRITERION_DOCS.map((doc) => ({ id: doc.id }));
}

export async function generateMetadata({ params }: CriterionDocPageProps): Promise<Metadata> {
  const { id } = await params;
  const doc = findCriterionDoc(id);
  return doc ? { title: `${doc.title} | Criteria`, description: doc.what } : { title: "Criteria" };
}

const SECTION = "bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3";
const H2 = "text-xl font-bold text-cg-blue";
const LINK = "text-cg-lightblue hover:underline";

export default async function CriterionDocPage({ params }: CriterionDocPageProps) {
  const { id } = await params;
  const found = findCriterionDoc(id);
  if (!found) notFound();
  const doc = resolveCriterionDoc(found, DEFAULT_CRITERION_CONFIG_BY_CHECK_ID);
  const source = SOURCE_DOCS[doc.source];

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
      <section className="space-y-3">
        <p className="text-sm">
          <Link href="/docs" className={LINK}>
            Rating guide
          </Link>
          {" / "}
          <Link href={CRITERIA_DOC_HREF} className={LINK}>
            Criteria
          </Link>
        </p>
        <h1 className="text-3xl font-bold text-cg-blue break-words">{doc.title}</h1>
        <p className="flex flex-wrap gap-2 text-xs font-semibold text-gray-700">
          <span className="rounded-full border border-gray-300 px-2 py-0.5">{doc.category}</span>
          <span className="rounded-full border border-gray-300 px-2 py-0.5">{LEVEL_LABELS[doc.level]}</span>
          <span className="rounded-full border border-gray-300 px-2 py-0.5">{source.label}</span>
        </p>
        {!doc.measured && (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            This criterion is part of an open change to the checker. Checklist version {CHECKLIST_VERSION} does not
            measure it yet.
          </p>
        )}
      </section>

      <section aria-labelledby="what" className={SECTION}>
        <h2 id="what" className={H2}>
          What it checks
        </h2>
        <p className="text-gray-700">{doc.what}</p>
      </section>

      <section aria-labelledby="why" className={SECTION}>
        <h2 id="why" className={H2}>
          Why it matters
        </h2>
        <p className="text-gray-700">{doc.why}</p>
      </section>

      {doc.components && (
        <section aria-labelledby="components" className={SECTION}>
          <h2 id="components" className={H2}>
            Which components
          </h2>
          <p className="text-gray-700">{doc.components}</p>
        </section>
      )}

      <section aria-labelledby="source" className={SECTION}>
        <h2 id="source" className={H2}>
          Where it comes from
        </h2>
        <p className="text-gray-700">
          <strong>{source.label}.</strong> {source.explanation}
        </p>
        {doc.sourceNote && <p className="text-gray-700">{doc.sourceNote}</p>}
      </section>

      <section aria-labelledby="level" className={SECTION}>
        <h2 id="level" className={H2}>
          Level and version
        </h2>
        <dl className="grid gap-x-6 gap-y-2 text-gray-700 sm:grid-cols-[auto_1fr]">
          <dt className="font-semibold">Level</dt>
          <dd>
            {LEVEL_LABELS[doc.level]}
            {doc.mandatoryFrom && `. ${transitionNotice(doc.mandatoryFrom)}. Until then a fail shows as a warning.`}
          </dd>
          <dt className="font-semibold">Counts in the rating</dt>
          <dd>{doc.counted ? "Yes" : "No, it is shown but never counted"}</dd>
          <dt className="font-semibold">Checklist version</dt>
          <dd>{doc.introducedIn ? `Introduced in ${doc.introducedIn}` : "Not in a released version yet"}</dd>
          <dt className="font-semibold">Category</dt>
          <dd>{doc.category}</dd>
          <dt className="font-semibold">Aspect</dt>
          <dd>
            {doc.aspects.length === 0
              ? "None: the criterion does not feed an aspect"
              : doc.aspects.map((aspect, index) => (
                  <span key={aspect.id}>
                    {index > 0 && ", "}
                    {aspect.href ? (
                      <Link href={aspect.href} className={LINK}>
                        {aspect.title}
                      </Link>
                    ) : (
                      aspect.title
                    )}
                  </span>
                ))}
          </dd>
        </dl>
      </section>

      <section aria-labelledby="tool" className={SECTION}>
        <h2 id="tool" className={H2}>
          How it is measured
        </h2>
        {doc.measuredWith && <p className="text-gray-700">Measured with {doc.measuredWith}.</p>}
        <p className="text-gray-700">
          <Link href={TOOLS_DOC_HREF} className={LINK}>
            Tools and models
          </Link>{" "}
          says what each tool proves and what it does not.
        </p>
      </section>

      <section aria-labelledby="pass" className={SECTION}>
        <h2 id="pass" className={H2}>
          How to pass
        </h2>
        <ul className="list-disc pl-6 space-y-1 text-gray-700">
          {doc.howToPass.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </section>

      {doc.fields.length > 0 && (
        <section aria-labelledby="publiccode" className={SECTION}>
          <h2 id="publiccode" className={H2}>
            publiccode.yml
          </h2>
          <p className="text-gray-700">The Common Ground profile explains the fields this criterion reads:</p>
          <ul className="list-disc pl-6 space-y-1">
            {doc.fields.map((field) => (
              <li key={field.id}>
                <Link href={field.href} className={LINK}>
                  {field.keys}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {doc.referenceSources.length > 0 && (
        <section aria-labelledby="sources" className={SECTION}>
          <h2 id="sources" className={H2}>
            Sources
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            {doc.referenceSources.map((reference) => (
              <li key={reference.url}>
                <a href={reference.url} className={LINK} rel="noopener noreferrer">
                  {reference.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
