import type { Metadata } from "next";
import Link from "next/link";
import { CHECKLIST_CHANGE_PROPOSAL_URL, CHECKLIST_VERSION } from "@/lib/criteria";
import { RATING_DOCS } from "@/lib/ratingDocs";

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
        </ul>
        <p className="text-gray-700">
          Ratings are rounded to whole stars for display. A rating of 3.5 or more shows as 4 stars.
        </p>
      </section>

      <section aria-labelledby="checklist-versions" className="space-y-3">
        <h2 id="checklist-versions" className="text-2xl font-bold text-cg-blue">
          The checklist and its versions
        </h2>
        <p className="text-gray-700">
          What the checker measures decides which components are called suitable for Common Ground. Buyers,
          suppliers and municipalities rely on it, so the checklist works like a standard. It changes through the
          change process of the Common Ground standard put to the VNG ALV of 11 December 2026.
        </p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700">
          <li>
            <strong>Versions.</strong> The checklist has a version number. This is version {CHECKLIST_VERSION}. Every
            analysis records the version it was measured against, and the run page shows it. Analyses from before
            the checklist had versions show version unknown.
          </li>
          <li>
            <strong>Transition period.</strong> A new mandatory criterion, or a stricter threshold, can get a date
            from which it counts. Until that date a fail shows as a warning that says when it becomes mandatory. It
            does not fail the mandatory items and does not block the verdict. A component that is suitable stays
            suitable until the end of the transition period, so its maintainers have time to fix it.
          </li>
          <li>
            <strong>Proposals.</strong> Anyone can propose a change: a new criterion, another threshold or weight, or
            the removal of a criterion. A proposal says what changes, why, what it does to the components that were
            measured, and which transition period it proposes.
          </li>
          <li>
            <strong>Decisions.</strong> VNG, as regievoerder, organises the input of municipalities and decides within
            the mandate of the ALV. The VNG board sets the priorities, advised by the Commissie
            Informatiesamenleving. The College voor Dienstverleningszaken assesses new standards and is the route to
            national standardisation. A change outside the mandate goes to the ALV.
          </li>
        </ul>
        <p className="text-gray-700">
          <a
            href={CHECKLIST_CHANGE_PROPOSAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-cg-lightblue hover:underline"
          >
            Propose a change to the checklist
          </a>
        </p>
      </section>
    </div>
  );
}
