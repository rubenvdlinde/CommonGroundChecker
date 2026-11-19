import { describe, expect, it } from "vitest";
import { checkMaintenance, judgeMaintenance } from "@/lib/checkers/maintenance";
import type { RepoContext } from "@/lib/providers/types";

const TODAY = "2026-11-16";

function contextWith(content: string | null): RepoContext {
  return {
    owner: "org",
    repo: "repo",
    projectPath: "org/repo",
    repoUrl: "https://github.com/org/repo",
    provider: { getFileContent: async () => content },
  } as unknown as RepoContext;
}

function contract(...contractors: unknown[]) {
  return { maintenance: { type: "contract", contractors } };
}

describe("judgeMaintenance", () => {
  it("passes on a current maintenance contract", () => {
    const result = judgeMaintenance(contract({ name: "Acme", until: "2027-06-30" }), "publiccode.yml", TODAY);

    expect(result.status).toBe("pass");
    expect(result.title).toBe("Maintenance contract");
    expect(result.message).toBe("Maintenance contract with Acme until 2027-06-30.");
    expect(result.evidence).toEqual(["Acme: valid until 2027-06-30"]);
  });

  it("passes on a contract that ends today", () => {
    expect(judgeMaintenance(contract({ name: "Acme", until: TODAY }), "publiccode.yml", TODAY).status).toBe("pass");
  });

  it("passes on a valid contract next to an invalid one, and says so", () => {
    const result = judgeMaintenance(
      contract({ name: "Acme", until: "2024-12-31" }, { name: "Beta", until: "2027-01-01" }),
      "publiccode.yml",
      TODAY
    );

    expect(result.status).toBe("pass");
    expect(result.message).toBe(
      "Maintenance contract with Beta until 2027-01-01. 1 other contractor entry is not valid; see the evidence."
    );
    expect(result.evidence).toEqual(["Acme: ended on 2024-12-31", "Beta: valid until 2027-01-01"]);
  });

  it.each([
    ["none", "nobody maintains the component"],
    ["internal", "there is no maintenance contract"],
    ["community", "there is no maintenance contract"],
  ])("fails on maintenance.type %s", (type, meaning) => {
    const result = judgeMaintenance(
      { maintenance: { type, contacts: [{ name: "Jane Doe" }] } },
      "publiccode.yml",
      TODAY
    );

    expect(result.status).toBe("fail");
    expect(result.message).toBe(`publiccode.yml declares maintenance.type ${type}: ${meaning}.`);
  });

  it.each([
    ["no maintenance section", { name: "App" }, "publiccode.yml has no maintenance section, so there is no maintenance contract."],
    ["no type", { maintenance: {} }, "publiccode.yml does not declare maintenance.type, so there is no maintenance contract."],
    [
      "an unknown type",
      { maintenance: { type: "sometimes" } },
      'publiccode.yml declares maintenance.type "sometimes", which is not a known type: there is no maintenance contract.',
    ],
    ["an empty file", null, "publiccode.yml has no maintenance section, so there is no maintenance contract."],
    [
      "a contract without contractors",
      { maintenance: { type: "contract" } },
      "publiccode.yml declares maintenance under contract, but names no contractor.",
    ],
  ])("fails on %s", (_label, publiccode, message) => {
    const result = judgeMaintenance(publiccode, "publiccode.yml", TODAY);

    expect(result.status).toBe("fail");
    expect(result.message).toBe(message);
  });

  it.each([
    ["an ended contract", { name: "Acme", until: "2025-06-30" }, "Acme ended on 2025-06-30"],
    ["an end date parsed as a YAML date", { name: "Acme", until: new Date("2025-06-30") }, "Acme ended on 2025-06-30"],
    ["no end date", { name: "Maykin" }, "Maykin has no end date (until)"],
    ["an end date that is not a date", { name: "Acme", until: "soon" }, 'Acme has an end date that is not a date: "soon"'],
    ["an impossible date", { name: "Acme", until: "2027-02-30" }, 'Acme has an end date that is not a date: "2027-02-30"'],
    ["no name", { until: "2027-01-01" }, "contractor 1 has no name"],
    [
      "an invalid email address",
      { name: "Acme", until: "2027-01-01", email: "acme-at-example" },
      'Acme has an invalid email address: "acme-at-example"',
    ],
    ["an entry that is not a contractor", "Acme", "contractor 1 is not a contractor entry"],
  ])("fails on a contract with %s, and says what is invalid", (_label, contractor, problem) => {
    const result = judgeMaintenance(contract(contractor), "publiccode.yml", TODAY);

    expect(result.status).toBe("fail");
    expect(result.message).toBe(`No valid maintenance contract: ${problem}.`);
  });

  it("names every problem of every contractor", () => {
    const result = judgeMaintenance(
      contract({ until: "2024-01-01" }, { name: "Beta", until: "soon", email: "nope" }),
      "publiccode.yml",
      TODAY
    );

    expect(result.message).toBe(
      'No valid maintenance contract: contractor 1 has no name and ended on 2024-01-01; Beta has an end date that is not a date: "soon" and has an invalid email address: "nope".'
    );
    expect(result.evidence).toEqual([
      "contractor 1: has no name, ended on 2024-01-01",
      'Beta: has an end date that is not a date: "soon", has an invalid email address: "nope"',
    ]);
  });

  it("ends the message with one full stop when a contractor's name ends with one", () => {
    const result = judgeMaintenance(contract({ name: "Example B.V.", until: "2025-01-01" }), "publiccode.yml", TODAY);

    expect(result.message).toBe("No valid maintenance contract: Example B.V. ended on 2025-01-01.");
  });
});

describe("checkMaintenance", () => {
  const today = new Date(`${TODAY}T12:00:00Z`);

  it("reads maintenance from publiccode.yml, with until parsed as a YAML date", async () => {
    const yaml = "publiccodeYmlVersion: '0.4'\nmaintenance:\n  type: contract\n  contractors:\n    - name: Acme\n      until: 2027-01-31\n";

    const result = await checkMaintenance(contextWith(yaml), ["README.md", "publiccode.yml"], today);

    expect(result.status).toBe("pass");
    expect(result.message).toBe("Maintenance contract with Acme until 2027-01-31.");
  });

  it("fails without a publiccode.yml", async () => {
    const result = await checkMaintenance(contextWith(null), ["README.md"], today);

    expect(result.status).toBe("fail");
    expect(result.message).toBe("No publiccode.yml was found, so there is no maintenance contract.");
  });

  it("fails on invalid YAML", async () => {
    const result = await checkMaintenance(contextWith("maintenance: [unclosed"), ["publiccode.yml"], today);

    expect(result.status).toBe("fail");
    expect(result.message).toContain("not valid YAML");
  });

  it("warns when the checker cannot read the file, since that says nothing about the component", async () => {
    const result = await checkMaintenance(contextWith(null), ["publiccode.yml"], today);

    expect(result.status).toBe("warn");
    expect(result.message).toContain("could not read");
  });
});
