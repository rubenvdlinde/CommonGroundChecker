import type { CheckResult } from "../types";
import type { RepoContext, ParsedRepoTreeUrl } from "../providers/types";
import { resolveRepositoryContext } from "../providers";

export async function checkHelmChart(
  context: RepoContext,
  tree: string[],
  helmChartLocations: string[]
): Promise<CheckResult>;
export async function checkHelmChart(
  owner: string,
  repo: string,
  tree: string[],
): Promise<CheckResult>;
export async function checkHelmChart(
  owner: string,
  repo: string,
  tree: string[],
  helmChartLocations: string[]
): Promise<CheckResult>;
export async function checkHelmChart(
  contextOrOwner: RepoContext | string,
  arg2: string[] | string,
  arg3: string[] | string,
  arg4: string[] = []
): Promise<CheckResult> {
  const tree =
    typeof contextOrOwner === "string"
      ? (arg3 as string[])
      : (arg2 as string[]);
  const helmChartLocations =
    typeof contextOrOwner === "string"
      ? arg4
      : (arg3 as string[]);
  //const lowerTree = tree.map((p) => p.toLowerCase());
  const normalizedHints = helmChartLocations.map((p) => p.toLowerCase());
  const localPathHints = normalizedHints.filter(
    (h) => !h.startsWith("http://") && !h.startsWith("https://")
  );

  const externalHints = helmChartLocations
    .map((hint) => {
      const hintContext = resolveRepositoryContext(hint);
      return {
        hint,
        hintContext,
        parsed: hintContext?.provider.parseRepoTreeUrl?.(hint),
      };
    })
    .filter(
      (
        item
      ): item is {
        hint: string;
        hintContext: RepoContext;
        parsed: ParsedRepoTreeUrl;
      } => !!item.hintContext && !!item.parsed
    );

  const externalChartEvidence: string[] = [];
  let externalHelmDetected = false;

  for (const item of externalHints) {
    try {
      const externalTree = await item.hintContext.provider.getRepoTree(
        item.hintContext,
        item.parsed.branch
      );
      const externalLower = externalTree.map((p) => p.toLowerCase());
      const expectedChart = item.parsed.path.toLowerCase().endsWith("chart.yaml")
        ? item.parsed.path.toLowerCase().replace(/^\/+|\/+$/g, "")
        : `${item.parsed.path.replace(/^\/+|\/+$/g, "")}/chart.yaml`;

      if (externalLower.includes(expectedChart)) {
        externalHelmDetected = true;
        externalChartEvidence.push(`External Helm chart detected: ${item.hint}`);
      }
    } catch {
      // Ignore external lookup issues and proceed with local detection.
    }
  }

  const hintedHelmChart = tree.find((p) => {
    const lower = p.toLowerCase();
    return (
      lower.endsWith("chart.yaml") &&
      (localPathHints.length === 0 ||
        localPathHints.some(
          (hint) => lower === `${hint}/chart.yaml` || lower.startsWith(`${hint}/`)
        ))
    );
  });

  const helmChart = hintedHelmChart ?? tree.find((p) => p.toLowerCase().endsWith("chart.yaml"));
  const hasHelm = !!helmChart || externalHelmDetected;
  const evidence: string[] = [];

  if (helmChart) evidence.push(helmChart);
  if (helmChartLocations.length > 0) {
    evidence.push(`Provided helm locations: ${helmChartLocations.join(", ")}`);
  }
  evidence.push(...externalChartEvidence);

  if (hasHelm) {
    return {
      id: "helmchart",
      title: "Helm chart (Kubernetes)",
      description: "A Helm chart was detected for the component being checked.",
      status: "pass",
      message: "Helm chart detected for this component.",
      evidence,
      referenceUrl: "https://haven.commonground.nl",
    };
  }

  return {
    id: "helmchart",
    title: "Helm chart (Kubernetes)",
    description: "A Helm chart was detected for the component being checked.",
    status: "fail",
    message:
      "No Helm chart (Chart.yaml) was found for this component. Add a Helm chart to the repository.",
    evidence,
    referenceUrl: "https://haven.commonground.nl",
  };
}
