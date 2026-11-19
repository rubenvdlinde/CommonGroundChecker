import Link from "next/link";
import { STATIC_SITE_LINKS } from "@/lib/dataSource/mode";
import { ADD_COMPONENT_PATH } from "@/lib/routes";

export const EXAMPLE_ENTRY = `  - url: https://github.com/example-org/example-component
    scanRef: latest-release
    hints:
      helm: [charts/example-component]
    providers:
      - name: Example Services
        services: [maintenance, hosting]
        url: https://example.org
        contact: info@example.org`;

const linkClass = "inline-flex items-center min-h-[44px] text-cg-lightblue hover:underline";

/**
 * How a component gets into the static site: a pull request on the component
 * list. Shown on About and on /add-component of the static site, in place of
 * the checker form.
 */
export default function AddComponentPanel({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-sm text-gray-700">
        Missing a component?{" "}
        <Link href={ADD_COMPONENT_PATH} className="text-cg-lightblue hover:underline">
          Add it to the component list
        </Link>{" "}
        with a pull request. It is scanned in the next nightly run.
      </p>
    );
  }
  return (
    <section aria-labelledby="add-component" className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
      <h2 id="add-component" className="text-2xl font-bold text-cg-blue">
        Add your component
      </h2>
      <p className="text-gray-700">
        This site has no scan form. The checker scans the components on its component list, every night. To add a
        component, open a pull request that adds it to{" "}
        <a href={STATIC_SITE_LINKS.componentList} className="text-cg-lightblue hover:underline">
          config/repositories.yml
        </a>
        .
      </p>
      <ol className="list-decimal pl-5 space-y-1 text-gray-700">
        <li>
          <a href={STATIC_SITE_LINKS.editComponentList} className="text-cg-lightblue hover:underline">
            Edit the component list
          </a>{" "}
          and add an entry at the end. Only <code>url</code> is required: the public address of the repository.
        </li>
        <li>Open the pull request. A check tests the entry: the repository must be public, and it should have a publiccode.yml.</li>
        <li>
          After the merge, the component is scanned in the next nightly run, or sooner when a maintainer starts the
          workflow by hand. Its page then appears under Components.
        </li>
      </ol>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-gray-800">Example entry</h3>
        <pre className="overflow-x-auto rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-800">
          <code>{EXAMPLE_ENTRY}</code>
        </pre>
        <p className="text-xs text-gray-500">
          <code>providers</code> lists organisations that offer services on top of the component. A provider adds
          itself with a pull request, and the maintainer of the component may review it. Contracts and SLAs go in{" "}
          <a href={STATIC_SITE_LINKS.slaList} className="text-cg-lightblue hover:underline">
            config/slas.yml
          </a>
          .
        </p>
      </div>
      <div className="flex flex-wrap gap-x-6">
        <a href={STATIC_SITE_LINKS.requestScan} className={linkClass}>
          Request a scan without a pull request
        </a>
        <Link href="/docs/run-without-a-server" className={linkClass}>
          How the static site works
        </Link>
      </div>
    </section>
  );
}
