import Link from "next/link";
import {
  compareAspectRatings,
  compareCategoryRatings,
  compareCriteria,
  componentKeyText,
  tallyWinners,
  type CriterionSide,
  type RatingRow,
  type Winner,
} from "@/lib/compare";
import type { CompareSide } from "@/lib/compareSide";
import { standardOverlap } from "@/lib/compareSide";
import { describeComponentStandard, type ComponentStandard } from "@/lib/componentStandards";
import { describeOverlap, functionalityOverlap } from "@/lib/functionalities/overlap";
import { FUNCTIONALITIES_PATH, COMPARE_PATH, functionalityHref, providerHref } from "@/lib/routes";
import { SERVICE_LABELS } from "@/lib/staticSite/config";

export interface CompareOption {
  /** owner/repo */
  key: string;
  label: string;
}

interface ComparePageViewProps {
  options: CompareOption[];
  /** owner/repo as given in the URL */
  selectedA: string | null;
  selectedB: string | null;
  a: CompareSide | null;
  b: CompareSide | null;
  /** Names of the functionalities, by id */
  functionalityNames: Record<string, string>;
  /** Shown instead of the comparison, for example when a component is not found */
  message?: string | null;
  loading?: boolean;
}

const STATUS_LABELS: Record<string, string> = { pass: "Pass", warn: "Warning", fail: "Fail", info: "Info" };

function ratingText(value: number | null): string {
  return value === null ? "Not rated" : value.toFixed(1);
}

function winnerText(winner: Winner, a: string, b: string): string {
  if (winner === "a") return `${a} scores better`;
  if (winner === "b") return `${b} scores better`;
  if (winner === "equal") return "Equal";
  return "Not comparable";
}

function cellClass(winner: Winner, side: "a" | "b"): string {
  return winner === side ? "bg-green-50 font-semibold text-green-900" : "text-gray-700";
}

function WinnerCell({ winner, a, b }: { winner: Winner; a: string; b: string }) {
  const label = winner === "a" ? a : winner === "b" ? b : winner === "equal" ? "Equal" : "n/a";
  return (
    <td className="break-words px-2 py-2 text-xs text-gray-600">
      <span aria-hidden="true" className={winner === "a" || winner === "b" ? "font-semibold" : ""}>
        {label}
      </span>
      <span className="sr-only">{winnerText(winner, a, b)}</span>
    </td>
  );
}

function TableHead({ a, b, first }: { a: string; b: string; first: string }) {
  return (
    <thead>
      <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
        <th scope="col" className="w-[31%] px-2 py-2 font-semibold">
          {first}
        </th>
        <th scope="col" className="w-[23%] break-words px-2 py-2 font-semibold">
          {a}
        </th>
        <th scope="col" className="w-[23%] break-words px-2 py-2 font-semibold">
          {b}
        </th>
        <th scope="col" className="w-[23%] px-2 py-2 font-semibold">
          Scores better
        </th>
      </tr>
    </thead>
  );
}

function RatingTable({ caption, rows, a, b }: { caption: string; rows: RatingRow[]; a: string; b: string }) {
  return (
    <table className="w-full table-fixed text-xs sm:text-sm">
      <caption className="pb-1 text-left text-sm font-semibold text-gray-800">{caption}</caption>
      <TableHead a={a} b={b} first="Rating" />
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-gray-100 align-top">
            <th scope="row" className="break-words px-2 py-2 text-left font-normal text-gray-800">
              {row.title}
            </th>
            <td className={`px-2 py-2 ${cellClass(row.winner, "a")}`}>{ratingText(row.a)}</td>
            <td className={`px-2 py-2 ${cellClass(row.winner, "b")}`}>{ratingText(row.b)}</td>
            <WinnerCell winner={row.winner} a={a} b={b} />
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function criterionText(side: CriterionSide | null): string {
  if (!side) return "Not measured";
  const status = STATUS_LABELS[side.status] ?? side.status;
  return side.rating === null ? status : `${status}, ${side.rating.toFixed(1)}`;
}

function FunctionalityList({ ids, names, empty }: { ids: string[]; names: Record<string, string>; empty: string }) {
  if (ids.length === 0) return <p className="text-sm text-gray-500">{empty}</p>;
  return (
    <ul className="space-y-1 text-sm">
      {ids.map((id) => (
        <li key={id}>
          <Link href={functionalityHref(id)} className="inline-flex min-h-[44px] items-center break-words text-cg-lightblue hover:underline sm:min-h-0">
            {names[id] ?? id}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function StandardList({ standards, empty }: { standards: ComponentStandard[]; empty: string }) {
  if (standards.length === 0) return <p className="text-sm text-gray-500">{empty}</p>;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
      {standards.map((standard) => (
        <li key={standard.id}>{describeComponentStandard(standard)}</li>
      ))}
    </ul>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <h3 className="text-lg font-semibold text-cg-blue">{title}</h3>
      {children}
    </section>
  );
}

function ComponentPicker({ options, selectedA, selectedB }: Pick<ComparePageViewProps, "options" | "selectedA" | "selectedB">) {
  const select = (name: "a" | "b", label: string, value: string | null) => (
    <div className="flex min-w-0 max-w-full flex-col gap-1">
      <label htmlFor={`compare-${name}`} className="text-xs font-semibold text-gray-700">
        {label}
      </label>
      <select
        id={`compare-${name}`}
        name={name}
        defaultValue={value ?? ""}
        className="min-h-[44px] w-72 max-w-full rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-800 focus:border-cg-lightblue focus:outline-none focus:ring-2 focus:ring-cg-lightblue/40"
      >
        <option value="">Choose a component</option>
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
  return (
    <form method="get" action={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${COMPARE_PATH}`} className="flex flex-wrap items-end gap-3">
      {select("a", "First component", selectedA)}
      {select("b", "Second component", selectedB)}
      <button
        type="submit"
        className="min-h-[44px] rounded-lg border border-cg-lightblue bg-cg-lightblue/10 px-4 text-sm font-semibold text-cg-blue hover:bg-cg-lightblue/20"
      >
        Compare
      </button>
    </form>
  );
}

/** Two components side by side: ratings, criteria, functionalities, standards and providers. */
export default function ComparePageView({
  options,
  selectedA,
  selectedB,
  a,
  b,
  functionalityNames,
  message,
  loading,
}: ComparePageViewProps) {
  const ready = a && b && !message;
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <section className="space-y-3">
        <h2 className="text-2xl font-bold text-cg-blue">Compare two components</h2>
        <p className="text-gray-700">
          Put two components side by side. For every rating and criterion the page marks which one scores better, and
          it shows how much their functionalities and standards overlap. The address of this page holds both
          components, so you can share it.
        </p>
        <ComponentPicker options={options} selectedA={selectedA} selectedB={selectedB} />
      </section>

      {loading && (
        <p role="status" className="text-sm text-gray-500">
          Loading the two components.
        </p>
      )}
      {message && (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {message}
        </p>
      )}
      {ready && <Comparison a={a} b={b} functionalityNames={functionalityNames} />}
    </div>
  );
}

function SideHeading({ side }: { side: CompareSide }) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-200 bg-white px-4 py-3">
      <p className="break-words font-semibold text-gray-800">
        <Link href={side.href} className="text-cg-blue hover:underline">
          {side.name}
        </Link>
      </p>
      <p className="break-words text-xs text-gray-500">{componentKeyText(side.key)}</p>
      <p className="text-xs text-gray-500">
        {side.checkedAt ? `Checked ${new Date(side.checkedAt).toLocaleDateString("nl-NL")}` : "Not checked yet"}
        {side.version ? `, version ${side.version}` : ""}
      </p>
    </div>
  );
}

function Comparison({ a, b, functionalityNames }: { a: CompareSide; b: CompareSide; functionalityNames: Record<string, string> }) {
  const overlap = functionalityOverlap(a.functionalities, b.functionalities);
  const standards = standardOverlap(a.standards, b.standards);
  const both = a.analysis && b.analysis;
  const categories = both ? compareCategoryRatings(a.analysis!, b.analysis!) : [];
  const aspects = both ? compareAspectRatings(a.analysis!, b.analysis!) : [];
  const criteria = both ? compareCriteria(a.analysis!, b.analysis!) : [];
  const tally = tallyWinners(criteria);
  const draft = a.functionalitiesDraft || b.functionalitiesDraft;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <SideHeading side={a} />
        <SideHeading side={b} />
      </div>

      <Panel title="Overlap in functionalities">
        <p className="text-sm text-gray-700">{describeOverlap(overlap, a.name, b.name)}</p>
        <p className="text-sm text-gray-700">
          The degree of overlap is the number of shared functionalities divided by all functionalities of the two
          together. Partial overlap does not mean one of them can go: the part only one of them does can give each
          a reason to exist.
        </p>
        {draft && (
          <p className="text-xs text-amber-900">
            The functionalities of {[a, b].filter((side) => side.functionalitiesDraft).map((side) => side.name).join(" and ")}{" "}
            are a draft. The component owners still have to confirm them.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="min-w-0 space-y-1">
            <h4 className="text-sm font-semibold text-gray-800">Both ({overlap.shared.length})</h4>
            <FunctionalityList ids={overlap.shared} names={functionalityNames} empty="None shared." />
          </div>
          <div className="min-w-0 space-y-1">
            <h4 className="text-sm font-semibold text-gray-800">Only {a.name} ({overlap.onlyA.length})</h4>
            <FunctionalityList ids={overlap.onlyA} names={functionalityNames} empty="Nothing of its own listed." />
          </div>
          <div className="min-w-0 space-y-1">
            <h4 className="text-sm font-semibold text-gray-800">Only {b.name} ({overlap.onlyB.length})</h4>
            <FunctionalityList ids={overlap.onlyB} names={functionalityNames} empty="Nothing of its own listed." />
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Functionalities are GEMMA application services.{" "}
          <Link href={FUNCTIONALITIES_PATH} className="text-cg-lightblue hover:underline">
            See every functionality and which components provide it
          </Link>
          .
        </p>
        {(a.features.length > 0 || b.features.length > 0) && (
          <details className="text-sm">
            <summary className="min-h-[44px] cursor-pointer py-2 font-semibold text-gray-800 sm:min-h-0">
              Features each component describes in publiccode.yml
            </summary>
            <p className="pb-2 text-xs text-gray-500">
              Raw input as the components write it. It is not mapped to functionalities and does not count in the overlap.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {[a, b].map((side) => (
                <div key={componentKeyText(side.key)} className="min-w-0">
                  <h4 className="font-semibold text-gray-800">{side.name}</h4>
                  {side.features.length === 0 ? (
                    <p className="text-gray-500">No features listed.</p>
                  ) : (
                    <ul className="list-disc space-y-1 pl-5 text-gray-700">
                      {side.features.map((feature) => (
                        <li key={feature} className="break-words">
                          {feature}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}
      </Panel>

      <Panel title="Standards">
        {standards ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="min-w-0 space-y-1">
              <h4 className="text-sm font-semibold text-gray-800">Both ({standards.shared.length})</h4>
              <StandardList standards={standards.shared} empty="None shared." />
            </div>
            <div className="min-w-0 space-y-1">
              <h4 className="text-sm font-semibold text-gray-800">Only {a.name} ({standards.onlyA.length})</h4>
              <StandardList standards={standards.onlyA} empty="None of its own." />
            </div>
            <div className="min-w-0 space-y-1">
              <h4 className="text-sm font-semibold text-gray-800">Only {b.name} ({standards.onlyB.length})</h4>
              <StandardList standards={standards.onlyB} empty="None of its own." />
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Not measured for {[a, b].filter((side) => !side.standards).map((side) => side.name).join(" and ")}: its
            latest scan ran before the checker read standards.
          </p>
        )}
        <p className="text-xs text-gray-500">
          From the Supported standards criterion: what publiccode.yml declares under supports, and the standard APIs
          found in the OpenAPI files of the repository.
        </p>
      </Panel>

      <Panel title="Ratings">
        {!both ? (
          <p className="text-sm text-gray-500">
            {[a, b].filter((side) => !side.analysis).map((side) => side.name).join(" and ")} has no analysis with
            results yet, so the ratings cannot be compared.
          </p>
        ) : (
          <>
            <p className="text-sm text-gray-700">
              A higher rating is better. The better value is marked green. n/a means one of the two has no rating
              for it.
            </p>
            <RatingTable caption="Overall and per category" rows={categories} a={a.name} b={b.name} />
            <details className="text-sm">
              <summary className="min-h-[44px] cursor-pointer py-2 font-semibold text-gray-800 sm:min-h-0">
                Per aspect
              </summary>
              <div className="space-y-4 pt-2">
                {aspects.map((group) => (
                  <RatingTable key={group.category} caption={group.category} rows={group.rows} a={a.name} b={b.name} />
                ))}
              </div>
            </details>
          </>
        )}
      </Panel>

      {both && (
        <Panel title="Criteria">
          <p className="text-sm text-gray-700">
            {a.name} scores better on {tally.a}, {b.name} on {tally.b}, and they are equal on {tally.equal}.{" "}
            {tally["not-comparable"]} cannot be compared: informative, not applicable or measured for one of them only.
          </p>
          <table className="w-full table-fixed text-xs sm:text-sm">
            <caption className="sr-only">Every criterion, with the result of each component</caption>
            <TableHead a={a.name} b={b.name} first="Criterion" />
            <tbody>
              {criteria.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 align-top">
                  <th scope="row" className="break-words px-2 py-2 text-left font-normal text-gray-800">
                    {row.title}
                  </th>
                  <td className={`break-words px-2 py-2 ${cellClass(row.winner, "a")}`}>{criterionText(row.a)}</td>
                  <td className={`break-words px-2 py-2 ${cellClass(row.winner, "b")}`}>{criterionText(row.b)}</td>
                  <WinnerCell winner={row.winner} a={a.name} b={b.name} />
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <Panel title="Providers">
        <div className="grid gap-4 sm:grid-cols-2">
          {[a, b].map((side) => (
            <div key={componentKeyText(side.key)} className="min-w-0 space-y-1">
              <h4 className="text-sm font-semibold text-gray-800">{side.name}</h4>
              {side.providers.length === 0 ? (
                <p className="text-sm text-gray-500">No provider listed yet.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {side.providers.map((provider) => (
                    <li key={provider.slug}>
                      <Link href={providerHref(provider.slug)} className="text-cg-lightblue hover:underline">
                        {provider.name}
                      </Link>
                      <span className="text-gray-500">
                        : {provider.services.map((service) => SERVICE_LABELS[service].toLowerCase()).join(", ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
