import Link from "next/link";
import { SOURCE_REPOSITORY_URL, STATIC_SITE_LINKS, CONFIG_BRANCH } from "@/lib/dataSource/mode";

/** What the Providers page shows while no component lists a provider: how a provider adds itself. */
export default function ProvidersEmptyState() {
  return (
    <section
      aria-labelledby="no-providers"
      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-3"
    >
      <h3 id="no-providers" className="text-lg font-semibold text-gray-800">
        No providers listed yet
      </h3>
      <p className="text-sm text-gray-700">
        No component in the component list names a provider yet. A provider adds itself with a pull request:
      </p>
      <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-700">
        <li>
          Open{" "}
          <a href={STATIC_SITE_LINKS.editComponentList} className="text-cg-lightblue hover:underline">
            config/repositories.yml
          </a>{" "}
          and find the component you serve.
        </li>
        <li>
          Add a <code>providers</code> entry with your <code>name</code> and your <code>services</code>: maintenance,
          support, hosting, implementation or training. A <code>url</code>, a general <code>contact</code> address and{" "}
          <code>since</code> are optional. Do not add personal data.
        </li>
        <li>
          Open the pull request and fill in the{" "}
          <a
            href={`${SOURCE_REPOSITORY_URL}/blob/${CONFIG_BRANCH}/.github/PULL_REQUEST_TEMPLATE/add-component.md`}
            className="text-cg-lightblue hover:underline"
          >
            pull request template
          </a>
          . The maintainer of the component may review it.
        </li>
      </ol>
      <p className="text-sm text-gray-700">
        <Link href="/docs/run-without-a-server#providers" className="text-cg-lightblue hover:underline">
          Read how the providers field works
        </Link>
      </p>
    </section>
  );
}
