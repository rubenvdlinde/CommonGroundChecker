/* @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import ComparePageView from "@/components/ComparePageView";
import FunctionalitiesSection from "@/components/FunctionalitiesSection";
import { compareSideFrom, publiccodeFeatures, standardOverlap } from "@/lib/compareSide";
import { standardsFromEvidence } from "@/lib/componentStandards";

afterEach(cleanup);

const zaken = "Found in the repository, not declared: Zaken API 1.5.1 in src/openapi.yaml (by title)";
const notificaties = "Found in the repository, not declared: Notificaties API 1.0.0 in src/openapi.yaml (by paths)";

const a = compareSideFrom({
  owner: "maykinmedia",
  repo: "open-object",
  displayName: "Open Object",
  repoUrl: "https://github.com/maykinmedia/open-object",
  analysis: {
    checkedAt: "2026-11-19T15:11:44Z",
    rating: 3.8,
    categoryRatings: { Governance: 4.1 },
    aspectRatings: {},
    results: [
      { id: "license", title: "License", status: "pass", message: "" },
      { id: "standards", title: "Supported standards", status: "info", message: "", evidence: [zaken] },
      {
        id: "publiccode",
        title: "publiccode.yml",
        status: "pass",
        message: "",
        publiccode: { descriptions: [{ language: "nl", features: ["Objecten opslaan"] }, { language: "en", features: ["Store objects"] }] },
      },
    ],
  },
  functionalities: ["basisgegevens", "objecttypen"],
  functionalitiesDraft: true,
  providers: [{ name: "Maykin", slug: "maykin", services: ["maintenance", "hosting"] }],
});
const b = compareSideFrom({
  owner: "ConductionNL",
  repo: "openregister",
  displayName: "OpenRegister",
  repoUrl: "https://github.com/ConductionNL/openregister",
  analysis: {
    rating: 4.4,
    categoryRatings: { Governance: 3.0 },
    results: [
      { id: "license", title: "License", status: "fail", message: "" },
      { id: "standards", title: "Supported standards", status: "info", message: "", evidence: [zaken, notificaties] },
    ],
  },
  functionalities: ["basisgegevens", "zoeken"],
});
const names = { basisgegevens: "Registreren en delen van basisgegevens", objecttypen: "Objecttypen", zoeken: "Beantwoorden van zoekvragen" };

describe("compareSideFrom", () => {
  it("takes the English features, the standards and the analysis", () => {
    expect(a.name).toBe("Open Object");
    expect(a.href).toBe("/components/maykinmedia/open-object");
    expect(a.features).toEqual(["Store objects"]);
    expect(a.standards?.map((standard) => standard.id)).toEqual(["zgw-zaken"]);
    expect(a.analysis?.results).toHaveLength(3);
  });

  it("has no analysis and no standards without results", () => {
    const side = compareSideFrom({ owner: "x", repo: "y", repoUrl: "https://github.com/x/y", analysis: { results: [] } });
    expect(side.analysis).toBeNull();
    expect(side.standards).toBeNull();
    expect(side.name).toBe("x/y");
  });

  it("falls back to the first language with features", () => {
    expect(publiccodeFeatures([{ id: "publiccode", publiccode: { descriptions: [{ language: "nl", features: ["Zaken"] }] } as never }])).toEqual([
      "Zaken",
    ]);
  });

  it("splits shared standards from the ones only one side supports", () => {
    const overlap = standardOverlap(standardsFromEvidence([zaken]), standardsFromEvidence([zaken, notificaties]));
    expect(overlap?.shared.map((item) => item.id)).toEqual(["zgw-zaken"]);
    expect(overlap?.onlyB.map((item) => item.id)).toEqual(["zgw-notificaties"]);
    expect(standardOverlap(null, [])).toBeNull();
  });
});

describe("ComparePageView", () => {
  it("shows the overlap, the better side per criterion and the providers", () => {
    render(
      <ComparePageView
        options={[{ key: "maykinmedia/open-object", label: "Open Object" }]}
        selectedA="maykinmedia/open-object"
        selectedB="ConductionNL/openregister"
        a={a}
        b={b}
        functionalityNames={names}
      />
    );
    expect(screen.getByRole("heading", { level: 2, name: "Compare two components" })).toBeTruthy();
    expect(
      screen.getByText(
        "Open Object and OpenRegister share 1 of the 3 functionalities they list together (33%). Each also does something the other does not."
      )
    ).toBeTruthy();
    expect(screen.getByText(/Partial overlap does not mean one of them can go/)).toBeTruthy();
    expect(screen.getByText(/The functionalities of Open Object are a draft/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Objecttypen" }).getAttribute("href")).toBe("/functionalities/objecttypen");
    expect(screen.getByText("Open Object scores better on 1, OpenRegister on 0, and they are equal on 0.", { exact: false })).toBeTruthy();

    const license = screen.getByRole("row", { name: /License/ });
    expect(within(license).getByText("Open Object scores better")).toBeTruthy();
    const overall = screen.getByRole("row", { name: /Overall rating/ });
    expect(within(overall).getByText("OpenRegister scores better")).toBeTruthy();
    expect(screen.getByText("Notificaties API 1.0.0, found in an OpenAPI file")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Maykin" }).getAttribute("href")).toBe("/providers/maykin");
    expect(screen.getByText("No provider listed yet.")).toBeTruthy();
  });

  it("keeps the picker on the URL's components and shows a message instead of the comparison", () => {
    render(
      <ComparePageView
        options={[{ key: "maykinmedia/open-object", label: "Open Object" }]}
        selectedA="maykinmedia/open-object"
        selectedB={null}
        a={null}
        b={null}
        functionalityNames={{}}
        message="Choose two different components."
      />
    );
    expect((screen.getByLabelText("Component A") as HTMLSelectElement).value).toBe("maykinmedia/open-object");
    expect(screen.getByRole("status").textContent).toBe("Choose two different components.");
    expect(screen.queryByText("Overlap in functionalities")).toBeNull();
  });
});

describe("FunctionalitiesSection", () => {
  it("lists functionalities, standards, publiccode features and the compare control", () => {
    const { container } = render(
      <FunctionalitiesSection
        landscape={{
          componentKey: "open-zaak/open-zaak",
          functionalities: [{ id: "registreren-en-delen-van-zaken", name: "Registreren en delen van zaken" }],
          draft: true,
          features: ["Zaken API 1.4"],
          standards: standardsFromEvidence([zaken]),
          compareOptions: [{ key: "maykinmedia/open-object", label: "Open Object" }],
        }}
      />
    );
    expect(screen.getByRole("link", { name: "Registreren en delen van zaken" }).getAttribute("href")).toBe(
      "/functionalities/registreren-en-delen-van-zaken"
    );
    expect(screen.getByText(/This list is a draft/)).toBeTruthy();
    expect(screen.getByText("Zaken API 1.5.1, found in an OpenAPI file")).toBeTruthy();
    const form = container.querySelector("form");
    expect(form?.getAttribute("action")).toBe("/compare");
    expect((form?.querySelector('input[name="a"]') as HTMLInputElement).value).toBe("open-zaak/open-zaak");
    expect(screen.getByLabelText("Compare with")).toBeTruthy();
  });

  it("says when nothing is listed and standards were not measured", () => {
    render(
      <FunctionalitiesSection
        landscape={{ componentKey: "a/b", functionalities: [], draft: false, features: [], standards: null, compareOptions: [] }}
      />
    );
    expect(screen.getByText(/None listed yet/)).toBeTruthy();
    expect(screen.getByText(/Not measured/)).toBeTruthy();
    expect(screen.queryByLabelText("Compare with")).toBeNull();
  });
});
