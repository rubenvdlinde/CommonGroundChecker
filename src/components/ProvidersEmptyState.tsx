import Link from "next/link";
import { IS_STATIC_SITE } from "@/lib/dataSource/mode";
import { ADD_COMPONENT_PATH } from "@/lib/routes";

/** What the Providers page shows while the component list is empty. */
export default function ProvidersEmptyState() {
  return (
    <section
      aria-labelledby="no-providers"
      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-3"
    >
      <h3 id="no-providers" className="text-lg font-semibold text-gray-800">
        No components yet
      </h3>
      <p className="text-sm text-gray-700">
        Providers appear here as soon as a component is on the list. Each repository owner becomes a provider.
      </p>
      <p className="text-sm text-gray-700">
        <Link href={IS_STATIC_SITE ? ADD_COMPONENT_PATH : "/about#check"} className="text-cg-lightblue hover:underline">
          Add a component
        </Link>
      </p>
    </section>
  );
}
