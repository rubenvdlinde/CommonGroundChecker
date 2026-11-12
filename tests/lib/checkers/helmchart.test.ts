import { afterEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/github", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/github")>()),
  getRepoTree: vi.fn(),
}));

import { getRepoTree } from "@/lib/github";
import { checkHelmChart } from "@/lib/checkers/helmchart";

describe("checkHelmChart", () => {
  it("passes when a Chart.yaml exists in the repository tree", async () => {
    const result = await checkHelmChart("org", "repo", ["Chart.yaml", "README.md"]);

    expect(result.status).toBe("pass");
    expect(result.message).toContain("Helm chart detected");
    expect(result.evidence).toContain("Chart.yaml");
  });

  it("passes when a Chart.yaml exists in a nested chart folder", async () => {
    const result = await checkHelmChart("org", "repo", ["charts/my-component/Chart.yaml"]);

    expect(result.status).toBe("pass");
    expect(result.evidence).toContain("charts/my-component/Chart.yaml");
  });

  it("fails when no Chart.yaml exists", async () => {
    const result = await checkHelmChart("org", "repo", ["README.md", "deployment.yaml"]);

    expect(result.status).toBe("fail");
    expect(result.message).toContain("No Helm chart");
    expect(result.evidence).toEqual([]);
  });

  it("includes provided helm locations as evidence", async () => {
    const result = await checkHelmChart("org", "repo", ["charts/my-component/Chart.yaml"], ["charts/my-component"]);

    expect(result.status).toBe("pass");
    expect(result.evidence).toContain("Provided helm locations: charts/my-component");
  });

  it("passes when a Helm chart is detected from an explicit GitHub URL hint", async () => {
    (getRepoTree as unknown as Mock).mockResolvedValueOnce(["charts/my-component/Chart.yaml"]);

    const result = await checkHelmChart(
      "org",
      "repo",
      ["README.md"],
      ["https://github.com/org/repo/tree/main/charts/my-component"]
    );

    expect(result.status).toBe("pass");
    expect(result.evidence).toContain(
      "External Helm chart detected: https://github.com/org/repo/tree/main/charts/my-component"
    );
  });

  it("reads the tree of the hinted repository, not the scanned one", async () => {
    (getRepoTree as unknown as Mock).mockReset();
    (getRepoTree as unknown as Mock).mockImplementation(async (owner: string, repo: string) =>
      owner === "shared-org" && repo === "helm-charts" ? ["charts/component/Chart.yaml"] : []
    );

    const result = await checkHelmChart(
      "org",
      "repo",
      ["README.md"],
      ["https://github.com/shared-org/helm-charts/tree/main/charts/component"]
    );

    expect(getRepoTree).toHaveBeenCalledWith("shared-org", "helm-charts", "main");
    expect(getRepoTree).not.toHaveBeenCalledWith("org", "repo", expect.anything());
    expect(result.status).toBe("pass");
    expect(result.evidence).toContain(
      "External Helm chart detected: https://github.com/shared-org/helm-charts/tree/main/charts/component"
    );
  });

  it("does not credit a hinted chart that only exists in the scanned repository", async () => {
    (getRepoTree as unknown as Mock).mockReset();
    (getRepoTree as unknown as Mock).mockImplementation(async (owner: string) =>
      owner === "org" ? ["charts/component/Chart.yaml"] : []
    );

    const result = await checkHelmChart(
      "org",
      "repo",
      ["README.md"],
      ["https://github.com/shared-org/helm-charts/tree/main/charts/component"]
    );

    expect(result.status).toBe("fail");
  });

  describe("GitLab hints", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("reads the tree of a hinted GitLab repository", async () => {
      const fetchMock = vi.fn(async () =>
        new Response(JSON.stringify([{ path: "charts/component/Chart.yaml" }]), { status: 200 })
      );
      vi.stubGlobal("fetch", fetchMock);

      const result = await checkHelmChart(
        "org",
        "repo",
        ["README.md"],
        ["https://gitlab.com/group/sub/helm-charts/-/tree/main/charts/component"]
      );

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(
          `/projects/${encodeURIComponent("group/sub/helm-charts")}/repository/tree?ref=main`
        ),
        expect.anything()
      );
      expect(result.status).toBe("pass");
      expect(result.evidence).toContain(
        "External Helm chart detected: https://gitlab.com/group/sub/helm-charts/-/tree/main/charts/component"
      );
    });
  });
});
