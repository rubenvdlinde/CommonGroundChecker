import Link from "next/link";
import { ownerOfRepository } from "@/lib/repositoryOwner";
import { providerHref } from "@/lib/routes";

/** "Provided by <owner>": the owner of the repository, linked to its provider page. */
export default function ProvidedBy({ repoUrl }: { repoUrl: string }) {
  const provider = ownerOfRepository(repoUrl);
  if (!provider?.slug) return null;
  return (
    <p className="text-sm text-gray-700">
      Provided by{" "}
      <Link href={providerHref(provider.slug)} className="break-all text-cg-lightblue hover:underline">
        {provider.name}
      </Link>
    </p>
  );
}
