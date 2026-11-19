import { STANDARD_FAMILIES, type StandardSource } from "./standards";

/** Path of the profile page in the rating guide. */
export const PUBLICCODE_PROFILE_PATH = "/docs/publiccode-profile";

/** Criteria whose result depends on what publiccode.yml declares; their result card links to the profile. */
export const PUBLICCODE_GUIDE_CHECK_IDS = ["publiccode", "maintenance", "fivelayer", "standards"];

/** The publiccode.yml version the profile and its example follow. `supports` exists from 0.8. */
export const PUBLICCODE_YML_VERSION = "0.8";

/** The reference parser the example is validated with. */
export const REFERENCE_PARSER = {
  name: "publiccode-parser",
  version: "v5.5.1",
  url: "https://github.com/publiccodeyml/libpubliccode",
  command: "docker run --rm -v \"$PWD\":/files:ro publiccodeyml/libpubliccode:v5.5.1 -no-network /files/publiccode.yml",
};

export type FieldRequirement =
  /** A mandatory criterion fails without it, so the component is not suitable for Common Ground */
  | "suitable"
  /** Needed for the proposed Approved level */
  | "approved"
  /** Shown or compared, but no rating or verdict depends on it */
  | "informative";

export const REQUIREMENT_LABELS: Record<FieldRequirement, string> = {
  suitable: "Needed for Suitable",
  approved: "Needed for Approved (proposed)",
  informative: "Informative",
};

export interface ProfileField {
  /** Stable kebab-case id, also the anchor on the page */
  id: string;
  /** The publiccode.yml key or keys */
  keys: string;
  /** What to put there */
  what: string[];
  example: string;
  /** Which criterion or level reads it */
  usedBy: string;
  requirement: FieldRequirement;
  /** Set when the criterion that reads it is not in the checker yet */
  status?: "in development" | "proposed";
}

export const PROFILE_FIELDS: ProfileField[] = [
  {
    id: "file",
    keys: "publiccode.yml",
    what: [
      "Put the file in the root of the repository. The publiccode.yml standard names the file publiccode.yml and places it in the root.",
      "The checker accepts publiccode.yml and publiccode.yaml. Use publiccode.yml, the name the standard and other registers use.",
    ],
    example: "voorbeeldzaken/\n  publiccode.yml\n  LICENSE\n  README.md",
    usedBy: "The publiccode.yml criterion, a mandatory criterion. Without the file it fails.",
    requirement: "suitable",
  },
  {
    id: "publiccode-yml-version",
    keys: "publiccodeYmlVersion, name, url, legal",
    what: [
      `Use publiccodeYmlVersion "${PUBLICCODE_YML_VERSION}". The supports key below exists from 0.8 on.`,
      "name, url and legal are required by the standard. The checker warns when one of them is missing.",
    ],
    example: `publiccodeYmlVersion: "${PUBLICCODE_YML_VERSION}"\nname: Voorbeeldzaken\nurl: "https://github.com/example-org/voorbeeldzaken"`,
    usedBy: "The publiccode.yml criterion.",
    requirement: "suitable",
  },
  {
    id: "software-version",
    keys: "softwareVersion, releaseDate",
    what: [
      "softwareVersion is the latest stable release. It must match a release tag, with or without a leading v: 2.4.0 matches the tag 2.4.0 or v2.4.0.",
      "releaseDate is the date of that release, as YYYY-MM-DD.",
      "The checker scans the tag that matches softwareVersion. Without a match it scans the newest stable release, and else the default branch with a warning.",
    ],
    example: 'softwareVersion: "2.4.0"\nreleaseDate: "2026-10-01"',
    usedBy: "The choice of the version that is measured (#68). The checker reads it from the file in the root.",
    requirement: "informative",
    status: "in development",
  },
  {
    id: "development-status",
    keys: "developmentStatus",
    what: [
      "One of concept, development, beta, stable or obsolete. Use stable only for a release that is ready for production.",
    ],
    example: "developmentStatus: stable",
    usedBy: "The Approved level: only a stable component can be approved.",
    requirement: "approved",
    status: "proposed",
  },
  {
    id: "maintenance",
    keys: "maintenance",
    what: [
      "Set type to contract and name each contractor with name and until. until is the date the contract ends, as YYYY-MM-DD, and must lie in the future.",
      "The types internal, community and none mean there is no maintenance contract, so the criterion fails.",
      "An email of a contractor must be a valid address.",
    ],
    example:
      'maintenance:\n  type: contract\n  contractors:\n    - name: Voorbeeld Software B.V.\n      until: "2027-12-31"\n      email: support@example.org',
    usedBy: "The Maintained criterion (#55). The verdict Suitable for Common Ground requires a valid contract (#56).",
    requirement: "suitable",
  },
  {
    id: "used-by",
    keys: "usedBy",
    what: [
      "The names of the organisations that use the component in production.",
      "The publiccode.yml standard marks usedBy as deprecated from 0.8 on and names no replacement key. The proposal behind it moves usage to the catalogue level. The reference parser warns, but still accepts the file. The checker reads it until there is a replacement.",
    ],
    example: "usedBy:\n  - Gemeente Voorbeeld\n  - Gemeente Proefstad",
    usedBy: "The Approved level counts at least two users. The usage overview and the organisation pages list them.",
    requirement: "approved",
    status: "proposed",
  },
  {
    id: "layer",
    keys: "supports (Common Ground layer)",
    what: [
      "One supports entry for the layer of the five-layer model: interaction, process, integration, service or data, after the # of the model's URI.",
      "Declare one layer. Two or more layers give a warning.",
      "The model's page on commonground.nl no longer resolves. The URI still works as an identifier, until VNG agrees a new one.",
    ],
    example: 'supports:\n  - id: "https://commonground.nl/cms/view/54476261/5-lagen-model#service"',
    usedBy:
      "The 5-layer criterion (#53). A declared layer takes precedence over the guess from paths and text. The layer does not count in the Architecture rating.",
    requirement: "informative",
  },
  {
    id: "standards",
    keys: "supports (standards and versions)",
    what: [
      "One supports entry per standard and version, with the official URI of that version as id. The table below lists the URIs the checker knows.",
      "List each version the component supports as its own entry.",
    ],
    example:
      'supports:\n  - id: "https://vng-realisatie.github.io/gemma-zaken/standaard/zaken/redoc-1.5.1.html"\n  - id: "https://gitdocumentatie.logius.nl/publicatie/api/adr/2.1.0/"',
    usedBy: "The Supported standards criterion. It compares the declared standards with the OpenAPI files in the repository.",
    requirement: "informative",
  },
  {
    id: "features",
    keys: "description.<lang>.features",
    what: [
      "What the component does, as a short list. Write a Dutch description under nl, and an English one under en if you can.",
      "Functionality goes here, standards go under supports.",
    ],
    example: "description:\n  nl:\n    features:\n      - Zaken registreren en bijwerken\n      - Zaaktypen uit een catalogus gebruiken",
    usedBy: "The component page shows the features next to the supported standards.",
    requirement: "informative",
  },
  {
    id: "licence",
    keys: "legal.license",
    what: [
      "The licence as an SPDX expression, for example EUPL-1.2. It must name the same licence as the LICENSE file.",
    ],
    example: "legal:\n  license: EUPL-1.2\n  mainCopyrightOwner: Gemeente Voorbeeld",
    usedBy:
      "The publiccode.yml criterion requires legal. The licence consistency check (#11) compares legal.license with the LICENSE file and the package manifests.",
    requirement: "suitable",
  },
  {
    id: "container-image",
    keys: "(no publiccode.yml key)",
    what: [
      "publiccode.yml has no key for a container image, and the checker does not look for one there.",
      "Name the image in a Compose file or in Helm values, with the repository's own owner and name, for example ghcr.io/example-org/voorbeeldzaken:2.4.0 (#7). Or give the image location when you start a check.",
    ],
    example: "# docker-compose.yml\nservices:\n  web:\n    image: ghcr.io/example-org/voorbeeldzaken:2.4.0",
    usedBy: "The Available Docker image criterion, a mandatory criterion.",
    requirement: "suitable",
  },
  {
    id: "helm-chart",
    keys: "(no publiccode.yml key): Artifact Hub link in a description",
    what: [
      "The Helm chart criterion looks for a Chart.yaml in the repository, or at the location you give when you start a check.",
      "For Artifact Hub, put the link to the package anywhere in publiccode.yml, for example in longDescription: https://artifacthub.io/packages/helm/<repository>/<package>. A package that publiccode.yml links to is taken as the component's own.",
    ],
    example:
      "description:\n  nl:\n    longDescription: >\n      Installeer het met de Helm-chart op Artifact Hub:\n      https://artifacthub.io/packages/helm/example-org/voorbeeldzaken",
    usedBy: "The Helm chart criterion, a mandatory criterion, and the Artifact Hub check of the chart and its images.",
    requirement: "suitable",
    status: "in development",
  },
];

export type StandardRow =
  | {
      name: string;
      group?: string;
      /** The supports id, with `{version}` where the version goes */
      uriTemplate: string;
      versions: string[];
      source: StandardSource;
      agreed: true;
    }
  | { name: string; group?: string; note: string; source: StandardSource; agreed: false };

/** Standards without an official per-version URI, and why. Listed as "URI to agree". */
const STANDARDS_TO_AGREE: Array<{ name: string; group?: string; note: string; source: StandardSource }> = [
  {
    name: "BRP API Personen",
    group: "Haal Centraal",
    note: "RvIG publishes one specification page for all versions. The versions are only named in the release notes.",
    source: { title: "RvIG, BRP API Personen", url: "https://developer.rvig.nl/brp-api/personen/specificatie/" },
  },
  {
    name: "Objects API",
    note: "Published as git tags of the open-object repository. The API version (info.version) differs from the release tag.",
    source: { title: "Maykin Media, Open Object", url: "https://github.com/maykinmedia/open-object" },
  },
  {
    name: "Objecttypes API",
    note: "Published as git tags of the objecttypes-api repository. The API version (info.version) differs from the release tag.",
    source: { title: "Maykin Media, Objecttypes API", url: "https://github.com/maykinmedia/objecttypes-api" },
  },
  {
    name: "DigiD",
    note: "Logius publishes the koppelvlak specification on a page without a version in its URI.",
    source: {
      title: "Logius, Koppelvlakspecificatie DigiD SAML authenticatie",
      url: "https://www.logius.nl/onze-dienstverlening/toegang/digid/documentatie/koppelvlakspecificatie-digid-saml-authenticatie",
    },
  },
  {
    name: "eHerkenning",
    note: "The afsprakenstelsel names its versions (for example AS1.24e) on pages without a version in their URI.",
    source: {
      title: "Afsprakenstelsel Elektronische Toegangsdiensten, release informatie",
      url: "https://afsprakenstelsel.etoegang.nl/Startpagina/as/release-informatie",
    },
  },
];

/** Where the URIs come from, shown below the standards table. */
export const STANDARD_NOTES = [
  "ZGW APIs: VNG Realisatie publishes one documentation page per version, redoc-{version}.html. The OpenAPI files of these versions have info.title equal to the API name and info.version equal to the version. An implementation that renames its specification, such as Open Notificaties, is recognised by the API's top-level resources instead, for example kanaal and notificaties for the Notificaties API. Those resources are in every published version.",
  "NL API Design Rules and Digikoppeling: Logius publishes each version under its own path. Digikoppeling has no overall version since 2018, so each part is a standard of its own.",
  "StUF: the id is the XML namespace of StUF 03.01 from stuf0301.xsd. It identifies the version, but is not a web page.",
  "The checker recognises BRP API Personen, the Objects API and the Objecttypes API in OpenAPI files by their info.title, even though their URI is still to agree.",
];

/** The rows of the standards table: every version the registry knows, then the standards whose URI is still to agree. */
export function standardRows(): StandardRow[] {
  const agreed: StandardRow[] = STANDARD_FAMILIES.filter((family) => family.uriTemplate).map((family) => ({
    name: family.name,
    group: family.group,
    uriTemplate: family.uriTemplate as string,
    versions: family.versions,
    source: family.source,
    agreed: true,
  }));
  return [...agreed, ...STANDARDS_TO_AGREE.map((row) => ({ ...row, agreed: false as const }))];
}

/** The complete example, identical to docs/examples/publiccode.yml, which is validated with the reference parser. */
export const PROFILE_EXAMPLE = `# A complete publiccode.yml for a fictional Common Ground component.
# It is explained field by field in docs/publiccode-profile.md.
publiccodeYmlVersion: "0.8"

name: Voorbeeldzaken
url: "https://github.com/example-org/voorbeeldzaken"
landingURL: "https://voorbeeldzaken.example.org"

softwareVersion: "2.4.0"
releaseDate: "2026-10-01"
developmentStatus: stable
softwareType: standalone/backend

platforms:
  - web
categories:
  - workflow-management
  - document-management

organisation:
  name: Gemeente Voorbeeld
  uri: "https://www.example.org"

usedBy:
  - Gemeente Voorbeeld
  - Gemeente Proefstad

supports:
  - id: "https://commonground.nl/cms/view/54476261/5-lagen-model#service"
  - id: "https://vng-realisatie.github.io/gemma-zaken/standaard/zaken/redoc-1.5.1.html"
  - id: "https://vng-realisatie.github.io/gemma-zaken/standaard/catalogi/redoc-1.3.3.html"
  - id: "https://vng-realisatie.github.io/gemma-zaken/standaard/notificaties/redoc-1.0.1.html"
  - id: "https://gitdocumentatie.logius.nl/publicatie/api/adr/2.1.0/"
  - id: "alias:gdpr"

intendedAudience:
  countries:
    - NL

description:
  nl:
    shortDescription: Registreert zaken van een gemeente via de Zaken API.
    longDescription: >
      Voorbeeldzaken is een fictief Common Ground-component dat zaken van een
      gemeente registreert. Andere componenten lezen en wijzigen die zaken via
      de Zaken API en de Catalogi API, en krijgen een bericht via de
      Notificaties API. Installeer het met de Helm-chart op Artifact Hub:
      https://artifacthub.io/packages/helm/example-org/voorbeeldzaken
    documentation: "https://docs.voorbeeldzaken.example.org"
    apiDocumentation: "https://docs.voorbeeldzaken.example.org/api"
    features:
      - Zaken registreren en bijwerken
      - Zaaktypen uit een catalogus gebruiken
      - Berichten sturen bij elke wijziging
  en:
    shortDescription: Registers the cases of a municipality through the Zaken API.
    longDescription: >
      Voorbeeldzaken is a fictional Common Ground component that registers the
      cases of a municipality. Other components read and change those cases
      through the Zaken API and the Catalogi API, and get a message through the
      Notificaties API. Install it with the Helm chart on Artifact Hub:
      https://artifacthub.io/packages/helm/example-org/voorbeeldzaken
    features:
      - Register and update cases
      - Use case types from a catalogue
      - Send a message on every change

legal:
  license: EUPL-1.2
  mainCopyrightOwner: Gemeente Voorbeeld

maintenance:
  type: contract
  contractors:
    - name: Voorbeeld Software B.V.
      until: "2027-12-31"
      email: support@example.org
      website: "https://www.example.org"
  contacts:
    - name: Jan Jansen
      email: jan.jansen@example.org

localisation:
  localisationReady: true
  availableLanguages:
    - nl
    - en
`;
