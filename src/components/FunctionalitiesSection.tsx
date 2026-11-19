import Link from "next/link";
import type { CompareOption } from "@/components/ComparePageView";
import { describeComponentStandard, type ComponentStandard } from "@/lib/componentStandards";
import { STATIC_SITE_LINKS } from "@/lib/dataSource/mode";
import { COMPARE_PATH, FUNCTIONALITIES_PATH, functionalityHref } from "@/lib/routes";

/** What the component page shows about what a component does and which standards it supports. */
export interface ComponentLandscape {
  /** owner/repo of this component */
  componentKey: string;
  functionalities: Array<{ id: string; name: string }>;
  draft: boolean;
  /** description.*.features of publiccode.yml */
  features: string[];
  /** Null when the latest analysis did not measure standards */
  standards: ComponentStandard[] | null;
  /** The other components it can be compared with */
  compareOptions: CompareOption[];
}

const SECTION_CLASS = "bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4";

/** Functionalities, standards and the "Compare with" control of one component. */
export default function FunctionalitiesSection({ landscape }: { landscape: ComponentLandscape }) {
  const { functionalities, draft, features, standards, compareOptions, componentKey } = landscape;
  return (
    <section aria-labelledby="functionalities-heading" className={SECTION_CLASS}>
      <h3 id="functionalities-heading" className="text-lg font-semibold text-gray-800">
        Functionalities and standards
      </h3>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-800">Functionalities</h4>
        {functionalities.length === 0 ? (
          <p className="text-sm text-gray-600">
            None listed yet. Add the GEMMA application services this component provides to the{" "}
            <a href={STATIC_SITE_LINKS.componentList} className="text-cg-lightblue hover:underline">
              component list
            </a>{" "}
            by pull request.
          </p>
        ) : (
          <>
            <ul className="flex flex-wrap gap-2">
              {functionalities.map((functionality) => (
                <li key={functionality.id}>
                  <Link
                    href={functionalityHref(functionality.id)}
                    className="inline-flex min-h-[44px] items-center rounded-full border border-cg-lightblue/40 bg-cg-lightblue/10 px-3 text-xs font-semibold text-cg-blue hover:border-cg-lightblue sm:min-h-[32px]"
                  >
                    {functionality.name}
                  </Link>
                </li>
              ))}
            </ul>
            {draft && (
              <p className="text-xs text-amber-900">This list is a draft. The component owner still has to confirm it.</p>
            )}
          </>
        )}
        {features.length > 0 && (
          <details className="text-sm">
            <summary className="min-h-[44px] cursor-pointer py-2 text-gray-700 sm:min-h-0">
              Features from publiccode.yml ({features.length}), as suggestions
            </summary>
            <ul className="list-disc space-y-1 pl-5 text-gray-700">
              {features.map((feature) => (
                <li key={feature} className="break-words">
                  {feature}
                </li>
              ))}
            </ul>
          </details>
        )}
        <p className="text-xs text-gray-500">
          <Link href={FUNCTIONALITIES_PATH} className="text-cg-lightblue hover:underline">
            See which other components provide the same functionalities
          </Link>
        </p>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-800">Standards</h4>
        {standards === null ? (
          <p className="text-sm text-gray-600">Not measured: the latest scan ran before the checker read standards.</p>
        ) : standards.length === 0 ? (
          <p className="text-sm text-gray-600">
            No standards declared in publiccode.yml and none found in the OpenAPI files.
          </p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
            {standards.map((standard) => (
              <li key={standard.id}>{describeComponentStandard(standard)}</li>
            ))}
          </ul>
        )}
      </div>

      {compareOptions.length > 0 && (
        <form
          method="get"
          action={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${COMPARE_PATH}`}
          className="flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="a" value={componentKey} />
          <div className="flex min-w-0 max-w-full flex-col gap-1">
            <label htmlFor="compare-with" className="text-xs font-semibold text-gray-700">
              Compare with
            </label>
            <select
              id="compare-with"
              name="b"
              defaultValue=""
              required
              className="min-h-[44px] w-72 max-w-full rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-800 focus:border-cg-lightblue focus:outline-none focus:ring-2 focus:ring-cg-lightblue/40"
            >
              <option value="" disabled>
                Choose a component
              </option>
              {compareOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="min-h-[44px] rounded-lg border border-cg-lightblue bg-cg-lightblue/10 px-4 text-sm font-semibold text-cg-blue hover:bg-cg-lightblue/20"
          >
            Compare
          </button>
        </form>
      )}
    </section>
  );
}
