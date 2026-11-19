export default function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">

      <section className="space-y-3">
        <h2 className="text-2xl font-bold text-cg-blue">About Common Ground</h2>
        <p className="text-gray-700">
          Common Ground is a Dutch government initiative that promotes modern,
          interoperable, and reusable digital public services. Instead of isolated
          monolithic systems, municipalities are encouraged to use open standards,
          modular components, and well-defined APIs so solutions can be shared and
          improved across organizations.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-bold text-cg-blue">Component Checker</h2>
        <p className="text-gray-700">
          The Common Ground Component Checker helps teams quickly assess whether a
          public GitHub repository aligns with key Common Ground practices. It runs
          automated checks (such as open standards, governance files, deployability,
          documentation, and versioning) and produces a transparent score with
          evidence per criterion.
        </p>
        <p className="text-gray-700">
          The goal is to support better decision-making, highlight improvement areas,
          and make reusable public-sector software easier to evaluate over time.
        </p>
      </section>

      <section className="text-sm text-gray-500 border-t border-gray-200 pt-4 space-y-1">
        <p>© 2026 VNG Realisatie</p>
        <p>Author: Hugo W.L. ter Doest</p>
        <p>
          <a
            href="https://github.com/Hugo-ter-Doest/CommonGroundChecker"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cg-lightblue hover:underline"
          >
            View source on GitHub
          </a>
        </p>
      </section>
    </div>
  );
}
