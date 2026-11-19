import Link from "next/link";
import type { LandscapeComponent } from "@/lib/functionalities/overlap";
import { componentHref } from "@/lib/routes";

/** The components that provide a functionality, linked to their page when they have one. */
export default function LandscapeComponentLinks({
  components,
  analysed,
}: {
  components: LandscapeComponent[];
  analysed: Set<string>;
}) {
  return (
    <ul className="flex flex-wrap gap-2">
      {components.map((component) => {
        const key = `${component.owner}/${component.name}`;
        const label = component.displayName ?? key;
        const className =
          "inline-flex min-h-[44px] items-center rounded-full border px-3 text-xs font-semibold sm:min-h-[32px]";
        return (
          <li key={key}>
            {analysed.has(key) ? (
              <Link
                href={componentHref(component.owner, component.name)}
                className={`${className} border-cg-lightblue/40 bg-cg-lightblue/10 text-cg-blue hover:border-cg-lightblue`}
              >
                {label}
              </Link>
            ) : (
              <span className={`${className} border-gray-300 bg-white text-gray-600`}>{label} (not scanned yet)</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
