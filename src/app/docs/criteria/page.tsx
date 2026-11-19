import type { Metadata } from "next";
import Link from "next/link";
import CriteriaIndex, { type CriteriaIndexRow } from "@/components/CriteriaIndex";
import { CATEGORY_ORDER, CHECKLIST_VERSION } from "@/lib/criteria";
import { DEFAULT_CRITERION_CONFIG_BY_CHECK_ID } from "@/lib/checkers/config";
import {
  LEVEL_LABELS,
  SOURCE_DOCS,
  SOURCE_ORDER,
  orderedCriterionDocs,
  resolveCriterionDoc,
} from "@/lib/criterionDocs";
import type { RequirementLevel } from "@/lib/types";

export const metadata: Metadata = {
  title: "Criteria | Rating guide",
  description: "Every criterion of the checker: what it checks, where it comes from and how to pass it.",
};

const LEVELS: RequirementLevel[] = ["mandatory", "recommended", "informative"];

export default function CriteriaPage() {
  const docs = orderedCriterionDocs().map((doc) => resolveCriterionDoc(doc, DEFAULT_CRITERION_CONFIG_BY_CHECK_ID));
  const rows: CriteriaIndexRow[] = docs.map((doc) => ({
    id: doc.id,
    title: doc.title,
    href: doc.href,
    what: doc.what,
    category: doc.category,
    level: doc.level,
    source: doc.source,
    measured: doc.measured,
  }));
  const present = new Set(rows.map((row) => row.category));
  const categories = [
    ...CATEGORY_ORDER.filter((category) => present.has(category)),
    ...[...present].filter((category) => !(CATEGORY_ORDER as string[]).includes(category)),
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <section className="space-y-3">
        <p className="text-sm">
          <Link href="/docs" className="text-cg-lightblue hover:underline">
            Rating guide
          </Link>
        </p>
        <h1 className="text-3xl font-bold text-cg-blue">Criteria</h1>
        <p className="text-gray-700">
          Each criterion has a page that says what the checker looks at, why it matters, where it comes from and how
          to pass it. This is checklist version {CHECKLIST_VERSION}.
        </p>
      </section>

      <section aria-labelledby="sources" className="space-y-3">
        <h2 id="sources" className="text-2xl font-bold text-cg-blue">
          Where the criteria come from
        </h2>
        <p className="text-gray-700">
          The checklist rests on three sources. The checker only adds measurements that fit them, and no conditions
          of its own.
        </p>
        <dl className="space-y-2 text-gray-700">
          {SOURCE_ORDER.map((source) => (
            <div key={source}>
              <dt className="font-semibold">{SOURCE_DOCS[source].label}</dt>
              <dd>{SOURCE_DOCS[source].explanation}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="all-criteria" className="space-y-3">
        <h2 id="all-criteria" className="text-2xl font-bold text-cg-blue">
          All criteria
        </h2>
        <CriteriaIndex
          rows={rows}
          categories={categories}
          levels={LEVELS.map((value) => ({ value, label: LEVEL_LABELS[value] }))}
          sources={SOURCE_ORDER.map((value) => ({ value, label: SOURCE_DOCS[value].label }))}
        />
      </section>
    </div>
  );
}
