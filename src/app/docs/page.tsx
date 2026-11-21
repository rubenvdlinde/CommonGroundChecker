import type { Metadata } from "next";
import Link from "next/link";
import { organisationsLabel } from "@/lib/maintained";
import { MIN_USERS_FOR_SUITABLE } from "@/lib/ratings";
import { CHECKLIST_CHANGE_PROPOSAL_URL, CHECKLIST_VERSION } from "@/lib/criteria";
import { RATING_DOCS, RATING_SCALE } from "@/lib/ratingDocs";
import { PATH_DOC_HREF } from "@/lib/pathDocs";
import { TOOLS_DOC_HREF } from "@/lib/toolsDocs";
import { CRITERIA_DOC_HREF } from "@/lib/criterionDocs";
import { PUBLICCODE_PROFILE_PATH } from "@/lib/publiccodeProfile";

export const metadata: Metadata = {
  title: "Rating guide | Common Ground Component Checker",
  description: "What the ratings of the checker, from 0.5 to 5.5, mean and how they are measured.",
};

export default function RatingGuidePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-bold text-cg-blue">Rating guide</h1>
        <p className="text-gray-700">
          The checker rates a component from 0.5 to 5.5, shown as 1 to 5 stars, in five categories. Each category is made up of
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
            <li key={category.slug} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-2">
              <Link href={`/docs/${category.slug}`} className="inline-flex min-h-[44px] items-center lg:min-h-0 text-lg font-semibold text-cg-lightblue hover:underline">
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

      <section aria-labelledby="criteria" className="space-y-3">
        <h2 id="criteria" className="text-2xl font-bold text-cg-blue">
          Criteria
        </h2>
        <p className="text-gray-700">
          <Link href={CRITERIA_DOC_HREF} className="text-cg-lightblue hover:underline">
            Every criterion has its own page
          </Link>
          : what the checker looks at, why it matters, where it comes from, its level and how to pass it.
        </p>
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

      <section aria-labelledby="for-maintainers" className="space-y-3">
        <h2 id="for-maintainers" className="text-2xl font-bold text-cg-blue">
          For maintainers
        </h2>
        <p className="text-gray-700">
          <Link href={PUBLICCODE_PROFILE_PATH} className="font-semibold text-cg-lightblue hover:underline">
            The Common Ground profile for publiccode.yml
          </Link>{" "}
          explains how to fill publiccode.yml so the checker can read it: the release, the maintenance contract, the
          users, the Common Ground layer and the standards and versions the component supports.
        </p>
      </section>

      <section aria-labelledby="how-ratings-work" className="space-y-3">
        <h2 id="how-ratings-work" className="text-2xl font-bold text-cg-blue">
          How ratings work
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-gray-700">
          <li>
            Every criterion gets a rating from 0.5 to 5.5. Checks with a scale of their own use it. Other checks
            rate a pass as 5.5, a warning as 3 and a fail as 0.5, the ends and the middle of the scale.
          </li>
          <li>
            <strong>A measured property</strong> of maintainability or Open Source Health is rated on a straight
            line between its star limits: a share exactly at the 4-star limit rates 3.5, and a perfect result 5.5.
          </li>
          <li>
            <strong>A normal aspect</strong> is rated as the weighted mean of its criteria.
          </li>
          <li>
            <strong>A document aspect</strong> (community documents and containerisation) is rated by the share of
            the documents found. All found is 5.5, at least 80% is 4, at least 60% is 3, at least 40% is 2, and
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
            maintainability is at least 4 stars (a rating of 3.5 or more). publiccode.yml must also declare
            developmentStatus stable and name at least {organisationsLabel(MIN_USERS_FOR_SUITABLE)} under usedBy.
            2.5 is 3 stars, as the SIG models count 3
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
            Ground and VNG decided to take it into management. The SLA with a maintainer, on the VNG model contract,
            follows that decision. Without a decision a component is at most Suitable. Stable and the users come
            with Suitable. VNG does not contract the maintainer: municipalities do, on the VNG model contracts and
            framework agreements. The usedBy list is self-declared by the maintainers and not verified. An SLA is
            valid up to and including its end date. After the decision a missing SLA gets a fix term. The checker counts usage only in the verdict: it never gives
            stars and never counts in a rating.
          </li>
        </ul>
        <p className="text-gray-700">
          {RATING_SCALE.text} Ratings are rounded to whole stars for display, so a rating of 3.5 or more shows as 4
          stars. Source:{" "}
          <a href={RATING_SCALE.source.url} className="text-cg-lightblue hover:underline">
            {RATING_SCALE.source.title}
          </a>
          .
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
