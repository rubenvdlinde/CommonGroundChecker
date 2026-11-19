/**
 * Reads the GEMMA ArchiMate model (the Open Group exchange format that
 * VNG-Realisatie/GEMMA-Archi-repository publishes as export/GEMMA release.xml)
 * and keeps what the functionality taxonomy needs: the reference components
 * and the application services they realise.
 */
import type { FunctionalityTaxonomy, ReferenceComponent, Functionality } from "./taxonomy";

interface ArchimateElement {
  identifier: string;
  type: string;
  name: string;
  documentation: string | null;
  properties: Record<string, string>;
}

interface ArchimateRelationship {
  type: string;
  source: string;
  target: string;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function attribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return match ? decode(match[1]) : null;
}

function childText(body: string, tag: string): string | null {
  const match = body.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
  const text = match ? decode(match[1]).trim() : "";
  return text || null;
}

function propertyDefinitions(xml: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const match of xml.matchAll(/<propertyDefinition\s([^>]*)>([\s\S]*?)<\/propertyDefinition>/g)) {
    const id = attribute(` ${match[1]}`, "identifier");
    const name = childText(match[2], "name");
    if (id && name) result.set(id, name);
  }
  return result;
}

function propertiesOf(body: string, definitions: Map<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const match of body.matchAll(/<property\s([^>]*)>([\s\S]*?)<\/property>/g)) {
    const name = definitions.get(attribute(` ${match[1]}`, "propertyDefinitionRef") ?? "");
    const value = childText(match[2], "value");
    if (name && value) result[name] = value;
  }
  return result;
}

export function parseArchimate(xml: string): {
  properties: Record<string, string>;
  elements: ArchimateElement[];
  relationships: ArchimateRelationship[];
} {
  const definitions = propertyDefinitions(xml);
  const elements: ArchimateElement[] = [];
  for (const match of xml.matchAll(/<element\s([^>]*?)(?:\/>|>([\s\S]*?)<\/element>)/g)) {
    const tag = ` ${match[1]}`;
    const body = match[2] ?? "";
    const identifier = attribute(tag, "identifier");
    const type = attribute(tag, "xsi:type");
    const name = childText(body, "name");
    if (!identifier || !type || !name) continue;
    elements.push({
      identifier,
      type,
      name,
      documentation: childText(body, "documentation"),
      properties: propertiesOf(body, definitions),
    });
  }
  const relationships: ArchimateRelationship[] = [];
  for (const match of xml.matchAll(/<relationship\s([^>]*?)\/?>/g)) {
    const tag = ` ${match[1]}`;
    const type = attribute(tag, "xsi:type");
    const source = attribute(tag, "source");
    const target = attribute(tag, "target");
    if (type && source && target) relationships.push({ type, source, target });
  }
  const header = xml.slice(0, xml.search(/<elements>/) >= 0 ? xml.search(/<elements>/) : 0);
  return { properties: propertiesOf(header, definitions), elements, relationships };
}

/** "Registreren en delen van zaken" becomes registreren-en-delen-van-zaken. */
export function taxonomySlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueSlug(name: string, taken: Set<string>, gemmaId: string): string {
  const base = taxonomySlug(name) || gemmaId;
  const slug = taken.has(base) ? `${base}-${gemmaId.slice(0, 8)}` : base;
  taken.add(slug);
  return slug;
}

export interface GemmaSource {
  /** Where the export was read */
  url: string;
  /** The commit of the export, for a reproducible import */
  commit: string | null;
}

/**
 * The taxonomy from the GEMMA model: every reference component
 * (GEMMA type "Referentiecomponent") and every application service a
 * reference component realises. Sorted by name; ids are slugs of the names.
 */
export function taxonomyFromGemma(xml: string, source: GemmaSource): FunctionalityTaxonomy {
  const model = parseArchimate(xml);
  const byIdentifier = new Map(model.elements.map((element) => [element.identifier, element]));
  const components = model.elements.filter(
    (element) => element.type === "ApplicationComponent" && element.properties["GEMMA type"] === "Referentiecomponent"
  );
  const componentIds = new Set(components.map((component) => component.identifier));
  const servicesOf = new Map<string, Set<string>>();
  for (const relation of model.relationships) {
    if (relation.type !== "Realization" || !componentIds.has(relation.source)) continue;
    if (byIdentifier.get(relation.target)?.type !== "ApplicationService") continue;
    servicesOf.set(relation.source, (servicesOf.get(relation.source) ?? new Set()).add(relation.target));
  }

  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "nl", { sensitivity: "base" });
  const serviceElements = [...new Set([...servicesOf.values()].flatMap((set) => [...set]))]
    .map((identifier) => byIdentifier.get(identifier) as ArchimateElement)
    .sort(byName);
  const takenServices = new Set<string>();
  const serviceSlug = new Map<string, string>();
  const functionalities: Functionality[] = serviceElements.map((element) => {
    const gemmaId = element.properties["Object ID"] ?? element.identifier;
    const id = uniqueSlug(element.name, takenServices, gemmaId);
    serviceSlug.set(element.identifier, id);
    return { id, name: element.name, gemmaId, description: element.documentation };
  });

  const takenComponents = new Set<string>();
  const referenceComponents: ReferenceComponent[] = [...components].sort(byName).map((element) => {
    const gemmaId = element.properties["Object ID"] ?? element.identifier;
    return {
      id: uniqueSlug(element.name, takenComponents, gemmaId),
      name: element.name,
      gemmaId,
      description: element.documentation,
      status: element.properties["GEMMA status"] ?? null,
      functionalities: [...(servicesOf.get(element.identifier) ?? [])]
        .map((identifier) => serviceSlug.get(identifier) as string)
        .sort(),
    };
  });

  return {
    source: {
      name: "GEMMA",
      url: source.url,
      commit: source.commit,
      release: model.properties.Release ?? null,
      licence: "EUPL-1.2",
    },
    referenceComponents,
    functionalities,
  };
}
