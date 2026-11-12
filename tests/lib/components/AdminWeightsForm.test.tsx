/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import AdminWeightsForm from "@/components/AdminWeightsForm";
import { postAdminScoring } from "@/lib/apiClient";

vi.mock("@/lib/apiClient", () => ({
  postAdminScoring: vi.fn(),
}));

describe("AdminWeightsForm", () => {
  const initialWeights = {
    sourcecode: 1,
    openapi: 1,
    license: 1,
    eupllicense: 1,
    copyrightowner: 1,
    publiccode: 1,
    contributing: 1,
    codeofconduct: 1,
    security: 1,
    fivelayer: 1,
    openapi: 1,
    adrvalidator: 1,
    documentation: 1,
    changelog: 1,
    tests: 1,
    coverage: 1,
    complexity: 1,
    codemetrics: 0,
    owaspsecurecoding: 1,
    docker: 1,
    dockerimage: 1,
    cicd: 1,
    helmchart: 1,
    semver: 1,
    sbom: 1,
  };

  const defaultWeights = { ...initialWeights };
  const initialRequirementLevels = Object.fromEntries(
    Object.keys(initialWeights).map((id) => [id, "mandatory"])
  );
  const defaultRequirementLevels = { ...initialRequirementLevels };
  const initialCategoryWeights = {
    Governance: 0.2,
    Architecture: 0.2,
    Security: 0.25,
    "Deployment & Operations": 0.2,
    Maintainability: 0.15,
  };
  const defaultCategoryWeights = { ...initialCategoryWeights };
  const initialComplexityThreshold = 15;
  const initialComplexityMaxCcnThreshold = 30;
  const defaultComplexityThreshold = 15;
  const defaultComplexityMaxCcnThreshold = 30;
  const initialSpectralRulesetSource = "https://static.developer.overheid.nl/adr/ruleset.yaml";
  const defaultSpectralRulesetSource = initialSpectralRulesetSource;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("submits category weights through the admin scoring API", async () => {
    const savedCategoryWeights = {
      Governance: 0.05,
      Architecture: 0.2,
      Security: 0.25,
      "Deployment & Operations": 0.2,
      Maintainability: 0.15,
    };

    (postAdminScoring as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      criterionWeights: initialWeights,
      criterionRequirementLevels: initialRequirementLevels,
      categoryWeights: savedCategoryWeights,
      complexityThreshold: initialComplexityThreshold,
      complexityMaxCcnThreshold: initialComplexityMaxCcnThreshold,
      spectralRulesetSource: initialSpectralRulesetSource,
    });

    const { container } = render(
      <AdminWeightsForm
        initialWeights={initialWeights}
        defaultWeights={defaultWeights}
        initialRequirementLevels={initialRequirementLevels}
        defaultRequirementLevels={defaultRequirementLevels}
        initialCategoryWeights={initialCategoryWeights}
        defaultCategoryWeights={defaultCategoryWeights}
        initialComplexityThreshold={initialComplexityThreshold}
        defaultComplexityThreshold={defaultComplexityThreshold}
        initialComplexityMaxCcnThreshold={initialComplexityMaxCcnThreshold}
        defaultComplexityMaxCcnThreshold={defaultComplexityMaxCcnThreshold}
        initialSpectralRulesetSource={initialSpectralRulesetSource}
        defaultSpectralRulesetSource={defaultSpectralRulesetSource}
      />
    );

    const categorySlider = container.querySelectorAll("input[type='range']")[0];
    expect(categorySlider).toBeTruthy();

    fireEvent.change(categorySlider!, { target: { value: "0.05" } });

    const saveButton = screen.getByRole("button", { name: /save configuration/i }) as HTMLButtonElement;
    expect(saveButton).toBeTruthy();
    expect(saveButton.disabled).toBe(false);

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(postAdminScoring).toHaveBeenCalledTimes(1);
    });

    expect(postAdminScoring).toHaveBeenCalledWith({
      criterionWeights: initialWeights,
      criterionRequirementLevels: initialRequirementLevels,
      categoryWeights: savedCategoryWeights,
      complexityThreshold: initialComplexityThreshold,
      complexityMaxCcnThreshold: initialComplexityMaxCcnThreshold,
      spectralRulesetSource: initialSpectralRulesetSource,
    });

    expect(await screen.findByText(/configuration saved/i)).toBeTruthy();
    expect(saveButton.disabled).toBe(true);
  });

  it("retains category weights locally when the backend response omits them", async () => {
    const newWeights = {
      Governance: 0.1,
      Architecture: 0.2,
      Security: 0.25,
      "Deployment & Operations": 0.2,
      Maintainability: 0.15,
    };

    (postAdminScoring as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      criterionWeights: initialWeights,
      criterionRequirementLevels: initialRequirementLevels,
      complexityThreshold: initialComplexityThreshold,
      complexityMaxCcnThreshold: initialComplexityMaxCcnThreshold,
      spectralRulesetSource: initialSpectralRulesetSource,
    });

    const { container } = render(
      <AdminWeightsForm
        initialWeights={initialWeights}
        defaultWeights={defaultWeights}
        initialRequirementLevels={initialRequirementLevels}
        defaultRequirementLevels={defaultRequirementLevels}
        initialCategoryWeights={initialCategoryWeights}
        defaultCategoryWeights={defaultCategoryWeights}
        initialComplexityThreshold={initialComplexityThreshold}
        defaultComplexityThreshold={defaultComplexityThreshold}
        initialComplexityMaxCcnThreshold={initialComplexityMaxCcnThreshold}
        defaultComplexityMaxCcnThreshold={defaultComplexityMaxCcnThreshold}
        initialSpectralRulesetSource={initialSpectralRulesetSource}
        defaultSpectralRulesetSource={defaultSpectralRulesetSource}
      />
    );

    const categorySlider = container.querySelectorAll("input[type='range']")[0];
    fireEvent.change(categorySlider!, { target: { value: "0.1" } });

    const saveButton = screen.getByRole("button", { name: /save configuration/i }) as HTMLButtonElement;
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(postAdminScoring).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText(/0.10/)).toBeTruthy();
    expect(saveButton.disabled).toBe(true);
  });

  it("shows cyclomatic complexity as informative, without a weight, and keeps its thresholds", () => {
    const { container } = render(
      <AdminWeightsForm
        initialWeights={initialWeights}
        defaultWeights={defaultWeights}
        initialRequirementLevels={initialRequirementLevels}
        defaultRequirementLevels={defaultRequirementLevels}
        initialCategoryWeights={initialCategoryWeights}
        defaultCategoryWeights={defaultCategoryWeights}
        initialComplexityThreshold={initialComplexityThreshold}
        defaultComplexityThreshold={defaultComplexityThreshold}
        initialComplexityMaxCcnThreshold={initialComplexityMaxCcnThreshold}
        defaultComplexityMaxCcnThreshold={defaultComplexityMaxCcnThreshold}
        initialSpectralRulesetSource={initialSpectralRulesetSource}
        defaultSpectralRulesetSource={defaultSpectralRulesetSource}
      />
    );

    expect(container.querySelector("#weight-complexity")).toBeNull();
    expect(container.querySelector("#complexity-threshold")).toBeTruthy();
    expect(container.querySelector("#complexity-max-ccn-threshold")).toBeTruthy();
  });
});
