import type { Metadata } from "next";
import Link from "next/link";
import {
  PROFILE_EXAMPLE,
  PROFILE_FIELDS,
  PUBLICCODE_YML_VERSION,
  REFERENCE_PARSER,
  REQUIREMENT_LABELS,
  STANDARD_NOTES,
  standardRows,
  type ProfileField,
} from "@/lib/publiccodeProfile";

export const metadata: Metadata = {
  title: "The Common Ground profile for publiccode.yml | Rating guide",
  description:
    "How to fill publiccode.yml so the checker and the Common Ground programme can read it, including the standards and versions a component supports.",
};

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-cg-gray rounded-lg p-3 text-xs overflow-x-auto">
      <code>{children}</code>
    </pre>
  );
}

function FieldSection({ field }: { field: ProfileField }) {
  const headingId = `${field.id}-heading`;
  return (
    <section
      id={field.id}
      aria-labelledby={headingId}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3 scroll-mt-6"
    >
      <h3 id={headingId} className="text-xl font-bold text-cg-blue break-words">
        {field.keys}
      </h3>
      <p className="text-sm font-semibold text-gray-700">
        {REQUIREMENT_LABELS[field.requirement]}
        {field.status && `, ${field.status}`}
      </p>
      <ul className="list-disc pl-6 space-y-1 text-gray-700">
        {field.what.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <Code>{field.example}</Code>
      <p className="text-sm text-gray-700">
        <strong>Read by:</strong> {field.usedBy}
      </p>
    </section>
  );
}

function StandardsTable() {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-left border border-gray-200">
        <caption className="text-left text-gray-700 pb-2">
          The standards the checker knows. Replace {"{version}"} in the supports id with one of the versions. Every
          URI was checked at the publisher.
        </caption>
        <thead className="bg-cg-gray">
          <tr>
            <th scope="col" className="p-2">Standard</th>
            <th scope="col" className="p-2">supports id</th>
            <th scope="col" className="p-2">Versions</th>
            <th scope="col" className="p-2">Source</th>
          </tr>
        </thead>
        <tbody>
          {standardRows().map((row) => (
            <tr key={row.name} className="border-t border-gray-200 align-top">
              <th scope="row" className="p-2 font-medium">
                {row.name}
                {row.group && <span className="block text-xs font-normal text-gray-500">{row.group}</span>}
              </th>
              {row.agreed ? (
                <>
                  <td className="p-2 break-all">
                    <code className="text-xs">{row.uriTemplate}</code>
                  </td>
                  <td className="p-2">{row.versions.join(", ")}</td>
                </>
              ) : (
                <td className="p-2" colSpan={2}>
                  <strong>URI to agree.</strong> {row.note}
                </td>
              )}
              <td className="p-2">
                <a href={row.source.url} className="text-cg-lightblue hover:underline" rel="noopener noreferrer">
                  {row.source.title}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PubliccodeProfilePage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <section className="space-y-3">
        <p className="text-sm">
          <Link href="/docs" className="text-cg-lightblue hover:underline">
            Rating guide
          </Link>
        </p>
        <h1 className="text-3xl font-bold text-cg-blue">The Common Ground profile for publiccode.yml</h1>
        <p className="text-gray-700">
          This page tells a maintainer how to fill publiccode.yml so the checker and the Common Ground programme can
          read it. It uses only keys of the{" "}
          <a
            href="https://publiccodeyml.github.io/v0/schema.core.html"
            className="text-cg-lightblue hover:underline"
            rel="noopener noreferrer"
          >
            publiccode.yml standard
          </a>{" "}
          version {PUBLICCODE_YML_VERSION}, so the file stays valid for the reference parser and for other registers.
        </p>
        <p className="text-gray-700">
          There is no separate Dutch section. Country sections are deprecated in the standard, and the reference
          parser rejects every key it does not know, also an NL section or an x- key.
        </p>
        <p className="text-gray-700">
          Each field below says what to put there, gives an example, and names the criterion that reads it.{" "}
          <strong>Needed for Suitable</strong> means a mandatory criterion or Suitable for Common Ground depends on
          it. Suitable for Common Ground is the threshold the programme uses to decide whether to adopt a component
          as supported. <strong>Needed for Maintained (proposed)</strong> belongs to the proposed Maintained level,
          which also needs a valid SLA with a maintainer on the VNG model contract.{" "}
          <strong>Informative</strong> is shown or compared, but no rating or verdict depends on it. A field marked
          in development or proposed is read by a part of the checker that is not released yet.
        </p>
      </section>

      <section aria-labelledby="standards-convention" className="space-y-3">
        <h2 id="standards-convention" className="text-2xl font-bold text-cg-blue">
          Declaring a standard and its version
        </h2>
        <p className="text-gray-700">
          publiccode.yml lists supported standards under supports. Each entry has one key, id, which must be a URI
          (an http or https URL with a host, or a URN) or an alias from the standard&apos;s alias list. The parser
          rejects any other key in an entry, so a separate version key is not possible. The version therefore goes
          into the URI:
        </p>
        <ol className="list-decimal pl-6 space-y-1 text-gray-700">
          <li>
            Use the official URI of that exact version, as the publisher writes it. Write the full version, such as
            2.1.0, not a shortcut such as 2.1 that redirects to it. Then every version has exactly one id.
          </li>
          <li>List every version the component supports as a separate entry.</li>
          <li>
            A standard without an official per-version URI is marked &quot;URI to agree&quot; below. Do not make up a
            URI for it: the checker would list it as not in the registry. The URI is agreed with the publisher first.
          </li>
          <li>The Common Ground layer uses the same key, with the layer after the # of the five-layer model URI.</li>
        </ol>
        <Code>
          {'supports:\n  - id: "https://commonground.nl/cms/view/54476261/5-lagen-model#service"\n  - id: "https://vng-realisatie.github.io/gemma-zaken/standaard/zaken/redoc-1.5.1.html"\n  - id: "https://gitdocumentatie.logius.nl/publicatie/api/adr/2.1.0/"\n  - id: "alias:gdpr"'}
        </Code>
        <p className="text-gray-700">
          The Supported standards criterion lists what you declare and compares it with the OpenAPI files in the
          repository. It recognises a file by its info.title, or else by the top-level resources of the standard,
          and takes the version from info.version. Each match says which way it was found. It reports declared and found, declared but not found in
          the repository, and found in the repository but not declared. It is informative: it has no stars and does
          not count in a rating or in the verdict.
        </p>
        <StandardsTable />
        <ul className="list-disc pl-6 space-y-1 text-gray-700">
          {STANDARD_NOTES.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="fields" className="space-y-4">
        <h2 id="fields" className="text-2xl font-bold text-cg-blue">
          The fields the checker reads
        </h2>
        {PROFILE_FIELDS.map((field) => (
          <FieldSection key={field.id} field={field} />
        ))}
      </section>

      <section aria-labelledby="example" className="space-y-3">
        <h2 id="example" className="text-2xl font-bold text-cg-blue">
          A complete example
        </h2>
        <p className="text-gray-700">
          A publiccode.yml for a fictional component. It passes the reference parser {REFERENCE_PARSER.name}{" "}
          {REFERENCE_PARSER.version}. The parser warns that usedBy is deprecated, and accepts the file.
        </p>
        <Code>{PROFILE_EXAMPLE}</Code>
      </section>

      <section aria-labelledby="validate" className="space-y-3">
        <h2 id="validate" className="text-2xl font-bold text-cg-blue">
          Validate your file
        </h2>
        <p className="text-gray-700">
          Run the{" "}
          <a href={REFERENCE_PARSER.url} className="text-cg-lightblue hover:underline" rel="noopener noreferrer">
            reference parser
          </a>{" "}
          in the folder with your publiccode.yml:
        </p>
        <Code>{REFERENCE_PARSER.command}</Code>
      </section>
    </div>
  );
}
