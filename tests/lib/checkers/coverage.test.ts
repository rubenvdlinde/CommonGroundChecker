import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkCoverage } from "@/lib/checkers/coverage";

const mocks = vi.hoisted(() => ({
  getFileContent: vi.fn(),
}));

vi.mock("@/lib/github", () => ({
  getFileContent: mocks.getFileContent,
}));

describe("checkCoverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns warn when no coverage file is present", async () => {
    const result = await checkCoverage("org", "repo", ["README.md"]);

    expect(result.id).toBe("coverage");
    expect(result.status).toBe("warn");
    expect(result.message).toContain("No coverage report file was found");
  });

  it("returns pass when coverage summary JSON meets threshold", async () => {
    mocks.getFileContent.mockResolvedValueOnce(
      JSON.stringify({
        total: { lines: { pct: 82.5 } },
      })
    );

    const result = await checkCoverage("org", "repo", ["coverage/coverage-summary.json"]);

    expect(result.status).toBe("pass");
    expect(result.message).toContain("82.50%");
    expect(result.evidence).toContain("coverage/coverage-summary.json: 82.50%");
  });

  it("returns fail when lcov info is below threshold", async () => {
    mocks.getFileContent.mockResolvedValueOnce(
      "LF:10\nLH:6\n"
    );

    const result = await checkCoverage("org", "repo", ["coverage/lcov.info"]);

    expect(result.status).toBe("fail");
    expect(result.message).toContain("60.00%");
    expect(result.evidence).toContain("coverage/lcov.info: 60.00%");
  });

  it("detects coverage from a README badge when no report file exists", async () => {
    mocks.getFileContent.mockResolvedValueOnce(
      "![Coverage](https://img.shields.io/badge/coverage-84%25-brightgreen)"
    );

    const result = await checkCoverage("org", "repo", ["README.md"]);

    expect(result.status).toBe("pass");
    expect(result.message).toContain("84.00%");
    expect(result.evidence).toContain("README coverage badge: 84.00%");
  });

  it("ignores non-coverage badges in README", async () => {
    mocks.getFileContent.mockResolvedValueOnce(
      "![Tests](https://img.shields.io/badge/tests-100%25-brightgreen)"
    );

    const result = await checkCoverage("org", "repo", ["README.md"]);

    expect(result.status).toBe("warn");
    expect(result.message).toContain("No coverage report file was found");
  });

  it("detects coverage from a Codecov badge URL in README", async () => {
    mocks.getFileContent.mockResolvedValueOnce(
      "[![Coverage](https://codecov.io/gh/open-zaak/open-zaak/branch/main/graph/badge.svg)](https://codecov.io/gh/open-zaak/open-zaak)"
    );

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        "<svg><text>Coverage<\/text><text>84%<\/text><\/svg>",
    });
    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      writable: true,
      configurable: true,
    });

    const result = await checkCoverage("org", "repo", ["README.md"]);

    expect(fetchMock).toHaveBeenCalled();
    expect(result.status).toBe("pass");
    expect(result.message).toContain("84.00%");
    expect(result.evidence).toContain("README coverage badge: 84.00%");
  });

  it("ignores generic Codecov repository URLs in README", async () => {
    mocks.getFileContent.mockResolvedValueOnce(
      "[![Codecov](https://codecov.io/gh/open-zaak/open-zaak)](https://codecov.io/gh/open-zaak/open-zaak)"
    );

    const fetchMock = vi.fn();
    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      writable: true,
      configurable: true,
    });

    const result = await checkCoverage("org", "repo", ["README.md"]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.status).toBe("warn");
    expect(result.message).toContain("No coverage report file was found");
  });
  it("ignores a README coverage threshold policy sentence", async () => {
    mocks.getFileContent.mockResolvedValueOnce(
      "| **PHPUnit coverage gate** | `composer test:coverage && composer coverage:check` | Emits `coverage/clover.xml` + `coverage/html/`, then enforces the **merge-blocking** thresholds: **≥ 80% line** and **≥ 70% branch** (`tests/scripts/check-coverage.php`). 100% is the aspirational quarterly tech-debt target, not enforced. |"
    );

    const result = await checkCoverage("org", "repo", ["README.md"]);

    expect(result.status).toBe("warn");
    expect(result.message).toContain("No coverage report file was found");
  });

  it.each([
    "Code coverage must be at least 85%.",
    "We aim for 90% test coverage.",
    "The coverage target is 95%.",
    "Coverage: >= 80% required",
    "Minimum coverage: 80%",
  ])("ignores README coverage requirement %j", async (text) => {
    mocks.getFileContent.mockResolvedValueOnce(text);

    const result = await checkCoverage("org", "repo", ["README.md"]);

    expect(result.status).toBe("warn");
  });

  it.each([
    ["shields.io static badge", "[![coverage](https://img.shields.io/badge/coverage-91.5%25-brightgreen)](https://example.org)", 91.5],
    ["badge alt text", "![Coverage 88%](https://example.org/coverage.svg)", 88],
    ["HTML img alt text", '<img src="https://example.org/c.svg" alt="coverage: 86%">', 86],
    ["report statement", "Code coverage: **83%**", 83],
    ["report table row", "| Test coverage | 87% |", 87],
    ["report sentence", "The project currently has 92% line coverage.", 92],
  ])("detects a README coverage measurement (%s)", async (_label, text, expected) => {
    mocks.getFileContent.mockResolvedValueOnce(text);

    const result = await checkCoverage("org", "repo", ["README.md"]);

    expect(result.status).toBe("pass");
    expect(result.evidence).toContain(`README coverage badge: ${expected.toFixed(2)}%`);
  });

  it.each([
    [
      "Codecov badge as used by open-zaak/open-zaak",
      ".. |coverage| image:: https://codecov.io/github/open-zaak/open-zaak/branch/main/graphs/badge.svg?branch=main\n    :alt: Coverage\n    :target: https://codecov.io/gh/open-zaak/open-zaak",
      "codecov.io/github/open-zaak/open-zaak/branch/main/graphs/badge.svg",
    ],
    [
      "Coveralls badge",
      "[![Coverage Status](https://coveralls.io/repos/github/org/repo/badge.svg?branch=main)](https://coveralls.io/github/org/repo?branch=main)",
      "coveralls.io/repos/github/org/repo/badge.svg",
    ],
    [
      "Codacy coverage badge",
      "[![Codacy Badge](https://app.codacy.com/project/badge/Coverage/0123456789abcdef)](https://app.codacy.com/gh/org/repo)",
      "app.codacy.com/project/badge/Coverage/0123456789abcdef",
    ],
    [
      "SonarCloud coverage badge",
      "[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=org_repo&metric=coverage)](https://sonarcloud.io/summary/new_code?id=org_repo)",
      "sonarcloud.io/api/project_badges/measure?project=org_repo&metric=coverage",
    ],
  ])("reads coverage from a remote badge (%s)", async (_label, readme, badgeUrlPart) => {
    mocks.getFileContent.mockResolvedValueOnce(readme);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        '<svg><text x="31.5" y="14">coverage</text><text x="81.5" y="14">84.3%</text></svg>',
    });
    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      writable: true,
      configurable: true,
    });

    const result = await checkCoverage("org", "repo", ["README.rst"]);

    expect(fetchMock.mock.calls[0][0]).toContain(badgeUrlPart);
    expect(result.status).toBe("pass");
    expect(result.evidence).toContain("README coverage badge: 84.30%");
  });
});
