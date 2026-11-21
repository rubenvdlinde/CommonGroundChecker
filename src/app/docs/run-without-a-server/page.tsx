import type { Metadata } from "next";
import Link from "next/link";
import AddComponentPanel, { EXAMPLE_ENTRY } from "@/components/AddComponentPanel";
import { STATIC_SITE_LINKS } from "@/lib/dataSource/mode";

export const metadata: Metadata = {
  title: "Run the checker without a server | Common Ground Component Checker",
};

const h2 = "text-2xl font-bold text-cg-blue";
const p = "text-gray-700";
const code = "overflow-x-auto rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-800";

/** How the static mode works, how to configure it and what it cannot do. */
export default function RunWithoutAServerPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <section className="space-y-3">
        <Link href="/docs" className="inline-flex items-center min-h-[44px] text-sm text-cg-lightblue hover:underline">
          ← Rating guide
        </Link>
        <h1 className="text-3xl font-bold text-cg-blue">Run the checker without a server</h1>
        <p className={p}>
          The checker can run as a static site: plain files, no server and no database. A scheduled workflow scans
          every component on the component list, writes the results as JSON files and builds the site from them.
          Any static host can serve it, such as GitHub Pages.
        </p>
        <p className={p}>
          The server mode stays. Whoever runs the server keeps the scan form, the admin pages and the rescan webhook.
        </p>
      </section>

      <section aria-labelledby="how" className="space-y-3">
        <h2 id="how" className={h2}>How it works</h2>
        <ol className="list-decimal pl-5 space-y-1 text-gray-700">
          <li>
            The component list, <code>config/repositories.yml</code>, says which repositories to scan. SLAs are in{" "}
            <code>config/slas.yml</code>. Both change by pull request, and a check validates them.
          </li>
          <li>
            Every night at 03:00 Amsterdam time, and when a maintainer starts it by hand, the workflow runs{" "}
            <code>npm run scan:static</code>. It scans each repository with the same checks as the server and writes
            the data files.
          </li>
          <li>
            When the scanned commit did not change since the last scan, it copies the code checks from there and runs
            only the checks that depend on the outside world, such as known vulnerabilities, the Docker image and usage.
            Every 7 days, after a change of the checker or its tools, and when a maintainer starts the workflow with{" "}
            <strong>full</strong> ticked, it runs every check.
          </li>
          <li>
            It compares each scan with the previous scan of the same kind of ref and the same checklist version. A
            criterion that went from pass to fail, a rating that lost a star, or a lost verdict is recorded as a drop,
            with the same fix terms as the server.
          </li>
          <li>
            It commits the data files to the <code>data</code> branch, builds the site with{" "}
            <code>npm run build:static</code> and publishes it.
          </li>
        </ol>
      </section>

      <section aria-labelledby="data" className="space-y-3">
        <h2 id="data" className={h2}>The data files</h2>
        <pre className={code}>
          <code>{`data/index.json                                      one entry per repository
data/repositories/<host>/<owner>/<repo>/latest.json  the latest analysis in full
data/repositories/<host>/<owner>/<repo>/history.json a short summary per analysis, and the drops`}</code>
        </pre>
        <p className={p}>
          latest.json has the same shape as the API, so the pages read both the same way. history.json keeps per
          analysis only the date, version, scanned ref, checklist version, score, ratings, verdict, Maintained level,
          counts and open drops. Older runs show as a summary; only the latest run has a detail page. The files are
          published with the site, under <code>/data</code>, so anyone can reuse them.
        </p>
        <p className={p}>
          The data lives on its own branch so nightly commits do not fill the history of the code, and a pull request
          on the code never conflicts with them.
        </p>
      </section>

      <section aria-labelledby="add" className="space-y-3">
        <h2 id="add" className={h2}>Add your component</h2>
        <p className={p}>
          Open a pull request on the{" "}
          <a href={STATIC_SITE_LINKS.componentList} className="text-cg-lightblue hover:underline">
            component list
          </a>{" "}
          that adds an entry. Only <code>url</code> is required. For example:
        </p>
        <pre className={code}>
          <code>{EXAMPLE_ENTRY}</code>
        </pre>
        <ul className="list-disc pl-5 space-y-1 text-gray-700">
          <li>
            <code>scanRef</code>: what to scan, <code>latest-release</code>, <code>default-branch</code>, or a branch or
            tag name.
          </li>
          <li>
            <code>hints</code>: paths the checker would not find on its own: <code>helm</code>, <code>docker</code>,{" "}
            <code>docs</code> and <code>apiSpecs</code>.
          </li>
          <li>
            <code>register</code>: true for a register, whose API specification is checked as one.
          </li>
          <li>
            <code>basisset</code>: true when the component is in the Common Ground basisset.
          </li>
          <li>
            <code>maintained</code>: VNG decided to take the component into management. <code>since</code> is the day
            of the decision (YYYY-MM-DD), <code>decision</code> the https link to the published decision. Without it a
            component is at most Suitable. A component that should no longer be followed is removed from the list;
            its history stays.
          </li>
          <li id="providers" className="scroll-mt-6">
            <code>providers</code>: optional services an organisation offers for the component. Each has a{" "}
            <code>name</code> and one or more <code>services</code>: maintenance, support, hosting, implementation or
            training. <code>url</code>, <code>contact</code> (a general address, no personal data) and{" "}
            <code>since</code> are optional. The provider of a component is always the owner of its repository; these
            entries show as &quot;Also offers&quot;.
          </li>
        </ul>
        <p className={p}>
          The pull request check validates the file against its schema, rejects duplicates, and tests that a new or
          changed repository is public. A missing publiccode.yml is a warning, not an error. After the merge, the
          component is scanned in the next nightly run, or sooner when a maintainer starts the workflow by hand.
        </p>
        <AddComponentPanel compact />
      </section>

      <section aria-labelledby="tradeoffs" className="space-y-3">
        <h2 id="tradeoffs" className={h2}>Trade-offs</h2>
        <ul className="list-disc pl-5 space-y-1 text-gray-700">
          <li>No scan on request. Results are at most one night old, or a manual run of the workflow.</li>
          <li>No admin pages. Scoring, the component list and SLAs change by pull request.</li>
          <li>Older runs keep a summary only. Their full results stay in the history of the data branch.</li>
          <li>
            The scans use the token of the workflow for the GitHub API. GitHub limits the requests per hour of that
            token, so a long list may need a token with a higher limit.
          </li>
          <li>
            The workflow uses Actions minutes, and GitHub stops a job after 6 hours. The runner scans one repository at
            a time by default and stops a single scan after 45 minutes; raise <code>--concurrency</code> for a long
            list.
          </li>
          <li>GitHub may delay scheduled runs at busy times, and switches them off in a repository without activity for 60 days.</li>
        </ul>
      </section>

      <section aria-labelledby="server" className="space-y-3">
        <h2 id="server" className={h2}>With a server</h2>
        <p className={p}>
          Whoever runs the server adds components with the scan form, and the backend has a webhook route,{" "}
          <code>POST /api/webhook</code>. With it a repository registers itself for scheduled rescans and starts a
          rescan from its own CI, from GitHub Actions, GitLab CI or any other pipeline. The backend README describes
          the token and the request.
        </p>
      </section>

      <section aria-labelledby="forgejo" className="space-y-3">
        <h2 id="forgejo" className={h2}>Hosting on code.overheid.nl</h2>
        <p className={p}>
          code.overheid.nl runs Forgejo (version 15.0.11, as its API reports), and Actions is switched on for
          repositories there. Forgejo Actions reads workflows in the GitHub syntax from <code>.forgejo/workflows</code>.
          The scan and build steps are plain shell and would run there unchanged. Not verified yet: whether shared
          runners are available, and where Forgejo would serve the site, because <code>actions/deploy-pages</code> is
          specific to GitHub Pages.
        </p>
      </section>
    </div>
  );
}
