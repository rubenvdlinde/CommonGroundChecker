import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/admin/scoring/route";

const originalFetch = globalThis.fetch;

describe("Admin scoring proxy route", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.stubGlobal("fetch", originalFetch);
    vi.restoreAllMocks();
  });

  it("forwards GET and returns the remote scoring configuration including category weights", async () => {
    const expectedResponse = {
      scoringConfigId: "cfg-remote",
      categoryWeights: {
        Governance: 0.1,
        Architecture: 0.2,
        Security: 0.3,
        "Deployment & Operations": 0.2,
        Maintainability: 0.2,
      },
      criterionWeights: {
        sourcecode: 1,
      },
      criterionRequirementLevels: {
        sourcecode: "mandatory",
      },
      defaultCriterionWeights: {
        sourcecode: 1,
      },
      defaultCriterionRequirementLevels: {
        sourcecode: "mandatory",
      },
      defaultCategoryWeights: {
        Governance: 0.2,
        Architecture: 0.2,
        Security: 0.25,
        "Deployment & Operations": 0.2,
        Maintainability: 0.15,
      },
      complexityThreshold: 15,
      complexityMaxCcnThreshold: 30,
      spectralRulesetSource: "https://static.developer.overheid.nl/adr/ruleset.yaml",
      defaultComplexityThreshold: 15,
      defaultComplexityMaxCcnThreshold: 30,
      defaultSpectralRulesetSource: "https://static.developer.overheid.nl/adr/ruleset.yaml",
    };

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(expectedResponse), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const response = await GET();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await response.json()).toEqual(expectedResponse);
  });

  it("forwards POST payload with category weights and returns the remote configuration", async () => {
    const payload = {
      criterionWeights: { sourcecode: 1 },
      categoryWeights: {
        Governance: 0.05,
        Architecture: 0.25,
        Security: 0.35,
        "Deployment & Operations": 0.2,
        Maintainability: 0.15,
      },
      complexityThreshold: 10,
    };

    const expectedResponse = {
      scoringConfigId: "cfg-saved",
      categoryWeights: payload.categoryWeights,
      criterionWeights: payload.criterionWeights,
      criterionRequirementLevels: {
        sourcecode: "mandatory",
      },
      defaultCriterionWeights: {
        sourcecode: 1,
      },
      defaultCriterionRequirementLevels: {
        sourcecode: "mandatory",
      },
      defaultCategoryWeights: {
        Governance: 0.2,
        Architecture: 0.2,
        Security: 0.25,
        "Deployment & Operations": 0.2,
        Maintainability: 0.15,
      },
      complexityThreshold: payload.complexityThreshold,
      complexityMaxCcnThreshold: 30,
      spectralRulesetSource: "https://static.developer.overheid.nl/adr/ruleset.yaml",
      defaultComplexityThreshold: 15,
      defaultComplexityMaxCcnThreshold: 30,
      defaultSpectralRulesetSource: "https://static.developer.overheid.nl/adr/ruleset.yaml",
    };

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(expectedResponse), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const request = new Request("http://localhost/api/admin/scoring", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const response = await POST(request);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const json = await response.json();
    expect(json).toEqual(expectedResponse);

    const [_, init] = fetchMock.mock.calls[0] as [RequestInfo, RequestInit?];
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify(payload));
  });

  it("returns request category weights when remote POST response omits them", async () => {
    const payload = {
      criterionWeights: { sourcecode: 1 },
      categoryWeights: {
        Governance: 0.05,
        Architecture: 0.2,
        Security: 0.25,
        "Deployment & Operations": 0.2,
        Maintainability: 0.15,
      },
      complexityThreshold: 10,
    };

    const remoteResponse = {
      scoringConfigId: "cfg-saved",
      criterionWeights: payload.criterionWeights,
      criterionRequirementLevels: {
        sourcecode: "mandatory",
      },
      defaultCriterionWeights: {
        sourcecode: 1,
      },
      defaultCriterionRequirementLevels: {
        sourcecode: "mandatory",
      },
      defaultCategoryWeights: {
        Governance: 0.2,
        Architecture: 0.2,
        Security: 0.25,
        "Deployment & Operations": 0.2,
        Maintainability: 0.15,
      },
      complexityThreshold: payload.complexityThreshold,
      complexityMaxCcnThreshold: 30,
      spectralRulesetSource: "https://static.developer.overheid.nl/adr/ruleset.yaml",
      defaultComplexityThreshold: 15,
      defaultComplexityMaxCcnThreshold: 30,
      defaultSpectralRulesetSource: "https://static.developer.overheid.nl/adr/ruleset.yaml",
    };

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(remoteResponse), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const request = new Request("http://localhost/api/admin/scoring", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const response = await POST(request);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const json = await response.json();
    expect(json.categoryWeights).toEqual(payload.categoryWeights);
  });
});
