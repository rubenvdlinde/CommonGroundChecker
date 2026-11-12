# Common Ground Checker

<p>
	<img src="./public/icons/Common_gound_logo_rgb.svg" alt="Common Ground" height="20" />
	<img src="./badges/coverage.svg" alt="Coverage" height="20" />
	<img src="./badges/vulnerabilities.svg" alt="Vulnerabilities" height="20" />
</p>

An online automatic compliance checker for [Common Ground](https://commonground.nl) — the Dutch vision and architecture for open, reusable software in municipalities.

## What it checks

Criteria are grouped into five categories. Each criterion has a requirement level (mandatory / recommended / informative) and a configurable weight that influences the overall score.

The rating guide at `/docs` ("Rating guide" in the site navigation) explains per category and aspect what the 1 to 5 star ratings mean, how the checker measures them and which sources they are based on. The content lives in `src/lib/ratingDocs.ts`; every aspect has a stable anchor, `/docs/<category-slug>#<aspect-id>`.

### Governance

| # | Criterion | Level | Standard |
|---|-----------|-------|----------|
| 1 | **OSI-approved open-source license** — LICENSE file with an OSI-approved identifier | Mandatory | [opensource.org/licenses](https://opensource.org/licenses) |
| 2 | **EUPL license preference** — explicit check whether the repository uses the European Union Public Licence | Mandatory | [EU EUPL](https://interoperable-europe.ec.europa.eu/collection/eupl/eupl-text-eupl-12) |
| 28 | **Licence consistency** — LICENSE file, package manifests, publiccode.yml and appinfo/info.xml all name the same SPDX licence | Recommended | [SPDX licence list](https://spdx.org/licenses/) |
| 3 | **Copyright / IP owner disclosure** — probable owner inferred from legal files and metadata | Mandatory | [opensource.guide/legal](https://opensource.guide/legal/) |
| 4 | **publiccode.yml** — government metadata file in the repository root | Mandatory | [Standard for Public Code](https://standard.publiccode.net) |
| 5 | **Contributing guide** — CONTRIBUTING file explaining how to contribute | Mandatory | [GitHub docs](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/setting-guidelines-for-repository-contributors) |
| 6 | **Code of Conduct** — CODE_OF_CONDUCT file present | Mandatory | [opensource.guide](https://opensource.guide/code-of-conduct/) |
| 29 | **SPDX licence headers** — share of source files with an SPDX-License-Identifier header or REUSE coverage, rated in stars (our own bands; REUSE asks for every file) | Recommended | [REUSE specification](https://reuse.software/spec/) |

### Architecture

| # | Criterion | Level | Standard |
|---|-----------|-------|----------|
| 7 | **API-first / OpenAPI spec** — machine-readable OpenAPI or Swagger spec present | Mandatory | [API Design Rules](https://commonground.nl/cms/view/54476259/api-designrules) |
| 8 | **NL API Design Rules (ADR) validation** — OpenAPI / API design is validated against the configured Spectral ruleset | Mandatory | [API Design Rules](https://commonground.nl/cms/view/54476259/api-designrules) |
| 9 | **5-Layer Architecture** — component belongs to a recognised Common Ground layer | Mandatory | [5-lagen model](https://commonground.nl/cms/view/54476261/5-lagen-model) |

### Security

| # | Criterion | Level | Standard |
|---|-----------|-------|----------|
| 10 | **Security policy** — SECURITY file with responsible disclosure info | Mandatory | [GitHub docs](https://docs.github.com/en/code-security/getting-started/adding-a-security-policy-to-your-repository) |
| 11 | **OWASP Secure Coding** — heuristic static analysis checks for common insecure patterns | Mandatory | [OWASP Secure Coding Practices](https://owasp.org/www-project-secure-coding-practices/) |
| 26 | **Open Source Health** — production dependencies from the lockfiles rated from 1 to 5 stars on known vulnerabilities ([OSV.dev](https://osv.dev)), freshness, activity, licence risk and dependency management | Recommended | [Open Source Health model](https://github.com/Software-Improvement-Group/sigridci/blob/main/docs/reference/quality-model-documents/open-source-health.md) |
| 30 | **No committed secrets** — gitleaks scans the working tree for API keys, tokens and private keys, honouring the project's `.gitleaks.toml` | Recommended | [gitleaks](https://github.com/gitleaks/gitleaks) |
| 31 | **OpenSSF Scorecard** — the public OpenSSF Scorecard (0 to 10) rated 1 to 5 stars with this checker's own bands; GitHub repositories only | Recommended | [OpenSSF Scorecard](https://scorecard.dev) |

### Deployment & Operations

| # | Criterion | Level | Standard |
|---|-----------|-------|----------|
| 12 | **Docker support** — Dockerfile (and optionally docker-compose) present | Mandatory | [Haven](https://haven.commonground.nl) |
| 13 | **🐳 Available Docker image** — published registry image URL provided | Mandatory | [Haven](https://haven.commonground.nl) |
| 14 | **CI/CD configuration** — workflow or pipeline config present for automated builds/deployments | Mandatory | [GitHub Actions](https://docs.github.com/en/actions/automating-builds-and-tests/about-github-actions) |
| 15 | **Helm chart (Kubernetes)** — Chart.yaml or K8s manifests present | Mandatory | [Haven](https://haven.commonground.nl) |

### Software Quality

| # | Criterion | Level | Standard |
|---|-----------|-------|----------|
| 16 | **Actual source code** — repository contains real source files, not just documentation or configuration | Mandatory | [commonground.nl](https://www.commonground.nl) |
| 17 | **SBOM** — Software Bill of Materials (SPDX or CycloneDX) published | Mandatory | [CISA SBOM](https://www.cisa.gov/sbom) |
| 18 | **Documentation** — README, docs folder, or external docs URL | Mandatory | [irealisatie.nl](https://www.irealisatie.nl/kennis/common-ground) |
| 19 | **Changelog presence** — changelog or release notes file found in the repository | Recommended | [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) |
| 20 | **Test suite** — automated tests or test configuration present | Mandatory | [GitHub Actions](https://docs.github.com/en/actions/automating-builds-and-tests) |
| 21 | **Code coverage** — coverage report or badge with at least 80% line coverage | Mandatory | [GitHub Actions](https://docs.github.com/en/actions/automating-builds-and-tests) |
| 22 | **Cyclomatic complexity (Lizard)** — average complexity (AvgCCN) is measured and compared against an admin-configurable threshold | Mandatory | [lizard](https://github.com/terryyin/lizard) |
| 23 | **Code metrics** — repository metrics such as lines of code and function count are collected as informative context | Informative | [commonground.nl](https://www.commonground.nl) |
| 24 | **Semantic versioning** — releases or tags following MAJOR.MINOR.PATCH | Mandatory | [semver.org](https://semver.org/) |
| 25 | **Maintainability (ISO 25010)** — unit size, unit complexity, unit interfacing, duplication, module coupling and component structure, each rated from 1 to 5 stars, with an estimated overall maintainability rating | Recommended | [Maintainability model](https://github.com/Software-Improvement-Group/sigridci/blob/main/docs/reference/sig-quality-models.md) |
| 27 | **Test code ratio** — test code lines as a percentage of production code lines, rated from 1 to 5 stars (120/100/75/25% bands; 100% test code is roughly 80% coverage) | Recommended | [ISO 25010](https://iso25000.com/index.php/en/iso-25000-standards/iso-25010) |

**Stars:** every criterion also shows 1 to 5 stars. Maintainability has its own scale (4 stars or more passes, 3 stars warns). The other criteria map pass, warn and fail to 5, 3 and 1 stars. The component as a whole and each category also get a rating; see [Ratings](#ratings).

The maintainability analysis runs `scripts/maintainability/check_maintainability.py`, which needs `python3`, lizard 1.24.3 and jscpd 4.0.5. The Docker image installs them. `MAINTAINABILITY_TIMEOUT_SECONDS` (default 600) caps how long one analysis may run. `node scripts/sync-vendored.mjs <maintainability|open-source-health> [commit]` refreshes a vendored script from its upstream; `UPSTREAM` in its directory records the commit. The Open Source Health analysis (`scripts/open-source-health/`) needs only `python3` and network access to OSV.dev, Packagist, the npm registry and PyPI; `OPEN_SOURCE_HEALTH_TIMEOUT_SECONDS` (default 300) caps it.

**Note:** Only mandatory criteria are included in the overall score. Recommended and informative criteria are shown in the report but do not contribute to the score. Each category is scored as the weighted average of its mandatory criteria (pass = 1, warn or info = 0.5, fail = 0), and the overall score is the weighted average of those category scores, using the default category weights Governance 20%, Architecture 20%, Security 25%, Deployment & Operations 20% and Software Quality 15%.

The levels above are the defaults in `src/lib/checkers/config.ts`; the category weights are in `src/lib/criteria.ts`. When the scoring API answers, its active configuration is used instead, and an administrator can change levels and weights there. The backend's built-in criterion levels are the same as above, but its default category weights (`DEFAULT_CATEGORY_WEIGHTS` in `src/lib/scoring.ts` of CommonGroundCheckerBackend) set Security to 0, so unless the stored configuration sets a Security weight, the Security category does not count towards the score when the backend answers.

## Getting started

1. Install dependencies

```bash
npm install
```

2. Configure the remote API
```
cp .env.local.example .env
```
Edit .env and set `URL` to the remote API server, e.g. `http://localhost:3000`

Edit `GITHUB_TOKEN` if available

3. Install Lizard (required for cyclomatic complexity criterion)
```
py -m pip install lizard
```

4. Start the development server
```
npm run dev
```

Ensure the remote Component Checker Register API is running at the configured URL.

Open [http://localhost:3000](http://localhost:3000) and paste a GitHub repository URL.

A **GitHub personal access token** in `.env` is optional but strongly recommended — the unauthenticated GitHub API rate limit is 60 requests/hour, which is quickly exhausted for newer repos.

## Tech stack

- **Next.js 16 + React 18 + TypeScript** for the app and server API route handlers.
- **Tailwind CSS** for styling.
- **Remote Component Checker Register API** for persistence and scoring configuration.
- **Node.js** runtime for the application and check orchestration.
- **Vitest** for tests and **ESLint** for linting.

## Security scanning

To scan for leaked credentials/secrets locally with Gitleaks:

```bash
# Install Gitleaks once (Windows)
winget install Gitleaks.Gitleaks

# Scan repository history using the local config
npm run security:secrets
```

The scan uses `.gitleaks.toml` and runs with `--redact` so findings are masked in output.

## Tech stack

### Framework and runtime

- **Next.js 16 (App Router)** for UI routes and server API routes in one project.
- **React 18 + TypeScript** for typed UI and domain models.
- **Node.js runtime** for check orchestration and API integrations.

### Data and persistence

- **Remote Component Checker Register API** is responsible for persistence and scoring configuration.
- The local app forwards storage and configuration requests through proxied `/api` endpoints.
- Stored by the remote API:
  - repository metadata and discovered locations
  - per-run analysis results and evidence
  - versioned scoring configurations linked to each run

### UI and developer tooling

- **Tailwind CSS** for styling.
- **Lucide React** for UI icons.
- **Vitest** for tests.
- **ESLint + TypeScript** for static quality checks.

### Analysis dependencies used by checkers

- **GitHub REST API** for repository content, metadata, and refs.
- **Lizard** (Python CLI) for cyclomatic complexity checks.
- **Spectral** (via `npx`) for ADR/OpenAPI style validation use cases.
- **js-yaml** for YAML parsing (`publiccode.yml`, OpenAPI YAML, Helm-related YAML).
- **jsPDF** for client-side PDF export of analysis results.

## Application architecture

The application is built as a single Next.js service with clear layers:

1. **Presentation layer (React pages/components)**
	- Main checker UI (`/`)
	- Admin scoring UI (`/admin`)
	- History UI (`/history` and repository detail pages)

2. **API layer (Next.js route handlers under `/api`)**
	- Validates input, orchestrates checks, persists results, and serves history/config data.

3. **Domain/checker layer (`src/lib/checkers`)**
	- Independent criterion checkers (license, OpenAPI, Docker, Helm, docs, tests, complexity, OWASP, etc.).
	- A central orchestrator combines checker results into one weighted score.

4. **Integration layer**
	- GitHub API client (`src/lib/github.ts`)
	- External tool invocations (Lizard/Spectral)

5. **Persistence layer**
	- Handled by the remote Component Checker Register API; this app proxies storage and scoring config requests through local `/api` routes.

### Architecture diagram

```mermaid
flowchart TB
    subgraph FRONTEND["Component Checker frontend"]
        FRONTEND_UI["Multiple checkers<br/>history<br/>admin"]
    end
    subgraph BACKEND["Component Checker backend"]
        BACKEND_API["API client connects to API"]
        BACKEND_CHECKER["Checker"]
    end
    subgraph API["Remote Component Checker Register API"]
        API_REPOS["/api/repositories"]
        API_HISTORY["/api/repo-history"]
        API_SCORING["/api/admin/scoring"]
    end
    subgraph REGISTER["Component Register"]
        DB[(Remote PostgreSQL database)]
    end

    FRONTEND_UI --> BACKEND_API
    BACKEND_API --> BACKEND_CHECKER
    BACKEND_CHECKER --> API_REPOS
    BACKEND_API --> API_REPOS
    BACKEND_API --> API_HISTORY
    BACKEND_API --> API_SCORING
    API_REPOS --> DB
    API_HISTORY --> DB
    API_SCORING --> DB
```

### Streamed check sequence (`/api/check/stream`)

```mermaid
sequenceDiagram
    participant User as Browser user
    participant UI as Next.js UI (/)
    participant API as /api/check/stream
    participant Orch as Checker orchestrator
    participant GH as GitHub REST API
    participant Tools as Lizard/Spectral
    participant DB as Remote persistence API

    User->>UI: Submit repo URL + options
    UI->>API: POST /api/check/stream
    API-->>UI: stream event: started
    API->>GH: fetch repo metadata + files
    API-->>UI: stream event: repository loaded
    API->>Orch: run criteria checks
    Orch->>GH: read file content/refs (as needed)
    Orch->>Tools: run complexity/validation tools (as needed)
    Orch-->>API: per-criterion results + evidence
    API-->>UI: stream progress events
    API->>DB: persist repo + analysis + scoring config link
    API-->>UI: stream event: completed + final report
```

## APIs

### Internal API endpoints

These local Next.js endpoints either run the checker or proxy storage and configuration requests to the remote Component Checker Register API.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/openapi` | Retrieve the machine-readable OpenAPI specification |
| `POST` | `/api/repositories` | Create or update repository metadata via the remote API |
| `POST` | `/api/repositories/{repoId}/analyses` | Persist a new analysis result for an existing repository via the remote API |
| `POST` | `/api/check` | Run full analysis and persist result through the remote API |
| `POST` | `/api/check/stream` | Stream progress/events during analysis |
| `GET` | `/api/admin/scoring` | Retrieve current scoring configuration from the remote API |
| `POST` | `/api/admin/scoring` | Save new scoring configuration snapshot to the remote API |
| `GET` | `/api/repositories` | List known repositories with latest summary via the remote API |
| `GET` | `/api/repo-history` | Return analysis runs/history for repositories via the remote API |

### ADR Spectral ruleset source (Admin)

On the **Admin** page, the field **"Spectral ruleset source"** controls which ruleset is used for the **NL API Design Rules** check.

- Supported values:
	- URL (for example: `https://static.developer.overheid.nl/adr/ruleset.yaml`)
	- Local file path (for example: `./rulesets/adr.yaml` or `C:/rulesets/adr.yaml`)
- This value is persisted in `ScoringConfig` and applied to new analyses.
- If the field is empty, the app falls back to the default ADR ruleset URL.
- For local file paths, the file must exist on the machine running the app server (not on a remote end-user browser machine).

### External APIs/services

- **GitHub REST API v3** (authenticated with optional `GITHUB_TOKEN`).
- **Remote Component Checker Register API** for persistence and scoring configuration.

### Request flow (high level)

1. User submits repo URL and options in the checker form.
2. `/api/check` (or `/api/check/stream`) parses owner/repo and loads remote repo context from GitHub.
3. Checker orchestrator runs criteria (parallel where possible).
4. Weighted score is computed using the selected/persisted scoring config.
5. Result + evidence is stored through the remote API and returned to UI.
6. History/admin pages query internal APIs to show prior runs and config snapshots.

## Scoring

Each check has a configurable **weight** (0–1) set via the Admin page. Weights are stored by the remote API as versioned snapshots; each analysis run is linked to the exact scoring config used.

For the Lizard complexity criterion, the Admin page also stores a configurable
**average cyclomatic complexity threshold** (AvgCCN). The check passes when a
repository’s measured AvgCCN is at or below this threshold.

Score formula:
```
baseScore = round((Σ statusScore × weight) / (Σ weight) × 100)
score     = min(100, baseScore)
```

Status scores: **Pass** = 1.0 · **Warn / Info** = 0.5 · **Fail** = 0.

| Score | Label |
|-------|-------|
| ≥ 80 | ✅ Compliant |
| 50–79 | ⚠️ Partial |
| < 50 | ❌ Non-compliant |

Above the detailed results, the live report and the stored analysis page list
what is missing in two blocks:

- **Errors**: mandatory criteria with status Fail.
- **Warnings**: recommended criteria with status Fail or Warn, and mandatory
  criteria with status Warn (present but incomplete).

Informative criteria and results with status Info appear in neither block. Each
entry links to its result card, which opens when followed.

## Ratings

Next to the 0-100 compliance score, every analysis gets an **overall rating**, a **rating per category** and a **rating per aspect**, on a continuous scale from 0.5 to 5.5 shown as 1 to 5 stars (for example ★★★☆☆ 3.4). The overall rating is the headline of a report.

Each category consists of aspects, defined in `src/lib/aspects.ts`:

| Category | Aspects |
|---|---|
| Governance | licensing, ownership, community documents |
| Security | vulnerabilities, dependency freshness, activity, licences and management, secrets, secure coding, supply chain |
| Architecture | API, layering (shown, not counted) |
| Maintainability | analysability, modifiability, testability, modularity, reusability, testing |
| Deployment & Operations | containerisation, release management |

- **Criterion rating:** the criterion's continuous rating when it has one, otherwise its stars, otherwise its status: pass = 5, warn = 3, fail = 1. Mandatory and recommended criteria count with their criterion weight; informative criteria, criteria with weight 0 and results that were not measured (`info`) are left out.
- **Aspect rating:** the weighted mean of its criteria. Some aspects are rated by a check itself, such as the maintainability sub-characteristics. A document-count aspect (community documents, containerisation) rates the share of its documents that pass: all 5, at least 80% 4, 60% 3, 40% 2, otherwise 1, and shows the count, for example "4 of 5".
- **Category rating:** the mean of its rated aspects.
- **Overall rating:** the weighted mean of the rated categories with the category weights. Categories with weight 0 don't count.

Ratings are rounded to one decimal; stars round x.5 up. A component **passes** when no mandatory criterion fails and its overall rating is at least 2.5. Analyses stored before ratings existed are rated from their stored results with the active scoring config.

The live report and the stored analysis page show the rating of one component from top to bottom: the overall rating with whether it passes (and why not) and the compliance score, the errors and warnings blocks, and then one section per category. Each category and aspect title links to its page in the rating guide. Every aspect has a bar from 0.5 to 5.5 with marks where the stars change (1.5, 2.5, 3.5 and 4.5), and under it a table of what the aspect is made of:

- **Measured aspects** (the maintainability sub-characteristics): the measured share per property, language and bound, against the thresholds for 5, 4, 3 and 2 stars, and the stars it earns. A check provides these in the `measurements` field of its result; for maintainability they come from the analysis script's report, including its `bands`.
- **Document aspects:** one row per document, found or missing.
- **Other aspects:** one row per criterion with its status and stars, linking to its result card.

The PDF export lists every aspect with its rating.

> **Note:** Automated analysis is indicative only. Architecture checks rely on heuristics. For official certification, contact [commonground.nl](https://commonground.nl).

## License

Copyright © 2026 VNG Realisatie

This project is licensed under the **European Union Public Licence v. 1.2 (EUPL-1.2)**. See [LICENSE](LICENSE) for the full text.
