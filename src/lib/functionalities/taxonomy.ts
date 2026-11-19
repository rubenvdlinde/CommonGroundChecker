/**
 * The shared list of functionalities that components are mapped to, in
 * config/functionalities.yml. It is generated from GEMMA: the reference
 * components (referentiecomponenten) and the application services
 * (applicatieservices) they realise. A component names its functionalities
 * in config/repositories.yml by the ids of these application services.
 */

/** One GEMMA application service: a functionality a component can provide. */
export interface Functionality {
  /** Stable slug of the name */
  id: string;
  name: string;
  /** The GEMMA Object ID; the page is https://www.gemmaonline.nl/wiki/GEMMA/id-<gemmaId> */
  gemmaId: string;
  description: string | null;
}

/** One GEMMA reference component and the application services it realises. */
export interface ReferenceComponent {
  id: string;
  name: string;
  gemmaId: string;
  description: string | null;
  /** GEMMA status, for example "In gebruik" */
  status: string | null;
  /** Ids of its functionalities */
  functionalities: string[];
}

export interface TaxonomySource {
  name: string;
  url: string;
  commit: string | null;
  /** The release date the model states */
  release: string | null;
  licence: string;
}

export interface FunctionalityTaxonomy {
  source: TaxonomySource;
  referenceComponents: ReferenceComponent[];
  functionalities: Functionality[];
}

export const EMPTY_TAXONOMY: FunctionalityTaxonomy = {
  source: { name: "GEMMA", url: "", commit: null, release: null, licence: "EUPL-1.2" },
  referenceComponents: [],
  functionalities: [],
};

/** The page of a GEMMA element on GEMMA online. */
export function gemmaUrl(gemmaId: string): string {
  return `https://www.gemmaonline.nl/wiki/GEMMA/id-${gemmaId}`;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** The taxonomy from the parsed YAML; entries without an id and a name are left out. */
export function readTaxonomy(raw: unknown): FunctionalityTaxonomy {
  const root = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const source = root.source && typeof root.source === "object" ? (root.source as Record<string, unknown>) : {};
  const functionalities = list(root.functionalities).flatMap((item) => {
    const entry = (item ?? {}) as Record<string, unknown>;
    const id = text(entry.id);
    const name = text(entry.name);
    if (!id || !name) return [];
    return [{ id, name, gemmaId: text(entry.gemmaId) ?? "", description: text(entry.description) }];
  });
  const referenceComponents = list(root.referenceComponents).flatMap((item) => {
    const entry = (item ?? {}) as Record<string, unknown>;
    const id = text(entry.id);
    const name = text(entry.name);
    if (!id || !name) return [];
    return [
      {
        id,
        name,
        gemmaId: text(entry.gemmaId) ?? "",
        description: text(entry.description),
        status: text(entry.status),
        functionalities: list(entry.functionalities).filter((value): value is string => typeof value === "string"),
      },
    ];
  });
  return {
    source: {
      name: text(source.name) ?? "GEMMA",
      url: text(source.url) ?? "",
      commit: text(source.commit),
      release: text(source.release),
      licence: text(source.licence) ?? "EUPL-1.2",
    },
    referenceComponents,
    functionalities,
  };
}

/** Problems a schema cannot express: duplicate ids, and reference components naming an unknown functionality. */
export function taxonomyProblems(taxonomy: FunctionalityTaxonomy): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const functionality of taxonomy.functionalities) {
    if (ids.has(functionality.id)) problems.push(`Functionality ${functionality.id} is listed more than once.`);
    ids.add(functionality.id);
  }
  const componentIds = new Set<string>();
  for (const component of taxonomy.referenceComponents) {
    if (componentIds.has(component.id)) problems.push(`Reference component ${component.id} is listed more than once.`);
    componentIds.add(component.id);
    for (const id of component.functionalities) {
      if (!ids.has(id)) problems.push(`Reference component ${component.id} names unknown functionality ${id}.`);
    }
  }
  return problems;
}

/** The reference components that realise each functionality, by functionality id. */
export function referenceComponentsByFunctionality(taxonomy: FunctionalityTaxonomy): Map<string, ReferenceComponent[]> {
  const result = new Map<string, ReferenceComponent[]>();
  for (const component of taxonomy.referenceComponents) {
    for (const id of component.functionalities) result.set(id, [...(result.get(id) ?? []), component]);
  }
  return result;
}
