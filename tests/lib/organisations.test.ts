import { describe, expect, it } from "vitest";
import {
  componentCountLabel,
  filterOrganisations,
  organisationHref,
  organisationKey,
  organisationSlugsByKey,
} from "@/lib/organisations";
import { NAV_LINKS } from "@/lib/navigation";

const organisations = [
  { name: "Gemeente Utrecht", slug: "gemeente-utrecht", componentCount: 2 },
  { name: "Súdwest-Fryslân", slug: "sudwest-fryslan", componentCount: 1 },
  { name: "Utrecht", slug: "utrecht", componentCount: 1 },
];

describe("organisationKey", () => {
  it("ignores case, outer whitespace and runs of inner whitespace, like the backend", () => {
    expect(organisationKey("  Gemeente   UTRECHT ")).toBe("gemeente utrecht");
  });
});

describe("organisationHref", () => {
  it("encodes the slug", () => {
    expect(organisationHref("den-haag")).toBe("/organisations/den-haag");
    expect(organisationHref("a b")).toBe("/organisations/a%20b");
  });
});

describe("organisationSlugsByKey", () => {
  it("maps a declared spelling to the slug of its organisation", () => {
    const slugs = organisationSlugsByKey(organisations);
    expect(slugs.get(organisationKey("gemeente  utrecht"))).toBe("gemeente-utrecht");
    expect(slugs.get(organisationKey("Den Haag"))).toBeUndefined();
  });
});

describe("filterOrganisations", () => {
  it("matches part of the name, ignoring case and accents", () => {
    expect(filterOrganisations(organisations, "utrecht").map((o) => o.slug)).toEqual(["gemeente-utrecht", "utrecht"]);
    expect(filterOrganisations(organisations, "SUDWEST").map((o) => o.slug)).toEqual(["sudwest-fryslan"]);
    expect(filterOrganisations(organisations, "fryslân").map((o) => o.slug)).toEqual(["sudwest-fryslan"]);
  });

  it("keeps the order and returns every organisation for an empty query", () => {
    expect(filterOrganisations(organisations, "  ")).toEqual(organisations);
  });

  it("returns nothing when no name matches", () => {
    expect(filterOrganisations(organisations, "Rotterdam")).toEqual([]);
  });
});

describe("componentCountLabel", () => {
  it("counts in singular and plural", () => {
    expect(componentCountLabel(1)).toBe("1 component");
    expect(componentCountLabel(3)).toBe("3 components");
  });
});

describe("NAV_LINKS", () => {
  it("links to the organisations index after History", () => {
    const hrefs = NAV_LINKS.map((link) => link.href);
    expect(hrefs).toContain("/organisations");
    expect(hrefs.indexOf("/organisations")).toBe(hrefs.indexOf("/history") + 1);
  });
});
