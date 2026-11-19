import type { Metadata } from "next";
import Link from "next/link";
import { minUsers, organisationsLabel } from "@/lib/maintained";
import { RATING_DOCS } from "@/lib/ratingDocs";
import { PATH_DOC_HREF } from "@/lib/pathDocs";
import { TOOLS_DOC_HREF } from "@/lib/toolsDocs";

export const metadata: Metadata = {
  title: "Rating guide | Common Ground Component Checker",
  description: "What the 1 to 5 star ratings of the checker mean and how they are measured.",
};

export default function RatingGuidePage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-bold text-cg-blue">Rating guide</h1>
        <p className="text-gray-700">
          The checker rates a component from 1 to 5 stars in five categories. Each category is made up of
          aspects, and each aspect is rated from one or more criteria. These pages explain, per aspect, what it
          means, how the checker measures it and which sources it is based on.
        </p>
        <p className="text-gray-700">
          The ratings are an estimate made with open tools. They are not a SIG rating and not a certification.
        </p>
      </section>

      <section aria-labelledby="categories" className="space-y-3">
        <h2 id="categories" className="text-2xl font-bold text-cg-blue">
          Categories
        </h2>
        <ul className="space-y-3">
          {RATING_DOCS.map((category) => (
            <li key={category.slug} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-2">
              <Link href={`/docs/${category.slug}`} className="text-lg font-semibold text-cg-lightblue hover:underline">
                {category.title}
              </Link>
              <p className="text-gray-700">{category.summary}</p>
              <p className="text-sm text-gray-600">
                Aspects: {category.aspects.map((aspect) => aspect.title).join(", ")}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="tools-and-models" className="space-y-3">
        <h2 id="tools-and-models" className="text-2xl font-bold text-cg-blue">
          Tools and models
        </h2>
        <p className="text-gray-700">
          <Link href={TOOLS_DOC_HREF} className="text-cg-lightblue hover:underline">
            Tools and models
          </Link>{" "}
          names the tools behind each measure, where the checker deviates from the SIG/TÜV NORD model and why, and
          the tools that were tested and rejected.
        </p>
      </section>

      <section aria-labelledby="common-ground-path" className="space-y-3">
        <h2 id="common-ground-path" className="text-2xl font-bold text-cg-blue">
          The path to Common Ground
        </h2>
        <p className="text-gray-700">
          <Link href={PATH_DOC_HREF} className="text-cg-lightblue hover:underline">
            The path to Common Ground
          </Link>{" "}
          explains which version the checker measures, when a component is suitable or Maintained, how maintenance
          is measured and who decides what is in the checklist.
        </p>
      </section>

      <section aria-labelledby="how-ratings-work" className="space-y-3">
        <h2 id="how-ratings-work" className="text-2xl font-bold text-cg-blue">
          How ratings work
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-gray-700">
          <li>
            Every criterion gets a rating from 0.5 to 5.5. Checks with a scale of their own use it. Other checks
            rate a pass as 5, a warning as 3 and a fail as 1.
          </li>
          <li>
            <strong>A normal aspect</strong> is rated as the weighted mean of its criteria.
          </li>
          <li>
            <strong>A document aspect</strong> (community documents and containerisation) is rated by the share of
            the documents found. All found is 5 stars, at least 80% is 4, at least 60% is 3, at least 40% is 2, and
            less is 1.
          </li>
          <li>
            <strong>A category</strong> is rated as the mean of its aspects.
          </li>
          <li>
            <strong>The overall rating</strong> is the weighted mean of the categories.
          </li>
          <li>
            <strong>A component is suitable for Common Ground</strong> when every mandatory item is present, the
            overall rating is at least 2.5, publiccode.yml declares a valid maintenance contract, and the estimated
            maintainability is at least 4 stars (a rating of 3.5 or more). 2.5 is 3 stars, as the SIG models count 3
            stars from 2.5. 4 stars is the level at which SIG and TÜViT certify maintainability. The checker does not
            certify: certification is a manual assessment by SIG and TÜViT, and the checker only estimates whether a
            component looks ready for it. Whether adoption into Common Ground needs a SIG certificate is up to VNG as
            regievoerder. The ALV papers do not ask for one. A scan without a
            maintainability rating, for example because no source code in a supported language was found, is not
            yet suitable. The maintainability rating is an estimate that is not calibrated against real audits.
            Suitable for Common Ground is the threshold the Common Ground programme uses to decide whether to adopt
            a component as supported. It is not a condition for being listed: a component that is not yet suitable
            is still listed.
          </li>
          <li>
            <strong>A component is Maintained</strong>, the level above suitable, when it is suitable for Common
            Ground, its publiccode.yml declares the development status stable and at least{" "}
            {organisationsLabel(minUsers())} under usedBy, and there is a valid SLA with a maintainer, on the VNG
            model contract. VNG does not contract the maintainer: municipalities do, on the VNG model contracts and
            framework agreements. The usedBy list is self-declared by the maintainers and not verified. An SLA is
            valid up to and including its end date. The minimum follows the Common Ground standard put to the VNG
            ALV: a component is proven in practice by one or more municipalities. The checker counts usage only here:
            it never gives stars and never counts in a rating.
          </li>
        </ul>
        <p className="text-gray-700">
          Ratings are rounded to whole stars for display. A rating of 3.5 or more shows as 4 stars.
        </p>
      </section>
      <section aria-labelledby="without-a-server" className="space-y-3">
        <h2 id="without-a-server" className="text-2xl font-bold text-cg-blue">
          Run the checker without a server
        </h2>
        <p className="text-gray-700">
          The checker also runs as a static site, scanned every night from a component list in the repository.{" "}
          <Link href="/docs/run-without-a-server" className="text-cg-lightblue hover:underline">
            How the static site works, and how to add your component
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
