import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LEGACY_PATHS,
  componentHref,
  legacyRedirectTarget,
  providerHref,
  userHref,
} from "@/lib/routes";
import { organisationHref } from "@/lib/organisations";
import { repositoryRunHref } from "@/lib/repositoryRun";
import { buildHistoryHref } from "@/lib/historySearch";

type Redirect = { source: string; destination: string; permanent: boolean };

async function loadNextConfig(dataSource?: string): Promise<{ redirects?: () => Promise<Redirect[]>; output?: string }> {
  vi.resetModules();
  if (dataSource) vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", dataSource);
  return (await import("../../next.config.js")).default;
}

describe("page paths", () => {
  it("puts components under /components, users under /users and providers under /providers", () => {
    expect(componentHref("open-zaak", "open-zaak")).toBe("/components/open-zaak/open-zaak");
    expect(componentHref("group/sub", "repo", "run 1")).toBe("/components/group%2Fsub/repo/run%201");
    expect(repositoryRunHref("org", "repo", "a")).toBe("/components/org/repo/a");
    expect(userHref("den-haag")).toBe("/users/den-haag");
    expect(organisationHref("a b")).toBe("/users/a%20b");
    expect(providerHref("maykin-media")).toBe("/providers/maykin-media");
  });

  it("keeps the status and basisset filters on the Components index", () => {
    expect(buildHistoryHref({ sort: "rating", direction: "desc", status: "maintained", basisset: true })).toBe(
      "/components?sort=rating&direction=desc&status=maintained&basisset=1"
    );
  });
});

describe("legacyRedirectTarget", () => {
  it("moves History to Components and Organisations to Users, with every path below them", () => {
    expect(legacyRedirectTarget("/history")).toBe("/components");
    expect(legacyRedirectTarget("/history/")).toBe("/components");
    expect(legacyRedirectTarget("/history/org/repo/run")).toBe("/components/org/repo/run");
    expect(legacyRedirectTarget("/organisations/utrecht")).toBe("/users/utrecht");
  });

  it("leaves paths that did not move", () => {
    expect(legacyRedirectTarget("/historyx")).toBeNull();
    expect(legacyRedirectTarget("/components/org/repo")).toBeNull();
    expect(legacyRedirectTarget("/")).toBeNull();
  });
});

describe("next.config redirects", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("redirects every old path on the server, permanently", async () => {
    const config = await loadNextConfig();
    const redirects = await config.redirects!();
    expect(redirects).toEqual(
      LEGACY_PATHS.flatMap(({ from, to }) => [
        { source: from, destination: to, permanent: true },
        { source: `${from}/:path*`, destination: `${to}/:path*`, permanent: true },
      ])
    );
  });

  it("has no redirects in the static export, which uses redirect pages instead", async () => {
    const config = await loadNextConfig("static");
    expect(config.output).toBe("export");
    expect(config.redirects).toBeUndefined();
  });
});
