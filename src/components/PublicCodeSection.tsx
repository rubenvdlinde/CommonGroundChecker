import Image from "next/image";
import type { ReactNode } from "react";
import type { PublicCodeData, PublicCodeDependency, PublicCodeParty } from "@/lib/types";

interface PublicCodeSectionProps {
  data: PublicCodeData;
}

function isWebUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

/** A value as a link when it is an http(s) URL, else as text. */
function LinkOrText({ value, label }: { value: string; label?: string }) {
  if (!isWebUrl(value)) return <>{value}</>;
  return (
    <a href={value} target="_blank" rel="noopener noreferrer" className="text-cg-lightblue hover:underline break-all">
      {label ?? value}
    </a>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-1.5 sm:grid sm:grid-cols-[12rem_1fr] sm:gap-3">
      <dt className="text-xs font-semibold text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-800">{children}</dd>
    </div>
  );
}

function joined(values: string[]): string | null {
  return values.length > 0 ? values.join(", ") : null;
}

function partyLine(party: PublicCodeParty): ReactNode {
  if (!party.name && !party.uri) return null;
  if (party.name && party.uri) {
    return (
      <>
        {party.name} (<LinkOrText value={party.uri} />)
      </>
    );
  }
  return party.name ?? <LinkOrText value={party.uri as string} />;
}

function dependencyLine(dependency: PublicCodeDependency): string {
  const versions = [
    dependency.version,
    dependency.versionMin && `from ${dependency.versionMin}`,
    dependency.versionMax && `up to ${dependency.versionMax}`,
  ].filter(Boolean);
  return [
    dependency.name ?? "Unnamed",
    versions.length > 0 ? ` (${versions.join(", ")})` : "",
    dependency.optional ? ", optional" : "",
  ].join("");
}

function pickLanguage(data: PublicCodeData): number {
  const index = ["nl", "en"]
    .map((code) => data.descriptions.findIndex((description) => description.language.toLowerCase().startsWith(code)))
    .find((found) => found !== -1);
  return index ?? 0;
}

/** Every field the repository's publiccode.yml declares, as shown on the component page. */
export default function PublicCodeSection({ data }: PublicCodeSectionProps) {
  const openLanguage = pickLanguage(data);
  const dependencies = [
    ...data.dependsOn.open.map((dependency) => ({ kind: "Open", dependency })),
    ...data.dependsOn.proprietary.map((dependency) => ({ kind: "Proprietary", dependency })),
    ...data.dependsOn.hardware.map((dependency) => ({ kind: "Hardware", dependency })),
  ];
  const audience = [
    joined(data.intendedAudience.scope) && `Scope: ${joined(data.intendedAudience.scope)}`,
    joined(data.intendedAudience.countries) && `Countries: ${joined(data.intendedAudience.countries)}`,
    joined(data.intendedAudience.unsupportedCountries) &&
      `Not supported in: ${joined(data.intendedAudience.unsupportedCountries)}`,
  ].filter(Boolean);
  const localisation = [
    data.localisation.localisationReady === null
      ? null
      : data.localisation.localisationReady
        ? "Ready for translation"
        : "Not ready for translation",
    joined(data.localisation.availableLanguages) && `Languages: ${joined(data.localisation.availableLanguages)}`,
  ].filter(Boolean);
  const legal = [
    data.legal.license && `Licence: ${data.legal.license}`,
    data.legal.mainCopyrightOwner && `Copyright: ${data.legal.mainCopyrightOwner}`,
    data.legal.repoOwner && `Repository owner: ${data.legal.repoOwner}`,
    data.legal.authorsFile && `Authors: ${data.legal.authorsFile}`,
  ].filter(Boolean);

  return (
    <section aria-labelledby="publiccode-section" className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
      <h3 id="publiccode-section" className="font-semibold text-sm uppercase tracking-wide text-gray-600">
        From publiccode.yml
      </h3>

      <dl className="divide-y divide-gray-100">
        {data.name && <Field label="Name">{data.name}</Field>}
        {data.applicationSuite && <Field label="Application suite">{data.applicationSuite}</Field>}
        {data.url && (
          <Field label="Repository">
            <LinkOrText value={data.url} />
          </Field>
        )}
        {data.landingURL && (
          <Field label="Website">
            <LinkOrText value={data.landingURL} />
          </Field>
        )}
        {data.roadmap && (
          <Field label="Roadmap">
            <LinkOrText value={data.roadmap} />
          </Field>
        )}
        {data.isBasedOn.length > 0 && (
          <Field label="Based on">
            {data.isBasedOn.map((value, index) => (
              <span key={value}>
                {index > 0 && ", "}
                <LinkOrText value={value} />
              </span>
            ))}
          </Field>
        )}
        {(data.softwareVersion || data.releaseDate) && (
          <Field label="Release">
            {[data.softwareVersion, data.releaseDate && `released ${data.releaseDate}`].filter(Boolean).join(", ")}
          </Field>
        )}
        {data.developmentStatus && <Field label="Development status">{data.developmentStatus}</Field>}
        {data.softwareType && <Field label="Software type">{data.softwareType}</Field>}
        {joined(data.platforms) && <Field label="Platforms">{joined(data.platforms)}</Field>}
        {joined(data.categories) && <Field label="Categories">{joined(data.categories)}</Field>}
        {audience.length > 0 && <Field label="Intended audience">{audience.join("; ")}</Field>}
        {joined(data.usedBy) && <Field label="Used by">{joined(data.usedBy)}</Field>}
        {data.organisation && partyLine(data.organisation) && (
          <Field label="Organisation">{partyLine(data.organisation)}</Field>
        )}
        {data.fundedBy.length > 0 && (
          <Field label="Funded by">
            <ul>
              {data.fundedBy.map((funder, index) => (
                <li key={`${funder.name}-${index}`}>{partyLine(funder)}</li>
              ))}
            </ul>
          </Field>
        )}
        {legal.length > 0 && <Field label="Legal">{legal.join("; ")}</Field>}
        {(data.maintenance.type || data.maintenance.contractors.length > 0 || data.maintenance.contacts.length > 0) && (
          <Field label="Maintenance">
            {data.maintenance.type && <p>Type: {data.maintenance.type}</p>}
            {data.maintenance.contractors.length > 0 && (
              <ul>
                {data.maintenance.contractors.map((contractor, index) => (
                  <li key={`${contractor.name}-${index}`}>
                    Contractor: {contractor.name ?? "unnamed"}
                    {contractor.until && `, until ${contractor.until}`}
                    {contractor.email && `, ${contractor.email}`}
                    {contractor.website && (
                      <>
                        , <LinkOrText value={contractor.website} />
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {data.maintenance.contacts.length > 0 && (
              <ul>
                {data.maintenance.contacts.map((contact, index) => (
                  <li key={`${contact.name}-${index}`}>
                    Contact: {[contact.name, contact.affiliation, contact.email, contact.phone].filter(Boolean).join(", ")}
                  </li>
                ))}
              </ul>
            )}
          </Field>
        )}
        {localisation.length > 0 && <Field label="Localisation">{localisation.join("; ")}</Field>}
        {dependencies.length > 0 && (
          <Field label="Depends on">
            <ul>
              {dependencies.map(({ kind, dependency }, index) => (
                <li key={`${kind}-${dependency.name}-${index}`}>
                  {kind}: {dependencyLine(dependency)}
                </li>
              ))}
            </ul>
          </Field>
        )}
        {data.publiccodeYmlVersion && <Field label="publiccode.yml version">{data.publiccodeYmlVersion}</Field>}
      </dl>

      {data.descriptions.map((description, index) => (
        <details
          key={`${description.language}-${index}`}
          open={index === openLanguage}
          className="border border-gray-200 rounded-xl px-4 py-3"
        >
          <summary className="cursor-pointer text-sm font-semibold text-gray-700">
            Description ({description.language || "no language"})
          </summary>
          <div className="mt-3 space-y-3 text-sm text-gray-800 [overflow-wrap:anywhere]">
            {(description.localisedName || description.genericName) && (
              <p className="font-semibold">
                {[description.localisedName, description.genericName].filter(Boolean).join(", ")}
              </p>
            )}
            {description.shortDescription && <p>{description.shortDescription}</p>}
            {description.longDescription && <p className="whitespace-pre-line">{description.longDescription}</p>}
            {description.features.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500">Features</h4>
                <ul className="list-disc pl-5">
                  {description.features.map((feature, featureIndex) => (
                    <li key={`${feature}-${featureIndex}`}>{feature}</li>
                  ))}
                </ul>
              </div>
            )}
            {(description.documentation || description.apiDocumentation) && (
              <p className="flex flex-wrap gap-4">
                {description.documentation && (
                  <LinkOrText value={description.documentation} label="Documentation" />
                )}
                {description.apiDocumentation && (
                  <LinkOrText value={description.apiDocumentation} label="API documentation" />
                )}
              </p>
            )}
            {description.screenshots.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {description.screenshots.map((screenshot, screenshotIndex) => (
                  <a key={screenshot} href={screenshot} target="_blank" rel="noopener noreferrer">
                    <Image
                      src={screenshot}
                      alt={`Screenshot ${screenshotIndex + 1}`}
                      width={0}
                      height={0}
                      sizes="16rem"
                      unoptimized
                      className="rounded-lg border border-gray-200"
                      style={{ height: "8rem", width: "auto" }}
                    />
                  </a>
                ))}
              </div>
            )}
            {description.videos.length > 0 && (
              <ul>
                {description.videos.map((video) => (
                  <li key={video}>
                    <LinkOrText value={video} />
                  </li>
                ))}
              </ul>
            )}
            {description.awards.length > 0 && <p>Awards: {joined(description.awards)}</p>}
          </div>
        </details>
      ))}
    </section>
  );
}
