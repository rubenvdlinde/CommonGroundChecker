import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const ESTIMATE_DIR = path.join(process.cwd(), "scripts", "maintainability");
const COUPLING_DIR = path.join(process.cwd(), "scripts", "coupling");

/** Evaluates `expression` with the estimate as `m` and the coupling script as `c`, and returns it as JSON. */
function python(expression: string): unknown {
  const code = [
    "import json, sys",
    `sys.path.insert(0, ${JSON.stringify(ESTIMATE_DIR)})`,
    `sys.path.insert(0, ${JSON.stringify(COUPLING_DIR)})`,
    "import check_maintainability as m",
    "import check_coupling as c",
    `print(json.dumps(${expression}))`,
  ].join("\n");
  return JSON.parse(
    execFileSync("python3", ["-c", code], { encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } })
  );
}

const temporary: string[] = [];

afterEach(() => {
  for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function repo(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "declared-components-"));
  temporary.push(dir);
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

const SCOPE_COMPONENTS = 'components:\n  - name: Scope\n    include:\n      - ".*/lib/.*"\n';
const FILE_COMPONENTS =
  'components:\n  - name: Kernel\n    include:\n      - ".*/lib/Kernel/.*"\n    exclude:\n      - ".*/lib/Kernel/Contracts/Search/.*"\n' +
  '  - name: Search\n    include:\n      - ".*/lib/Search/.*"\n      - ".*/lib/Kernel/Contracts/Search/.*"\n' +
  '  - name: Core\n    include:\n      - ".*/lib/Core/.*"\n';

function definition(dir: string): { kind: string; description: string; names: string[] } {
  return python(
    `(lambda d: {"kind": d["kind"], "description": d["description"], ` +
      `"names": [d["component"](f) for f in ["lib/Kernel/A.php", "lib/Search/B.php", "lib/Core/C.php"]]})` +
      `(m.component_definition(${JSON.stringify(dir)}, ["lib/Kernel/A.php", "lib/Search/B.php", "lib/Core/C.php"]))`
  ) as { kind: string; description: string; names: string[] };
}

describe("declared component definition", () => {
  it("takes components: from the analysis scope file first", () => {
    const dir = repo({ "sigrid.yaml": SCOPE_COMPONENTS, "sigrid.components.yaml": FILE_COMPONENTS });

    expect(definition(dir)).toEqual({
      kind: "declared",
      description: "sigrid.yaml components (1 declared)",
      names: ["Scope", "Scope", "Scope"],
    });
  });

  it("takes the components file when the scope file declares no components: block", () => {
    const dir = repo({ "sigrid.yaml": 'component_base_dirs: [""]\n', "sigrid.components.yaml": FILE_COMPONENTS });

    expect(definition(dir)).toEqual({
      kind: "declared",
      description: "sigrid.components.yaml components (3 declared)",
      names: ["Kernel", "Search", "Core"],
    });
  });

  it("reads the .yml spelling of the components file without a scope file", () => {
    const dir = repo({ "sigrid.components.yml": FILE_COMPONENTS });

    expect(definition(dir).description).toBe("sigrid.components.yml components (3 declared)");
  });

  it("falls back to the scope file's component_base_dirs when no components are declared", () => {
    const dir = repo({ "sigrid.yaml": "component_base_dirs: [lib]\n" });

    expect(definition(dir)).toMatchObject({ kind: "declared", names: ["lib/Kernel", "lib/Search", "lib/Core"] });
    expect(definition(dir).description).toBe('sigrid.yaml component_base_dirs ["lib"]');
  });

  it("uses the directory rule when nothing is declared", () => {
    const result = definition(repo({ "README.md": "" }));

    expect(result.kind).toBe("directories");
    expect(result.description).toContain("directories below lib/");
    expect(result.names).toEqual(["Kernel", "Search", "Core"]);
  });
});

describe("references against the area order", () => {
  const comp = `(lambda rel: rel.split("/")[1])`;

  it("counts references to a higher area and lists the files they start in", () => {
    const result = python(
      `m.against_area_order([("lib/Kernel/A.php", "lib/Core/B.php"), ("lib/Kernel/A.php", "lib/Search/C.php"), ` +
        `("lib/Kernel/D.php", "lib/Core/B.php"), ("lib/Search/C.php", "lib/Core/B.php"), ("lib/Core/B.php", "lib/Kernel/A.php")], ` +
        `${comp}, ["Kernel", "Core", "Search"])`
    ) as Record<string, unknown>;

    expect(result).toEqual({
      order: ["Kernel", "Core", "Search"],
      references: 3,
      top_sources: [
        { file: "lib/Kernel/A.php", references: 2 },
        { file: "lib/Kernel/D.php", references: 1 },
      ],
      area_pairs: [
        { from: "Kernel", to: "Core", references: 2 },
        { from: "Kernel", to: "Search", references: 1 },
      ],
      unknown_areas: [],
    });
  });

  it("treats a contract under lib/Kernel/Contracts/<Area>/ as owned by that area", () => {
    const result = python(
      `m.against_area_order([("lib/Core/B.php", "lib/Kernel/Contracts/Search/Port.php"), ` +
        `("lib/Kernel/Contracts/Search/Port.php", "lib/Core/B.php")], ${comp}, ["Kernel", "Core", "Search"])`
    ) as { references: number; top_sources: { file: string }[] };

    expect(result.references).toBe(1);
    expect(result.top_sources).toEqual([{ file: "lib/Core/B.php", references: 1 }]);
  });

  it("counts a file whose area is not in the order on neither side and names unused areas", () => {
    const result = python(
      `m.against_area_order([("lib/Other/A.php", "lib/Search/C.php")], ${comp}, ["Kernel", "Search"])`
    ) as { references: number; unknown_areas: string[] };

    expect(result.references).toBe(0);
    expect(result.unknown_areas).toEqual(["Kernel"]);
  });

  it("reads the order from tools/sig/area-order.json and ignores a malformed one", () => {
    const good = repo({ "tools/sig/area-order.json": JSON.stringify({ order: ["Kernel", "Core"] }) });
    const bad = repo({ "tools/sig/area-order.json": JSON.stringify({ order: "Kernel" }) });

    expect(python(`m.read_area_order(${JSON.stringify(good)})`)).toEqual(["Kernel", "Core"]);
    expect(python(`m.read_area_order(${JSON.stringify(bad)})`)).toBeNull();
  });
});

describe("coupling on the declared components", () => {
  // Kernel/A and Core/B reference each other; Search/C uses Core/B.
  const loc = `{"lib/Kernel/A.php": 10, "lib/Core/B.php": 20, "lib/Search/C.php": 30, "lib/Kernel/Contracts/Search/P.php": 5}`;
  const edges = `{("lib/Kernel/A.php", "lib/Core/B.php"), ("lib/Core/B.php", "lib/Kernel/A.php"), ("lib/Search/C.php", "lib/Core/B.php"), ("lib/Core/B.php", "lib/Kernel/Contracts/Search/P.php")}`;

  it("measures with the components the repository declares and gives the directory view next to them", () => {
    const dir = repo({
      "sigrid.yaml": 'component_base_dirs: [""]\n',
      "sigrid.components.yaml": FILE_COMPONENTS,
      "tools/sig/area-order.json": JSON.stringify({ order: ["Kernel", "Core", "Search"] }),
    });
    const result = python(`c.score(${loc}, ${edges}, ${JSON.stringify(dir)})`) as Record<string, any>;

    expect(result.componentDefinition).toBe("sigrid.components.yaml components (3 declared)");
    expect(result.componentDefinitionKind).toBe("declared");
    expect(result.components).toBe(3);
    expect(result.directoryView.componentDefinition).toContain("directories below lib/");
    expect(result.directoryView.components).toBe(3);
    expect(result.areaOrder.references).toBe(2);
    expect(result.areaOrder.topSources).toEqual([
      { file: "lib/Kernel/A.php", references: 1 },
      { file: "lib/Core/B.php", references: 1 },
    ].sort((a, b) => a.file.localeCompare(b.file)));
  });

  it("agrees with the estimate on the component of every module", () => {
    const dir = repo({ "sigrid.components.yaml": FILE_COMPONENTS });
    const files = ["lib/Kernel/A.php", "lib/Core/B.php", "lib/Search/C.php", "lib/Kernel/Contracts/Search/P.php"];
    const names = python(
      `[m.component_definition(${JSON.stringify(dir)}, ${JSON.stringify(files)})["component"](f) for f in ${JSON.stringify(files)}]`
    );

    expect(names).toEqual(["Kernel", "Core", "Search", "Search"]);
  });

  it("uses directories without a repository and reports no directory view", () => {
    const result = python(`c.score(${loc}, ${edges})`) as Record<string, unknown>;

    expect(result.componentDefinitionKind).toBe("directories");
    expect(result.directoryView).toBeUndefined();
    expect(result.areaOrder).toBeUndefined();
  });
});

describe("estimate structure on the declared components", () => {
  const files = `{"lib/Kernel/A.php": "php", "lib/Core/B.php": "php", "lib/Search/C.php": "php"}`;
  const deps = `{"lib/Kernel/A.php": {"lib/Core/B.php"}, "lib/Core/B.php": {"lib/Kernel/A.php"}, "lib/Search/C.php": {"lib/Core/B.php"}}`;

  function structure(dir: string, fromScope: boolean): Record<string, any> {
    for (const name of ["lib/Kernel/A.php", "lib/Core/B.php", "lib/Search/C.php"]) {
      mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
      writeFileSync(path.join(dir, name), "<?php\n$a = 1;\n$b = 2;\n");
    }
    return python(
      `(setattr(m, "COMPONENTS_FROM_SCOPE", ${fromScope ? "True" : "False"}), ` +
        `m.structure(${JSON.stringify(dir)}, ${files}, ${deps}))[1]`
    ) as Record<string, any>;
  }

  it("rates the declared components and keeps the directory figures beside them", () => {
    const dir = repo({
      "sigrid.components.yaml": 'components:\n  - name: Base\n    include:\n      - ".*/lib/(Kernel|Core)/.*"\n  - name: Search\n    include:\n      - ".*/lib/Search/.*"\n',
      "tools/sig/area-order.json": JSON.stringify({ order: ["Base", "Search"] }),
    });
    const result = structure(dir, true);

    expect(result.component_source).toBe("sigrid.components.yaml components (2 declared)");
    expect(Object.keys(result.components).sort()).toEqual(["Base", "Search"]);
    expect(result.component_entanglement.violation_degree).toBe(0);
    expect(result.directory_view.component_source).toBe("directory rule");
    expect(result.directory_view.component_entanglement.violation_degree).toBeGreaterThan(0);
    expect(result.area_order.references).toBe(0);
  });

  it("keeps the directory rule when the scope is not read", () => {
    const dir = repo({ "sigrid.components.yaml": FILE_COMPONENTS });
    const result = structure(dir, false);

    expect(result.component_source).toBe("directory rule");
    expect(result.directory_view).toBeUndefined();
  });

  it("rates the report under both definitions and says the declared one is used", () => {
    const dir = repo({
      "sigrid.components.yaml": 'components:\n  - name: Base\n    include:\n      - ".*/lib/(Kernel|Core)/.*"\n  - name: Search\n    include:\n      - ".*/lib/Search/.*"\n',
    });
    const s = structure(dir, true);
    const report = { languages: {}, structure: { php: s } };
    const views = python(
      `(lambda r: (r.__setitem__("rating", m.rating_estimate(r)), m.component_views(r))[1])(${JSON.stringify(report)
        .replace(/\btrue\b/g, "True")
        .replace(/\bfalse\b/g, "False")
        .replace(/\bnull\b/g, "None")})`
    ) as Record<string, any>;

    expect(views.used).toBe("declared");
    expect(views.declared.languages.php).toMatchObject({ components: 2, violation_degree: 0 });
    expect(views.directories.languages.php.definition).toBe("directory rule");
    expect(views.directories.component_entanglement).toBeLessThan(views.declared.component_entanglement);
  });
});
