# The Common Ground profile for publiccode.yml

This page tells a maintainer how to fill `publiccode.yml` so the Common Ground Component Checker and the Common Ground programme can read it. The same text is in the rating guide at `/docs/publiccode-profile`.

The profile uses only keys of the [publiccode.yml standard](https://publiccodeyml.github.io/v0/schema.core.html) version 0.8, so the file stays valid for the reference parser and for other registers. There is no separate Dutch section. Country sections are deprecated in the standard, and the reference parser ([libpubliccode](https://github.com/publiccodeyml/libpubliccode)) rejects every key it does not know, also an `NL` section or an `x-` key.

Each field below says what to put there, gives an example, and names the criterion that reads it.

- **Needed for Suitable**: a mandatory criterion or Suitable for Common Ground depends on it. Suitable for Common Ground is the threshold the programme uses to decide whether to adopt a component as supported.
- **Needed for Maintained (proposed)**: it belongs to the proposed Maintained level, which also needs a valid SLA with a maintainer on the VNG model contract.
- **Informative**: it is shown or compared, but no rating or verdict depends on it.

A field marked *in development* or *proposed* is read by a part of the checker that is not released yet.

## Declaring a standard and its version

`publiccode.yml` lists supported standards under `supports`. Each entry has one key, `id`. It must be a URI (an http or https URL with a host, or a URN) or an alias from the standard's [alias list](https://github.com/publiccodeyml/publiccode.yml/blob/main/docs/standard/aliases-list.rst). The parser rejects any other key in an entry, so a separate `version` key is not possible. The version therefore goes into the URI:

1. Use the official URI of that exact version, as the publisher writes it. Write the full version, such as `2.1.0`, not a shortcut such as `2.1` that redirects to it. Then every version has exactly one id.
2. List every version the component supports as a separate entry.
3. A standard without an official per-version URI is marked "URI to agree" below. Do not make up a URI for it: the checker would list it as not in the registry. The URI is agreed with the publisher first.
4. The Common Ground layer uses the same key, with the layer after the `#` of the five-layer model URI.

```yaml
supports:
  - id: "https://commonground.nl/cms/view/54476261/5-lagen-model#service"
  - id: "https://vng-realisatie.github.io/gemma-zaken/standaard/zaken/redoc-1.5.1.html"
  - id: "https://gitdocumentatie.logius.nl/publicatie/api/adr/2.1.0/"
  - id: "alias:gdpr"
```

The **Supported standards** criterion lists what you declare and compares it with the OpenAPI files in the repository. It recognises a file by its `info.title`, or else by the top-level resources of the standard, and takes the version from `info.version`. Each match says which way it was found. It reports declared and found, declared but not found in the repository, and found in the repository but not declared. It is informative: it has no stars and does not count in a rating or in the verdict.

### Known standards

Replace `{version}` in the `supports` id with one of the versions. Every URI was checked at the publisher on 19 November 2026. The registry is `src/lib/standards.ts`; add a version there after checking that its URI resolves.

| Standard | `supports` id | Versions | Source |
|---|---|---|---|
| Zaken API (ZGW APIs) | `https://vng-realisatie.github.io/gemma-zaken/standaard/zaken/redoc-{version}.html` | 1.0.0, 1.0.1, 1.0.2, 1.1.0, 1.2.0, 1.3.0, 1.3.1, 1.4.0, 1.4.1, 1.5.0, 1.5.1, 1.6.0, 1.7.0, 1.8.0 | [VNG Realisatie, ZGW API standaarden](https://vng-realisatie.github.io/gemma-zaken/standaard/) |
| Documenten API (ZGW APIs) | `https://vng-realisatie.github.io/gemma-zaken/standaard/documenten/redoc-{version}.html` | 1.0.0, 1.0.1, 1.1.0, 1.1.1, 1.2.0, 1.3.0, 1.3.1, 1.3.2, 1.4.0, 1.4.1, 1.5.0, 1.6.0, 1.7.0, 1.8.0 | [VNG Realisatie, ZGW API standaarden](https://vng-realisatie.github.io/gemma-zaken/standaard/) |
| Catalogi API (ZGW APIs) | `https://vng-realisatie.github.io/gemma-zaken/standaard/catalogi/redoc-{version}.html` | 1.0.0, 1.0.1, 1.1.0, 1.2.0, 1.3.0, 1.3.1, 1.3.2, 1.3.3, 1.4.0 | [VNG Realisatie, ZGW API standaarden](https://vng-realisatie.github.io/gemma-zaken/standaard/) |
| Besluiten API (ZGW APIs) | `https://vng-realisatie.github.io/gemma-zaken/standaard/besluiten/redoc-{version}.html` | 1.0.0, 1.0.1, 1.0.2, 1.1.0 | [VNG Realisatie, ZGW API standaarden](https://vng-realisatie.github.io/gemma-zaken/standaard/) |
| Notificaties API (ZGW APIs) | `https://vng-realisatie.github.io/gemma-zaken/standaard/notificaties/redoc-{version}.html` | 1.0.0, 1.0.1, 1.1.0 | [VNG Realisatie, ZGW API standaarden](https://vng-realisatie.github.io/gemma-zaken/standaard/) |
| Autorisaties API (ZGW APIs) | `https://vng-realisatie.github.io/gemma-zaken/standaard/autorisaties/redoc-{version}.html` | 1.0.0, 1.0.1, 1.1.0 | [VNG Realisatie, ZGW API standaarden](https://vng-realisatie.github.io/gemma-zaken/standaard/) |
| NL API Design Rules | `https://gitdocumentatie.logius.nl/publicatie/api/adr/{version}/` | 1.0, 2.0.0, 2.0.1, 2.0.2, 2.1.0, 2.2.0, 2.2.1, 2.2.2 | [Forum Standaardisatie, REST-API Design Rules](https://www.forumstandaardisatie.nl/open-standaarden/rest-api-design-rules) |
| Digikoppeling REST-API (Digikoppeling) | `https://gitdocumentatie.logius.nl/publicatie/dk/restapi/{version}/` | 1.0.0, 1.1.0, 2.0.0, 3.0.0, 4.0.0, 4.0.1 | [Logius, Digikoppeling](https://www.forumstandaardisatie.nl/open-standaarden/digikoppeling) |
| Digikoppeling WUS (Digikoppeling) | `https://gitdocumentatie.logius.nl/publicatie/dk/wus/{version}/` | 3.8.1 | [Logius, Digikoppeling](https://www.forumstandaardisatie.nl/open-standaarden/digikoppeling) |
| Digikoppeling ebMS2 (Digikoppeling) | `https://gitdocumentatie.logius.nl/publicatie/dk/ebms/{version}/` | 3.3.1, 3.3.2 | [Logius, Digikoppeling](https://www.forumstandaardisatie.nl/open-standaarden/digikoppeling) |
| Digikoppeling Grote Berichten (Digikoppeling) | `https://gitdocumentatie.logius.nl/publicatie/dk/gb/{version}/` | 3.8.1 | [Logius, Digikoppeling](https://www.forumstandaardisatie.nl/open-standaarden/digikoppeling) |
| StUF | `http://www.egem.nl/StUF/StUF{version}` | 0301 | [VNG Realisatie, StUF 03.01](https://vng-realisatie.github.io/StUF-onderlaag/301-familie) |
| BRP API Personen (Haal Centraal) | URI to agree | RvIG publishes one specification page for all versions. The versions are only named in the release notes. | [RvIG, BRP API Personen](https://developer.rvig.nl/brp-api/personen/specificatie/) |
| Objects API | URI to agree | Published as git tags of the open-object repository. The API version (info.version) differs from the release tag. | [Maykin Media, Open Object](https://github.com/maykinmedia/open-object) |
| Objecttypes API | URI to agree | Published as git tags of the objecttypes-api repository. The API version (info.version) differs from the release tag. | [Maykin Media, Objecttypes API](https://github.com/maykinmedia/objecttypes-api) |
| DigiD | URI to agree | Logius publishes the koppelvlak specification on a page without a version in its URI. | [Logius, Koppelvlakspecificatie DigiD SAML authenticatie](https://www.logius.nl/onze-dienstverlening/toegang/digid/documentatie/koppelvlakspecificatie-digid-saml-authenticatie) |
| eHerkenning | URI to agree | The afsprakenstelsel names its versions (for example AS1.24e) on pages without a version in their URI. | [Afsprakenstelsel Elektronische Toegangsdiensten, release informatie](https://afsprakenstelsel.etoegang.nl/Startpagina/as/release-informatie) |

Notes on the sources:

- ZGW APIs: VNG Realisatie publishes one documentation page per version, redoc-{version}.html. The OpenAPI files of these versions have info.title equal to the API name and info.version equal to the version. An implementation that renames its specification, such as Open Notificaties, is recognised by the API's top-level resources instead, for example kanaal and notificaties for the Notificaties API. Those resources are in every published version.
- NL API Design Rules and Digikoppeling: Logius publishes each version under its own path. Digikoppeling has no overall version since 2018, so each part is a standard of its own.
- StUF: the id is the XML namespace of StUF 03.01 from stuf0301.xsd. It identifies the version, but is not a web page.
- The checker recognises BRP API Personen, the Objects API and the Objecttypes API in OpenAPI files by their info.title, even though their URI is still to agree.

## The fields the checker reads

### publiccode.yml

Needed for Suitable.

- Put the file in the root of the repository. The publiccode.yml standard names the file publiccode.yml and places it in the root.
- The checker accepts publiccode.yml and publiccode.yaml. Use publiccode.yml, the name the standard and other registers use.

```text
voorbeeldzaken/
  publiccode.yml
  LICENSE
  README.md
```

Read by: The publiccode.yml criterion, a mandatory criterion. Without the file it fails.

### publiccodeYmlVersion, name, url, legal

Needed for Suitable.

- Use publiccodeYmlVersion "0.8". The supports key below exists from 0.8 on.
- name, url and legal are required by the standard. The checker warns when one of them is missing.

```yaml
publiccodeYmlVersion: "0.8"
name: Voorbeeldzaken
url: "https://github.com/example-org/voorbeeldzaken"
```

Read by: The publiccode.yml criterion.

### softwareVersion, releaseDate

Informative, in development.

- softwareVersion is the latest stable release. It must match a release tag, with or without a leading v: 2.4.0 matches the tag 2.4.0 or v2.4.0.
- releaseDate is the date of that release, as YYYY-MM-DD.
- The checker scans the tag that matches softwareVersion. Without a match it scans the newest stable release, and else the default branch with a warning.
- The basisset of the Common Ground standard (code.overheid.nl/CommonGround/vcg-basisset) lists each component with a version. softwareVersion is the version the checker compares with it.

```yaml
softwareVersion: "2.4.0"
releaseDate: "2026-10-01"
```

Read by: The choice of the version that is measured (#68). The checker reads it from the file in the root.

### developmentStatus

Needed for Maintained (proposed), proposed.

- One of concept, development, beta, stable or obsolete. Use stable only for a release that is ready for production.

```yaml
developmentStatus: stable
```

Read by: The Maintained level: only a stable component can reach it.

### maintenance

Needed for Suitable.

- Set type to contract and name each contractor with name and until. until is the date the contract ends, as YYYY-MM-DD, and must lie in the future.
- The types internal, community and none mean there is no maintenance contract, so the criterion fails.
- An email of a contractor must be a valid address.

```yaml
maintenance:
  type: contract
  contractors:
    - name: Voorbeeld Software B.V.
      until: "2027-12-31"
      email: support@example.org
```

Read by: The Maintenance contract criterion (#55). Suitable for Common Ground, the threshold the programme uses to decide whether to adopt a component as supported, requires a valid contract (#56).

### usedBy

Needed for Maintained (proposed), proposed.

- The names of the organisations that use the component in production. Name at least one: the Maintained level asks that the component is proven in use by one or more municipalities.
- The publiccode.yml standard marks usedBy as deprecated from 0.8 on and names no replacement key. The proposal behind it moves usage to the catalogue level. The reference parser warns, but still accepts the file. The checker reads it until there is a replacement.

```yaml
usedBy:
  - Gemeente Voorbeeld
  - Gemeente Proefstad
```

Read by: The Maintained level needs at least one organisation, together with Suitable for Common Ground, developmentStatus stable and a valid SLA with a maintainer on the VNG model contract. The usage overview and the organisation pages list them.

### supports (Common Ground layer)

Informative.

- One supports entry for the layer of the five-layer model: interaction, process, integration, service or data, after the # of the model's URI.
- Declare one layer. Two or more layers give a warning.
- The model's page on commonground.nl no longer resolves. The URI still works as an identifier, until VNG agrees a new one.

```yaml
supports:
  - id: "https://commonground.nl/cms/view/54476261/5-lagen-model#service"
```

Read by: The 5-layer criterion (#53). A declared layer takes precedence over the guess from paths and text. The layer does not count in the Architecture rating.

### supports (standards and versions)

Informative.

- One supports entry per standard and version, with the official URI of that version as id. The table below lists the URIs the checker knows.
- List each version the component supports as its own entry.

```yaml
supports:
  - id: "https://vng-realisatie.github.io/gemma-zaken/standaard/zaken/redoc-1.5.1.html"
  - id: "https://gitdocumentatie.logius.nl/publicatie/api/adr/2.1.0/"
```

Read by: The Supported standards criterion. It compares the declared standards with the OpenAPI files in the repository.

### description.<lang>.features

Informative.

- What the component does, as a short list. Write a Dutch description under nl, and an English one under en if you can.
- Functionality goes here, standards go under supports.

```yaml
description:
  nl:
    features:
      - Zaken registreren en bijwerken
      - Zaaktypen uit een catalogus gebruiken
```

Read by: The component page shows the features next to the supported standards.

### legal.license

Needed for Suitable.

- The licence as an SPDX expression, for example EUPL-1.2. It must name the same licence as the LICENSE file.

```yaml
legal:
  license: EUPL-1.2
  mainCopyrightOwner: Gemeente Voorbeeld
```

Read by: The publiccode.yml criterion requires legal. The licence consistency check (#11) compares legal.license with the LICENSE file and the package manifests.

### (no publiccode.yml key)

Needed for Suitable.

- publiccode.yml has no key for a container image, and the checker does not look for one there.
- Name the image in a Compose file or in Helm values, with the repository's own owner and name, for example ghcr.io/example-org/voorbeeldzaken:2.4.0 (#7). Or give the image location when you start a check.

```yaml
# docker-compose.yml
services:
  web:
    image: ghcr.io/example-org/voorbeeldzaken:2.4.0
```

Read by: The Available Docker image criterion, a mandatory criterion.

### (no publiccode.yml key): Artifact Hub link in a description

Needed for Suitable, in development.

- The Helm chart criterion looks for a Chart.yaml in the repository, or at the location you give when you start a check.
- For Artifact Hub, put the link to the package anywhere in publiccode.yml, for example in longDescription: https://artifacthub.io/packages/helm/<repository>/<package>. A package that publiccode.yml links to is taken as the component's own.

```yaml
description:
  nl:
    longDescription: >
      Installeer het met de Helm-chart op Artifact Hub:
      https://artifacthub.io/packages/helm/example-org/voorbeeldzaken
```

Read by: The Helm chart criterion, a mandatory criterion, and the Artifact Hub check of the chart and its images.
## A complete example

A `publiccode.yml` for a fictional component. It is [docs/examples/publiccode.yml](examples/publiccode.yml). It passes the reference parser publiccode-parser v5.5.1. The parser warns that `usedBy` is deprecated, and accepts the file.

```yaml
# A complete publiccode.yml for a fictional Common Ground component.
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
```

## Validate your file

Run the reference parser in the folder with your `publiccode.yml`:

```sh
docker run --rm -v "$PWD":/files:ro publiccodeyml/libpubliccode:v5.5.1 -no-network /files/publiccode.yml
```
