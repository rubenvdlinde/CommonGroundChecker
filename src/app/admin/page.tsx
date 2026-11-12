import AdminWeightsForm from "@/components/AdminWeightsForm";
import { getAdminScoring } from "@/lib/apiClient";
import {
  DEFAULT_COMPLEXITY_MAX_CCN_THRESHOLD,
  DEFAULT_COMPLEXITY_THRESHOLD,
  DEFAULT_CRITERION_CONFIG_BY_CHECK_ID,
  DEFAULT_SPECTRAL_RULESET_SOURCE,
} from "@/lib/checkers/config";
import { CATEGORY_WEIGHTS, migrateLegacyCategoryWeights } from "@/lib/criteria";

function buildDefaultConfig() {
  return {
    defaultCriterionWeights: Object.fromEntries(
      Object.entries(DEFAULT_CRITERION_CONFIG_BY_CHECK_ID).map(([checkId, config]) => [
        checkId,
        config.weight,
      ])
    ),
    defaultCriterionRequirementLevels: Object.fromEntries(
      Object.entries(DEFAULT_CRITERION_CONFIG_BY_CHECK_ID).map(([checkId, config]) => [
        checkId,
        config.requirementLevel,
      ])
    ),
    defaultCategoryWeights: Object.fromEntries(
      Object.entries(CATEGORY_WEIGHTS).map(([category, weight]) => [
        category,
        weight,
      ])
    ),
    defaultComplexityThreshold: DEFAULT_COMPLEXITY_THRESHOLD,
    defaultComplexityMaxCcnThreshold: DEFAULT_COMPLEXITY_MAX_CCN_THRESHOLD,
    defaultSpectralRulesetSource: DEFAULT_SPECTRAL_RULESET_SOURCE,
  };
}

export default async function AdminPage() {
  let successData = null;
  let error: string | undefined;

  try {
    successData = await getAdminScoring();
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to connect to admin scoring API.";
  }

  const defaults = buildDefaultConfig();

  const initialWeights = successData?.criterionWeights ?? defaults.defaultCriterionWeights;
  const initialRequirementLevels =
    successData?.criterionRequirementLevels ?? defaults.defaultCriterionRequirementLevels;
  const initialCategoryWeights = successData?.categoryWeights
    ? migrateLegacyCategoryWeights(successData.categoryWeights)
    : defaults.defaultCategoryWeights;

  console.log("Admin initial category weights:", {
    source: successData?.categoryWeights ? "successData.categoryWeights" : "defaults.defaultCategoryWeights",
    categoryWeights: initialCategoryWeights,
  });

  const defaultWeights = defaults.defaultCriterionWeights;
  const defaultRequirementLevels = defaults.defaultCriterionRequirementLevels;
  const defaultCategoryWeights = defaults.defaultCategoryWeights;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">

      <section className="space-y-2">
        <h2 className="text-2xl font-bold text-cg-blue">Admin — Scoring Configuration</h2>
        <p className="text-gray-600">
          Configure scoring weights, thresholds, and ruleset used for new analyses.
        </p>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5 space-y-3 text-sm text-gray-700">
        <h3 className="text-base font-semibold text-gray-900">How the overall score is calculated</h3>
        <p>
          The overall score is calculated in two stages. First, each category is scored by taking the weighted average of its <strong>mandatory</strong> criteria. Each result status is converted to a numeric score: <strong>pass = 1</strong>, <strong>warn = 0.5</strong>, and <strong>fail = 0</strong>.
        </p>
        <p>
          Second, the category scores are aggregated using fixed category weights:
          Governance 20%, Architecture 20%, Security 25%, Deployment &amp; Operations 20%, and Maintainability 15%.
        </p>
        <p>
          <strong>Recommended</strong> and <strong>informative</strong> criteria are shown in reports, but they do <strong>not</strong> contribute to the numeric score.
        </p>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load admin settings: {error}
        </div>
      ) : null}

      <AdminWeightsForm
        initialWeights={initialWeights}
        defaultWeights={defaultWeights}
        initialRequirementLevels={initialRequirementLevels}
        defaultRequirementLevels={defaultRequirementLevels}
        initialCategoryWeights={initialCategoryWeights}
        defaultCategoryWeights={defaultCategoryWeights}
        initialComplexityThreshold={
          successData?.complexityThreshold ?? defaults.defaultComplexityThreshold
        }
        defaultComplexityThreshold={defaults.defaultComplexityThreshold}
        initialComplexityMaxCcnThreshold={
          successData?.complexityMaxCcnThreshold ?? defaults.defaultComplexityMaxCcnThreshold
        }
        defaultComplexityMaxCcnThreshold={
          defaults.defaultComplexityMaxCcnThreshold
        }
        initialSpectralRulesetSource={
          successData?.spectralRulesetSource ?? defaults.defaultSpectralRulesetSource
        }
        defaultSpectralRulesetSource={defaults.defaultSpectralRulesetSource}
      />
    </div>
  );
}
