import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  artifactHubBaseUrl,
  checkArtifactHub,
  containerComponentReason,
  countSeverities,
  findArtifactHubLinks,
  parseArtifactHubRepositoryId,
} from "@/lib/checkers/artifactHub";
import type { RepoContext } from "@/lib/providers/types";

/** Responses recorded from artifacthub.io on 19 November 2026, trimmed to the fields the check reads. */
const FIXTURES = path.join(__dirname, "../../fixtures/artifacthub");

function fixture(name: string): string | null {
  try {
    return readFileSync(path.join(FIXTURES, name), "utf8");
  } catch {
    return null;
  }
}

/** Serves the recorded Artifact Hub API: a fixture per path, a 404 for a package without one, an empty body for a missing report. */
function recordedArtifactHub(base = "https://artifacthub.io", overrides: Record<string, string | null> = {}) {
  const packageIds = new Map<string, string>();
  for (const name of ["open-zaak-open-zaak", "podinfo-podinfo", "signalen-backend", "wearefrank-zaakbrug", "commonground-gateway-commonground-gateway"]) {
    const pkg = JSON.parse(fixture(`package-${name}.json`)!);
    packageIds.set(`${pkg.package_id}/${pkg.version}`, name);
  }
  return vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    expect(url.origin).toBe(new URL(base).origin);
    const apiPath = url.pathname.replace(/^.*\/api\/v1/, "");
    if (apiPath in overrides) {
      const body = overrides[apiPath];
      return body === null ? new Response("", { status: 404 }) : new Response(body, { status: 200 });
    }
    let body: string | null = null;
    if (apiPath === "/packages/search") {
      body = fixture(`search-${url.searchParams.get("ts_query_web")}.json`) ?? JSON.stringify({ packages: [] });
    } else if (apiPath.startsWith("/packages/helm/")) {
      const [repository, name] = apiPath.slice("/packages/helm/".length).split("/");
      body = fixture(`package-${repository}-${name}.json`);
    } else if (apiPath.endsWith("/security-report")) {
      const key = apiPath.slice("/packages/".length, -"/security-report".length);
      const name = packageIds.get(key);
      return new Response((name && fixture(`security-report-${name}.json`)) ?? "", { status: 200 });
    }
    return body === null ? new Response("", { status: 404 }) : new Response(body, { status: 200 });
  });
}

function contextFor(owner: string, repo: string, files: Record<string, string> = {}): RepoContext {
  return {
    owner,
    repo,
    projectPath: `${owner}/${repo}`,
    repoUrl: `https://github.com/${owner}/${repo}`,
    provider: {
      getFileContent: vi.fn(async (_context: RepoContext, filePath: string) => files[filePath] ?? null),
    },
  } as unknown as RepoContext;
}

const NOW = new Date("2026-11-19T12:00:00Z");

describe("checkArtifactHub", () => {
  let fetchMock: ReturnType<typeof recordedArtifactHub>;

  beforeEach(() => {
    fetchMock = recordedArtifactHub();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("is not applicable to a Nextcloud app, even with a Dockerfile, and asks Artifact Hub nothing", async () => {
    const result = await checkArtifactHub(contextFor("ConductionNL", "openregister"), ["appinfo/info.xml", "docker/dolphin/Dockerfile"], { now: NOW });

    expect(result.id).toBe("artifacthub");
    expect(result.status).toBe("info");
    expect(result.message).toMatch(/^Not applicable: this is a Nextcloud app/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is not applicable to a repository without a Dockerfile, chart or image", async () => {
    const result = await checkArtifactHub(contextFor("org", "library"), ["src/index.ts", "package.json"], { now: NOW });

    expect(result.status).toBe("info");
    expect(result.message).toContain("not a container component");
  });

  it("passes podinfo: matched by its source link, no critical vulnerabilities, counts per image and the scan date", async () => {
    const context = contextFor("stefanprodan", "podinfo", { "charts/podinfo/Chart.yaml": "apiVersion: v2\nname: podinfo\n" });
    const result = await checkArtifactHub(context, ["Dockerfile", "charts/podinfo/Chart.yaml"], { now: NOW });

    expect(result.status).toBe("pass");
    expect(result.message).toBe(
      "Artifact Hub scanned the image of podinfo/podinfo 6.17.0 with Trivy on 18 November 2026: no critical vulnerabilities. In total: 0 critical, 3 high, 3 medium, 0 low, 2 unknown."
    );
    expect(result.referenceUrl).toBe("https://artifacthub.io/packages/helm/podinfo/podinfo");
    expect(result.evidence).toContain("ghcr.io/stefanprodan/podinfo:6.17.0: 0 critical, 3 high, 3 medium, 0 low, 2 unknown");
    expect(result.evidence).toContain(
      "Matched because the package's chart repository (https://stefanprodan.github.io/podinfo) points at stefanprodan/podinfo"
    );
    expect(result.evidence).toContain("Scanned with Trivy on 18 November 2026");
  });

  it("does not take a package with the same name from another publisher", async () => {
    const result = await checkArtifactHub(contextFor("someone", "podinfo"), ["Dockerfile"], { now: NOW });
    expect(result.status).toBe("fail");
    expect(result.message).toBe(
      "No Helm package on Artifact Hub belongs to this repository. Searched for podinfo. Register the Helm chart on Artifact Hub, and link the package from publiccode.yml or the README if its name differs."
    );
  });

  it("does not measure Open Zaak: the latest version on Artifact Hub is older than one year, and says how it matched", async () => {
    const result = await checkArtifactHub(contextFor("open-zaak", "open-zaak"), ["Dockerfile", "publiccode.yaml"], { now: NOW });

    expect(result.status).toBe("warn");
    expect(result.message).toBe(
      "Not measured: the latest version on Artifact Hub, open-zaak/open-zaak 0.8.0, was released on 11 April 2022. Artifact Hub does not scan versions older than one year. Publish a new chart version."
    );
    expect(result.evidence).toContain(
      "Matched because the package is named open-zaak and its chart repository (https://open-zaak.github.io/charts/) belongs to the same owner, open-zaak"
    );
    expect(result.evidence).toContain(
      "The last report is from 10 April 2023: 89 critical, 574 high, 487 medium, 1117 low, 9 unknown. It is no longer updated."
    );
  });

  it("fails on critical vulnerabilities and lists the images with their counts", async () => {
    const result = await checkArtifactHub(contextFor("open-zaak", "open-zaak"), ["Dockerfile"], {
      now: new Date("2022-06-01T00:00:00Z"),
    });

    expect(result.status).toBe("fail");
    expect(result.message).toBe(
      "Artifact Hub scanned all 3 images of open-zaak/open-zaak 0.8.0 with Trivy on 10 April 2023: 89 critical vulnerabilities, in openzaak/open-zaak:1.6.0 (35), docker.io/bitnami/postgresql:11.13.0-debian-10-r73 (29), docker.io/bitnami/redis:6.2.1-debian-10-r36 (25). In total: 89 critical, 574 high, 487 medium, 1117 low, 9 unknown."
    );
    expect(result.evidence).toContain("openzaak/open-zaak:1.6.0: 35 critical, 405 high, 370 medium, 879 low, 1 unknown");
  });

  it("takes an external chart location as the repository the package must point at", async () => {
    const result = await checkArtifactHub(contextFor("maykinmedia", "something"), [], {
      helmChartLocations: ["https://github.com/open-zaak/charts/tree/main/charts/open-zaak"],
      now: new Date("2022-06-01T00:00:00Z"),
    });

    expect(result.status).toBe("fail");
    expect(result.evidence).toContain(
      "Matched because the package's chart repository (https://open-zaak.github.io/charts/) points at open-zaak/charts"
    );
  });

  it("prefers an Artifact Hub link in the README to a chart of the same owner over a search", async () => {
    const context = contextFor("stefanprodan", "podinfo-app", {
      "README.md": "[![Artifact Hub](https://img.shields.io/badge)](https://artifacthub.io/packages/helm/podinfo/podinfo)",
    });
    const result = await checkArtifactHub(context, ["README.md", "Dockerfile"], { now: NOW });

    expect(result.status).toBe("pass");
    expect(result.evidence).toContain("Matched because README.md links to it on Artifact Hub");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/packages/search"))).toBe(false);
  });

  it("takes a README link to another owner's chart for a dependency, and searches on", async () => {
    const context = contextFor("someone", "component", {
      "README.md": "Install the database first: https://artifacthub.io/packages/helm/podinfo/podinfo",
    });
    const result = await checkArtifactHub(context, ["README.md", "Dockerfile"], { now: NOW });

    expect(result.status).toBe("fail");
    expect(result.evidence).toContain(
      "README.md links to podinfo/podinfo, which has another name and owner, so it is taken for a dependency"
    );
  });

  it("trusts a link in publiccode.yml", async () => {
    const context = contextFor("someone", "component", {
      "publiccode.yml": "url: https://github.com/someone/component\n# https://artifacthub.io/packages/helm/podinfo/podinfo\n",
    });
    const result = await checkArtifactHub(context, ["publiccode.yml", "Dockerfile"], { now: NOW });

    expect(result.status).toBe("pass");
    expect(result.evidence).toContain("Matched because publiccode.yml links to it on Artifact Hub");
  });

  it("matches on the repositoryID in artifacthub-repo.yml", async () => {
    const context = contextFor("org", "podinfo", {
      "charts/artifacthub-repo.yml": "repositoryID: 6fee1008-3f69-41f1-bb1e-f4606fc17403\n",
    });
    const result = await checkArtifactHub(context, ["Dockerfile", "charts/artifacthub-repo.yml"], { now: NOW });

    expect(result.status).toBe("pass");
    expect(result.evidence).toContain(
      "Matched because the repositoryID in artifacthub-repo.yml is the package's Artifact Hub repository"
    );
  });

  it("finds Signalen's backend among many packages called backend, and does not measure it: the scanner is off", async () => {
    const result = await checkArtifactHub(contextFor("Signalen", "backend"), ["Dockerfile"], { now: NOW });

    expect(result.status).toBe("warn");
    expect(result.message).toBe(
      "Not measured: the security scanner is switched off for the Artifact Hub repository of signalen/backend 4.26.0. Its publisher can switch it on."
    );
  });

  it("does not measure a chart without images: Zaakbrug", async () => {
    const result = await checkArtifactHub(contextFor("wearefrank", "zaakbrug"), ["Dockerfile"], { now: NOW });

    expect(result.status).toBe("warn");
    expect(result.message).toBe(
      "Not measured: Artifact Hub found no container images in wearefrank/zaakbrug 2.3.37. List them in the artifacthub.io/images annotation of Chart.yaml."
    );
  });

  it("does not measure a version without a security report", async () => {
    const result = await checkArtifactHub(contextFor("ConductionNL", "commonground-gateway"), ["Dockerfile"], {
      now: new Date("2024-01-01T00:00:00Z"),
    });

    expect(result.status).toBe("warn");
    expect(result.message).toBe(
      "Not measured: Artifact Hub has no security report for commonground-gateway/commonground-gateway 1.5.4 yet. A new version is scanned within the hour; check that its images are public."
    );
  });

  it("does not measure more than 15 images, private repositories or a report that misses an image", async () => {
    const pkg = JSON.parse(fixture("package-podinfo-podinfo.json")!);
    const many = { ...pkg, containers_images: Array.from({ length: 16 }, (_, index) => ({ image: `img/${index}:1` })) };
    const privateRepo = { ...pkg, repository: { ...pkg.repository, private: true } };
    const extraImage = { ...pkg, containers_images: [...pkg.containers_images, { image: "ghcr.io/big/image:1" }] };
    const run = async (body: unknown) => {
      vi.stubGlobal("fetch", recordedArtifactHub(undefined, { "/packages/helm/podinfo/podinfo": JSON.stringify(body) }));
      return checkArtifactHub(contextFor("stefanprodan", "podinfo"), ["Dockerfile"], { now: NOW });
    };

    expect((await run(many)).message).toBe(
      "Not measured: podinfo/podinfo 6.17.0 uses 16 images. Artifact Hub does not scan a version with more than 15."
    );
    expect((await run(privateRepo)).message).toMatch(/^Not measured: the Artifact Hub repository of podinfo\/podinfo 6.17.0 is private/);
    const partial = await run(extraImage);
    expect(partial.status).toBe("warn");
    expect(partial.message).toContain("but ghcr.io/big/image:1 was not scanned");
    expect(partial.evidence).toContain("ghcr.io/big/image:1: not scanned (private, or larger than 4 GiB)");
  });

  it("does not measure when Artifact Hub cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    const result = await checkArtifactHub(contextFor("stefanprodan", "podinfo"), ["Dockerfile"], { now: NOW });

    expect(result.status).toBe("warn");
    expect(result.message).toMatch(/^Not measured: Artifact Hub could not be reached \(Artifact Hub answered 503/);
  });

  it("uses the Artifact Hub instance in ARTIFACT_HUB_URL", async () => {
    vi.stubEnv("ARTIFACT_HUB_URL", "https://hub.example.nl/");
    fetchMock = recordedArtifactHub("https://hub.example.nl");
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkArtifactHub(contextFor("stefanprodan", "podinfo"), ["Dockerfile"], { now: NOW });

    expect(result.status).toBe("pass");
    expect(result.referenceUrl).toBe("https://hub.example.nl/packages/helm/podinfo/podinfo");
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^https:\/\/hub\.example\.nl\/api\/v1\//);
  });
});

describe("artifact Hub helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to artifacthub.io", () => {
    expect(artifactHubBaseUrl({})).toBe("https://artifacthub.io");
    expect(artifactHubBaseUrl({ ARTIFACT_HUB_URL: " https://hub.example.nl// " })).toBe("https://hub.example.nl");
  });

  it("finds package links on artifacthub.io and on the configured instance only", () => {
    const text = [
      "https://artifacthub.io/packages/helm/open-zaak/open-zaak",
      "(https://hub.example.nl/packages/helm/own/chart#readme)",
      "https://elsewhere.example/packages/helm/x/y",
      "https://artifacthub.io/packages/helm/open-zaak/open-zaak again",
    ].join("\n");

    expect(findArtifactHubLinks(text, "https://hub.example.nl")).toEqual([
      { repository: "open-zaak", name: "open-zaak" },
      { repository: "own", name: "chart" },
    ]);
  });

  it("reads the repositoryID of artifacthub-repo.yml", () => {
    expect(parseArtifactHubRepositoryId("repositoryID: abc-123\nowners: []\n")).toBe("abc-123");
    expect(parseArtifactHubRepositoryId("owners: []\n")).toBeNull();
    expect(parseArtifactHubRepositoryId(": : :")).toBeNull();
  });

  it("decides what a container component is", () => {
    expect(containerComponentReason(["src/Dockerfile"]).applies).toBe(true);
    expect(containerComponentReason(["charts/x/Chart.yaml"]).applies).toBe(true);
    expect(containerComponentReason([], ["ghcr.io/org/image"]).applies).toBe(true);
    expect(containerComponentReason([], [], ["https://github.com/org/charts/tree/main/x"]).applies).toBe(true);
    expect(containerComponentReason(["README.md"]).applies).toBe(false);
  });

  it("counts severities, an unknown severity as unknown", () => {
    expect(
      countSeverities({
        Results: [
          { Vulnerabilities: [{ Severity: "CRITICAL" }, { Severity: "HIGH" }, { Severity: "weird" }] },
          { Vulnerabilities: null },
        ],
      })
    ).toEqual({ critical: 1, high: 1, medium: 0, low: 0, unknown: 1 });
  });
});
